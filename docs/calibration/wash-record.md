# The wash record

One JSON document per real wash. It says what was washed and how, and what was seen afterwards or
during the run, in enough detail for the simulator to be run on it and scored against it. This is
the specification of version 1 of the format; the code is `packages/calibration/src/record.ts`
(types and validation), with `setup.ts` (machine and programme) and `load.ts` (the load) beside it.

```
pnpm --filter @spotless/calibration spotless-fit validate my-wash.json   # every problem, with the path of the field
pnpm --filter @spotless/calibration spotless-fit predict my-wash.json    # what the simulator says for each observation
```

## 1. Conventions

- Plain JSON. Field names are `snake_case`. A value that is not in SI carries its unit in its name:
  `position_mm`, `amount_g`, `t_s`, `temperature_c`, `dose_ml`, `value_rpm`. Values under
  `machine.measured[].value` with `quantity: "spec"` are SI, because they replace a field of the
  machine specification, which is SI.
- Times are seconds from the start of the programme (the moment Start is pressed).
- Frames: the tub frame of `docs/design/platform.md` section 2 (origin on the lower spray-arm axis
  at tub-floor level, +x to the right facing the open machine, +y to the back, +z up), or a basket
  frame (`lower_rack`, `upper_rack`: origin at the front-left corner of the basket at the top of its
  base grid, axes parallel to the tub's). A pose is the position of the **origin of the item frame**
  and a quaternion `(w, x, y, z)` that turns item-frame vectors into the placement frame.
- Every observation says how it was obtained (`method`, a key of `provenance.methods`) and carries
  an uncertainty (`sd`, one standard deviation in the unit of the value), its own or the default of
  its method.
- A field this specification does not name is ignored by the code and kept by tools that rewrite a
  record, so notes of your own can be added anywhere.

## 2. Top level

| Field | Type | Required | Meaning |
|---|---|---|---|
| `format` | `"spotless.wash-record"` | yes | Identifies the document |
| `version` | `1` | yes | Version of this specification |
| `id` | string | yes | Short id of the record: letters, digits, `.`, `_`, `-` (`2026-10-18-egg-tiles-a`) |
| `kind` | string | yes | `measured`, `literature`, `synthetic` or `planned` (section 3) |
| `title` | string | no | One line for lists and reports |
| `provenance` | object | yes | When, who, how (section 3) |
| `machine` | object | yes | The machine and its measured values (section 4) |
| `programme` | object | yes | The programme and the measured course of the run (section 5) |
| `consumables` | object | no | Detergent, rinse aid, softener, water (section 6) |
| `load` | object | yes | Every item with its pose and soils (section 7) |
| `observations` | list | yes | What was observed (section 8); empty if nothing was |
| `interruptions` | list | no | Door openings during the run: `{ t_s, open_s?, notes? }` |
| `weight` | number | no | Weight of the record in a fit, above 0 and at most 1 (section 3) |
| `sim` | object | no | How to simulate it: `tier` (`fast` default, or `official`), `level_seed`, `sim_seed`, `params` (parameter overrides that belong to this wash, by registry key), `scenarios` (the inputs that were not measured, section 7a) |

## 3. Kind and provenance

| `kind` | What it is | What validation asks for |
|---|---|---|
| `measured` | A wash run on the owner's machine | `provenance.date`, `provenance.by`; a method for every soil amount |
| `literature` | A published result for a standard test on this class of machine | `provenance.source` (the citation); an explicit `sd` on every observation |
| `synthetic` | Generated from the simulator (recovery studies, tests) | nothing more |
| `planned` | A wash not yet run: a load with an observation plan | observations may leave `value` out |

A literature record is a **weak observation**: it was not made on this machine, with this
detergent, or on this load. State a wide `sd` on each of its observations, and the record is
weighted down as a whole as well: its log likelihood is multiplied by `weight`, by default the
registered `obs.literatureWeight` (0.25, which is the same as doubling every stated uncertainty).
A measured record has weight 1 unless it says otherwise.

`provenance`:

| Field | Type | Meaning |
|---|---|---|
| `date` | string | ISO 8601 date of the wash (or of the publication) |
| `by` | string | Who ran the wash and took the observations |
| `source` | string | For a literature record: authors, title, table or figure, DOI or URL |
| `methods` | object | How numbers were obtained, by a short key: `{ "scale": { "description": "balance, 0.01 g, ...", "sd": 5 } }`. `sd` is the default standard uncertainty of an observation made this way, in the unit of the observation |
| `notes` | string | Anything else |

## 4. Machine

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Catalogue id of the machine: `bosch_smv4hax40g` |
| `basket_heights` | object | Height position of each adjustable basket: `{ "upper": "1" }` |
| `config` | object | The whole configuration as the game stores it (basket heights, folded tine rows, shelves, cutlery basket). Written by the conversion from the game's manifest; leave it out for the default configuration |
| `measured` | list | Measured values that replace the specification's |

Measured quantities are **data, not fitted parameters**: what can be measured on the machine is
entered here and the fit never moves it. Each entry has a `quantity`, a `method`, an optional
`note`, and:

| `quantity` | Fields | Effect |
|---|---|---|
| `nozzle_diameter` | `level` (`lower`, `upper`), `nozzle` (`l3`), `value_mm` | Sets the bore and the area of a round nozzle |
| `arm_speed` | `level`, `position` (water-switch position, `l` or `ur`), `pump_rpm`, `value_rpm` | Sets the viscous friction of the arm's bearing so that the arm model turns at the measured rate in that state. Refused, with the frictionless rate, when no friction gives the measured rate |
| `spec` | `path`, `value` (SI) | Replaces any numeric field of the machine specification: `thermal.inletTemperature`, `dosing.detergentReleaseDelay`, `hydraulics.fill.inletFlow`, `sprayLevels[lower].nozzles[l3].cd`. A list is indexed by the `id` of its element or by position |

The machine is validated again after the changes; a value that leaves the specification invalid is
refused.

## 5. Programme and the measured course

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Programme id of the machine: `auto_145` |
| `options` | list of strings | Options selected, in the words of the control panel |
| `course` | object | The measured course of the run. It **replaces the nominal timeline** |

Auto 45-65 adapts to the load: it chooses the main-wash temperature and the length of the hold
from its turbidity readings. Without a measured course the simulator runs the programme as written
(the 2 h 25 min normal branch) and the fit has to carry the difference as nuisance parameters
(`prog.mainWashTargetShift`, `prog.mainWashHoldScale`, `prog.finalRinseTargetShift`). With one, the
programme is adapted to it and those stay at zero.

`course`:

| Field | Type | Meaning |
|---|---|---|
| `duration_s` | number | Total running time |
| `power_log` | log | Mains power in watts: `{ "t_s": [...], "values": [...], "method": "plug" }` |
| `temperature_log` | log | Temperature in degrees Celsius, with `where` the probe was. Only a probe in the liquor (`where` contains `liquor`, `sump` or `water`) sets targets; any other is compared and reported |
| `events` | list | `{ "kind": "fill" \| "drain" \| "heater_on" \| "heater_off" \| "door_open" \| "door_closed", "t_s", "volume_l"? }`, read from the logs or noted by hand |
| `steps` | list | Direct statements about steps of the programme: `{ "step": "a4_heat", "duration_s"?, "target_c"?, "mains_volume_l"? }` |
| `notes` | string | |

How the nominal programme is adapted (`programmeOfRecord`), in this order:

1. `steps` are applied as stated.
2. Heater switching is taken from `events`, or read from `power_log`: the heater is on while the
   power is above half its rating; pauses under 30 s are bridged and bursts under 20 s dropped.
3. With a liquor temperature log, the target of every heat-up (and of the hold after it) becomes
   the logged temperature at the moment the heater went off.
4. The lengths of the circulation, hold and drying steps between measured fills, drains and
   heater switchings are corrected until the timeline has each at its measured time (to 1 s).
   Without a temperature log a heat-up is made to end when the heater went off by moving its
   target, so the thermal model turns heater-on time into temperature.
5. The last step is lengthened or shortened to `duration_s`.

Measured events are matched to the programme's in order of time, and only when their number
agrees (a pre-drain at time 0 that nobody notes is allowed for). The result reports every change
(`step`, field, from, to, source), where each anchor ends up, the root-mean-square difference
between the modelled liquor temperature and the log, and the modelled energy against the integral
of the power log. `spotless-fit validate` prints that comparison: **read it** before trusting
a record's course.

## 6. Consumables and water

| Field | Meaning | Effect on the simulation |
|---|---|---|
| `detergent.product`, `.form` (`tablet`, `powder`, `gel`, `pouch`, `none`), `.dose_g`, `.placement`, `.method` | What was dosed and where | `dose_g` replaces the machine's dose. The composition is not in the record: it is the `liq.x*` parameters, set per record in `sim.params` when a product's sheet gives them, fitted otherwise |
| `rinse_aid.product`, `.setting` (`r05`), `.dose_ml` | Rinse aid | `dose_ml` replaces the machine's dose (0 for an empty reservoir) |
| `softener.setting` (`H04`), `.salt_filled` | Softener | Recorded; the first build assumes softened water |
| `water.hardness_dh` | Total hardness of the supply | Recorded |
| `water.bicarbonate_mmol_l` | Carbonate hardness of the water entering the tub | Sets `liq.supplyBicarbonate` for this record |
| `water.inlet_temperature_c`, `.ambient_temperature_c`, `.method` | Cold supply and room | Replace the machine's inlet and ambient temperatures |

## 7. The load

`load.items` lists every item in the machine, soiled or not (a clean item still shadows others).
`load.dispenser_blocked` is true when the load kept the dispenser lid from opening, and
`load.stalled_arms_deg` maps a spray level to the angle an arm stood at when the load held it
still.

An item:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Instance id, unique in the load: lower-case letters, digits, `_` |
| `type` | string | Catalogue item type id (`dinner_plate_porcelain_270`); for a custom shape, a label that is not a catalogue id |
| `custom` | object | A shape that is not in the catalogue (below) |
| `frame` | string | `tub` (default), `lower_rack` or `upper_rack` |
| `position_mm` | 3 numbers | Position of the origin of the item frame in that frame |
| `quat_wxyz` | 4 numbers | Item frame to placement frame; need not be exactly unit |
| `soils` | list | The soils on it; empty for a clean item |
| `notes` | string | |

`custom` is one of:

- `{ "tile": { "length_mm", "width_mm", "thickness_mm", "material", "edge_radius_mm"? } }`: a flat
  test tile. In its own frame it lies on z = 0 with its middle on the z axis; its regions are
  `top` (the face at z = thickness), `underside` and `edge`. `material` is a catalogue material id
  (`porcelain_glazed`, `glass_soda_lime`, `stainless_steel`, `melamine`, `polypropylene`, ...).
- `{ "geometry": { ... } }`: any parametric definition of the geometry kernel in authoring units
  (`class`: `sor`, `box_shell`, `slab`, `rod`, `wire`, `compound`; `docs/design/platform.md`
  section 4.3).

A soil:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | no | Id within the item, for observations to refer to; default `soil_1`, `soil_2`, ... |
| `type` | string | yes | Catalogue soil id (`iec_egg_yolk`, `tomato_sauce`) or a model soil class (`egg_yolk`, `starch`, `adhesive`, `fat`, `soluble`, `tea`) |
| `recipe` | string | no | What it was made of, or the standard it follows |
| `preparation` | string | no | How it was applied |
| `amount_g` | number | yes | Amount applied, wet, by weighing |
| `amount_method`, `amount_sd_g` | | measured: method | How it was weighed and with what uncertainty |
| `where` | object | yes | `{ "regions": [{ "region": "well", "coverage": 0.6 }] }` or `{ "patch": {...} }` |
| `drying` | object | yes | `time_h` from application to the start of the wash; optionally `temperature_c`, `humidity_pct`, `conditions` |
| `heat` | object | yes | `history`: `none`, `warm`, `cooked`, `baked` or `burnt` (the categories of the simulation), with the `temperature_c` and `time_min` actually used |

`where.regions` names regions of the item with the share of each that the soil covers; which part
of a region is covered is then drawn by the simulator from `sim.level_seed`. For a soil whose place
matters, use a patch:

| `patch` field | Meaning |
|---|---|
| `region` | The region it lies on |
| `shape` | `disc` or `rect` |
| `centre_mm` | Centre in the item frame |
| `diameter_mm` | Of a disc |
| `size_mm`, `u_axis` | Sides of a rectangle, the first along `u_axis` (item frame, default +x) projected onto the surface |
| `depth_mm` | Cells within this distance of the plane of the patch belong to it (default 5): raise it for a patch on a curved surface |
| `description` | The patch in words |

A patch is laid on the soil cells of the region whose centres fall inside the outline, with the
loading the weighed amount gives on that area. A patch smaller than one soil cell (2 mm at the
fast tier, 1 mm at the official tier) becomes one cell.

Heat histories: the simulation has one temperature and one time per category. When a record
states them, they replace the registered ones (`soil.heatTemperature`, `soil.heatDuration`) for
that record; two soils of one record in the same category with different temperatures are
reported, and the first is used.

### 7a. Inputs that were not measured: scenarios

A home wash is rarely weighed. An amount that was "about 3 g", a layer spread with a fork: the
record must not state these as facts, and a fit must not treat a guess as a measurement. State
the amount you take with its uncertainty (`amount_g`, `amount_sd_g`, and an `amount_method` that
says nobody weighed it), and give the record **input scenarios** in `sim.scenarios`: a list of
ways the wash may have been.

| Field of a scenario | Meaning |
|---|---|
| `weight` | Its weight, above 0 (default 1); the weights are normalised |
| `level_seed` | Seed of the soil layout in this scenario (where the thick places lie); default the record's |
| `amount_factors` | Factor on the amount of every soil of an item, by item id; an item not named has 1 |
| `params` | Parameter overrides of this scenario on top of the record's own; not of the water |
| `notes` | |

The first scenario is the nominal one, the record as written: `predict` reports it, and beside
it what every other scenario gives. The simulation is replayed once per scenario (a record with
seven scenarios costs seven replays per evaluation), and the likelihood of the observations of
an item is the weighted mean of their likelihood over the scenarios: the unknown inputs are
integrated out, item by item (the observations of one item share its unknown inputs; the
inputs of different items are taken as independent). A scenario list is data of the record and
is written once: `packages/calibration/scripts/make-owner-wash-01-measured.ts` lays the amounts
of four plates out as a quadrature (nine equally spaced deviates of a log-normal about the
amount taken, from -2.4 to +2.4 standard deviations, each weighted with the normal density
there). Prefer such a regular grid of one input to scenarios drawn at random: a few random
scenarios make a likelihood that is bumpy in the fitted parameters, a grid whose step moves a
prediction by less than its scatter makes a smooth one. Where the thick places of a hand-spread
soil lay is not a scenario there but the model term of the observation (`obs.areaLogModelSd`).

What a scenario list cannot do: an error that every item shares (every plate carried a third
more than was asked for) is not integrated out by independent draws per item. Check it apart,
with a copy of the record whose amounts are all scaled.

### The load and the game's load manifest

The load converts both ways with the game (`load.ts`):

- `recordFromManifest(manifest, { id })` takes the `WashManifest` a session hands to the wash
  (`@spotless/session`) and returns a planned record with the machine and its configuration, the
  programme, every loaded item with the exact pose the loading physics left it in, the soils of
  the level and the level's seed. Load the machine in the client as you loaded the real one, start
  the cycle, and the record of your wash is that document plus what you weighed and saw.
- `washManifestFromRecord(record, spec, config)` returns a `WashManifest`: a level made of the
  record's items and soils, the exact poses, and the player-visible load manifest (reference
  points rounded to 0.1 mm, as the session writes them), which a client can open to show where
  everything goes. `spotless-fit manifest record.json` writes it.

