# Third-party notices

DishwasherBench (the game Spotless and its benchmark) is copyright Composo Limited and released
under the MIT licence (see [LICENSE](LICENSE)). This file lists the material in the repository
that comes from others, and the main software the project depends on. Dependencies are not
copied into this repository; the package manager installs them, each under its own licence.

## Music

The five music files under `apps/web/public/audio/` are by **Yoiyami**, published on
OpenGameArt.org and dedicated to the public domain under **CC0 1.0 Universal**
(<https://creativecommons.org/publicdomain/zero/1.0/>). CC0 asks for no attribution; the author
is credited here and in the game, with thanks. Each file was re-encoded to MP3 with one fixed
gain and is otherwise unchanged. The licence is as stated on each track's page; the project has
no other knowledge of how the tracks were made. Hashes and download addresses are in
[apps/web/public/audio/LICENSES.md](apps/web/public/audio/LICENSES.md).

| File                           | Title                                                                                      | Source                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `first-light-particles.mp3`    | First Light Particles – CC0 Atmospheric Piano/Ambient Track                                | <https://opengameart.org/content/first-light-particles-%E2%80%93-cc0-atmospheric-pianoambient-track>                                    |
| `deep-blue.mp3`                | Yoiyami Core Theme – Deep Blue Ambient Piano                                               | <https://opengameart.org/content/yoiyami-core-theme-%E2%80%93-deep-blue-ambient-piano>                                                  |
| `budding-of-consciousness.mp3` | The Budding of Consciousness – CC0 Ambient / Minimalist Theme (Yoiyami Blue Series – No.4) | <https://opengameart.org/content/the-budding-of-consciousness-%E2%80%93-cc0-ambient-minimalist-theme-yoiyami-blue-series-%E2%80%93-no4> |
| `starfield-romance.mp3`        | Starfield Romance – CC0 Ambient / Emotional Space Theme (Yoiyami Blue Series – No.3)       | <https://opengameart.org/content/starfield-romance-%E2%80%93-cc0-ambient-emotional-space-theme-yoiyami-blue-series-%E2%80%93-no3>       |
| `sunset-plains.mp3`            | Sunset Plains                                                                              | <https://opengameart.org/content/sunset-plains>                                                                                         |

All other sounds in the game are synthesised by the game's own code.

## Data and text from published sources

- **Loading guidance.** The loading advice shown to every player and sent to every model
  (`packages/server/src/guidance.ts`) is the project's summary of the loading section of the
  manufacturer's user manual for the simulated machine. It is a summary in the project's words
  that keeps a few of the manual's short phrases; it is not the manufacturer's instructions. The
  manual is copyright BSH Hausgeräte GmbH.
- **Spray-arm nozzle layout of the generic baseline.** The radial positions and angles of ten
  nozzles in `packages/machine/src/data/spot60.ts` are the published measurements of a Whirlpool
  DU750 lower spray arm from R. Pérez-Mohedano, EngD thesis, University of Birmingham, 2016
  (Table 5.7). They are used as cited facts.
- **Reference detergent and scoring scales.** The composition of IEC reference detergent type D
  and the cleaning and drying score bands of IEC 60436 appear in the simulation's defaults and
  in `docs/research/` as cited facts, taken from IEC 60436:2015/COR1:2020 and from public
  summaries by the US Department of Energy and NIST. The standards themselves are published by
  the IEC and are not reproduced here.
- **The detergent.** The parameters in `packages/calibration/detergents/` are the project's own
  estimates, derived from the maker's public ingredient disclosure and safety data sheets
  (`docs/research/detergent-finish-ultimate.md`).
- **Research documents.** The reviews under `docs/research/` summarise manuals, service
  documents, patents, papers, theses and test reports, and quote short passages from them. Each
  quotation is attributed where it appears and remains the copyright of its author or publisher.
  The notes on the simulated machine cite the manufacturer's documents by public address and
  page. A few measured values are quoted from published test tables (KONSUMENT/VKI, and
  summaries of Stiftung Warentest tests) as cited facts; the tables remain their publishers'.
- **Episode transcripts.** The transcripts under `docs/benchmark/first-runs/` contain text
  generated by the models named in them. It is published as a record of the runs.
- **Algorithms.** The random-number hash in `packages/core/src/rng.ts` follows the PCG
  construction described by M. Jarzynski and M. Olano, "Hash Functions for GPU Rendering",
  JCGT 9(3), 2020, after M. E. O'Neill's PCG. Test inputs and the music sequencer of the page
  use the public-domain `mulberry32` generator by Tommy Ettinger.

## Photographs

The photographs under `docs/reference/` were taken by the owner of the simulated machine and
are published with the owner's permission under the repository's MIT licence. They were
prepared for publication as
[docs/reference/REDACTIONS.md](docs/reference/REDACTIONS.md) describes. Some show the owner's
tableware, whose decoration is the design of its maker, and the machine, whose maker's marks
are visible; these appear only as the objects measured.

## Software dependencies

Installed from the npm registry; not redistributed in this repository. The full list with
licences can be produced with `pnpm licenses list`.

| Package                                            | Use                                                                       | Licence                                                                                   | Project                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `webgpu` (Dawn)                                    | GPU compute in Node                                                       | BSD-3-Clause (Dawn; Copyright The Dawn & Tint Authors); the bindings package declares MIT | <https://github.com/dawn-gpu/node-webgpu>, <https://dawn.googlesource.com/dawn> |
| `jolt-physics`                                     | Rigid-body physics                                                        | MIT (Copyright Jorrit Rouwe)                                                              | <https://github.com/jrouwe/JoltPhysics.js>                                      |
| `three`                                            | Rendering                                                                 | MIT                                                                                       | <https://threejs.org/>                                                          |
| `fastify`, `@fastify/static`, `@fastify/websocket` | Game server                                                               | MIT                                                                                       | <https://fastify.dev/>                                                          |
| `puppeteer-core`                                   | Pictures drawn in a headless browser, and the scripts that drive the page | Apache-2.0                                                                                | <https://github.com/puppeteer/puppeteer>                                        |
| `pngjs`                                            | PNG encoding                                                              | MIT                                                                                       | <https://github.com/pngjs/pngjs>                                                |
| `zod`                                              | Schema validation                                                         | MIT                                                                                       | <https://zod.dev>                                                               |
| `@modelcontextprotocol/sdk`                        | MCP server and client                                                     | MIT                                                                                       | <https://modelcontextprotocol.io>                                               |
| `@anthropic-ai/sdk`                                | Model client                                                              | MIT                                                                                       | <https://github.com/anthropics/anthropic-sdk-typescript>                        |
| `vite`                                             | Build and development server of the page                                  | MIT                                                                                       | <https://vite.dev>                                                              |
| `lightningcss` (through `vite`)                    | CSS processing at build time                                              | MPL-2.0                                                                                   | <https://github.com/parcel-bundler/lightningcss>                                |
| `fast-sha256` (through `@anthropic-ai/sdk`)        | Hashing                                                                   | Unlicense                                                                                 | <https://github.com/dchest/fast-sha256-js>                                      |
| `typescript`, `vitest`, `tsx`, `prettier`          | Development                                                               | Apache-2.0 (TypeScript), MIT (the others)                                                 |                                                                                 |

The exploratory code under `spikes/` also used `@dimforge/rapier3d-compat` and its variants
(Apache-2.0), `@mujoco/mujoco` (Apache-2.0) and `physx-js-webidl` (MIT) for comparison, and an
earlier version of `webgpu`; none of the first three is used by the game.

All remaining dependencies are under MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD or
BlueOak-1.0.0, as their own package metadata declares.

## Names

Bosch, Finish, Whirlpool and other product and company names are trademarks of their owners and
are used only to identify the things measured and simulated. DishwasherBench is not affiliated
with, sponsored by or endorsed by any of them. See the disclaimer in the
[README](README.md#licence-notices-and-disclaimer).
