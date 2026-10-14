export const DISPLAY_NAME_REQUIRED = "Display name is required.";
export const DISPLAY_NAME_TOO_LONG = "Display name must be 50 characters or fewer.";
export const USERNAME_INVALID =
  "Username must be 3-20 characters: lowercase letters, numbers, underscores.";
export const USERNAME_TAKEN = "That username is taken.";
export const PROFILE_SAVE_FAILED = "Couldn't update profile.";

const DISPLAY_NAME_MAX = 50;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export type ProfileInputResult =
  | { ok: true; value: { displayName: string; username: string } }
  | { ok: false; error: string };

/** Lower-cases the username as the user types. */
export function normalizeUsernameInput(value: string): string {
  return value.toLowerCase();
}

/** Shared by the onboarding wizard and /profile. Display name is checked first. */
export function validateProfileInput(input: {
  displayName?: string | null;
  username?: string | null;
}): ProfileInputResult {
  const displayName = input.displayName?.trim() ?? "";
  const username = input.username?.trim().toLowerCase() ?? "";

  if (!displayName) return { ok: false, error: DISPLAY_NAME_REQUIRED };
  if (displayName.length > DISPLAY_NAME_MAX) return { ok: false, error: DISPLAY_NAME_TOO_LONG };
  if (!USERNAME_PATTERN.test(username)) return { ok: false, error: USERNAME_INVALID };

  return { ok: true, value: { displayName, username } };
}

/** Maps a Postgres error code from a profile update to user-facing copy. */
export function profileSaveError(code: string | undefined): string {
  return code === "23505" ? USERNAME_TAKEN : PROFILE_SAVE_FAILED;
}
