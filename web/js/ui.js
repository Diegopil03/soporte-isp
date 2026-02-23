// web/js/ui.js
import {
  getFilteredTickets,
  updateFilters,
  resetFilters,
  setTickets,
  getTickets,
} from "./state.js";

import { fetchTickets, updateTicketStatus } from "./tickets.api.js";
import { sb } from "./supabaseClient.js";

const STATUS_OPTIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "en_revision", label: "En revisión" },
  { value: "asignado", label: "Asignado" },
  { value: "en_visita", label: "En visita" },
  { value: "en_espera", label: "En espera" },
  { value: "resuelto", label: "Resuelto" },
  { value: "cerrado", label: "Cerrado" },
];

// ===== Helpers DOM =====
function $(id) {
  return document.getElementById(id);
}

function getTicketFromState(ticketId) {
  const all = (typeof getTickets === "function" ? getTickets() : []) || [];
  return all.find((t) => String(t.id) === String(ticketId));
}

// ===== Supabase updates (campos reales en BD) =====
async function updateTicketFields(ticketId, patch) {
  const { error } = await sb.from("tickets").update(patch).eq("id", ticketId);
  if (error) {
    console.error("[updateTicketFields] error:", error);
    return false;
  }
  return true;
}

// ===== Modal (IDs = tu kanban.html) =====
// kanban.html:
// - modal: editTicketModal
// - form: editTicketForm
// - hidden id: editTicketId
// - inputs: editCliente, editZona, editPrioridad
// - cancel: cancelEditTicket
let _modalWired = false;

function openEditModal(ticket) {
  const modal = $("editTicketModal");
  if (!modal) return;

  // llenar campos
  const idEl = $("editTicketId");
  const clienteEl = $("editCliente");
  const zonaEl = $("editZona");
  const prioridadEl = $("editPrioridad");

  if (idEl) idEl.value = ticket?.id ?? "";
  if (clienteEl) clienteEl.value = ticket?.cliente ?? ticket?.client_name ?? "";
  if (zonaEl) zonaEl.value = ticket?.zona ?? ticket?.zone ?? "";
  if (prioridadEl) prioridadEl.value = ticket?.prioridad ?? ticket?.priority ?? "media";

  modal.classList.remove("hidden");
}

function closeEditModal() {
  const modal = $("editTicketModal");
  if (!modal) return;
  modal.classList.add("hidden");
}

function wireEditModalOnce() {
  if (_modalWired) return;
  _modalWired = true;

  const modal = $("editTicketModal");
  const form = $("editTicketForm");
  const cancelBtn = $("cancelEditTicket");

  if (!modal || !form) return;

  // cerrar al dar click fuera del panel
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeEditModal();
  });

  cancelBtn?.addEventListener("click", () => {
    closeEditModal();
  });

  // submit del form
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = $("editTicketId")?.value;
    if (!id) return;

    const cliente = String($("editCliente")?.value ?? "").trim();
    const zona = String($("editZona")?.value ?? "").trim();
    const prioridad = String($("editPrioridad")?.value ?? "media").trim();

    const submitBtn = form.querySelector('button[type="submit"]');
    const prevLabel = submitBtn?.textContent;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando…";
    }

    try {
      // ⚠️ Columnas reales en Supabase
      const ok = await updateTicketFields(id, {
        client_name: cliente,
        zone: zona,
        priority: prioridad,
      });

      if (!ok) {
        alert("No se pudo guardar. Revisa RLS/permisos en tickets.");
        return;
      }

      // refrescar tablero
      const fresh = await fetchTickets();
      setTickets(fresh);
      renderKanban();
      closeEditModal();
    } catch (err) {
      console.error("[Kanban] Error guardando edición:", err);
      alert("Error guardando. Revisa consola.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = prevLabel || "Guardar cambios";
      }
    }
  });
}

