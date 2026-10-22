"use client";

import { useState, useTransition } from "react";
import { saveOnboardingProfile } from "@/lib/onboarding/actions";
import { normalizeUsernameInput, PROFILE_SAVE_FAILED } from "@/lib/profile/validate";
import FieldError from "@/components/ui/FieldError";
import type { WizardProfile } from "./OnboardingWizard";

const inputClass =
  "min-h-11 w-full rounded-[--radius-chip] border border-border bg-elevated px-3 text-base text-text-primary";

export default function ProfileStep({
  initial,
  onSaved,
}: {
  initial: WizardProfile;
  onSaved: (profile: WizardProfile) => void;
}) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await saveOnboardingProfile({ displayName, username, removeAvatar });
        if (result.error) {
          setError(result.error);
          return;
        }
        setError(null);
        onSaved({
          displayName: displayName.trim(),
          username: username.trim().toLowerCase(),
          avatarUrl: removeAvatar ? null : avatarUrl,
        });
      } catch {
        setError(PROFILE_SAVE_FAILED);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-text-primary">Welcome to ManaPals</h1>
        <p className="text-sm text-text-secondary">Set up your profile.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[--radius-avatar] border border-border bg-elevated text-2xl">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Your profile photo" className="h-full w-full object-cover" />
          ) : (
            "👤"
          )}
        </div>
        {avatarUrl && (
          <button
            type="button"
            onClick={() => {
              setAvatarUrl(null);
              setRemoveAvatar(true);
            }}
            className="min-h-11 text-sm font-semibold text-amber"
          >
            Remove photo
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="display-name" className="text-sm font-semibold text-text-secondary">
          Display name
        </label>
        <input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="username" className="text-sm font-semibold text-text-secondary">
          Username
        </label>
        <div className="focus-ring-within flex min-h-11 items-center gap-1 rounded-[--radius-chip] border border-border bg-elevated px-3">
          <span className="text-base text-text-secondary">@</span>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-text-primary"
          />
        </div>
        <p className="break-all text-xs text-text-secondary">/u/{username}</p>
      </div>

      <p className="text-sm text-text-secondary">
        Only friends can see your collection. You can change this in Profile.
      </p>

      <FieldError message={error} />

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-[--radius-btn] bg-amber px-5 text-sm font-bold text-page disabled:opacity-50"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
