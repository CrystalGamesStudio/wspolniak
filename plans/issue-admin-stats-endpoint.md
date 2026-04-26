# Issue: `GET /api/admin/stats` z 4 metrykami (DAU, WAU, photos/week, push delivery)

> Skopiuj poniższe pole **Title** do `gh issue create --title`, a sekcję **Body** do `--body-file`.

---

## Title

```
feat(admin): GET /api/admin/stats endpoint with DAU, WAU, photos/week, push delivery metrics
```

## Labels

`enhancement`, `admin`, `observability`

## Body

### Kontekst

Decyzja Council z 2026-04-25 ([`plans/council-direction-2026-04-25.md`](./council-direction-2026-04-25.md)): zanim podejmiemy jakąkolwiek decyzję o kierunku rozwoju (A: deepening, B: OSS growth, etc.), musimy mieć **dane behawioralne** o realnym użyciu aplikacji przez rodzinę. Council 5/5 wskazało brak baseline metrics jako blind spot. Bez tego endpoint każda dyskusja "co dalej" to spekulacja.

Po 30 dniach pomiaru: jeśli WAU < 3 osoby — formalnie kończymy projekt zgodnie z propozycją First Principles. Jeśli WAU ≥ 3 i delivery rate ≥ 90% — otwieramy ścieżkę chirurgiczną A (RODO + EXIF).

### Cel

Admin (rola `admin`) odwiedzając `GET /api/admin/stats` dostaje JSON z czterema liczbami opisującymi aktywność rodziny w ostatnich 7 dniach.

### Kontrakt API

```
GET /api/admin/stats
  → 401 jeśli brak sesji
  → 403 jeśli sesja istnieje ale rola != admin
  → 200 z body:
    {
      "data": {
        "dau": number,                // distinct user_ids z aktywnością w ostatnich 24h
        "wau": number,                // distinct user_ids z aktywnością w ostatnich 7d
        "photosLast7Days": number,    // count(post_images) w ostatnich 7d
        "pushDeliveryLast7Days": {
          "attempts": number,         // łączna liczba prób wysyłki push
          "successes": number,        // count(outcome='success')
          "rate": number              // successes/attempts, 0 jeśli attempts=0, zaokrąglone do 4 miejsc
        },
        "windowStart": string,        // ISO timestamp początku okna (now - 7d)
        "windowEnd": string           // ISO timestamp now
      }
    }
```

**Definicja "aktywności"** dla DAU/WAU (świadomie content-based, bez session log):
> użytkownik jest aktywny, jeśli w oknie czasowym utworzył przynajmniej jeden post LUB komentarz (oba: `posts.author_id`, `comments.author_id`, filtr `created_at >= windowStart`, ignorujemy soft-deletes — content-based active oznacza że *zrobił akcję*, nawet jeśli treść została później skasowana).

**Push delivery:** liczona z **nowej tabeli** `push_delivery_events`, którą wprowadza ten ticket (obecnie nie ma żadnego śladu prób wysyłki w DB — tylko `console.error` w `wrangler tail`, co jest non-queryable).

### Decyzje architektoniczne (deep modules)

Tworzymy nowy moduł `src/db/stats/` z jednym wąskim publicznym interfejsem. Cała agregacja w jednej domenie — moduł hermetyzuje SQL, kalkulacje okien czasowych i podział na metryki.

```
src/db/stats/
├── queries.ts        # publiczne: getStatsSummary(now: Date) → StatsSummary
├── queries.test.ts   # boundary-level tests, mockują getDb() przez msw lub stub
├── index.ts          # re-export public API
```

`push_delivery_events` to nowy moduł `src/db/push-delivery-events/` (analogicznie do `push-subscriptions`):

```
src/db/push-delivery-events/
├── table.ts          # pgTable definition
├── queries.ts        # recordDelivery(outcome, endpoint, userId), countDeliveries(window)
├── queries.test.ts
├── index.ts
```

