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
const COOKIE_DOMAIN = isProd ? ".runlab.com.br" : undefined;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const cookieStorage = {
  getItem(key: string): string | null {
    if (typeof document === "undefined") return null;
    const target = `${encodeURIComponent(key)}=`;
    for (const c of document.cookie.split("; ")) {
      if (c.startsWith(target)) {
        return decodeURIComponent(c.slice(target.length));
      }
    }
    return null;
  },
  setItem(key: string, value: string): void {
    if (typeof document === "undefined") return;
    const parts = [
      `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      "Path=/",
      `Max-Age=${COOKIE_MAX_AGE}`,
      "SameSite=Lax",
    ];
    if (COOKIE_DOMAIN) parts.push(`Domain=${COOKIE_DOMAIN}`);
    if (isProd) parts.push("Secure");
    document.cookie = parts.join("; ");
  },
  removeItem(key: string): void {
    if (typeof document === "undefined") return;
    const parts = [
      `${encodeURIComponent(key)}=`,
      "Path=/",
      "Max-Age=0",
      "SameSite=Lax",
    ];
    if (COOKIE_DOMAIN) parts.push(`Domain=${COOKIE_DOMAIN}`);
    if (isProd) parts.push("Secure");
    document.cookie = parts.join("; ");
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: cookieStorage,
    storageKey: "runlab-auth",
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
