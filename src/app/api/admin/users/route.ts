import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";

// Configuración para exportación estática
export const dynamic = "force-static";

let initialized = false;

function initAdmin() {
  if (initialized) return;
  if (admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("Firebase Admin not configured: missing env vars");
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  initialized = true;
}

async function getCallerUid(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;
  initAdmin();
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid || null;
  } catch (e) {
    console.warn("Invalid ID token", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    initAdmin();
    if (!initialized) {
      return NextResponse.json(
        { error: "Firebase Admin not configured" },
        { status: 500 }
      );
    }

    const callerUid = await getCallerUid(req);
    if (!callerUid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check caller role from Firestore 'users' collection
    try {
      const db = admin.firestore();
      const doc = await db.collection("users").doc(callerUid).get();
      const role = doc.exists ? (doc.data()?.role as string) : undefined;
      if (!role || (role !== "admin" && role !== "super-admin")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch (e) {
      console.warn("Role check failed", e);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, phoneNumber, displayName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password required" },
        { status: 400 }
      );
    }

    const user = await admin.auth().createUser({
      email,
      password,
      phoneNumber,
      displayName,
      disabled: false,
    });

    return NextResponse.json({ uid: user.uid }, { status: 201 });
  } catch (e: any) {
    console.error("Admin create user error:", e);
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
