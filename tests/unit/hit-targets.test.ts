import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/friends/actions", () => ({
  sendFriendRequest: vi.fn(),
  respondToFriendRequest: vi.fn(),
  removeFriendship: vi.fn(),
}));

import FriendActionButton from "../../src/components/friends/FriendActionButton";
import {
  IncomingRequestActions,
  OutgoingRequestActions,
} from "../../src/components/friends/FriendRequestActions";
import ImportCollectionModal from "../../src/components/collection/ImportCollectionModal";

function buttons(html: string): { tag: string; text: string }[] {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({
    tag: m[1],
    text: m[2].replace(/<[^>]*>/g, "").trim(),
  }));
}

type AnyProps = Record<string, unknown>;
const html = (c: unknown, props: AnyProps) =>
  renderToStaticMarkup(createElement(c as ComponentType<AnyProps>, props));

function check(name: string, component: unknown, props: AnyProps) {
  describe(name, () => {
    const found = buttons(html(component, props));

    it("AC-8: renders at least one button", () => {
      expect(found.length).toBeGreaterThan(0);
    });

    it("AC-8: every button has min-h-11", () => {
      for (const b of found) expect(b.tag, b.text).toMatch(/\bmin-h-11\b/);
    });

    it("AC-8: one-word Accept/Decline/Cancel buttons also have min-w-11", () => {
      for (const b of found.filter((x) => /^(Accept|Decline|Cancel)$/.test(x.text))) {
        expect(b.tag, b.text).toMatch(/\bmin-w-11\b/);
      }
    });
  });
}

check("IncomingRequestActions", IncomingRequestActions, { friendshipId: 1 });
check("OutgoingRequestActions", OutgoingRequestActions, { friendshipId: 1 });
check("FriendActionButton (incoming)", FriendActionButton, {
  status: "incoming",
  targetUserId: "u1",
  friendshipId: 1,
  displayName: "Jonny",
});
check("FriendActionButton (outgoing)", FriendActionButton, {
  status: "outgoing",
  targetUserId: "u1",
  friendshipId: 1,
  displayName: "Jonny",
});
check("ImportCollectionModal", ImportCollectionModal, { onClose: () => {} });

describe("hit-target fixtures", () => {
  it("AC-8: the incoming fixture really contains Accept and Decline (guards against vacuous passes)", () => {
    expect(buttons(html(IncomingRequestActions, { friendshipId: 1 })).map((b) => b.text)).toEqual(["Accept", "Decline"]);
  });

  it("AC-8: the import modal Cancel button has no aria-label that differs from its text", () => {
    const cancel = buttons(html(ImportCollectionModal, { onClose: () => {} })).find((b) => b.text === "Cancel");
    expect(cancel).toBeTruthy();
    expect(cancel!.tag).not.toContain("aria-label");
  });
});
