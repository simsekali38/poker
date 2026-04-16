import { FirebaseOptions } from 'firebase/app';

/** Development / local defaults. Replace via `environment.prod.ts` or emulators. */
export const environment = {
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
  /** When false, “Send to Jira” stays disabled and no HTTP calls are made. */
  jiraIntegrationEnabled: true,
  /**
   * Node API base (`/api` included), e.g. `http://localhost:4000/api`.
   * OAuth + issue fetch + sync-estimate are under this path (see `docs/JIRA_ARCHITECTURE.md`).
   */
  jiraBackendApiUrl: 'http://localhost:4000/api',
};
