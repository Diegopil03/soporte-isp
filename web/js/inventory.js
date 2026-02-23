// web/js/inventory.js
console.log("[inventory] inventory.js LOADED ✅");

import {
  fetchInventoryItems,
  createInventoryMovement,
  fetchMovementsByItemId,
  fetchClosedTickets,
  createInventoryItem,
  archiveInventoryItem,
} from "./inventory.api.js";

import { sb } from "./supabaseClient.js";

// DOM base
const tableBody = document.getElementById("inventoryList");
const footerText = document.getElementById("inventoryFooterText");

const btnExportCsv = document.getElementById("btnExportInventoryCsv");
if (btnExportCsv) btnExportCsv.addEventListener("click", onExportInventoryCsv);

const categoryFilter = document.getElementById("categoryFilter");
const searchInput = document.getElementById("searchInput");

// Tabs counters
const tabAll = document.getElementById("tabCountAll");
const tabFibra = document.getElementById("tabCountFibra");
const tabONT = document.getElementById("tabCountONT");
const tabConectores = document.getElementById("tabCountConectores");

// Tabs buttons
const tabBtnAll = document.getElementById("tabBtnAll");
const tabBtnFibra = document.getElementById("tabBtnFibra");
const tabBtnONT = document.getElementById("tabBtnONT");
const tabBtnConectores = document.getElementById("tabBtnConectores");

let currentCategory = "";
let currentSearch = "";

// cache tickets cerrados
let closedTicketsCache = [];

// data desde Supabase
let inventoryItems = [];

// =========================
// Helpers UI (tabs/estado)
// =========================
function setActiveTab(active) {
  const baseInactive =
    "pb-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2";
  const baseActive =
    "pb-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2";

  if (tabBtnAll) tabBtnAll.className = baseInactive;
  if (tabBtnFibra) tabBtnFibra.className = baseInactive;
  if (tabBtnONT) tabBtnONT.className = baseInactive;
  if (tabBtnConectores) tabBtnConectores.className = baseInactive;

  if (active === "all" && tabBtnAll) tabBtnAll.className = baseActive;
  if (active === "Fibra" && tabBtnFibra) tabBtnFibra.className = baseActive;
  if (active === "ONT" && tabBtnONT) tabBtnONT.className = baseActive;
  if (active === "Conectores" && tabBtnConectores) tabBtnConectores.className = baseActive;
}

function getStock(item) {
  return Number(item.stock ?? item.stock_on_hand ?? 0);
}

function getMinStock(item) {
  return Number(item.min_stock ?? 0);
}

function getStatus(item) {
  const stock = getStock(item);
  const min = getMinStock(item);

  if (stock <= 0) return "critical";
  if (min > 0 && stock < min) return "low";
  if (min <= 0 && stock < 3) return "low";
  return "ok";
}

// =========================
// Modal (inyectado por JS)
// =========================
let moveModalEl = null;
let moveBackdropEl = null;
let currentMoveItemId = null;

