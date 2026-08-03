import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/profile/ensure";
import ProfileEditForm from "@/components/profile/ProfileEditForm";
import FriendSearchBox from "@/components/profile/FriendSearchBox";
import { IncomingRequestActions, OutgoingRequestActions } from "@/components/friends/FriendRequestActions";

type OtherProfile = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const profile = await ensureProfile(supabase, user);

  const { data: friendshipRows } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friendships = friendshipRows ?? [];
  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user.id);

  const otherIds = Array.from(
    new Set(friendships.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)))
  );

  const { data: otherProfilesData } = otherIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", otherIds)
    : { data: [] as OtherProfile[] };

  const profileById = new Map((otherProfilesData ?? []).map((p) => [p.user_id, p]));

  return (
    <div className="px-4 pt-6 space-y-6">
      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-[--radius-avatar] bg-elevated border border-border overflow-hidden flex items-center justify-center text-2xl shrink-0">
          {profile?.avatar_url ?? user.user_metadata?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile?.avatar_url ?? user.user_metadata?.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            "👤"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-text-primary truncate">
            {profile?.display_name ?? user.user_metadata?.full_name ?? user.email ?? "ManaPal"}
          </p>
          {profile ? (
            <ProfileEditForm initialDisplayName={profile.display_name} initialUsername={profile.username} />
          ) : (
            <p className="text-sm text-text-muted truncate">{user.email}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Cards", value: "0" },
          { label: "Friends", value: String(accepted.length) },
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

      {/* Find a friend */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-text-primary">Find a Friend</h2>
        <FriendSearchBox />
      </section>

      {/* Pending requests */}
      {(incoming.length > 0 || outgoing.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-text-primary">Requests</h2>
          <div className="space-y-2">
            {incoming.map((f) => {
              const other = profileById.get(f.requester_id);
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-[--radius-card] bg-elevated border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {other?.display_name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-text-muted truncate">@{other?.username ?? "?"}</p>
                  </div>
                  <IncomingRequestActions friendshipId={f.id} />
                </div>
              );
            })}
            {outgoing.map((f) => {
              const other = profileById.get(f.addressee_id);
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-[--radius-card] bg-elevated border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {other?.display_name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-text-muted truncate">Request sent</p>
                  </div>
                  <OutgoingRequestActions friendshipId={f.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Friends list */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-text-primary">Friends ({accepted.length})</h2>
        {accepted.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No friends yet. Search a username above to connect.
          </p>
        ) : (
          <div className="space-y-2">
            {accepted.map((f) => {
              const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
              const other = profileById.get(otherId);
              if (!other) return null;
              return (
                <Link
                  key={f.id}
                  href={`/u/${other.username}`}
                  className="flex items-center gap-3 rounded-[--radius-card] bg-elevated border border-border p-3"
                >
                  <div className="w-10 h-10 rounded-[--radius-avatar] bg-surface border border-border overflow-hidden flex items-center justify-center text-lg shrink-0">
                    {other.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      "👤"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {other.display_name}
                    </p>
                    <p className="text-xs text-text-muted truncate">@{other.username}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

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
