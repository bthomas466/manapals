import { describe, expect, it } from "vitest";
import { needsOnboarding, onboardingRedirect } from "@/lib/onboarding/gate";

const unset = { onboarded_at: null };
const set = { onboarded_at: "2026-10-14T12:00:00Z" };

describe("needsOnboarding", () => {
  it("is true only when the marker is null", () => {
    expect(needsOnboarding(unset)).toBe(true);
    expect(needsOnboarding(set)).toBe(false);
    expect(needsOnboarding(null)).toBe(false);
  });
});

describe("onboardingRedirect", () => {
  it.each(["/", "/collection", "/trades", "/trades/x", "/wishlist", "/profile", "/u/e2e_friend"])(
    "sends un-onboarded users from %s to /welcome",
    (pathname) => {
      expect(onboardingRedirect({ pathname, method: "GET", profile: unset })).toBe("/welcome");
    }
  );

  it("sends onboarded users away from /welcome only", () => {
    expect(onboardingRedirect({ pathname: "/welcome", method: "GET", profile: set })).toBe("/collection");
    expect(onboardingRedirect({ pathname: "/collection", method: "GET", profile: set })).toBeNull();
  });

  it("leaves /welcome alone for un-onboarded users", () => {
    expect(onboardingRedirect({ pathname: "/welcome", method: "GET", profile: unset })).toBeNull();
  });

  it("never gates api, sign-in, non-GET requests or a missing profile", () => {
    expect(onboardingRedirect({ pathname: "/api/collection/import", method: "GET", profile: unset })).toBeNull();
    expect(onboardingRedirect({ pathname: "/sign-in", method: "GET", profile: unset })).toBeNull();
    expect(onboardingRedirect({ pathname: "/collection", method: "POST", profile: unset })).toBeNull();
    expect(onboardingRedirect({ pathname: "/collection", method: "GET", profile: null })).toBeNull();
  });
});
