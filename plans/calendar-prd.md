# PRD: Wspólniak — Aktualizacje (Wydajność, Reply, Mentions, Tryb Awaryjny, Bottombar)

## Overview

Zestaw 5 niezależnych usprawnień do istniejącej aplikacji Wspólniak. Celem jest poprawa wydajności, rozszerzenie funkcji społecznych (reply, @mentions) oraz dodanie narzędzi administracyjnych (tryb awaryjny) i poprawa nawigacji mobilnej.

---

## Stack (rzeczywisty, zweryfikowany w repo)

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (SSR + Router + Query) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| API | Hono na Cloudflare Workers |
| Database | Neon PostgreSQL (serverless) |
| ORM | Drizzle ORM |
| Image storage | Cloudflare Images |
| Push | Web Push VAPID |
| Build | Vite |
| Package manager | pnpm |
| Linting | Biome |
| Testing | Vitest |
| Deploy | Cloudflare Workers (wrangler) |

---

## Problem Statement

1. Aplikacja ładuje się zbyt wolno — widoczny waterfall: czarny ekran → loader → biały ekran → loader → feed. Użytkownicy na LTE i WiFi odczuwają wyraźne opóźnienia.
2. Brak możliwości odpowiadania na konkretne komentarze utrudnia rozmowę w wątkach.
3. Brak @mentions uniemożliwia bezpośrednie zwrócenie uwagi konkretnej osoby.
4. Admin nie ma możliwości szybkiego wyłączenia widoku aplikacji podczas prac serwisowych.
5. Bottombar mobilny zawiera przycisk Feedback zamiast bardziej użytecznego przycisku powrotu do feedu.

---

## Users

| Typ użytkownika | Opis | Wolumen |
|----------------|------|---------|
| Użytkownik rodziny | Mobile-first, mixed technical skills, PWA (iOS/Android/desktop) | ~10–30 osób |
| Admin | Zarządza kontami, treścią, ustawieniami systemowymi | 1 osoba |

---

## Goals & Success Criteria

- [ ] Wyeliminowanie czarnego ekranu i podwójnego loadera przy wejściu do aplikacji
- [ ] Czas do pierwszego renderowania feedu skrócony o co najmniej 60%
- [ ] Czas publikowania posta (z plikiem) odczuwalnie krótszy dzięki optimistic UI
- [ ] Użytkownik może odpowiedzieć na komentarz (max 5 reply per komentarz)
- [ ] Użytkownik może @wspomnieć inną osobę w komentarzu lub opisie posta
- [ ] Wspomniana osoba otrzymuje push notyfikację
- [ ] Admin może włączyć tryb awaryjny jednym switchem
- [ ] Bottombar mobilny zawiera przycisk Home zamiast Feedback

---

## User Stories

1. Jako użytkownik chcę żeby aplikacja załadowała się szybko, bez czarnego ekranu i podwójnego spinnera.
2. Jako użytkownik chcę odpowiedzieć bezpośrednio na konkretny komentarz, żeby rozmowa była czytelna.
3. Jako użytkownik chcę napisać @imię w komentarzu lub opisie posta i zobaczyć dropdown z listą osób, żeby szybko oznaczyć konkretną osobę.
4. Jako wspomniana osoba chcę dostać push notyfikację kiedy ktoś użyje @mojaimię, żeby wiedzieć że się do mnie zwracają.
5. Jako admin chcę jednym switchem w panelu zakryć aplikację dla użytkowników podczas naprawy, żeby nie widzieli niepełnych danych lub błędów.
6. Jako użytkownik mobilny chcę mieć przycisk Home w dolnej nawigacji, żeby szybko wrócić do feedu.

---

## Scope

### In scope

#### 1. Optymalizacja wydajności

**Diagnoza (wykonać przed wdrożeniem):**
- Sprawdzić czy feed renderuje się przez SSR czy CSR — TanStack Start obsługuje SSR przez `loader` w definicji routy, sprawdzić czy feed-route ma loader czy dane są fetchowane po stronie klienta
- Zmierzyć TTFB i czas ładowania JS bundle (DevTools → Network)
- Sprawdzić kolejność operacji: auth check → fetch danych → render — czy auth jest blokujący?
- Zbadać zapytania do Neon PostgreSQL: N+1 queries, brakujące indeksy, brak paginacji

**Implementacja:**

