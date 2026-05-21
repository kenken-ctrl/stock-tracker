const SUPABASE_URL =
  "https://rsctqdpmfzisfksfrplp.supabase.co";

const SUPABASE_ANON_KEY =
  "ta clé";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
