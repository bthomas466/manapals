import { CARD_GRID_CLASS } from "@/lib/cards/grid";

export default function CardGrid({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId ?? "card-grid"} className={CARD_GRID_CLASS}>
      {children}
    </div>
  );
}
