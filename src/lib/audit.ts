import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile } from "./types";

export type AuditAction = "create" | "update" | "delete";
export type AuditEntity = "sale" | "channel" | "user" | "settings";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entity: AuditEntity;
  entity_id: string;
  uid: string;
  user_name: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export async function logAudit(
  user: UserProfile,
  action: AuditAction,
  entity: AuditEntity,
  entity_id: string,
  payload: Record<string, unknown> = {}
) {
  try {
    await addDoc(collection(db, "audit_log"), {
      action,
      entity,
      entity_id,
      uid: user.uid,
      user_name: user.name,
      timestamp: Timestamp.now(),
      payload,
    });
  } catch (e) {
    // Falha no log nunca deve bloquear a operação principal
    console.error("[audit] falha ao registrar:", e);
  }
}
