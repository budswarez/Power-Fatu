"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, db, doc, getDoc } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentUid: string | null = null;

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        currentUid = null;
        setUser(null);
        setLoading(false);
        return;
      }

      const uid = fbUser.uid;
      currentUid = uid;

      getDoc(doc(db, "users", uid))
        .then((snap) => {
          if (currentUid !== uid) return; // descarta resposta stale
          if (snap.exists()) {
            const data = snap.data();
            setUser({
              uid,
              email: data.email ?? fbUser.email ?? "",
              name: data.name ?? "",
              role: data.role,
            });
          } else {
            setUser(null);
          }
        })
        .catch((err) => {
          if (err?.name === "AbortError") return; // navegação cancelou o fetch — ignorar
          if (currentUid !== uid) return;
          setUser(null);
        })
        .finally(() => {
          if (currentUid !== uid) return;
          setLoading(false);
        });
    });

    return () => {
      currentUid = null;
      unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
