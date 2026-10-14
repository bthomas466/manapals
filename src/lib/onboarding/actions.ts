"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileSaveError, validateProfileInput } from "@/lib/profile/validate";

type ActionResult = { error?: string };

/** Step 1: saves display name, username and (optionally) clears the avatar. Never sets the marker. */
export async function saveOnboardingProfile(input: {
  displayName: string;
  username: string;
  removeAvatar: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const result = validateProfileInput(input);
  if (!result.ok) return { error: result.error };

  const update: { display_name: string; username: string; avatar_url?: null } = {
    display_name: result.value.displayName,
    username: result.value.username,
  };
  if (input.removeAvatar === true) update.avatar_url = null;

  const { error } = await supabase.from("profiles").update(update).eq("user_id", user.id);
  if (error) return { error: profileSaveError(error.code) };
  return {};
}

/** Sets the onboarding marker (idempotent) and sends the user to /collection. */
export async function completeOnboarding(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("onboarded_at", null);
  if (error) return { error: "Couldn't finish setup. Try again." };

  redirect("/collection");
}
