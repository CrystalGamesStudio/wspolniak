# Push Notifications — Debugging Runbook

Praktyczny przewodnik diagnostyczny na wypadek "powiadomienia nie działają".
Powstał po incydencie #20→#24 (kwiecień 2026), gdy łańcuch pięciu niezależnych
bugów blokował push end-to-end. Każdy z tych bugów ma charakterystyczny ślad —
mając logi, w 30 sekund wiesz, który to z pięciu.

## Pierwsze kroki

1. **Cloudflare Dashboard → Workers → wspolniak → Logs.** Filtruj `[push]`.
   Observability jest włączone (`wrangler.jsonc` → `observability.enabled: true`)
   z 7-dniową retencją i 100% sampling, więc każdy event jest tam.
2. **Bez podglądu** — `pnpm wrangler tail --env production --format pretty`.
3. **Stan DB** — `pnpm db:production:studio` → tabela `push_subscriptions`.

## Pełna ścieżka push

```
1. Klient (iPhone PWA / Chrome desktop)
   └─ navigator.serviceWorker.register("/sw.js")          # src/components/pwa/pwa-shell.tsx
   └─ Notification.requestPermission()                    # src/pwa/use-push-subscription.ts
   └─ GET /api/app/push/vapid-key                         # src/hono/api/push.ts (no auth)
   └─ pushManager.subscribe({ applicationServerKey })
   └─ POST /api/app/push/subscribe                        # → push_subscriptions DB row

2. User B komentuje post User A
   └─ POST /api/app/posts/:postId/comments                # src/hono/api/comments.ts
   └─ c.executionCtx.waitUntil(notifyNewComment(...))     # src/core/notify.ts
   └─ fanOutPush — dla każdej subskrypcji:                # src/core/push.ts
        └─ buildVapidAuthHeader (JWT ES256)               # src/core/web-push.ts
        └─ encryptPayload (AES-128-GCM, ECDH P-256)
        └─ POST do endpoint (web.push.apple.com/...)

3. iPhone odbiera
   └─ sw.js push event listener                           # public/sw.js
   └─ self.registration.showNotification(...)
   └─ Po kliknięciu — notificationclick handler
   └─ clients.openWindow("/app/post/POSTID")
```

## Mapa pięciu bugów

