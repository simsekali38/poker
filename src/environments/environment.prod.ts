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
   * Jira API base (must include `/api`). Deploy `server-dotnet/PokerPlanning.Api` (IIS/Kestrel) and point
   * `CorsOrigin` to this SPA origin. Example: `https://poker-api.example.com/api`.
   */
  jiraBackendApiUrl: 'https://poker-api.aliasyazilim.com/api',
  roundTimerUiEnabled: false,
};

