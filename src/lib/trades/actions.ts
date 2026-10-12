"use server";

import { createClient } from "@/lib/supabase/server";
import { isTradeStatus, type TradeStatus } from "@/lib/trades/flags";

type ActionResult = { ok: boolean; updated?: number; error?: string };

const FAILED = "Couldn't update trade status";

function validStatus(status: unknown): status is TradeStatus | null {
  return status === null || isTradeStatus(status);
}

// No refresh()/revalidatePath() on purpose: it would re-send every collection
// row on each tap. The client keeps local overrides; /trades is dynamic.
export async function setItemTradeStatus(
  itemId: number,
  status: TradeStatus | null
): Promise<ActionResult> {
  if (!Number.isInteger(itemId) || itemId <= 0 || !validStatus(status)) {
    return { ok: false, error: FAILED };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("collection_items")
    .update({ trade_status: status })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data || data.length === 0) return { ok: false, error: FAILED };
  return { ok: true };
}

export async function setBinderTradeStatus(
  binderName: string,
  status: TradeStatus | null
): Promise<ActionResult> {
  if (typeof binderName !== "string" || binderName.trim() === "" || !validStatus(status)) {
    return { ok: false, error: FAILED };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error, count } = await supabase
    .from("collection_items")
    .update({ trade_status: status }, { count: "exact" })
    .eq("user_id", user.id)
    .eq("binder_name", binderName);

  if (error) return { ok: false, error: FAILED };
  return { ok: true, updated: count ?? 0 };
}
