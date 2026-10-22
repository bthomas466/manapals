import Link from "next/link";
import { formatStat } from "@/lib/profile/stats";

const tileBase = "rounded-card bg-elevated border p-3 text-center";
const tile = `${tileBase} border-border`;

function Value({ value, highlight = false }: { value: number | null; highlight?: boolean }) {
  const color = value === null ? "text-text-secondary" : highlight ? "text-amber" : "text-text-primary";
  return <p className={`text-xl font-extrabold ${color}`}>{formatStat(value)}</p>;
}

export default function ProfileStats({
  cards,
  friends,
  trades,
}: {
  cards: number | null;
  friends: number;
  trades: number | null;
}) {
  return (
    <div className="space-y-2 motion-safe:animate-[settle_250ms_ease-out_both]">
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/collection"
          data-testid="stat-cards"
          className={`${tileBase} min-h-11 border-amber/30 motion-safe:active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-100 transition-colors`}
        >
          <Value value={cards} />
          <p className="text-xs text-text-secondary">
            Cards <span aria-hidden="true" className="text-amber">›</span>
          </p>
        </Link>
        <div data-testid="stat-friends" className={tile}>
          <Value value={friends} />
          <p className="text-xs text-text-secondary">Friends</p>
        </div>
        <div data-testid="stat-trades" className={tile}>
          <Value value={trades} highlight={trades !== null && trades > 0} />
          <p className="text-xs text-text-secondary">Trades</p>
        </div>
      </div>
      {cards === 0 && (
        <p className="text-sm text-text-secondary">Your binder is empty. Tap Cards to add some.</p>
      )}
    </div>
  );
}
