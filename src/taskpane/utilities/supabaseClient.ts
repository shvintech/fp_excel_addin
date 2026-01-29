import { createClient } from "@supabase/supabase-js";

const freightPricerSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const freightPricerAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!freightPricerSupabaseUrl || !freightPricerAnonKey) {
  throw new Error("Excel Supabase env variables are missing");
}

export const supabase = createClient(freightPricerSupabaseUrl, freightPricerAnonKey);
