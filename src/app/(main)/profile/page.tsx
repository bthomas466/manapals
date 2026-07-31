import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  return (
    <div className="px-4 pt-6 space-y-6">
      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-[--radius-avatar] bg-elevated border border-border overflow-hidden flex items-center justify-center text-2xl shrink-0">
          {user.user_metadata?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            "👤"
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-text-primary truncate">
            {user.user_metadata?.full_name ?? user.email ?? "ManaPal"}
          </p>
          <p className="text-sm text-text-muted truncate">{user.email}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Cards", value: "0" },
          { label: "Friends", value: "0" },
          { label: "Trades", value: "0" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-[--radius-card] bg-elevated border border-border p-3 text-center"
          >
            <p className="text-xl font-extrabold text-text-primary">{value}</p>
            <p className="text-xs text-text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Sign out */}
      <SignOutButton />

      <p className="text-center text-xs text-text-muted pt-4">
        ManaPals is not affiliated with Manabox or SkillDevs SC.
      </p>
    </div>
  );
}

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();
        await supabase.auth.signOut();
        const { redirect } = await import("next/navigation");
        redirect("/sign-in");
      }}
    >
      <button
        type="submit"
        className="w-full rounded-[--radius-btn] border border-border bg-elevated py-3 text-sm font-semibold text-text-secondary"
      >
        Sign out
      </button>
    </form>
  );
}
