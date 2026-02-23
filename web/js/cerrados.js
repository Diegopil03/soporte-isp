// web/js/cerrados.js
import { sb } from "./supabaseClient.js";

/**
 * Ajusta estos nombres SOLO si tu tabla tickets usa otros campos.
 * El script es tolerante (usa fallbacks), pero aquí puedes afinar.
 */
const CLOSED_STATUS = "cerrado"; // en tu Kanban es "cerrado"

// DOM
const closedList = document.getElementById("closedList");
const emptyState = document.getElementById("emptyState");
const metaText = document.getElementById("metaText");

const searchInput = document.getElementById("searchInput");
const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");

const btnApply = document.getElementById("btnApply");
const btnClear = document.getElementById("btnClear");
const btnRefresh = document.getElementById("btnRefresh");
const btnExport = document.getElementById("btnExport");

// Estado local
let allTickets = [];
let movementsByTicket = new Map(); // ticketId -> array movements (enriched)
let exportRows = []; // filas planas para CSV (ticket + item agregados)

// ============ helpers ============
function safeStr(v) {
  return (v ?? "").toString().trim();
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function fmtDateISO(d) {
  // YYYY-MM-DD for <input type="date">
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function movementSign(movementType) {
  // out = consumo (+), in = devolución (-) para “consumo neto”
  return movementType === "in" ? -1 : 1;
}

function normalizeTicket(t) {
  // tolerante a nombres de columnas
  const id = safeStr(t.id);
  const cliente = pick(t, ["customer_name", "cliente", "client_name", "nombre_cliente", "name"], "—");
  const titulo = pick(t, ["title", "titulo", "subject", "asunto"], "—");
  const zona = pick(t, ["zone", "zona"], "—");
  const bloque = pick(t, ["time_block", "bloque_horario", "bloque", "slot"], "—");
  const tipo = pick(t, ["client_type", "cliente_tipo", "tipo_cliente"], "—");
  const descripcion = pick(t, ["description", "descripcion", "details"], "—");
  const status = pick(t, ["status", "estado"], "—");

  const createdAt = pick(t, ["created_at"], null);
  const updatedAt = pick(t, ["updated_at"], null);
  const closedAt = pick(t, ["closed_at", "cerrado_at"], null); // si existe, úsalo

  return { ...t, id, cliente, titulo, zona, bloque, tipo, descripcion, status, createdAt, updatedAt, closedAt };
}

// ============ Supabase queries ============
async function fetchClosedTickets({ fromDate, toDate }) {
  // Nota: usamos updated_at como aproximación de cierre si no tienes closed_at.
  // Si tienes closed_at, lo puedes cambiar aquí.
  let q = sb
    .from("tickets")
    .select("*")
    .eq("status", CLOSED_STATUS)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (fromDate) {
    // “fromDate 00:00:00”
    q = q.gte("updated_at", `${fromDate}T00:00:00`);
  }
  if (toDate) {
    // “toDate 23:59:59”
    q = q.lte("updated_at", `${toDate}T23:59:59`);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map(normalizeTicket);
}

async function fetchMovementsForTickets(ticketIds) {
  if (!ticketIds.length) return [];

  // Traemos movimientos ligados a esos tickets
  // y luego traemos items para mapear nombre/sku/unit.
  const { data: movs, error: movErr } = await sb
    .from("inventory_movements")
    .select("id, ticket_id, item_id, movement_type, qty, note, created_at")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (movErr) throw movErr;

  const itemIds = [...new Set((movs || []).map((m) => m.item_id).filter(Boolean))];
  let itemsMap = new Map();

  if (itemIds.length) {
    const { data: items, error: itemErr } = await sb
      .from("inventory_items")
      .select("id, name, sku, unit")
      .in("id", itemIds)
      .limit(2000);

    if (itemErr) throw itemErr;

    itemsMap = new Map((items || []).map((it) => [String(it.id), it]));
  }

  // Enriquecemos cada movimiento con item
  return (movs || []).map((m) => {
    const item = itemsMap.get(String(m.item_id)) || null;
    return { ...m, item };
  });
}

// ============ Build view model ============
function buildMovementsByTicket(enrichedMovs) {
  const map = new Map();
  for (const m of enrichedMovs) {
    const key = String(m.ticket_id || "");
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return map;
}

function buildExportRows(tickets, movByTicket) {
  // agregamos por ticket + item_id (consumo neto)
  const rows = [];

  for (const t of tickets) {
    const movs = movByTicket.get(String(t.id)) || [];
    if (!movs.length) {
      rows.push({
        ticket_id: t.id,
        cliente: t.cliente,
        titulo: t.titulo,
        zona: t.zona,
        bloque: t.bloque,
        tipo_cliente: t.tipo,
        status: t.status,
        ticket_updated_at: t.updatedAt || "",
        item_id: "",
        item_sku: "",
        item_name: "",
        unit: "",
        qty_out: 0,
        qty_in: 0,
        net_consumed: 0,
      });
      continue;
    }

    const agg = new Map(); // item_id -> {out,in}
    for (const m of movs) {
      const itemId = String(m.item_id || "");
      if (!itemId) continue;
      if (!agg.has(itemId)) agg.set(itemId, { out: 0, in: 0, item: m.item });
      const a = agg.get(itemId);
      const q = Number(m.qty || 0);
      if (m.movement_type === "in") a.in += q;
      else a.out += q;
      if (!a.item && m.item) a.item = m.item;
    }

    for (const [itemId, a] of agg.entries()) {
      const net = a.out - a.in; // consumo neto (salidas - entradas)
      rows.push({
        ticket_id: t.id,
        cliente: t.cliente,
        titulo: t.titulo,
        zona: t.zona,
        bloque: t.bloque,
        tipo_cliente: t.tipo,
        status: t.status,
        ticket_updated_at: t.updatedAt || "",
        item_id: itemId,
        item_sku: a.item?.sku || "",
        item_name: a.item?.name || "",
        unit: a.item?.unit || "",
        qty_out: a.out,
        qty_in: a.in,
        net_consumed: net,
      });
    }
  }

  return rows;
}

// ============ Render ============
function renderTickets(tickets) {
  if (!closedList) return;

  closedList.innerHTML = "";
  emptyState?.classList.add("hidden");

  if (!tickets.length) {
    emptyState?.classList.remove("hidden");
    return;
  }

  const html = tickets.map((t) => {
    const movs = movementsByTicket.get(String(t.id)) || [];

    // resumen por item (solo “out” como consumo visible)
    const byItem = new Map();
    for (const m of movs) {
      const key = String(m.item_id || "");
      if (!key) continue;
      if (!byItem.has(key)) byItem.set(key, { out: 0, in: 0, item: m.item });
      const ref = byItem.get(key);
      const q = Number(m.qty || 0);
      if (m.movement_type === "in") ref.in += q;
      else ref.out += q;
      if (!ref.item && m.item) ref.item = m.item;
    }

    const items = [...byItem.values()].filter((x) => (x.out - x.in) !== 0);
    const materialLines = items.length
      ? items.map((x) => {
          const net = x.out - x.in;
          const u = x.item?.unit ? ` ${x.item.unit}` : "";
          const name = x.item?.name || "Material";
          const sku = x.item?.sku ? `SKU: ${x.item.sku}` : "";
          return `
            <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div class="min-w-0">
                <div class="text-sm font-bold text-slate-800 truncate">${name}</div>
                <div class="text-[11px] text-slate-400 font-mono">${sku}</div>
              </div>
              <div class="text-sm font-extrabold text-slate-900 whitespace-nowrap">${net}${u}</div>
            </div>
          `;
        }).join("")
      : `<div class="text-sm text-slate-400">Sin materiales ligados.</div>`;

    const when = t.closedAt || t.updatedAt || t.createdAt || "";

    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div class="min-w-0">
            <div class="text-xs text-slate-400 font-mono">${t.id.slice(0, 8)}…</div>
            <div class="text-lg font-extrabold text-slate-900 truncate">${t.cliente}</div>
            <div class="text-sm text-slate-600 truncate">${t.titulo}</div>

            <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div class="text-[10px] font-bold text-slate-400 uppercase">Zona</div>
                <div class="text-sm font-bold text-slate-800">${t.zona}</div>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div class="text-[10px] font-bold text-slate-400 uppercase">Bloque</div>
                <div class="text-sm font-bold text-slate-800">${t.bloque}</div>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div class="text-[10px] font-bold text-slate-400 uppercase">Tipo</div>
                <div class="text-sm font-bold text-slate-800">${t.tipo}</div>
              </div>
            </div>

            <div class="mt-3 text-xs text-slate-400">Cerrado/actualizado: ${when ? fmtDate(when) : "—"}</div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <a href="ticket_detail.html?id=${encodeURIComponent(t.id)}"
               class="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700">
              Ver detalle
            </a>
          </div>
        </div>

        <div class="mt-4">
          <div class="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Material consumido (neto)</div>
          <div class="space-y-2">
            ${materialLines}
          </div>
        </div>
      </div>
    `;
  }).join("");

  closedList.innerHTML = html;
}

function applyClientSideSearch(tickets, term) {
  const q = safeStr(term).toLowerCase();
  if (!q) return tickets;

  return tickets.filter((t) => {
    const blob = [
      t.id, t.cliente, t.titulo, t.zona, t.bloque, t.tipo, t.descripcion, t.status
    ].map((x) => safeStr(x).toLowerCase()).join(" | ");
    return blob.includes(q);
  });
}

// ============ CSV export ============
function toCSV(rows) {
  const headers = [
    "ticket_id",
    "cliente",
    "titulo",
    "zona",
    "bloque",
    "tipo_cliente",
    "status",
    "ticket_updated_at",
    "item_id",
    "item_sku",
    "item_name",
    "unit",
    "qty_out",
    "qty_in",
    "net_consumed",
  ];

  const esc = (v) => {
    const s = (v ?? "").toString();
    // CSV safe
    const needs = /[",\n]/.test(s);
    const cleaned = s.replace(/"/g, '""');
    return needs ? `"${cleaned}"` : cleaned;
  };

  const lines = [];
  lines.push(headers.join(","));
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  return lines.join("\n");
}

function downloadCSV(rows) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `tickets_cerrados_${fmtDateISO(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

// ============ main load ============
async function load() {
  try {
    if (metaText) metaText.textContent = "Cargando cerrados…";

    const from = dateFrom?.value || "";
    const to = dateTo?.value || "";

    // 1) tickets cerrados
    allTickets = await fetchClosedTickets({ fromDate: from, toDate: to });

    // 2) movimientos asociados
    const ids = allTickets.map((t) => t.id).filter(Boolean);
    const movs = await fetchMovementsForTickets(ids);

    movementsByTicket = buildMovementsByTicket(movs);

    // 3) export rows (agregadas)
    exportRows = buildExportRows(allTickets, movementsByTicket);

    // 4) render (con búsqueda client-side)
    const filtered = applyClientSideSearch(allTickets, searchInput?.value || "");
    renderTickets(filtered);

    if (metaText) {
      metaText.textContent = `Tickets cerrados: ${allTickets.length} · Movimientos: ${movs.length} · Filtrados: ${filtered.length}`;
    }
  } catch (err) {
    console.error("[cerrados] load error:", err);
    if (metaText) metaText.textContent = "Error cargando cerrados. Revisa consola / RLS.";
    if (closedList) closedList.innerHTML = "";
    emptyState?.classList.remove("hidden");
  }
}

// ============ init ============
document.addEventListener("DOMContentLoaded", () => {
  // Defaults de fechas: últimos 14 días
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 14);

  if (dateFrom && !dateFrom.value) dateFrom.value = fmtDateISO(past);
  if (dateTo && !dateTo.value) dateTo.value = fmtDateISO(today);

  btnApply?.addEventListener("click", load);

  btnClear?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    const today2 = new Date();
    const past2 = new Date();
    past2.setDate(today2.getDate() - 14);
    if (dateFrom) dateFrom.value = fmtDateISO(past2);
    if (dateTo) dateTo.value = fmtDateISO(today2);
    load();
  });

  btnRefresh?.addEventListener("click", load);

  // búsqueda instantánea sin reconsultar
  searchInput?.addEventListener("input", () => {
    const filtered = applyClientSideSearch(allTickets, searchInput.value);
    renderTickets(filtered);
    if (metaText) metaText.textContent = `Tickets cerrados: ${allTickets.length} · Filtrados: ${filtered.length}`;
  });

  btnExport?.addEventListener("click", () => {
    if (!exportRows?.length) {
      alert("No hay datos para exportar.");
      return;
    }
    downloadCSV(exportRows);
  });

  load();
});