/**
 * Cloud Functions de Atlas — IDENTIDAD multi-tenant.
 *
 * Aquí vive lo que el cliente NO puede hacer de forma segura:
 *  - Crear el documento del tenant y su admin.
 *  - Fijar los custom claims { tenantId, role } en el token de Auth.
 *
 * Las firestore.rules dependen 100% de estos claims: sin ellos, nadie accede a
 * los datos de su tenant. El cliente nunca elige su tenant ni su rol.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();
const auth = getAuth();

const TRIAL_DAYS = 14;

type PlanId = 'free' | 'pro' | 'business';
type UserRole = 'admin' | 'produccion' | 'ventas';

const VALID_PLANS: PlanId[] = ['free', 'pro', 'business'];
const INVITABLE_ROLES: UserRole[] = ['admin', 'produccion', 'ventas'];

/** Convierte el nombre de la empresa en un slug legible y único. */
async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'org';
  let slug = base;
  let n = 2;
  // Colisión improbable; el bucle garantiza unicidad.
  while (!(await db.collection('tenants').where('slug', '==', slug).limit(1).get()).empty) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/**
 * Alta de empresa (auto-registro). El cliente ya creó su usuario de Auth y está
 * autenticado; esta función crea el tenant + su admin y le fija los claims.
 *
 * Tras llamarla, el cliente debe refrescar el token (getIdToken(true)) para
 * recibir los claims recién puestos.
 */
export const registerTenant = onCall(async (req: CallableRequest) => {
  const uid = req.auth?.uid;
  const email = (req.auth?.token.email as string | undefined) ?? '';
  if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión antes de registrar la empresa.');

  const orgName = String(req.data?.orgName ?? '').trim();
  const adminName = String(req.data?.adminName ?? '').trim();
  const planId: PlanId = VALID_PLANS.includes(req.data?.planId) ? req.data.planId : 'free';
  if (!orgName) throw new HttpsError('invalid-argument', 'El nombre de la empresa es obligatorio.');

  // Evita doble registro: si el usuario ya pertenece a un tenant, no creamos otro.
  const existing = await db.doc(`users/${uid}`).get();
  if (existing.exists) {
    throw new HttpsError('already-exists', 'Esta cuenta ya pertenece a una empresa.');
  }

  const tenantRef = db.collection('tenants').doc();
  const tenantId = tenantRef.id;
  const slug = await uniqueSlug(orgName);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString();

  const tenant = {
    id: tenantId,
    slug,
    name: orgName,
    adminEmail: email,
    currency: 'CRC',
    timezone: 'America/Costa_Rica',
    subscription: { planId, status: 'trialing', trialEndsAt },
    active: true,
    createdAt: now.toISOString(),
  };

  const member = {
    uid,
    email,
    displayName: adminName || email.split('@')[0],
    role: 'admin' as UserRole,
    active: true,
    tenantId,
  };

  const batch = db.batch();
  batch.set(tenantRef, tenant);
  batch.set(db.doc(`tenants/${tenantId}/members/${uid}`), member);
  batch.set(db.doc(`users/${uid}`), { tenantId, role: 'admin', email });
  await batch.commit();

  // El claim es lo que las reglas verifican. Sin esto, el admin no vería sus datos.
  await auth.setCustomUserClaims(uid, { tenantId, role: 'admin' });

  return { tenantId, role: 'admin' as UserRole };
});

/**
 * Invitar un miembro al tenant del admin que llama. Crea el usuario de Auth (con
 * contraseña temporal), su `members/{uid}`, su `users/{uid}` y le fija los claims
 * con el MISMO tenantId del admin. Solo un admin puede invitar.
 */
