import { useEffect, useRef, useState } from "react";
import Handsontable from "handsontable/base";
import { registerAllModules } from "handsontable/registry";
import { HyperFormula } from "hyperformula";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

registerAllModules();

export default function KaizenTable() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hotRef = useRef<Handsontable | null>(null);

  const [loading, setLoading] = useState(true);
  const [deleteRowIndex, setDeleteRowIndex] = useState<number | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let hot: Handsontable | null = null;
    let hfInstance: HyperFormula | null = null;

    type KaizenRow = {
      id?: string | number | null;
      "Kaizen Name"?: string | number | null;
      Country?: string | number | null;
      Region?: string | number | null;
    };

    async function init() {
      // cleanup old table
      if (hotRef.current) {
        hotRef.current.destroy();
        hotRef.current = null;
      }

      setLoading(true);
      hfInstance = HyperFormula.buildEmpty({ licenseKey: "gpl-v3" });

      try {
        // Call the edge function
        const resp = await api.get("/get-kaizens");

        const headers = (resp.data?.headers as string[] | undefined) ?? [];
        const rows = resp.data?.rows as KaizenRow[] | undefined;

        if (!Array.isArray(rows)) {
          throw new Error("Invalid response: rows missing");
        }

        const tableHeaders = ["Action", ...headers];

        const tableData = rows.map((row) => [
          row.id ?? "",
          row["Kaizen Name"] ?? "",
          row.Country ?? "",
          row.Region ?? "",
        ]);

        const container = containerRef.current;
        if (!container) {
          setLoading(false);
          return;
        }

        hot = new Handsontable(container, {
          data: tableData,
          colHeaders: tableHeaders,
          rowHeaders: true,
          height: 600,
          width: "100%",
          formulas: { engine: hfInstance },
          licenseKey: "non-commercial-and-evaluation",
          fixedColumnsLeft: 1,
          manualColumnResize: true,

          columns: tableHeaders.map((h) => {
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

          afterOnCellMouseDown: (event: MouseEvent, coords: { row: number; col: number }) => {
            if (coords.col !== 0) return;

            if (!hot) return;
            const rowData = hot.getDataAtRow(coords.row);
            const kaizenId = rowData[0];

            if (
              event.target instanceof HTMLElement &&
              event.target.classList.contains("view-btn")
            ) {
              navigate(`/kaizens/${kaizenId}`);
            }

            if (
              event.target instanceof HTMLElement &&
              event.target.classList.contains("delete-btn")
            ) {
              setDeleteRowIndex(coords.row);
              setShowDeletePopup(true);
            }
          },
        });

        hotRef.current = hot;
      } catch (err) {
        console.error("Failed to load kaizens:", err);
      }

      setLoading(false);
    }

    init();

    return () => {
      hotRef.current?.destroy();
      hfInstance?.destroy?.();
    };
  }, [navigate]);

  // -----------------------------
  // DELETE (EDGE FUNCTION)
  // -----------------------------
  const handleConfirmDelete = async () => {
    if (deleteRowIndex == null) return;

    setDeleteLoading(true);

    try {
      if (!hotRef.current) {
        setDeleteLoading(false);
        return;
      }
      const rowData = hotRef.current.getDataAtRow(deleteRowIndex);
      const kaizenId = rowData[0];

      await api.post("/delete-kaizen", { id: kaizenId });

      hotRef.current.alter("remove_row", deleteRowIndex);
      setShowDeletePopup(false);
      setDeleteRowIndex(null);
    } catch (err) {
      console.error("Delete failed", err);
    }

    setDeleteLoading(false);
  };

  return (
    <div>
      {loading && <div>Loading table…</div>}

      <div id="table_wrapper">
        <div ref={containerRef} style={{ width: "100%" }} />
      </div>

      {showDeletePopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>Are you sure?</h3>
            <p>Do you really want to delete this Kaizen?</p>

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
