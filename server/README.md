# Planning poker — Jira API server

Node.js (Express) service for Atlassian OAuth 2.0 (3LO), Jira REST calls, and syncing final estimates.

## Setup

1. Copy `.env.example` to `.env` and fill values (see `docs/JIRA_ARCHITECTURE.md`).

2. Generate an encryption key:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. Create an OAuth 2.0 (3LO) app in the [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/). Set the callback URL to match `ATLASSIAN_OAUTH_REDIRECT_URI` — locally e.g. `http://localhost:4000/api/jira/oauth/callback`, production single-host e.g. `https://poker.aliasyazilim.com/api/jira/oauth/callback`.

4. **Firebase Admin** (required for verifying Angular users’ ID tokens): paste the service account JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` (single line). Optional: same JSON enables server-side `jiraSyncedAt` updates on stories.

5. Install and database:

   ```bash
   npm install
   npx prisma db push
   ```

6. Run:

   ```bash
   npm run dev
   ```

   API base: `http://localhost:4000/api` (health: `GET /api/health`).

## Server folder layout (production)

Tek origin (`https://poker.aliasyazilim.com`) için tipik iki düzen:

### A) Nginx statik dosya + `/api` → Node (önerilen)

Sunucuda örneğin `/var/www/poker/`:

```text
/var/www/poker/
├── app/                          # Angular build (içerik)
│   ├── index.html
│   ├── main-*.js
│   └── …
└── api/                          # Node API (ayrı klasör — çalışma dizini)
    ├── dist/                     # `npm run build` çıktısı (server)
    ├── node_modules/
    ├── prisma/
    ├── package.json
    └── .env                      # üretim sırları (sunucuda)
```

- Yerel `npm run build` (repo kökü) → `dist/poker-planning/browser/` içeriğini sunucuda `app/` altına kopyala (veya rsync/scp ile `browser/` içeriği).
- API için `server/` klasörünü sunucuya al; orada `npm ci --omit=dev`, `npx prisma generate`, `npm run build`, `node dist/index.js` (veya systemd ile).
- Nginx: `root /var/www/poker/app;` ve `location /api/ { proxy_pass http://127.0.0.1:4000; }` (detay: `nginx-single-host.example.conf`).

### B) Tek Node süreci (Express SPA + API)

API ve statik tek process’te:

```text
/opt/poker/
├── dist/
│   └── poker-planning/
│       └── browser/              # Angular çıktısı
├── server/
│   ├── dist/
│   ├── package.json
│   ├── .env
│   └── …
```

`server/.env` içinde örneğin `STATIC_ROOT=../dist/poker-planning/browser` (çalışma dizinine göre ayarla; `server` içinden `node dist/index.js` ile çalışıyorsan `../dist/...` uygun olur).

### C) Windows paylaşımlı hosting (IIS)

**Sadece FTP:** Hosting’de Node yoksa `server/` uygulamasını bu ortamda **çalıştıramazsınız**. Angular build’i FTP ile yükleyin; API’yi Node’un çalabildiği **ayrı bir sunucuda** (VPS, Azure, Railway vb.) yayınlayın. Angular `environment.prod.ts` içinde `jiraBackendApiUrl` **tam API adresi** (`https://api.example.com/api`); API sunucusunda `CORS_ORIGIN` **SPA adresiniz** (`https://www.example.com`). İki host = bu model.

Çoğu paylaşımlı paket **Linux + Apache/cPanel** veya **Windows + IIS** sunar; sürekli çalışan **Node.js süreci** her zaman yoktur. Akış:

1. **Angular (statik site)**  
   - Yerelde: repo kökünde `npm run build`.  
   - Sunucuya yükle: `dist/poker-planning/browser/` **içindeki her şey** ( `index.html`, `*.js`, `*.css`, klasörler) + kökte gelen `web.config`.  
   - `web.config` repo’da `public/web.config` olarak durur; build ile `browser/` köküne kopyalanır — IIS’te **Angular route’ları** `index.html`e düşer, **`/api` istekleri** bu kurala takılmaz.

2. **Node API aynı domainde `/api`**  
   - Panelde **Node.js uygulaması** varsa: `server/` klasörünü yükleyin, giriş dosyası `dist/index.js`, ortam değişkenlerini panelden girin, panelin verdiği **iç port** ile uygulamayı dinletin.  
   - Bazı paneller `/api` için **reverse proxy** tanımlatır (IIS ARR veya özel “URL yönlendirme”). O zaman iç porttaki Node’a yönlendirilir.  
   - **Node yoksa** ve `/api` yönlendirilemiyorsa: API’yi ayrı bir VPS/Azure/App Service üzerinde çalıştırıp `environment.prod.ts` içinde `jiraBackendApiUrl`i tam URL yapmanız gerekir (CORS’u API tarafında açın). Tek host + `/api` bu senaryoda mümkün olmayabilir.

3. **Veritabanı**  
   - SQLite kullanıyorsanız `DATABASE_URL` dosya yolu, uygulamanın **yazabildiği** bir klasörde olmalı (paylaşımlı hosting izinleri).  
   - Mümkünse üretimde **PostgreSQL** (panelden verilen bağlantı dizesi).

4. **Klasör örneği (sadece statik + IIS)**  

```text
httpdocs/   (veya panelin gösterdiği site kökü)
├── web.config
├── index.html
├── main-XXXX.js
├── chunk-XXXX.js
└── …
```

