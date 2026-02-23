// web/js/supabaseClient.js
// Requiere que supabase-js esté cargado antes (CDN en el HTML).

export const SUPABASE_URL = "https://itkxgkxjwulfzklxyxke.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_P2SJ7etHApOmvH2zXCeMng_hthMCXhA";

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