export const inviteMember = onCall(async (req: CallableRequest) => {
  const callerUid = req.auth?.uid;
  const callerTenant = req.auth?.token.tenantId as string | undefined;
  const callerRole = req.auth?.token.role as UserRole | undefined;
  if (!callerUid || !callerTenant) throw new HttpsError('unauthenticated', 'Sesión inválida.');
  if (callerRole !== 'admin') throw new HttpsError('permission-denied', 'Solo un administrador puede invitar miembros.');

  const email = String(req.data?.email ?? '').trim().toLowerCase();
  const displayName = String(req.data?.displayName ?? '').trim();
  const role: UserRole = INVITABLE_ROLES.includes(req.data?.role) ? req.data.role : 'ventas';
  const password = String(req.data?.password ?? '');
  if (!email) throw new HttpsError('invalid-argument', 'El correo del miembro es obligatorio.');
  if (password.length < 6) throw new HttpsError('invalid-argument', 'La contraseña temporal debe tener al menos 6 caracteres.');

  // Crea el usuario de Auth (o falla si el correo ya existe).
  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName: displayName || undefined });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Ya existe una cuenta con ese correo.');
    }
    throw new HttpsError('internal', 'No se pudo crear el usuario.');
  }

  const uid = userRecord.uid;
  const member = {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    role,
    active: true,
    tenantId: callerTenant,
  };

  const batch = db.batch();
  batch.set(db.doc(`tenants/${callerTenant}/members/${uid}`), member);
  batch.set(db.doc(`users/${uid}`), { tenantId: callerTenant, role, email });
  await batch.commit();

  await auth.setCustomUserClaims(uid, { tenantId: callerTenant, role });

  return { uid, tenantId: callerTenant, role };
});

/** Verifica que quien llama es admin y devuelve su uid + tenantId. */
function requireAdmin(req: CallableRequest): { uid: string; tenantId: string } {
  const uid = req.auth?.uid;
  const tenantId = req.auth?.token.tenantId as string | undefined;
  const role = req.auth?.token.role as UserRole | undefined;
  if (!uid || !tenantId) throw new HttpsError('unauthenticated', 'Sesión inválida.');
  if (role !== 'admin') throw new HttpsError('permission-denied', 'Solo un administrador puede gestionar miembros.');
  return { uid, tenantId };
}

/**
 * Edita un miembro del tenant del admin que llama: su rol y/o su nombre. Actualiza
 * el doc del miembro, el directorio `users/{uid}`, los custom claims y el perfil de
 * Auth. Un admin no puede cambiar su propio rol (para no quedarse sin acceso).
 */
export const setMemberRole = onCall(async (req: CallableRequest) => {
  const { uid: callerUid, tenantId } = requireAdmin(req);
  const uid = String(req.data?.uid ?? '');
  const role: UserRole | null = INVITABLE_ROLES.includes(req.data?.role) ? req.data.role : null;
  if (!uid || !role) throw new HttpsError('invalid-argument', 'Faltan datos del miembro o el rol no es válido.');
  if (uid === callerUid) throw new HttpsError('failed-precondition', 'No puedes cambiar tu propio rol.');

  const memberRef = db.doc(`tenants/${tenantId}/members/${uid}`);
  const snap = await memberRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'El miembro no pertenece a esta empresa.');

  const rawName = req.data?.displayName;
  const displayName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;

  const memberUpdate: { role: UserRole; displayName?: string } = { role };
  if (displayName) memberUpdate.displayName = displayName;

  const batch = db.batch();
  batch.update(memberRef, memberUpdate);
  batch.set(db.doc(`users/${uid}`), { tenantId, role }, { merge: true });
  await batch.commit();

  await auth.setCustomUserClaims(uid, { tenantId, role });
  if (displayName) {
    try { await auth.updateUser(uid, { displayName }); } catch { /* perfil opcional */ }
  }
  return { uid, role, displayName };
});

/**
 * Elimina un miembro del tenant del admin que llama. Borra PRIMERO su cuenta de
 * Auth (el correo de acceso) y luego sus documentos `members/{uid}` y `users/{uid}`.
 * Un admin no puede eliminarse a sí mismo.
 */
export const removeMember = onCall(async (req: CallableRequest) => {
  const { uid: callerUid, tenantId } = requireAdmin(req);
  const uid = String(req.data?.uid ?? '');
  if (!uid) throw new HttpsError('invalid-argument', 'Falta el identificador del miembro.');
  if (uid === callerUid) throw new HttpsError('failed-precondition', 'No puedes eliminar tu propia cuenta.');

  const memberRef = db.doc(`tenants/${tenantId}/members/${uid}`);
  const snap = await memberRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'El miembro no pertenece a esta empresa.');

  // 1) Elimina la cuenta de acceso (el correo). Si ya no existía, seguimos; cualquier
  //    otro fallo se propaga para NO dejar el correo activo sin sus documentos.
  try {
    await auth.deleteUser(uid);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'No se pudo eliminar la cuenta de acceso del miembro.');
    }
  }

  // 2) Limpia los documentos del miembro.
  const batch = db.batch();
  batch.delete(memberRef);
  batch.delete(db.doc(`users/${uid}`));
  await batch.commit();

  return { uid };
});
