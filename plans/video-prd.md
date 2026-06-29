# PRD: Wspólniak Video

## Overview

Zakładka `/video` umożliwia członkom rodziny wgrywanie i oglądanie filmów wideo w ramach prywatnej instancji Wspólniaka. Filmy są przechowywane na dedykowanym kanale YouTube (unlisted) i odtwarzane przez iframe embed bezpośrednio w aplikacji.

## Problem Statement

Rodzina chce dzielić się nagraniami wideo w tej samej zamkniętej przestrzeni co zdjęcia i posty — bez konieczności używania zewnętrznych komunikatorów, bez zakładania kont YouTube przez każdego członka i bez publicznego udostępniania filmów.

## Users

| Typ użytkownika | Opis | Wolumen |
|----------------|------|---------|
| Członek rodziny | Ogląda i wgrywa filmy | wszyscy użytkownicy instancji |
| Admin | Jak wyżej + może usuwać dowolne filmy | 1 per instancja |

## Goals & Success Criteria

- [ ] Członek rodziny może wgrać film z telefonu lub komputera bez zakładania konta YouTube
- [ ] Film pojawia się w feedzie `/video` po zakończeniu uploadu
- [ ] Film można obejrzeć bezpośrednio w aplikacji (iframe)
- [ ] Film można załączyć do posta w głównym feedzie
- [ ] Autor lub admin może usunąć film (ze Wspólniaka i z YouTube)
- [ ] Upload ma widoczny pasek postępu
- [ ] Dzienny limit 3 filmów jest egzekwowany przez UI i backend

## User Stories

1. Jako członek rodziny chcę wgrać film z urodzin tak, żeby reszta rodziny mogła go obejrzeć w aplikacji bez wychodzenia do YouTube.
2. Jako członek rodziny chcę zobaczyć wszystkie rodzinne filmy w jednym miejscu, posortowane od najnowszego.
3. Jako autor posta chcę dołączyć film do posta w feedzie tak, żeby był widoczny razem z opisem.
4. Jako autor chcę usunąć film, który wgrałem przez pomyłkę — tak, żeby zniknął i ze Wspólniaka i z YouTube.
5. Jako admin chcę mieć możliwość usunięcia dowolnego filmu w instancji.

## Scope

### In scope

- Nowa zakładka `/video` z chronologicznym feedem filmów
- Upload wideo: przeglądarka → YouTube Resumable Upload API (bezpośrednio, z pominięciem Workers)
- Worker dostarcza jednorazowo token OAuth + zapisuje metadane po zakończeniu uploadu
- Pasek postępu uploadu (po stronie przeglądarki, natywny z Resumable Upload API)
- Formaty: MP4, MOV i inne obsługiwane przez YouTube
- Limit: max 3 filmy dziennie per instancja (hard cap w UI + walidacja backendowa)
- Limit rozmiaru: max 2 GB na plik
- Metadane: tytuł (wymagany) + opis (opcjonalny)
- Odtwarzanie: YouTube iframe embed, responsywny, mobile-first
- Feed: miniaturka + tytuł + autor + data, infinite scroll lub paginacja
- Integracja z postami: możliwość załączenia jednego lub więcej filmów z `/video` do posta w głównym feedzie
- Usuwanie: autor lub admin — kasuje rekord z Neon + usuwa film z YouTube przez API
- Widoczność YouTube: wszystkie filmy unlisted (nie są indeksowane publicznie)
- Autoryzacja instancji: jednorazowa autoryzacja OAuth2 przez admina, refresh token przechowywany w backendzie
- Pasek postępu także przy uploadzie zdjęć w postach (poza scope video, ale przy okazji)

### Out of scope

- Komentarze pod filmami
- Reakcje pod filmami
- Push notyfikacje przy wgraniu nowego filmu
- Edycja / przycinanie filmów w aplikacji
- Wiele kont YouTube per instancja
- Automatyczne wygasanie filmów
- Pobieranie filmów jako plik

## System Components

