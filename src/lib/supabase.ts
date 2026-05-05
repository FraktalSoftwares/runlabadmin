import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY devem estar definidas no .env"
  );
}

const isProd = import.meta.env.PROD;

const clearLegacyCookie = (key: string) => {
  if (typeof document === "undefined") return;
  const expire = (domain?: string) => {
    const parts = [
      `${encodeURIComponent(key)}=`,
      "Path=/",
      "Max-Age=0",
      "SameSite=Lax",
    ];
    if (domain) parts.push(`Domain=${domain}`);
    if (isProd) parts.push("Secure");
    document.cookie = parts.join("; ");
  };
  expire(".runlab.com.br");
  expire();
};

clearLegacyCookie("runlab-auth");

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: "runlab-admin-auth",
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