function formatDateShort(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

async function renderMovementsList(itemId) {
  const box = document.getElementById("movementsList");
  if (!box) return;

  box.innerHTML = `<div class="text-xs text-slate-400">Cargando movimientos...</div>`;

  const rows = await fetchMovementsByItemId(itemId, 25);

  if (!rows.length) {
    box.innerHTML = `<div class="text-xs text-slate-400">Sin movimientos todavía.</div>`;
    return;
  }

  box.innerHTML = rows
    .map((m) => {
      const isOut = m.movement_type === "out";
      const pillClass = isOut
        ? "bg-rose-100 text-rose-700 border-rose-200"
        : "bg-emerald-100 text-emerald-700 border-emerald-200";

      const label = isOut ? "Salida" : "Entrada";
      const ticket = m.ticket_id ? `Ticket: ${String(m.ticket_id).slice(0, 8)}…` : "—";

      return `
        <div class="border border-slate-200 rounded-xl px-3 py-2 bg-white">
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${pillClass}">${label}</span>
            <span class="text-[10px] text-slate-400 font-mono">${formatDateShort(m.created_at)}</span>
          </div>
          <div class="mt-1 text-xs text-slate-700 font-semibold">Cantidad: ${m.qty}</div>
          ${m.note ? `<div class="text-xs text-slate-500 mt-1">${m.note}</div>` : ""}
          <div class="text-[11px] text-slate-400 mt-1">${ticket}</div>
        </div>
      `;
    })
    .join("");
}

function ticketLabel(t) {
  const client = t.client_name ? t.client_name : "Cliente";
  const title = t.title ? ` — ${t.title}` : "";
  const shortId = t.id ? String(t.id).slice(0, 8) : "—";
  return `${client}${title} (#${shortId}…)`;
}

function fillClosedTicketsSelect() {
  const sel = document.getElementById("moveTicketSelect");
  if (!sel) return;

  const base = `<option value="">— Sin ticket —</option>`;
  const opts = (closedTicketsCache || [])
    .map((t) => `<option value="${t.id}">${ticketLabel(t)}</option>`)
    .join("");

  sel.innerHTML = base + opts;
}

function ensureMoveModal() {
  if (moveModalEl) return;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div id="moveBackdrop" class="fixed inset-0 bg-black/40 hidden z-[90]"></div>

    <div id="moveModal" class="fixed inset-0 hidden z-[100] flex items-center justify-center p-4">
      <div class="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div class="text-lg font-extrabold text-slate-900">Registrar movimiento</div>
            <div id="moveSubtitle" class="text-sm text-slate-500 mt-1">—</div>
          </div>
          <button id="moveCloseBtn" class="p-2 rounded-lg hover:bg-slate-100 text-slate-500">✕</button>
        </div>

        <div class="p-6 space-y-4">

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-slate-600">Tipo</label>
              <select id="moveType" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="out">Salida</option>
                <option value="in">Entrada</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-slate-600">Cantidad</label>
              <input id="moveQty" type="number" min="1" step="1"
                     class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                     value="1"/>
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-slate-600">Nota (opcional)</label>
            <input id="moveNote" type="text"
                   class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                   placeholder="Ej: Instalación en domicilio, reposición..."/>
          </div>

          <div>
            <label class="text-xs font-bold text-slate-600">Ticket (cerrado) opcional</label>

            <!-- ✅ SOLO SELECT (sin caja de búsqueda) -->
            <select
              id="moveTicketSelect"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            ></select>

            <div class="text-xs text-slate-400 mt-2">
              Selecciona el ticket cerrado al que se cargará este consumo.
            </div>
          </div>

          <div class="mt-5">
            <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Historial reciente
            </div>
            <div id="movementsList" class="space-y-2 max-h-40 overflow-auto pr-1"></div>
          </div>

        </div>

        <div class="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
  <button id="moveDeleteItemBtn" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm">
    Eliminar material
  </button>

  <div class="flex justify-end gap-2">
    <button id="moveCancelBtn" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm">
      Cancelar
    </button>
    <button id="moveSaveBtn" class="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">
      Guardar movimiento
    </button>
  </div>
</div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  moveModalEl = document.getElementById("moveModal");
  moveBackdropEl = document.getElementById("moveBackdrop");

  const close = () => closeMoveModal();
  document.getElementById("moveCloseBtn")?.addEventListener("click", close);
  document.getElementById("moveCancelBtn")?.addEventListener("click", close);
  moveBackdropEl?.addEventListener("click", close);

  document.getElementById("moveSaveBtn")?.addEventListener("click", onSaveMovement);
  document.getElementById("moveDeleteItemBtn")?.addEventListener("click", onDeleteCurrentItem);
}

async function onDeleteCurrentItem() {
  const itemId = currentMoveItemId;
  if (!itemId) return;

  const ok = confirm(
    "¿Estás seguro que quieres eliminar este material?\n\nSe ocultará del inventario, pero los movimientos históricos se conservarán."
  );
  if (!ok) return;

  const btn = document.getElementById("moveDeleteItemBtn");
  const old = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Eliminando...";
    btn.classList.add("opacity-70", "cursor-not-allowed");
  }

  try {
    const res = await archiveInventoryItem(itemId);
    if (!res?.ok) {
      alert(res?.error || "No se pudo eliminar el material.");
      return;
    }

    // refrescar lista y cerrar modal
    inventoryItems = await fetchInventoryItems();
    applyFilters();
    closeMoveModal();
  } catch (e) {
    console.error("[inventory] onDeleteCurrentItem error", e);
    alert("Error eliminando material. Revisa consola.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = old || "Eliminar material";
      btn.classList.remove("opacity-70", "cursor-not-allowed");
    }
  }
}

