# 001 — Discovery: Wspólniak (prywatny rodzinny serwis)

**Status:** Discovery complete — gotowe do `/blueprint`
**Data:** 2026-04-09
**Autor sesji:** tkowalczyk + Claude (`/ask:ask`)

## Cel projektu

Prywatny "mini-Facebook" dla rodziny. Upload zdjęć, komentowanie, powiadomienia push. Open-source, self-hostable na Cloudflare, jedna instancja = jedna rodzina. Pierwsza instancja: `wspolniak.com` dla rodziny autora.

## Non-goals (MVP)

- Hasła, rejestracja, logowanie
- Multi-tenancy (każda rodzina = osobny deployment)
- Reakcje/lajki
- Albumy
- Wątkowane komentarze, @mentions
- Edycja zdjęć (tylko opisów)
- i18n (tylko polski)
- Avatary
- Rate limiting
- EXIF stripping
- Backupy poza durability CF
- Dystrybucja linków przez WhatsApp
- PIN / aktywacja urządzenia
- Branding poza nazwą rodziny (logo, kolory)
- Export danych, delete account (→ post-MVP)
- Docker / non-CF deployment

## Architektura

| Warstwa | Technologia |
|---|---|
| Frontend | TanStack Start (SSR + Router + Query) |
| Styling | Tailwind v4 + Shadcn (new-york, Zinc) |
| API | Hono na Cloudflare Workers |
| DB | Cloudflare D1 (SQLite) |
| Storage zdjęć | Cloudflare Images ($5/mies — konwersja HEIC + warianty) |
| PWA | `vite-plugin-pwa` (Service Worker, manifest, push) |
| Domena | `wspolniak.com` (custom domain, SSL Full Strict) |
| Język | TypeScript strict, Biome, pnpm |
| Licencja | **AGPL-3.0-or-later** |

## URL structure

- `wspolniak.com` — publiczny landing (opis projektu, link do GitHub)
- `wspolniak.com/app` — aplikacja (za auth wallem)
- `wspolniak.com/app/u/<token>` — magic link (ustawia cookie, redirect do `/app`)
- `wspolniak.com/setup` — claim instance flow (działa tylko przy pustej DB)

## Auth model

- **Magic link = tożsamość**. Surowy token w URL ustawia long-lived cookie po pierwszym wejściu. Brak haseł, brak PIN-u (post-MVP).
- Admin generuje linki dla członków i dystrybuuje poza systemem (post-MVP: WhatsApp share).
- Admin może **revoke** linku członka (wygenerować nowy → stary przestaje działać).
- Token przechowywany w D1 jako hash (nie plaintext).

## Provisioning self-hosted

- **"Deploy to Cloudflare" button** w README repo.
- Po pierwszym deploy: wejście na `/setup` → formularz (nazwa rodziny, nazwa admina) → utworzenie user z rolą `admin` → endpoint zwraca magic link → dalsze wejścia na `/setup` zwracają 404 (DB nie jest pusta).
- Zero CLI, zero ENV, zero wrangler secrets dla użytkownika końcowego.

## Model treści

### Post
- Autor, opis (text), 1..N zdjęć (max 10), timestampy, soft delete
- Edycja opisu: tak (autor + admin)
- Delete: autor (swoje) lub admin (wszystko)

### Komentarz
- Pod postem, flat chronologicznie (bez wątków)
- Edycja treści: tak (autor + admin)
- Delete: autor lub admin

### Feed
- Jeden wspólny wall chronologiczny (desc by `created_at`)
- **Infinite scroll, 20 postów/page**

## Upload zdjęć

- Accept: JPEG, PNG, WebP, HEIC, HEIF
- Limity: **10 zdjęć/post, 15 MB/zdjęcie, 50 postów/dzień/user**
- Flow: klient → Cloudflare Images Direct Upload URL → CF Images (konwersja HEIC→JPEG, warianty thumbnail/full/avif automatycznie) → backend zapisuje `cf_image_id` w D1
- EXIF: **nie ruszamy** w MVP

## Push notifications

- Web Push przez VAPID (Android + iOS 16.4+ PWA + desktop)
- **Triggery MVP:**
  - Nowy post → push do wszystkich członków (oprócz autora): _"Jan dodał zdjęcie"_
  - Nowy komentarz → push **tylko** do autora posta: _"Ania skomentowała Twoje zdjęcie"_
- Subskrypcje w D1 (`push_subscriptions`), cleanup wygasłych przy wysyłce (410 Gone)
- iOS UX gotcha: onboarding wymusza "Dodaj do ekranu głównego" **przed** pytaniem o permission — bez tego iOS nie pokaże dialogu

## Offline / PWA cache

- Shell aplikacji: **CacheFirst**
- Obrazki z CF Images: **CacheFirst** (immutable URLs)
- Feed (API): **NetworkFirst** (zawsze świeży jeśli online, fallback do cache offline)
- Manifest: nazwa "Wspólniak", ikona, theme color z CSS vars

## Prywatność

- Zdjęcia za auth wallem (cookie)
- Edycja opisów: tak
- Delete własnych postów/komentarzy: tak
- Delete wszystkiego: admin
- Export danych / delete account: **post-MVP**

## Schema D1 (draft)

```sql
users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','member')),
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
)

posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  deleted_at INTEGER
)

post_images (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  cf_image_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  width INTEGER,
  height INTEGER
)

comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  deleted_at INTEGER
)

push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_success_at INTEGER
)

instance_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
-- keys: family_name, admin_id, setup_completed
```

Wszystkie tabele: soft delete via `deleted_at` (nullable, timestamp).

## Skala (MVP target)

- ~15 osób na instancję
- ~2 000 zdjęć/rok
- ~5 GB storage
- Mieści się z zapasem w CF free tier D1 + CF Images paid ($5/mies)

## Decyzje odrzucone (z uzasadnieniem)

- **Multi-tenant single instance** → komplikuje licencję, RODO, isolation. Per-rodzina osobny worker jest prostsze.
- **Postgres + Hyperdrive** → wyższa bariera dla self-hosterów. D1 wystarcza dla tej skali.
- **Docker deployment** → rozjeżdża stack (D1/R2 → Postgres/S3). CF-only = spójność.
- **Client-side HEIC conversion** (`heic2any`) → 2-5 MB WASM, wolne na starych telefonach. CF Images robi to lepiej za $5/mies.
- **PIN / device binding** → komplikuje UX dla babci. Happy path: rodzina ufa sobie.
- **EXIF GPS stripping** → przesuniete do post-MVP (rodzina za auth wallem, low risk).
- **Backup weekly cron** → post-MVP. R2/Images durability wystarcza.

## Open questions do adresu w `/blueprint` lub później

- **CF Images fallback dla self-hosterów bez budżetu** — dokumentacja na razie, abstrakcja `ImageStorage` dopiero gdy pojawi się użytkownik który tego potrzebuje (YAGNI)
- **Licencja SPDX headers** — dodać `// SPDX-License-Identifier: AGPL-3.0-or-later` w każdym source file po dodaniu `LICENSE`
- **Landing page content** — copy, screeny, link do GitHub (nie-techniczne, zostawiamy do fazy implementacyjnej)
- **Favicon / PWA icons** — potrzebne do manifestu PWA, ale nie blokują development

## Next step

`/blueprint` — wygeneruje PRD z user stories i acceptance criteria na bazie tego dokumentu.
