// utils/groupByType.ts
import { DropdownValue } from "../utilities/type";

export const groupByType = (data: DropdownValue[]) => {
  return data.reduce<Record<string, DropdownValue[]>>((acc, item) => {
    acc[item.table_type] = acc[item.table_type] || [];
    acc[item.table_type].push(item);
    return acc;
  }, {});
};