Endpoint trafia do **istniejącego** `src/hono/api/admin.ts` (deepen, nie tworzymy nowego pliku) — admin endpoint już istnieje z auth+admin middleware.

### Zmiany schematu

**Nowa tabela** `push_delivery_events`:

```ts
// src/db/push-delivery-events/table.ts
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pushDeliveryEvents = pgTable("push_delivery_events", {
  id: text("id").primaryKey(),
  endpoint: text("endpoint").notNull(),
  userId: text("user_id").notNull(),
  outcome: text("outcome").notNull(), // 'success' | 'gone' | 'failure'
  statusCode: integer("status_code"), // null jeśli throw, inaczej HTTP status
  triggerKind: text("trigger_kind").notNull(), // 'post' | 'comment'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Index** (dodać w migracji): `CREATE INDEX idx_push_delivery_events_created_at ON push_delivery_events(created_at DESC);` — wszystkie zapytania filtrują po oknie 7d.

**Eksport** dodać w `src/db/schema.ts`:

```ts
export { pushDeliveryEvents } from "./push-delivery-events/table";
```

**Migracja** generowana przez `pnpm db:dev:generate` po dodaniu tabeli.

### Vertical slices (kolejność TDD: red → green → refactor)

Każdy slice ma sens samodzielnie i może być zmergowany niezależnie.

#### Slice 1: schema `push_delivery_events`

**Red:**
- `src/db/push-delivery-events/queries.test.ts`: test na `recordDelivery({ endpoint, userId, outcome: 'success', triggerKind: 'post' })` zapisuje wiersz; test na `countDeliveriesInWindow({ from, to })` agreguje wg outcome.
- `src/db/schema.test.ts`: test że `pushDeliveryEvents` jest eksportowane.

**Green:**
- `table.ts`, `queries.ts`, `index.ts` w `src/db/push-delivery-events/`
- Aktualizacja `src/db/schema.ts`
- `pnpm db:dev:generate` → commit migracji

**Acceptance:**
- [ ] `pnpm db:dev:migrate` wykonuje migrację bez błędu
- [ ] `recordDelivery` zwraca wstawiony wiersz
- [ ] `countDeliveriesInWindow` zwraca `{ attempts: number, successes: number }` filtrując po `created_at`

---

#### Slice 2: instrumentacja push fan-out

**Red:**
- `src/core/notify.test.ts`: rozszerzyć istniejące testy o weryfikację, że `onSendOutcome` jest wołany z `('success' | 'gone' | 'failure', endpoint, statusCode | null)` dla każdej subskrypcji w fan-outcie.
- `src/hono/api/posts.test.ts`: po `POST /api/app/posts` mock `recordDelivery` jest wołany N razy gdzie N = liczba aktywnych subskrypcji innych userów.
- Analogicznie `src/hono/api/comments.test.ts`.

**Green:**
- W `src/core/notify.ts` dodać do interface `NotifyDeps` opcjonalny callback:
  ```ts
  onSendOutcome?: (
    outcome: 'success' | 'gone' | 'failure',
    endpoint: string,
    statusCode: number | null,
  ) => void;
  ```
- Zmodyfikować `fanOutPush` w `src/core/push.ts` (jeśli to tam jest) aby wołał `onSendOutcome` po każdej próbie. Zachować istniejący `onSendError` (backward compat — woła się tylko dla `failure` + `gone`).
- W `src/hono/api/posts.ts` i `src/hono/api/comments.ts` dodać `onSendOutcome` do dep injection — wewnątrz wołać `recordDelivery({ ..., outcome, statusCode, triggerKind })` opakowane w try/catch (logowanie błędu DB nie może wywrócić push fan-outu).

**Acceptance:**
- [ ] Tworzenie posta loguje `attempts` zdarzeń o `triggerKind: 'post'` w DB (jeden na każdą subskrypcję inną niż autora)
- [ ] Tworzenie komentarza loguje `attempts` zdarzeń o `triggerKind: 'comment'` (zero jeśli komentujący == autor posta)
- [ ] `outcome: 'gone'` rejestrowany dla HTTP 410 (zachowanie usuwania subskrypcji nadal działa)
- [ ] `outcome: 'failure'` rejestrowany dla innych non-OK statusów i throw'ów
- [ ] Błąd zapisu `push_delivery_events` nie wywraca push fan-outu (defensive try/catch)

---

#### Slice 3: queries dla statystyk

**Red:**
- `src/db/stats/queries.test.ts`:
  - `getDailyActiveUsers(now)` — distinct authors z postów ∪ komentarzy w ostatnich 24h. Test: utwórz 2 posty od u1, 1 komentarz od u2, 1 post od u3 ze starszą datą → zwraca 2.
  - `getWeeklyActiveUsers(now)` — analogicznie 7d.
  - `getPhotosLast7Days(now)` — count(`post_images.created_at` ≥ now-7d).
  - `getPushDeliveryRateLast7Days(now)` — `{ attempts, successes, rate }`. Test: 8 success + 2 failure → rate 0.8.
  - Edge case: zero zdarzeń → `{ attempts: 0, successes: 0, rate: 0 }` (nie NaN).
- Bonus: `getStatsSummary(now)` — kompozycja powyższych w jednym wywołaniu (Promise.all).

**Green:**
- Implementacja w `src/db/stats/queries.ts` używając Drizzle `count()`, `countDistinct()`, `gte()`, `union()`, `or()`.
- DAU/WAU implementacja:
  ```ts
  // distinct user_ids spośród (posts.author_id ∪ comments.author_id) w oknie
  const postAuthors = db.selectDistinct({ id: posts.authorId })
    .from(posts).where(gte(posts.createdAt, windowStart));
  const commentAuthors = db.selectDistinct({ id: comments.authorId })
    .from(comments).where(gte(comments.createdAt, windowStart));
  // union + count distinct po id
  ```
- `index.ts` re-eksportuje publiczny API: `getStatsSummary` + typ `StatsSummary`.

**Acceptance:**
- [ ] Wszystkie 4 funkcje są pure (przyjmują `now: Date` jako argument — testowalne bez `vi.useFakeTimers`)
- [ ] Edge case zero rekordów testowo pokryty dla każdej metryki
- [ ] `getStatsSummary` paralelizuje zapytania przez `Promise.all`
- [ ] Eksport publiczny: tylko `getStatsSummary` + typ `StatsSummary`. Pojedyncze `getDau/getWau/...` są internal — nie eksportować z `index.ts` (deep module).

---

#### Slice 4: endpoint `GET /api/admin/stats`

**Red:**
- `src/hono/api/admin.test.ts`: nowy `describe("GET /api/admin/stats")`:
  - 200 + body shape match (mock `getStatsSummary` zwraca stub, sprawdź mapowanie do JSON)
  - 401 bez cookie
  - 403 dla membera (już pokryte istniejącym `describe("admin authorization")` — rozszerzyć o ścieżkę `/stats`)
  - `windowStart` i `windowEnd` w odpowiedzi to ISO strings, `windowEnd - windowStart === 7d`

**Green:**
- W `src/hono/api/admin.ts` dodać:
  ```ts
  adminEndpoint.get("/stats", async (c) => {
    const summary = await getStatsSummary(new Date());
    return c.json({ data: summary });
  });
  ```
- Import `getStatsSummary` z `@/db/stats`.

**Acceptance:**
- [ ] `GET /api/admin/stats` z cookie admina → 200 z poprawnym shape
- [ ] Bez cookie → 401
- [ ] Cookie membera → 403
- [ ] Body matchuje kontrakt (sekcja "Kontrakt API" wyżej)

---

### Pliki do utworzenia/edycji

**Nowe pliki:**
- `src/db/push-delivery-events/table.ts`
- `src/db/push-delivery-events/queries.ts`
- `src/db/push-delivery-events/queries.test.ts`
- `src/db/push-delivery-events/index.ts`
- `src/db/stats/queries.ts`
- `src/db/stats/queries.test.ts`
- `src/db/stats/index.ts`
- `src/db/migrations/<auto>_push_delivery_events.sql` (generowane przez Drizzle)

**Modyfikowane pliki:**
- `src/db/schema.ts` (re-eksport)
- `src/core/notify.ts` (`onSendOutcome` callback)
- `src/core/push.ts` (jeśli `fanOutPush` tam siedzi — wołanie `onSendOutcome`)
- `src/core/notify.test.ts` (testy callbacka)
- `src/hono/api/posts.ts` (zarejestrowanie `onSendOutcome` → `recordDelivery`)
- `src/hono/api/posts.test.ts` (testy logowania)
- `src/hono/api/comments.ts` (analogicznie)
- `src/hono/api/comments.test.ts` (analogicznie)
- `src/hono/api/admin.ts` (nowy handler `/stats`)
- `src/hono/api/admin.test.ts` (testy handlera)

### Quality gates (przed merge)

- [ ] `pnpm types` — zero błędów
- [ ] `pnpm test` — wszystkie testy zielone, w tym nowe boundary tests dla `stats` i `push-delivery-events`
- [ ] `pnpm lint` — zero błędów Biome
- [ ] `pnpm knip` — brak unused exports (sprawdzić: pojedyncze metric functions nie są eksportowane z `index.ts`)
- [ ] `pnpm db:dev:generate && pnpm db:dev:migrate` — migracja czysto przechodzi na świeżym schemacie
- [ ] Manualnie: po deploy na dev, `curl https://<dev>/api/admin/stats -H "Cookie: session=<admin-jwt>"` → 200 z wszystkimi 4 metrykami; admin panel pokazuje 0 wartości na pustej DB

