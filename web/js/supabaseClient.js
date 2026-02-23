
// web/js/supabaseClient.js

// ✅ Asegura que el CDN de Supabase se cargó ANTES que los módulos
if (!globalThis.supabase || typeof globalThis.supabase.createClient !== "function") {
  throw new Error(
    "[supabaseClient] Supabase CDN no está cargado. " +
    "Asegúrate de tener: <script src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2\"></script> " +
    "ANTES de tus <script type=\"module\">."
  );
}

const SUPABASE_URL = "https://itkxgkxjwulfzklxyxke.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0a3hna3hqd3VsZnprbHh5eGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzgyMjgsImV4cCI6MjA4NTcxNDIyOH0.7eyvPKPdOaL2vl6VrYA6YE8n1eSVCVMzrv6Fm73x_38";

// ✅ Opción A: sesión en sessionStorage (pide login al reabrir)
export const sb = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: window.sessionStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});