What does not carry over, and is reported: an item with a custom shape is not a catalogue item
type and is left out of the manifest (`omitted`); a patch is shown as the share of its region it
covers; a soil given as a model class is shown as the first catalogue soil of that class. Poses
and catalogue soils carry over exactly (positions to 1e-9 mm).

## 8. Observations

Each observation is about one item, at the end of the programme or at a stated time during it.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | no | Default `<item>.<kind>[.<target>][@t]`; must be unique |
| `item` | string | yes | Item id |
| `target` | object | no | `{ "region": "well" }` or `{ "soil": "soil_1" }` (the patch or regions that soil was applied to); default the whole item |
| `at_s` | number | no | Time of an observation taken by opening the door; absent for the end |
| `kind` | string | yes | Below |
| `value` | number or boolean | yes, except in a planned record | The observed value |
| `sd` | number | see below | Standard uncertainty in the unit of the value (for `visible_area`: of ln(area + floor), a factor) |
| `range` | 2 numbers | no | `visible_area` only: `[lower, upper]` in mm2, the range the area is taken to lie in; gives the uncertainty when `sd` is absent |
| `fitted` | boolean | no | `false` for an observation that is recorded, predicted and reported and does not enter the likelihood of a fit (default `true`) |
| `method` | string | yes | Key of `provenance.methods` |
| `notes`, `photos` | string, list of file names | no | |

