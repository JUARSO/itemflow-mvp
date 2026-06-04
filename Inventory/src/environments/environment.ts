// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // TODO: pega aquí el firebaseConfig de tu proyecto (Firebase Console → ⚙️ → Tus apps).
  // Estas claves web NO son secretas (van en el bundle); la seguridad la dan las reglas.
  firebase: {
    apiKey: 'FIREBASE_API_KEY',
    authDomain: 'itemflow-app.firebaseapp.com',
    projectId: 'itemflow-app',
    storageBucket: 'itemflow-app.firebasestorage.app',
    messagingSenderId: '779468433375',
    appId: '1:779468433375:web:ee28012a586437df64c66a',
    measurementId: 'G-PLFY018X4Z',
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
