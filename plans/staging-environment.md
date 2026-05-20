# Plan: Środowisko staging

> Source PRD: [issue #63 — Wprowadzenie środowiska staging](https://github.com/CrystalGamesStudio/wspolniak/issues/63)

## Architectural decisions

Durable decisions, które obowiązują we wszystkich fazach:

- **Trzy środowiska totalne**: `dev` (lokalny vite + worker `wspolniak-dev`), `staging` (worker `wspolniak-staging` pod `staging.wspolniak.com`), `production` (worker `wspolniak` pod `wspolniak.com`).
- **Staging żyje wyłącznie na Cloudflare** — brak wariantu `vite dev --mode staging`. Każdy test stagingu wymaga deploya.
- **Izolacja per env**:
  - osobny Cloudflare Worker (`wspolniak-staging`)
  - osobny Neon Postgres branch (`staging`)
  - osobny `SESSION_SECRET`
  - osobne klucze VAPID
  - osobny `CACHE_NAME` service workera
  - osobny magic link admina
- **Współdzielone z produkcją** (świadoma decyzja, niska wrażliwość):
  - Cloudflare Images (account hash + API token)
- **Domena**: `staging.wspolniak.com` jako custom domain w CF (DNS proxied, ten sam zone co prod).
- **Trigger deploya**: wyłącznie ręczny (`pnpm deploy:staging`), brak CI/CD automation w MVP.
- **Symetria nazewnictwa skryptów**: każdy nowy npm-script ma formę `*:staging:*` analogiczną do istniejących `*:production:*` i `*:dev:*`.
- **Sekrety**: runtime sekrety w `.staging.vars` (dotenvx), nie w `wrangler.jsonc`. Tylko niewrażliwe vars (`APP_URL`) w `wrangler.jsonc:env.staging.vars`.
- **Migracje**: osobny katalog `src/db/migrations/staging/` + `drizzle-staging.config.ts` — staging nie współdzieli plików migracji z prod.
- **Dostęp**: publiczny + `X-Robots-Tag: noindex` + `robots.txt Disallow: /`. Brak basic-auth, brak CF Access.

---

## Phase 1: Tracer worker

**User stories**: 1, 2, 15, 17, 18, 19, 21

### What to build

Najcieńszy możliwy end-to-end smoke: pusty worker stagingu deployowany ręczną komendą, wystawiony pod `staging.wspolniak.com`, identyfikujący się przez `/api/health` jako środowisko `staging`. Bez bazy, bez seedów, bez noindex, bez integracji push.

Zakres pełnego pipeline'u w tej fazie:
- Sekcja `env.staging` w konfiguracji Workera (custom domain, vars z `APP_URL`, observability).
- Plik `.staging.vars` z minimalnym zestawem (`CLOUDFLARE_ENV=staging`) i jego ignorowanie w gicie.
- Szablon `.staging.example.vars` zacommitowany jako referencja dla zespołu.
- Skrypty `build:staging` (vite mode `staging`) i `deploy:staging` (build + wrangler deploy).
- Rekord DNS `staging.wspolniak.com` w Cloudflare (krok ręczny, dokumentowany).
- Endpoint `/api/health` już istnieje i czyta `CLOUDFLARE_ENV` — weryfikujemy że po deployu zwraca `"staging"`.

### Acceptance criteria

- [ ] `pnpm deploy:staging` przechodzi bez błędów Wranglera.
- [ ] `curl https://staging.wspolniak.com/api/health` zwraca `200` z `env: "staging"`.
- [ ] W Cloudflare Dashboard widoczny worker `wspolniak-staging` z routem `staging.wspolniak.com`.
- [ ] Worker `wspolniak` (prod) i `wspolniak-dev` pozostają nietknięte (zero regresji listingu).
- [ ] `.staging.vars` w `.gitignore` (`git check-ignore -v .staging.vars` zwraca match).
- [ ] `.staging.example.vars` zacommitowany do repo i zawiera komplet kluczy potrzebnych w późniejszych fazach (przygotowane jako referencja, wartości puste).
- [ ] Procedura ustawienia DNS udokumentowana w pliku referencyjnym (np. AGENTS.md sekcja staging).

---

## Phase 2: Baza staging

**User stories**: 3, 4, 5, 7, 8

### What to build

Staging worker łączy się z **własnym** Neon branchem `staging` — fizycznie odseparowanym od dev i prod. Pełny zestaw skryptów Drizzle dla stagingu odpalany przez `dotenvx` z `.staging.vars`. Migracje aplikowane od zera w osobnym katalogu (`src/db/migrations/staging/`). Health endpoint rozszerzony o ping bazy żeby udowodnić połączenie.

Zakres:
- Utworzenie Neon branch `staging` (Dashboard Neon).
- Uzupełnienie `.staging.vars` o `DATABASE_HOST/USERNAME/PASSWORD`.
- Nowy `drizzle-staging.config.ts` symetryczny do prod/dev configów.
- Komplet skryptów: `db:staging:generate`, `db:staging:migrate`, `db:staging:pull`, `db:staging:studio`.
- Pierwsza migracja zaaplikowana — schemat staging zgodny ze schematem aplikacji.
- Health endpoint rozszerzony o status połączenia DB (przy okazji weryfikacja stage-1 że worker faktycznie ma sekrety).

### Acceptance criteria

- [ ] Neon branch `staging` widoczny w Dashboard Neon, niezależny od `dev` i `main` (prod).
- [ ] `pnpm db:staging:generate` produkuje pliki w `src/db/migrations/staging/`.
- [ ] `pnpm db:staging:migrate` aplikuje migracje bez błędów.
- [ ] `pnpm db:staging:pull` reprodukuje aktualny schemat bez różnic od `src/db/schema.ts`.
- [ ] `pnpm db:staging:studio` otwiera Drizzle Studio podpięte do bazy staging.
- [ ] Health endpoint na `staging.wspolniak.com` zwraca `db: "ok"` (lub równoważny sygnał połączenia).
- [ ] Konfiguracja prod i dev (`db:production:*`, `db:dev:*`) nadal działa — zero regresji w istniejących skryptach.

---

## Phase 3: Noindex / SEO

**User stories**: 14

### What to build

Staging publiczny, ale niewidzialny dla wyszukiwarek. Middleware (Hono / `server.ts`) ustawia `X-Robots-Tag: noindex, nofollow` na wszystkich odpowiedziach gdy runtime wykryje `CLOUDFLARE_ENV === "staging"`. Endpoint `/robots.txt` zwraca pełny disallow na stagingu, normalny robots na prod. Testy jednostkowe gwarantują brak regresji prod.

### Acceptance criteria

- [ ] `curl -I https://staging.wspolniak.com/` zawiera `X-Robots-Tag: noindex, nofollow`.
- [ ] `curl https://staging.wspolniak.com/robots.txt` zwraca `User-agent: *\nDisallow: /`.
- [ ] `curl -I https://wspolniak.com/` **NIE** zawiera `X-Robots-Tag: noindex` (regresja prod).
- [ ] `curl https://wspolniak.com/robots.txt` zachowuje obecne zachowanie prod (treść lub 404 — bez zmian).
- [ ] Test jednostkowy middleware: dla `CLOUDFLARE_ENV=staging` header dodany; dla `production` header nieobecny; dla `dev` (lokalnie) header nieobecny.
- [ ] `pnpm test` przechodzi bez nowych failów.

---

## Phase 4: Izolacja sekretów (sesje, push, admin)

**User stories**: 9, 12, 13

### What to build

Pełna izolacja warstwy bezpieczeństwa stagingu od prod. Każdy sekret, który dotyka tożsamości użytkownika lub kanałów komunikacji, dostaje własną wartość. Magic link admina dla stagingu wskazuje na `staging.wspolniak.com` (nie prod). Subskrypcja Web Push z urządzenia testera nie trafia na konto z prod i odwrotnie.

Zakres:
- Wygenerowanie nowej pary VAPID (`web-push generate-vapid-keys`) dla stagingu.
- Wygenerowanie nowego `SESSION_SECRET` (`openssl rand -base64 32`).
- Uzupełnienie `.staging.vars` o wszystkie pozostałe sekrety zgodnie z szablonem `.staging.example.vars`.
- `wrangler secret put --env staging` dla każdego sekretu (sekrety dostarczone do runtime Workera).
- Nowy skrypt `pnpm admin:staging:regenerate` analogiczny do prod, używający `.staging.vars` przez dotenvx.

### Acceptance criteria

- [ ] `.staging.vars` zawiera komplet kluczy (DATABASE_*, SESSION_SECRET, VAPID_*, CLOUDFLARE_IMAGES_*, CLOUDFLARE_ACCOUNT_ID).
- [ ] `wrangler secret list --env staging` listuje wszystkie sekrety widoczne dla runtime.
- [ ] `pnpm admin:staging:regenerate` produkuje magic link wskazujący na `staging.wspolniak.com` (nie prod).
- [ ] `VAPID_PUBLIC_KEY` staging ≠ prod (manualne porównanie).
- [ ] `SESSION_SECRET` staging ≠ prod (manualne porównanie).
- [ ] Sesja zalogowana na stagingu NIE jest akceptowana po próbie użycia cookie na prodzie (manualny smoke).
- [ ] Worker `wspolniak-staging` po deployu nadal działa (`/api/health` zwraca 200, DB ok).

---

## Phase 5: Seed danych + finał (PWA cache, dokumentacja)

**User stories**: 6, 10, 11, 16, 20, 22

### What to build

Domykamy środowisko od strony użyteczności i powtarzalności. Dedykowany seed wypełnia bazę deterministycznymi danymi, tak że ręczne testy QA mogą polegać na stabilnych ID. Service worker dostaje `CACHE_NAME` z markerem środowiska, żeby PWA stagingu i prod nie cache'owały się wzajemnie na jednym urządzeniu testowym. Dokumentacja procedury (DNS + Neon + sekrety + deploy) trafia do `AGENTS.md` lub `CLAUDE.md`, tak że ktokolwiek z zespołu może odtworzyć staging od zera. Hak na późniejszą automatyzację CI (`workflow_dispatch`) zostawiony — bez wdrożenia.

Zakres:
- Rozszerzenie istniejącego `scripts/seed.ts` o tryb staging (zestaw deterministycznych encji: rodziny, członkowie, składki, transakcje, miesiące).
- Guard: `pnpm db:staging:seed` odmawia działania gdy `CLOUDFLARE_ENV === "production"`.
- Modyfikacja `scripts/inject-sw-version.mjs` / build pipeline'a, tak że `CACHE_NAME` zawiera marker środowiska (np. `wspolniak-staging-<version>` vs `wspolniak-<version>`).
- Dokumentacja kroków utworzenia stagingu od zera w `AGENTS.md` (Neon branch → secrets → DNS → first deploy → seed).
- Zaktualizowanie `.claude/CLAUDE.md` o nowe komendy w sekcji "Commands".

### Acceptance criteria

- [ ] `pnpm db:staging:seed` wypełnia bazę co najmniej: 1 rodzina z 2+ członkami, 1 składka z transakcjami, 1 niezamknięty miesiąc.
- [ ] Drugi run `pnpm db:staging:seed` jest idempotentny — brak duplikatów, brak crasha.
- [ ] Seed na bazie z `CLOUDFLARE_ENV=production` odmawia działania z czytelnym komunikatem.
- [ ] Dane seedowane są deterministyczne — te same ID po reset + seed.
- [ ] `CACHE_NAME` w `dist/sw.js` po `pnpm build:staging` różni się od `CACHE_NAME` po `pnpm build:production`.
- [ ] Sanity browser: po wejściu na `staging.wspolniak.com` i potem na `wspolniak.com`, Cache Storage zawiera dwa oddzielne wpisy (nie nadpisanie).
- [ ] `AGENTS.md` zawiera sekcję "Staging environment" z instrukcją utworzenia od zera.
- [ ] `.claude/CLAUDE.md` zaktualizowany o nowe komendy `*:staging:*` w sekcji Commands.
- [ ] `pnpm test`, `pnpm types`, `pnpm lint` przechodzą bez błędów.
