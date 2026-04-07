import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

/**
 * Placeholder for emulator connection, anonymous sign-in, and other bootstrap tasks.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseBootstrapService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  /** TODO: connect emulators when `environment.useEmulators`; optional `signInAnonymously`. */
  initialize(): void {
    void this.firestore;
    void this.auth;
  }
}
