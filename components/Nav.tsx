"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "今日" },
  { href: "/dashboard/trends", label: "趨勢" },
  { href: "/settings", label: "設定" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="頁面">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? "active" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
