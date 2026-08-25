"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, AlertCircle, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { db, doc, getDoc } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const { signIn, firebaseUser } = useAuth();
  const router = useRouter();

  // If already logged in, go to dashboard
  useEffect(() => {
    if (firebaseUser) {
      router.replace("/");
      return;
    }
    let ignore = false;
    getDoc(doc(db, "settings", "initialized"))
      .then((snap) => {
        if (ignore) return;
        if (!snap.exists()) router.replace("/setup");
        else setChecking(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError" || ignore) return;
        setChecking(false);
      });
    return () => { ignore = true; };
  }, [firebaseUser, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("E-mail ou senha incorretos.");
      } else if (code === "auth/too-many-requests") {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setError("Erro ao fazer login. Verifique sua conexão.");
      }
    }
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-muted)] animate-pulse text-sm">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-sm space-y-6 animate-in">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-blue)] flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Power Fatu</h1>
            <p className="text-sm text-[var(--text-muted)]">Projeção de Faturamento</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="font-semibold text-center text-sm text-[var(--text-secondary)]">
            Acesso ao sistema
          </h2>

          {error && (
            <div
              className="p-3 rounded-xl flex items-center gap-2 border text-sm"
              style={{
                background: "color-mix(in srgb, var(--accent-rose) 8%, transparent)",
                borderColor: "color-mix(in srgb, var(--accent-rose) 30%, transparent)",
                color: "var(--accent-rose)",
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              disabled={loading || !email || !password}
            >
              <LogIn className="w-4 h-4" />
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
