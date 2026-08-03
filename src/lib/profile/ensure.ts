import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type Profile = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  collection_visibility: "friends" | "public";
};

const PROFILE_COLUMNS = "user_id, username, display_name, avatar_url, collection_visibility";

/**
 * Returns the user's profile, lazily provisioning one for accounts that
 * predate the `handle_new_user` signup trigger.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
): Promise<Profile | null> {
  const { data: existing } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return existing as Profile;

  const base =
    (user.email?.split("@")[0] ?? "player").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) ||
    "player";
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "ManaPal";
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  const admin = createAdminClient();
  for (let attempt = 0; attempt <= 5; attempt++) {
    const candidate =
      attempt === 0 ? base : `${base.slice(0, 15)}_${Math.floor(Math.random() * 10 ** attempt)}`;
    const { data, error } = await admin
      .from("profiles")
      .insert({ user_id: user.id, username: candidate, display_name: displayName, avatar_url: avatarUrl })
      .select(PROFILE_COLUMNS)
      .single();
    if (!error) return data as Profile;
    if (error.code !== "23505") return null;
  }
  return null;
}
