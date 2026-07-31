import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchCardsByIdentifiers,
  getColors,
  getImageUris,
  type ScryfallCard,
  type ScryfallIdentifier,
} from "@/lib/scryfall/client";
import type { NormalizedRow } from "@/lib/csv/manabox";

type CardRow = {
  scryfall_id: string;
  name: string;
  set_code: string;
};

type UnmatchedRow = { name: string; setCode: string };

function nameSetKey(name: string, setCode: string): string {
  return `${name.toLowerCase()}::${setCode.toLowerCase()}`;
}

function toCardInsert(card: ScryfallCard) {
  const images = getImageUris(card);
  return {
    scryfall_id: card.id,
    oracle_id: card.oracle_id ?? null,
    name: card.name,
    set_code: card.set,
    set_name: card.set_name,
    collector_number: card.collector_number,
    rarity: card.rarity,
    mana_cost: card.mana_cost ?? null,
    cmc: card.cmc ?? null,
    type_line: card.type_line,
    colors: getColors(card),
    color_identity: card.color_identity ?? [],
    image_small: images?.small ?? null,
    image_normal: images?.normal ?? null,
    price_usd: card.prices?.usd ? Number(card.prices.usd) : null,
    price_usd_foil: card.prices?.usd_foil ? Number(card.prices.usd_foil) : null,
    scryfall_uri: card.scryfall_uri ?? null,
    raw_data: card,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { rows?: NormalizedRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rows = body.rows ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  const scryfallIds = rows.filter((r) => r.scryfallId).map((r) => r.scryfallId as string);
  const setCodes = Array.from(
    new Set(rows.filter((r) => !r.scryfallId).map((r) => r.setCode.toLowerCase()))
  );

  const cachedById = new Map<string, CardRow>();
  const cachedByNameSet = new Map<string, CardRow>();

  if (scryfallIds.length > 0) {
    const { data } = await supabase
      .from("cards")
      .select("scryfall_id, name, set_code")
      .in("scryfall_id", scryfallIds);
    for (const card of data ?? []) {
      cachedById.set(card.scryfall_id, card);
    }
  }

  if (setCodes.length > 0) {
    const { data } = await supabase
      .from("cards")
      .select("scryfall_id, name, set_code")
      .in("set_code", setCodes);
    for (const card of data ?? []) {
      cachedByNameSet.set(nameSetKey(card.name, card.set_code), card);
    }
  }

  const missingIdentifiers: ScryfallIdentifier[] = [];
  for (const row of rows) {
    if (row.scryfallId) {
      if (!cachedById.has(row.scryfallId)) {
        missingIdentifiers.push({ id: row.scryfallId });
      }
    } else if (!cachedByNameSet.has(nameSetKey(row.name, row.setCode))) {
      missingIdentifiers.push({ name: row.name, set: row.setCode.toLowerCase() });
    }
  }

  if (missingIdentifiers.length > 0) {
    try {
      const { found } = await fetchCardsByIdentifiers(missingIdentifiers);

      if (found.length > 0) {
        const admin = createAdminClient();
        const { error: upsertError } = await admin
          .from("cards")
          .upsert(found.map(toCardInsert), { onConflict: "scryfall_id" });
        if (upsertError) {
          throw new Error(upsertError.message);
        }
        for (const card of found) {
          const cardRow: CardRow = { scryfall_id: card.id, name: card.name, set_code: card.set };
          cachedById.set(card.id, cardRow);
          cachedByNameSet.set(nameSetKey(card.name, card.set), cardRow);
        }
      }
    } catch {
      return NextResponse.json(
        { error: "Couldn't reach Scryfall to enrich card data. Nothing was changed — try again shortly." },
        { status: 502 }
      );
    }
  }

  const unmatched: UnmatchedRow[] = [];
  const resolvedRows: Array<{
    card_id: string;
    quantity: number;
    finish: string;
    condition: string;
    language: string;
    binder_name: string;
    manabox_id: string | null;
  }> = [];

  for (const row of rows) {
    const cached = row.scryfallId
      ? cachedById.get(row.scryfallId)
      : cachedByNameSet.get(nameSetKey(row.name, row.setCode));

    if (!cached) {
      unmatched.push({ name: row.name, setCode: row.setCode });
      continue;
    }

    resolvedRows.push({
      card_id: cached.scryfall_id,
      quantity: row.quantity,
      finish: row.finish,
      condition: row.condition,
      language: row.language,
      binder_name: row.binderName,
      manabox_id: row.manaboxId,
    });
  }

  if (resolvedRows.length === 0) {
    return NextResponse.json(
      {
        error:
          "None of the rows in this file could be matched to Scryfall. Nothing was changed — check the file and try again.",
      },
      { status: 422 }
    );
  }

  const { error: rpcError } = await supabase.rpc("replace_collection_items", {
    p_items: resolvedRows,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: "Import failed, nothing was changed." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    imported: resolvedRows.length,
    unmatched,
    totalRows: rows.length,
  });
}
