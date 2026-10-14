import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

const LINUX_BASELINE = "tests/e2e/__screenshots__/linux/auth.spec.ts/sign-in.png";
const DARWIN_BASELINE = "tests/e2e/__screenshots__/darwin/auth.spec.ts/sign-in.png";

// Pre-logo baselines (f78252c and fd2269a) that must not be committed again.
const OLD_LINUX_SHA256 = "7a35d132beca98f4a1b9c01f572d5197b22415dbc34116d29cb1a2e88fd905bc";
const OLD_DARWIN_SHA256 = "b10cacaab39de9818858589f57a6fa9e6230a39dc80d694b9d6549e5ee320a1e";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("sign-in screenshot baselines", () => {
  it("linux baseline is a 412x839 PNG that is not the pre-logo image", () => {
    const buf = readFileSync(join(root, LINUX_BASELINE));
    expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(buf.readUInt32BE(16)).toBe(412);
    expect(buf.readUInt32BE(20)).toBe(839);
    expect(sha256(buf)).not.toBe(OLD_LINUX_SHA256);
  });

  it("darwin baseline is absent or not the pre-logo image", () => {
    const path = join(root, DARWIN_BASELINE);
    if (!existsSync(path)) return;
    expect(sha256(readFileSync(path))).not.toBe(OLD_DARWIN_SHA256);
  });
});
