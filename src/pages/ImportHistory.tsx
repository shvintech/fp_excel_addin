import { useEffect, useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

type HistoryItem = {
  id: string | number;
  layout_id?: string | number;
  sheet_name?: string;
  headers?: unknown[];
  rows?: unknown[];
  created_at?: string | number | Date;
  updated_at?: string | number | Date;
  view_name?: string;
};

export default function ImportHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/get-history?userId=1`);
      setHistory(res.data || []);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  const openLayout = (layoutId: string | number) => {
    navigate(`/import-history/${layoutId}`);
  };

  return (
    <div className="container mt-4">
      <h2 className="fw-bold mb-4">Layout History</h2>

      <div className="card shadow-sm p-3">
        <table className="table table-hover table-bordered">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Layout ID</th>
              <th>Sheet Name</th>
              <th>Total Headers</th>
              <th>Total Rows</th>
              <th>Created</th>
              <th>Updated</th>
              <th>View Name</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center text-muted">
                  Loading History ...
                </td>
              </tr>
            )}

            {!loading && history.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted">
                  No layout history found.
                </td>
              </tr>
            )}

            {history.map((item, index: number) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.layout_id}</td>
                <td>{item.sheet_name}</td>
                <td>{item.headers ? item.headers.length : 0}</td>
                <td>{item.rows ? item.rows.length : 0}</td>
                <td>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</td>
                <td>{item.updated_at ? new Date(item.updated_at).toLocaleString() : ""}</td>
                <td>{item.view_name}</td>
                <td>
                  <button className="btn btn-primary btn-sm" onClick={() => openLayout(item.id)}>
                    View Records
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
