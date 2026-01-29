import { api } from "../../api";
/**
 * Master Data Upsert with Versioning & Soft Delete
 * Mandatory input: cargo_type, tenant_id
 *
 * Business Logic:
 * 1. If ID is provided → UPDATE (Soft Delete + New Version)
 *    - Soft delete existing record (is_active=FALSE, valid_to=NOW)
 *    - Create new version (version=old_version+1, is_active=TRUE)
 * 2. If ID is NOT provided → Check for existing record with (cargo_type, tenant_id)
 *    - If exists → Throw error "Record already exists"
 *    - If not exists → INSERT new record with defaults
 *
 * Default values for INSERT (handled by Edge Function):
 * - created_by: user_id
 * - created_on: CURRENT_TIMESTAMP
 * - valid_from: CURRENT_TIMESTAMP
 * - version: 1
 * - is_active: TRUE
 *
 * For UPDATE (handled by Edge Function):
 * - Old record: is_active=FALSE, valid_to=CURRENT_TIMESTAMP
 * - New record: version=old_version+1, created_by=user_id, valid_from=CURRENT_TIMESTAMP, is_active=TRUE
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonRecord = { [key: string]: JsonValue };

export interface UpsertInputRow {
  id?: number;
  data: JsonRecord;
}

interface UpsertResult {
  total: number;
  inserted: number;
  updated: number;
  deleted?: number;
  duplicated?: number;
  insertedRecords?: Array<{ id?: number; newId?: number; version?: number }>;
  updatedRecords?: Array<{ oldId?: number; newId?: number; version?: number }>;
  deletedRecords?: Array<{ id?: number }>;
  errors?: Array<{ row: JsonRecord; error: string; unique_keys?: string[] }>;
}

export const upsertToSupabase = async (
  rows: UpsertInputRow[],
  config: {
    tableName: string;
    operation: "insert" | "update" | "delete" | "upsert";
    p_userid?: string; // Optional - can be overridden by row-level user_id
    unique_key: string[];
  }
): Promise<UpsertResult> => {
  const { tableName, operation, p_userid, unique_key } = config;

  /* --------------------------------------------------
     1️⃣ Prepare payload for Edge Function
     - Structure: { table_name, operation, rows }
     - Each row has: id?, user_id, unique_keys, data
  -------------------------------------------------- */
  const payload = {
    table_name: tableName,
    operation: operation, // INSERT | UPDATE
    userid: p_userid,
    unique_keys: unique_key, // array of unique keys
    rows: rows.map(({ id, data }) => ({
      ...(id !== undefined ? { id } : {}),
      ...data,
    })),
  };

  console.log("Sending to Edge Function:", payload);

  /* --------------------------------------------------
     2️⃣ Call Edge Function (POST method)
  -------------------------------------------------- */
  const { data } = await api.post("generic_bulk_crud_operation_master_data", payload);

  console.log("Edge Function Response:", data);

  /* --------------------------------------------------
     3️⃣ Handle Edge Function errors
  -------------------------------------------------- */
  if (!data) {
    throw new Error("No response from Edge Function");
  }

  if (data.error) {
    throw new Error(`Edge Function error: ${data.error}`);
  }

  /* --------------------------------------------------
     4️⃣ Parse bulk operation results
     - success: true/false
     - results: array of successful operations
     - errors: array of failed operations
     - summary: { total, succeeded, failed }
  -------------------------------------------------- */
  /* --------------------------------------------------
     5️⃣ Categorize results by operation type
  -------------------------------------------------- */
  type EdgeResponseRow = {
    id: number;
    version?: number;
    operation: "insert" | "upsert" | "delete" | "update" | "duplicate";
  };
  const records: EdgeResponseRow[] = data?.data ?? [];
  const duplicatedRecords = records
    .filter((r) => r.operation?.toLowerCase().trim() === "duplicate")
    .map((r) => ({
      id: r.id,
      version: r.version ?? 1,
    }));
  const insertedRecords = records
    .filter((r) => r.operation?.toLowerCase().trim() === "insert")
    .map((r) => ({
      id: r.id,
      version: r.version ?? 1,
    }));

  const updatedRecords = records
    .filter((r) => r.operation?.toLowerCase().trim() === "update")
    .map((r) => ({
      id: r.id,
      version: r.version,
    }));

  const deletedRecords = records
    .filter((r) => r.operation?.toLowerCase().trim() === "delete")
    .map((r) => ({
      id: r.id,
    }));

  // ✅ COUNTS MUST COME FROM ARRAYS
  return {
    total: records.length,
    inserted: insertedRecords.length,
    updated: updatedRecords.length,
    deleted: deletedRecords.length,
    duplicated: duplicatedRecords.length,
    insertedRecords,
    updatedRecords,
    deletedRecords,
  };
};

/* --------------------------------------------------
   Delete Selected Rows Function
-------------------------------------------------- */
export const deleteSelectedRowsFromSupabase = async (
  rows: UpsertInputRow[],
  config: {
    tableName: string;
    p_userid: string;
    unique_key: string[];
  }
): Promise<UpsertResult> => {
  return await upsertToSupabase(rows, {
    ...config,
    operation: "delete",
  });
};
/**
 * Filter valid records (must have ID)
 */
export const filterValidRecords = (data: JsonRecord[]): JsonRecord[] => {
  return data
    .map((r) => {
      // use the database id
      if (!r.id || r.id === "") {
        return {
          ...r,
          id: r.id,
        };
      }
      return r;
    })
    .filter((k) => k && k.id);
};
/**
 * Recursively extracts keys from an object.
 * If nested objects exist, their keys are included without parent prefixes.
 * Example:
 * { id: 1, user: { name: "Alice", address: { city: "NY" } } }
 * → ["id", "name", "city"]
 */
function extractKeys(obj: JsonRecord): string[] {
  return Object.keys(obj).flatMap((key) => {
    const value = obj[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    ) {
      // recurse into nested object, drop parent prefix
      return extractKeys(value);
    }

    return [key];
  });
}

/**
 * Extracts headers from any table (array of objects).
 * Handles both flat and nested structures.
 */
export function extractHeadersFromTable(rows: JsonRecord[]): string[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const firstRow = rows[0];
  return extractKeys(firstRow);
}
