import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string,
  },
});
