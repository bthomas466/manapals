import { test as setup } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { AUTH_STATE, hasE2ECredentials } from "./helpers";

// Signs in the staging E2E user with the same @supabase/ssr cookie format the
// app uses, then saves the cookies for the `authed` project. The app only
// offers Google sign-in, so this skips the UI instead of adding a test-only
// login route.
setup("sign in e2e user", async ({ browser, baseURL }) => {
  const context = await browser.newContext();

  if (hasE2ECredentials()) {
    const jar = new Map<string, string>();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
        },
      }
    );

    const { error } = await supabase.auth.signInWithPassword({
      email: process.env.E2E_EMAIL!,
      password: process.env.E2E_PASSWORD!,
    });
    if (error) throw new Error(`E2E sign-in failed: ${error.message}`);

    await context.addCookies(
      [...jar].map(([name, value]) => ({ name, value, url: baseURL!, sameSite: "Lax" as const }))
    );
  }

  // Without credentials this saves an empty state and authed specs skip.
  await context.storageState({ path: AUTH_STATE });
  await context.close();
});
