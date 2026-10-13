// Must be <= PostgREST `max_rows` (1000 on config.toml and both hosted projects).
// The loop stops on a short page, so a page size above max_rows would silently truncate.
// Lowering this is always safe; never raise it without raising max_rows.
export const COLLECTION_PAGE_SIZE = 1000;

export type ReadResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

export type PageResponse<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function readAllPagesByKey<T, K extends number | string>(
  fetchPage: (afterKey: K | null, pageSize: number) => PromiseLike<PageResponse<T>>,
  keyOf: (row: T) => K,
  pageSize: number = COLLECTION_PAGE_SIZE
): Promise<ReadResult<T>> {
  const rows: T[] = [];
  let afterKey: K | null = null;

  for (;;) {
    const { data, error } = await fetchPage(afterKey, pageSize);
    if (error || !data) return { ok: false, error: error?.message ?? "No data returned" };

    rows.push(...data);
    if (data.length < pageSize) return { ok: true, rows };

    const lastKey: K = keyOf(data[data.length - 1]);
    if (afterKey !== null && lastKey <= afterKey) {
      return { ok: false, error: "Paging did not advance" };
    }
    afterKey = lastKey;
  }
}

export function readAllPages<T extends { id: number }>(
  fetchPage: (afterId: number | null, pageSize: number) => PromiseLike<PageResponse<T>>,
  pageSize: number = COLLECTION_PAGE_SIZE
): Promise<ReadResult<T>> {
  return readAllPagesByKey(fetchPage, (r) => r.id, pageSize);
}

export type CollectionPageState<T> = { kind: "error" } | { kind: "ready"; items: T[] };

export function collectionPageState<T>(result: ReadResult<T>): CollectionPageState<T> {
  return result.ok ? { kind: "ready", items: result.rows } : { kind: "error" };
}
