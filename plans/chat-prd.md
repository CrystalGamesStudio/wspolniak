# PRD: Wspólniak Chat

## Overview

Wspólniak Chat to globalny czat rodzinny w czasie rzeczywistym, dostępny dla wszystkich członków rodziny w aplikacji Wspólniak. Rozwiązuje problem rozproszenia komunikacji po wielu zewnętrznych komunikatorach przez dostarczenie szybkiego, efemerycznego kanału kontaktu w miejscu, gdzie jest już cała rodzina.

---

## Problem Statement

Rodzina komunikuje się przez różne komunikatory (np. WhatsApp), ale nie wszyscy są tam obecni. Wspólniak jest jedynym miejscem, gdzie są wszyscy członkowie rodziny — jednak brakuje w nim szybkiego kanału do bieżącej komunikacji. Posty na feedzie nie nadają się do tego celu — są trwałe i mają inną intencję.

---

## Users

| User type | Opis | Szacunkowa liczba |
|-----------|------|-------------------|
| Członek rodziny | Każdy zalogowany użytkownik Wspólniaka, mixed tech skills, mobile-first | Wszyscy użytkownicy aplikacji |

---

## Goals & Success Criteria

- [ ] Rodzina używa chatu Wspólniaka zamiast WhatsApp / innych komunikatorów do bieżącego kontaktu
- [ ] Wiadomości są dostarczane i widoczne w czasie rzeczywistym bez ręcznego odświeżania
- [ ] Doświadczenie użytkownika jest płynne i dopracowane — punkt odniesienia: Telegram na iOS

---

## User Stories

1. Jako członek rodziny chcę wysłać wiadomość tekstową do całej rodziny, żeby szybko się skontaktować.
2. Jako członek rodziny chcę zareagować na wiadomość emoji, żeby wyrazić reakcję bez pisania odpowiedzi.
3. Jako członek rodziny chcę odpowiedzieć (reply) na konkretną wiadomość, żeby kontekst rozmowy był czytelny.
4. Jako członek rodziny chcę widzieć że ktoś pisze w tej chwili, żeby wiedzieć że mam poczekać na odpowiedź.
5. Jako członek rodziny chcę dostać push notyfikację o nowej wiadomości, żeby nie przegapić kontaktu.
6. Jako członek rodziny chcę otworzyć chat z dowolnego miejsca w aplikacji, żeby nie przerywać tego co robię.

---

## Scope

### In scope

- Jeden globalny czat dla całej rodziny
- Wiadomości tekstowe
- Reakcje emoji (ten sam predefiniowany zestaw co w feedzie)
- Reply — odpowiedź z cytowaniem konkretnej wiadomości
- Wygasanie wiadomości po 24h od wysłania (rolling, per wiadomość, twarda zasada)
- Real-time delivery (bez odświeżania strony)
- Typing indicator ("ktoś pisze...")
- Push notyfikacje o nowych wiadomościach (podpięcie pod istniejący system Web Push VAPID)
- Ładowanie wszystkich wiadomości z ostatnich 24h przy otwarciu chatu; loader + informacja gdy jest ich dużo
- Podstrona `/chat` (TanStack Router)
- **Mobile:** slide-out drawer z lewej (jak X/Twitter) jako główna nawigacja z hamburgerem w lewym górnym rogu ekranu + nagłówek "Witamy!"
- **Desktop:** Chat jako nowa pozycja w istniejącym sidebarze

### Out of scope

- Czaty 1 na 1 (prywatne)
- Czaty grupowe (podgrupy)
- Wysyłanie zdjęć / mediów
- Edycja wysłanej wiadomości
- Usuwanie wiadomości przez użytkownika
- Moderacja admina w chacie
- Read receipts ("przeczytane przez")
- Badge / counter nieprzeczytanych na ikonie chatu
- Przypinanie wiadomości
- Wyszukiwanie w historii chatu

---

## System Components

### Stack kontekst

| Warstwa | Technologia |
|---------|-------------|
| Framework | TanStack Start (SSR + Router + Query) |
| API | Hono na Cloudflare Workers |
| Baza danych | Neon PostgreSQL (serverless, `@neondatabase/serverless`) |
| ORM | Drizzle ORM |
| Push | Web Push VAPID (istniejący system) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Build | Vite + pnpm |
| Linting | Biome |

### Schemat bazy danych (Neon PostgreSQL + Drizzle)

**Tabela `chat_messages`:**
```
id           uuid         PK, default gen_random_uuid()
author_id    uuid         FK → users.id
text         text         NOT NULL
reply_to_id  uuid         FK → chat_messages.id (nullable)
reply_text   text         snapshot cytowanej wiadomości (nullable)
created_at   timestamptz  default now()
expires_at   timestamptz  default now() + interval '24 hours'
```

