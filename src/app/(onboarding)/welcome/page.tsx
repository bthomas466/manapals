import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile/ensure";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const profile = await ensureProfile(supabase, user);
  if (!profile || profile.onboarded_at) redirect("/collection");

  const { data: existing, error: existingError } = await supabase
    .from("collection_items")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 py-6">
      <OnboardingWizard
        displayName={profile.display_name}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        hasExistingCards={!!existingError || (existing ?? []).length > 0}
      />
    </main>
  );
}
