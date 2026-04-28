# [1.14.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.13.0...v1.14.0) (2026-04-28)


### Features

* **share:** add per-member QR codes with deep-link auto-prefill ([09910f4](https://github.com/CrystalGamesStudio/wspolniak/commit/09910f4ab7b8e6accb205ec6d495d1d1255a2f5e))

# [1.13.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.12...v1.13.0) (2026-04-27)


### Features

* **app:** add mobile navbar, feedback system, and UX improvements ([5644563](https://github.com/CrystalGamesStudio/wspolniak/commit/5644563207e89d88a54eee252c0537b0e11ee680)), closes [#comments](https://github.com/CrystalGamesStudio/wspolniak/issues/comments)
* **share:** add share page with QR code login flow and admin management ([7d88353](https://github.com/CrystalGamesStudio/wspolniak/commit/7d883533263181fd56c239108cefdf214fa41eaf))
* **ui:** enhance mobile UX and add post navigation ([c24b071](https://github.com/CrystalGamesStudio/wspolniak/commit/c24b071c5cdb3cbdfe7e110cba45eea4fec085e3))
* **ui:** move mobile nav to layout, add share/add dialogs in admin ([a2c55f6](https://github.com/CrystalGamesStudio/wspolniak/commit/a2c55f6c6eec889f7c818e6aff0ce5f2ac3e80a4))

## [1.12.12](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.11...v1.12.12) (2026-04-25)


### Bug Fixes

* **pwa:** add dismiss button to push prompt banner ([#26](https://github.com/CrystalGamesStudio/wspolniak/issues/26)) ([fd0b497](https://github.com/CrystalGamesStudio/wspolniak/commit/fd0b497ebaba4c5aa8100f1ab9c0ba229a74781d)), closes [#19](https://github.com/CrystalGamesStudio/wspolniak/issues/19)

## [1.12.11](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.10...v1.12.11) (2026-04-25)


### Bug Fixes

* **pwa:** add dismiss to install banner, prevent bottom blocking ([#19](https://github.com/CrystalGamesStudio/wspolniak/issues/19)) ([594d849](https://github.com/CrystalGamesStudio/wspolniak/commit/594d8499cd99bfc3bcedfb87c384ccfb22e3a883))

## [1.12.10](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.9...v1.12.10) (2026-04-25)


### Bug Fixes

* **pwa:** regenerate icons with opaque background, add iOS meta tags ([#18](https://github.com/CrystalGamesStudio/wspolniak/issues/18)) ([853531b](https://github.com/CrystalGamesStudio/wspolniak/commit/853531b2ba7d3f30540f38bfbfd7bc984e5c537b))

## [1.12.9](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.8...v1.12.9) (2026-04-25)


### Bug Fixes

* **push:** one subscription per user, drop stale endpoints on save ([#25](https://github.com/CrystalGamesStudio/wspolniak/issues/25)) ([ee92a79](https://github.com/CrystalGamesStudio/wspolniak/commit/ee92a7964fc9141084e5ac96cd77747953f5270d))

## [1.12.8](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.7...v1.12.8) (2026-04-25)


### Bug Fixes

* **push:** correct deep-link URL from /app/posts/ to /app/post/ ([#24](https://github.com/CrystalGamesStudio/wspolniak/issues/24)) ([8a1ce08](https://github.com/CrystalGamesStudio/wspolniak/commit/8a1ce082069d20bc8cdf86ba1b7c7497ac7012d7))

## [1.12.7](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.6...v1.12.7) (2026-04-25)


### Bug Fixes

* **push:** stop double-prefixing VAPID subject with mailto: ([#23](https://github.com/CrystalGamesStudio/wspolniak/issues/23)) ([dcbef23](https://github.com/CrystalGamesStudio/wspolniak/commit/dcbef23c6522c7840db46b3992b86b934c1a1e31))

## [1.12.6](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.5...v1.12.6) (2026-04-25)


### Bug Fixes

* **push:** accept raw 32-byte VAPID private key alongside PKCS8 ([#22](https://github.com/CrystalGamesStudio/wspolniak/issues/22)) ([07f9e57](https://github.com/CrystalGamesStudio/wspolniak/commit/07f9e57f1f9ffbcf819a7ed800af1a3028067a2a))

## [1.12.5](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.4...v1.12.5) (2026-04-25)


### Bug Fixes

* **push:** correct icon path + log delivery failures ([#21](https://github.com/CrystalGamesStudio/wspolniak/issues/21)) ([8158542](https://github.com/CrystalGamesStudio/wspolniak/commit/8158542bcd60beb42c13f0bf15f75bb6c59ac370)), closes [#20](https://github.com/CrystalGamesStudio/wspolniak/issues/20)

## [1.12.4](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.3...v1.12.4) (2026-04-25)


### Bug Fixes

* register service worker manually so push notifications actually fire ([#21](https://github.com/CrystalGamesStudio/wspolniak/issues/21)) ([5cebde0](https://github.com/CrystalGamesStudio/wspolniak/commit/5cebde0f43b897158c6d95e465ca711c0ec9c5a4)), closes [vite-pwa/vite-plugin-pwa#902](https://github.com/vite-pwa/vite-plugin-pwa/issues/902)

## [1.12.3](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.2...v1.12.3) (2026-04-23)


### Bug Fixes

* add error handling to push subscribe flow ([#20](https://github.com/CrystalGamesStudio/wspolniak/issues/20)) ([88dfef6](https://github.com/CrystalGamesStudio/wspolniak/commit/88dfef65894d37d95b5a4f47c34bf2bd2ddd00f3))

## [1.12.2](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.1...v1.12.2) (2026-04-23)


### Bug Fixes

* route ordering blocks vapid-key endpoint, fix push icon path ([#20](https://github.com/CrystalGamesStudio/wspolniak/issues/20)) ([e8260f3](https://github.com/CrystalGamesStudio/wspolniak/commit/e8260f3b5402b214a6ba0be2507f3e26f935f7a3))

## [1.12.1](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.12.0...v1.12.1) (2026-04-23)


### Bug Fixes

* correct production deploy flow and sync-secrets script ([04112d9](https://github.com/CrystalGamesStudio/wspolniak/commit/04112d9c7f608664b005df3a2ce026e71cac7c24))

# [1.12.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.11.1...v1.12.0) (2026-04-23)


### Features

* add CLI script to regenerate admin magic link ([8099d25](https://github.com/CrystalGamesStudio/wspolniak/commit/8099d257b7c25086e84867c96d0023aa218bd231))

## [1.11.1](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.11.0...v1.11.1) (2026-04-23)


### Bug Fixes

* use pg driver for drizzle-kit migrations and add production migration ([3b28d13](https://github.com/CrystalGamesStudio/wspolniak/commit/3b28d13706e98b141f753458269876f38d98303b))

# [1.11.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.10.0...v1.11.0) (2026-04-23)


### Features

* configure production deployment for wspolniak.com ([b4b76e7](https://github.com/CrystalGamesStudio/wspolniak/commit/b4b76e72e07cf5c8150ed7703b0006536e995038))

# [1.10.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.9.0...v1.10.0) (2026-04-23)


### Bug Fixes

* validate session against database and fix secure cookie on localhost ([0f4df52](https://github.com/CrystalGamesStudio/wspolniak/commit/0f4df5205310732539eab0e8e660363a50fef218))


### Features

* add ThemeToggle to app pages, clean up knip config, polish UI labels ([dc91c29](https://github.com/CrystalGamesStudio/wspolniak/commit/dc91c29acd0744b3a2f53dadf17cebaf699dfadc))

# [1.9.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.8.0...v1.9.0) (2026-04-14)


### Features

* add comments with authorization and feed count ([#7](https://github.com/CrystalGamesStudio/wspolniak/issues/7)) ([b93db7c](https://github.com/CrystalGamesStudio/wspolniak/commit/b93db7cdc5b0680a065d866c0d5f194795f75bac))
* add push notifications and admin member management ([#9](https://github.com/CrystalGamesStudio/wspolniak/issues/9)) ([1bd1119](https://github.com/CrystalGamesStudio/wspolniak/commit/1bd1119d0e85bb232063cac22d6aceb4c662b842))
* add SPDX headers, fix license to AGPL-3.0, add apple-touch icon ([#10](https://github.com/CrystalGamesStudio/wspolniak/issues/10)) ([4bf1069](https://github.com/CrystalGamesStudio/wspolniak/commit/4bf1069d3d8d2da3f603006a8939b52ce0595037))
* PWA shell with offline support and install prompts ([#8](https://github.com/CrystalGamesStudio/wspolniak/issues/8)) ([9fbba7f](https://github.com/CrystalGamesStudio/wspolniak/commit/9fbba7f431726229aa4f2fe4c3984697dfc3eaed))

# [1.8.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.7.0...v1.8.0) (2026-04-14)


### Features

* edit & delete posts with authorization ([#6](https://github.com/CrystalGamesStudio/wspolniak/issues/6)) ([192df36](https://github.com/CrystalGamesStudio/wspolniak/commit/192df360d1b3ca165c097492d295f0472d886508))

# [1.7.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.6.1...v1.7.0) (2026-04-14)


### Features

* cursor-based feed pagination with infinite scroll ([#5](https://github.com/CrystalGamesStudio/wspolniak/issues/5)) ([c3f1997](https://github.com/CrystalGamesStudio/wspolniak/commit/c3f199756a3579974b2628d4bf2adf5f59be1ded))

## [1.6.1](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.6.0...v1.6.1) (2026-04-12)


### Bug Fixes

* remove deprecated baseUrl from tsconfig ([6bb2aeb](https://github.com/CrystalGamesStudio/wspolniak/commit/6bb2aebe8696a1c39b42eb63a5b67863aa6ebefb))

# [1.6.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.5.0...v1.6.0) (2026-04-12)


### Features

* posts with image upload — create, feed, single post view ([#4](https://github.com/CrystalGamesStudio/wspolniak/issues/4)) ([da2c312](https://github.com/CrystalGamesStudio/wspolniak/commit/da2c3124084cffd6f1b05fd1d29af87e18514670))

# [1.5.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.4.1...v1.5.0) (2026-04-12)


### Features

* member management API — create, list, regenerate, soft-delete ([#3](https://github.com/CrystalGamesStudio/wspolniak/issues/3)) ([34f77b9](https://github.com/CrystalGamesStudio/wspolniak/commit/34f77b91b2d11c15467e71ff2107e211de46acbb))

## [1.4.1](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.4.0...v1.4.1) (2026-04-12)


### Bug Fixes

* redirect authenticated users from / to /app server-side ([4a21cf1](https://github.com/CrystalGamesStudio/wspolniak/commit/4a21cf1e6148e9289954a1cfcce32fa025d3c9ba))

# [1.4.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.3.0...v1.4.0) (2026-04-11)


### Features

* UI routes — landing, setup, auth error, app shell ([#15](https://github.com/CrystalGamesStudio/wspolniak/issues/15)) ([65c852e](https://github.com/CrystalGamesStudio/wspolniak/commit/65c852e24f5e80152c61bbb5cc50030ea036d5d0))

# [1.3.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.2.0...v1.3.0) (2026-04-11)


### Features

* session middleware + route protection ([#14](https://github.com/CrystalGamesStudio/wspolniak/issues/14)) ([bd0d6d7](https://github.com/CrystalGamesStudio/wspolniak/commit/bd0d6d7a99af867c11a8389b2fdd67476243d348))

# [1.2.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.1.0...v1.2.0) (2026-04-11)


### Features

* GET /app/u/:token magic link verification + session cookie ([#13](https://github.com/CrystalGamesStudio/wspolniak/issues/13)) ([21051e9](https://github.com/CrystalGamesStudio/wspolniak/commit/21051e98ed6965818fca0c59cebe0311ce775aee))

# [1.1.0](https://github.com/CrystalGamesStudio/wspolniak/compare/v1.0.0...v1.1.0) (2026-04-11)


### Features

* POST /api/setup endpoint for instance bootstrap ([#12](https://github.com/CrystalGamesStudio/wspolniak/issues/12)) ([43a5425](https://github.com/CrystalGamesStudio/wspolniak/commit/43a5425c8ef67bff2cf4dcd2188b0ef3418d9a4b))

# 1.0.0 (2026-04-11)


### Features

* add users and instance_config schema, remove scaffolding client domain ([#11](https://github.com/CrystalGamesStudio/wspolniak/issues/11)) ([311393d](https://github.com/CrystalGamesStudio/wspolniak/commit/311393d6ab34780d4aed12402b0cc2b1c6410918))

# [1.1.0](https://github.com/auditmos/tstack-on-cf/compare/v1.0.0...v1.1.0) (2026-04-09)


### Features

* add claude rules, agents, error infra, remove demo endpoint ([136b6a9](https://github.com/auditmos/tstack-on-cf/commit/136b6a90dda0c5ef70aa585161756803af0d70da))
* add clients CRUD UI, hooks, initial migration ([cc0e826](https://github.com/auditmos/tstack-on-cf/commit/cc0e8269163c5ef7ea82ed97cff4035b4444f7d7))
* add Neon PostgreSQL + Drizzle ORM database layer ([6de059a](https://github.com/auditmos/tstack-on-cf/commit/6de059a5483ade15f356ef6155e6967a5a20e376))

# 1.0.0 (2026-03-16)


### Bug Fixes

* specify packageManager for pnpm action-setup ([03ce86c](https://github.com/auditmos/tstack-on-cf/commit/03ce86ce7c313943d5bda304d036b8252d7ce08f))
