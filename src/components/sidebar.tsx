"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  CalendarClock,
  CalendarCheck2,
  TrendingUp,
  Settings2,
  Users,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",           label: "Dashboard",        icon: LayoutDashboard, roles: ["user", "gerente", "admin"] },
  { href: "/historical", label: "Dados Históricos",  icon: CalendarClock,   roles: ["gerente", "admin"] },
  { href: "/current",    label: "Mês Atual",         icon: CalendarCheck2,  roles: ["gerente", "admin"] },
  { href: "/channels",   label: "Canais de Venda",   icon: Layers,          roles: ["admin"] },
  { href: "/users",      label: "Usuários",           icon: Users,           roles: ["admin"] },
];

const FOOTER_ITEMS: NavItem[] = [
  { href: "/settings", label: "Configurações", icon: Settings2, roles: ["admin"] },
];

const ROLE_LABELS: Record<Role, string> = {
  user: "Usuário",
  gerente: "Gerente",
  admin: "Admin",
};

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const role = user?.role ?? "user";

  const visibleNav    = NAV_ITEMS.filter((i) => i.roles.includes(role));
  const visibleFooter = FOOTER_ITEMS.filter((i) => i.roles.includes(role));

  async function handleSignOut() {
    onClose?.();
    await signOut();
    router.replace("/login");
  }

  return (
    <aside
      className={`fixed top-0 left-0 h-screen w-[260px] flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] z-40 transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      {/* Logo */}
      <div className="px-6 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--accent-blue)] flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">PFatu</h1>
          <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest">
            Projeção de Faturamento
          </p>
        </div>
      </div>

      {/* User badge */}
      {user && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
          <p className="text-[10px] text-[var(--text-muted)]">{ROLE_LABELS[user.role]}</p>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 h-px bg-[var(--border-subtle)]" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`sidebar-link ${pathname === href ? "active" : ""}`}
          >
            <Icon className="w-[18px] h-[18px]" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-3 border-t border-[var(--border-subtle)] pt-3 space-y-1">
        {visibleFooter.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`sidebar-link ${pathname === href ? "active" : ""}`}
          >
            <Icon className="w-[18px] h-[18px]" />
            {label}
          </Link>
        ))}
        <button
          onClick={handleSignOut}
          className="sidebar-link w-full text-left"
          style={{ color: "var(--accent-rose)" }}
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sair
        </button>
        <p className="text-[11px] text-[var(--text-muted)] px-4 pt-1">v1.0 • Firebase Edition</p>
      </div>
    </aside>
  );
}