// ===== Render Kanban =====
export function renderKanban() {
  const tickets = getFilteredTickets();

  const cols = {
    nuevo: document.querySelector('[data-col="nuevo"]'),
    en_revision: document.querySelector('[data-col="en_revision"]'),
    asignado: document.querySelector('[data-col="asignado"]'),
    en_visita: document.querySelector('[data-col="en_visita"]'),
    en_espera: document.querySelector('[data-col="en_espera"]'),
    resuelto: document.querySelector('[data-col="resuelto"]'),
    cerrado: document.querySelector('[data-col="cerrado"]'),
  };

  // Limpia columnas
  Object.values(cols).forEach((el) => {
    if (el) el.innerHTML = "";
  });

  // Limpia contadores
  Object.keys(cols).forEach((key) => {
    const badge = document.querySelector(`[data-count="${key}"]`);
    if (badge) badge.textContent = "0";
  });

  // Render + contar
  tickets.forEach((t) => {
    const col = cols[t.estado];
    if (!col) return;

    // contador
    const badge = document.querySelector(`[data-count="${t.estado}"]`);
    if (badge) {
      const current = parseInt(badge.textContent || "0", 10);
      badge.textContent = String(current + 1);
    }

    const card = document.createElement("div");
    card.className = "w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
          t.prioridad === "alta" ? "bg-rose-100 text-rose-700" :
          t.prioridad === "media" ? "bg-amber-100 text-amber-700" :
          "bg-emerald-100 text-emerald-700"
        }">${t.prioridad ?? "—"}</span>
        <span class="text-[10px] text-slate-400 font-mono">#${t.id}</span>
      </div>

      <div class="mt-3 font-bold text-slate-800">${t.cliente ?? "—"}</div>
      <div class="text-xs text-slate-500 mt-1">Zona ${t.zona ?? "Sin definir"}</div>
      <div class="text-xs text-slate-500 mt-1">${t.bloque ?? "Sin definir"}</div>

      <div class="mt-3 flex items-center justify-between">
        <a
          class="text-xs text-slate-500 hover:text-slate-800 font-medium"
          href="./ticket_detail.html?id=${encodeURIComponent(t.id)}"
        >
          Bitácora
        </a>

        <button
          class="text-xs text-blue-600 hover:text-blue-800 font-medium"
          data-edit-ticket="${t.id}"
          type="button"
        >
          Editar
        </button>
      </div>

      <div class="mt-2">
        <label class="block text-[11px] text-slate-400 mb-1">Mover a</label>
        <select
          class="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
          data-move-ticket="${t.id}"
          data-prev-status="${t.estado}"
        >
          ${STATUS_OPTIONS.map((s) => `
            <option value="${s.value}" ${t.estado === s.value ? "selected" : ""}>
              ${s.label}
            </option>
          `).join("")}
        </select>
      </div>
    `;

    col.appendChild(card);
  });

  wireMoveHandlers();
  wireEditButtons();
  wireEditModalOnce(); // importante: ya coincide con IDs de kanban.html
}

// ===== Handlers: mover status =====
function wireMoveHandlers() {
  document.querySelectorAll("[data-move-ticket]").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      const ticketId = sel.getAttribute("data-move-ticket");
      const prev = sel.getAttribute("data-prev-status");
      const next = e.target.value;

      if (!ticketId || !next || prev === next) return;

      // confirmación SOLO al cerrar
      if (next === "cerrado") {
        const confirmClose = confirm(
          "¿Estás seguro de cerrar este ticket?\n\nEsta acción lo quitará del tablero activo."
        );
        if (!confirmClose) {
          e.target.value = prev;
          return;
        }
      }

      try {
        const ok = await updateTicketStatus(ticketId, next);
        if (!ok) {
          e.target.value = prev;
          alert("No se pudo mover el ticket. Revisa permisos/RLS.");
          return;
        }

        const fresh = await fetchTickets();
        setTickets(fresh);
        renderKanban();
      } catch (err) {
        console.error("[Kanban] Error moviendo ticket", err);
        e.target.value = prev;
        alert("Error al mover el ticket. Revisa consola.");
      }
    });
  });
}

// ===== Handlers: abrir modal editar =====
function wireEditButtons() {
  document.querySelectorAll("[data-edit-ticket]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-ticket");
      const t = getTicketFromState(id);
      if (!t) {
        alert("No se encontró el ticket en memoria. Refresca la página.");
        return;
      }
      openEditModal(t);
    });
  });
}

// ===== Filtros =====
export function setupFilters() {
  const searchInput = document.getElementById("searchInput");
  const filterPriority = document.getElementById("filterPriority");
  const filterZone = document.getElementById("filterZone");
  const filterStatus = document.getElementById("filterStatus");
  const clearBtn = document.getElementById("clearFilters");

  if (!searchInput || !filterPriority || !filterZone || !filterStatus || !clearBtn) return;

  searchInput.addEventListener("input", (e) => {
    updateFilters("search", e.target.value);
    renderKanban();
  });

  filterPriority.addEventListener("change", (e) => {
    updateFilters("priority", e.target.value);
    renderKanban();
  });

  filterZone.addEventListener("change", (e) => {
    updateFilters("zone", e.target.value);
    renderKanban();
  });

  filterStatus.addEventListener("change", (e) => {
    updateFilters("status", e.target.value);
    renderKanban();
  });

  clearBtn.addEventListener("click", () => {
    resetFilters();

    searchInput.value = "";
    filterPriority.value = "all";
    filterZone.value = "all";
    filterStatus.value = "all";

    renderKanban();
  });
}

