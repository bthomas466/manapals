"use client";

import { useEffect, useId, useRef } from "react";
import FieldError from "./FieldError";

export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  pendingLabel,
  pending = false,
  error,
  onConfirm,
  onCancel,
  returnFocusRef,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef(pending);
  const cancelFnRef = useRef(onCancel);

  // Keep latest props in refs so the mount-once Escape listener never goes stale.
  useEffect(() => {
    pendingRef.current = pending;
    cancelFnRef.current = onCancel;
  });

  // Move focus in on open; hand it back on close. Safari doesn't focus buttons on click,
  // so activeElement may be body; prefer the explicit returnFocusRef.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      // Read at cleanup on purpose: we want the button as it is when the dialog closes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const target = returnFocusRef?.current ?? opener;
      if (target && target.isConnected) target.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pendingRef.current) cancelFnRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-page/70 p-4 sm:items-center motion-safe:animate-[scrimin_150ms_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-sm space-y-4 rounded-[--radius-card] border border-border bg-surface p-5 motion-safe:animate-[dlgin_150ms_ease-out]"
      >
        <h2 id={titleId} className="text-base font-bold text-text-primary">
          {title}
        </h2>
        <div id={bodyId} className="text-sm text-text-secondary">
          {children}
        </div>
        <FieldError message={error} />
        <div className="flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="min-h-11 min-w-11 flex-1 rounded-[--radius-btn] border border-border bg-elevated disabled:opacity-50 text-sm font-semibold text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="min-h-11 min-w-11 flex-1 rounded-[--radius-btn] bg-amber text-sm font-bold text-page disabled:opacity-50"
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
