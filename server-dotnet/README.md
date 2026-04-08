# Planning poker — Jira API (.NET 7)

ASP.NET Core sürümü; Node (`server/`) ile aynı HTTP sözleşmesi: `GET /api/health`, `GET /api/cors-check`, `POST /api/jira/oauth/start`, `GET /api/jira/oauth/callback`, `GET /api/jira/issues/{key}`, `POST /api/jira/sync-estimate`.

Angular tarafında `jiraBackendApiUrl` değişmez (ör. `https://poker-api.../api`).

## Gereksinimler

- [.NET 7 SDK](https://dotnet.microsoft.com/download/dotnet/7.0) (7.0.x)
- Windows’ta IIS ile yayın için: [ASP.NET Core Hosting Bundle 7.0](https://dotnet.microsoft.com/download/dotnet/7.0) (aynı makinede .NET 7 runtime + IIS modülü)

## Yerel çalıştırma

```bash
cd server-dotnet/PokerPlanning.Api
copy ..\..\server\.env.example .env   # veya appsettings / user-secrets ile doldur
# Ortam değişkenleri veya appsettings — aşağıdaki anahtarlar
dotnet run
```

Varsayılan: `http://localhost:5000` / `https://localhost:5001` (`launchSettings.json`). Node ile aynı port için: `set PORT=4000` veya `launchSettings` içinde ayarlayın.

## Ortam değişkenleri (Node ile eşleşen isimler)

| Anahtar | Açıklama |
|--------|----------|
| `ConnectionStrings__Default` | SQLite: `Data Source=./data/app.db` (yol uygulama köküne göre çözülür) |
| `CorsOrigin` | `https://spa.example.com` veya `*` (geliştirme) |
| `TokenEncryptionKey` | Node ile aynı base64 (32 bayt) — mevcut DB şifreleri uyumludur |
| `Atlassian__ClientId`, `Atlassian__ClientSecret`, `Atlassian__OAuthRedirectUri`, `Atlassian__Scopes` | Atlassian OAuth |
| `JiraStoryPointsFieldId`, `JiraDefaultBoardId` | İsteğe bağlı |
| `JiraUseBoardEstimation`, `JiraIncludeAuditProperty` | `true` / `false` |
| `FirebaseServiceAccountJson` | Tek satır service account JSON |
| `DevSkipAuth`, `DevFirebaseUid` | Sadece geliştirme |

`PORT` ortam değişkeni verilirse Kestrel `http://0.0.0.0:{PORT}` dinler (Plesk / process manager uyumu).

## IIS (Plesk)

1. Sunucuda **Hosting Bundle** kurulu olsun.
2. `dotnet publish -c Release -o C:\inetpub\poker-api` (örnek çıktı klasörü).
3. IIS’te uygulama havuzu: **No Managed Code**.
4. Site / alt uygulama fiziksel yol: publish klasörü.
5. `web.config` publish çıktısında üretilir; `aspNetCore processPath="dotnet"` DLL’yi işaret eder.
6. Ortam değişkenlerini IIS site **Configuration Editor** veya `web.config` içinde `environmentVariables` ile verin (hassas değerleri tercihen kullanıcı gizli dizini / Plesk ortam ekranı).

## Veritabarı

İlk çalışmada `EnsureCreated()` ile SQLite şeması oluşturulur. Üretimde **PostgreSQL** kullanmak için `UseNpgsql` + connection string değişikliği gerekir (şu an SQLite).

**Node (Prisma) ile aynı `app.db` dosyasını** kullanacaksanız tablo adı ve kolonlar uyumludur; yine de yedek alın.

## Node sunucusu

Bu proje Node `server/` ile aynı API yüzeyini sağlar; biri yeterlidir. IIS uyumu için .NET sürümü tercih edilebilir.

## Sorun giderme

- **`503` + `Firebase Admin is not configured`:** `FirebaseServiceAccountJson` ya tek satır JSON string, ya da `appsettings` içinde **iç içe nesne** (`"type": "service_account", ...`) olabilir; ikisi de desteklenir. Ortam değişkeni kullanıyorsanız değer tek satır JSON string olmalı.
- **`401`:** İstekte geçerli `Authorization: Bearer` + Firebase ID token yok veya süresi dolmuş.
- **`502`:** Jira API / token hatası; mesaj gövdesinde ayrıntı.

Service account ve Atlassian anahtarlarını repoya commit etmeyin; üretimde kullanıcı sırları / ortam değişkenleri kullanın.
