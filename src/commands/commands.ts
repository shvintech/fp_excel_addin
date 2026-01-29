/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 */

import { toastMessageDialog } from "../taskpane/utilities/toastMessageDialog";
import { updateLoadingDialog, withLoadingDialog } from "../taskpane/utilities/loadingDialog";
import { handleUpdateSelectedRowsFromSupabase } from "../taskpane/utilities/updateSelectedRowsFromSupabase";
import {
  extractSelectedRows,
  validateTableRows,
  handleError,
} from "../taskpane/utilities/CommonUtilities";
import { upsertToSupabase, filterValidRecords } from "../taskpane/utilities/supabaseService";
import { getTableData } from "../taskpane/components/getSelectedTableData";

/* global Office */

Office.onReady(() => {});

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };
type RecordWithId = JsonRecord & { id?: string | number | null };

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

const getUpsertErrorText = (error: unknown): string => {
  if (error && typeof error === "object" && "error" in error) {
    const errorValue = (error as { error?: unknown }).error;
    if (typeof errorValue === "string") {
      return errorValue;
    }
  }
  return "Unknown error";
};

/* =====================================================
   SEND TO SUPABASE (COMMAND)
===================================================== */
async function SendToSupabaseButton(event: Office.AddinCommands.Event) {
  try {
    await withLoadingDialog(async (dialog) => {
      updateLoadingDialog(dialog, "Extracting selected rows...");

      const selectedRows = (await Excel.run(async (context) => {
        return await extractSelectedRows(context);
      })) as JsonRecord[];

      if (!selectedRows.length) {
        await toastMessageDialog("Warning", "Please select one or more rows first.");
        return;
      }

      /* -----------------------------------------
         1️⃣ Validate rows
      ----------------------------------------- */
      const validRows = validateTableRows(selectedRows);

      if (!validRows.length) {
        await toastMessageDialog("Warning", "No valid rows found.");
        return;
      }

      /* -----------------------------------------
         2️⃣ Static context (no UI in commands)
      ----------------------------------------- */
      const selectedTable = "cargo_type"; // same as app default
      const tenantId = 6;
      const loggedInUserId = "pulicherlac";
      const uniqueKeys = ["cargo_type", "tenant_id"];

      /* -----------------------------------------
         3️⃣ Build payload (SAME AS APP)
      ----------------------------------------- */
      const payloadRows = validRows.map((row) => ({
        id: toOptionalNumberId(row["id"]),
        data: {
          ...row,
          tenant_id: tenantId,
        },
      }));

      updateLoadingDialog(dialog, `Sending ${payloadRows.length} row(s) to Supabase...`);

      /* -----------------------------------------
         4️⃣ Call Edge Function (UPSERT)
      ----------------------------------------- */
      const result = await upsertToSupabase(payloadRows, {
        tableName: selectedTable,
        operation: "upsert",
        p_userid: loggedInUserId,
        unique_key: uniqueKeys,
      });

      /* -----------------------------------------
         5️⃣ Handle errors
      ----------------------------------------- */
      if (result.errors?.length) {
        const messages = result.errors
          .map((e, i) => `Row ${i + 1}: ${getUpsertErrorText(e)}`)
          .join("\n");

        await toastMessageDialog("Partial Success", messages);

        if ((result.inserted ?? 0) === 0 && (result.updated ?? 0) === 0) {
          return;
        }
      }

      /* -----------------------------------------
         6️⃣ Success message (COUNTS FROM API)
      ----------------------------------------- */
      const messageParts: string[] = [];

      if (result.updated > 0) {
        messageParts.push(`${result.updated} row(s) updated`);
      }
      if (result.inserted > 0) {
        messageParts.push(`${result.inserted} row(s) created`);
      }

      const message =
        messageParts.length > 0 ? messageParts.join(", ") + "." : "No changes were made.";

      await toastMessageDialog("Success", message);
    });
  } catch (err: unknown) {
    await handleError(err, "Send to Supabase");
  } finally {
    event.completed();
  }
}

/* =====================================================
   GET FROM SUPABASE (COMMAND)
===================================================== */
async function GetFromSupabaseButton(event: Office.AddinCommands.Event) {
  try {
    await withLoadingDialog(async (dialog) => {
      updateLoadingDialog(dialog, "Fetching data from Supabase...");

      const selectedTable = "cargo_type";

      const data = (await getTableData(selectedTable, "")) as RecordWithId[];

      if (!data?.length) {
        await toastMessageDialog("Warning", "No data found in Supabase.");
        return;
      }

      const rows = filterValidRecords(data) as RecordWithId[];

      if (!rows.length) {
        await toastMessageDialog("Warning", "No valid rows found.");
        return;
      }

      await handleUpdateSelectedRowsFromSupabase(rows);

      await toastMessageDialog("Success", `${rows.length} row(s) updated in Excel.`);
    });
  } catch (err: unknown) {
    await handleError(err, "Get from Supabase");
  } finally {
    event.completed();
  }
}

/* -----------------------------------------
   Register commands
----------------------------------------- */
Office.actions.associate("SendToSupabaseButton", SendToSupabaseButton);
Office.actions.associate("GetFromSupabaseButton", GetFromSupabaseButton);
