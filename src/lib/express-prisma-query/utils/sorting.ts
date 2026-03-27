export type SortItem = { id: string; desc?: boolean };

export const buildPrismaOrderBy = (
  sort: unknown,
  allowedFields?: readonly string[]
) => {
  const items = Array.isArray(sort) ? (sort as SortItem[]) : [];
  const orderBy = items.reduce<Record<string, "asc" | "desc">[]>((acc, s) => {
    if (!s?.id) return acc;
    if (allowedFields && !allowedFields.includes(s.id)) return acc;
    acc.push({ [s.id]: s.desc ? "desc" : "asc" });
    return acc;
  }, []);

  return orderBy.length ? orderBy : undefined;
};

