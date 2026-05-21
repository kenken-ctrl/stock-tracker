const SUPABASE_URL =
  "https://rsctqdpmfzisfksfrplp.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzY3RxZHBtZnppc2Zrc2ZycGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNTYzMzcsImV4cCI6MjA5NDkzMjMzN30.Cezyi64xbxOJcKHvcgsJFMW67K765zUPgHEGh50hl_k";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
