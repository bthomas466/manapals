const SCRYFALL_COLLECTION_URL = "https://api.scryfall.com/cards/collection";
const SCRYFALL_AUTOCOMPLETE_URL = "https://api.scryfall.com/cards/autocomplete";
const SCRYFALL_SEARCH_URL = "https://api.scryfall.com/cards/search";
const BATCH_SIZE = 75;
const REQUEST_DELAY_MS = 110; // stay under Scryfall's 10 req/s limit
const USER_AGENT = "ManaPals/0.1 (+https://manapals.app; contact: bthomas466@gmail.com)";

export type ScryfallIdentifier = { id: string } | { name: string; set: string };

export type ScryfallCardFace = {
  image_uris?: Record<string, string>;
  colors?: string[];
};

export type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  mana_cost?: string;
  cmc?: number;
  type_line: string;
  colors?: string[];
  color_identity?: string[];
  image_uris?: Record<string, string>;
  card_faces?: ScryfallCardFace[];
  prices?: { usd?: string | null; usd_foil?: string | null };
  scryfall_uri?: string;
};

type CollectionResponse = {
  data: ScryfallCard[];
  not_found: ScryfallIdentifier[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getImageUris(card: ScryfallCard): Record<string, string> | undefined {
  return card.image_uris ?? card.card_faces?.[0]?.image_uris;
}

export function getColors(card: ScryfallCard): string[] {
  return card.colors ?? card.card_faces?.[0]?.colors ?? [];
}

export async function fetchCardsByIdentifiers(
  identifiers: ScryfallIdentifier[]
): Promise<{ found: ScryfallCard[]; notFound: ScryfallIdentifier[] }> {
  const found: ScryfallCard[] = [];
  const notFound: ScryfallIdentifier[] = [];

  const batches = chunk(identifiers, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const response = await fetch(SCRYFALL_COLLECTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ identifiers: batch }),
    });

    if (!response.ok) {
      throw new Error(`Scryfall request failed (${response.status})`);
    }

    const result = (await response.json()) as CollectionResponse;
    found.push(...result.data);
    notFound.push(...(result.not_found ?? []));

    if (i < batches.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return { found, notFound };
}

export async function autocompleteCardNames(query: string): Promise<string[]> {
  const url = new URL(SCRYFALL_AUTOCOMPLETE_URL);
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Scryfall autocomplete failed (${response.status})`);
  }

  const result = (await response.json()) as { data: string[] };
  return result.data ?? [];
}

export async function searchPrintings(name: string): Promise<ScryfallCard[]> {
  const url = new URL(SCRYFALL_SEARCH_URL);
  url.searchParams.set("q", `!"${name}"`);
  url.searchParams.set("unique", "prints");
  url.searchParams.set("order", "released");

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Scryfall search failed (${response.status})`);
  }

  const result = (await response.json()) as { data: ScryfallCard[] };
  return result.data ?? [];
}
