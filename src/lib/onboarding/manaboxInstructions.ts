export type InstructionSegment = { text: string; bold?: boolean };

// Draft copy (spec Q1): verify menu labels against the current Manabox app.
export const MANABOX_EXPORT_STEPS: InstructionSegment[][] = [
  [{ text: "Open Manabox and go to your " }, { text: "Collection", bold: true }, { text: "." }],
  [
    { text: "Tap the " },
    { text: "⋯", bold: true },
    { text: " menu and choose " },
    { text: "Export", bold: true },
    { text: "." },
  ],
  [{ text: "Choose " }, { text: "CSV", bold: true }, { text: " as the format." }],
  [
    {
      text: "Save the file to your phone (Files on iPhone, Downloads on Android) or share it to yourself.",
    },
  ],
  [{ text: "Come back here and tap " }, { text: "Choose CSV file", bold: true }, { text: "." }],
];

export const MANABOX_EXPORT_TIP =
  "Only want to share one binder? Open that binder in Manabox and export from there.";
