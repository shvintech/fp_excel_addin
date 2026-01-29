import React, { useRef, useState } from "react";
import { api } from "../api";

type UploadExcelProps = {
  onUploaded?: () => void;
};

export default function UploadExcel({ onUploaded }: UploadExcelProps) {
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [viewName, setViewName] = useState("View Table");

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const upload = async () => {
    if (!file) return alert("Choose a file");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("view_name", viewName);
    try {
      setLoading(true);
      const resp = await api.post("/excel-import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (onUploaded) {
        onUploaded();
      }
      if (resp.data.total_rows !== undefined) {
        alert(`Inserted ${resp.data.total_rows} rows`);
      } else {
        alert(resp.data.message);
      }
    } catch (err: unknown) {
      console.error(err);
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      alert(error?.response?.data?.error || error?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dragger-container">
      <div
        className={`dragger-area ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {file ? <p>📄 {file.name}</p> : <p>Drag & Drop your Excel file here, or click to select</p>}
      </div>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        ref={inputRef}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <button className="upload-btn" onClick={upload} disabled={!file || loading}>
        {loading ? <div className="loader"></div> : "Upload"}
      </button>
      <div style={{ minWidth: "200px" }}>
        <label style={{ fontWeight: "bold" }}>View Name</label>
        <select
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          style={{
            marginTop: "5px",
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        >
          <option value="View Table">View Table</option>
          <option value="Kaizen Records">Kaizen Records</option>
        </select>
      </div>
    </div>
  );
}
