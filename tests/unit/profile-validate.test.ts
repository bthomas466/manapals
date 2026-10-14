import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_REQUIRED,
  DISPLAY_NAME_TOO_LONG,
  USERNAME_INVALID,
  normalizeUsernameInput,
  profileSaveError,
  validateProfileInput,
} from "@/lib/profile/validate";

const name = "Sam";

describe("validateProfileInput", () => {
  it.each(["abc", "a_b_1", "a".repeat(20)])("accepts username %s", (username) => {
    expect(validateProfileInput({ displayName: name, username })).toEqual({
      ok: true,
      value: { displayName: name, username },
    });
  });

  it.each(["ab", "a".repeat(21), "a-b", "a b", ""])("rejects username %j", (username) => {
    expect(validateProfileInput({ displayName: name, username })).toEqual({ ok: false, error: USERNAME_INVALID });
  });

  it("rejects blank and too-long display names", () => {
    expect(validateProfileInput({ displayName: "   ", username: "abc" })).toEqual({
      ok: false,
      error: DISPLAY_NAME_REQUIRED,
    });
    expect(validateProfileInput({ displayName: "x".repeat(51), username: "abc" })).toEqual({
      ok: false,
      error: DISPLAY_NAME_TOO_LONG,
    });
  });

  it("trims the display name and lower-cases the username", () => {
    expect(validateProfileInput({ displayName: "  Sam  ", username: " Sam_R " })).toEqual({
      ok: true,
      value: { displayName: "Sam", username: "sam_r" },
    });
  });
});

describe("helpers", () => {
  it("normalizes and maps errors", () => {
    expect(normalizeUsernameInput("Sam_R")).toBe("sam_r");
    expect(profileSaveError("23505")).toBe("That username is taken.");
    expect(profileSaveError("500")).toBe("Couldn't update profile.");
  });
});
