# PRD: Wspólniak – Kalendarz v1

## Overview

Pierwsza wersja modułu kalendarza. Celowo ograniczona do minimum —
admin zarządza ważnymi datami przez panel admina, a rodzina dowiaduje
się o nich wyłącznie przez automatyczne posty na Feedzie.
Brak widoku kalendarza, brak interakcji ze strony rodziny.

---

## Problem Statement

Rodzina zapomina o ważnych datach (imieniny, rocznice, święta).
v1 rozwiązuje to jedną rzeczą: automatyczny post na Feedzie w dniu
wydarzenia i tydzień wcześniej.

---

## Zakres v1

### In scope

- Panel admina: dodawanie, edytowanie, usuwanie wydarzeń
- Cron Worker: codzienne sprawdzanie dat i wystawianie postów na Feedzie
- Post „tydzień przed" (D-7) i post „dzisiaj" (D-0) od systemowego użytkownika „Kalendarz"
- Wsparcie dla cykliczności rocznej (imieniny, urodziny, święta)

### Out of scope (post-v1)

- Widok `/calendar` — brak strony kalendarza
- Dodawanie wydarzeń przez innych członków rodziny
- Checkbox „przypomnienie" po stronie użytkownika
- Widok listy / siatki miesięcznej
- Automatyczne pobieranie polskich świąt
- Komentarze pod wydarzeniami

---

## Users

| Kto | Co robi |
|-----|---------|
| Admin | Dodaje / edytuje / usuwa wydarzenia w panelu admina |
| System („Kalendarz") | Wirtualny użytkownik wystawiający posty na Feedzie |
| Rodzina | Widzi posty przypominające na Feedzie — nic więcej |

---

## User Stories

1. Jako admin chcę dodać wydarzenie (tytuł, dzień, miesiąc, opcjonalnie rok) żeby system automatycznie przypomniał rodzinie o tej dacie.
2. Jako admin chcę edytować lub usunąć istniejące wydarzenie, żeby utrzymać aktualną listę.
3. Jako członek rodziny chcę zobaczyć na Feedzie post od „Kalendarz" z informacją że za tydzień są imieniny babci, żeby zdążyć zadzwonić.
4. Jako członek rodziny chcę zobaczyć na Feedzie post od „Kalendarz" z informacją że dzisiaj są urodziny taty.

---

## Schema (Neon PostgreSQL + Drizzle ORM)

```sql
CREATE TABLE calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  day         INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INTEGER,           -- NULL = cykliczne co rok
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE calendar_reminder_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('week_before', 'on_day')),
  fired_for  DATE NOT NULL,      -- konkretna data (rok-miesiąc-dzień) dla której odpaliło
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, type, fired_for)
);
```

`calendar_reminder_log` zapewnia idempotentność — Cron nie wystawi
duplikatu jeśli odpali się dwa razy tego samego dnia.

---

## Cron Worker

**Harmonogram:** codziennie o 08:00 (Cron Trigger w `wrangler.jsonc`)

**Logika:**

```
dla każdego dnia D (dziś):
  1. Pobierz wydarzenia gdzie (day, month) == (D.day, D.month)      → post „on_day"
  2. Pobierz wydarzenia gdzie (day, month) == (D+7).day, (D+7).month → post „week_before"

  dla każdego trafionego wydarzenia:
    - sprawdź reminder_log (event_id, type, fired_for) → skip jeśli już jest
    - wyślij post na Feed od użytkownika „Kalendarz"
    - zapisz wpis do reminder_log
```

**Treść postów:**

- `week_before`: „📅 Za tydzień: {tytuł}" + opis (jeśli podany)
- `on_day`: „🎉 Dzisiaj: {tytuł}" + opis (jeśli podany)

---

## API (Hono na Cloudflare Workers)

| Endpoint | Metoda | Opis | Dostęp |
|----------|--------|------|--------|
| `/api/admin/calendar` | GET | Lista wszystkich wydarzeń | Admin |
| `/api/admin/calendar` | POST | Utwórz wydarzenie | Admin |
| `/api/admin/calendar/:id` | PATCH | Edytuj wydarzenie | Admin |
| `/api/admin/calendar/:id` | DELETE | Usuń wydarzenie | Admin |

Brak publicznych endpointów — rodzina nie pobiera listy wydarzeń.

---

## UI (TanStack Start + shadcn/ui)

**Panel admina — nowa sekcja „Kalendarz":**

- Tabela z listą wydarzeń (tytuł, data, cykliczne?)
- Przycisk „Dodaj wydarzenie" → modal z polami:
  - Tytuł (wymagany)
  - Opis (opcjonalny)
  - Dzień + Miesiąc (wymagane)
  - Rok (opcjonalny; brak = cykliczne co rok)
- Akcje przy każdym wierszu: Edytuj / Usuń

**Feed (bez zmian):**

Posty od „Kalendarz" wyglądają jak zwykłe posty systemowe
(tak jak posty od „Kalendarz" z poprzednich ficzerów).

---

## Implementation Decisions

| Decyzja | Wybór | Uzasadnienie |
|---------|-------|--------------|
| Brak /calendar | Brak widoku kalendarza | v1: minimalny ślad, tylko Feed |
| Tylko admin dodaje | Prostota zarządzania | v2 może otworzyć dla rodziny |
| Cykl roczny tylko | year = NULL | Tygodniowe/miesięczne post-v1 |
| reminder_log | UNIQUE constraint | Idempotentność Crona bez ryzyka duplikatów |
| Treść postu | Hardcoded template | Prosto, bez konfiguracji |

---

## Open Questions

- [ ] Czy systemowy użytkownik „Kalendarz" już istnieje w bazie (z poprzednich ficzerów), czy trzeba go stworzyć? jako admin ma wrzucac posty z wydarzeniami
- [ ] Jakie pole w tabeli `posts` użyć dla autora systemowego (author_id = NULL + osobna flaga, czy stały UUID)?
- [ ] Cron Trigger — osobny Worker czy handler w istniejącym Worker Hono?

---

## References

- Stack: github.com/CrystalGamesStudio/wspolniak (README.md)
- Pełny PRD kalendarza (przyszłe wersje): `./plans/wspolniak-kalendarz-prd.md`
