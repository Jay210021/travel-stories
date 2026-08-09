export type TaxonomyNode = { id: string; parent_id: string | null; sort_order: number };

export function descendantIds<T extends Pick<TaxonomyNode, "id" | "parent_id">>(items: T[], rootId: string) {
  const result = new Set([rootId]); let changed = true;
  while (changed) { changed = false; for (const item of items) if (item.parent_id && result.has(item.parent_id) && !result.has(item.id)) { result.add(item.id); changed = true; } }
  return result;
}

export function reorderSiblings<T extends TaxonomyNode>(items: T[], sourceId: string, targetId: string) {
  const source = items.find((item) => item.id === sourceId); const target = items.find((item) => item.id === targetId);
  if (!source || !target || source.parent_id !== target.parent_id || source.id === target.id) return null;
  const siblings = items.filter((item) => item.parent_id === source.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const sourceIndex = siblings.findIndex((item) => item.id === sourceId); const targetIndex = siblings.findIndex((item) => item.id === targetId);
  const reordered = [...siblings]; const [moved] = reordered.splice(sourceIndex, 1); reordered.splice(targetIndex, 0, moved);
  return reordered.map((item, index) => ({ ...item, sort_order: (index + 1) * 10 }));
}
