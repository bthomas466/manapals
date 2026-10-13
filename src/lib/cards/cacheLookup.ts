import type { SupabaseClient } from "@supabase/supabase-js";
import { chunk } from "@/lib/chunk";
import {
  COLLECTION_PAGE_SIZE,
  readAllPagesByKey,
  type PageResponse,
  type ReadResult,
} from "@/lib/collection/read";

// One chunk's encoded `scryfall_id=in.(...)` filter must stay <= 8192 characters
// (about 209 UUIDs at most). Raising this above 209 breaks the URL-bound test by design.
export const CACHE_LOOKUP_CHUNK_SIZE = 200;

export type CardCacheRow = {
  scryfall_id: string;
  name: string;
  set_code: string;
};

export type CacheChunkFetcher = (
  values: string[],
  afterKey: string | null,
  pageSize: number
) => PromiseLike<PageResponse<CardCacheRow>>;

export async function lookupCachedCards(
  values: string[],
  fetchChunkPage: CacheChunkFetcher
): Promise<ReadResult<CardCacheRow>> {
  const byId = new Map<string, CardCacheRow>();

  for (const values_ of chunk(Array.from(new Set(values)), CACHE_LOOKUP_CHUNK_SIZE)) {
    const result = await readAllPagesByKey<CardCacheRow, string>(
      (afterKey) => fetchChunkPage(values_, afterKey, COLLECTION_PAGE_SIZE),
      (r) => r.scryfall_id,
      COLLECTION_PAGE_SIZE
    );
    if (!result.ok) return result;
    for (const row of result.rows) byId.set(row.scryfall_id, row);
  }

  return { ok: true, rows: Array.from(byId.values()) };
}

export function lookupCachedCardsById(
  ids: string[],
  fetchChunkPage: CacheChunkFetcher
): Promise<ReadResult<CardCacheRow>> {
  return lookupCachedCards(ids, fetchChunkPage);
}

export function lookupCachedCardsBySet(
  setCodes: string[],
  fetchChunkPage: CacheChunkFetcher
): Promise<ReadResult<CardCacheRow>> {
  return lookupCachedCards(
    setCodes.map((code) => code.toLowerCase()),
    fetchChunkPage
  );
}

export function supabaseCacheFetcher(
  supabase: SupabaseClient,
  column: "scryfall_id" | "set_code"
): CacheChunkFetcher {
  return (values, afterKey, pageSize) => {
    let query = supabase.from("cards").select("scryfall_id, name, set_code").in(column, values);
    if (afterKey !== null) query = query.gt("scryfall_id", afterKey);
    return query.order("scryfall_id").limit(pageSize).returns<CardCacheRow[]>();
  };
}
