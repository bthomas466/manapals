// @vitest-environment jsdom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const removeFriendship = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/lib/friends/actions", () => ({
  sendFriendRequest: vi.fn(),
  respondToFriendRequest: vi.fn(),
  removeFriendship: (id: number) => removeFriendship(id),
}));

import FriendActionButton from "../../src/components/friends/FriendActionButton";

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  refresh.mockReset();
  removeFriendship.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(FriendActionButton, {
        status: "friends",
        targetUserId: "u1",
        friendshipId: 7,
        displayName: "Jonny",
      })
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function button(name: string): HTMLButtonElement {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === name);
  if (!b) throw new Error(`No button "${name}"`);
  return b as HTMLButtonElement;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

describe("FriendActionButton remove confirm", () => {
  it("AC-13: shows a non-interactive Friends chip and a separate Remove friend button", () => {
    const chip = [...container.querySelectorAll("span")].find((s) => s.textContent?.trim() === "Friends ✓");
    expect(chip).toBeTruthy();
    expect(container.textContent).not.toContain("Friends ✓ · Remove");
    expect([...container.querySelectorAll("button")].map((b) => b.textContent?.trim())).toEqual([
      "Remove friend",
    ]);
  });

  it("AC-15: clicking Remove friend opens the dialog without calling removeFriendship", async () => {
    await click(button("Remove friend"));
    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.textContent).toContain("Remove Jonny as a friend?");
    expect(removeFriendship).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("AC-15: confirming calls removeFriendship once with 7, then refreshes and closes", async () => {
    removeFriendship.mockResolvedValue({});
    await click(button("Remove friend"));
    await click(button("Remove"));
    expect(removeFriendship).toHaveBeenCalledTimes(1);
    expect(removeFriendship).toHaveBeenCalledWith(7);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("AC-15: an error keeps the dialog open, shows the alert, and does not refresh", async () => {
    removeFriendship.mockResolvedValue({ error: "Couldn't remove." });
    await click(button("Remove friend"));
    await click(button("Remove"));
    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.querySelector('[role="alert"]')?.textContent).toBe("Couldn't remove.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("AC-14: Cancel closes the dialog without removing, and focus returns to Remove friend", async () => {
    const trigger = button("Remove friend");
    trigger.focus();
    await click(trigger);
    await click(button("Cancel"));
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(removeFriendship).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it("AC-14: Cancel is disabled while removal is pending, so the dialog stays open", async () => {
    removeFriendship.mockReturnValue(new Promise(() => {}));
    await click(button("Remove friend"));
    await click(button("Remove"));
    const cancel = button("Cancel");
    expect(cancel.disabled).toBe(true);
    await click(cancel);
    expect(document.querySelector('[role="alertdialog"]')).toBeTruthy();
  });

  it("AC-14: initial focus is inside the dialog and Escape closes it without removing", async () => {
    const trigger = button("Remove friend");
    trigger.focus();
    await click(trigger);
    const dialog = document.querySelector('[role="alertdialog"]')!;
    expect(dialog.contains(document.activeElement)).toBe(true);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(removeFriendship).not.toHaveBeenCalled();
  });
});
