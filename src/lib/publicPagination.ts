export function publicFilteredPageMeta(docs: unknown[], limit: number, page?: number) {
  const totalDocs = Array.isArray(docs) ? docs.length : 0
  return {
    totalDocs,
    page: Math.max(Number(page || 1), 1),
    totalPages: totalDocs > 0 ? 1 : 0,
    limit,
  }
}
