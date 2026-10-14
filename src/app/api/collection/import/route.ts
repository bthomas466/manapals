import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCardsByIdentifiers, type ScryfallCard } from "@/lib/scryfall/client";
import { upsertCards } from "@/lib/scryfall/cardRow";
import type { NormalizedRow } from "@/lib/csv/manabox";
import { supabaseCacheFetcher, type CardCacheRow } from "@/lib/cards/cacheLookup";
import { nameSetKey, prepareImport } from "@/lib/collection/importPlan";

type UnmatchedRow = { name: string; setCode: string };

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

  const prep = await prepareImport(rows, {
    byId: supabaseCacheFetcher(supabase, "scryfall_id"),
    bySet: supabaseCacheFetcher(supabase, "set_code"),
  });
  if (!prep.ok) {
    return NextResponse.json(prep.body, { status: prep.status });
  }
  const { cachedById, cachedByNameSet, missingIdentifiers } = prep;

  if (missingIdentifiers.length > 0) {
    let found: ScryfallCard[];
    try {
      ({ found } = await fetchCardsByIdentifiers(missingIdentifiers));
    } catch (error) {
      console.error(
        "Scryfall enrichment failed during import:",
        error instanceof Error ? error.message : error
      );
      return NextResponse.json(
        { error: "Couldn't reach Scryfall to enrich card data. Nothing was changed — try again shortly." },
        { status: 502 }
      );
    }

    if (found.length > 0) {
      // Defense in depth: even with deduped identifiers above, guard against
      // duplicate scryfall_ids in the upsert batch (e.g. two differently
      // formatted identifiers resolving to the same card).
      const uniqueFound = Array.from(new Map(found.map((card) => [card.id, card])).values());

      try {
        await upsertCards(uniqueFound);
      } catch (upsertError) {
        console.error("Failed to upsert enriched cards:", upsertError);
        return NextResponse.json(
          { error: "Failed to save card data. Nothing was changed — try again shortly." },
          { status: 500 }
        );
      }
      for (const card of uniqueFound) {
        const cardRow: CardCacheRow = { scryfall_id: card.id, name: card.name, set_code: card.set };
        cachedById.set(card.id, cardRow);
        cachedByNameSet.set(nameSetKey(card.name, card.set), cardRow);
      }
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

  // Best-effort: a successful import finishes onboarding (no-op once onboarded).
  const { error: markError } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("onboarded_at", null);
  if (markError) console.error("Failed to mark onboarding complete:", markError.message);

  return NextResponse.json({
    imported: resolvedRows.length,
    unmatched,
    totalRows: rows.length,
  });
}
