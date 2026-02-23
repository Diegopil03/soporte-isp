// web/js/profile-ui.js
import { getUsuario, setUsuario } from "./state.js";

export function renderProfile() {
  if (!document.getElementById("profilePage")) return;

  const u = getUsuario() || {};

  const fullName = u.nombre || u.nombreCompleto || "Usuario";
  const role = u.rol || "Operaciones";
  const email = u.email || u.correo || "—";
  const userId = u.id || "—";
  const zone = u.zona || "—";
  const lastSeen = u.ultimaConexion || "—";

  setText("profileName", firstTwoWords(fullName));
  setText("profileRole", role);
  setText("profileIdLine", `ID: ${userId}`);

  setText("profileFullName", fullName);
  setText("profileEmail", email);
  setText("profileUserId", userId);
  setText("profileZone", zone);
  setText("profileLastSeen", lastSeen);

  setText("profileAvatar", initials(firstTwoWords(fullName)));

  // Cerrar sesión (simple): vaciar usuario y volver a kanban
  const btn = document.getElementById("btnLogout");
  if (btn && !btn.__bound) {
    btn.__bound = true;
    btn.addEventListener("click", () => {
      setUsuario(null);
      window.location.href = "./kanban.html";
    });
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(value ?? "—");
}

function firstTwoWords(s) {
  const p = String(s || "").trim().split(/\s+/).filter(Boolean);
  return p.slice(0, 2).join(" ") || "Usuario";
}

function initials(s) {
  const p = String(s || "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "U") + (p[1]?.[0] || "")).toUpperCase();
}