```
[Przeglądarka]
    │
    ├─► GET /api/video/upload-token  →  [Worker/Hono]
    │       Worker sprawdza dzienny limit
    │       Worker pobiera OAuth access token (z refresh tokena w Neon)
    │       Zwraca: upload URL z YouTube Resumable Upload API
    │
    ├─► PUT <upload_url> (YouTube Resumable Upload API)
    │       Przeglądarka uploaduje plik bezpośrednio do Google
    │       Pasek postępu z XHR/fetch progress events
    │       Google zwraca: youtube_video_id
    │
    └─► POST /api/video/confirm  →  [Worker/Hono]
            Przeglądarka wysyła: youtube_video_id + tytuł + opis
            Worker zapisuje rekord w Neon: id, youtube_video_id, title, description, author_id, created_at
            Worker pobiera thumbnail URL z YouTube API
            Zwraca: pełny obiekt video do wyświetlenia w feedzie

[Neon PostgreSQL]
    Tabela: videos
    ┌─────────────────┬──────────────┐
    │ id              │ uuid PK      │
    │ youtube_video_id│ text unique  │
    │ title           │ text         │
    │ description     │ text null    │
    │ author_id       │ uuid FK      │
    │ thumbnail_url   │ text         │
    │ created_at      │ timestamptz  │
    └─────────────────┴──────────────┘

    Tabela: post_videos (relacja N:M posty ↔ filmy)
    ┌──────────────┬──────────┐
    │ post_id      │ uuid FK  │
    │ video_id     │ uuid FK  │
    └──────────────┴──────────┘

[YouTube]
    Kanał admina (dedykowany "Wspólniak Video")
    Wszystkie filmy: unlisted
    Autoryzacja: OAuth2, refresh token per instancja
```

## Implementation Decisions

| Decyzja | Wybór | Uzasadnienie |
|---------|-------|--------------|
| Upload path | Przeglądarka → YouTube bezpośrednio | Workers ma limit 100 MB na request; Resumable Upload API omija backend dla dużych plików |
| Przechowywanie filmów | YouTube (unlisted) | Bezpłatne, sprawdzone CDN, brak kosztów storage po stronie Wspólniaka |
| Limit dzienny | 3 filmy per instancja | YouTube Data API quota: 10 000 jednostek/dzień, upload = 1 600 jednostek; 3 filmy = 4 800 jednostek (bezpieczny zapas) |
| Limit rozmiaru | 2 GB | YouTube akceptuje do 256 GB, upload idzie bezpośrednio do Google z pominięciem Workers |
| Retencja | Trwała | Filmy traktowane jak albumy — bez automatycznego usuwania |
| Odtwarzanie | YouTube iframe embed | Zero kosztów CDN, natywne mobile, brak własnego playera do utrzymania |
| Metadane | Tytuł + opis | Wystarczy dla rodzinnego use-case; bez komentarzy i reakcji |
| Powiadomienia push | Brak dla nowych filmów | Decyzja produktowa — nie każdy upload wymaga alertu |

## Validation Strategy

Brak formalnego user testingu — właściciel projektu weryfikuje samodzielnie na produkcji:
1. Upload z telefonu (iOS + Android) kończy się sukcesem i film pojawia się w feedzie
2. Film jest widoczny jako unlisted na YouTube (nie pojawia się w wynikach wyszukiwania)
3. Limit 3 filmów dziennie jest egzekwowany (4. próba blokowana)
4. Usunięcie przez autora kasuje film z obu miejsc
5. Film dołączony do posta wyświetla się poprawnie w głównym feedzie

## Open Questions

- [ ] Czy YouTube channel ID powinien być konfigurowalny przez admina w panelu, czy hardcoded w `.env`?
- [ ] Co pokazać userowi gdy dzienny limit (3 filmy) zostanie wyczerpany — kiedy reset? (midnight UTC, midnight lokalne, rolling 24h?)
- [ ] Kolejność filmów w feedzie posta — po dacie wgrania czy po kolejności dodania do posta?

## References

- Discovery summary: inline powyżej (sesja `/ask`)
- Repo: https://github.com/CrystalGamesStudio/wspolniak
- YouTube Resumable Upload API: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- YouTube Data API quota: https://developers.google.com/youtube/v3/getting-started#quota