| # | Symptom | Log signature | Plik | Commit fix |
|---|---------|---------------|------|-----------|
| 20 | `curl /api/app/push/vapid-key` zwraca `{"error":"Unauthorized"}` mimo brak auth | brak — endpoint zwraca 401, hook silently fails | `src/hono/api.ts` (kolejność route'ów) | `e8260f3` |
| 21 | `push_subscriptions` puste mimo że user kliknął "Włącz". `navigator.serviceWorker.ready` nie rezolwuje | brak — wszystko silently hangs. `curl https://wspolniak.com/sw.js` zwraca 404 | `src/components/pwa/pwa-shell.tsx` (rejestracja SW) | `5cebde0` |
| 22 | Subskrypcja zapisuje się, ale push nie dociera | `[push] threw { error: "DataError: Invalid PKCS8 input." }` | `src/core/web-push.ts:importVapidPrivateKey` | `84087cb` |
| 23 | Push wychodzi z serwera, Apple zwraca 403 | `[push] non-OK response { status: 403, body: "{\"reason\":\"BadJwtToken\"}" }` | `src/hono/api/comments.ts` / `posts.ts` (subject) | `445e4a4` |
| 24 | Notyfikacja przychodzi, klik → "Not Found" w aplikacji | brak server-side; URL w payload niezgodny z route | `src/core/push.ts:buildPushPayload` | `e98c54f` |

## Jak diagnozować po error message

### `Invalid PKCS8 input` / `not enough data` / `asn1 encoding routines`
**Bug #22.** VAPID_PRIVATE_KEY w `.production.vars` jest w innym formacie niż
spodziewany. Sprawdź długość po base64-decode:
- 32 bytes → raw scalar (z `web-push generate-vapid-keys`)
- ~138 bytes → PKCS8 DER (z `crypto.subtle.exportKey("pkcs8", ...)`)

Kod akceptuje oba formaty od `84087cb`. Jeśli wraca, sprawdź czy ktoś nie wkleił
kluczy z paddingiem albo jako hex zamiast base64.

### `BadJwtToken` (status 403, endpoint `web.push.apple.com`)
**Bug #23 lub klucze nie matchują.** Najczęściej:
1. `sub` w JWT jest podwójnie zaprefiksowany `mailto:mailto:...` — fix w `445e4a4`
2. `VAPID_PUBLIC_KEY` i `VAPID_PRIVATE_KEY` nie są parą — uciekły gdzieś po drodze
3. JWT `exp` > 24h od `iat` — kod ustawia 12h, więc bezpieczne, ale gdyby się
   zmieniło, Apple odrzuci

Weryfikacja par kluczy: import private (raw) jako JWK używając publicznego X/Y
i sprawdź czy się udaje. Jeśli `crypto.subtle.importKey` rzuci → klucze nie są parą.

### `BadVapidKey` / `InvalidArgument` (FCM / Mozilla)
Zwykle ten sam zestaw przyczyn co `BadJwtToken` na Apple. FCM bywa bardziej
informatywny w `body` — czytaj `[push] non-OK response { body: ... }`.

### Status 410 Gone
**Subskrypcja wygasła** (user odinstalował PWA, wyczyścił dane Safari, zmienił
device). `fanOutPush` automatycznie usuwa wiersz z `push_subscriptions`.
Jeśli widzisz tysiące 410 — czas na cron cleanup (zob. backlog).

### Status 413 Payload Too Large
Encrypted payload > 4096 bytes. `buildPushPayload` produkuje krótkie payloady
(title + 100-char snippet), ale sprawdź czy ktoś nie zwiększył `slice(0, 100)`
w `comments.ts`.

### Status 429 Too Many Requests
Rate limit u push providera. Rzadkie dla rodzinnej apki. Backoff — żaden
mechanizm nie jest wbudowany; `fanOutPush` używa `Promise.allSettled`, więc
jedna 429 nie blokuje innych.

### `[push] threw { error: "TypeError: Failed to fetch" }`
Sieć. Cloudflare Worker nie dosięgnął push providera. Sprawdź czy nie ma
outage'u u Apple/Google (status pages).

### Brak `[push]` logów w ogóle mimo komentarza
Po kolei:
1. **Skip-self** — `notifyNewComment` zwraca early jeśli `commentAuthorId === postAuthorId`. Komentujesz własny post tym samym kontem? To nie bug.
2. **VAPID env** — `c.env.VAPID_PUBLIC_KEY && c.env.VAPID_PRIVATE_KEY` w `comments.ts`. Sprawdź `pnpm wrangler secret list --env production` (lub w dashboardzie).
3. **Brak subskrypcji u odbiorcy** — `getSubscriptionsByUserId(postAuthorId)` zwraca `[]` → `fanOutPush` nie iteruje. Sprawdź DB.
4. **`waitUntil` nie odpalił** — niezwykle rzadkie, ale CF Workers ma limit 30s. Jeśli komentarz POST trwa długo (np. wolny insert), waitUntil mógł zostać odcięty. Logi tail powinny pokazać.

### Notyfikacja przychodzi ale klik prowadzi w nieznane
**Bug #24.** Sprawdź czy URL z payloadu (zapisany w `data.url`) matchuje route
file w `src/routes/app/`. TanStack Router używa file-based routing — `post.$id.tsx` → `/app/post/$id`. Pomyłka liczby pojedynczej/mnogiej zdarzała się.

### Subskrypcja zapisała się, ale push nie dociera mimo czystych logów
**Najczęściej duplikaty w DB** (incydent z 25.04.26 — iPhone 17 Pro). iOS rotuje
endpoint po reinstallu PWA / wyczyszczeniu danych Safari, a `saveSubscription`
robi `onConflictDoUpdate` tylko na `endpoint` — więc ten sam user może mieć N wierszy.
Server wysyła do każdego, ale klient nasłuchuje tylko jednego.

Quick fix przez DB: `DELETE FROM push_subscriptions WHERE user_id = '<id>'`,
potem user ponownie klika "Włącz" → świeży wiersz.

Długoterminowo — patrz backlog: dedupe per `user_id` w `saveSubscription` lub
24h cron czyszczący stale endpoints przez no-op ping.

### Inne podejrzane scenariusze

- **Tryb skupienia / Focus / Nie przeszkadzać** na iOS — push doszedł, ale system
  go ucisza. Sprawdź Settings → Powiadomienia → Wspólniak.
- **Background App Refresh wyłączony** — push może opóźnić się dramatycznie.
- **iOS nie zaktualizowany** — push dla PWA wymaga iOS 16.4+. iPhone w trybie
  oszczędzania baterii też potrafi dropować.
- **PWA otwarte w Safari, nie z home screen** — iOS nie wysyła push do tab'a Safari.
  Tylko do PWA z ekranu głównego. Jeśli ktoś otworzył ze zwykłego linku → musi
  dodać do ekranu głównego.

## Quick checklist dla nowego incydentu

1. CF Logs: czy są `[push]` errory? → tabela powyżej
2. DB: ile wierszy `push_subscriptions` ma odbiorca?
3. DB: czy ktoś **inny niż autor postu** ma subskrypcję? (skip-self)
4. PWA: zainstalowane jako home screen? (Settings → ogólne → "Wspólniak" lub Mac+Safari Web Inspector → console)
5. Test izolowany: w terminalu zmień `c.env.VAPID_*` na świeżo wygenerowane
   `web-push generate-vapid-keys` (na stagingu!) i sprawdź czy nowe subskrypcje
   działają — eliminuje hipotezę zepsutych kluczy.

## Dodatkowe odnośniki

- RFC 8030 — Generic Event Delivery Using HTTP Push
- RFC 8291 — Message Encryption for Web Push
- RFC 8292 — VAPID for Web Push
- [Apple Push Notification](https://developer.apple.com/documentation/usernotifications/sending_web_push_notifications_in_web_apps_and_browsers)
- [vite-pwa #902](https://github.com/vite-pwa/vite-plugin-pwa/issues/902) — niekompatybilność z TanStack Start
