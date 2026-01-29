import React, { useEffect, useMemo, useState } from "react";
import { fetchDropdownValues } from "../components/FetchDropDownValues";
import { DropdownValue } from "../utilities/type";
import { groupByType } from "../utilities/GroupByType";
import { toastMessageDialog } from "../utilities/toastMessageDialog";
import { updateLoadingDialog, withLoadingDialog } from "../utilities/loadingDialog";
import { handleUpdateSelectedRowsFromSupabase } from "../utilities/updateSelectedRowsFromSupabase";
import { toInitCapsFromSnake } from "../utilities/stringUtils";
import {
  extractSelectedRows,
  extractSelectedRowsWithIndices,
  validateTableRows,
  checkIfSheetHasData,
  showConfirmDialog,
  handleError,
  RowDataWithIndex,
} from "../utilities/CommonUtilities";
import {
  upsertToSupabase,
  deleteSelectedRowsFromSupabase,
  filterValidRecords,
  extractHeadersFromTable,
  JsonRecord,
  JsonValue,
  UpsertInputRow,
} from "../utilities/supabaseService";
import { getTableData } from "./getSelectedTableData";

type RecordWithId = JsonRecord & { id?: string | number | null };
type DialogSelections = {
  selectedType?: string;
  selectedTable?: string;
  selectedOperation?: string;
};

const isJsonObject = (value: JsonValue): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
};

const getUpsertErrorText = (error: unknown): string => {
  if (error && typeof error === "object" && "error" in error) {
    const errorValue = (error as { error?: unknown }).error;
    if (typeof errorValue === "string") {
      return errorValue;
    }
  }
  return "Unknown error";
};