| `kind` | `value` | Uncertainty | How to take it |
|---|---|---|---|
| `score` | Whole number 0 to 5: the IEC cleaning score (5 no soil; 4 up to 4 specks or 4 mm2; 3 up to 10 specks or 20 mm2; 2 up to 50 mm2; 1 up to 200 mm2; 0 more) | optional; the model has its own (`obs.scoreSd`) | 10 s per item under 1000 to 1500 lux diffuse light |
| `area_fraction` | Share of the soiled area still soiled, 0 to 1 | required | Photograph before and after; soiled pixels over the pixels of the patch |
| `visible_area` | Visibly soiled area, mm2 | `sd` (of the logarithm) or `range` | Photograph after the wash with a scale in it (the diameter of the well); soiled pixels times the area of a pixel. For what is left when a wash nearly succeeds: a few specks or patches on an item that carried soil over 100 cm2 or more, where the area fraction is far below one per cent |
| `residual_mass` | Dry soil left, mg | required | Weigh the item dry before soiling, after drying the soil, and dry after the wash |
| `mass_fraction` | Dry soil left over dry soil applied | required | The same weighings as a ratio; or a published removal percentage |
| `specks` | Count of separate specks | none (the model is a count distribution) | Count; say in `notes` whether redeposited particles are included |
| `clean` | `true` or `false` | none | The game's verdict: at most 4 specks, at most 4 mm2, no standing water |
| `retained_water` | Water standing in the item, mL | required | Pour or blot and weigh; only at the end |

