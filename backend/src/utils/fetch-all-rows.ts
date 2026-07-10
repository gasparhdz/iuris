export type FetchAllRowsPagination = {
  limit: number;
  offset: number;
};

export type FetchAllRowsResult<T> = { data: T[] } | T[];

/**
 * Lee todos los resultados de una query paginada en lotes (offset).
 * Si con volumen real la pantalla se vuelve lenta, la optimización futura es
 * agregación SQL — problema de velocidad, no de corrección.
 */
export async function fetchAllRows<T>(
  queryFn: (pagination: FetchAllRowsPagination) => Promise<FetchAllRowsResult<T>>,
  batchSize = 1000,
): Promise<T[]> {
  if (batchSize < 1) throw new Error("fetchAllRows: batchSize must be >= 1");

  const all: T[] = [];
  let offset = 0;

  for (;;) {
    const result = await queryFn({ limit: batchSize, offset });
    const batch = Array.isArray(result) ? result : result.data;
    all.push(...batch);
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  return all;
}
