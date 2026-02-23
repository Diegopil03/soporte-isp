// /web/js/app.js
// /web/js/app.js
import { tickets, tecnicos, usuarioActual } from "./mock-data.js";
import { setTickets, setTecnicos, setUsuario } from "./state.js";
import { renderKanban, setupFilters } from "./ui.js";
import { renderProfile } from "./profile-ui.js";
import * as router from "./router.js";
import { applySavedTheme } from "./theme.js";

import { fetchTickets } from "./tickets.api.js";
import { sb } from "./supabaseClient.js";
window.sb = sb;

applySavedTheme();

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Hidratar estado global base (tecnicos/usuario UI)
  setTecnicos(tecnicos);
  setUsuario(usuarioActual);

  // 2) Inicializar router
  router.initRouter?.();

  // 3) Tickets: Supabase primero (si hay sesión), fallback a mock si falla
  let loadedTickets = [];
  try {
    const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
    if (sessionErr) console.warn("[auth.getSession] ", sessionErr);

    const hasSession = !!sessionData?.session;
    if (hasSession) {
      loadedTickets = await fetchTickets();
      console.log("[Kanban] Tickets desde Supabase:", loadedTickets.length);
    } else {
      loadedTickets = tickets; // fallback sin sesión
      console.warn("[Kanban] Sin sesión: usando mock-data como fallback");
    }
  } catch (e) {
    console.error("[Kanban] Error cargando tickets. Fallback a mock.", e);
    loadedTickets = tickets;
  }

  setTickets(loadedTickets);

  // 4) Kanban solo si estamos en la vista correcta
  if (document.querySelector('[data-col="nuevo"]')) {
    renderKanban();
    setupFilters();
  }



  // 6) Vista Perfil
  if (document.getElementById("profilePage")) {
    renderProfile();
  }
});



