/**
 * Siembra un tenant en Firestore con los datos MOCK del proyecto, para pruebas.
 *
 * Usa el SDK CLIENTE e inicia sesión como un ADMIN del tenant (las reglas
 * permiten al admin escribir todas las colecciones). No necesita service account.
 *
 * Uso:
 *   SEED_EMAIL="admin@tu-empresa.com" \
 *   SEED_PASSWORD="••••••" \
 *   TENANT_ID="3dsg8MUozTet9R93jJeV" \
 *   npx tsx scripts/seed-tenant.ts
 *
 * Escribe a `tenants/{TENANT_ID}/{coleccion}`. NO toca `members` ni el doc del
 * tenant (los gestiona la Cloud Function de registro).
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, doc, writeBatch } from 'firebase/firestore';

import {
  MOCK_SUPPLIES, MOCK_PRODUCTS, MOCK_RECIPES, MOCK_SUPPLY_STOCK, MOCK_PRODUCT_STOCK,
  MOCK_KARDEX, MOCK_SALES, MOCK_PURCHASE_ORDERS, MOCK_ORDERS, MOCK_CUSTOMERS,
  MOCK_RETURNED_LOTS, MOCK_SUPPLIERS, MOCK_URNAS, MOCK_URNA_LOTES, MOCK_PREDICTIONS,
  MOCK_CONSUMER_PRICES,
} from '../src/app/core/mocks/dummy-data';

const firebaseConfig = {
  apiKey: 'FIREBASE_API_KEY',
  authDomain: 'itemflow-app.firebaseapp.com',
  projectId: 'itemflow-app',
  storageBucket: 'itemflow-app.firebasestorage.app',
  messagingSenderId: '779468433375',
  appId: '1:779468433375:web:ee28012a586437df64c66a',
};

const TENANT_ID = process.env['TENANT_ID'] ?? '3dsg8MUozTet9R93jJeV';
const EMAIL = process.env['SEED_EMAIL'];
const PASSWORD = process.env['SEED_PASSWORD'];

/** Colecciones array: [nombre Firestore, datos, ¿quitar `status` derivado?]. */
const COLLECTIONS: Array<[string, Array<{ id: string }>, boolean?]> = [
  ['supplies', MOCK_SUPPLIES],
  ['products', MOCK_PRODUCTS],
  ['recipes', MOCK_RECIPES],
  ['supply_stock', MOCK_SUPPLY_STOCK, true],
  ['product_stock', MOCK_PRODUCT_STOCK, true],
  ['kardex', MOCK_KARDEX],
  ['sale_records', MOCK_SALES],
  ['purchase_orders', MOCK_PURCHASE_ORDERS],
  ['orders', MOCK_ORDERS],
  ['customers', MOCK_CUSTOMERS],
  ['returned_lots', MOCK_RETURNED_LOTS],
  ['suppliers', MOCK_SUPPLIERS],
  ['urnas', MOCK_URNAS],
  ['urna_lotes', MOCK_URNA_LOTES],
  ['predictions', MOCK_PREDICTIONS],
];

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Falta SEED_EMAIL y/o SEED_PASSWORD (admin del tenant).');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const auth = getAuth(app);

  console.log(`Iniciando sesión como ${EMAIL}…`);
  await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  console.log(`OK. Sembrando tenant ${TENANT_ID}…\n`);

  let totalDocs = 0;
  for (const [name, items, stripStatus] of COLLECTIONS) {
    if (!items?.length) { console.log(`  ${name}: (vacío, omitido)`); continue; }
    // Firestore: máx 500 escrituras por batch; usamos 400 por margen.
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(fs);
      for (const item of items.slice(i, i + 400)) {
        const { id, ...rest } = item as Record<string, unknown> & { id: string };
        if (stripStatus) delete (rest as { status?: unknown }).status;
        batch.set(doc(fs, `tenants/${TENANT_ID}/${name}/${id}`), rest);
      }
      await batch.commit();
    }
    totalDocs += items.length;
    console.log(`  ${name}: ${items.length} docs`);
  }

  // Doc tipo Record: precios al consumidor (lo lee StoreSync en consumer_prices/_all).
  const batch = writeBatch(fs);
  batch.set(doc(fs, `tenants/${TENANT_ID}/consumer_prices/_all`), { values: MOCK_CONSUMER_PRICES });
  await batch.commit();
  console.log(`  consumer_prices/_all: 1 doc`);

  console.log(`\n✔ Listo: ${totalDocs + 1} documentos escritos en tenants/${TENANT_ID}.`);
  process.exit(0);
}

main().catch(err => {
  console.error('\n✖ Error sembrando el tenant:', err?.message ?? err);
  process.exit(1);
});
