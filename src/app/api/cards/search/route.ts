import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { autocompleteCardNames, searchPrintings } from "@/lib/scryfall/client";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  try {
    if (mode === "autocomplete") {
      const q = searchParams.get("q")?.trim() ?? "";
      if (q.length < 2) return NextResponse.json({ names: [] });
      const names = await autocompleteCardNames(q);
      return NextResponse.json({ names });
    }

    if (mode === "printings") {
      const name = searchParams.get("name")?.trim() ?? "";
      if (!name) return NextResponse.json({ printings: [] });
      const printings = await searchPrintings(name);
      return NextResponse.json({ printings });
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (error) {
    console.error("Card search failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't reach Scryfall. Try again shortly." }, { status: 502 });
  }
}
