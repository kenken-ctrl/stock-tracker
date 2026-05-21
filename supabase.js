const SUPABASE_URL =
  "TON_URL_SUPABASE";

const SUPABASE_ANON_KEY =
  "TA_CLE_SUPABASE";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
