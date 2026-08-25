import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const ROLES = ["user", "gerente", "admin"] as const;

const patchBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(128).optional(),
  role: z.enum(ROLES).optional(),
});

async function verifyAdminCaller(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const token = authorization.slice(7);
  const decoded = await adminAuth.verifyIdToken(token);
  const callerDoc = await adminDb.collection("users").doc(decoded.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { decoded, adminAuth, adminDb };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const result = await verifyAdminCaller(req);
    if ("error" in result) return result.error;
    const { adminAuth, adminDb } = result;

    const { uid } = await params;

    const raw = await req.json().catch(() => null);
    if (raw === null) {
      return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
    }

    const parsed = patchBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;

    // Update Firebase Auth (email and/or password)
    const authUpdate: { email?: string; password?: string } = {};
    if (email) authUpdate.email = email;
    if (password) authUpdate.password = password;
    if (Object.keys(authUpdate).length > 0) {
      await adminAuth.updateUser(uid, authUpdate);
    }

    // Update Firestore
    const dbUpdate: Record<string, string> = {};
    if (name) dbUpdate.name = name;
    if (email) dbUpdate.email = email;
    if (role) dbUpdate.role = role;
    if (Object.keys(dbUpdate).length > 0) {
      await adminDb.collection("users").doc(uid).update(dbUpdate);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[PATCH /api/users/[uid]]", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const result = await verifyAdminCaller(req);
    if ("error" in result) return result.error;
    const { decoded, adminAuth, adminDb } = result;

    const { uid } = await params;

    // Impedir que o admin delete a si mesmo
    if (uid === decoded.uid) {
      return NextResponse.json(
        { error: "Não é possível remover sua própria conta." },
        { status: 400 }
      );
    }

    // Deletar do Firebase Auth e Firestore
    await adminAuth.deleteUser(uid);
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/users/[uid]]", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
