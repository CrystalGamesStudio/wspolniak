# Plan: Kalendarz v1 — automatyczne przypomnienia o datach

> Source PRD: GitHub issue [#81](https://github.com/CrystalGamesStudio/wspolniak/issues/81) (label `enhancement`). Pełna wizja kalendarza (v2+): `plans/wspolniak-kalendarz-prd.md` (jeszcze nie istnieje).

## Architectural decisions

Durable decyzje wspólne dla wszystkich faz:

- **Architecture style**: Cloudflare Workers — jeden Worker z dwoma handlerami: `fetch` (istniejący: `/api/*` → Hono, reszta → TanStack Start SSR) oraz nowy `scheduled` (cron). Hono API dla endpointów admina; TanStack Start dla UI. Brak osobnego Workera dla crona.
- **Data model**:
  - `calendar_events` — `(id text PK, title text, description text?, day int 1–31, month int 1–12, created_at, updated_at)`. **Brak kolumny `year`** — wyłącznie wydarzenia cykliczne roczne.
  - `calendar_reminder_log` — `(id text PK, event_id FK→calendar_events ON DELETE CASCADE, type text ∈ {week_before, on_day}, fired_for date, created_at)` z `UNIQUE(event_id, type, fired_for)` jako gwarancją idempotentności.
  - Konwencja repo: klucz `text` + `crypto.randomUUID()`, znaczniki `timestamp` (nie `UUID`/`TIMESTAMPTZ`).
- **Key entities**: `calendar_events`, `calendar_reminder_log`; reused `posts` (autor = konto admina); jedyny aktywny admin jako autor postów.
- **Authz**: Admin API chronione `authMiddleware` + sprawdzenie roli admina (wzorzec jak w pinned-posts). Cron działa po stronie serwera bez HTTP — sam szuka jedynego aktywnego admina (`role='admin'`, `deletedAt IS NULL`); brak admina → pominięcie biegu bez awarii.
- **Idempotentność**: atomowy „zamek" `claimReminder` = `INSERT … ON CONFLICT DO NOTHING RETURNING` na `UNIQUE(event_id, type, fired_for)`, zakładany **przed** utworzeniem posta.
- **Integrations**: istniejące `createPost` (warstwa posts), istniejące `buildPushDeps` + `notifyNewPost` (push), Cloudflare Cron Triggers, Neon Postgres + Drizzle (migracje per-środowisko: dev = kolejna po **0017**, prod = kolejna po obecnym syncu prod).
- **Czas**: cron UTC `06:00` (~08:00 czasu polskiego; wahanie DST akceptowalne); daty „dziś" i „za tydzień" liczone w strefie `Europe/Warsaw` w kodzie.
- **Głębokie moduły**: domena `calendar` (z `claimReminder`) + orkiestrator `runCalendarJob(env, ctx)` + czysty kompozytor tekstu + timezone helper.

---

## Phase 1: Admin — dodawanie i lista wydarzeń

**User stories**: 1, 2, 5.

### What to build

Tracer bullet warstwy zarządzania, end-to-end. Admin otwiera nową sekcję „Kalendarz" w panelu, widzi tabelę wydarzeń i może dodać nowe przez modal (tytuł wymagany, opis opcjonalny, dzień 1–31, miesiąc 1–12 — z walidacją). Wydarzenie trafia do bazy i pojawia się na liście. Tworzone są obie tabele (`calendar_events`, `calendar_reminder_log`) wraz z migracją dev; warstwa domeny `calendar` udostępnia listowanie, tworzenie, dopasowywanie po `(day, month)` oraz szkielet `claimReminder`. Admin API wystawia `GET` (lista) i `POST` (utworzenie), admin-only.

### Acceptance criteria

- [ ] Migracja dev tworzy `calendar_events` i `calendar_reminder_log` z odpowiednimi CHECK i `UNIQUE(event_id, type, fired_for)`.
- [ ] Admin może dodać wydarzenie i widzi je na liście (utrzymuje się po przeładowaniu).
- [ ] Walidacja odrzuca dzień spoza 1–31 i miesiąc spoza 1–12 (Zod) z czytelnym błędem.
- [ ] Endpointy API zwracają `403` dla non-admina.
- [ ] `findEventsByDayMonth(day, month)` zwraca poprawne wydarzenia (test domeny).

---

## Phase 2: Admin — edycja i usuwanie wydarzeń

**User stories**: 3, 4 (oraz aspekt danych z 6).

### What to build

Rozszerzenie zarządzania o modyfikację. Admin może edytować istniejące wydarzenie (modal edycji) i usuwać (z potwierdzeniem). API `PATCH /:id` i `DELETE /:id`, admin-only. Usunięcie wydarzenia usuwa kaskadowo jego wiersze `calendar_reminder_log` (efekt CASCADE przygotowuje „anulowanie przyszłych przypomnień" — w pełni weryfikowane w Fazie 4, gdy istnieje cron).

### Acceptance criteria

- [ ] Admin może zmienić tytuł/dzień/miesiąc/opis istniejącego wydarzenia.
- [ ] Admin może usunąć wydarzenie; znika ono z listy.
- [ ] `DELETE /:id` usuwa również powiązane wiersze `calendar_reminder_log` (CASCADE) — test domeny.
- [ ] `PATCH`/`DELETE` zwracają `404` przy nieistniejącym ID i `403` dla non-admina.

---

## Phase 3: Cron — post „Dzisiaj" od admina (bez push)

**User stories**: 7, 11, 12, 13, 14, 15.

### What to build

Tracer bullet crona, najcieńsza kompletna ścieżka. Dodany handler `scheduled` w wejściu Workera oraz `triggers.crons` w `wrangler.jsonc` (dev, UTC `06:00`). Orkiestrator `runCalendarJob(env, ctx)` dla bieżącej daty w `Europe/Warsaw`: znajduje wydarzenia na „dziś", dla każdego wykonuje atomiczny `claimReminder(eventId, 'on_day', today)`; gdy claim się uda — tworzy post od konta admina treścią z kompozytora (`Dzisiaj: {tytuł}` + opis). Błędy per wydarzenie izolowane (jedno zawala się → pozostałe idą dalej). Brak aktywnego admina → pominięcie biegu bez awarii. Powiadomienia push celowo POMINIĘTE w tej fazie.

### Acceptance criteria

- [ ] Handler `scheduled` jest podpięty; cron trigger skonfigurowany w dev.
- [ ] Wydarzenie na „dziś" → po odpaleniu crona powstaje post na Feedzie autorstwa admina o treści `Dzisiaj: {tytuł}`.
- [ ] **Idempotentność**: ponowne odpalenie crona tego samego dnia **nie tworzy duplikatu** (claimReminder).
- [ ] Kilka wydarzeń na „dziś" → osobny post na każde (story 14).
- [ ] Błąd przy jednym wydarzeniu nie przerywa pozostałych (izolacja).
- [ ] Brak aktywnego admina → bieg kończy się pomijająco, bez rzucania wyjątku.
- [ ] Timezone helper zwraca poprawny polski dzień kalendarzowy dla znanej chwili UTC (test).

---

## Phase 4: Koszyk „Za tydzień" (D-7) i przełom roku

**User stories**: 9, 16, 6 (pełna weryfikacja).

### What to build

Rozszerzenie orkiestratora o drugi koszyk: dla daty „dziś + 7 dni" (liczonej w `Europe/Warsaw`, z obsługą przełomu roku) znajduje wydarzenia i tworzy posty `Za tydzień: {tytuł}` przez `claimReminder(eventId, 'week_before', today)`. Po włączeniu obu koszyków w pełni weryfikowalne staje się anulowanie przyszłych przypomnień po usunięciu wydarzenia (story 6): jeśli „tydzień przed" już wyszedł, a admin usunie wydarzenie, post „dzisiaj" się nie pojawi (reminder_log skasowany CASCADE → claim nie istnieje, wydarzenie nie istnieje w zapytaniu).

### Acceptance criteria

- [ ] Wydarzenie za 7 dni → po odpaleniu crona post `Za tydzień: {tytuł}`.
- [ ] Przełom roku: „dziś" = 28.12, wydarzenie 4.01 → claim `week_before` odpala się poprawnie (timezone helper + test).
- [ ] `addDaysPoland(7)` na 31.12 daje 7.01 **następnego roku** (test).
- [ ] Usunięcie wydarzenia po wysłanym „tydzień przed" → post „dzisiaj" się NIE pojawia (story 6).
- [ ] Idempotentność dotyczy również koszyka `week_before`.

---

## Phase 5: Powiadomienia PUSH

**User stories**: 8, 17, 18.

### What to build

Orkiestrator buduje `PushDeps` z `env` (`buildPushDeps`) i po utworzeniu posta wywołuje `notifyNewPost` w tle przez `waitUntil`. Ponieważ `getActiveSubscriptions(authorId)` wyklucza autora, admin nie dostaje pusha o własnym poście. Gdy VAPID nie jest skonfigurowany (`buildPushDeps` → `null`), push jest pomijany, ale posty nadal powstają.

### Acceptance criteria

- [ ] Po odpaleniu crona rodzina otrzymuje powiadomienie push o nowym poście kalendarza.
- [ ] Admin (autor) **nie** otrzymuje pusha o własnym poście kalendarza.
- [ ] Brak skonfigurowanego VAPID → push pominięty, posty tworzone normalnie, brak awarii.
- [ ] Wysyłka push przez `waitUntil` nie blokuje zakończenia biegu crona.

---

## Phase 6: Deploy na produkcję i migracja prod

**User stories**: 19, 20.

### What to build

Uruchomienie kalendarza na produkcji. `triggers.crons` dodane również w environment `production` w `wrangler.jsonc`. Migracja bazy wygenerowana i aplikowana dla produkcji (osobny folder migracji prod, zgodnie z konwencją repo). Weryfikacja end-to-end po deploju: `wrangler tail` potwierdza, że cron odpala się o właściwej porze (~08:00 PL) i tworzy posty; post pojawia się na Feedzie produkcji, push dociera do rodziny.

### Acceptance criteria

- [ ] `triggers.crons` obecne w environment `production` `wrangler.jsonc`.
- [ ] Migracja prod aplikowana; obie tabele istnieją na produkcji.
- [ ] `wrangler tail` potwierdza odpalenie crona o właściwej porze na produkcji.
- [ ] Na produkcji post kalendarza pojawia się na Feedzie i dociera push (nie do admina).
- [ ] Jakość: `pnpm types && pnpm test && pnpm lint` przechodzą przed shipem.

---

## Kolejność i zależności

Fazy są sekwencyjne i kumulatywne: 1→2 (zarządzanie), 3→4→5 (cron: D-0 → D-7 → push), 6 (prod). Każda faza jest demoowalna samodzielnie. Po Fazie 6 plan wraca do issues #81 (zamykanie po shipie i testach użytkownika).

## Zadania (GitHub issues — po `/dispatch`)

| Faza | Issue | Typ | Blocked by |
|------|-------|-----|------------|
| F1 — dodawanie + lista (foundation) | [#82](https://github.com/CrystalGamesStudio/wspolniak/issues/82) | AFK | — |
| F2 — edycja + usuwanie | [#83](https://github.com/CrystalGamesStudio/wspolniak/issues/83) | AFK | #82 |
| F3 — cron D-0 (bez push) | [#84](https://github.com/CrystalGamesStudio/wspolniak/issues/84) | AFK | #82 |
| F4 — D-7 + przełom roku | [#85](https://github.com/CrystalGamesStudio/wspolniak/issues/85) | AFK | #84 |
| F5 — powiadomienia PUSH | [#86](https://github.com/CrystalGamesStudio/wspolniak/issues/86) | AFK | #85 |
| F6 — deploy prod + migracja prod | [#87](https://github.com/CrystalGamesStudio/wspolniak/issues/87) | **HITL** | #86 |

Parent PRD: [#81](https://github.com/CrystalGamesStudio/wspolniak/issues/81) (pozostaje otwarte).
