"use client";

import ConfirmDialog from "@/components/ui/ConfirmDialog";

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
    <ConfirmDialog
      title="Switch to offering only Available cards?"
      confirmLabel="Confirm"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        Trade Match will now offer only cards you mark Available.
        {detail ? ` ${detail}` : ""}
      </p>
    </ConfirmDialog>
  );
}
