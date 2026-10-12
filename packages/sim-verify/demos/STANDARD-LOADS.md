# Standard loads for the wash simulation

Brought up to date on 12 October 2026 (the upper basket corrected from the owner's photograph,
the course of seven levels, 25 saved loads).

Settled loads of the owner's machine (Bosch SMV4HAX40G; washed on Eco 50, the programme the
game is scored on) that were put together by
real loading physics, not drawn on a lattice. Each was played through the session layer by a
scripted policy (`@spotless/loader`), the baskets were pushed in and the door closed on the
load by `start_cycle`, and what is saved is exactly what the session hands the wash: every item
with its settled pose in the tub frame and its soils.

Use them to exercise the simulation on loads whose contacts, leans and shadows are physical.

## Where they are

`packages/loader/loads/<name>.json`, with a picture beside each (`<name>.png`: lower basket
from above, upper basket from above, front, side) and a table of all of them in `SUMMARY.json`.

| Load | What it is |
|---|---|
| `iec-13-careful` | The IEC 60436 load of 13 place settings with serving pieces and IEC soils (standards.md sections 5.1 and 13.3), loaded well. What fits of it: see below |
| `iec-13-careless` | The same items loaded with the common mistakes |
| `half-careful` | Six place settings of that load, well spaced |
| `owner-2026-10-10` | The owner's own load of his first test wash, placed by a fixed list of moves |
| `<level>-careful`, `<level>-careless`, `<level>-random` | Each of the seven levels of the course of `@spotless/levels` (`tutorial`, `lunch-for-four`, `weeknight-dinner`, `breakfast`, `mixed-family`, `baking-day`, `dinner-party`) by each policy |

The four loads that are not levels still name Auto 45-65 as their level's programme in the file
(the machine data's `primaryProgramme`); the wash commands wash them on Eco 50 unless told
otherwise.

The careful loads follow the manufacturer's scheme: plates on edge in the tine rows, let down
where `list_slots` suggests, the eating face to the centre; boards and platters at the side
walls; a pot mouth down over a side row pair where it is worth more than the plates that would
stand there; cutlery mixed in the cutlery basket; small plates in the short rows of the upper
basket (its knife shelf folded up for them when they are worth more than the utensils the shelf
would carry); cups, mugs and glasses mouth down, leaning on the two sloped rests along the side
walls of the upper basket; bowls mouth down on its floor. Nothing in a careful load rests against another item (cutlery in its
basket excepted), nothing rests on a part that is not a basket, and both baskets have been
pulled out and pushed in again with the load in them. They pass `check_load`. Plates deeper
than about 28 mm (soup plates, 27 cm dinner plates) come to rest between the tines of this
machine leaning against the row, the face to the centre and tilted down; a load's `notes` name
them.

The careless loads are the careful load of the same level and seed, made in the same session,
and then the mistakes of the phenomena checklist (standards.md section 9) made on a seeded
choice of its items and with what the careful loader left on the counter: `plate_facing_away`,
`plates_two_to_a_slot`, `bowls_nested`, `bowl_face_down_flat`, `cup_upright`, `cup_on_side`,
`tablet_tray_blocked`, `item_over_others`, `spoons_nested`, `cutlery_bunched`,
`tall_item_under_arm`, `packed_tight`. On the present baskets the scripted hand gets no two
plates into one slot and no bowl to lie in another, and the saved careless standard load no
longer blocks the tablet tray (`docs/benchmark/levels.md` section 5). A careless load so holds the items of the careful one, and more. Which mistakes
are in a load, on which item (and `with` which other item), is listed under `mistakes`; every
entry is what the settled pose shows, not what was intended (`mistakeHolds` of
`@spotless/loader` reads an entry against the scene, and `check-loads` does so for every saved
load). Not every kind occurs in every load: a mistake that the physics did not leave is not
recorded. The random loads are the floor: poses drawn at random and kept when the session
accepts them and they hold; `check` says what that blocks.

No machine as modelled takes a whole level, and the IEC load does not fit completely either:
`left_out` in each file says what stayed on the counter and why.

## What a file holds

| Key | Content |
|---|---|
| `level` | The level played (items with soils and points, programme, seed) |
| `policy`, `offered`, `placed`, `left_out`, `mistakes` | Who loaded it and what became of each item |
| `wash_manifest` | What `start_cycle` hands the wash runner (`WashManifest` of `@spotless/session`, without its copy of the level): `machine_id`, `machine_config`, `programme_id`, `seed`, and `items[]` with `item_id`, `item_type` (catalogue id), `pose` (`p` in metres, `q` as `[x, y, z, w]`, item frame to tub frame, exact), `soils` (as in the level: `type`, `regions`, `amountG`, `ageH`, `heatHistory`) and `points` |
| `load_manifest` | The same load as players see it (poses rounded, reference point instead of item origin) |
| `check` | The mechanical check of the final load: which arm is stopped by what and at which angle, whether the dispenser lid opens and the tablet's path is clear |
| `numbers` | Deepest overlap between any two bodies (of the convex collision pieces the loading physics works with; the true surfaces overlap a few tenths of a millimetre more, by the chord error of those pieces), items outside their basket, items the stability probe flags |
| `notes` | What the loader did to the machine (shelves folded) and what is unusual about the load |
| `action_log`, `final_state_hash` | The session's event stream and the hash it leads to; `replay-load` reproduces the load from them |

## Turning one into the simulation's input

As a JSON description for `spotless-wash` (`WashDescription` of `@spotless/sim-core`):

```
pnpm --filter @spotless/loader exec tsx scripts/export-wash.ts loads/iec-13-careful.json --tier fast > /tmp/iec-13-careful.wash.json
pnpm --filter @spotless/sim-core run spotless-wash /tmp/iec-13-careful.wash.json --out /tmp/iec-13-careful.result.json
```

In code, `WashInput` of `@spotless/sim-core` from a file:

```ts
import { readFileSync } from 'node:fs';
import { findMachine, findProgramme } from '@spotless/machine';
import type { StandardLoad } from '@spotless/loader';

const load = JSON.parse(readFileSync('packages/loader/loads/iec-13-careful.json', 'utf8')) as StandardLoad;
const m = load.wash_manifest;
const machine = findMachine(m.machine_id)!;
const input = {
  machine,
  config: m.machine_config,
  programme: findProgramme(machine, m.programme_id)!,
  items: m.items.map((item) => ({
    itemId: item.item_id,
    typeId: item.item_type,
    pose: item.pose, // SI, tub frame, exactly as the loading physics left it
    soils: item.soils.map((s) => ({
      type: s.type, regions: s.regions, amount_g: s.amountG, age_h: s.ageH, heat_history: s.heatHistory,
    })),
  })),
  tier: 'fast' as const,
  levelSeed: m.seed,
  simSeed: 1,
  dispenserBlocked: !load.check.dispenser_opens || !load.check.tablet_path_clear,
  // stalledArms: for every arm of load.check.spray_arms with full_rotation false, the spray
  // level id (the arm id without `_arm`) and first_contact_angle_deg in radians.
};
```

`washDescriptionOf(load)` of `@spotless/loader` does the first of these in code, and
`washManifestOf(load)` gives the session's own `WashManifest` (level put back, the mechanical
findings of `start_cycle` as `prechecks`), which is what a `WashRunner` takes.

