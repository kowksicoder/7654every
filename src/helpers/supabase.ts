import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: null | SupabaseClient = null;

export const hasSupabaseConfig = () =>
  Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      (import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  );

export const getSupabaseClient = () => {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase environment variables are missing.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      (import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  return supabaseClient;
};
