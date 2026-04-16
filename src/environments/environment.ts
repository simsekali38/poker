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
   * ASP.NET Core Jira API base (`/api` included), e.g. `http://localhost:4000/api` (`dotnet run` in `server-dotnet/PokerPlanning.Api`).
   * OAuth, issue fetch, sync-estimate, board-sprints — see `docs/JIRA_ARCHITECTURE.md` and `server-dotnet/README.md`.
   */
  jiraBackendApiUrl: 'http://localhost:4000/api',
  /** Round timer panel in the planning room (`app-room-circular-timer`). Default off. */
  roundTimerUiEnabled: false,
};
