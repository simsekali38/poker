/**
 * Copy to `environment.ts` / `environment.prod.ts` and fill in Firebase Console values.
 * Do not commit real secrets to public repos; use CI secrets for production builds.
 */
import { FirebaseOptions } from 'firebase/app';

export const environmentExample = {
  production: false,
  firebase: {
   apiKey: "AIzaSyAVDcFHjTkWskvjfsshrARhCj43IQ6WCQ4",
    authDomain: "pokerplanning-ec678.firebaseapp.com",
    projectId: "pokerplanning-ec678",
    storageBucket: "pokerplanning-ec678.firebasestorage.app",
    messagingSenderId: "641665394616",
    appId: "1:641665394616:web:a7798509670abe3058d14d",
    measurementId: "G-8LEKPYFN2L"
  } satisfies FirebaseOptions,
  useEmulators: false,
};
