export const WELCOME_PATH = "/welcome";

type GateProfile = { onboarded_at: string | null } | null;

/** True only when the profile loaded and the marker is unset (fails open on null). */
export function needsOnboarding(profile: GateProfile): boolean {
  return profile !== null && profile.onboarded_at === null;
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Where to redirect a signed-in user's page request, or null to pass through. */
export function onboardingRedirect({
  pathname,
  method,
  profile,
}: {
  pathname: string;
  method: string;
  profile: GateProfile;
}): "/welcome" | "/collection" | null {
  if (method !== "GET" && method !== "HEAD") return null;
  if (isUnder(pathname, "/api") || isUnder(pathname, "/sign-in")) return null;
  if (profile === null) return null;

  const onWelcome = isUnder(pathname, WELCOME_PATH);
  if (needsOnboarding(profile)) return onWelcome ? null : WELCOME_PATH;
  return onWelcome ? "/collection" : null;
}
