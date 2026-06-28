# PRD: Wspólniak — Aktualizacje (Wydajność, Reply, Mentions, Tryb Awaryjny, Bottombar)

## Overview

Zestaw 5 niezależnych usprawnień do istniejącej aplikacji Wspólniak (Next.js App Router, Cloudflare Pages, D1, R2, PWA). Celem jest poprawa wydajności, rozszerzenie funkcji społecznych (reply, @mentions) oraz dodanie narzędzi administracyjnych (tryb awaryjny) i poprawa nawigacji mobilnej.

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
- Sprawdzić czy feed renderuje się przez SSR czy CSR (czy serwer wysyła HTML z danymi czy pusty shell)
- Zmierzyć TTFB i czas ładowania JS bundle (DevTools → Network, Cloudflare Analytics)
- Sprawdzić kolejność operacji: auth check → fetch danych → render
- Zbadać zapytania do D1: czy są N+1 queries, brakujące indeksy, brak paginacji

**Implementacja:**

- **Auth waterfall:** Przenieść sprawdzanie sesji do Next.js middleware (`middleware.ts`) — redirect/render bez czekania na klienta. Użytkownicy niezalogowani są przekierowani zanim przeglądarka wyrenderuje cokolwiek.
- **Bundle:** Wprowadzić code splitting i dynamic imports dla ciężkich komponentów (galerie, edytory). Zweryfikować tree shaking.
- **Feed SSR/Streaming:** Pierwsze posty feedu mają być dostępne w HTML przesłanym z serwera (`generateMetadata` + `Suspense` streaming). Nie czekamy na hydration.
- **Optimistic UI przy publikowaniu:** Po kliknięciu "Opublikuj" post pojawia się w feedzie natychmiast z placeholderem. Upload zdjęć odbywa się w tle (osobny request po zapisaniu tekstu posta). W razie błędu — post oznaczony jako "nie wysłano" z możliwością ponowienia.
- **D1 — zapytania feedu:** Dodać indeksy na `created_at`, `user_id`, `group_id`. Zastąpić N+1 queries JOIN-ami lub batched queries. Wdrożyć cursor-based pagination (nie offset).
- **Obrazy:** Weryfikacja czy jest lazy loading na zdjęciach w feedzie. Jeśli nie — dodać. Sprawdzić czy R2 serwuje przez Cloudflare CDN z odpowiednim `Cache-Control`.

---

#### 2. Reply do komentarzy

**Model danych:**
- Tabela `comments` otrzymuje kolumnę `parent_id` (nullable FK do `comments.id`)
- Reply to komentarz z ustawionym `parent_id`
- Maksymalnie 5 reply na jeden komentarz (walidacja po stronie serwera i UI)
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
- Highlight aktywnej pozycji w kolorze głównym (zielonym)
- Avatar + imię użytkownika w każdym wierszu

**Wygląd wzmianki w tekście:**
- `@imię` wyróżnione kolorem zielonym (główny kolor marki Wspólniak)
- Nieinteraktywne (bez linku, bez profilu)

**Powiadomienia:**
- Gdy komentarz/opis posta z @mention zostanie zapisany — wysłać push notyfikację do wspomnianej osoby
- Ten sam mechanizm co istniejące powiadomienia push (podpiąć do istniejącego serwisu)
- Treść powiadomienia: np. *"[Imię] wspomniał(a) o Tobie w komentarzu"*
- Nie wysyłać notyfikacji gdy ktoś wspomina sam siebie

---

#### 4. Tryb awaryjny (Maintenance Mode)

**Admin panel:**
- W panelu admina (`/app/admin`) dodać sekcję "Tryb awaryjny"
- Switch toggle: Wyłączony / Włączony
- Stan zapisany w bazie danych (tabela `system_settings` lub odpowiednik)

**Overlay:**
- Gdy tryb awaryjny włączony: wszystkie strony pod `/app/*` **z wyjątkiem `/app/admin`** renderują overlay zamiast treści
- Overlay: pełnoekranowe czarne tło (`z-index` maksymalny, pokrywa cały viewport)
- Strona logowania (`/login` lub analogiczna) — **bez zmian**, nadal dostępna
- Zawartość overlay:
  - Duża ikona żółtego trójkąta z wykrzyknikiem (⚠️ lub SVG, min. 80px)
  - Napis: **"Wspólniak jest w trakcie naprawy"** (biały tekst, duży, wycentrowany)
  - Opcjonalnie podtytuł: *"Wróć za chwilę"* (mniejszy, szary)
