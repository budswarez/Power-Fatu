"use client";

import { useEffect, useState, useCallback } from "react";
import {
  db,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  Timestamp,
  createSecondaryApp,
  deleteApp,
} from "@/lib/firebase";
import { getAuth, createUserWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { Role, UserProfile } from "@/lib/types";
import { Users, Plus, Pencil, Trash2, Check, X, AlertCircle, ShieldAlert } from "lucide-react";

type UserDoc = UserProfile & { created_at?: Date };

const ROLES: Role[] = ["user", "gerente", "admin"];
const ROLE_LABELS: Record<Role, string> = {
  user: "Usuário",
  gerente: "Gerente",
  admin: "Admin",
};
const ROLE_COLORS: Record<Role, string> = {
  user: "var(--accent-blue)",
  gerente: "var(--accent-amber)",
  admin: "var(--accent-emerald)",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("user");
  const [saving, setSaving] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>("user");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list: UserDoc[] = snap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as Omit<UserDoc, "uid">),
        created_at: d.data().created_at?.toDate?.() ?? undefined,
      }));
      setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
      setError("Erro ao carregar usuários.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function resetForm() {
    setShowForm(false);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("user");
  }

  async function handleCreate() {
    if (!newName.trim() || !newEmail || !newPassword) return;
    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    const secondaryApp = createSecondaryApp();
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: newEmail,
        name: newName.trim(),
        role: newRole,
        created_at: Timestamp.now(),
      });
      await firebaseSignOut(secondaryAuth);
      resetForm();
      fetchUsers();
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setError("Este e-mail já está cadastrado.");
      } else if (code === "auth/invalid-email") {
        setError("E-mail inválido.");
      } else {
        setError("Erro ao criar usuário. Tente novamente.");
      }
      console.error(e);
    } finally {
      deleteApp(secondaryApp).catch(() => {});
      setSaving(false);
    }
  }

  async function handleEditSave(uid: string) {
    setError(null);
    try {
      await updateDoc(doc(db, "users", uid), { role: editRole });
      setEditingId(null);
      fetchUsers();
    } catch (e) {
      console.error(e);
      setError("Erro ao atualizar usuário.");
    }
  }

  async function handleDelete(uid: string, name: string) {
    if (!confirm(`Remover "${name}" permanentemente? Isso remove o acesso ao sistema e a conta Firebase.`)) return;
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/users/${uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro desconhecido");
      }
      fetchUsers();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Erro ao remover usuário.");
    }
  }

  function startEdit(u: UserDoc) {
    setEditingId(u.uid);
    setEditRole(u.role);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-violet)]/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-[var(--accent-violet)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Usuários</h1>
            <p className="text-sm text-[var(--text-muted)]">Gerencie os usuários e suas permissões</p>
          </div>
        </div>
        {!showForm && (
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Novo Usuário
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="glass-card p-3 flex items-center gap-2 border"
          style={{
            background: "color-mix(in srgb, var(--accent-rose) 6%, transparent)",
            borderColor: "color-mix(in srgb, var(--accent-rose) 30%, transparent)",
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "var(--accent-rose)" }} />
          <p className="text-sm" style={{ color: "var(--accent-rose)" }}>{error}</p>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="glass-card p-6 animate-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Novo Usuário</h2>
            <button onClick={resetForm} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Nome</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full" placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">E-mail</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full" placeholder="usuario@empresa.com" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Senha temporária</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full" placeholder="Mín. 6 caracteres" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Perfil</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="w-full">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-primary flex items-center gap-2" onClick={handleCreate} disabled={saving}>
              <Check className="w-4 h-4" /> {saving ? "Criando…" : "Criar"}
            </button>
            <button className="btn-ghost" onClick={resetForm}>Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">Carregando…</div>
      ) : users.length === 0 ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">Nenhum usuário cadastrado.</div>
      ) : (
        <div className="grid gap-3">
          {users.map((u, i) => (
            <div
              key={u.uid}
              className={`glass-card p-4 flex items-center justify-between animate-in delay-${Math.min(i + 1, 4)}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: ROLE_COLORS[u.role] }}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{u.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {editingId === u.uid ? (
                  <>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as Role)}
                      className="text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleEditSave(u.uid)}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-all"
                      style={{ color: "var(--accent-emerald)" }}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-all text-[var(--text-muted)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-lg"
                      style={{
                        color: ROLE_COLORS[u.role],
                        backgroundColor: `color-mix(in srgb, ${ROLE_COLORS[u.role]} 12%, transparent)`,
                      }}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                    <button
                      onClick={() => startEdit(u)}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u.uid, u.name)}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-rose)]/10 hover:text-[var(--accent-rose)] transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      <div
        className="glass-card p-4 flex items-start gap-2 text-xs text-[var(--text-muted)]"
        style={{ borderColor: "color-mix(in srgb, var(--accent-amber) 20%, transparent)" }}
      >
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent-amber)" }} />
        <span>
          Remover um usuário exclui permanentemente o acesso ao sistema e a conta Firebase Authentication.
        </span>
      </div>
    </div>
  );
}
