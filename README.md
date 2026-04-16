# Planning Poker (Angular + Firebase)

Realtime planning poker: **Angular 19** (standalone, strict TypeScript), **Firestore** via `@angular/fire`, repository interfaces, lazy-loaded routes, and moderator flows (reveal, reset, stories).

## Prerequisites

- **Node.js** LTS (v20+ recommended), **npm** 10+
- A **Firebase** project: **Firestore**, **Anonymous Authentication** (recommended), optional **Hosting**

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:4200/`.

### Environment

1. Copy values from Firebase Console → Project settings → Your apps → Web app config into:
   - `src/environments/environment.ts` (dev)
   - `src/environments/environment.prod.ts` (production build via `fileReplacements`)
2. See `src/environments/environment.example.ts` for the full shape.
3. Optional: `useEmulators: true` and wire emulators in bootstrap when you add local emulator usage.

### Routes

| Path | Purpose |
|------|---------|
| `/` | Home |
| `/session/create` | Create session (Firestore batch + navigate to room) |
| `/session/join/:sessionId` | Validate session → display name → `members/{uid}` + local binding |
| `/session/:sessionId` | Planning room (`sessionExistsGuard` → `participantReadyGuard`) |

Wildcard routes redirect to `/`.

### Guards

- **`sessionExistsGuard`** — Session document must exist and **`status !== 'archived'`** (archived sessions are sent to join, which shows “closed”).
- **`participantReadyGuard`** — Waits for the first **`authState`** emission (so anonymous auth restore after refresh works), then requires a **local binding** whose `memberId` matches `auth.uid` (`SessionLocalIdentityService`).

### Build

```bash
npm run build
```

Output: `dist/poker-planning` (confirm `browser` subfolder for Hosting vs your Angular builder).

## Firestore data model (summary)

- **`planning_poker_sessions/{sessionId}`** — Session, `settings`, `revealState`, `activeStoryId`, `moderatorId`, `status`.
- **`.../members/{uid}`** — Display name, role, presence fields.
- **`.../stories/{storyId}`** — Title, description, status.
- **`.../votes/{voteId}`** — `storyId`, `roundEpoch`, `memberId`, `selectedCard` (composite query: `storyId` + `roundEpoch`).

**Indexes:** Create composite indexes when the console suggests them (votes query). Stories list uses `orderBy('createdAt', 'desc')` on the stories subcollection.

## Security rules (required for production)

Rules are **not** shipped in this repo. Before production, deploy rules that enforce at least:

- **Read** session (and subcollections as needed) only for authenticated users where appropriate.
- **Create session** only when `request.auth.uid == request.resource.data.moderatorId`.
- **Members** — create/update own doc; moderator updates without role downgrade bugs.
- **Moderator-only** — `revealState`, `activeStoryId`, story create/update/switch, **delete votes** on reset.
- **Votes** — participants write only their own vote doc for the current ruleset.

## Project layout

- `server-dotnet/PokerPlanning.Api` — **Jira integration API** (OAuth, issue preview, sync estimate, sprints). Run with `dotnet run`; see `server-dotnet/README.md` and `docs/JIRA_ARCHITECTURE.md`. Angular `jiraBackendApiUrl` must point at this host’s `/api` base.
- `src/app/core` — Guards, models, services, tokens, utilities
- `src/app/shared` — UI widgets, pipes, directives, utils
- `src/app/features` — `home`, `session-create`, `session-join`, `planning-session`
- `src/app/data` — Firebase paths, mappers, repository interfaces + Firestore implementations

### Repository tokens (`app.config.ts`)

`SESSION_REPOSITORY`, `SESSION_MEMBER_REPOSITORY`, `STORY_REPOSITORY`, `VOTE_REPOSITORY` — feature code should depend on tokens, not concrete classes.

## Local identity

After create or join, the app stores `{ memberId, displayName }` under  
`localStorage` key `poker-planning:session:{sessionId}` (`SessionLocalIdentityService`). Clearing storage or signing out invalidates the room guard until you join again.

## Tests

```bash
npm test
```

## Known limitations / follow-ups

- **Offline / persistence** — Firestore offline behavior and explicit cache strategy are not customized here.
- **Presence (`isOnline`)** — Heartbeats may need tightening for production accuracy.
- **Bundle size** — Initial budget may exceed default; tune lazy chunks or budgets in `angular.json` if needed.
- **E2E** — No Playwright/Cypress in scaffold; add for critical flows (create → join → vote → reveal).
