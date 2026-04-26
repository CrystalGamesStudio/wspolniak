---
name: TDD Vertical Slice
about: Feature spec ready for implementation via TDD (red → green → refactor) in vertical slices
title: "feat(<scope>): <short imperative description>"
labels: ["enhancement"]
assignees: []
---

### Kontekst

<!--
Dlaczego to robimy. Link do dokumentu źródłowego (PRD, council, design doc).
Co decyzja w tym ticketcie odblokowuje albo zamyka.
-->

### Cel

<!--
Jednym zdaniem: co użytkownik / system będzie umiał po zmergowaniu.
Nie "jak", tylko "co".
-->

### Kontrakt

<!--
Konkretne API / shape danych / UI behavior.
Dla endpointu: HTTP method + path, request shape, response shape, error codes.
Dla UI: opis stanu początkowego, akcji użytkownika, stanu końcowego.
Dla biblioteki/modułu: publiczny interface (eksportowane funkcje + sygnatury).
-->

### Decyzje architektoniczne

<!--
Deep modules: co jest wąskim publicznym interfejsem, co hermetyzowane?
Czy deepening istniejący moduł, czy nowy?
Linki do reguł projektowych, jeśli istotne (.claude/rules/*).
-->

### Zmiany schematu (jeśli są)

<!--
Tabele, kolumny, indeksy, constrainty.
Nazwa migracji generowanej przez `pnpm db:dev:generate`.
-->

### Vertical slices (kolejność TDD)

<!--
Każdy slice ma sens samodzielnie i może być zmergowany niezależnie.
Każdy ma sekcje: Red (failing tests), Green (implementacja), Acceptance (DoD).
Slices mogą iść równolegle po wspólnej zależności — narysuj graf.
-->

#### Slice 1: <nazwa>

**Red:**
- <plik testowy>: <opis testu który najpierw failuje>

**Green:**
- <plik implementacji>: <co dopisać>

**Acceptance:**
- [ ] <warunek 1>
- [ ] <warunek 2>

---

#### Slice 2: <nazwa>

**Red:**
- ...

**Green:**
- ...

**Acceptance:**
- [ ] ...

---

### Pliki do utworzenia/edycji

**Nowe:**
- `src/...`

**Modyfikowane:**
- `src/...`

### Quality gates (przed merge)

- [ ] `pnpm types` — zero błędów
- [ ] `pnpm test` — wszystkie testy zielone
- [ ] `pnpm lint` — zero błędów Biome
- [ ] `pnpm knip` — brak unused exports
- [ ] `pnpm db:dev:generate && pnpm db:dev:migrate` — migracja czysto przechodzi (jeśli zmiana schematu)
- [ ] Manualna weryfikacja na dev: <konkretny smoke test>

### Out of scope (świadome odcięcia)

<!--
Co NIE wchodzi do tego ticketu, mimo że ktoś mógłby się tego spodziewać.
Każdy odcięty zakres: jedno zdanie *dlaczego* odcięty (YAGNI / inny ticket / post-MVP).
-->

- ...

### Dependency graph dla TDD

```
Slice 1 ──┬──> Slice 2 ──┐
          │              ├──> Slice N
          └──> Slice 3 ──┘
```

### Definition of done

<!--
Jeden zdania: kiedy ticket uznajemy za zamknięty.
Zwykle: "zdeployowane na <env>, manualna weryfikacja przeszła, all quality gates green".
-->