async function openMoveModal(item) {
  ensureMoveModal();

  currentMoveItemId = item?.id ?? null;

  const subtitle = document.getElementById("moveSubtitle");
  const stock = getStock(item);
  if (subtitle) subtitle.textContent = `${item?.name || "—"} · Stock actual: ${stock}`;

  // reset inputs
  const typeEl = document.getElementById("moveType");
  const qtyEl = document.getElementById("moveQty");
  const noteEl = document.getElementById("moveNote");
  const selectEl = document.getElementById("moveTicketSelect");

  if (typeEl) typeEl.value = "out";
  if (qtyEl) qtyEl.value = "1";
  if (noteEl) noteEl.value = "";
  if (selectEl) selectEl.value = "";

  // cargar historial del item
  if (currentMoveItemId) {
    await renderMovementsList(currentMoveItemId);
  }

  // cargar tickets cerrados (cache) y llenar dropdown
  if (!closedTicketsCache.length) {
    closedTicketsCache = await fetchClosedTickets(200);
  }
  fillClosedTicketsSelect();

  moveBackdropEl?.classList.remove("hidden");
  moveModalEl?.classList.remove("hidden");
}

function closeMoveModal() {
  currentMoveItemId = null;
  moveBackdropEl?.classList.add("hidden");
  moveModalEl?.classList.add("hidden");
}

async function onSaveMovement() {
  const saveBtn = document.getElementById("moveSaveBtn");

  try {
    if (!currentMoveItemId) {
      alert("No se detectó el item. (itemId vacío)");
      return;
    }

    const typeEl = document.getElementById("moveType");
    const qtyEl = document.getElementById("moveQty");
    const noteEl = document.getElementById("moveNote");
    const ticketSel = document.getElementById("moveTicketSelect");
    const cancelBtn = document.getElementById("moveCancelBtn");
    const closeBtn = document.getElementById("moveCloseBtn");

    const kind = typeEl?.value || "out";
    const qty = qtyEl?.value || "1";
    const note = noteEl?.value || "";
    const ticketId = (ticketSel?.value || "").trim();

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando...";
    }
    cancelBtn && (cancelBtn.disabled = true);
    closeBtn && (closeBtn.disabled = true);

    const res = await createInventoryMovement({
      itemId: currentMoveItemId,
      kind,
      qty,
      note,
      ticketId: ticketId || null,
    });

    if (!res?.ok) {
      alert(res?.error === "insufficient_stock" ? "Stock insuficiente." : "No se pudo guardar.");
      console.error("[inventory] createInventoryMovement failed:", res);
      return;
    }

    // refrescar items
    inventoryItems = await fetchInventoryItems();

    closeMoveModal();
    applyFilters();
  } catch (err) {
    console.error("[inventory] onSaveMovement error:", err);
    alert("Error inesperado guardando movimiento. Revisa consola.");
  } finally {
    const cancelBtn = document.getElementById("moveCancelBtn");
    const closeBtn = document.getElementById("moveCloseBtn");

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar movimiento";
    }
    cancelBtn && (cancelBtn.disabled = false);
    closeBtn && (closeBtn.disabled = false);
  }
}

