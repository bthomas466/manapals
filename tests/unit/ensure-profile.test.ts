import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), adminFrom: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.adminFrom }) }));

import { ensureProfile } from "@/lib/profile/ensure";

function sessionClient(existing: unknown) {
  const select = {
    eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }),
  };
  return { from: () => ({ select: () => select }) } as never;
}

const user = { id: "u1", email: "Jsmith1987@example.com", user_metadata: { full_name: "J Smith" } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockImplementation((row: Record<string, unknown>) => ({
    select: () => ({ single: async () => ({ data: row, error: null }) }),
  }));
  mocks.adminFrom.mockReturnValue({ insert: mocks.insert });
});

describe("ensureProfile", () => {
  it("Q3: a lazily provisioned profile is inserted with a non-null onboarded_at", async () => {
    const profile = await ensureProfile(sessionClient(null), user);
    expect(mocks.adminFrom).toHaveBeenCalledWith("profiles");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    const row = mocks.insert.mock.calls[0][0];
    expect(row.user_id).toBe("u1");
    expect(row.username).toBe("jsmith1987");
    expect(typeof row.onboarded_at).toBe("string");
    expect(Number.isNaN(Date.parse(row.onboarded_at))).toBe(false);
    expect(profile?.onboarded_at).toBe(row.onboarded_at);
  });

  it("returns an existing row untouched, including a null marker, and inserts nothing", async () => {
    const existing = {
      user_id: "u1",
      username: "sam",
      display_name: "Sam",
      avatar_url: null,
      collection_visibility: "friends",
      onboarded_at: null,
    };
    expect(await ensureProfile(sessionClient(existing), user)).toBe(existing);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