Observations during the run say far more about rates than end states do, because an end state of
"all gone" or "nothing moved" only bounds a rate. Opening the door pauses the programme and cools
the load a little; note each opening under `interruptions`. The simulator reads the state at the
first tick at or after `at_s` (ticks are one arm revolution, about 2 s) and does not model the
pause itself.

**Record what was seen, wrong-looking values included.** A weighed, photographed or measured
value has a small allowance for being a gross error (a slip of the pen, a tile another item
shadowed): one such value among many does not drag a fit, and the fit report names it with the
probability that it is one. Do not delete it; say in `notes` what may have happened. Scores,
verdicts and counts have no such allowance.

**A small visible area is compared by factors.** A photograph tells 100 mm2 from 25 mm2 and
neither from nothing below a few square millimetres. `visible_area` is therefore compared with
the prediction in ln(area + floor), the floor being the registered `obs.areaFloorMm2` (5 mm2):
a reading of nothing and a prediction of one square millimetre agree, and above the floor a
factor of two is the same distance at 20 mm2 as at 200. State the uncertainty as a `range`
("about 100, 50 to 200"), which is read as the central 90 % of the reading's error in that
coordinate, or as an `sd` of the logarithm.

**One residue, one fitted observation.** When the same residue is recorded twice (the verdict
by eye and the area read off the photograph of the same plate), fit one and mark the other
`"fitted": false`: it is predicted and reported beside the first, and does not count twice.

