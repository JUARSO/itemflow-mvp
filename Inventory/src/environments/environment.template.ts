// PLANTILLA de referencia. Los archivos reales (environment.ts / environment.prod.ts)
// se generan con `scripts/set-env.js` y están en .gitignore para no versionar la config.
//
// Dev local: exporta las variables FIREBASE_* y corre `npm run config`,
// o crea environment.ts a mano copiando esta estructura con tus valores.
export const environment = {
  production: false,
  firebase: {
    apiKey: 'FIREBASE_API_KEY',
    authDomain: 'FIREBASE_AUTH_DOMAIN',
    projectId: 'FIREBASE_PROJECT_ID',
    storageBucket: 'FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
    appId: 'FIREBASE_APP_ID',
    measurementId: 'FIREBASE_MEASUREMENT_ID',
  },
};
