// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MainError from "../../src/app/(main)/error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("(main)/error.tsx", () => {
  it("AC-13: shows themed copy and never leaks the error message", () => {
    const html = renderToStaticMarkup(
      createElement(MainError, { error: new Error("db exploded: secret"), unstable_retry: () => {} })
    );
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Nothing was changed");
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/);
    expect(html).not.toContain("db exploded");
    expect(html).not.toContain("secret");
  });

  it("AC-13: never renders the digest", () => {
    const error = Object.assign(new Error("x"), { digest: "digest-12345" });
    const html = renderToStaticMarkup(createElement(MainError, { error, unstable_retry: () => {} }));
    expect(html).not.toContain("digest-12345");
  });

  it("AC-14: clicking Try again calls unstable_retry exactly once, and the error is logged", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const unstable_retry = vi.fn();
    const error = new Error("db exploded: secret");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(MainError, { error, unstable_retry }));
    });
    const button = container.querySelector("button");
    expect(button?.textContent).toBe("Try again");
    expect(unstable_retry).not.toHaveBeenCalled();
    await act(async () => {
      button?.click();
    });

    expect(unstable_retry).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(error);

    await act(async () => root.unmount());
    container.remove();
  });
});
