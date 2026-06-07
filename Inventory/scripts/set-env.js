/*
 * Genera src/environments/environment.ts y environment.prod.ts a partir de
 * variables de entorno. Se ejecuta en CI (GitHub Actions) antes del build,
 * leyendo los valores desde GitHub Secrets, para no versionar la config en el repo.
 *
 * Uso local (opcional): exporta las FIREBASE_* y corre `npm run config`.
 */
const fs = require('fs');
const path = require('path');

const firebase = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// measurementId es opcional (Analytics); el resto es obligatorio.
const missing = Object.entries(firebase)
  .filter(([k, v]) => !v && k !== 'measurementId')
  .map(([k]) => k);

if (missing.length) {
  console.error('[set-env] Faltan variables de entorno de Firebase: ' + missing.join(', '));
  process.exit(1);
}

const fileBody = (production) => `// ARCHIVO AUTO-GENERADO por scripts/set-env.js — NO editar a mano, NO commitear.
// Las claves web de Firebase NO son secretas (van en el bundle); la seguridad
// la dan las reglas de Firestore/Storage. Se inyectan en build desde GitHub Secrets.
export const environment = {
  production: ${production},
  firebase: ${JSON.stringify(firebase, null, 4).replace(/\n/g, '\n  ')},
};
`;

const dir = path.join(__dirname, '..', 'src', 'environments');
fs.writeFileSync(path.join(dir, 'environment.ts'), fileBody(false));
fs.writeFileSync(path.join(dir, 'environment.prod.ts'), fileBody(true));
console.log('[set-env] environment.ts y environment.prod.ts generados.');
