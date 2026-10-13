import type { SupabaseClient } from "@supabase/supabase-js";
import { COLLECTION_PAGE_SIZE, readAllPages, type ReadResult } from "./read";

// Reads every collection_items row for one user, paging past PostgREST's max_rows cap.
export async function getCollectionItems<T extends { id: number }>(
  supabase: SupabaseClient,
  userId: string,
  columns: string
): Promise<ReadResult<T>> {
  const result = await readAllPages<T>((afterId, pageSize) => {
    let query = supabase
      .from("collection_items")
      .select(columns)
      // RLS also lets you read friends' and public collections, so always filter by user.
      .eq("user_id", userId);
    if (afterId !== null) query = query.gt("id", afterId);
    return query.order("id").limit(pageSize).returns<T[]>();
  }, COLLECTION_PAGE_SIZE);

  if (!result.ok) {
    console.error("collection read failed", { userId, message: result.error });
  }
  return result;
}
