export interface DialogMessageArgs {
  message?: string;
  origin?: string;
  error?: number;
}

export interface DropdownValue {
  id: number;
  table_name: string;
  table_type: string;
  unique_keys: string[];
}

export type ToastType = "success" | "warning" | "error";
export type UniqueKeys = string[];