### Out of scope (świadome odcięcia)

- **UI panel admina** dla statystyk — endpoint zwraca JSON, panel admina pokazujący metryki to follow-up issue
- **Retention policy** dla `push_delivery_events` — przy ~5 osobach × kilka push/dzień to <2k wierszy/rok, na razie nie kasujemy. Cron retention to follow-up gdy tabela urośnie
- **Alerty** gdy delivery rate spada — to follow-up po pierwszym tygodniu pomiaru
- **Historical metrics** (DAU/WAU dla okien historycznych) — endpoint zwraca tylko bieżący snapshot, time series dopiero gdy będzie potrzebny
- **Session-based DAU** (last_seen_at na users) — content-based wystarcza dla rodziny <20 osób; nie dodajemy hot-path writes do users na każdy auth check

### Dependency graph dla TDD

```
Slice 1 (schema) ──┬──> Slice 2 (instrumentacja) ──┐
                   │                                ├──> Slice 4 (endpoint)
                   └──> Slice 3 (queries) ──────────┘
```

Slice 2 i Slice 3 mogą iść równolegle po Slice 1. Slice 4 czeka na oba.

### Definition of done

Endpoint zdeployowany na produkcji (wspolniak.com), zwraca poprawne dane na żywej DB. **Po 30 dniach** robimy snapshot i podejmujemy decyzję A vs C zgodnie z werdyktem Council.
```

---

## Komenda do utworzenia issue

```bash
gh issue create \
  --title "feat(admin): GET /api/admin/stats endpoint with DAU, WAU, photos/week, push delivery metrics" \
  --label "enhancement" \
  --body-file - <<'EOF'
<wklej całą sekcję "Body" z góry, od "### Kontekst" do końca>
EOF
```

Albo prościej: `gh issue create -t "..." -F plans/issue-admin-stats-endpoint.md` po wycięciu metadata sekcji.