Things to know:

- Poses are those of the item frame's origin (z = 0 is the plane the item rests on when
  upright), not of the bounding-box centre that the session's wire poses use. `export-wash`
  writes the origin, which is what `WashDescription.position_mm` wants.
- The baskets are pushed in and the door is shut: the poses are final. The upper basket is at
  its highest position and every tine row stands. The shelves do not all stand as in the
  machine's default configuration: most loads have the cup shelves folded down with cups and
  mugs standing on them, and many have the knife shelf folded up. `wash_manifest.machine_config`
  (and so `washManifestOf(load)`) says how each shelf stands. A `WashDescription` carries the
  basket heights only: `export-wash` prints the shelves that were moved to standard error, and
  a wash built from the description alone has them in their default place, with the items of
  the shelf standing in the air above it.
- A careless load can stop an arm or block the tablet; `check` says so, and the description's
  `dispenserBlocked` is set from it. `stalledArms` is not part of the JSON description:
  `export-wash` prints it to standard error for the caller to pass to `wash()`.
- Items left on the counter are in `wash_manifest.unloaded`; they are simply not washed.
- Contacts are real: plates stand in slots between tines and touch them, cutlery leans on the
  walls of its cell and on its neighbours, and overlaps of up to the loading physics'
  tolerance (0.5 mm) occur. `numbers.deepest_overlap_mm` is the worst of each load.

## Reproducing and checking

```
pnpm --filter @spotless/loader generate-loads --jobs 8        # all loads, each in its own process (20 to 40 minutes)
pnpm --filter @spotless/loader generate-loads iec-13-careful  # one
pnpm --filter @spotless/loader check-loads                    # numbers again; in a fresh process per load: replay of the log, both baskets out and in, every recorded mistake against the settled poses
pnpm --filter @spotless/loader exec tsx scripts/replay-load.ts loads/iec-13-careful.json
pnpm --filter @spotless/loader render-loads                   # the pictures again from the saved manifests
```

A policy with a given seed produces the same action log on every run, and the log replays to
the same state hash after every action, so a load can always be regenerated instead of trusted.
If the session layer, the loading physics, the machine geometry or an item's shape changes, the
saved logs stop replaying (the hashes cover the exact bits of every pose): regenerate. A
regeneration is not a small step: the policies react to what the physics does, so a changed
tine or a changed tolerance gives a different load, not the same load with other hashes.