const toOptionalNumberId = (value: JsonValue): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const SendToSupabaseButton: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedOperation, setSelectedOperation] = useState<string>("");
  const [hasFetched, setHasFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DropdownValue[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [activeSheetId, setActiveSheetId] = useState<string>("");
  const [processedSheetIds, setProcessedSheetIds] = useState<string[]>([]);

  const enforceSingleSheet = async () => {
    try {
      await Excel.run(async (context) => {
        const sheets = context.workbook.worksheets;
        sheets.load("items");
        const activeSheet = sheets.getActiveWorksheet();
        activeSheet.load("name");
        await context.sync();

        for (const sheet of sheets.items) {
          sheet.load("name");
        }
        await context.sync();

        for (const sheet of sheets.items) {
          if (sheet.name !== activeSheet.name) {
            sheet.delete();
          }
        }

        const workbookProtection = context.workbook.protection;
        workbookProtection.load("protected");
        await context.sync();
        if (!workbookProtection.protected) {
          workbookProtection.protect();
        }

        await context.sync();
      });
    } catch (error: unknown) {
      console.error("Failed to enforce single-sheet workbook:", error);
    }
  };

  // Initialize and listen for sheet changes
  useEffect(() => {
    let isSubscribed = true;

    const init = async () => {
      try {
        await Excel.run(async (context) => {
          const sheet = context.workbook.worksheets.getActiveWorksheet();
          sheet.load("id");
          await context.sync();

          if (isSubscribed) {
            setActiveSheetId(sheet.id);
          }
        });

        await Excel.run(async (context) => {
          context.workbook.worksheets.onActivated.add(
            async (event: Excel.WorksheetActivatedEventArgs) => {
              if (isSubscribed) {
                setActiveSheetId(event.worksheetId);
              }
            }
          );
          context.workbook.worksheets.onAdded.add(async () => {
            if (isSubscribed) {
              await toastMessageDialog(
                "Not Allowed",
                "Adding new sheet is disabled for this Add-in."
              );
              await enforceSingleSheet();
            }
          });
          await context.sync();
        });

        await enforceSingleSheet();
      } catch (err) {
        console.error("Sheet listener error:", err);
      }
    };

    init();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Reset state when sheet changes
  useEffect(() => {
    if (!activeSheetId) return;

    const isAlreadyProcessed = processedSheetIds.includes(activeSheetId);

    if (isAlreadyProcessed) {
      return;
    }

    fetchDropdownValues().then(setData).catch(console.error);

    setSelectedType("");
    setSelectedTable("");
    setSelectedOperation("");
    setHasFetched(false);
  }, [activeSheetId, processedSheetIds]);

  // Group once, memoized
  const groupedData = useMemo(() => groupByType(data), [data]);
  const tablesForSelectedType = useMemo(
    () => groupedData[selectedType] || [],
    [groupedData, selectedType]
  );

  //unique keys for selected table
  const uniqueKeysForSelectedTable = useMemo(() => {
    return tablesForSelectedType.find((t) => t.table_name === selectedTable)?.unique_keys ?? [];
  }, [tablesForSelectedType, selectedTable]);

  const handleFetchSuccess = () => {
    setHasFetched(true);

    setProcessedSheetIds((prev) =>
      prev.includes(activeSheetId) ? prev : [...prev, activeSheetId]
    );
  };

  const refreshActiveSheetFromSupabase = async (successTitle?: string, successMessage?: string) => {
    if (!selectedTable || !selectedOperation) {
      await toastMessageDialog("Warning", "Please select a table and operation first.");
      return;
    }

    try {
      await withLoadingDialog(async (dialog) => {
        updateLoadingDialog(dialog, "Refreshing data from Supabase...");

        const data = (await getTableData(selectedTable, selectedOperation)) as RecordWithId[];

        const headers = extractHeadersFromTable(data);
        const validRecords = headers.includes("id") ? data.filter((r) => r.id) : data;

        const result = await populateSheetWithDataForAllTables(validRecords, headers, dialog);

        return result;
      }, "Refreshing...");

      // Alternatively, show message AFTER loading dialog closes
      // This prevents dialog conflicts
      if (successTitle && successMessage) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await toastMessageDialog(successTitle, successMessage);
      }
    } catch (error: unknown) {
      await toastMessageDialog(
        "Error",
        getErrorMessage(error, "Failed to refresh data after update.")
      );
    }
  };

  const handleSendToSupabaseButton = async () => {
    try {
      let messageTitle = "";
      let message = "";

      if (!selectedTable || !selectedOperation) {
        await toastMessageDialog("Warning", "Please select a table and operation first.");
        return;
      }

      await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.protection.load("protected");
        await context.sync();
        const wasProtected = sheet.protection.protected;

        // Unprotect sheet to allow writing
        if (wasProtected) {
          sheet.protection.unprotect();
          await context.sync();
        }

        /* -----------------------------------------
           1️⃣ Extract selected rows with indices
        ----------------------------------------- */
        const allRowsDataWithIndices = await extractSelectedRowsWithIndices(context);

        if (allRowsDataWithIndices.length === 0) {
          await toastMessageDialog("Warning", "Please select one or more rows first.");
          return;
        }

        /* -----------------------------------------
           2️⃣ Filter header + empty rows
        ----------------------------------------- */
        const validRowsWithIndices = allRowsDataWithIndices.filter((item) => {
          if (item.rowIndex === 0) return false;

          return Object.values(item.data).some(
            (value) => value !== null && value !== undefined && value !== ""
          );
        });

        if (validRowsWithIndices.length === 0) {
          await toastMessageDialog("Warning", "No valid data rows found (excluding headers).");
          return;
        }

        /* -----------------------------------------
           3️⃣ Remove duplicate row selections
        ----------------------------------------- */
        const uniqueRowMap = new Map<number, RowDataWithIndex>();
        validRowsWithIndices.forEach((item) => {
          uniqueRowMap.set(item.rowIndex, item);
        });

        const uniqueValidRowsWithIndices = Array.from(uniqueRowMap.values());

        /* -----------------------------------------
           4️⃣ Get unique keys for the selected table
        ----------------------------------------- */
        const UniqueKeys = uniqueKeysForSelectedTable;
        if (!UniqueKeys.length) {
          await toastMessageDialog("Warning", "Unique keys are not configured for this table.");
          return;
        }
        const loggedInUserId = "pulicherlac";
        const tenantId = 6;
        /* -----------------------------------------
           5️⃣ Prepare payload - determine operation per row
        ----------------------------------------- */
        const invalidIdRows: number[] = [];
        const missingRequiredRows: Array<{ row: number; missing: string[] }> = [];
        const payloadRows: UpsertInputRow[] = uniqueValidRowsWithIndices.map((item) => {
          const rowData: JsonRecord = {};

          // Extract all non-empty fields from the row
          Object.keys(item.data).forEach((key) => {
            const value = item.data[key] as JsonValue;
            if (key === "tenant_id") {
              rowData[key] = tenantId;
            } else if (value !== undefined && value !== null && value !== "") {
              rowData[key] = value;
            }
          });

          const rawId = item.data["id"] as JsonValue;
          const id = toOptionalNumberId(rawId);
          if (rawId !== undefined && rawId !== null && rawId !== "" && id === undefined) {
            invalidIdRows.push(item.rowIndex + 1);
          }

          const requiredKeys = ["tenant_id", ...UniqueKeys];
          const missingKeys = requiredKeys.filter((key) => {
            const value = rowData[key];
            return value === undefined || value === null || value === "";
          });
          if (missingKeys.length > 0) {
            missingRequiredRows.push({ row: item.rowIndex + 1, missing: missingKeys });
          }
          const payloadRow: UpsertInputRow =
            id !== undefined ? { id, data: rowData } : { data: rowData };
          return payloadRow;
        });
        if (invalidIdRows.length > 0) {
          await toastMessageDialog(
            "Validation Errors",
            `Invalid ID value in row(s): ${invalidIdRows.join(", ")}. IDs must be numeric.`
          );
          return;
        }
        if (missingRequiredRows.length > 0) {
          const details = missingRequiredRows
            .map(({ row, missing }) => `Row ${row}: ${missing.join(", ")}`)
            .join("\n");
          await toastMessageDialog("Validation Errors", `Missing required fields:\n${details}`);
          return;
        }
        console.log("payloadRows=============", payloadRows);

        const operation = "upsert";

        /* -----------------------------------------
           6️⃣ Call Edge Function with bulk operation
        ----------------------------------------- */
        const result = await upsertToSupabase(payloadRows, {
          tableName: selectedTable,
          operation: operation,
          p_userid: loggedInUserId,
          unique_key: UniqueKeys,
        });
        console.log(result);

        /* -----------------------------------------
           7️⃣ Handle errors and show to user
        ----------------------------------------- */
        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors
            .map((err, idx) => `Row ${idx + 1}: ${getUpsertErrorText(err)}`)
            .join("\n");

          await toastMessageDialog("Validation Errors", `Some rows failed:\n${errorMessages}`);

          // If all rows failed, return early
          if (result.inserted === 0 && result.updated === 0) {
            return;
          }
        }

        /* -----------------------------------------
           8️⃣ Write back new IDs to Excel (for inserts)
        ----------------------------------------- */
        if (result.inserted > 0 && result.insertedRecords?.length) {
          const headerRange = sheet.getRangeByIndexes(0, 0, 1, 100);
          headerRange.load("values");
          await context.sync();

          const headers = headerRange.values[0];
          const idColumnIndex = headers.findIndex((h) => h === "id");

          if (idColumnIndex !== -1) {
            let insertCursor = 0;

            for (const rowItem of uniqueValidRowsWithIndices) {
              const excelId = rowItem.data["id"];

              // Only write back ID if it was an insert (no existing ID)
              if (!excelId && result.insertedRecords[insertCursor]) {
                const insertedRecord = result.insertedRecords[insertCursor];
                const newId = insertedRecord.id || insertedRecord.newId;

                const cell = sheet.getRangeByIndexes(rowItem.rowIndex, idColumnIndex, 1, 1);

                cell.values = [[newId]];
                insertCursor++;
              }
            }

            await context.sync();
          }
        }

        /* -----------------------------------------
           9️⃣ Update IDs for updated records (soft delete + new version)
        ----------------------------------------- */
        if (result.updated > 0 && result.updatedRecords?.length) {
          const headerRange = sheet.getRangeByIndexes(0, 0, 1, 100);
          headerRange.load("values");
          await context.sync();

          const headers = headerRange.values[0];
          const idColumnIndex = headers.findIndex((h) => h === "id");

          if (idColumnIndex !== -1) {
            let updateCursor = 0;

            for (const rowItem of uniqueValidRowsWithIndices) {
              const excelId = rowItem.data["id"];

              // Update the ID to the new version ID
              if (excelId && result.updatedRecords[updateCursor]) {
                const updatedRecord = result.updatedRecords[updateCursor];
                const newId = updatedRecord.newId;

                const cell = sheet.getRangeByIndexes(rowItem.rowIndex, idColumnIndex, 1, 1);

                cell.values = [[newId]];
                updateCursor++;
              }
            }

            await context.sync();
          }
        }

        /* -----------------------------------------
           🔟 Force Excel to repaint
        ----------------------------------------- */
        sheet.getUsedRange().load("values");
        await context.sync();

        /* -----------------------------------------
           🔟 Prepare success message
        ----------------------------------------- */
        const insertedCount = result.inserted ?? 0;
        const updatedCount = result.updated ?? 0;
        const deletedCount = result.deleted ?? 0;
        const failedCount = result.errors?.length ?? 0;
        const duplicatedCount = result.duplicated ?? 0;
        const messageParts: string[] = [];

        if (insertedCount > 0) {
          messageParts.push(`${insertedCount} row(s) created`);
        }
        if (duplicatedCount > 0) {
          messageParts.push(` Duplicate record, insert skipped`);
        }

        if (updatedCount > 0) {
          messageParts.push(`${updatedCount} row(s) updated`);
        }

        if (deletedCount > 0) {
          messageParts.push(`${deletedCount} row(s) deleted`);
        }

        if (failedCount > 0) {
          messageParts.push(`${failedCount} row(s) failed`);
        }

        message =
          messageParts.length > 0
            ? messageParts.join(". ")
            : "No changes detected, update skipped.";

        messageTitle =
          failedCount > 0 || duplicatedCount > 0 || messageParts.length === 0
            ? "Warning"
            : "Success";

        if (wasProtected) {
          sheet.protection.protect({ allowInsertRows: true });
          await context.sync();
        }
      });

      /* -----------------------------------------
         🔁 Refresh and show message (only if we have a message)
      ----------------------------------------- */
      if (message) {
        await refreshActiveSheetFromSupabase(messageTitle, message);
      }
    } catch (error: unknown) {
      await handleError(error, "Send to Supabase");
    }
  };

  const handleDeleteSelectedRows = async () => {
    try {
      let messageTitle = "";
      let message = "";

      if (!selectedTable || !selectedOperation) {
        await toastMessageDialog("Warning", "Please select a table and operation first.");
        return;
      }

      await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();

        /* -----------------------------------------
           1️⃣ Extract selected rows with indices
        ----------------------------------------- */
        const allRowsDataWithIndices = await extractSelectedRowsWithIndices(context);

        if (allRowsDataWithIndices.length === 0) {
          await toastMessageDialog("Warning", "Please select one or more rows to delete.");
          return;
        }

        /* -----------------------------------------
           2️⃣ Filter header + empty rows + rows without ID
        ----------------------------------------- */
        const validRowsWithIndices = allRowsDataWithIndices.filter((item) => {
          if (item.rowIndex === 0) return false;
          const id = toOptionalNumberId(item.data["id"] as JsonValue);
          if (id === undefined) return false;

          return Object.values(item.data).some(
            (value) => value !== null && value !== undefined && value !== ""
          );
        });

        if (validRowsWithIndices.length === 0) {
          await toastMessageDialog(
            "Warning",
            "No valid rows with IDs found. Only rows with IDs can be deleted."
          );
          return;
        }

        /* -----------------------------------------
           3️⃣ Confirm deletion
        ----------------------------------------- */
        const confirmed = await showConfirmDialog(
          `Are you sure you want to delete ${validRowsWithIndices.length} row(s)?`
        );

        if (!confirmed) {
          return;
        }

        /* -----------------------------------------
           4️⃣ Remove duplicate row selections
        ----------------------------------------- */
        const uniqueRowMap = new Map<number, RowDataWithIndex>();
        validRowsWithIndices.forEach((item) => {
          uniqueRowMap.set(item.rowIndex, item);
        });

        const uniqueValidRowsWithIndices = Array.from(uniqueRowMap.values());

        /* -----------------------------------------
           5️⃣ Get unique keys for the selected table
        ----------------------------------------- */
        const uniqueKeys = uniqueKeysForSelectedTable;
        if (!uniqueKeys.length) {
          await toastMessageDialog("Warning", "Unique keys are not configured for this table.");
          return;
        }
        const loggedInUserId = "pulicherlac";
        const tenantId = 6;
        /* -----------------------------------------
           6️⃣ Prepare payload for delete
        ----------------------------------------- */
        const invalidIdRows: number[] = [];
        const payloadRows: UpsertInputRow[] = uniqueValidRowsWithIndices.map((item) => {
          const rowData: JsonRecord = {};

          // Extract all non-empty fields from the row
          Object.keys(item.data).forEach((key) => {
            const value = item.data[key] as JsonValue;
            if (key === "tenant_id") {
              rowData[key] = tenantId;
            } else if (
              value !== undefined &&
              value !== null &&
              value !== undefined &&
              value !== ""
            ) {
              rowData[key] = value;
            }
          });

          const rawId = item.data["id"] as JsonValue;
          const id = toOptionalNumberId(rawId);
          if (rawId !== undefined && rawId !== null && rawId !== "" && id === undefined) {
            invalidIdRows.push(item.rowIndex + 1);
          }
          const payloadRow: UpsertInputRow =
            id !== undefined ? { id, data: rowData } : { data: rowData };
          return payloadRow;
        });
        if (invalidIdRows.length > 0) {
          await toastMessageDialog(
            "Validation Errors",
            `Invalid ID value in row(s): ${invalidIdRows.join(", ")}. IDs must be numeric.`
          );
          return;
        }

        /* -----------------------------------------
           7️⃣ Call delete function
        ----------------------------------------- */
        const result = await deleteSelectedRowsFromSupabase(payloadRows, {
          tableName: selectedTable,
          p_userid: loggedInUserId,
          unique_key: uniqueKeys,
        });

        /* -----------------------------------------
           8️⃣ Handle errors
        ----------------------------------------- */
        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors
            .map((err, idx) => `Row ${idx + 1}: ${getUpsertErrorText(err)}`)
            .join("\n");

          await toastMessageDialog(
            "Delete Errors",
            `Some rows failed to delete:\n${errorMessages}`
          );

          if (result.deleted === 0) {
            return;
          }
        }

        /* -----------------------------------------
           🔟 Prepare success message for refresh
        ----------------------------------------- */
        message =
          (result.deleted ?? 0) > 0
            ? `${result.deleted} row(s) successfully deleted from Supabase.`
            : "No rows were deleted.";

        messageTitle = result.errors && result.errors.length > 0 ? "Partial Success" : "Success";
      });

      /* -----------------------------------------
         🔁 Refresh and show message (only if we have a message)
      ----------------------------------------- */
      if (message) {
        await refreshActiveSheetFromSupabase(messageTitle, message);
      }
    } catch (error: unknown) {
      await handleError(error, "Delete from Supabase");
    }
  };

  // ORIGINAL "Get Selected Records" functionality remains the same
  const handleGetFromSupabaseButton = async () => {
    try {
      if (!selectedTable || !selectedOperation) {
        await toastMessageDialog("Warning", "Please select a table and operation first.");
        return;
      }
      await Excel.run(async (context) => {
        const selectedRows = (await extractSelectedRows(context)) as JsonRecord[];

        if (selectedRows.length === 0) {
          await toastMessageDialog("Warning", "Please select one or more rows first.");
          return;
        }

        const validSelectedRows = validateTableRows(selectedRows);

        if (validSelectedRows.length === 0) {
          await toastMessageDialog(
            "Warning",
            "No rows with ID detected. Please select rows with valid IDs."
          );
          return;
        }

        const selectedIds = validSelectedRows
          .map((row) => String(row["id"]).trim())
          .filter(Boolean);

        const data = (await getTableData(selectedTable, selectedOperation)) as RecordWithId[];
        console.log("data from gettabledata:", data);

        if (!data.length) {
          await toastMessageDialog("Warning", "No records found.");
          return;
        }

        const allValidRows = filterValidRecords(data) as RecordWithId[];
        console.log(allValidRows);

        const matchingRows = allValidRows.filter((row) => {
          const rowId = String(row["id"]).trim();
          return selectedIds.includes(rowId);
        });
        console.log(matchingRows);

        if (!matchingRows.length) {
          await toastMessageDialog(
            "Warning",
            "No valid rows found (excluding headers). Please select rows with valid IDs."
          );
          return;
        }

        await handleUpdateSelectedRowsFromSupabase(matchingRows);
        await toastMessageDialog("Success", `${matchingRows.length} row(s) updated in Excel.`);
      });
    } catch (error: unknown) {
      await handleError(error, "Get");
    }
  };

  const populateSheetWithDataForAllTables = async (
    data: RecordWithId[],
    headers: string[],
    dialog: Office.Dialog
  ): Promise<{ count: number; message: string }> => {
    return await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();

      // Unprotect the sheet to allow modifying protection settings
      sheet.protection.unprotect();
      await context.sync();

      // Helper function to get column letter from index (0-based)
      const getColumnLetter = (index: number): string => {
        let letter = "";
        let temp = index;
        while (temp >= 0) {
          letter = String.fromCharCode(65 + (temp % 26)) + letter;
          temp = Math.floor(temp / 26) - 1;
        }
        return letter;
      };

      // Reorder headers: id first, then other columns, then special columns except id
      const specialColumns = [
        "id",
        "version",
        "is_active",
        "tenant_id",
        "created_by",
        "created_on",
        "updated_by",
        "updated_on",
        "valid_from",
        "valid_to",
      ];
      const otherColumns = headers.filter((h) => !specialColumns.includes(h));
      const reorderedHeaders = ["id", ...otherColumns, ...specialColumns.filter((h) => h !== "id")];

      try {
        sheet.getUsedRange().clear();
        await context.sync();
      } catch (error: unknown) {
        console.warn("Failed to clear sheet:", error);
      }

      if (reorderedHeaders.length === 0) {
        updateLoadingDialog(dialog, "No data found to create headers", true);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        throw new Error("No data found to create headers.");
      }

      const headerRange = sheet.getRangeByIndexes(0, 0, 1, reorderedHeaders.length);
      headerRange.values = [reorderedHeaders];
      headerRange.format.font.bold = true;
      headerRange.format.fill.color = "#0F783F";
      headerRange.format.font.color = "#FFFFFF";
      headerRange.format.protection.locked = true;
      await context.sync();

      if (data.length === 0) {
        headerRange.format.autofitColumns();
        await context.sync();

        // Lock entire special columns
        for (const col of specialColumns) {
          const colIndex = reorderedHeaders.indexOf(col);
          if (colIndex !== -1) {
            const colLetter = getColumnLetter(colIndex);
            const colRange = sheet.getRange(`${colLetter}:${colLetter}`);
            colRange.format.protection.locked = true;
          }
        }
        // Unlock entire other columns
        for (const col of otherColumns) {
          const colIndex = reorderedHeaders.indexOf(col);
          if (colIndex !== -1) {
            const colLetter = getColumnLetter(colIndex);
            const colRange = sheet.getRange(`${colLetter}:${colLetter}`);
            colRange.format.protection.locked = false;
          }
        }
        // Re-lock header row after column locks
        headerRange.format.protection.locked = true;
        sheet.protection.protect({ allowInsertRows: true });
        await context.sync();

        updateLoadingDialog(dialog, "✓ Headers created successfully", true);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { count: 0, message: "No data found. Headers created." };
      }

      updateLoadingDialog(dialog, `Loading ${data.length} record(s)...`);

      const flattenRecord = (obj: JsonRecord): Record<string, JsonValue> => {
        const result: Record<string, JsonValue> = {};
        const recurse = (cur: JsonRecord) => {
          Object.keys(cur).forEach((key) => {
            const value = cur[key];
            if (isJsonObject(value)) {
              recurse(value);
            } else {
              result[key] = value;
            }
          });
        };
        recurse(obj);
        return result;
      };

      const rows = data.map((record) => {
        const flat = flattenRecord(record);
        return reorderedHeaders.map((header) => flat[header] ?? "");
      });

      if (rows.length > 0) {
        const dataRange = sheet.getRangeByIndexes(1, 0, rows.length, reorderedHeaders.length);
        dataRange.values = rows;
        await context.sync();
      }

      const usedRange = sheet.getUsedRange();
      usedRange.format.autofitColumns();
      usedRange.format.rowHeight = 20;
      await context.sync();

      // Grey out data cells in locked columns
      const numRows = data.length + 1; // header + data rows
      for (const col of specialColumns) {
        const colIndex = reorderedHeaders.indexOf(col);
        if (colIndex !== -1 && numRows > 1) {
          const dataRange = sheet.getRangeByIndexes(1, colIndex, numRows - 1, 1);
          dataRange.format.fill.color = "#e5e5e5";
        }
      }
      await context.sync();

      // Lock entire special columns
      for (const col of specialColumns) {
        const colIndex = reorderedHeaders.indexOf(col);
        if (colIndex !== -1) {
          const colLetter = getColumnLetter(colIndex);
          const colRange = sheet.getRange(`${colLetter}:${colLetter}`);
          colRange.format.protection.locked = true;
        }
      }
      // Unlock entire other columns
      for (const col of otherColumns) {
        const colIndex = reorderedHeaders.indexOf(col);
        if (colIndex !== -1) {
          const colLetter = getColumnLetter(colIndex);
          const colRange = sheet.getRange(`${colLetter}:${colLetter}`);
          colRange.format.protection.locked = false;
        }
      }
      // Re-lock header row after column locks
      headerRange.format.protection.locked = true;
      sheet.protection.protect({ allowInsertRows: true });
      await context.sync();

      return { count: data.length, message: `Successfully loaded ${data.length} record(s).` };
    });
  };

  // MODIFIED: perform the Get All Records flow (previously inside handleGetAllRecordsOfSelectedTableButton)
  const performGetAllRecords = async (table: string, operation: string) => {
    if (!table) {
      await toastMessageDialog("Error", "Please select a table before fetching records.");
      return;
    }

    setLoading(true);

    try {
      const hasData = await checkIfSheetHasData();

      if (hasData) {
        const confirmed = await showConfirmDialog("Are you sure you want to continue?");

        if (!confirmed) {
          setLoading(false);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const result = await withLoadingDialog(async (dialog) => {
        updateLoadingDialog(dialog, "Fetching data from Supabase...");

        const data = (await getTableData(table, operation)) as RecordWithId[];
        setHasFetched(true);
        const headers = extractHeadersFromTable(data);
        const validRecords = headers.includes("id") ? data.filter((r) => r.id) : data;

        return await populateSheetWithDataForAllTables(validRecords, headers, dialog);
      }, "Processing...");

      if (result) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await toastMessageDialog(result.count === 0 ? "Warning" : "Success", result.message);
      }
    } catch (error: unknown) {
      await toastMessageDialog(
        "Error",
        getErrorMessage(error, "An error occurred while fetching records.")
      );
    } finally {
      setLoading(false);
      handleFetchSuccess();
    }
  };

  // NEW: function to show the Office dialog
  const showGetRecordsDialog = async () => {
    try {
      return new Promise<void>((resolve) => {
        const dialogUrl = `${window.location.origin}/get-records-dialog.html`;

        Office.context.ui.displayDialogAsync(
          dialogUrl,
          { height: 40, width: 50, displayInIframe: true },
          (asyncResult) => {
            if (asyncResult.status === Office.AsyncResultStatus.Failed) {
              console.error("Dialog failed:", asyncResult.error.message);
              resolve();
              return;
            }

            const dialog = asyncResult.value;

            // Send data to dialog
            dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
              void (async () => {
                if ("error" in arg) {
                  console.error("Dialog message error:", arg.error);
                  dialog.close();
                  resolve();
                  return;
                }

                if (arg.message === "dialog-ready") {
                  try {
                    const dropdownValues = await fetchDropdownValues();
                    setData(dropdownValues);

                    const grouped = groupByType(dropdownValues);
                    dialog.messageChild(
                      JSON.stringify({
                        types: Object.keys(grouped),
                        groupedData: grouped,
                      })
                    );
                  } catch (error) {
                    console.error("Error fetching dropdown values:", error);
                    await toastMessageDialog(
                      "Error",
                      "Failed to load dropdown values. Please try again."
                    );
                  }
                } else if (arg.message === "cancel") {
                  dialog.close();
                  resolve();
                } else {
                  try {
                    const selections = JSON.parse(arg.message) as DialogSelections;
                    if (selections.selectedTable && selections.selectedOperation) {
                      setSelectedType(selections.selectedType ?? "");
                      setSelectedTable(selections.selectedTable);
                      setSelectedOperation(selections.selectedOperation);
                      performGetAllRecords(selections.selectedTable, selections.selectedOperation);
                    }
                    dialog.close();
                    resolve();
                  } catch (error) {
                    console.error("Error parsing selections:", error);
                    dialog.close();
                    resolve();
                  }
                }
              })();
            });

            dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
              dialog.close();
              resolve();
            });
          }
        );
      });
    } catch (error) {
      console.error("Error showing dialog:", error);
    }
  };

  // MODIFIED: opens get records dialog if not fetched, else confirm for refresh
  const handleGetAllRecordsOfSelectedTableButton = async () => {
    if (hasFetched) {
      await performGetAllRecords(selectedTable, selectedOperation);
    } else {
      await showGetRecordsDialog();
    }
  };
  return (
    <div className="flex flex-col justify-center items-center gap-4 mt-8 h-screen">
      {hasFetched && (
        <p className="text-lg font-semibold text-gray-700">
          Table: {toInitCapsFromSnake(selectedTable)}
        </p>
      )}
      <button
        className="w-64 py-2.5 px-6 rounded-lg text-sm font-medium text-white bg-[#0F783F] hover:bg-[#0d6735] transition-all duration-200 cursor-pointer"
        onClick={handleGetAllRecordsOfSelectedTableButton}
        disabled={loading}
      >
        {loading ? "Loading..." : hasFetched ? "Refresh Records" : "Get Records"}
      </button>

      <button
        className="w-64 py-2.5 px-6 rounded-lg text-sm font-medium text-white bg-[#0F783F] hover:bg-[#0d6735] transition-all duration-200 cursor-pointer"
        onClick={handleSendToSupabaseButton}
      >
        Send Selected Records
      </button>

      <button
        className="w-64 py-2.5 px-6 rounded-lg text-sm font-medium text-white bg-[#0F783F] hover:bg-[#0d6735] transition-all duration-200 cursor-pointer"
        onClick={handleGetFromSupabaseButton}
      >
        Get Selected Records
      </button>

      <button
        className="w-64 py-2.5 px-6 rounded-lg text-sm font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-all duration-200 cursor-pointer"
        onClick={handleDeleteSelectedRows}
      >
        Delete Selected Records
      </button>
    </div>
  );
};

export default SendToSupabaseButton;
