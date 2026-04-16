import { FirebaseOptions } from 'firebase/app';

export const environment = {
  production: true,
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
  jiraIntegrationEnabled: true,
  /**
   * Jira API base (must include `/api`). FTP-only static hosting cannot run Node — deploy API on
   * another host (e.g. `https://poker-api.example.com/api`) and set `CORS_ORIGIN` to this SPA origin.
   * Single-host `/api` only when the same server proxies to Node.
   */
  jiraBackendApiUrl: 'https://poker-api.aliasyazilim.com/api',
  roundTimerUiEnabled: false,
};

