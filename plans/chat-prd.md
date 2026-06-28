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
- Push notyfikacje o nowych wiadomościach (podpięcie pod istniejący system)
- Ładowanie wszystkich wiadomości z ostatnich 24h przy otwarciu chatu; loader + informacja gdy jest ich dużo
- Podstrona `/chat`
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

### Wiadomość (Message)

Każda wiadomość zawiera:
- `id`
- `authorId` + dane autora (imię, avatar)
- `text` — treść tekstowa
- `replyToId` — opcjonalne id wiadomości, na którą jest odpowiedź (+ snapshot tekstu oryginału)
- `reactions` — tablica { emoji, userId }
- `createdAt` — timestamp
- `expiresAt` — `createdAt + 24h`

### Real-time

Wiadomości muszą być dostarczane bez odświeżania strony. Wymaga rozwiązania real-time na Cloudflare (patrz Open Questions).

Typing indicator: broadcast zdarzenia "user is typing" — wygasa automatycznie po ~3s braku aktywności.

### Nawigacja

**Mobile:**
- Hamburger (lewy górny róg) → slide-out drawer z lewej
- Drawer zawiera wszystkie sekcje: Home, Chat, Kalendarz, Albumy, Profil itd.
- Nagłówek główny: "Witamy!"

**Desktop:**
- Istniejący sidebar — dodać pozycję "Chat"

### Wygasanie wiadomości

Cloudflare Worker (Cron) sprawdza i usuwa wiadomości, których `expiresAt < now()`. Można uruchamiać co godzinę.

### Push notyfikacje

Podpiąć pod istniejący system push w codebase — wysyłać przy nowej wiadomości na chacie.

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
| Real-time | Do ustalenia | Patrz Open Questions |
| Jakość animacji | Telegram na iOS | Punkt odniesienia dla płynności i dopracowania |

---

## Validation Strategy

Wdrożenie do produkcji → obserwacja czy rodzina faktycznie przechodzi z WhatsApp na chat Wspólniaka.

---

## Open Questions

- [ ] **Real-time transport:** Jak obsłużyć real-time na Cloudflare bez istniejącej infrastruktury? Opcje: (a) Cloudflare Durable Objects z WebSocket — najbardziej niezawodne, wyższy nakład; (b) Server-Sent Events (SSE) przez Workers — prostsze, tylko server→client; (c) polling co N sekund — najprostsze, najmniej "real-time". Wymaga decyzji architektonicznej przed implementacją.
- [ ] **Definicja "dużo wiadomości":** Jaki próg uruchamia loader + komunikat przy ładowaniu historii? (np. > 50, > 100 wiadomości?)

---

## References

- Discovery summary: inline powyżej (sesja /ask)
- PRD główny Wspólniak: `./wspolniak-prd.md` (istniejący)
- Styl nawigacji mobile: X/Twitter (slide-out drawer)
- Punkt odniesienia UX: Telegram na iOS
