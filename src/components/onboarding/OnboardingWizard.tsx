"use client";

import { useState } from "react";
import ProfileStep from "./ProfileStep";
import ImportStep from "./ImportStep";

export type WizardProfile = { displayName: string; username: string; avatarUrl: string | null };

export default function OnboardingWizard({
  displayName,
  username,
  avatarUrl,
  hasExistingCards,
}: WizardProfile & { hasExistingCards: boolean }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [saved, setSaved] = useState<WizardProfile>({ displayName, username, avatarUrl });

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-extrabold text-text-primary">ManaPals</span>
          <p className="text-sm font-semibold text-text-secondary">Step {step} of 2</p>
        </div>
        <div className="flex gap-2" aria-hidden="true">
          <div className="h-1.5 flex-1 rounded-full bg-amber" />
          <div className={`h-1.5 flex-1 rounded-full ${step === 2 ? "bg-amber" : "bg-elevated"}`} />
        </div>
      </header>

      {step === 1 ? (
        <ProfileStep
          initial={saved}
          onSaved={(profile) => {
            setSaved(profile);
            setStep(2);
          }}
        />
      ) : (
        <ImportStep hasExistingCards={hasExistingCards} onBack={() => setStep(1)} />
      )}
    </div>
  );
}
