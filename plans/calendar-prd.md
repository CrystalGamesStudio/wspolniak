# PRD: Wspólniak – Kalendarz

## Overview

Moduł Kalendarza dla istniejącej aplikacji rodzinnej Wspólniak (produkcja).
Umożliwia członkom rodziny przeglądanie i zarządzanie wydarzeniami rodzinnymi oraz świętami, tak aby nikt nie zapomniał o ważnych datach.

---

## Problem Statement

Rodzina nie ma jednego wspólnego miejsca, w którym widać nadchodzące święta i uroczystości rodzinne. Ważne daty (imieniny, rocznice, święta kościelne) umykają uwadze. Kalendarz w Wspólniaku ma to zmienić — jedno miejsce, widoczne dla wszystkich, z aktywnym przypominaniem przez Feed.

---

## Users

| Typ użytkownika | Opis | Liczba |
|-----------------|------|--------|
| Członek rodziny | Dodaje/edytuje własne wydarzenia, przegląda kalendarz | ~10–20 |
| Admin | Pełny dostęp do wszystkich wydarzeń, zarządza świętami systemowymi | 1 |
| System ("Kalendarz") | Wirtualny użytkownik generujący posty-przypomnienia na Feedzie | — |

---

## Goals & Success Criteria

- [ ] Każdy członek rodziny może dodać, edytować i usunąć własne wydarzenie
- [ ] Polskie święta (ustawowe + kościelne) ładowane automatycznie, bez ręcznego wprowadzania
- [ ] Święta ruchome (Wielkanoc, Popielec itp.) poprawnie wyliczane co rok
- [ ] Funkcja przypomnienia: tydzień przed wydarzeniem pojawia się post na Feedzie
- [ ] Widok mobilny i desktopowy działają zgodnie ze specyfikacją
- [ ] Członkowie rodziny testują funkcjonalność po wdrożeniu

---

## User Stories

1. Jako członek rodziny chcę dodać wydarzenie cykliczne (np. imieniny) z wyborem częstotliwości, żeby nie musieć dodawać go ręcznie co roku.
2. Jako członek rodziny chcę zaznaczyć "przypomnienie" przy wydarzeniu, żeby tydzień wcześniej na Feedzie pojawił się post przypominający całej rodzinie.
3. Jako członek rodziny chcę przeglądać listę nadchodzących wydarzeń na telefonie, żeby szybko sprawdzić co się zbliża.
4. Jako admin chcę mieć możliwość edycji lub usunięcia dowolnego wydarzenia (w tym systemowych świąt), żeby utrzymać porządek w kalendarzu.
5. Jako admin chcę włączyć przypomnienie dla wybranych świąt systemowych (np. Wielkanoc, Boże Narodzenie), żeby Feed przypominał o najważniejszych świętach.
6. Jako użytkownik desktopowy chcę widzieć siatkę miesięczną kalendarza, żeby mieć lepszy przegląd całego miesiąca.

---

## Scope

### In scope

- Tworzenie wydarzeń: tytuł, opis, data (dzień + miesiąc; rok opcjonalny dla jednorazowych)
- Typy cykliczności: jednorazowe / co tydzień / co miesiąc / co rok
- Edycja i usuwanie: tylko autor lub admin
- Przypomnienie (checkbox): automatyczny post od systemowego użytkownika "Kalendarz" na Feedzie 7 dni przed wydarzeniem
- Przy wydarzeniach cyklicznych: przypomnienie odpala się automatycznie przy każdym powtórzeniu
- Polskie święta ustawowe i kościelne (w tym ruchome) — ładowane automatycznie z zewnętrznego API/bazy
- Święta systemowe: przypomnienie domyślnie wyłączone; admin może włączyć dla wybranych
- Admin: pełny dostęp do edycji, usuwania i zarządzania przypomnieniami wszystkich wydarzeń
- Widok mobilny: lista nadchodzących wydarzeń (chronologicznie)
- Widok desktopowy: lista + siatka miesięczna
- Wszystkie wydarzenia widoczne dla całej rodziny (brak podziału na grupy)

### Out of scope

- Komentarze pod wydarzeniami
- Podział wydarzeń na grupy/subprzestrzenie
- Push notyfikacje (planowane post-MVP)
- Zaproszenia / RSVP na wydarzenia
- Import/export kalendarza (iCal, Google Calendar)
- Obsługa świąt z innych krajów / religii

---

## System Components

### 1. Baza danych (Cloudflare D1)

