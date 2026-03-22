"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import type { Role } from "@/lib/types";

const PUBLIC_ROUTES = ["/login", "/setup"];

const ROLE_REQUIREMENTS: Array<{ prefix: string; allowed: Role[] }> = [
  { prefix: "/settings",  allowed: ["admin"] },
  { prefix: "/channels",  allowed: ["admin"] },
  { prefix: "/users",     allowed: ["admin"] },
  { prefix: "/audit",     allowed: ["admin"] },
  { prefix: "/historical", allowed: ["gerente", "admin"] },
  { prefix: "/current",   allowed: ["gerente", "admin"] },
];

function hasAccess(role: Role, pathname: string): boolean {
  for (const rule of ROLE_REQUIREMENTS) {
    if (pathname.startsWith(rule.prefix)) {
      return rule.allowed.includes(role);
    }
  }
  return true; // dashboard and anything else: all roles
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (loading) return;
    if (isPublic) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (user && !hasAccess(user.role, pathname)) {
      router.replace("/");
    }
  }, [loading, firebaseUser, user, pathname, isPublic, router]);

  // Full-screen spinner while resolving auth
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-muted)] animate-pulse text-sm">Carregando…</div>
      </div>
    );
  }

  // Public routes: no sidebar, no guard
  if (isPublic) {
    return <>{children}</>;
  }

  // Authenticated in Firebase but no Firestore profile
  if (firebaseUser && !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="glass-card p-8 text-center max-w-sm space-y-2">
          <p className="font-semibold" style={{ color: "var(--accent-rose)" }}>
            Sem acesso
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Sua conta não possui perfil cadastrado. Contate um administrador.
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated → useEffect handles redirect; render nothing meanwhile
  if (!firebaseUser) return null;

  // Role insufficient → useEffect handles redirect; render nothing meanwhile
  if (user && !hasAccess(user.role, pathname)) return null;

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col md:ml-[260px]">
        {/* Mobile top header */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-blue)] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold">PFatu</span>
          </div>
          {/* Spacer to keep logo centered */}
          <div className="w-9" />
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
      </div>
    </>
  );
}