- Overlay sprawdzany po stronie serwera (middleware lub layout) — użytkownik nie widzi treści nawet przez chwilę

**Bezpieczeństwo:**
- Admin widzi aplikację normalnie mimo włączonego trybu awaryjnego
- Weryfikacja roli admina przed pominięciem overlay

---

#### 5. Bottombar mobilny — zmiana przycisku

- **Usunąć:** przycisk Feedback z dolnej nawigacji mobilnej
- **Dodać:** przycisk Home z ikoną domu (np. `lucide-react`: `Home`)
- Akcja przycisku: nawigacja do `/app` (główny feed)
- Przycisk aktywny (podświetlony) gdy użytkownik jest na stronie feedu
- Kolejność przycisków w bottombarze do ustalenia w kodzie — Home powinien być pierwszym lub drugim przyciskiem (logiczna kolejność nawigacji)

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
middleware.ts
  └── auth check (server-side, przed renderem)
  └── maintenance mode check (server-side, przed renderem)

/app/layout.tsx lub /app/(protected)/layout.tsx
  └── maintenance overlay (warunkowy)

Feed (SSR + Streaming)
  └── Suspense boundaries
  └── cursor pagination
  └── D1 queries z indeksami

Post composer
  └── MentionInput (komponent)
  └── optimistic post creation
  └── background image upload

Comment component
  └── ReplyList (max 5, 1 poziom wcięcia)
  └── MentionInput

MentionInput (współdzielony komponent)
  └── @ trigger
  └── UserDropdown (zielony highlight)
  └── onMention callback → push notification

Push notification service
  └── triggerMentionNotification(userId, actorId, context)

Admin Panel → Maintenance Section
  └── toggle switch
  └── system_settings table (D1)
```

---

## Implementation Decisions

| Obszar | Decyzja | Uzasadnienie |
|--------|---------|--------------|
| Auth check | Next.js middleware | Eliminuje waterfall auth na kliencie |
| Feed rendering | SSR + Suspense streaming | Pierwsze treści bez czekania na JS hydration |
| Optimistic UI | Post pojawia się przed potwierdzeniem serwera | Subiektywne przyspieszenie publikowania |
| Reply model | `parent_id` na istniejącej tabeli `comments` | Minimalna zmiana schematu, brak nowej tabeli |
| Mentions storage | Inline w tekście + osobna tabela `mentions` (userId, commentId/postId) | Potrzebne do wysyłki notyfikacji |
| Maintenance mode | Middleware + D1 `system_settings` | Server-side check, brak flash treści |
| Mentions dropdown | Własny komponent React | Pełna kontrola nad wyglądem i zachowaniem |

---

## Validation Strategy

- Testy manualne na urządzeniu mobilnym (iPhone + Android) po każdym temacie
- DevTools Network tab — porównanie waterfall przed/po optymalizacji
- Weryfikacja push notyfikacji przy @mention na prawdziwym urządzeniu
- Test trybu awaryjnego: zalogowany user, admin, niezalogowany — każdy widzi co powinien

---

## Open Questions

- [ ] Czy tabela `system_settings` już istnieje w D1? Jeśli nie — dodać migrację.
- [ ] Jakie jest aktualne rozwiązanie push notyfikacji (Web Push API / FCM / inne)? Potrzebne do podpięcia @mention notification.
- [ ] Czy feed jest aktualnie SSR, SSG czy CSR? — zdiagnozować przed optymalizacją.
- [ ] Czy istnieje edycja opisów postów? Jeśli tak — MentionInput musi działać też w trybie edycji.

---

## References

- Discovery session: inline powyżej (sesja /ask, 28.06.2026)
- Istniejące PRD: `wspolniak-prd.md`, `wspolniak-kalendarz-prd.md`
- Stack: Next.js App Router, shadcn/ui, Cloudflare Pages, D1, R2, Cloudflare Workers
