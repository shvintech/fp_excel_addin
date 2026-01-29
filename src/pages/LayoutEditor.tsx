import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import LayoutEditorComponent from "../components/LayoutEditorComponent";

type LayoutDetail = {
  id: string | number;
  fields?: string[];
  groups?: Record<string, unknown>;
};

export default function LayoutEditor() {
  const { id } = useParams<{ id: string }>();
  const [layout, setLayout] = useState<LayoutDetail | null>(null);

  useEffect(() => {
    const loadLayout = async () => {
      const res = await api.get(`/get-single-layout?layout_id=${id}`);
      const data = res.data as LayoutDetail;
      setLayout(data);
    };
    loadLayout();
  }, [id]);

  if (!layout) return <div className="text-center mt-5">Loading...</div>;

  return (
    <LayoutEditorComponent
      layoutId={layout.id}
      initialFields={layout.fields || []}
      initialGroups={layout.groups || {}}
    />
  );
}
