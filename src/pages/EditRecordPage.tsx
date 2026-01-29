import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function EditRecordPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  type FormState = Record<string, string | number | boolean | null>;
  type ColumnGroup = { fields: string[]; columns: number };
  type ColumnGroups = Record<string, ColumnGroup>;

  const [form, setForm] = useState<FormState>({});
  const [columnGroups, setColumnGroups] = useState<ColumnGroups>({});

  // ------------------------------
  // 1️⃣ Load the record
  // ------------------------------
  useEffect(() => {
    async function loadRecord() {
      setLoading(true);
      try {
        const resp = await api.post("/get-record-by-id", { record_id: id });
        setForm(resp.data.record);
      } catch (err) {
        console.error("Failed to load record:", err);
      } finally {
        setLoading(false);
      }
    }
    loadRecord();
  }, [id]);

  // ------------------------------
  // 2️⃣ Load layout (groups)
  // ------------------------------
  useEffect(() => {
    async function loadLayout() {
      if (form.layoutId) {
        try {
          const resp = await api.get(`/get-single-layout?layout_id=${form.layoutId}`);
          setColumnGroups(resp.data.groups);
        } catch (err) {
          console.error("Failed to load layout:", err);
        }
      }
    }
    loadLayout();
  }, [form]);

  // ------------------------------
  // 3️⃣ Update field
  // ------------------------------
  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ------------------------------
  // 4️⃣ Save (UPDATE API)
  // ------------------------------
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/update-record", {
        record_id: id,
        data: form,
      });
      navigate("/records");
    } catch (err) {
      console.error("Failed to save record:", err);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------
  // Helper: split array into chunks
  // ------------------------------
  const chunkArray = (arr: string[], size: number) => {
    const result: string[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  // ------------------------------
  // 5️⃣ UI
  // ------------------------------
  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Edit Record #{id}</h2>

      <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
        {columnGroups &&
          Object.entries(columnGroups).map(([groupName, cols]) => {
            const rows = chunkArray(cols.fields || [], cols.columns || 1);

            return (
              <div
                key={groupName}
                style={{
                  marginBottom: 24,
                  padding: 16,
                  borderRadius: 12,
                  background: "#f9fafb",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                }}
              >
                <h3 style={{ marginBottom: 12, color: "#1e3a8a" }}>{groupName}</h3>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {rows.map((rowFields, rowIndex: number) => (
                      <tr key={rowIndex}>
                        {rowFields.map((col) => (
                          <td
                            key={col}
                            style={{
                              padding: "8px",
                              border: "1px solid #ccc",
                              verticalAlign: "top",
                            }}
                          >
                            <label
                              style={{
                                display: "block",
                                marginBottom: 4,
                                fontSize: 14,
                                color: "#333",
                              }}
                            >
                              {col}
                            </label>
                            <input
                              type="text"
                              value={
                                typeof form[col] === "boolean"
                                  ? form[col]
                                    ? "true"
                                    : "false"
                                  : (form[col] ?? "")
                              }
                              onChange={(e) => handleChange(col, e.target.value)}
                              style={{
                                width: "100%",
                                padding: "6px",
                                border: "1px solid #bbb",
                                borderRadius: "4px",
                              }}
                            />
                          </td>
                        ))}

                        {rowFields.length < cols.columns &&
                          Array(cols.columns - rowFields.length)
                            .fill(null)
                            .map((_, idx: number) => (
                              <td
                                key={`empty-${idx}`}
                                style={{
                                  padding: "8px",
                                  border: "1px solid #ccc",
                                }}
                              />
                            ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
      </div>

      <div
        style={{
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          marginTop: 20,
        }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: "#007bff",
            color: "white",
            padding: "10px 20px",
            borderRadius: "6px",
            border: "none",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          onClick={() => navigate("/records")}
          style={{
            background: "#ffffff",
            color: "black",
            padding: "10px 20px",
            borderRadius: "6px",
            border: "1px solid #585858",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
