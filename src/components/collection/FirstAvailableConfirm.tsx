"use client";

export default function FirstAvailableConfirm({
  detail,
  onConfirm,
  onCancel,
}: {
  // Optional context line, e.g. the binder name and entry count for bulk actions.
  detail?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="first-available-title"
        className="w-full max-w-sm rounded-[--radius-card] border border-border bg-surface p-5 space-y-4"
      >
        <h2 id="first-available-title" className="text-base font-bold text-text-primary">
          Switch to offering only Available cards?
        </h2>
        <p className="text-sm text-text-secondary">
          Trade Match will now offer only cards you mark Available.
          {detail ? ` ${detail}` : ""}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-11 rounded-[--radius-btn] border border-border bg-elevated text-sm font-semibold text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 min-h-11 rounded-[--radius-btn] bg-amber text-sm font-bold text-page"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
