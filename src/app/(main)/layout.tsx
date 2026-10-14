import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/nav/BottomNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-dvh">
      <header className="bg-surface border-b border-border pt-[env(safe-area-inset-top)]">
        <Link href="/collection" className="flex min-h-12 items-center px-4">
          <Image
            src="/brand/concept-3-lockup.svg"
            alt="ManaPals"
            width={112}
            height={28}
            priority
          />
        </Link>
      </header>
      <main className="flex-1 pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
