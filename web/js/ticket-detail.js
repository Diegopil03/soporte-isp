// web/js/ticket-detail.js
import {
  fetchInventoryItems,
  fetchMovementsByTicketId,
  createInventoryMovement,
} from "./inventory.api.js";
import { sb } from "./supabaseClient.js";

// ===== DOM refs (Ticket header) =====
const elTicketIdBadge = document.getElementById("ticketIdBadge");
const elClientName = document.getElementById("clientName");
const elTitle = document.getElementById("title");
const elStatusPill = document.getElementById("statusPill");
const elPriorityPill = document.getElementById("priorityPill");
const elZone = document.getElementById("zone");
const elTimeBlock = document.getElementById("timeBlock");
const elClientType = document.getElementById("clientType");

// ===== DOM refs (Descripción editable) =====
const elDescView = document.getElementById("description");
const elDescEdit = document.getElementById("descriptionEdit");
const btnEditDesc = document.getElementById("editDescBtn");
const btnSaveDesc = document.getElementById("saveDescBtn");
const btnCancelDesc = document.getElementById("cancelDescBtn");
const elDescHint = document.getElementById("descSaveHint");

// ===== DOM refs (Materiales) =====
const materialsList = document.getElementById("materialsList");
const materialsMeta = document.getElementById("materialsMeta");
const btnAddMaterial = document.getElementById("btnAddMaterial");

// ===== DOM refs (Bitácora) =====
const notesList = document.getElementById("notesList");
const noteInput = document.getElementById("noteInput");
const addNoteBtn = document.getElementById("addNoteBtn");

// ===== helpers =====
function asString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function getTicketIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") || params.get("ticket") || "";
  if (id) return id;
  // fallback por si vienes de otra navegación
  return (
    localStorage.getItem("activeTicketId") ||
    localStorage.getItem("active_ticket_id") ||
    ""
  );
}