API ayrı çalışıyorsa ve panel `/api` → Node proxy destekliyorsa, Node uygulaması genelde panelin belirttiği alt dizinde veya ayrı bir “application” kökünde tutulur.

### Plesk panelde Node.js API (`poker-api` alt alan adı)

Şu an gördüğünüz **404 - File or directory not found**, isteğin **Node’a gitmediği** (yalnızca boş site / statik IIS) anlamına gelir. Plesk’te API’yi gerçekten çalıştırmak için:

1. **Node.js uzantısı**  
   *Araçlar ve ayarlar* → *Güncellemeler* / *Uzantılar* bölümünden **Node.js** kurulu olmalı. Yoksa hosting sağlayıcıdan açılmasını isteyin.

2. **Alt alan adı**  
   *Web siteleri ve alan adları* → `poker-api.example.com` (veya kullandığınız API hostu) → bu abonelik altında bir site oluşturulmuş olmalı.

3. **Dosyaları yükleme**  
   Repo’daki `server/` içeriğini (en azından `package.json`, `prisma/`, kaynak veya derlenmiş `dist/`) Plesk’te bu sitenin **doküman köküne** (genelde `httpdocs`) veya panelde gösterilen **uygulama köküne** yükleyin. Üretimde `dist/index.js` çalışacak şekilde sunucuda derleyin:
   - SSH veya *Plesk* → *Git* / *Scheduled tasks* ile: `npm ci --omit=dev`, `npm run build`, `npx prisma generate` (veya `prisma migrate deploy`).

4. **Node.js uygulamasını açma**  
   İlgili domain için **Node.js** sekmesi (veya *Hosting ayarları* → *Node.js*):
   - **Node.js sürümü:** 20.x LTS (önerilir).
   - **Uygulama kökü:** `package.json` dosyasının olduğu klasör (çoğu zaman `httpdocs`).
   - **Uygulama başlangıç dosyası:** `dist/index.js` (TypeScript derlendikten sonra).
   - **Uygulama modu:** production.
   - **NPM install:** Plesk arayüzünden bir kez çalıştırın; gerekirse `package.json` içindeki `start` script’i `node dist/index.js` olmalı (bu repoda `npm start` zaten bunu yapıyor).

5. **Ortam değişkenleri (.env)**  
   Plesk Node ekranında **Özel ortam değişkenleri** bölümüne `.env` içeriğini tek tek girin: `DATABASE_URL`, `CORS_ORIGIN`, `ATLASSIAN_*`, `TOKEN_ENCRYPTION_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, vb.  
   **`CORS_ORIGIN`** = Angular sitenizin tam adresi, örn. `https://poker.aliasyazilim.com` (sonda `/` yok).

6. **Veritabanı**  
   SQLite kullanıyorsanız `DATABASE_URL` yolu, aboneliğin **yazılabilir** bir klasörüne işaret etmeli (ör. `httpdocs` altında `data/prod.db` gibi). Mümkünse Plesk’te **PostgreSQL** veritabanı oluşturup `DATABASE_URL` ile bağlanın.

7. **Yeniden başlat / etkinleştir**  
   Değişikliklerden sonra Node uygulamasını **Yeniden başlat** / **Etkinleştir** ile çalıştırın.

8. **Doğrulama**  
   Tarayıcıda: `https://poker-api.../api/health` → JSON `{"ok":true,...}` dönmeli. Hâlâ IIS 404 ise Node uygulaması o domain’e bağlı değildir veya başlangıç dosyası/port yanlıştır.

---

## Production notes

- Replace SQLite with PostgreSQL (`DATABASE_URL`) and run Prisma migrations.
- **Single host (recommended):** Serve the Angular app and API under one origin (e.g. `https://poker.aliasyazilim.com`). Build the client with `jiraBackendApiUrl: '/api'`, proxy `/api` to this server (Nginx), or set `STATIC_ROOT` to the Angular `browser` output folder so Express serves the SPA + API on one port. Same-origin requests do not need CORS; `CORS_ORIGIN=*` is fine.
- **Two hosts:** Set `CORS_ORIGIN` to the **exact** SPA origin, e.g. `https://poker.aliasyazilim.com` (no trailing slash). If users open `https://www....`, add that origin too, comma-separated. Redeploy/restart Node after changing env. Health: `GET /api/cors-check` with header `Origin: https://poker.aliasyazilim.com` should return `"allowed": true`. If preflight still has no `Access-Control-Allow-Origin`, the request is **not reaching Node** (reverse proxy returning 403/502 for `OPTIONS` — fix proxy, do not short-circuit OPTIONS).

### CORS hâlâ hata veriyorsa

1. API sunucusunda: `CORS_ORIGIN=https://poker.aliasyazilim.com` (örnek) ve process **yeniden başlatıldı** mü?
2. Tarayıcıdan veya curl: `curl -sI -X OPTIONS "https://poker-api.aliasyazilim.com/api/jira/oauth/start" -H "Origin: https://poker.aliasyazilim.com" -H "Access-Control-Request-Method: POST"` — yanıtta `access-control-allow-origin` var mı?
3. Yoksa istek Node’a gelmiyordur (IIS/Nginx `OPTIONS`’ı kesiyor veya 502). Proxy’de tüm metotları Node’a iletin.

- Set `ATLASSIAN_OAUTH_REDIRECT_URI` to the **public** callback URL (must match the Atlassian app).
- Run multiple API instances with a shared OAuth **state** store (Redis) instead of in-memory `oauthStateStore`.
- Store `TOKEN_ENCRYPTION_KEY` in a secrets manager.
