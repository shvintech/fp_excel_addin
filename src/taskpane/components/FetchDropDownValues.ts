import { supabase } from "../utilities/supabaseClient";
import { DropdownValue } from "../utilities/type";

export const fetchDropdownValues = async (): Promise<DropdownValue[]> => {
  const { data, error } = await supabase
    .from("excel_addin_dropdown_values")
    .select("id, table_name, table_type, unique_keys")
    .order("table_type", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
};
