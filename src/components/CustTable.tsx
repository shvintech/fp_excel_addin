import { useEffect, useRef, useState } from "react";
import Handsontable from "handsontable/base";
import { registerAllModules } from "handsontable/registry";
import { HyperFormula } from "hyperformula";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

registerAllModules();

type Props = {
  history_id?: string | number | null;
};

type RowRecord = Record<string, string | number | boolean | null>;

type RecordsResponse = {
  headers?: string[];
  rows?: Array<RowRecord & { recordId?: string | number }>;
};

type CellCoords = { row: number; col: number };

export default function CustTable({ history_id }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hotRef = useRef<Handsontable | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [deleteRowIndex, setDeleteRowIndex] = useState<number | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    let hot: Handsontable | null;
    let hfInstance: HyperFormula | null;

    async function init() {
      // Destroy old instance if exist
      if (hotRef.current) {
        hotRef.current.destroy();
        hotRef.current = null;
      }

      setLoading(true);

      hfInstance = HyperFormula.buildEmpty({ licenseKey: "gpl-v3" });

      let tableData: Array<Array<string | number | boolean | null>> = [];
      let headersData: string[] = [];

      try {
        const resp = await api.get<RecordsResponse>(
          `/get-records?user_id=${1}&history_id=${history_id ?? ""}`
        );

        const { rows } = resp.data;
        const headers = resp.data.headers ?? [];

        headersData = ["Action", ...headers];

        if (rows?.length && headers.length) {
          tableData = rows.map((row) => {
            const rowValues = headers.map((h) => row[h] ?? "");
            return [row.recordId ?? "", ...rowValues];
          });
        } else {
          tableData = [Array(headersData.length).fill("")];
        }
      } catch (err) {
        console.error(err);
        headersData = ["Action", "Column 1", "Column 2"];
        tableData = [Array(headersData.length).fill("")];
      }

      const container = containerRef.current;
      if (!container) {
        setLoading(false);
        return;
      }

      hot = new Handsontable(container, {
        data: tableData,
        colHeaders: headersData,
        rowHeaders: true,
        height: 600,
        width: "100%",
        licenseKey: "non-commercial-and-evaluation",
        fillHandle: false,
        autoColumnSize: false,
        stretchH: "none",
        formulas: { engine: hfInstance },
        manualColumnResize: true,
        manualRowResize: true,
        contextMenu: true,
        fixedColumnsLeft: 1,
        colWidths: headersData.map(() => 180),

        columns: headersData.map((h) => {
          if (h === "Action") {
            return {
              readOnly: true,
              renderer: (_instance, td) => {
                td.innerHTML = `
                <div class="as_action">
                  <button class="view-btn">View</button>
                  <button class="delete-btn">Delete</button>
                </div>`;
                return td;
              },
            };
          }
          return { readOnly: true };
        }),

        afterOnCellMouseDown: (event: MouseEvent, coords: CellCoords) => {
          if (coords.col === 0) {
            if (
              event.target instanceof HTMLElement &&
              event.target.classList.contains("view-btn")
            ) {
              if (!hot) {
                return;
              }
              const rowData = hot.getDataAtRow(coords.row);
              const recordId = rowData[0];
              navigate(`/records/${recordId}`);
            }
            if (
              event.target instanceof HTMLElement &&
              event.target.classList.contains("delete-btn")
            ) {
              setDeleteRowIndex(coords.row);
              setShowDeletePopup(true);
            }
          }
        },
      });

      hotRef.current = hot;
      setLoading(false);
    }

    init();

    return () => {
      try {
        hotRef.current?.destroy();
        hotRef.current = null;
        hfInstance?.destroy?.();
      } catch (error) {
        console.warn("Cleanup failed:", error);
      }
    };
  }, [history_id, navigate]);

  const handleConfirmDelete = async () => {
    if (deleteRowIndex == null) return;

    setDeleteLoading(true);

    try {
      if (!hotRef.current) {
        setDeleteLoading(false);
        return;
      }

      const rowData = hotRef.current.getDataAtRow(deleteRowIndex);
      const recordId = rowData[0];

      await api.post("/delete-record", { record_id: recordId });

      hotRef.current.alter("remove_row", deleteRowIndex);

      setShowDeletePopup(false);
      setDeleteRowIndex(null);
    } catch (err) {
      console.error("Delete failed", err);
    }

    setDeleteLoading(false);
  };

  const exportExcel = async (userId: number) => {
    setExportLoading(true);

    const url = `${
      import.meta.env.VITE_SUPABASE_URL
    }/export-excel?user_id=${userId}&history_id=${history_id ?? ""}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
      },
    });

    if (!response.ok) {
      setExportLoading(false);
      throw new Error("Failed to download Excel");
    }

    const blob = await response.blob();

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "records.xlsx";
    a.click();

    URL.revokeObjectURL(a.href);
    setExportLoading(false);
  };

  return (
    <div>
      {loading && <div>Loading table…</div>}

      <div id="table_wrapper">
        <div id="handsontable-root" ref={containerRef} style={{ width: "100%" }} />
      </div>

      <button className="upload-btn" onClick={() => exportExcel(1)} disabled={exportLoading}>
        {exportLoading ? <div className="loader"></div> : "Export Excel"}
      </button>

      {showDeletePopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>Are you sure?</h3>
            <p>Do you really want to delete this record?</p>

            <div className="popup-actions">
              <button onClick={() => setShowDeletePopup(false)} disabled={deleteLoading}>
                Cancel
              </button>

              <button onClick={handleConfirmDelete} disabled={deleteLoading}>
                {deleteLoading ? "Deleting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
