import { toastMessageDialog } from "./toastMessageDialog";
import type { JsonRecord } from "./supabaseService";

export const getSelectedAreas = async (context: Excel.RequestContext) => {
  const selectedRanges = context.workbook.getSelectedRanges();
  selectedRanges.load("areas");
  await context.sync();

  if (selectedRanges.areas.items.length === 0) {
    throw new Error("No rows selected");
  }

  return selectedRanges.areas.items;
};

export const getSheetHeaders = async (sheet: Excel.Worksheet) => {
  const usedRange = sheet.getUsedRange();
  usedRange.load("values, columnCount");
  await sheet.context.sync();

  const headers = usedRange.values[0].map((h) => (h ?? "").toString().trim());

  return {
    headers,
    columnCount: usedRange.columnCount,
  };
};

/**
 * Extended row data type that includes the actual Excel row index
 */
export interface RowDataWithIndex {
  data: JsonRecord;
  rowIndex: number;
}

/**
 * Extract selected rows with their data based on sheet headers
 * Now returns both the data and the actual row index in Excel
 */
export const extractSelectedRows = async (context: Excel.RequestContext): Promise<JsonRecord[]> => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const { headers, columnCount } = await getSheetHeaders(sheet);

  if (!headers.length) return [];

  const areas = await getSelectedAreas(context);
  const allRowsData: JsonRecord[] = [];

  for (const area of areas) {
    area.load(["rowIndex", "rowCount"]);
    await context.sync();

    for (let i = 0; i < area.rowCount; i++) {
      const rowRange = sheet.getRangeByIndexes(area.rowIndex + i, 0, 1, columnCount);
      rowRange.load("values");
      await context.sync();

      const rowValues = rowRange.values[0];
      const rowObject: JsonRecord = {};

      for (let j = 0; j < Math.min(headers.length, rowValues.length); j++) {
        rowObject[headers[j]] = rowValues[j] ?? null;
      }

      allRowsData.push(rowObject);
    }
  }

  return allRowsData;
};

/**
 * NEW: Extract selected rows WITH their actual Excel row indices
 * This is critical for updating the correct rows later
 */
export const extractSelectedRowsWithIndices = async (
  context: Excel.RequestContext
): Promise<RowDataWithIndex[]> => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const { headers, columnCount } = await getSheetHeaders(sheet);

  if (!headers.length) return [];

  const areas = await getSelectedAreas(context);
  const allRowsData: RowDataWithIndex[] = [];

  for (const area of areas) {
    area.load(["rowIndex", "rowCount"]);
    await context.sync();

    for (let i = 0; i < area.rowCount; i++) {
      const actualRowIndex = area.rowIndex + i;
      const rowRange = sheet.getRangeByIndexes(actualRowIndex, 0, 1, columnCount);
      rowRange.load("values");
      await context.sync();

      const rowValues = rowRange.values[0];
      const rowObject: JsonRecord = {};

      for (let j = 0; j < Math.min(headers.length, rowValues.length); j++) {
        rowObject[headers[j]] = rowValues[j] ?? null;
      }

      allRowsData.push({
        data: rowObject,
        rowIndex: actualRowIndex,
      });
    }
  }

  return allRowsData;
};

/**
 * Validate rows have IDs
 */
export const validateTableRows = (rows: JsonRecord[]): JsonRecord[] => {
  return rows.filter((row) => row["id"]?.toString().trim());
};
/**
 * Check if sheet has data beyond headers
 */
export const checkIfSheetHasData = async (): Promise<boolean> => {
  try {
    return await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      try {
        const usedRange = sheet.getUsedRange();
        usedRange.load("rowCount");
        await context.sync();
        return usedRange.rowCount > 1;
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error("Error checking sheet data:", error);
    return false;
  }
};

/**
 * Centralized error handler with toast notifications
 */
export const handleError = async (error: unknown, context: string) => {
  const message =
    error instanceof Error && error.message ? error.message : `Something went wrong in ${context}`;
  await toastMessageDialog("Error", message);
};

export const showConfirmDialog = async (message: string): Promise<boolean> => {
  try {
    return new Promise((resolve) => {
      const dialogUrl =
        `${window.location.origin}/confirm-dialog.html` + `?message=${encodeURIComponent(message)}`;

      Office.context.ui.displayDialogAsync(
        dialogUrl,
        { height: 30, width: 30, displayInIframe: true },
        (asyncResult) => {
          if (asyncResult.status === Office.AsyncResultStatus.Failed) {
            console.error("Dialog failed:", asyncResult.error.message);
            resolve(false);
            return;
          }

          const dialog = asyncResult.value;

          dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
            if ("error" in arg) {
              console.error("Dialog message error:", arg.error);
              dialog.close();
              resolve(false);
              return;
            }
            dialog.close();
            resolve(arg?.message === "confirmed" || arg?.message === "continue");
          });

          dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
            dialog.close();
            resolve(false);
          });
        }
      );
    });
  } catch (error) {
    console.error("Error showing dialog:", error);
    return false;
  }
};
