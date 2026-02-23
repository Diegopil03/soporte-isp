// web/js/auth-gate.js
import { sb } from "./supabaseClient.js";

document.addEventListener("DOMContentLoaded", async () => {
  // No bloquear login
  const isLogin = /\/login\.html$/i.test(window.location.pathname);
  if (isLogin) return;

  const { data } = await sb.auth.getSession();

  if (!data?.session) {
    // Guardar a dónde quería entrar
    const next = window.location.pathname + window.location.search + window.location.hash;
    const url = new URL("./login.html", window.location.href);
    url.searchParams.set("next", next);
    window.location.replace(url.toString());
  }
});