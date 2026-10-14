import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { hasE2ECredentials, requireE2EUser } from "../helpers";
import { e2eSession } from "../supabase";

// Node clients only (no browser). Serial because it touches e2e_friend's row.
requireE2EUser();
test.describe.configure({ mode: "serial" });

test("AC-30: e2e_player cannot set or clear e2e_friend's onboarding marker", async () => {
  const { client } = await e2eSession();
  const { data: before, error } = await client
    .from("profiles")
    .select("user_id, onboarded_at")
    .eq("username", "e2e_friend")
    .single();
  expect(error).toBeNull();
  expect(before?.onboarded_at).not.toBeNull();

  for (const value of [null, new Date().toISOString()]) {
    const res = await client
      .from("profiles")
      .update({ onboarded_at: value })
      .eq("user_id", before!.user_id)
      .select("user_id");
    expect(res.data ?? []).toEqual([]);
  }

  const { data: after } = await client
    .from("profiles")
    .select("onboarded_at")
    .eq("user_id", before!.user_id)
    .single();
  expect(after?.onboarded_at).toBe(before!.onboarded_at);
});

test("AC-32: a newly created auth user starts with a null onboarding marker", async () => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY not set");
  test.skip(!hasE2ECredentials(), "no E2E credentials");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const created = await admin.auth.admin.createUser({
    email: `onboarding-test+${crypto.randomUUID()}@manapals.test`,
    email_confirm: true,
  });
  expect(created.error).toBeNull();
  const userId = created.data.user!.id;
  try {
    // handle_new_user runs inside the insert, so the profile exists already.
    const { data, error } = await admin
      .from("profiles")
      .select("user_id, onboarded_at")
      .eq("user_id", userId)
      .single();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(userId);
    expect(data?.onboarded_at).toBeNull();
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});
