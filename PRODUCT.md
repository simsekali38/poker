# Planning Poker — ürün kapsamı ve yol haritası

Bu dosya **insanlar ve Cursor/AI** için ortak referanstır: hangi yetkinliklerin önemli olduğu, MVP / v2 / v3 ayrımı ve repodaki **güncel durum** özeti.

---

## 1. Teknik skill set (AI ve geliştirici)

| Alan | Beklenti |
|------|----------|
| Angular standalone | Lazy route’lar, `inject()`, standalone bileşenler, minimal NgModule. |
| RxJS / Signals | Firestore birleşik akışlar (`switchMap`, `combineLatest`), `toSignal` / `signal` / `computed`; subscription sızıntısı yok. |
| Firestore realtime | Oturum, üye, hikâye, oy dokümanları; sorgu + index; moderator yazıları kurallarla korunmalı. |
| Auth / kimlik | Anonim (veya seçilen) auth; `authState` ile refresh sonrası guard; `localStorage` binding (`SessionLocalIdentityService`). |
| Role-based UI | Moderatör vs katılımcı: `canReveal`, `canResetRound`, story CRUD, hata mesajları. |
| Responsive | Dar ekranda voting önceliği, dokunmatik hedef boyutları, taşma yok. |
| Form handling | Reactive forms, validation, `aria-invalid`, submit busy state. |
| Component decomposition | Presentational (room-*) vs store/facade; repository token’ları. |
| Kalıcılık | Join/create sonrası binding; guard ile uyum. |

---

## 2. Ürün (product) skill set

| Alan | Beklenti |
|------|----------|
| Moderator flow | Oda oluştur, reveal, reset, story ekle/değiştir, davet. |
| Participant flow | Join, isim, oy, reveal sonrası sonuç görme. |
| Edge cases | Session yok / arşiv, aktif story yok, izin reddi, çift tıklama (busy). |
| Hidden / revealed | Round epoch, maskelenmiş kartlar, reveal sonrası herkes için aynı görünüm. |
| Conflict-free updates | Kaynak: Firestore; aynı oyuncu aynı round’da tek vote doc (id deterministik). |
| Empty / reconnect | Boş katılımcı, boş sonuç, yükleme vs “session yok” ayrımı; reconnect UX (v2). |

---

## 3. UX skill set

| Konu | Beklenti |
|------|----------|
| Oy verildi, henüz reveal yok | “Voted” / maskeli gösterim; moderatöre net reveal CTA. |
| Kim oy verdi / vermedi | Katılımcı listesinde oy durumu. |
| Moderator aksiyonları | Reveal, reset, story işlemleri görünür ve devre dışı (busy) iken güvenli. |
| Mobil deck | Grid kullanılabilir, odak/klavye; dar ekran düzeni. |
| Outlier | Reveal sonrası liste + sayısal ortalama; isteğe bağlı v3’te vurgu/grafik. |

---

## 4. MVP — ilk sürüm (hedef kapsam)

- [x] Create session  
- [x] Join session  
- [x] Display name  
- [x] Current story  
- [x] Vote deck  
- [x] Hidden votes (reveal öncesi)  
- [x] Reveal  
- [x] Reset round  
- [x] Average (sayısal oylar)  
- [x] Participant list  

> Not: Repoda birçok MVP maddesi **tamamlandı** sayılır; production için Firestore **rules** ve **index** zorunlu.

---

## 5. v2 — sonraki dalga

- [x] Multiple stories (temel)  
- [x] Story history / seçim  
- [ ] Online / offline durumu (heartbeat + rules, güvenilir `isOnline`)  
- [ ] Reconnect: ağ kopması, yeniden deneme, kullanıcıya net durum  
- [x] Anonymous auth (akışta kullanım)  
- [x] Invite UX (link kopyala; istenirse paylaşım API’si)  
- [ ] Session close / archive (moderatör UI + katılımcıya mesaj; modelde `archived` ile uyum)  

---

## 6. v3 — ileri özellikler

- [ ] Jira entegrasyonu  
- [ ] Sonuç export  
- [ ] Custom deck (UI + session ayarı)  
- [ ] Timer  
- [ ] Tartışma notları  
- [ ] Observer mode (sessiz izleyici)  
- [ ] Outlier görsel vurgu / istatistik  

---

## 7. AI / Cursor için kısa talimat

- Yeni özellik eklerken önce bu dosyadaki **v2 / v3** sırasına bak; MVP’yi gereksiz genişletme.  
- Firestore yazan her özellik için **rules** etkisini düşün.  
- Guard’lar: `sessionExistsGuard`, `participantReadyGuard` — auth **async** (`authState`), senkron `currentUser` ile guard yazma.  
- Moderator-only işlemler `SessionModerationService` + repository üzerinden; UI’da `can*` bayrakları ile hizala.  

---

*Son güncelleme: repodaki mevcut implementasyonla hizalanmıştır; checkbox’ları feature tamamlandıkça güncelleyin.*
