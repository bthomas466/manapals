import type { SupabaseClient } from "@supabase/supabase-js";

export type Friend = {
  friendshipId: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export async function getAcceptedFriends(supabase: SupabaseClient, userId: string): Promise<Friend[]> {
  const { data: friendshipRows } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  const rows = friendshipRows ?? [];
  if (rows.length === 0) return [];

  const otherIds = rows.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .in("user_id", otherIds);

  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return rows
    .map((f) => {
      const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
      const profile = profileById.get(otherId);
      if (!profile) return null;
      return { friendshipId: f.id as number, ...profile };
    })
    .filter((f): f is Friend => f !== null);
}
