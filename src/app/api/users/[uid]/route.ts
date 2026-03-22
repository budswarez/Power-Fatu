import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authorization.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);

    const callerDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { uid } = await params;
    const body = await req.json();
    const { name, email, password, role } = body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

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
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // Verificar token do chamador
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authorization.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);

    // Verificar se o chamador é admin
    const callerDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
