import { useState, useCallback } from "react";

export function useBatchMode(items: any[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  return {
    selectedIds: Array.from(selectedIds),
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    selectedCount: selectedIds.size,
  };
}
