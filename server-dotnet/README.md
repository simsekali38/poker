# Planning poker — Jira API (ASP.NET Core)

Tek backend: Angular uygulaması Jira OAuth, issue önizleme, tahmin gönderimi ve sprint listesi için bu API’yi kullanır.

**Uçlar:** `GET /api/health`, `GET /api/cors-check`, `POST /api/jira/oauth/start`, `GET /api/jira/oauth/callback`, `GET /api/jira/issues/{key}`, `GET /api/jira/boards`, `GET /api/jira/board-sprints`, `POST /api/jira/sync-estimate`.

Angular tarafında `jiraBackendApiUrl` tam taban adresidir (ör. `https://poker-api.../api`).

## Gereksinimler

- [.NET 7 SDK](https://dotnet.microsoft.com/download/dotnet/7.0) (7.0.x)
- Windows’ta IIS ile yayın için: [ASP.NET Core Hosting Bundle 7.0](https://dotnet.microsoft.com/download/dotnet/7.0)

## Yerel çalıştırma

```bash
cd server-dotnet/PokerPlanning.Api
dotnet run
```

`Properties/launchSettings.json` içinde varsayılan: **`http://localhost:4000`** (Angular `environment.ts` ile uyumlu).

Ortam değişkenlerini `appsettings.Development.json`, kullanıcı sırları veya süreç ortamı ile verin (aşağıdaki tablo).

## Ortam değişkenleri

| Anahtar | Açıklama |
|--------|----------|
| `ConnectionStrings__Default` | SQLite: `Data Source=./data/app.db` (yol uygulama köküne göre çözülür) |
| `CorsOrigin` | `https://spa.example.com` veya `*` (geliştirme) |
| `TokenEncryptionKey` | Base64 (32 bayt) — Atlassian token şifrelemesi |
| `Atlassian__ClientId`, `Atlassian__ClientSecret`, `Atlassian__OAuthRedirectUri`, `Atlassian__Scopes` | Atlassian OAuth (aşağıdaki scope örneğine bakın) |
| `JiraStoryPointsFieldId`, `JiraDefaultBoardId` | İsteğe bağlı |
| `JiraUseBoardEstimation`, `JiraIncludeAuditProperty` | `true` / `false` |
| `FirebaseServiceAccountJson` | Tek satır service account JSON |
| `DevSkipAuth`, `DevFirebaseUid` | Sadece geliştirme |

`PORT` ortam değişkeni verilirse Kestrel `http://0.0.0.0:{PORT}` dinler.

### Atlassian OAuth — `Atlassian__Scopes`

[Agile board](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/#api-rest-agile-1-0-board-get) ve sprint uçları **Jira Software** granular scope’ları ister; yalnızca klasik `read:jira-work` / `write:jira-work` ile `GET …/rest/agile/1.0/board` çağrıları **`401` + `"scope does not match"`** dönebilir. Bu projede **doğrulanmış** yapılandırma aşağıdaki **referans** satırıdır.

**Kurulum (her ortam için aynı mantık):**

1. [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/) → uygulamanız → **Permissions** → **Code** sütunundaki scope’lar, referanstaki liste ile **birebir** aynı olsun.
2. `Atlassian__Scopes` ortam değişkeni **aynı** kodları içersin (boşlukla ayrılmış tek satır). Konsol ile string uyumsuzsa token eksik yetkiyle üretilir.
3. Scope ekledikten veya değiştirdikten sonra kullanıcılar **Connect Jira** ile OAuth’u **yeniden** tamamlamalıdır.

#### Referans — doğrulanmış `Atlassian__Scopes` (kopyala-yapıştır)

Granular Jira + Jira Software; refresh için `offline_access` dahil:

```
offline_access read:dashboard:jira write:dashboard:jira read:dashboard.property:jira write:dashboard.property:jira read:issue-details:jira read:project:jira read:board-scope.admin:jira-software write:board-scope.admin:jira-software read:board-scope:jira-software write:board-scope:jira-software read:issue:jira-software write:issue:jira-software read:sprint:jira-software write:sprint:jira-software
```

Üretimde tek satır olarak verin (satır sonu yok). İhtiyaç az ise bu listeden gereksiz scope’ları **hem konsoldan hem** `Atlassian__Scopes`’tan birlikte kaldırın; asgari board listesi için [resmi olarak](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/#api-rest-agile-1-0-board-get) `read:board-scope:jira-software` ve `read:project:jira` şarttır.

## IIS (Plesk)

1. Sunucuda **Hosting Bundle** kurulu olsun.
2. `dotnet publish -c Release -o C:\inetpub\poker-api` (örnek çıktı klasörü).
3. IIS’te uygulama havuzu: **No Managed Code**.
4. Site / alt uygulama fiziksel yol: publish klasörü.
5. `web.config` publish çıktısında üretilir.
6. Ortam değişkenlerini IIS site ayarları veya `web.config` `environmentVariables` ile verin.

## Veritabanı

İlk çalışmada SQLite şeması oluşturulur. Üretimde PostgreSQL için `UseNpgsql` + connection string değişikliği gerekir (şu an SQLite).

## Sorun giderme

- **`503` + `Firebase Admin is not configured`:** `FirebaseServiceAccountJson` doğru yapılandırılmalı.
- **`401`:** İstekte geçerli `Authorization: Bearer` + Firebase ID token yok veya süresi dolmuş.
- **`401` + Jira gövdesinde `"scope does not match"`:** Atlassian token’ında Agile/board için gerekli granular scope yok veya [Developer Console](https://developer.atlassian.com/console/myapps/)’daki izinler `Atlassian__Scopes` ile uyumsuz. Yukarıdaki scope bölümüne bakın; OAuth’u yenileyin.
- **`502`:** Jira API / token hatası; mesaj gövdesinde ayrıntı.

Service account ve Atlassian anahtarlarını repoya commit etmeyin.
