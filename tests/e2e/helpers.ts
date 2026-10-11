import { test } from "@playwright/test";

export const AUTH_STATE = "playwright/.auth/e2e-user.json";

export function hasE2ECredentials(): boolean {
  return Boolean(
    process.env.E2E_EMAIL &&
      process.env.E2E_PASSWORD &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Call at the top of an authed spec file. Seeded data comes from `npm run seed:staging`. */
export function requireE2EUser() {
  test.skip(!hasE2ECredentials(), "E2E_EMAIL / E2E_PASSWORD not set — skipping signed-in tests");
}
