import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from '@env/environment';

/**
 * Firebase app + Firestore + Auth. TODO: when `environment.useEmulators` is true,
 * call `connectFirestoreEmulator` / `connectAuthEmulator` once after bootstrap (e.g. in `APP_INITIALIZER` or `main.ts`).
 */
export function provideFirebaseAppAndFirestore() {
  return [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
  ];
}
