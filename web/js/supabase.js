// web/js/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ⚠️ Usa tus keys reales (mismas que ya estabas usando)
const SUPABASE_URL = "https://itkxgkxjwulfzklxyxke.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_P2SJ7etHApOmvH2zXCeMng_hthMCXhA";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);