// =========================
// Render tabla + filtros
// =========================
function renderTable(items) {
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (footerText) footerText.textContent = `Mostrando ${items.length} materiales`;

  if (!items.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">
          No hay materiales que coincidan con el filtro
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = items
    .map((item) => {
      const status = getStatus(item);

      let badgeClass = "";
      let badgeText = "";

      if (status === "critical") {
        badgeClass = "bg-rose-100 text-rose-700 border-rose-200";
        badgeText = "Sin stock / Crítico";
      } else if (status === "low") {
        badgeClass = "bg-amber-100 text-amber-700 border-amber-200";
        badgeText = "Stock bajo";
      } else {
        badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
        badgeText = "Stock suficiente";
      }

      const displayUnit = item.unit ? item.unit : "";
      const stock = getStock(item);

      return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
          <td class="px-6 py-4">
            <div class="flex flex-col">
              <span class="font-bold text-slate-800 text-sm">${item.name || "—"}</span>
              <span class="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">ID: ${String(item.id).slice(0, 8)}…</span>
            </div>
          </td>
          <td class="px-6 py-4 text-xs text-slate-600 font-medium">${item.category || "—"}</td>
          <td class="px-6 py-4">
            <span class="text-sm font-bold text-slate-700">${stock} ${displayUnit}</span>
          </td>
          <td class="px-6 py-4">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeClass}">
              ${badgeText}
            </span>
          </td>
          <td class="px-6 py-4 text-right">
            <button
              class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="Registrar movimiento"
              data-move="${item.id}"
            >
              ✏️
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  tableBody.querySelectorAll("[data-move]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-move");
      const item = inventoryItems.find((x) => x.id === id);

      if (!item) {
        console.warn("[inventory] item not found for movement:", id);
        alert("No se encontró el item para movimiento (id inválido).");
        return;
      }
      openMoveModal(item);
    });
  });
}

function updateTabsCounts() {
  if (!tabAll) return;

  tabAll.textContent = inventoryItems.length;
  tabFibra.textContent = inventoryItems.filter((i) => i.category === "Fibra").length;
  tabONT.textContent = inventoryItems.filter((i) => i.category === "ONT").length;
  tabConectores.textContent = inventoryItems.filter((i) => i.category === "Conectores").length;
}

function applyFilters() {
  let filtered = [...inventoryItems];

  if (currentCategory) filtered = filtered.filter((item) => item.category === currentCategory);

  if (currentSearch) {
    filtered = filtered.filter((item) =>
      String(item.name || "").toLowerCase().includes(currentSearch)
    );
  }

  updateTabsCounts();
  renderTable(filtered);
}

async function loadInventory() {
  try {
    inventoryItems = await fetchInventoryItems();
    console.log("[inventory] items desde Supabase:", inventoryItems.length);
  } catch (e) {
    console.error("[inventory] loadInventory error:", e);
    inventoryItems = [];
  }
  applyFilters();
}

// =========================
// Wiring filtros/tabs
// =========================
categoryFilter?.addEventListener("change", (e) => {
  currentCategory = e.target.value;
  setActiveTab(currentCategory ? currentCategory : "all");
  applyFilters();
});

searchInput?.addEventListener("input", (e) => {
  currentSearch = String(e.target.value || "").toLowerCase();
  applyFilters();
});

tabBtnAll?.addEventListener("click", () => {
  currentCategory = "";
  if (categoryFilter) categoryFilter.value = "";
  setActiveTab("all");
  applyFilters();
});

tabBtnFibra?.addEventListener("click", () => {
  currentCategory = "Fibra";
  if (categoryFilter) categoryFilter.value = "Fibra";
  setActiveTab("Fibra");
  applyFilters();
});

tabBtnONT?.addEventListener("click", () => {
  currentCategory = "ONT";
  if (categoryFilter) categoryFilter.value = "ONT";
  setActiveTab("ONT");
  applyFilters();
});

tabBtnConectores?.addEventListener("click", () => {
  currentCategory = "Conectores";
  if (categoryFilter) categoryFilter.value = "Conectores";
  setActiveTab("Conectores");
  applyFilters();
});

