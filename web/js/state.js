const state = {
  tickets: [],
  tecnicos: [],
  usuario: null,
  filters: {
    search: "",
    priority: "all",
    zone: "all",
    status: "all",
    timeBlock: "all", // bloque horario
  },
};

/* =========================
   SETTERS
========================= */
export function setTickets(data) {
  state.tickets = Array.isArray(data) ? data : [];
}

export function setTecnicos(data) {
  state.tecnicos = data;
}

export function setUsuario(data) {
  state.usuario = data;
}

/* =========================
   FILTROS
========================= */
export function updateFilters(key, value) {
  state.filters[key] = value;
}

export function resetFilters() {
  state.filters = {
    search: "",
    priority: "all",
    zone: "all",
    status: "all",
    timeBlock: "all",
  };
}

/* =========================
   SELECTORES
========================= */
export function getFilteredTickets() {
  const search = String(state.filters.search || "").toLowerCase();

  return state.tickets.filter((t) => {
    const cliente = String(t.cliente || "").toLowerCase();
    const idStr = String(t.id || "").toLowerCase();

    const matchSearch =
      !search || cliente.includes(search) || idStr.includes(search);

    const matchPriority =
      state.filters.priority === "all" ||
      t.prioridad === state.filters.priority;

    const matchZone =
      state.filters.zone === "all" ||
      t.zona === state.filters.zone;

    const matchTimeBlock =
      state.filters.timeBlock === "all" ||
      t.bloque === state.filters.timeBlock;

    /**
     * 🔴 LÓGICA CLAVE
     * - Por defecto: ocultar cerrados
     * - Si el filtro es "cerrado": mostrarlos
     */
    const matchStatus =
  state.filters.status === "all"
    ? true
    : t.estado === state.filters.status;

    return (
      matchSearch &&
      matchPriority &&
      matchZone &&
      matchTimeBlock &&
      matchStatus
    );
  });
}

/* =========================
   GETTERS
========================= */
export function getTickets() {
  return state.tickets;
}

export function getFilters() {
  return state.filters;
}

export function getTecnicos() {
  return state.tecnicos;
}

export function getUsuario() {
  return state.usuario;
}
