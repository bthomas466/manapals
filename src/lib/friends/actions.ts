"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

export async function sendFriendRequest(targetUserId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === targetUserId) return { error: "You can't friend yourself." };

  const { error } = await supabase.from("friendships").insert({
    requester_id: user.id,
    addressee_id: targetUserId,
  });

  if (error) {
    if (error.code === "23505") return { error: "Already friends or a request is pending." };
    return { error: "Couldn't send friend request." };
  }
  return {};
}

export async function respondToFriendRequest(
  friendshipId: number,
  accept: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (accept) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", friendshipId);
    if (error) return { error: "Couldn't accept request." };
    return {};
  }

  return removeFriendship(friendshipId);
}

export async function removeFriendship(friendshipId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) return { error: "Couldn't remove." };
  return {};
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const displayName = (formData.get("display_name") as string | null)?.trim();
  const usernameRaw = (formData.get("username") as string | null)?.trim().toLowerCase();

  if (!displayName) return { error: "Display name is required." };
  if (!usernameRaw || !/^[a-z0-9_]{3,20}$/.test(usernameRaw)) {
    return { error: "Username must be 3-20 characters: lowercase letters, numbers, underscores." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, username: usernameRaw })
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "That username is taken." };
    return { error: "Couldn't update profile." };
  }
  return {};
}

export async function findProfileByUsername(
  username: string
): Promise<{ username: string; display_name: string } | null> {
  const supabase = await createClient();
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) return null;

  const { data } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("username", clean)
    .maybeSingle();

  return data ?? null;
}
