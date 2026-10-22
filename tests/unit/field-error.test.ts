import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FieldError from "../../src/components/ui/FieldError";

describe("FieldError", () => {
  it("AC-4: renders a role=alert paragraph with text-sm and text-danger", () => {
    const html = renderToStaticMarkup(createElement(FieldError, { message: "Couldn't remove." }));
    expect(html).toMatch(/^<p\b/);
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/class="[^"]*\btext-sm\b/);
    expect(html).toMatch(/class="[^"]*\btext-danger\b/);
    expect(html).toContain("Couldn&#x27;t remove.");
  });

  it("AC-4: renders nothing for null, empty and undefined messages", () => {
    expect(renderToStaticMarkup(createElement(FieldError, { message: null }))).toBe("");
    expect(renderToStaticMarkup(createElement(FieldError, { message: "" }))).toBe("");
    expect(renderToStaticMarkup(createElement(FieldError, {}))).toBe("");
  });
});
