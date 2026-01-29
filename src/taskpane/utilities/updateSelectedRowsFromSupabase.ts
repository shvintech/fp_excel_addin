type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

export const handleUpdateSelectedRowsFromSupabase = async (incomingRecords: JsonRecord[]) => {
  try {
    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();

      // Unprotect the sheet to allow updates
      sheet.protection.unprotect();
      await context.sync();

      // Get selected ranges
      const selectedRanges = context.workbook.getSelectedRanges();
      selectedRanges.load("areas");
      await context.sync();

      if (selectedRanges.areas.items.length === 0) {
        console.warn("No selected rows.");
        return;
      }

      // Load headers only
      const usedRange = sheet.getUsedRange();
      usedRange.load("columnCount, values");
      await context.sync();

      const headers: string[] = usedRange.values[0].map((h) => (h ?? "").toString().trim());
      const columnCount = usedRange.columnCount;

      for (const area of selectedRanges.areas.items) {
        area.load(["rowIndex", "rowCount"]);
        await context.sync();

        // Load the entire selected area values at once
        const areaRange = sheet.getRangeByIndexes(area.rowIndex, 0, area.rowCount, columnCount);
        areaRange.load("values");
        await context.sync();

        const areaValues = areaRange.values;

        for (let i = 0; i < area.rowCount; i++) {
          const rowValues = areaValues[i];
          const idColIndex = headers.indexOf("id");
          const id = rowValues[idColIndex];

          // Find matching incoming Record
          const incomingRecord = incomingRecords.find((k) => k["id"] === id);
          if (!incomingRecord) continue;

          // Prepare new row values
          const newRowValues = headers.map((header) =>
            Object.prototype.hasOwnProperty.call(incomingRecord, header)
              ? incomingRecord[header]
              : rowValues[headers.indexOf(header)]
          );

          // Update row in place
          const rowRange = sheet.getRangeByIndexes(area.rowIndex + i, 0, 1, headers.length);
          rowRange.values = [newRowValues];
        }
      }

      await context.sync();

      // Re-protect the sheet (adjust protection options as needed)
      sheet.protection.protect({ allowInsertRows: true });
      await context.sync();
    });
  } catch (error: unknown) {
    console.error("Error updating selected rows:", error);
  }
};
