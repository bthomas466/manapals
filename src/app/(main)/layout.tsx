import BottomNav from "@/components/nav/BottomNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-dvh">
      <main className="flex-1 pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
