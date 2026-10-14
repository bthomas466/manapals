import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  redirect: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  result: { error: null as { code?: string; message?: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { completeOnboarding, saveOnboardingProfile } from "@/lib/onboarding/actions";
import {
  DISPLAY_NAME_REQUIRED,
  USERNAME_INVALID,
} from "@/lib/profile/validate";

// from("profiles").update(x).eq(...)[.is(...)] resolves to { error }.
beforeEach(() => {
  vi.clearAllMocks();
  mocks.result.error = null;
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  const chain: Record<string, unknown> = {};
  mocks.eq.mockImplementation(() => chain);
  mocks.is.mockImplementation(() => chain);
  chain.eq = mocks.eq;
  chain.is = mocks.is;
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ error: mocks.result.error });
  mocks.update.mockImplementation(() => chain);
  mocks.from.mockReturnValue({ update: mocks.update });
});

describe("saveOnboardingProfile", () => {
  it("AC-12: writes only display_name and username (trimmed/lower-cased), never onboarded_at", async () => {
    const res = await saveOnboardingProfile({ displayName: "  Sam  ", username: "Sam_R", removeAvatar: false });
    expect(res).toEqual({});
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledTimes(1);
    const payload = mocks.update.mock.calls[0][0];
    expect(payload).toEqual({ display_name: "Sam", username: "sam_r" });
    expect(payload).not.toHaveProperty("onboarded_at");
    expect(payload).not.toHaveProperty("avatar_url");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("AC-9/AC-11: invalid input returns the message and does not touch the database", async () => {
    expect(await saveOnboardingProfile({ displayName: "Sam", username: "ab", removeAvatar: false })).toEqual({
      error: USERNAME_INVALID,
    });
    expect(await saveOnboardingProfile({ displayName: "   ", username: "abc", removeAvatar: false })).toEqual({
      error: DISPLAY_NAME_REQUIRED,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("AC-13: avatar_url is set to null only when removeAvatar is true", async () => {
    await saveOnboardingProfile({ displayName: "Sam", username: "sam", removeAvatar: true });
    expect(mocks.update.mock.calls[0][0]).toEqual({ display_name: "Sam", username: "sam", avatar_url: null });
    await saveOnboardingProfile({ displayName: "Sam", username: "sam", removeAvatar: false });
    expect(mocks.update.mock.calls[1][0]).not.toHaveProperty("avatar_url");
  });

  it("AC-10: a unique violation maps to the taken message", async () => {
    mocks.result.error = { code: "23505" };
    expect(await saveOnboardingProfile({ displayName: "Sam", username: "taken", removeAvatar: false })).toEqual({
      error: "That username is taken.",
    });
  });

  it("AC-14: any other database error maps to the generic message", async () => {
    mocks.result.error = { code: "XX000" };
    expect(await saveOnboardingProfile({ displayName: "Sam", username: "sam", removeAvatar: false })).toEqual({
      error: "Couldn't update profile.",
    });
  });

  it("rejects signed-out callers without writing", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect(await saveOnboardingProfile({ displayName: "Sam", username: "sam", removeAvatar: false })).toEqual({
      error: "Not authenticated",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("completeOnboarding", () => {
  it("AC-31: updates only onboarded_at, scoped to the user and to unset rows, then redirects to /collection", async () => {
    await completeOnboarding();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    const payload = mocks.update.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual(["onboarded_at"]);
    expect(Number.isNaN(Date.parse(payload.onboarded_at))).toBe(false);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(mocks.is).toHaveBeenCalledWith("onboarded_at", null);
    expect(mocks.redirect).toHaveBeenCalledWith("/collection");
  });

  it("returns an error and does not redirect when the update fails", async () => {
    mocks.result.error = { message: "boom" };
    expect(await completeOnboarding()).toEqual({ error: "Couldn't finish setup. Try again." });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does nothing when signed out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect(await completeOnboarding()).toEqual({ error: "Not authenticated" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