**Tabela `calendar_events`**
| Kolumna | Typ | Opis |
|---------|-----|------|
| id | TEXT (UUID) | PK |
| title | TEXT | Tytuł wydarzenia |
| description | TEXT | Opis (opcjonalny) |
| day | INTEGER | Dzień (1–31) |
| month | INTEGER | Miesiąc (1–12) |
| year | INTEGER | Rok (NULL dla cyklicznych) |
| recurrence | TEXT | `none` / `weekly` / `monthly` / `yearly` |
| reminder_enabled | BOOLEAN | Czy wysłać post-przypomnienie |
| author_id | TEXT | FK → users; NULL dla wydarzeń systemowych |
| is_system | BOOLEAN | TRUE dla automatycznie wgranych świąt |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 2. Moduł świąt polskich

- Integracja z zewnętrznym API lub lokalną biblioteką (np. `date-holidays`, `@nager/date`) do pobierania świąt ustawowych i kościelnych
- Obsługa świąt ruchomych (Wielkanoc, Popielec, Wniebowstąpienie itp.) — algorytm Gaussowski lub dane z API
- Święta ładowane do bazy jako `is_system = true` przy starcie aplikacji lub jako Cron job (np. Cloudflare Worker raz w roku)
- Deduplication: nie ładuj ponownie jeśli już istnieje w danym roku

---

### 3. Moduł przypomnień (Cron Job)

- Cloudflare Worker uruchamiany codziennie (np. o 08:00)
- Sprawdza: czy za 7 dni jest wydarzenie z `reminder_enabled = true`
- Dla cyklicznych: wylicza następne wystąpienie i sprawdza 7-dniowy próg
- Tworzy post w Feed od systemowego użytkownika "Kalendarz" (istniejący mechanizm postów)
- Idempotentny: nie tworzy duplikatów (flaga `reminder_sent` lub tabela `reminder_log`)

---

### 4. API (Next.js App Router – Route Handlers)

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/calendar/events` | GET | Lista wydarzeń (z filtrem miesiąca/zakresu) |
| `/api/calendar/events` | POST | Utwórz wydarzenie |
| `/api/calendar/events/[id]` | PATCH | Edytuj wydarzenie (autor lub admin) |
| `/api/calendar/events/[id]` | DELETE | Usuń wydarzenie (autor lub admin) |
| `/api/calendar/events/[id]/reminder` | PATCH | Włącz/wyłącz przypomnienie (admin dla systemowych) |

---

### 5. UI (Next.js + shadcn/ui)

**Mobile (`< md`):**
- Lista nadchodzących wydarzeń, posortowana chronologicznie
- Wyróżnienie: typ (systemowe vs użytkownika), ikona cykliczności, ikona przypomnienia

**Desktop (`≥ md`):**
- Split view: siatka miesięczna (lewo) + lista wydarzeń wybranego dnia (prawo)
- Nawigacja po miesiącach

**Formularz tworzenia/edycji wydarzenia:**
- Tytuł (wymagany)
- Opis (opcjonalny)
- Data: dzień + miesiąc (rok opcjonalny, wymagany dla jednorazowych)
- Powtarzanie: jednorazowe / co tydzień / co miesiąc / co rok
- Przypomnienie: checkbox (domyślnie OFF dla wszystkich)

---

## Implementation Decisions

| Decyzja | Wybór | Uzasadnienie |
|---------|-------|--------------|
| Stack | Next.js App Router + Cloudflare D1 + R2 | Istniejący stack produkcyjny |
| Święta polskie | Zewnętrzne API lub `date-holidays` (npm) | Obsługa świąt ruchomych bez ręcznego kodowania |
| Przypomnienia | Cloudflare Cron Worker | Brak push notyfikacji; Feed jako kanał komunikacji |
| Widoczność | Cała rodzina (bez grup) | Grupy poza zakresem; prostota |
| Rok w dacie | Opcjonalny dla cyklicznych | Imieniny/urodziny nie wymagają roku |
| Systemowy user "Kalendarz" | Istniejący mechanizm postów | Reużycie gotowej infrastruktury Feed |

---

## Validation Strategy

Manualne testy przez członków rodziny po wdrożeniu:
- Dodanie własnego wydarzenia cyklicznego
- Weryfikacja że przypomnienie pojawia się na Feedzie tydzień przed
- Sprawdzenie że polskie święta są poprawnie załadowane
- Testy edycji i usuwania wydarzeń

---

## Open Questions

- [ ] Które API/biblioteka do polskich świąt kościelnych? Weryfikacja dostępności `date-holidays` lub `@nager/date` dla pełnego zakresu (ustawowe + kościelne)
- [ ] Czy Cron Worker powinien obsługiwać retroaktywne ładowanie świąt dla bieżącego roku przy pierwszym deployu?
- [ ] Jak obsłużyć zmianę daty w wydarzeniu cyklicznym — czy zmiana dotyczy tylko przyszłych wystąpień czy wszystkich?

---

## References

- Discovery summary: inline powyżej (sesja `/ask`)
- Główny PRD Wspólniak: `PRD.md`
