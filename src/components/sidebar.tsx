"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  CalendarClock,
  CalendarCheck2,
  TrendingUp,
  Settings2,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/channels", label: "Canais de Venda", icon: Layers },
  { href: "/historical", label: "Dados Históricos", icon: CalendarClock },
  { href: "/current", label: "Mês Atual", icon: CalendarCheck2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-[260px] flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      {/* Logo */}
      <div className="px-6 py-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--accent-blue)] flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">
            PFatu
          </h1>
          <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest">
            Projeção de Faturamento
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-[var(--border-subtle)]" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${active ? "active" : ""}`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: Settings + version */}
      <div className="px-3 pb-3 border-t border-[var(--border-subtle)] pt-3 space-y-1">
        <Link
          href="/settings"
          className={`sidebar-link ${pathname === "/settings" ? "active" : ""}`}
        >
          <Settings2 className="w-[18px] h-[18px]" />
          Configurações
        </Link>
        <p className="text-[11px] text-[var(--text-muted)] px-4 pt-1">
          v1.0 • Firebase Edition
        </p>
      </div>
    </aside>
  );
}
