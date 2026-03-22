"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import type { Role } from "@/lib/types";

const PUBLIC_ROUTES = ["/login", "/setup"];

const ROLE_REQUIREMENTS: Array<{ prefix: string; allowed: Role[] }> = [
  { prefix: "/settings",  allowed: ["admin"] },
  { prefix: "/channels",  allowed: ["admin"] },
  { prefix: "/users",     allowed: ["admin"] },
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
      <Sidebar />
      <main className="flex-1 ml-[260px] p-8 overflow-auto">{children}</main>
    </>
  );
}