- **Auth waterfall:** W TanStack Start auth sprawdzamy w `beforeLoad` na chronionych routach — weryfikacja czy to jest już zrobione i czy działa server-side. Użytkownicy niezalogowani powinni być przekierowani przez `redirect()` w `beforeLoad`, bez renderowania czegokolwiek na kliencie.
- **Bundle / code splitting:** Sprawdzić konfigurację Vite — czy ciężkie komponenty (galerie, edytory) są lazy-loaded przez `React.lazy()` lub dynamiczne importy. Dodać gdzie brakuje.
- **Feed SSR:** TanStack Start ładuje dane w `loader` funkcji routy, dane są dostępne przy pierwszym renderze HTML. Jeśli feed używa `useQuery` bez preloadowania — przepiąć na `ensureQueryData` w loaderze lub pełny SSR loader, żeby dane przychodziły razem z HTML.
- **Streaming:** Sprawdzić czy TanStack Start jest skonfigurowany z `streaming: true` w konfiguracji serwera — pozwala na Suspense streaming podobnie jak Next.js.
- **Optimistic UI przy publikowaniu:** Po kliknięciu "Opublikuj" post pojawia się w feedzie natychmiast z placeholderem (TanStack Query `optimisticUpdate`). Upload zdjęć do Cloudflare Images odbywa się w tle osobnym requestem po zapisaniu tekstu posta. W razie błędu — post oznaczony jako "nie wysłano" z możliwością ponowienia.
- **PostgreSQL — zapytania feedu:** Dodać indeksy na `created_at`, `user_id`. Zastąpić N+1 queries JOIN-ami lub batched queries przez Drizzle. Wdrożyć cursor-based pagination (nie offset).
- **Obrazy:** Weryfikacja czy zdjęcia w feedzie mają lazy loading (`loading="lazy"`). Cloudflare Images serwuje już przez CDN z wariantami (thumbnail/full) — upewnić się że feed używa thumbnailów, nie pełnych rozdzielczości.

---

#### 2. Reply do komentarzy

**Model danych:**
- Tabela `comments` otrzymuje kolumnę `parent_id` (nullable FK do `comments.id`)
- Reply to komentarz z ustawionym `parent_id`
- Maksymalnie 5 reply na jeden komentarz (walidacja po stronie serwera w Hono i w UI)
- Jeden poziom wcięcia — reply na reply nie jest możliwe (płaskie wątki)

**UI:**
- Pod każdym komentarzem przycisk "Odpowiedz"
- Reply są wyświetlane wciętą listą pod komentarzem nadrzędnym
- Licznik reply widoczny przy komentarzu (np. "5 odpowiedzi")
- Gdy limit 5 osiągnięty — przycisk "Odpowiedz" znika lub jest disabled z tooltipem

**Uprawnienia:**
- Każdy zalogowany użytkownik może dodać reply
- Admin może usuwać reply (tak samo jak komentarze)
- Użytkownik nie może usunąć własnego reply (zgodnie z istniejącą polityką komentarzy)

---

#### 3. @mentions

**Zachowanie:**
- Aktywowane przez wpisanie `@` w polu komentarza lub opisu posta (w tym przy edycji posta jeśli edycja istnieje)
- Po wpisaniu `@` pojawia się dropdown z listą użytkowników filtrowany na bieżąco po wpisaniu kolejnych znaków (np. `@An` → pokazuje Ania, Andrzej)
- Kliknięcie nazwy w dropdown wstawia `@imię` do tekstu i zamyka dropdown
- Klawiszem Escape lub kliknięciem poza dropdown — zamknięcie bez wstawiania

**Wygląd dropdownu:**
- Małe okienko (max-height: ~200px, scroll jeśli więcej użytkowników)
- Kolor tła: biały/ciemny zgodnie z motywem aplikacji
- Highlight aktywnej pozycji w kolorze głównym (zielonym, główny kolor marki Wspólniak)
- Avatar + imię użytkownika w każdym wierszu

**Wygląd wzmianki w tekście:**
- `@imię` wyróżnione kolorem zielonym (główny kolor marki Wspólniak)
- Nieinteraktywne (bez linku, bez profilu)

**Powiadomienia:**
- Gdy komentarz/opis posta z @mention zostanie zapisany — wysłać push notyfikację do wspomnianej osoby
- Ten sam mechanizm Web Push VAPID co istniejące powiadomienia (podpiąć do istniejącego serwisu w Hono Workers)
- Treść powiadomienia: np. *"[Imię] wspomniał(a) o Tobie w komentarzu"*
- Nie wysyłać notyfikacji gdy ktoś wspomina sam siebie

---

#### 4. Tryb awaryjny (Maintenance Mode)

**Admin panel:**
- W panelu admina dodać sekcję "Tryb awaryjny"
- Switch toggle: Wyłączony / Włączony
- Stan zapisany w bazie danych Neon PostgreSQL (tabela `system_settings` lub odpowiednik — sprawdzić czy istnieje, jeśli nie — dodać migrację Drizzle)

**Overlay:**
- Gdy tryb awaryjny włączony: wszystkie chronione routy **z wyjątkiem routy admina** renderują overlay zamiast treści
- Implementacja: w `beforeLoad` chronionego layoutu sprawdzić flagę maintenance z DB/cache; jeśli true i user nie jest adminem — zwrócić overlay zamiast dzieci
- Overlay: pełnoekranowe czarne tło (`z-index` maksymalny, pokrywa cały viewport)
- Strona logowania — **bez zmian**, nadal dostępna
- Zawartość overlay:
  - Duża ikona żółtego trójkąta z wykrzyknikiem (⚠️ lub SVG, min. 80px)
  - Napis: **"Wspólniak jest w trakcie naprawy"** (biały tekst, duży, wycentrowany)
  - Podtytuł: *"Wróć za chwilę"* (mniejszy, szary)
