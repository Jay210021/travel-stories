export type ClassificationTaxon = { id: string; label: string; parent_id: string | null };

export function assignedClassificationLabels(
  assignedIds: readonly string[],
  taxaById: ReadonlyMap<string, ClassificationTaxon>,
) {
  const parentIds = new Set(assignedIds.map((id) => taxaById.get(id)?.parent_id).filter((id): id is string => Boolean(id)));
  const display = assignedIds
    .filter((id) => !parentIds.has(id))
    .map((id) => taxaById.get(id)?.label)
    .filter((label): label is string => Boolean(label));
  const search = new Set<string>();
  for (const id of assignedIds) {
    let taxon = taxaById.get(id);
    const visited = new Set<string>();
    while (taxon && !visited.has(taxon.id)) {
      visited.add(taxon.id);
      search.add(taxon.label);
      taxon = taxon.parent_id ? taxaById.get(taxon.parent_id) : undefined;
    }
  }
  return { display: [...new Set(display)], search: [...search] };
}
