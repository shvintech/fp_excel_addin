import { useEffect, useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

type LayoutSummary = {
  id: string | number;
  fields?: unknown[];
  groups?: Record<string, unknown>;
};

export default function LayoutList() {
  const [layouts, setLayouts] = useState<LayoutSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadLayouts();
  }, []);

  const loadLayouts = async () => {
    const res = await api.get("/get-layout?userId=1");
    const data = res.data;

    // Convert object {0:{},1:{}} into array
    const layoutArray = Object.keys(data).map((key) => data[key]) as LayoutSummary[];
    setLayouts(layoutArray);
  };

  return (
    <div className="container py-4">
      <h1 className="fw-bold mb-4">All Layouts</h1>

      <div className="list-group">
        {layouts.map((layout) => (
          <div
            key={layout.id}
            className="list-group-item d-flex justify-content-between align-items-center"
          >
            <div>
              <strong>Layout #{layout.id}</strong>
              <br />
              <span className="text-muted">
                Fields: {layout.fields?.length || 0} | Groups:{" "}
                {layout.groups ? Object.keys(layout.groups).length : 0}
              </span>
            </div>

            <button className="btn btn-primary" onClick={() => navigate(`/layouts/${layout.id}`)}>
              Manage
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
