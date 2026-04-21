export function filterRows(rows, search, fields) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return rows;
  }

  return rows.filter((row) =>
    fields.some((field) =>
      String(row[field] ?? "")
        .toLowerCase()
        .includes(normalizedSearch)
    )
  );
}
