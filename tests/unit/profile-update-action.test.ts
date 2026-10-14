import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), error: null as { code?: string } | null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ update: mocks.update }),
  }),
}));

import { updateProfile } from "@/lib/friends/actions";
import { DISPLAY_NAME_REQUIRED, USERNAME_INVALID } from "@/lib/profile/validate";

function form(displayName: string, username: string) {
  const fd = new FormData();
  fd.set("display_name", displayName);
  fd.set("username", username);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.error = null;
  mocks.eq.mockImplementation(async () => ({ error: mocks.error }));
  mocks.update.mockReturnValue({ eq: mocks.eq });
});

describe("updateProfile shares the validation (AC-16)", () => {
  it("returns the AC-9 and AC-11 messages without writing", async () => {
    expect(await updateProfile(form("Sam", "ab"))).toEqual({ error: USERNAME_INVALID });
    expect(await updateProfile(form("  ", "abc"))).toEqual({ error: DISPLAY_NAME_REQUIRED });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("sends the trimmed display name and lower-cased username", async () => {
    expect(await updateProfile(form("  Sam  ", "Sam_R"))).toEqual({});
    expect(mocks.update).toHaveBeenCalledWith({ display_name: "Sam", username: "sam_r" });
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("maps 23505 to the taken message and other errors to the generic one", async () => {
    mocks.error = { code: "23505" };
    expect(await updateProfile(form("Sam", "taken"))).toEqual({ error: "That username is taken." });
    mocks.error = { code: "XX000" };
    expect(await updateProfile(form("Sam", "sam"))).toEqual({ error: "Couldn't update profile." });
  });
});
