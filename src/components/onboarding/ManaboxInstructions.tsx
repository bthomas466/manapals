import { MANABOX_EXPORT_STEPS, MANABOX_EXPORT_TIP } from "@/lib/onboarding/manaboxInstructions";

export default function ManaboxInstructions() {
  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
        {MANABOX_EXPORT_STEPS.map((segments, i) => (
          <li key={i}>
            {segments.map((segment, j) =>
              segment.bold ? (
                <strong key={j} className="font-semibold text-text-primary">
                  {segment.text}
                </strong>
              ) : (
                <span key={j}>{segment.text}</span>
              )
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-text-muted">{MANABOX_EXPORT_TIP}</p>
    </div>
  );
}
