import { useMemo, useState } from "react";
import Select, { MultiValue } from "react-select";
import { api } from "../api";

type FieldValue = string;

type GroupConfig = {
  fields: FieldValue[];
  columns: number;
};

type GroupsMap = Record<string, GroupConfig>;

type LayoutEditorProps = {
  layoutId: string | number;
  initialFields: FieldValue[];
  initialGroups: unknown;
};

type Option = { label: string; value: FieldValue };

export default function LayoutEditorComponent({
  layoutId,
  initialFields,
  initialGroups,
}: LayoutEditorProps) {
  // Convert older structure (array only) to new structure (object with fields + columns)
  const normalizeGroups = (groups: unknown): GroupsMap => {
    const updated: GroupsMap = {};
    if (!groups || typeof groups !== "object") {
      return updated;
    }
    Object.keys(groups as Record<string, unknown>).forEach((g) => {
      const value = (groups as Record<string, unknown>)[g];
      if (Array.isArray(value)) {
        updated[g] = { fields: value as FieldValue[], columns: 1 };
      } else if (value && typeof value === "object") {
        const cfg = value as Partial<GroupConfig>;
        updated[g] = {
          fields: Array.isArray(cfg.fields) ? cfg.fields : [],
          columns: typeof cfg.columns === "number" ? cfg.columns : 1,
        };
      } else {
        updated[g] = { fields: [], columns: 1 };
      }
    });
    return updated;
  };

  const [fields] = useState<FieldValue[]>(initialFields);
  const [groups, setGroups] = useState<GroupsMap>(normalizeGroups(initialGroups));
  const [newGroupName, setNewGroupName] = useState<string>("");

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    if (groups[name]) {
      alert("Group already exists");
      return;
    }

    setGroups({
      ...groups,
      [name]: {
        fields: [],
        columns: 1,
      },
    });
    setNewGroupName("");
  };

  const removeGroup = (groupName: string) => {
    const updated = { ...groups };
    delete updated[groupName];
    setGroups(updated);
  };

  const updateGroupFields = (groupName: string, selectedOptions: Option[]) => {
    const selectedValues = selectedOptions.map((opt) => opt.value);

    const updated: GroupsMap = {};

    Object.keys(groups).forEach((g) => {
      if (g === groupName) {
        updated[g] = {
          ...groups[g],
          fields: selectedValues,
        };
      } else {
        updated[g] = {
          ...groups[g],
          fields: groups[g].fields.filter((f) => !selectedValues.includes(f)),
        };
      }
    });

    setGroups(updated);
  };

  const updateGroupColumns = (groupName: string, value: string | number) => {
    const num = Number(value);
    if (num < 1) return;

    setGroups({
      ...groups,
      [groupName]: {
        ...groups[groupName],
        columns: num,
      },
    });
  };

  const save = async () => {
    const res = await api.post("/update-layout", {
      layout_id: layoutId,
      groups,
    });

    if (res.data.error) alert("Save failed: " + res.data.error);
    else alert("Layout saved!");
  };

  const fieldOptions: Option[] = useMemo(
    () =>
      fields.map((f) => ({
        label: f,
        value: f,
      })),
    [fields]
  );

  return (
    <div className="container py-4">
      <h1 className="fw-bold mb-4">Layout Editor #{layoutId}</h1>

      {/* Add Group */}
      <div className="card p-3 mb-4 shadow-sm">
        <h5 className="fw-semibold mb-3">Add New Group</h5>

        <div className="d-flex gap-2">
          <input
            className="form-control"
            placeholder="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <button className="btn btn-success" onClick={addGroup}>
            Add
          </button>
        </div>
      </div>

      {/* Groups List */}
      {Object.keys(groups).map((groupName) => (
        <div key={groupName} className="card p-3 mb-3 shadow-sm">
          <div className="d-flex justify-content-between mb-2">
            <div className="d-flex justify-content-between gap-5 align-items-center">
              <h6 style={{ marginBottom: 0 }}>{groupName}</h6>
              <input
                type="number"
                className="form-control mt-1"
                value={groups[groupName].columns}
                placeholder="Number of Columns"
                onChange={(e) => updateGroupColumns(groupName, e.target.value)}
              />
            </div>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => removeGroup(groupName)}
            >
              Remove
            </button>
          </div>

          <Select
            isMulti
            options={fieldOptions}
            value={groups[groupName].fields.map((f) => ({
              label: f,
              value: f,
            }))}
            onChange={(selected: MultiValue<Option>) => updateGroupFields(groupName, [...selected])}
          />
        </div>
      ))}

      <button className="btn btn-primary w-100 mt-3" onClick={save}>
        Save Layout
      </button>
    </div>
  );
}
