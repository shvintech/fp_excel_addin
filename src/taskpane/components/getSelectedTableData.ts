import { api } from "../../api";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  const responseError = error as { response?: { data?: { message?: string } } };
  if (responseError?.response?.data?.message) {
    return responseError.response.data.message;
  }
  return fallback;
};

/**
 * Fetch all rows from a selected table using the Supabase Edge Function
 */
export async function getTableData(tableName: string, operation: string): Promise<JsonRecord[]> {
  try {
    if (!tableName || !operation) {
      throw new Error("Table name is required");
    }
    console.log("selected table name : ", tableName);
    const res = await api.get("/generic_bulk_crud_operation_master_data", {
      params: {
        operation: operation, // required by Edge Function
        table_name: tableName, // user-selected table
      },
    });

    /**
     * Expected Edge Function response:
     * {
     *   data: [...]
     * }
     */
    const rows = res?.data?.data;

    console.log("Fetched rows:", rows);

    if (!Array.isArray(rows)) {
      throw new Error(`Invalid response format. Expected array, got ${typeof rows}`);
    }

    return rows;
  } catch (err: unknown) {
    console.error("getTableData error:", err);
    throw new Error(getErrorMessage(err, "Failed to fetch table data"));
  }
}
