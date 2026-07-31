"use client";

import { createClient } from "@/lib/supabase/client";

async function signInWithProvider(provider: "google" | "apple") {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    },
  });
}

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / wordmark */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-[--radius-card] bg-elevated border border-border flex items-center justify-center">
            <span className="text-3xl">🃏</span>
          </div>
          <h1 className="text-2xl font-extrabold text-text-primary">
            ManaPals
          </h1>
          <p className="text-sm text-text-secondary">
            Your collection. Your crew. Your trades.
          </p>
        </div>

        {/* Auth buttons */}
        <div className="space-y-3">
          <button
            onClick={() => signInWithProvider("google")}
            className="flex w-full items-center justify-center gap-3 rounded-[--radius-btn] bg-elevated border border-border px-4 py-3.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface active:scale-[0.98]"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <button
            onClick={() => signInWithProvider("apple")}
            className="flex w-full items-center justify-center gap-3 rounded-[--radius-btn] bg-elevated border border-border px-4 py-3.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface active:scale-[0.98]"
          >
            <AppleIcon />
            Continue with Apple
          </button>
        </div>

        <p className="text-center text-xs text-text-muted px-4">
          ManaPals is not affiliated with Manabox or SkillDevs SC.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="currentColor"
      aria-hidden
    >
      <path d="M14.045 9.573c-.02-2.055 1.677-3.048 1.752-3.095-1.005-1.42-2.466-1.585-2.974-1.602-1.244-.128-2.454.744-3.088.744-.648 0-1.623-.73-2.676-.71-1.35.02-2.614.8-3.31 2.006-1.43 2.457-.363 6.08 1.007 8.069.684.975 1.49 2.065 2.545 2.026 1.028-.04 1.41-.655 2.648-.655 1.228 0 1.575.655 2.647.631 1.104-.019 1.798-.979 2.466-1.962.79-1.12 1.108-2.222 1.122-2.278-.026-.01-2.14-.82-2.139-3.174ZM11.957 3.37c.549-.673.921-1.6.82-2.537-.793.033-1.784.534-2.36 1.193-.505.585-.955 1.539-.837 2.445.892.066 1.81-.456 2.377-1.101Z" />
    </svg>
  );
}
