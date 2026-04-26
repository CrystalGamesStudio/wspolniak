# Council: w którą stronę dalej rozwijać Wspólniaka

**Data:** 2026-04-25
**Pytanie zadane:** "w ktora strone dalej rozwijac projekt?"

## Framed question

**Projekt:** "Wspólniak" — prywatny rodzinny mini-Facebook, AGPL-3.0, self-host na Cloudflare. Solo developer, side project. MVP funkcjonalnie kompletne (v1.12.12, 9 faz przeszło, ~25 PRów). Stos: TanStack Start + Hono + CF Workers + Neon Postgres + CF Images + PWA + Web Push VAPID. Pierwsza instancja: `wspolniak.com` dla rodziny autora. Eksplicytne non-goals z PRD: multi-tenancy, SaaS, native mobile, Postgres/MySQL alt, Docker, publiczne profile, reklamy. Ostatnie 7 commitów to fixy push notifications (incident #20-#24) i PWA install banner.

**Decyzja:** który z 6 wektorów rozwoju jest właściwy na 3-6 miesięcy?

- **A.** Pogłębić feature'y post-MVP dla własnej rodziny (reakcje, albumy, mentions, edycja zdjęć, EXIF stripping, RODO export)
- **B.** Obniżyć barierę self-hostu / urosnąć w OSS (R2 fallback, polish "Deploy to CF", docs, beta-testerzy, community)
- **C.** Productize jako SaaS (zerwać z PRD non-goal)
- **D.** Pivot na "family OS" (kalendarz, lista zakupów, yearbook, drzewo genealogiczne)
- **E.** Maturity / hardening (backupy, RODO compliance, rate limiting, security audit, observability, i18n)
- **F.** Native mobile (zerwać z PRD non-goal)

**Stawka:** efekt 3-6 miesięcy solo developera, ryzyko rozjechania filozofii projektu, trade-off "głębokość dla swojej rodziny" vs "szerokość zasięgu OSS" vs "polerowanie tego co już działa".

---

## Mapowanie anonimizacji (po peer review)

- **Response A** = Outsider
- **Response B** = Expansionist
- **Response C** = First Principles
- **Response D** = Executor
- **Response E** = Contrarian

## Step 2 — Niezależne analizy doradców

### The Contrarian → E

> Co się stanie, gdy zachorujesz na trzy miesiące? Masz jedną instancję w produkcji, rodzina na niej siedzi, a 7 ostatnich commitów to firefighting push notifications. To nie jest "MVP kompletne" — to "MVP, które ledwo stoi". Każda nowa funkcja (A) to kolejny wektor incydentu. Nadal **brak backupu poza CF** — jedna pomyłka w Neon → rodzinne zdjęcia z 5 lat znikają. B = darmowy support 24/7 dla solo developera. C = AGPL+multi-tenant prawniczy nightmare. D = scope creep. F = Apple cię nienawidzi. **Wybierz E. Bez dyskusji.** Reszta to vanity.

### The First Principles Thinker → E (z reframe)

> Pytanie jest źle postawione. Side project rodzinny, który działa, nie potrzebuje roadmapy — potrzebuje *trybu utrzymania*. Software może być skończony. AGPL to licencja, nie zobowiązanie. "9 faz przeszło" to sunk cost dressed up as strategy. Sygnał z commit history: kruchość, nie feature gap. Reframe: nie wybieraj wektora rozwoju, wybierz **próg ukończenia**: "skończone = E (hardening) + RODO export/delete + 30 dni stabilnych push bez incydentu". Potem **stop**. E to jedyny wektor, który zmniejsza przyszłą pracę zamiast ją zwiększać. Pytanie nie brzmi "co budować dalej" — brzmi "czy umiem przestać".

### The Expansionist → B (agresywnie)

> To wybór mnożnikowy. **B jako platforma protokołu rodzinnego.** Pierwszy realnie self-hostowalny FB dla rodzin na edge runtime, AGPL, PWA + Web Push działający na iOS w 2026 — to *referencyjna implementacja kategorii bez nazwy* ("post-social personal network"). Timing: iOS PWA dojrzewa, "delete Facebook" trenduje, AGPL wraca do mody (Plausible, Cal.com, Mattermost). Asymetria: 100 deployów × 10-50 userów = 1000-5000 ludzi. Network effect odwrócony — każda instancja **wzmacnia** ekosystem (PR-y, tłumaczenia, bug reports). "Deploy to Cloudflare" + R2 fallback + polski README → HN front page → 5k stars → opinionated stack reference. D ukryte w B (community napisze pluginy). **B = jedyny wektor gdzie 3 miesiące mogą dać 10x ROI**.

### The Outsider → A okrojone (RODO + EXIF)

> Nie rozumiem połowy tego, co czytam. Twoja rodzina ma już Facebooka, WhatsAppa, iMessage, grupowy czat. Zbudowałeś dziewiątą rzecz, do której babcia musi się logować. **Ile osób z rodziny realnie używa wspolniak.com tygodniowo?** Tego w briefie nie ma — i to jedyna liczba, która ma znaczenie. "Self-hoster bez budżetu czytający AGPL" to wąska sekta. 7 patchy push w 2 dni — czy twoja mama dostała push, czy nie? Jeśli nie — produkt nie działa dla głównego usera, a ty rozważasz pivot na drzewo genealogiczne. Rekomendacja: **A brutalnie okrojone** — RODO export/delete (z E) + EXIF GPS stripping (z A). Reszta to ucieczka do przodu. Pytanie kontrolne: ile zdjęć rodzina wrzuciła w ostatnim miesiącu? Jeśli <20 — żaden wektor nie jest właściwy. Właściwy jest telefon do siostry.

### The Executor → A

> **A. Bez dyskusji.** Poniedziałek rano: GH issue "RODO export + delete endpoint" — ship w tydzień (masz Hono + Neon + schemat). Drugie: "EXIF GPS stripping" — pół dnia, jeden middleware. Trzecie: "reakcje (1 emoji, tabela `post_reactions`)" — 2 dni z testami. B = marketing produktu którego nikt nie używa, najpierw 3mc retention rodziny. C = kolejny etat. D = second-system syndrome. E = RODO zaliczam do A, reszta over-engineering na 5 userów. F = solo niemożliwe w 6mc. **Pierwszy ship: EXIF GPS stripping** — najmniejszy diff, największy impact (prywatność dzieci).

## Step 3 — Peer reviews (zanonimizowane)

### Review 1
**Najsilniejsza: A.** Jako jedyna kwestionuje liczbę determinującą wszystko — realne użycie. C reframe'uje, ale A jest brutalniejsza i konkretniejsza.
**Blind spot: B.** "100 deployów × 10-50 userów" to fantazja masowego self-hostingu AGPL FB. Każdy z 100 self-hosterów wygeneruje issue, którego solo dev nie obsłuży.
**Wszyscy przegapili: bus factor.** Co stanie się z danymi rodziny gdy autor straci zainteresowanie za 18mc? AGPL nie ratuje babci. Brakuje **wektora G: exit strategy** — udokumentowany migration path do standardowego archiwum.

### Review 2
**Najsilniejsza: E.** Jedyna nazywa konkretne ryzyko egzystencjalne (brak backupu Neon = utrata zaufania, którego nie odbudujesz feature'ami).
**Blind spot: B.** "100 deployów" = 100 osób piszących "u mnie nie działa na Supabase". Mnożnik liczony bez mianownika.
**Wszyscy przegapili:** plan sukcesji/bus factor + pomiar baseline (DAU rodziny, czy push faktycznie dochodzi po 7 fixach) + finansowy kill-switch (koszt CF/Neon na 12mc).

### Review 3
**Najsilniejsza: E.** Pyta "co jeśli system padnie/autor padnie" — dla self-host rodzinnego z 5 lat zdjęć to realna asymetria ryzyka. Pierwszy data-loss = trwała utrata zaufania.
**Blind spot: B.** Liczby z sufitu. AGPL + opinionated stack = bariera deploy zaporowa, nie viral. "D ukryte w B" to życzeniowe myślenie.
**Wszyscy przegapili:** **bus factor i plan sukcesji** — kto utrzymuje wspolniak.com gdy autor zniknie na 6 miesięcy? Brak runbooka odzyskiwania dla nie-developera w rodzinie.

### Review 4
**Najsilniejsza: E.** Stawia pytanie egzystencjalne dla projektu jednoosobowego. AGPL self-host dla rodziny = zero tolerancji na utratę zdjęć dzieci.
**Blind spot: B.** "100 deployów = 1000-5000 userów" — fantazja. Realny conversion <1%. B *dodaje* pracę, nie mnoży wartości.
**Wszyscy przegapili:** **dane behawioralne** z wspolniak.com (DAU/WAU rodziny, retencja po fixach push). Bez tego dyskusja to spekulacja. Drugi brak: koszt operacyjny CF przy skali.

### Review 5
**Najsilniejsza: E.** Patrzy na ryzyko egzystencjalne, nie na feature roadmap. Solo dev + zdjęcia 5+ lat + jeden provider = SPOF.
**Blind spot: B.** Network effect bez dowodu popytu. "5k stars" to fantazja, AGPL+HN ≠ adopcja. Pomija że non-goals explicite wykluczają multi-tenancy.
**Wszyscy przegapili: bus factor i sukcesja.** E dotyka choroby tylko technicznie. Brakuje: dokumentacji odtworzenia instancji przez nietechnicznego członka rodziny, dostępu awaryjnego do CF/Neon, eksportu do formatu czytelnego bez aplikacji. **Rodzinne dane to dziedzictwo, nie SaaS — horyzont to dekady, nie 3-6 miesięcy.**

---

## Step 4 — Werdykt Chairmana

### Where the Council Agrees

Wszyscy doradcy odrzucają **C, D, F** zgodnie:
- **C (SaaS)** — AGPL + multi-tenant = prawniczy nightmare i etat na pełen wymiar; łamie filozofię
- **D (family OS)** — scope creep, second-system syndrome, przegrasz na każdym froncie z istniejącymi narzędziami
- **F (native mobile)** — 7 patchy iOS PWA push to nie sygnał "rzuć PWA", to sygnał "iOS Web Push jest młode"; native = 2x stack solo, niemożliwe

Wszyscy też zgadzają się, że **fundament jest niedokończony** — różnią się tylko nazwą problemu (Contrarian: kruchość; Outsider: brak walidacji użycia; Executor: RODO + prywatność).

### Where the Council Clashes

**Główna oś sporu:** A okrojone (Outsider, Executor) vs E czyste (Contrarian, First Principles) vs B agresywne (Expansionist).

- **A vs E:** Outsider/Executor traktują RODO + EXIF jako część A (feature dla rodziny); Contrarian/First Principles traktują to samo jako E (hardening). To w dużej mierze spór o etykietkę — ale pod nim leży realna różnica: czy reakcje/albumy/mentions też lecą w pakiecie (A), czy explicit STOP po hardeningu (E).
- **B vs reszta:** Expansionist widzi timing window (iOS PWA + AGPL renaissance) i mnożnik OSS. Reszta widzi solo deva bez walidacji popytu, dla którego społeczność = drugi etat support. Council 4-do-1 mówi: bez bazy retencji u własnej rodziny, B to budowa marketingu produktu którego nikt jeszcze nie używa.

**Reasonable disagreement:** Expansionist ma rację, że *istnieje* timing window — ale myli "okno istnieje" z "ja jestem osobą która ma czas, energię i ICP, żeby je zająć". To dwie różne rzeczy.

### Blind Spots the Council Caught (peer review)

**Bus factor / plan sukcesji** — wymienione w 4/5 peer reviews. Żaden z 5 oryginalnych doradców (nawet Contrarian z pytaniem "co jeśli zachorujesz") nie dotknął **dziedzictwa danych**:
- Kto utrzymuje `wspolniak.com` gdy autor zniknie na 18 miesięcy?
- Jak nietechniczny członek rodziny odzyskuje 5 lat zdjęć?
- Czy istnieje export do formatu czytelnego *bez* aplikacji (zdjęcia + JSON na dysk)?

To redefiniuje E z "hardening na 5 userów" na "system, który przetrwa autora". Horyzont rodzinnych zdjęć to dekady, nie 3-6 miesięcy.

**Brak metryk baseline** — wymienione w 3/5 reviews. Decyzja A-F bez:
- DAU/WAU rodziny po fixach push
- Liczby zdjęć/tydzień w ostatnim miesiącu
- Faktycznego delivery rate push notifications
- Kosztu CF/Neon na 12mc vs tolerancja side projectu

...to zgadywanie. Outsider próbował to wyciągnąć ("ile zdjęć w miesiącu"), ale nikt nie postawił tego jako prerekwizytu wszystkich 6 decyzji.

### The Recommendation

**E rozszerzone o exit/succession + chirurgicznie A (RODO + EXIF). Bez B, C, D, F. Zdefiniowany próg ukończenia.**

Konkretnie, na 3 miesiące (nie 6):

1. **Off-CF backup operacyjny** — Neon weekly dump → R2 z 90-dniową retencją, healthcheck że ostatni < 24h. To eliminuje single-point-of-failure i ryzyko egzystencjalne nazwane przez Contrariana.
2. **Family recovery runbook** — `docs/family-runbook.md` po polsku, dla nietechnicznego członka rodziny: jak odzyskać zdjęcia z R2, jak dostać się do CF/Neon, jak wyeksportować dane do dysku. To bus factor zidentyfikowany przez peer review.
3. **RODO export/delete endpoint + EXIF GPS stripping** — z wektora A okrojonego. Compliance + prywatność dzieci. ~1.5 tygodnia roboty.
4. **Endpoint metryk** (`/api/admin/stats`) — DAU/WAU, photos/week, push delivery rate. **Decyzja po 30 dniach pomiaru:** jeśli rodzina nie używa (np. WAU < 3 osoby przez miesiąc), idziesz w stronę C z First Principles — formalnie kończysz projekt z runbookiem.

**Po tych 3 miesiącach: STOP** (zgodnie z First Principles). Nie reakcje, nie albumy, nie mentions, nie B, nie D. Software może być skończony. Jeśli za rok pojawi się walidowany popyt (rodzina aktywnie używa, ktoś z zewnątrz pyta o self-host) — wtedy decyzja B/A się otwiera ponownie z danymi, nie z fantazjami.

Council 4-do-1 stoi za hardeningiem, peer review jednoznacznie wzmacnia to bus factorem. Expansionist ma najatrakcyjniejszą wizję, ale 5/5 reviews nazwało jego liczby fantazją bez danych. Nie buduj marketingu dla produktu którego retencja jest niezmierzona.

### The One Thing to Do First

**Dziś wieczorem: pierwszy off-CF backup Neon → R2 ręczną komendą.** Jednym `pg_dump` + `wrangler r2 object put`. Cron i automatyzacja przyjdą jutro — najpierw udowodnij sobie że dane można odzyskać poza Cloudflare. Bez tego żadna inna decyzja nie ma znaczenia.

---

*Zapisane przez LLM Council, 2026-04-25.*
