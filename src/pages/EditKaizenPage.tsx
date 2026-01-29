import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function EditKaizenPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  type KaizenForm = Record<string, string | number | boolean | null>;
  const [form, setForm] = useState<KaizenForm>({});

  // Load Kaizen record (edge function call)
  useEffect(() => {
    async function loadKaizen() {
      setLoading(true);
      try {
        const resp = await api.post("/get-kaizen-by-id", { id });
        setForm(resp.data.kaizen || {});
      } catch (err) {
        console.error("Failed to load kaizen:", err);
      } finally {
        setLoading(false);
      }
    }

    loadKaizen();
  }, [id]);

  // Update field
  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  //  Save Kaizen (EDGE)
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/update-kaizen", {
        id,
        kaizen: form,
      });
      navigate("/kaizens");
    } catch (err) {
      console.error("Failed to save kaizen:", err);
    } finally {
      setSaving(false);
    }
  };

  // Helper: chunk fields into rows
  const chunkArray = (arr: Array<[string, KaizenForm[string]]>, size: number) => {
    const result: Array<Array<[string, KaizenForm[string]]>> = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  if (loading) return <p>Loading...</p>;

  const fields = Object.entries(form) as Array<[string, KaizenForm[string]]>;
  const columnsPerRow = 3;
  const rows = chunkArray(fields, columnsPerRow);

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>Edit Kaizen #{id}</h2>

      <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 12,
            background: "#f9fafb",
            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
          }}
        >
          <h3 style={{ marginBottom: 12, color: "#1e3a8a" }}>Kaizen Details</h3>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {rows.map((row, rowIndex: number) => (
                <tr key={rowIndex}>
                  {row.map(([key, value]) => (
                    <td
                      key={key}
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
                          fontWeight: 600,
                          color: "#333",
                        }}
                      >
                        {key}
                      </label>

                      <input
                        type="text"
                        value={
                          typeof value === "boolean" ? (value ? "true" : "false") : (value ?? "")
                        }
                        onChange={(e) => handleChange(key, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px",
                          border: "1px solid #bbb",
                          borderRadius: "4px",
                        }}
                      />
                    </td>
                  ))}

                  {row.length < columnsPerRow &&
                    Array(columnsPerRow - row.length)
                      .fill(null)
                      .map((_, idx) => (
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
            cursor: "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          onClick={() => navigate("/kaizens")}
          style={{
            background: "#ffffff",
            color: "black",
            padding: "10px 20px",
            borderRadius: "6px",
            border: "1px solid #585858",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
