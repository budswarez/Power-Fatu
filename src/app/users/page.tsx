"use client";

import { useEffect, useState, useCallback } from "react";
import {
  db,
  doc,
  getDocs,
  setDoc,
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
  const [editingUser, setEditingUser] = useState<UserDoc | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<Role>("user");
  const [editSaving, setEditSaving] = useState(false);

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

  function resetEdit() {
    setEditingUser(null);
    setEditName("");
    setEditEmail("");
    setEditPassword("");
    setEditRole("user");
  }

  async function handleEditSave() {
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim()) {
      setError("Nome e e-mail são obrigatórios.");
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setEditSaving(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("Sessão expirada. Recarregue a página e tente novamente.");
        setEditSaving(false);
        return;
      }
      const body: Record<string, string> = {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
      };
      if (editPassword) body.password = editPassword;
      const res = await fetch(`/api/users/${editingUser.uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro desconhecido");
      }
      resetEdit();
      fetchUsers();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Erro ao atualizar usuário.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(uid: string, name: string) {
    if (!confirm(`Remover "${name}" permanentemente? Isso remove o acesso ao sistema e a conta Firebase.`)) return;
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("Sessão expirada. Recarregue a página e tente novamente.");
        return;
      }
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
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
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

      {/* Edit form */}
      {editingUser && (
        <div className="glass-card p-6 animate-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Editar Usuário</h2>
            <button onClick={resetEdit} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-name" className="block text-xs text-[var(--text-muted)] mb-1">Nome</label>
              <input id="edit-name" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full" placeholder="Nome completo" />
            </div>
            <div>
              <label htmlFor="edit-email" className="block text-xs text-[var(--text-muted)] mb-1">E-mail</label>
              <input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full" placeholder="usuario@empresa.com" />
            </div>
            <div>
              <label htmlFor="edit-password" className="block text-xs text-[var(--text-muted)] mb-1">Nova senha <span className="text-[var(--text-muted)] opacity-60">(deixe em branco para manter)</span></label>
              <input id="edit-password" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="w-full" placeholder="Mín. 6 caracteres" />
            </div>
            <div>
              <label htmlFor="edit-role" className="block text-xs text-[var(--text-muted)] mb-1">Perfil</label>
              <select id="edit-role" value={editRole} onChange={(e) => setEditRole(e.target.value as Role)} className="w-full">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-primary flex items-center gap-2" onClick={handleEditSave} disabled={editSaving}>
              <Check className="w-4 h-4" /> {editSaving ? "Salvando…" : "Salvar"}
            </button>
            <button className="btn-ghost" onClick={resetEdit}>Cancelar</button>
          </div>
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
              <label htmlFor="new-name" className="block text-xs text-[var(--text-muted)] mb-1">Nome</label>
              <input id="new-name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full" placeholder="Nome completo" />
            </div>
            <div>
              <label htmlFor="new-email" className="block text-xs text-[var(--text-muted)] mb-1">E-mail</label>
              <input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full" placeholder="usuario@empresa.com" />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-xs text-[var(--text-muted)] mb-1">Senha temporária</label>
              <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full" placeholder="Mín. 6 caracteres" />
            </div>
            <div>
              <label htmlFor="new-role" className="block text-xs text-[var(--text-muted)] mb-1">Perfil</label>
              <select id="new-role" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="w-full">
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
                  aria-label={`Editar usuário ${u.name}`}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all"
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => handleDelete(u.uid, u.name)}
                  aria-label={`Remover usuário ${u.name}`}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-rose)]/10 hover:text-[var(--accent-rose)] transition-all"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
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
