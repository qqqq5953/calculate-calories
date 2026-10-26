import { LiffGate } from "./LiffGate";
import { Nav } from "./Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <Nav />
      <LiffGate>{children}</LiffGate>
    </main>
  );
}
