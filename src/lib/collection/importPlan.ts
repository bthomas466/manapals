import {
  lookupCachedCardsById,
  lookupCachedCardsBySet,
  type CacheChunkFetcher,
  type CardCacheRow,
} from "@/lib/cards/cacheLookup";
import type { NormalizedRow } from "@/lib/csv/manabox";
import type { ScryfallIdentifier } from "@/lib/scryfall/client";

export const CACHE_READ_ERROR = "Couldn't read card data. Nothing was changed — try again shortly.";

export function nameSetKey(name: string, setCode: string): string {
  return `${name.toLowerCase()}::${setCode.toLowerCase()}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function importLookupKeys(rows: NormalizedRow[]): { ids: string[]; setCodes: string[] } {
  const ids = new Set<string>();
  const setCodes = new Set<string>();
  for (const row of rows) {
    // cards.scryfall_id is a uuid column: a malformed id would make Postgres
    // reject the whole query. Skip the cache for those; they still go to Scryfall.
    if (row.scryfallId) {
      if (UUID_RE.test(row.scryfallId)) ids.add(row.scryfallId);
    }
    else setCodes.add(row.setCode.toLowerCase());
  }
  return { ids: Array.from(ids), setCodes: Array.from(setCodes) };
}

export function indexCachedCards(
  byId: CardCacheRow[],
  bySet: CardCacheRow[]
): { cachedById: Map<string, CardCacheRow>; cachedByNameSet: Map<string, CardCacheRow> } {
  const cachedById = new Map<string, CardCacheRow>();
  const cachedByNameSet = new Map<string, CardCacheRow>();
  for (const card of byId) cachedById.set(card.scryfall_id, card);
  for (const card of bySet) cachedByNameSet.set(nameSetKey(card.name, card.set_code), card);
  return { cachedById, cachedByNameSet };
}

// A single physical card can appear on multiple rows (different binders,
// foil vs. nonfoil, etc.), so dedupe before querying Scryfall — otherwise
// the later upsert into the shared `cards` table tries to write the same
// scryfall_id twice in one statement, which Postgres rejects.
export function buildMissingIdentifiers(
  rows: NormalizedRow[],
  cachedById: Map<string, CardCacheRow>,
  cachedByNameSet: Map<string, CardCacheRow>
): ScryfallIdentifier[] {
  const missingIdentifiers: ScryfallIdentifier[] = [];
  const queuedKeys = new Set<string>();
  for (const row of rows) {
    if (row.scryfallId) {
      if (!cachedById.has(row.scryfallId) && !queuedKeys.has(row.scryfallId)) {
        missingIdentifiers.push({ id: row.scryfallId });
        queuedKeys.add(row.scryfallId);
      }
    } else {
      const key = nameSetKey(row.name, row.setCode);
      if (!cachedByNameSet.has(key) && !queuedKeys.has(key)) {
        missingIdentifiers.push({ name: row.name, set: row.setCode.toLowerCase() });
        queuedKeys.add(key);
      }
    }
  }
  return missingIdentifiers;
}

export type PrepareImportResult =
  | {
      ok: true;
      cachedById: Map<string, CardCacheRow>;
      cachedByNameSet: Map<string, CardCacheRow>;
      missingIdentifiers: ScryfallIdentifier[];
    }
  | { ok: false; status: 500; body: { error: string } };

function cacheReadFailure(message: string): PrepareImportResult {
  console.error("card cache lookup failed", { message });
  return { ok: false, status: 500, body: { error: CACHE_READ_ERROR } };
}

export async function prepareImport(
  rows: NormalizedRow[],
  fetchers: { byId: CacheChunkFetcher; bySet: CacheChunkFetcher }
): Promise<PrepareImportResult> {
  const { ids, setCodes } = importLookupKeys(rows);

  const byId = await lookupCachedCardsById(ids, fetchers.byId);
  if (!byId.ok) {
    return cacheReadFailure(byId.error);
  }
  const bySet = await lookupCachedCardsBySet(setCodes, fetchers.bySet);
  if (!bySet.ok) {
    return cacheReadFailure(bySet.error);
  }

  const { cachedById, cachedByNameSet } = indexCachedCards(byId.rows, bySet.rows);
  return {
    ok: true,
    cachedById,
    cachedByNameSet,
    missingIdentifiers: buildMissingIdentifiers(rows, cachedById, cachedByNameSet),
  };
}