- Overlay sprawdzany server-side w loaderze/beforeLoad — użytkownik nie widzi treści nawet przez chwilę

**Bezpieczeństwo:**
- Admin widzi aplikację normalnie mimo włączonego trybu awaryjnego
- Weryfikacja roli admina przed pominięciem overlay

---

#### 5. Bottombar mobilny — zmiana przycisku

- **Usunąć:** przycisk Feedback z dolnej nawigacji mobilnej
- **Dodać:** przycisk Home z ikoną domu (`lucide-react`: `Home`)
- Akcja przycisku: nawigacja do głównego feedu
- Przycisk aktywny (podświetlony) gdy użytkownik jest na stronie feedu (TanStack Router `useMatch` lub `useRouterState`)
- Kolejność przycisków w bottombarze do ustalenia w kodzie — Home powinien być pierwszym lub drugim przyciskiem

---

## Out of Scope

- Natywne systemowe menu i alerty (iOS Action Sheet, Android Material) — **wykluczone**, zostaje obecny styl webowy
- Powiadomienia e-mail przy @mentions
- Edycja komentarzy i reply
- Usuwanie własnych reply przez użytkownika
- Niestandardowy tekst trybu awaryjnego (stały napis)
- Zagnieżdżone reply (reply na reply)
- @mentions z linkiem do profilu użytkownika

---

## System Components

```
TanStack Router — chroniony layout (beforeLoad)
  └── auth check (server-side)
  └── maintenance mode check (server-side, skip dla admina)
  └── maintenance overlay (warunkowy render)

Feed route
  └── loader / ensureQueryData (SSR preload)
  └── Suspense streaming
  └── cursor pagination

Post composer
  └── MentionInput (komponent)
  └── optimistic post creation (TanStack Query optimisticUpdate)
  └── background Cloudflare Images upload

Comment component
  └── ReplyList (max 5, 1 poziom wcięcia)
  └── MentionInput

MentionInput (współdzielony komponent)
  └── @ trigger
  └── UserDropdown (zielony highlight, Tailwind v4)
  └── onMention callback → push notification

Hono API (Cloudflare Workers)
  └── POST /api/mentions → triggerMentionNotification(userId, actorId, context)
  └── Web Push VAPID (istniejący serwis)

Admin Panel — sekcja Tryb Awaryjny
  └── toggle switch
  └── system_settings table (Neon PostgreSQL, Drizzle migration)
```

---

## Implementation Decisions

| Obszar | Decyzja | Uzasadnienie |
|--------|---------|--------------|
| Auth check | `beforeLoad` w TanStack Router | Server-side, eliminuje waterfall auth na kliencie |
| Feed rendering | SSR loader + Suspense streaming | Dane w HTML, nie czekamy na hydration |
| Optimistic UI | TanStack Query `optimisticUpdate` | Subiektywne przyspieszenie publikowania |
| Reply model | `parent_id` na istniejącej tabeli `comments` | Minimalna zmiana schematu, migracja Drizzle |
| Mentions storage | Inline w tekście + osobna tabela `mentions` (userId, commentId/postId) | Potrzebne do wysyłki notyfikacji |
| Maintenance mode | `beforeLoad` + Neon `system_settings` | Server-side check bez flash treści |
| Mentions dropdown | Własny komponent React | Pełna kontrola nad wyglądem, Tailwind v4 |
| Push przy @mention | Hono endpoint → istniejący Web Push VAPID | Brak nowej infrastruktury |

---

## Validation Strategy

- Testy manualne na urządzeniu mobilnym (iPhone + Android) po każdym temacie
- DevTools Network tab — porównanie waterfall przed/po optymalizacji
- Weryfikacja push notyfikacji przy @mention na prawdziwym urządzeniu
- Test trybu awaryjnego: zalogowany user, admin, niezalogowany — każdy widzi co powinien

---

## Open Questions

- [ ] Czy tabela `system_settings` już istnieje w Neon PostgreSQL? Jeśli nie — dodać migrację Drizzle.
- [ ] Jaki jest dokładny kod istniejącego serwisu Web Push VAPID w Workers? Potrzebne do podpięcia notyfikacji @mention.
- [ ] Czy feed route ma już loader z `ensureQueryData` (SSR) czy używa tylko `useQuery` (CSR)? — zdiagnozować przed optymalizacją.
- [ ] Czy istnieje edycja opisów postów w UI? Jeśli tak — MentionInput musi działać też w trybie edycji.

---

## References

- Discovery session: sesja /ask, 29.06.2026
- Istniejące PRD: `wspolniak-prd.md`, `wspolniak-kalendarz-prd.md`
- Repo: https://github.com/CrystalGamesStudio/wspolniak
- Stack: TanStack Start, Hono/Cloudflare Workers, Neon PostgreSQL, Drizzle ORM, Cloudflare Images, Web Push VAPID, Tailwind v4 + shadcn/ui, Vite, pnpm, Biome