// Init
document.addEventListener("DOMContentLoaded", async () => {
  setActiveTab("all");
  ensureMoveModal();
  await loadInventory();
});

// --- Modal bridge: allow Inventario.html modal to persist items to Supabase ---
async function refreshInventoryUI() {
  const items = await fetchInventoryItems();
  inventoryItems = items;     // usa tu variable global del módulo
  applyFilters();             // re-render con tu pipeline actual
}

async function onExportInventoryCsv() {
  const btn = document.getElementById("btnExportInventoryCsv");
  try {
    if (btn) {
      btn.disabled = true;
      btn.classList.add("opacity-70", "cursor-not-allowed");
    }

    // 1) Movimientos + join a item + ticket (para saber “en quién se gastó”)
    const { data, error } = await sb
      .from("inventory_movements")
      .select(
        "id,created_at,movement_type,qty,note,ticket_id, item:inventory_items(id,name,category,unit,sku,stock_on_hand,min_stock), ticket:tickets(id,client_name,title,status)"
      )
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) throw error;

    const rows = (data || []).map((m) => {
      const item = m.item || {};
      const ticket = m.ticket || {};
      return {
        movement_id: m.id || "",
        movement_created_at: m.created_at || "",
        movement_type: m.movement_type || "",
        movement_qty: m.qty ?? "",
        movement_note: m.note ?? "",

        item_id: item.id || "",
        item_name: item.name || "",
        item_category: item.category || "",
        item_unit: item.unit || "",
        item_sku: item.sku || "",
        item_stock_on_hand: item.stock_on_hand ?? "",
        item_min_stock: item.min_stock ?? "",

        ticket_id: m.ticket_id || "",
        ticket_client_name: ticket.client_name || "",
        ticket_title: ticket.title || "",
        ticket_status: ticket.status || "",
      };
    });

    // 2) Si no hay movimientos, exporta catálogo de items
    if (rows.length === 0) {
      const { data: items, error: itemsErr } = await sb
        .from("inventory_items")
        .select("id,name,category,unit,sku,stock_on_hand,min_stock,is_active")
        .order("name", { ascending: true })
        .limit(5000);
      if (itemsErr) throw itemsErr;

      const baseRows = (items || []).map((it) => ({
        movement_id: "",
        movement_created_at: "",
        movement_type: "",
        movement_qty: "",
        movement_note: "",

        item_id: it.id || "",
        item_name: it.name || "",
        item_category: it.category || "",
        item_unit: it.unit || "",
        item_sku: it.sku || "",
        item_stock_on_hand: it.stock_on_hand ?? "",
        item_min_stock: it.min_stock ?? "",

        ticket_id: "",
        ticket_client_name: "",
        ticket_title: "",
        ticket_status: "",
      }));

      downloadCsv(baseRows, `inventario_${todayISO()}.csv`);
      return;
    }

    downloadCsv(rows, `inventario_movimientos_${todayISO()}.csv`);
  } catch (err) {
    console.error("[Inventory] Export CSV error", err);
    alert("No se pudo exportar el CSV. Revisa consola para más detalle.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("opacity-70", "cursor-not-allowed");
    }
  }
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  if (/[\n\r,"]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

function toCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [];
  lines.push(headers.join(","));
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(rows, filename) {
  const csv = toCsv(rows);
  // BOM para Excel
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Hook global para el script inline del modal (Inventario.html)
window.createInventoryItem = async ({ name, category, qty, unit, notes } = {}) => {
  const res = await createInventoryItem({ name, category, qty, unit, notes });
  if (!res?.ok) throw new Error(res?.error || "No se pudo guardar el material.");
  await refreshInventoryUI();
  window.dispatchEvent(new CustomEvent("inventory:created", { detail: res.data }));
  return res.data;
};

// También soporta el evento que emite tu modal
window.addEventListener("inventory:add", async (e) => {
  try {
    await window.createInventoryItem(e?.detail || {});
  } catch (err) {
    console.error("[Inventario] No se pudo crear material:", err);
  }
});