**Tabela `chat_reactions`:**
```
id           uuid         PK
message_id   uuid         FK → chat_messages.id ON DELETE CASCADE
user_id      uuid         FK → users.id
emoji        text         NOT NULL
created_at   timestamptz  default now()
UNIQUE (message_id, user_id, emoji)
```

### API (Hono)

```
GET  /api/chat/messages          — pobierz wiadomości z ostatnich 24h
POST /api/chat/messages          — wyślij nową wiadomość
POST /api/chat/messages/:id/reactions  — dodaj / usuń reakcję
GET  /api/chat/stream            — SSE endpoint (real-time, patrz Open Questions)
```

### Real-time

Wiadomości muszą być dostarczane bez odświeżania strony. Decyzja architektoniczna do podjęcia — patrz Open Questions.

Typing indicator: broadcast zdarzenia "user is typing" przez ten sam kanał real-time. Wygasa automatycznie po ~3s braku aktywności klienta.

### Nawigacja

**Mobile:**
- Hamburger (lewy górny róg) → slide-out drawer z lewej
- Drawer zawiera wszystkie sekcje: Home, Chat, Kalendarz, Albumy, Profil itd.
- Nagłówek główny ekranu: "Witamy!"
- Animacja drawera: natywna płynność, punkt odniesienia X/Twitter + Telegram na iOS

**Desktop:**
- Istniejący sidebar (TanStack Router layout) — dodać pozycję "Chat"

### Wygasanie wiadomości

Brak natywnych Cron Triggers w obecnym `wrangler.jsonc`. Opcje:
1. **Dodać Cron Trigger do wrangler.jsonc** — Worker odpala się co godzinę i usuwa z Neon rekordy gdzie `expires_at < now()`
2. **Lazy delete** — przy każdym `GET /api/chat/messages` usuwaj wygasłe wiadomości przed zwróceniem wyniku

Rekomendacja: Cron Trigger (opcja 1) — nie obciąża ścieżki odczytu.

### Push notyfikacje

Podpiąć pod istniejący system Web Push VAPID — wysyłać przy nowej wiadomości na chacie (nie przy reakcjach, nie przy typing indicator).

---

## Implementation Decisions

| Decyzja | Wybór | Uzasadnienie |
|---------|-------|-------------|
| Zakres chatu | Jeden globalny | Prostota; rodzina jest jedną jednostką |
| Trwałość wiadomości | 24h rolling, per wiadomość | Efemeryczność odróżnia chat od feedu; brak wyjątków upraszcza logikę |
| Reakcje | Ten sam zestaw co feed | Spójność UX; brak dodatkowej pracy nad nowym systemem |
| Edycja / usuwanie | Nie | Prostota; wiadomości i tak znikają po 24h |
| Read receipts | Nie | Redukuje presję społeczną; prostota implementacji |
| Badge nieprzeczytanych | Nie | Redukuje anxiety; chat jest efemeryczny z natury |
| Wygasanie | Cron Trigger (rekomendacja) | Nie blokuje ścieżki odczytu |
| Real-time transport | Do ustalenia | Patrz Open Questions |
| Jakość animacji | Telegram na iOS | Punkt odniesienia dla płynności i dopracowania |

---

## Validation Strategy

Wdrożenie do produkcji → obserwacja czy rodzina faktycznie przechodzi z WhatsApp na chat Wspólniaka.

---

## Open Questions

- [ ] **Real-time transport:** Jak obsłużyć real-time na Cloudflare Workers bez istniejącej infrastruktury?
  - **(a) Cloudflare Durable Objects + WebSocket** — najbardziej niezawodne dla czatu; wymaga dodania DO do `wrangler.jsonc` i nowego kodu; WebSocket trzyma połączenie, DO rozsyła do wszystkich klientów; wyższy nakład
  - **(b) SSE przez Hono** — prostsze; Hono ma wbudowane wsparcie SSE; **uwaga:** Cloudflare Workers mają limit CPU per request, SSE może być rozłączany po ~30s bez aktywności; wymaga retry po stronie klienta; tylko server→client (polling dla typing indicator)
  - **(c) Polling co N sekund** — najprostsze w implementacji; polling co 2–3s jest akceptowalny dla małej rodziny; brak "typing indicator" w czasie rzeczywistym; zero dodatkowej infrastruktury

- [ ] **Definicja "dużo wiadomości":** Jaki próg uruchamia loader + komunikat przy ładowaniu historii? (np. > 50, > 100 wiadomości?)

---

## References

- Discovery summary: sesja /ask (ta rozmowa)
- PRD główny Wspólniak: `./docs/002-prd.md` (repozytorium)
- Repo: `github.com/CrystalGamesStudio/wspolniak`
- Styl nawigacji mobile: X/Twitter (slide-out drawer)
- Punkt odniesienia UX: Telegram na iOS