function fmtDateShort(iso) {
  if (!iso) return "—";
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

function setText(el, value, fallback = "—") {
  if (!el) return;
  const s = asString(value).trim();
  el.textContent = s ? s : fallback;
}

function statusLabel(s) {
  const v = asString(s).toLowerCase();
  const map = {
    nuevo: "Nuevo",
    en_revision: "En revisión",
    asignado: "Asignado",
    en_visita: "En visita",
    en_espera: "En espera",
    resuelto: "Resuelto",
    cerrado: "Cerrado",
  };
  return map[v] || (s ? String(s) : "—");
}

function statusPillClass(s) {
  const v = asString(s).toLowerCase();
  if (v === "cerrado") return "bg-slate-200 text-slate-700";
  if (v === "resuelto") return "bg-emerald-100 text-emerald-700";
  if (v === "en_espera") return "bg-amber-100 text-amber-700";
  if (v === "en_visita") return "bg-indigo-100 text-indigo-700";
  if (v === "asignado") return "bg-violet-100 text-violet-700";
  if (v === "en_revision") return "bg-sky-100 text-sky-700";
  if (v === "nuevo") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function priorityLabel(p) {
  const v = asString(p).toLowerCase();
  const map = { alta: "Alta", media: "Media", baja: "Baja" };
  return map[v] || (p ? String(p) : "—");
}

function priorityPillClass(p) {
  const v = asString(p).toLowerCase();
  if (v === "alta") return "bg-rose-100 text-rose-700";
  if (v === "media") return "bg-amber-100 text-amber-700";
  if (v === "baja") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

function movementLabel(t) {
  return t === "out" ? "Salida" : "Entrada";
}

function movementPillClass(t) {
  return t === "out"
    ? "bg-rose-100 text-rose-700 border-rose-200"
    : "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function show(el) {
  el?.classList.remove("hidden");
}
function hide(el) {
  el?.classList.add("hidden");
}

// ===== Ticket load =====
async function loadTicket(ticketId) {
  if (!ticketId) {
    if (elTicketIdBadge) elTicketIdBadge.textContent = "No se detectó ticketId en la URL.";
    return null;
  }

  if (elTicketIdBadge) elTicketIdBadge.textContent = `ID: ${String(ticketId).slice(0, 8)}…`;

  const { data, error } = await sb
    .from("tickets")
    .select(
      "id,client_name,title,status,priority,zone,time_block,client_type,description"
    )
    .eq("id", ticketId)
    .single();

  if (error) {
    console.error("[ticket-detail] loadTicket error", error);
    if (elTicketIdBadge) elTicketIdBadge.textContent = "No se pudo cargar el ticket.";
    return null;
  }

  setText(elClientName, data?.client_name);
  setText(elTitle, data?.title);

  if (elStatusPill) {
    elStatusPill.textContent = statusLabel(data?.status);
    elStatusPill.className = `text-[11px] font-bold uppercase px-2 py-1 rounded-full ${statusPillClass(
      data?.status
    )}`;
  }

  if (elPriorityPill) {
    elPriorityPill.textContent = priorityLabel(data?.priority);
    elPriorityPill.className = `text-[11px] font-bold uppercase px-2 py-1 rounded-full ${priorityPillClass(
      data?.priority
    )}`;
  }

  setText(elZone, data?.zone);
  setText(elTimeBlock, data?.time_block);
  setText(elClientType, data?.client_type);

  const desc = asString(data?.description);
  if (elDescView) elDescView.textContent = desc.trim() ? desc : "—";
  if (elDescEdit) elDescEdit.value = desc;

  return data;
}

function enterEditDescriptionMode() {
  hide(btnEditDesc);
  show(btnSaveDesc);
  show(btnCancelDesc);
  show(elDescEdit);
  hide(elDescView);
  show(elDescHint);
  elDescEdit?.focus();
}

function exitEditDescriptionMode({ restore = false, original = "" } = {}) {
  if (restore && elDescEdit) elDescEdit.value = original;
  show(btnEditDesc);
  hide(btnSaveDesc);
  hide(btnCancelDesc);
  hide(elDescEdit);
  show(elDescView);
  hide(elDescHint);
}

async function saveDescription(ticketId) {
  const next = (elDescEdit?.value || "").trim();

  const oldLabel = btnSaveDesc?.textContent;
  if (btnSaveDesc) {
    btnSaveDesc.disabled = true;
    btnSaveDesc.textContent = "Guardando...";
  }

  try {
    const { error } = await sb
      .from("tickets")
      .update({ description: next })
      .eq("id", ticketId);

    if (error) {
      console.error("[ticket-detail] saveDescription error", error);
      alert("No se pudo guardar la descripción.");
      return false;
    }

    if (elDescView) elDescView.textContent = next ? next : "—";
    exitEditDescriptionMode();
    return true;
  } finally {
    if (btnSaveDesc) {
      btnSaveDesc.disabled = false;
      btnSaveDesc.textContent = oldLabel || "Guardar";
    }
  }
}

// ===== Materials =====
async function renderMaterialsForTicket(ticketId) {
  if (!materialsList) return;

  if (!ticketId) {
    materialsList.innerHTML = `<div class="text-sm text-slate-400">No se detectó ticketId en la URL.</div>`;
    if (materialsMeta) materialsMeta.textContent = "Movimientos: 0";
    return;
  }

  materialsList.innerHTML = `<div class="text-sm text-slate-400">Cargando materiales...</div>`;

  const rows = await fetchMovementsByTicketId(ticketId, 100);
  if (materialsMeta) materialsMeta.textContent = `Movimientos: ${rows.length}`;

  if (!rows.length) {
    materialsList.innerHTML = `<div class="text-sm text-slate-400">Sin movimientos ligados a este ticket.</div>`;
    return;
  }

  materialsList.innerHTML = rows
    .map((m) => {
      const pill = movementPillClass(m.movement_type);
      const label = movementLabel(m.movement_type);
      const name = m.item?.name || "Material";
      const unit = m.item?.unit ? ` ${m.item.unit}` : "";
      const sku = m.item?.sku
        ? m.item.sku
        : m.item_id
        ? String(m.item_id).slice(0, 8) + "…"
        : "—";

      return `
        <div class="border border-slate-200 rounded-xl px-4 py-3 bg-white">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="font-bold text-slate-800 text-sm truncate">${name}</div>
              <div class="text-[11px] text-slate-400 font-mono">SKU: ${sku}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-extrabold text-slate-800">${m.qty}${unit}</div>
              <div class="text-[11px] text-slate-400">${fmtDateShort(m.created_at)}</div>
            </div>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${pill}">${label}</span>
            ${m.note ? `<span class="text-xs text-slate-500">${m.note}</span>` : `<span class="text-xs text-slate-400">—</span>`}
          </div>
        </div>
      `;
    })
    .join("");
}

// ===== Add material modal (simple) =====
let addMatModalEl = null;
let addMatBackdropEl = null;
let cachedItems = [];

function ensureAddMaterialModal() {
  if (addMatModalEl) return;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div id="addMatBackdrop" class="fixed inset-0 bg-black/40 hidden z-[90]"></div>
    <div id="addMatModal" class="fixed inset-0 hidden z-[100] flex items-center justify-center p-4">
      <div class="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div class="text-lg font-extrabold text-slate-900">Agregar material al ticket</div>
            <div id="addMatSubtitle" class="text-sm text-slate-500 mt-1">—</div>
          </div>
          <button id="addMatCloseBtn" class="p-2 rounded-lg hover:bg-slate-100 text-slate-500" type="button">✕</button>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <label class="text-xs font-bold text-slate-600">Material</label>
            <select id="addMatItem" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"></select>
            <div class="text-xs text-slate-400 mt-2" id="addMatStock">—</div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-slate-600">Tipo</label>
              <select id="addMatType" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="out">Salida (consumo)</option>
                <option value="in">Entrada (devolución)</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-slate-600">Cantidad</label>
              <input id="addMatQty" type="number" min="1" step="1" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value="1" />
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-slate-600">Nota (opcional)</label>
            <input id="addMatNote" type="text" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Ej: Instalación / reemplazo..." />
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button id="addMatCancelBtn" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm" type="button">Cancelar</button>
          <button id="addMatSaveBtn" class="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm" type="button">Guardar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  addMatModalEl = document.getElementById("addMatModal");
  addMatBackdropEl = document.getElementById("addMatBackdrop");

  const close = () => closeAddMaterialModal();
  document.getElementById("addMatCloseBtn")?.addEventListener("click", close);
  document.getElementById("addMatCancelBtn")?.addEventListener("click", close);
  addMatBackdropEl?.addEventListener("click", close);

  document.getElementById("addMatSaveBtn")?.addEventListener("click", onSaveAddMaterial);

  document.getElementById("addMatItem")?.addEventListener("change", () => {
    const sel = document.getElementById("addMatItem");
    const id = sel?.value;
    const item = cachedItems.find((x) => String(x.id) === String(id));
    const stock = item ? Number(item.stock_on_hand ?? item.stock ?? 0) : 0;
    const unit = item?.unit ? ` ${item.unit}` : "";
    const stockEl = document.getElementById("addMatStock");
    if (stockEl) stockEl.textContent = `Stock actual: ${stock}${unit}`;
  });
}

function openAddMaterialModal(ticketId) {
  ensureAddMaterialModal();

  const subtitle = document.getElementById("addMatSubtitle");
  if (subtitle) subtitle.textContent = `Ticket: ${String(ticketId).slice(0, 8)}…`;

  const typeEl = document.getElementById("addMatType");
  const qtyEl = document.getElementById("addMatQty");
  const noteEl = document.getElementById("addMatNote");

  if (typeEl) typeEl.value = "out";
  if (qtyEl) qtyEl.value = "1";
  if (noteEl) noteEl.value = "";

  const sel = document.getElementById("addMatItem");
  if (sel) {
    sel.innerHTML = cachedItems
      .map((it) => {
        const u = it.unit ? ` (${it.unit})` : "";
        return `<option value="${it.id}">${it.name}${u}</option>`;
      })
      .join("");
  }

  sel?.dispatchEvent(new Event("change"));

  addMatBackdropEl?.classList.remove("hidden");
  addMatModalEl?.classList.remove("hidden");
}

function closeAddMaterialModal() {
  addMatBackdropEl?.classList.add("hidden");
  addMatModalEl?.classList.add("hidden");
}

async function onSaveAddMaterial() {
  const saveBtn = document.getElementById("addMatSaveBtn");

  try {
    const ticketId = getTicketIdFromUrl();
    if (!ticketId) {
      alert("No se detectó ticketId en la URL");
      return;
    }

    const sel = document.getElementById("addMatItem");
    const typeEl = document.getElementById("addMatType");
    const qtyEl = document.getElementById("addMatQty");
    const noteEl = document.getElementById("addMatNote");

    const itemId = sel?.value;
    const kind = typeEl?.value || "out";
    const qty = qtyEl?.value || "1";
    const note = noteEl?.value || "";

    if (!itemId) {
      alert("Selecciona un material.");
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando...";
    }

    const res = await createInventoryMovement({ itemId, kind, qty, note, ticketId });

    if (!res?.ok) {
      alert(res?.error === "insufficient_stock" ? "Stock insuficiente." : "No se pudo guardar.");
      console.error("[ticket-detail] createInventoryMovement failed", res);
      return;
    }

    closeAddMaterialModal();
    await renderMaterialsForTicket(ticketId);
    cachedItems = await fetchInventoryItems();
  } catch (err) {
    console.error("[ticket-detail] onSaveAddMaterial error", err);
    alert("Error guardando material. Revisa consola.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar";
    }
  }
}

// ===== Notes (Bitácora) =====
function renderNotesEmpty(msg = "Sin notas.") {
  if (!notesList) return;
  notesList.innerHTML = `<div class="text-sm text-slate-400">${msg}</div>`;
}

async function fetchNotes(ticketId, limit = 50) {
  if (!ticketId) return [];

  const { data, error } = await sb
    .from("ticket_notes")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[ticket-detail] fetchNotes error", error);
    return [];
  }

  return data || [];
}

async function renderNotes(ticketId) {
  if (!notesList) return;

  if (!ticketId) {
    renderNotesEmpty("No se detectó ticketId en la URL.");
    return;
  }

  notesList.innerHTML = `<div class="text-sm text-slate-400">Cargando notas...</div>`;

  const rows = await fetchNotes(ticketId, 80);
  if (!rows.length) {
    renderNotesEmpty("Sin notas aún.");
    return;
  }

  notesList.innerHTML = rows
    .map((n) => {
      const txt = String(
  n.body ?? n.content ?? n.text ?? n.message ?? n.mensaje ?? n.descripcion ?? n.detalle ?? ""
).trim() || "—";
      return `
        <div class="border border-slate-200 rounded-xl p-3 bg-white">
          <div class="text-sm text-slate-700 whitespace-pre-wrap">${txt}</div>
          <div class="mt-2 text-[11px] text-slate-400">${fmtDateShort(n.created_at)}</div>
        </div>
      `;
    })
    .join("");
}

async function addNote(ticketId) {
  if (!ticketId) {
    alert("No se detectó ticketId en la URL");
    return;
  }

  const text = (noteInput?.value || "").trim();
  if (!text) {
    alert("Escribe una nota.");
    return;
  }

  const old = addNoteBtn?.textContent;
  if (addNoteBtn) {
    addNoteBtn.disabled = true;
    addNoteBtn.textContent = "Guardando...";
  }

  try {
    // uid del usuario autenticado (por si tu tabla exige user_id/created_by/etc.)
    const { data: userData, error: userErr } = await sb.auth.getUser();
    const uid = userErr ? null : userData?.user?.id || null;

    const baseRow = {
  ticket_id: ticketId,
  body: text,
  visibility: "internal",
  ...(uid ? { author_id: uid } : {}),
};

// 1) intento simple
let { error } = await sb.from("ticket_notes").insert([baseRow]);

    // 2) si falla por NOT NULL, reintenta agregando uid en campos comunes
    if (error && uid) {
      const msg = `${error.message || ""} ${error.details || ""}`.toLowerCase();
      const needsUserField =
        msg.includes("null value") ||
        msg.includes("violates not-null") ||
        msg.includes("not-null") ||
        msg.includes("not null");

      if (needsUserField) {
        const candidates = ["user_id", "author_id", "created_by", "created_by_id", "owner_id"];
        for (const field of candidates) {
          const row = { ...baseRow, [field]: uid };
          const res = await sb.from("ticket_notes").insert([row]);
          if (!res.error) {
            error = null;
            break;
          }
          error = res.error;
        }
      }
    }

    if (error) {
  const msg = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  const missingCol =
    msg.includes("schema cache") ||
    msg.includes("could not find") ||
    (msg.includes("column") && msg.includes("does not exist"));

  if (missingCol) {
    const fallbacks = ["text", "body", "message", "mensaje", "descripcion", "detalle"];
    let fixed = false;

    for (const f of fallbacks) {
      const res2 = await sb.from("ticket_notes").insert([{ ticket_id: ticketId, [f]: text }]);
      if (!res2.error) { fixed = true; error = null; break; }
      error = res2.error;
    }
  }
}

    if (error) {
      console.error("[ticket-detail] addNote error", error);
      const msg = error.message || "No se pudo guardar la nota.";
      const details = error.details ? `\n\nDetalle: ${error.details}` : "";
      alert(`${msg}${details}`);
      return;
    }

    if (noteInput) noteInput.value = "";
    await renderNotes(ticketId);
  } catch (err) {
    console.error("[ticket-detail] addNote fatal", err);
    alert("Error guardando la nota. Revisa consola.");
  } finally {
    if (addNoteBtn) {
      addNoteBtn.disabled = false;
      addNoteBtn.textContent = old || "Agregar";
    }
  }
}

// ===== init =====
document.addEventListener("DOMContentLoaded", async () => {
  const ticketId = getTicketIdFromUrl();

  if (ticketId) {
    try {
      localStorage.setItem("activeTicketId", ticketId);
    } catch {}
  }

  // 1) cargar ticket y pintar header
  const ticket = await loadTicket(ticketId);

  // 2) wiring descripción
  let originalDesc = asString(ticket?.description);

  btnEditDesc?.addEventListener("click", () => {
    originalDesc = asString(elDescEdit?.value ?? originalDesc);
    enterEditDescriptionMode();
  });

  btnCancelDesc?.addEventListener("click", () => {
    exitEditDescriptionMode({ restore: true, original: originalDesc });
  });

  btnSaveDesc?.addEventListener("click", async () => {
    if (!ticketId) return alert("No se detectó ticketId en la URL");
    const ok = await saveDescription(ticketId);
    if (ok) originalDesc = asString(elDescEdit?.value);
  });

  // 3) cache inventory para modal
  cachedItems = await fetchInventoryItems();

  // 4) render materiales + notas
  await renderMaterialsForTicket(ticketId);
  await renderNotes(ticketId);

  // 5) botón agregar material
  btnAddMaterial?.addEventListener("click", () => {
    if (!ticketId) return alert("No se detectó ticketId en la URL");
    openAddMaterialModal(ticketId);
  });

  // 6) bitácora agregar
  addNoteBtn?.addEventListener("click", () => addNote(ticketId));
  noteInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addNote(ticketId);
    }
  });
});