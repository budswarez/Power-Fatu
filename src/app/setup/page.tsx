"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, AlertCircle, ShieldCheck } from "lucide-react";
import { auth, db, doc, getDoc, setDoc, Timestamp } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function SetupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const router = useRouter();

  useEffect(() => {
    let ignore = false;
    getDoc(doc(db, "settings", "initialized"))
      .then((snap) => {
        if (ignore) return;
        if (snap.exists()) router.replace("/login");
        else setChecking(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError" || ignore) return;
        setChecking(false); // mostra o form mesmo assim
      });
    return () => { ignore = true; };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email || !password || !confirm) return;
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // Create Firebase Auth account (also signs in)
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Write admin profile to Firestore
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        name: name.trim(),
        role: "admin",
        created_at: Timestamp.now(),
      });

      // Mark system as initialized
      await setDoc(doc(db, "settings", "initialized"), {
        at: Timestamp.now(),
      });

      router.replace("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso.");
      } else if (code === "auth/invalid-email") {
        setError("E-mail inválido.");
      } else if (code === "auth/weak-password") {
        setError("Senha muito fraca. Use pelo menos 6 caracteres.");
      } else {
        setError("Erro ao criar conta. Verifique sua conexão.");
      }
      setLoading(false);
    }
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
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-emerald)] flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Configuração Inicial</h1>
            <p className="text-sm text-[var(--text-muted)]">Crie o primeiro usuário administrador</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--accent-emerald)" }} />
            Este formulário só aparece uma vez, no primeiro acesso ao sistema.
          </div>

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
              <label className="block text-xs text-[var(--text-muted)] mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
                placeholder="Seu nome"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
                placeholder="admin@empresa.com"
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
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Confirmar senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full"
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              disabled={loading || !name || !email || !password || !confirm}
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? "Criando conta…" : "Criar conta admin"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
