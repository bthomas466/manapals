import Link from "next/link";

export default function MainNotFound() {
  return (
    <div className="px-4">
      <div className="flex flex-col items-center justify-center pt-16 gap-4 text-center motion-safe:animate-[settle_250ms_ease-out_both]">
        <div
          aria-hidden="true"
          className="w-16 h-16 rounded-[--radius-card] bg-elevated border border-border flex items-center justify-center text-3xl"
        >
          🔍
        </div>
        <div className="space-y-1">
          <h1 className="font-semibold text-text-primary">No ManaPal here</h1>
          <p className="text-sm text-text-secondary max-w-xs">
            We couldn&apos;t find that username. Check the spelling, or find your friend from Profile.
          </p>
        </div>
        <Link
          href="/profile"
          className="inline-flex min-h-11 items-center rounded-[--radius-btn] bg-amber px-5 text-sm font-bold text-page transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          Find a friend
        </Link>
      </div>
    </div>
  );
}