**A clean verdict and a score are judged as the game's inspector judges them**: by the area that
is visibly soiled against the limits of the rule, not by how much soil is left. A thin film that
cannot be seen is clean, however large the surface.

How each kind is predicted and what scatter is assumed about the prediction is in
`docs/calibration/fitting.md` section 2.

## 9. Examples

In `packages/calibration/examples/`:

- `egg-tiles-interrupted.planned.json`: ten glazed tiles with a 50 mm disc of IEC egg yolk each,
  at ten positions in both baskets, observed by photograph at three door openings and at the end.
  A planned record: copy it, run it, fill in the values, set `kind` to `measured`.
- `egg-yolk-tile.literature.json`: the on-line imaging of an egg-yolk tile by Pérez-Mohedano
  (soils dossier section 6.1) as a weak observation on this machine, with what had to be assumed
  written in its notes.
- `plates-mugs-pan.measured-template.json`: a small mixed load on catalogue items with region
  soils, a measured course (events and a temperature log), consumables and every kind of
  observation. Its values are placeholders written by the simulator (`kind: synthetic`).

## 10. What validation rejects

`validateWashRecord` returns every problem at once, each with the path of the field. It rejects: a
document that is not an object or has another `format` or `version`; a missing or malformed `id`
or `kind`; a measured record without date, author or amount methods; a literature record without a
source or with an observation that has no `sd`; an unknown machine or programme; a course whose
logs are not ascending or have unequal lengths, whose events have unknown kinds, or whose steps are
not steps of the programme; an item with an invalid or repeated id, an unknown type, a custom shape
that cannot be built, a pose that is not three and four numbers or a zero quaternion; a soil of
unknown type, with no positive amount, on a region the item does not have, with a coverage outside
(0, 1], a malformed patch, no drying time, or an unknown heat history; an observation of an unknown
item, kind, region or soil, with a value that its kind does not allow, with no method, with no
uncertainty where one is required, at a time during the run for retained water, or with an id used
twice; a range on an observation that is not a visible area, or one that does not hold the value;
a weight outside (0, 1]; an unknown tier or a seed that is not a 32-bit whole number; and a
scenario with a weight of 0 or less, a seed that is not one, a factor of 0 or less, or a factor
for an item the load does not hold.

What can only be found by building the scene (a patch whose centre is not on its region, an item
that cuts through another, a region too small to carry a soil cell) is reported by `predict` and
`fit` as notes of the preparation.
