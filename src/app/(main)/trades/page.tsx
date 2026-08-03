import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAcceptedFriends } from "@/lib/friends/queries";

export default async function TradesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const friends = await getAcceptedFriends(supabase, user.id);

  return (
    <div className="px-4 pt-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-text-primary">Trades</h1>
        <p className="text-sm text-text-secondary">
          Cards you want from friends · cards they want from you.
        </p>
      </header>

      {friends.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-[--radius-card] bg-elevated border border-border flex items-center justify-center text-3xl">
            🤝
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-text-primary">No trade matches yet</p>
            <p className="text-sm text-text-secondary max-w-xs">
              Add friends and import your collection to see trade opportunities.
            </p>
          </div>
          <Link
            href="/profile"
            className="rounded-[--radius-btn] bg-amber px-5 py-3 text-sm font-bold text-page"
          >
            Find Friends
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <Link
              key={friend.friendshipId}
              href={`/trades/${friend.username}`}
              className="flex items-center gap-3 rounded-[--radius-card] bg-elevated border border-border p-3"
            >
              <div className="w-10 h-10 rounded-[--radius-avatar] bg-surface border border-border overflow-hidden flex items-center justify-center text-lg shrink-0">
                {friend.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  "👤"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {friend.display_name}
                </p>
                <p className="text-xs text-text-muted truncate">@{friend.username}</p>
              </div>
              <span className="text-xs font-semibold text-amber shrink-0">View Matches</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
