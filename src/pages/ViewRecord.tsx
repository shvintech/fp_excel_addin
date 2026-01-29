import { useParams } from "react-router-dom";
import CustTable from "../components/CustTable";

export default function ViewRecord() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h2>Records</h2>

      <CustTable history_id={id} />
    </div>
  );
}
