/**
 * The demonstration washes: settled standard loads of the owner's machine (Bosch SMV4HAX40G)
 * washed on the scored programme, Eco 50, at the official block size, with the input, the
 * result and a table of each written under `packages/sim-verify/demos/`.
 *
 *   pnpm --filter @spotless/sim-verify exec tsx scripts/demo-washes.ts [name ...] [--tier fast]
 *        [--params <set.json>]... [--detergent <set.json>] [--dose-g <grams>]
 *        [--accept-stale-params] [--out <dir>] [--describe-only] [--programme <id>|level]
 *
 * `--programme` names another programme of the machine (`auto_145`: the owner's Auto 45-65,
 * whose verdicts on protein soils and stains are provisional), or `level` for the programme
 * the load's own level names; without it every load is washed on Eco 50.
 *
 * `--params` names a parameter-set file laid over the registry defaults (several: later over
 * earlier), `--detergent` the parameter-set file of the detergent's composition and `--dose-g`
 * its dose; without them the washes run on the registry defaults with the machine's own dose
 * of the reference detergent. A parameter-set file whose stored hashes do not match the
 * current registry is stale: the script stops and says what to do, unless
 * `--accept-stale-params` is given. `SUMMARY.md` and every table say which sets, which
 * detergent and which source (fingerprint) produced them. `--out` writes elsewhere than
 * `demos/`. `--describe-only` writes the `<name>.wash.json` of every load and washes nothing
 * (the anchoring reads its poses from copies of those files).
 *
 * Without names: `iec-13-careful` (a sensible full load of 13 place settings, settled by the
 * loading physics), `iec-13-careful-badly` (the very same items, loaded badly: see below),
 * `half-careful` (a half load, well placed) and `iec-13-careless` (the loader's own settled
 * load of the same offer with the common mistakes). A name is a file of
 * `packages/loader/loads/` without `.json`, or `<name>-badly` for the edit below of `<name>`.
 *
 * `-badly` takes the poses of a settled load and changes them by rule, without settling them
 * again (the wash reports what then cuts into what): every second dinner, dessert and
 * melamine plate and saucer is turned round in its slot (eating face away from the jets),
 * every second soup plate is pushed into the slot of the one before it (nested 6 mm behind
 * it), every mug, cup and glass stands mouth up where it stood mouth down, and the dispenser
 * is kept shut, as by a pan standing in front of the tablet tray (the pan itself is not
 * added: the items are the same).
 *
 * Per load it writes `<name>.wash.json` (the `WashDescription` that `spotless-wash` reads; the
 * poses are those the loading physics left), `<name>.result.json` (the wash result) and
 * `<name>.table.md` (per item: type, basket, soils with residue, visibly soiled area, water,
 * clean or not; per wash: time per stage, GPU memory, water balance). `SUMMARY.md` holds the
 * three side by side. Exposure sets are cached in `demos/.spotless/exposure-cache` (ignored by
 * the repository), so a second run replays the soil only.
 *
 * The loads are read as data (JSON): this package does not depend on `@spotless/loader`.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instantiate } from '@spotless/catalogue';
import { quatFromAxisAngle, quatMul, quatRotate, type Quat, type Vec3 } from '@spotless/core';
import {
  wash,
  washInputFromDescription,
  washResultToJson,
  type ItemDescription,
  type SoilDescription,
  type WashDescription,
  type WashResult,
} from '@spotless/sim-core';
import {
  composeParamFiles,
  createDiskExposureCache,
  simulationFingerprint,
} from '@spotless/sim-core/node';
import {
  fastTierNote,
  readTierAgreement,
  tierAgreementFileOf,
} from '@spotless/sim-core/tier-agreement';
import { createNodeGpuContext } from '@spotless/sim-gpu/node';

interface LoadFile {
  readonly name: string;
  readonly description: string;
  readonly mistakes: readonly { kind: string; item_id: string; note?: string }[];
  readonly left_out: readonly { item_id: string; reason: string }[];
  readonly check: {
    readonly spray_arms: readonly {
      arm: string;
      full_rotation: boolean;
      first_contact_angle_deg?: number;
      blocked_by?: string;
    }[];
    readonly dispenser_opens: boolean;
    readonly tablet_path_clear: boolean;
  };
  readonly wash_manifest: {
    readonly machine_id: string;
    /** The whole configuration the load was made in (`MachineConfig` of `@spotless/machine`). */
    readonly machine_config: NonNullable<WashDescription['machineConfig']>;
    readonly programme_id: string;
    readonly seed: number;
    readonly items: readonly {
      item_id: string;
      item_type: string;
      pose: { p: [number, number, number]; q: [number, number, number, number] };
      soils: readonly {
        type: string;
        regions: readonly { region: string; coverage: number }[];
        amountG: number;
        ageH: number;
        heatHistory?: string;
      }[];
    }[];
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const loads = join(here, '..', '..', 'loader', 'loads');
const args = process.argv.slice(2);
/** Options that take a value, and the indices of the arguments they consume. */
const VALUE_OPTIONS = ['--tier', '--params', '--detergent', '--dose-g', '--out', '--programme'];
/** The programme the game is scored on (decision of 10 October 2026). */
const SCORED_PROGRAMME = 'eco_50';
const taken = new Set<number>();
const valuesOf = (name: string): string[] => {
  const found: string[] = [];
  args.forEach((arg, i) => {
    if (arg !== name) return;
    taken.add(i);
    taken.add(i + 1);
    const value = args[i + 1];
    if (value !== undefined) found.push(value);
  });
  return found;
};
for (const name of VALUE_OPTIONS) valuesOf(name);
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const tier: 'official' | 'fast' = valuesOf('--tier')[0] === 'fast' ? 'fast' : 'official';
const out =
  valuesOf('--out')[0] === undefined
    ? join(here, '..', 'demos')
    : fromOrigin(valuesOf('--out')[0] as string);
const programmeChoice = valuesOf('--programme')[0] ?? SCORED_PROGRAMME;
const detergentFile = valuesOf('--detergent')[0];
const doseG = valuesOf('--dose-g')[0] === undefined ? undefined : Number(valuesOf('--dose-g')[0]);
// The parameters of every wash: the registry defaults, the named sets, the detergent. A stale
// file ends the script here, with what to do about it.
const composed = composeParamFiles({
  paramSets: valuesOf('--params').map(fromOrigin),
  ...(detergentFile === undefined ? {} : { detergent: fromOrigin(detergentFile) }),
  ...(args.includes('--accept-stale-params') ? { acceptStale: true } : {}),
});
/**
 * What a table of a fast wash says about the tier: how often the fast tier's verdicts differ
 * from the official tier's, as measured for the last of the named sets (`tiers.<set>.json`).
 */
const lastSet = valuesOf('--params').at(-1);
const TIER_NOTE: string | null =
  tier === 'fast'
    ? fastTierNote(
        lastSet === undefined
          ? null
          : readTierAgreement(tierAgreementFileOf(fromOrigin(lastSet))),
        programmeChoice === 'level' ? SCORED_PROGRAMME : programmeChoice,
      )
    : null;
/** With `--describe-only`: write the wash descriptions and wash nothing. */
const describeOnly = args.includes('--describe-only');
const names = args.filter((a, i) => !a.startsWith('--') && !taken.has(i));
const wanted =
  names.length > 0
    ? names
    : ['iec-13-careful', 'iec-13-careful-badly', 'half-careful', 'iec-13-careless'];

/** The wash description of a saved load: SI poses to millimetres, (x, y, z, w) to (w, x, y, z). */
function descriptionOf(load: LoadFile): WashDescription {
  const m = load.wash_manifest;
  const stalled: Record<string, number> = {};
  for (const arm of load.check.spray_arms) {
    if (!arm.full_rotation) {
      stalled[arm.arm.replace(/_arm$/, '')] = arm.first_contact_angle_deg ?? 0;
    }
  }
  const items: ItemDescription[] = m.items.map((item) => ({
    id: item.item_id,
    type: item.item_type,
    position_mm: [item.pose.p[0] * 1000, item.pose.p[1] * 1000, item.pose.p[2] * 1000],
    quat_wxyz: [item.pose.q[3], item.pose.q[0], item.pose.q[1], item.pose.q[2]],
    soils: item.soils.map((s): SoilDescription => ({
      type: s.type,
      regions: s.regions,
      amount_g: s.amountG,
      age_h: s.ageH,
      ...(s.heatHistory === undefined
        ? {}
        : { heat_history: s.heatHistory as NonNullable<SoilDescription['heat_history']> }),
    })),
  }));
  return {
    machine: m.machine_id,
    programme: programmeChoice === 'level' ? m.programme_id : programmeChoice,
    basketHeights: m.machine_config.basketHeights,
    // Shelves, folded rows and the cutlery basket's position as the load was made: without
    // them mugs on a folded-down cup shelf stand inside the shelf folded up.
    machineConfig: m.machine_config,
    tier,
    levelSeed: m.seed,
    simSeed: 1,
    ...(load.check.dispenser_opens && load.check.tablet_path_clear
      ? {}
      : { dispenserBlocked: true }),
    ...(Object.keys(stalled).length === 0 ? {} : { stalledArms_deg: stalled }),
    items,
  };
}

/** Nested plates stand this far apart along their axis, mm. */
const NEST_GAP_MM = 6;

/**
 * The same items loaded badly: see the file comment. Returns the description and what was
 * changed, as the `mistakes` of a load file.
 */
function loadedBadly(description: WashDescription): {
  readonly description: WashDescription;
  readonly mistakes: LoadFile['mistakes'];
} {
  const mistakes: { kind: string; item_id: string; note: string }[] = [];
  const quatOf = (item: ItemDescription): Quat => {
    const w = item.quat_wxyz ?? [1, 0, 0, 0];
    return [w[1], w[2], w[3], w[0]];
  };
  const wxyz = (q: Quat): [number, number, number, number] => [q[3], q[0], q[1], q[2]];
  const byId = [...description.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const changed = new Map<string, ItemDescription>();
  // Plates turned round: the same slab of space, the eating face on the other side.
  const turnable = byId.filter((i) => /plate|saucer/.test(i.type) && !/soup_plate/.test(i.type));
  turnable.forEach((item, index) => {
    if (index % 2 === 0) return;
    const q = quatOf(item);
    const height = instantiate(item.type).bbox.max[2] * 1000;
    const axis = quatRotate(q, [0, 0, 1]);
    changed.set(item.id, {
      ...item,
      position_mm: [
        item.position_mm[0] + height * axis[0],
        item.position_mm[1] + height * axis[1],
        item.position_mm[2] + height * axis[2],
      ],
      quat_wxyz: wxyz(quatMul(q, quatFromAxisAngle([1, 0, 0], Math.PI))),
    });
    mistakes.push({
      kind: 'plate_facing_away',
      item_id: item.id,
      note: 'turned round in its slot',
    });
  });
  // Soup plates two to a slot: every second one 6 mm behind the one before it.
  const soup = byId.filter((i) => /soup_plate/.test(i.type));
  soup.forEach((item, index) => {
    const host = soup[index - 1];
    if (index % 2 === 0 || host === undefined) return;
    const axis = quatRotate(quatOf(host), [0, 0, 1]);
    changed.set(item.id, {
      ...item,
      position_mm: [
        host.position_mm[0] - NEST_GAP_MM * axis[0],
        host.position_mm[1] - NEST_GAP_MM * axis[1],
        host.position_mm[2] - NEST_GAP_MM * axis[2],
      ],
      quat_wxyz: host.quat_wxyz ?? [1, 0, 0, 0],
    });
    mistakes.push({
      kind: 'bowls_nested',
      item_id: item.id,
      note: `nested ${NEST_GAP_MM} mm behind ${host.id}`,
    });
  });
  // Mugs, cups and glasses mouth up, standing where they stood.
  for (const item of byId) {
    if (!/mug|cup|glass/.test(item.type)) continue;
    const instance = instantiate(item.type);
    const upright = instance.stablePoses.find((pose) => pose.name === 'upright');
    if (upright === undefined) continue;
    const corners = (q: Quat): Vec3[] => {
      const out: Vec3[] = [];
      for (const x of [instance.bbox.min[0], instance.bbox.max[0]]) {
        for (const y of [instance.bbox.min[1], instance.bbox.max[1]]) {
          for (const z of [instance.bbox.min[2], instance.bbox.max[2]]) {
            out.push(quatRotate(q, [x * 1000, y * 1000, z * 1000]));
          }
        }
      }
      return out;
    };
    const extent = (points: readonly Vec3[]): { low: number; cx: number; cy: number } => {
      let low = Infinity;
      const lo = [Infinity, Infinity];
      const hi = [-Infinity, -Infinity];
      for (const p of points) {
        low = Math.min(low, p[2]);
        for (let k = 0; k < 2; k++) {
          lo[k] = Math.min(lo[k] as number, p[k] as number);
          hi[k] = Math.max(hi[k] as number, p[k] as number);
        }
      }
      return {
        low,
        cx: 0.5 * ((lo[0] as number) + (hi[0] as number)),
        cy: 0.5 * ((lo[1] as number) + (hi[1] as number)),
      };
    };
    const was = extent(corners(quatOf(item)));
    const now = extent(corners(upright.q));
    changed.set(item.id, {
      ...item,
      position_mm: [
        item.position_mm[0] + was.cx - now.cx,
        item.position_mm[1] + was.cy - now.cy,
        item.position_mm[2] + was.low - now.low,
      ],
      quat_wxyz: wxyz(upright.q),
    });
    mistakes.push({ kind: 'cup_upright', item_id: item.id, note: 'stands mouth up' });
  }
  mistakes.push({
    kind: 'tablet_tray_blocked',
    item_id: '',
    note: 'the dispenser is kept shut, as by a pan in front of the tablet tray',
  });
  return {
    description: {
      ...description,
      dispenserBlocked: true,
      items: description.items.map((item) => changed.get(item.id) ?? item),
    },
    mistakes,
  };
}

const basketOf = (z: number): string => (z > 0.4 ? 'upper' : 'lower');
const fixed = (v: number, digits = 1): string => v.toFixed(digits);

interface Row {
  readonly load: string;
  readonly seconds: Readonly<Record<string, number>>;
  readonly total: number;
  readonly result: WashResult;
  readonly gpuSceneMB: number;
  readonly gpuPeakMB: number;
  readonly rssGB: number;
  readonly mistakes: LoadFile['mistakes'];
  readonly leftOut: number;
}

function tableOf(row: Row, load: LoadFile): string {
  const r = row.result;
  const lines: string[] = [];
  lines.push(`# Demonstration wash: ${row.load}`);
  lines.push('');
  lines.push(load.description);
  lines.push('');
  if (TIER_NOTE !== null) {
    lines.push(`**Tier.** ${TIER_NOTE}`);
    lines.push('');
  }
  lines.push(
    `Machine ${r.machine.machineId}, programme ${r.machine.programmeId} (${fixed(r.machine.duration_s / 60, 0)} min, ${r.machine.ticks} ticks), tier ${r.provenance.tier}, ${r.items.length} items (${row.leftOut} of the offer left on the counter by the loading physics), simulator ${r.provenance.simVersion}, exposure on the ${r.provenance.exposureBackend}.`,
  );
  lines.push('');
  if (row.mistakes.length > 0) {
    const kinds = new Map<string, number>();
    for (const m of row.mistakes) kinds.set(m.kind, (kinds.get(m.kind) ?? 0) + 1);
    lines.push(`Mistakes in this load: ${[...kinds].map(([k, n]) => `${k} x ${n}`).join(', ')}.`);
    lines.push('');
  }
  lines.push('## The wash');
  lines.push('');
  lines.push('| Quantity | Value |');
  lines.push('|---|---|');
  for (const [stage, s] of Object.entries(row.seconds)) {
    lines.push(`| Time, ${stage} | ${fixed(s)} s |`);
  }
  lines.push(`| Time, total | ${fixed(row.total)} s (${fixed(row.total / 60)} min) |`);
  lines.push(
    `| Exposure sets | ${r.run.exposureComputed} computed, ${r.run.exposureCacheHits} from the cache |`,
  );
  lines.push(
    `| Scene | ${r.run.blocks} blocks, ${r.run.soilCells} soil cells, ${r.run.deposits} deposits |`,
  );
  lines.push(
    `| GPU memory | scene ${fixed(row.gpuSceneMB)} MB, peak of all buffers ${fixed(row.gpuPeakMB)} MB |`,
  );
  lines.push(`| Process memory (RSS) | ${fixed(row.rssGB, 2)} GB |`);
  lines.push(
    `| Mains water, energy | ${fixed(r.machine.water_L)} L, ${fixed(r.machine.energy_kWh, 2)} kWh |`,
  );
  lines.push(`| Water held in vessels | ${fixed(r.machine.heldWater_mL, 0)} mL |`);
  lines.push(
    `| Detergent | ${fixed(r.machine.detergent.dissolved_g)} of ${fixed(r.machine.detergent.dosed_g)} g dissolved (dispenser ${r.machine.dispenser}) |`,
  );
  lines.push(
    `| Soil | ${fixed(r.machine.soil.initial_mg / 1000, 2)} g dry at the start, ${fixed(r.machine.soil.remaining_mg / 1000, 2)} g left (${fixed((100 * r.machine.soil.remaining_mg) / Math.max(r.machine.soil.initial_mg, 1e-9), 0)} %) |`,
  );
  const clean = r.items.filter((i) => i.clean).length;
  lines.push(`| Items clean | ${clean} of ${r.items.length} |`);
  lines.push('');
  lines.push('## Water balance per spray state (kg per revolution of the master arm)');
  lines.push('');
  lines.push(
    '| State | Time active | Arms | Nozzles | Handed to film | Splatter | Scatter | Droplets landed | Lost | Sump return | Held on items | Left after drain-down | Closes |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of r.machine.states) {
    const w = s.exposure.water;
    const f = s.exposure.film;
    const kg = (units: number | undefined): string =>
      units === undefined || w === undefined ? '' : fixed(units * w.unit, 4);
    lines.push(
      `| ${s.id} | ${fixed(s.duration_s, 0)} s | ${s.arms.map((a) => `${a.level} ${a.stalled ? 'stalled' : `${fixed(a.rpm, 0)} rpm`}`).join(', ')} | ${kg(w?.nozzle)} | ${kg(w?.handover)} | ${kg(w?.splatter)} | ${kg(w?.scatter)} | ${kg(w?.dropletsLanded)} | ${kg((w?.jetLost ?? 0) + (w?.dropletsLost ?? 0))} | ${w === undefined ? '' : `${fixed(100 * w.sumpReturnFraction, 2)} %`} | ${f === undefined ? '' : `${fixed(f.heldOnItems, 3)} kg`} | ${f === undefined ? '' : `${fixed(f.retainedOnItems, 3)} kg`} | ${w?.closes === true ? 'yes' : 'no'} |`,
    );
  }
  lines.push('');
  if (r.problems.length + r.machine.timelineProblems.length > 0) {
    lines.push('## What the wash reports');
    lines.push('');
    for (const p of r.problems) lines.push(`- ${p}`);
    for (const p of r.machine.timelineProblems) lines.push(`- machine: ${p}`);
    lines.push('');
  }
  lines.push('## Items');
  lines.push('');
  lines.push(
    '| Item | Type | Basket | Position (mm) | Soil: left of initial (mg) | Residual soil (mg) | Visibly soiled area (mm2) | Score | Water: pooled (mL), film (g) | Clean |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  const poseOf = new Map(load.wash_manifest.items.map((i) => [i.item_id, i.pose.p]));
  for (const i of r.items) {
    const p = poseOf.get(i.itemId) ?? [0, 0, 0];
    const soils =
      i.soils.length === 0
        ? 'none'
        : i.soils
            .map((s) => `${s.type} ${fixed(s.residualMass_mg, 2)} of ${fixed(s.initialMass_mg, 2)}`)
            .join('; ');
    lines.push(
      `| ${i.itemId} | ${i.typeId} | ${basketOf(p[2])} | ${fixed(p[0] * 1000, 0)}, ${fixed(p[1] * 1000, 0)}, ${fixed(p[2] * 1000, 0)} | ${soils} | ${fixed(i.residualMass_mg, 2)} | ${fixed(i.visibleAreaMm2, 0)} of ${fixed(i.initialVisibleAreaMm2, 0)} | ${i.score} | ${fixed(i.water.pooled_mL)}, ${fixed(i.water.film_g, 2)} | ${i.clean ? 'yes' : 'no'} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

mkdirSync(out, { recursive: true });
const gpu = await createNodeGpuContext({ sim: 'spotless-sim demo washes' });
const cache = createDiskExposureCache(join(out, '.spotless', 'exposure-cache'));
const rows: Row[] = [];
for (const name of wanted) {
  const badly = name.endsWith('-badly');
  const source = badly ? name.slice(0, -'-badly'.length) : name;
  const settled = JSON.parse(readFileSync(join(loads, `${source}.json`), 'utf8')) as LoadFile;
  const edited = badly ? loadedBadly(descriptionOf(settled)) : undefined;
  const description = edited?.description ?? descriptionOf(settled);
  // The poses the tables show are those washed.
  const load: LoadFile =
    edited === undefined
      ? settled
      : {
          ...settled,
          description: `${settled.description} The same items loaded badly by rule, without settling them again: plates turned round, soup plates nested, mugs, cups and glasses mouth up, the dispenser kept shut.`,
          mistakes: edited.mistakes,
          wash_manifest: {
            ...settled.wash_manifest,
            items: settled.wash_manifest.items.map((item) => {
              const now = description.items.find((i) => i.id === item.item_id);
              if (now === undefined) return item;
              return {
                ...item,
                pose: {
                  p: [
                    now.position_mm[0] / 1000,
                    now.position_mm[1] / 1000,
                    now.position_mm[2] / 1000,
                  ],
                  q: item.pose.q,
                },
              };
            }),
          },
        };
  writeFileSync(join(out, `${name}.wash.json`), `${JSON.stringify(description, null, 1)}\n`);
  if (describeOnly) {
    console.error(`${name}: wrote ${name}.wash.json (${description.items.length} items)`);
    continue;
  }
  const started = performance.now();
  let stage = '';
  const detergentName =
    composed.records.find((record) => record.role === 'detergent')?.name ?? 'unnamed detergent';
  const result = await wash(
    {
      ...washInputFromDescription({
        ...description,
        ...(Object.keys(composed.params).length === 0
          ? {}
          : { params: { ...composed.params, ...(description.params ?? {}) } }),
        ...(doseG === undefined ? {} : { detergent: { name: detergentName, dose_g: doseG } }),
      }),
      ...(composed.records.length === 0 ? {} : { paramSets: composed.records }),
    },
    {
      cache,
      gpu,
      keepScene: false,
      sourceFingerprint: simulationFingerprint(),
      onProgress: (p) => {
        if (p.stage !== stage) {
          stage = p.stage;
          console.error(`${name}: ${stage} at ${fixed((performance.now() - started) / 1000)} s`);
        }
      },
    },
  );
  const total = (performance.now() - started) / 1000;
  const seconds: Record<string, number> = {};
  for (const [k, v] of Object.entries(result.run.timings_ms)) seconds[k] = v / 1000;
  const row: Row = {
    load: name,
    seconds,
    total,
    result,
    // The scene (hierarchy, triangles, tables) is all the wash keeps on the device between
    // dispatches; the peak adds the ray and hit buffers of the largest batch.
    gpuSceneMB: gpu.stats.liveBytes / 1e6,
    gpuPeakMB: gpu.stats.peakBytes / 1e6,
    rssGB: process.memoryUsage().rss / 1e9,
    mistakes: load.mistakes,
    leftOut: load.left_out.length,
  };
  rows.push(row);
  writeFileSync(
    join(out, `${name}.result.json`),
    `${JSON.stringify(washResultToJson(result), null, 1)}\n`,
  );
  writeFileSync(join(out, `${name}.table.md`), tableOf(row, load));
  console.error(
    `${name}: ${fixed(total)} s; ${result.items.filter((i) => i.clean).length} of ${result.items.length} clean`,
  );
}

if (describeOnly) process.exit(0);

// ---- the three side by side
const summary: string[] = [];
summary.push('# Demonstration washes');
summary.push('');
summary.push(
  `Settled standard loads of the owner's Bosch SMV4HAX40G, programme ${programmeChoice === 'level' ? "of each load's level" : programmeChoice}, tier ${tier}. Written by \`scripts/demo-washes.ts\`; per-item tables in \`<name>.table.md\`, inputs in \`<name>.wash.json\`, results in \`<name>.result.json\`.`,
);
if (TIER_NOTE !== null) {
  summary.push('');
  summary.push(`**Tier.** ${TIER_NOTE}`);
}
const provenance = rows[0]?.result.provenance;
if (provenance !== undefined) {
  summary.push('');
  summary.push(
    `Parameters: ${provenance.paramSets.length === 0 ? 'the registry defaults' : provenance.paramSets.map((set) => `${set.name}${set.stale ? ' (STALE, accepted)' : ''}`).join(' + ')}; detergent ${provenance.detergent.name}, ${fixed(provenance.detergent.dose_g, 1)} g. Simulator ${provenance.simVersion}, source ${provenance.sourceFingerprint.slice(0, 16)} (exposure sources ${provenance.exposureSource.slice(0, 16)}); hydro ${provenance.hydroHash.slice(0, 19)}, soil ${provenance.soilHash.slice(0, 19)}.`,
  );
}
summary.push('');
summary.push(`| | ${rows.map((r) => r.load).join(' | ')} |`);
summary.push(`|---|${rows.map(() => '---').join('|')}|`);
const line = (label: string, of: (r: Row) => string): void => {
  summary.push(`| ${label} | ${rows.map(of).join(' | ')} |`);
};
line('Items', (r) => String(r.result.items.length));
line('Items clean', (r) => String(r.result.items.filter((i) => i.clean).length));
line('Mean IEC score', (r) =>
  fixed(r.result.items.reduce((s, i) => s + i.score, 0) / Math.max(1, r.result.items.length), 2),
);
line('Dry soil at the start (g)', (r) => fixed(r.result.machine.soil.initial_mg / 1000, 2));
line('Dry soil left (g)', (r) => fixed(r.result.machine.soil.remaining_mg / 1000, 2));
line('Soil left (%)', (r) =>
  fixed(
    (100 * r.result.machine.soil.remaining_mg) / Math.max(r.result.machine.soil.initial_mg, 1e-9),
    1,
  ),
);
line('Water held in vessels (mL)', (r) => fixed(r.result.machine.heldWater_mL, 0));
line('Blocks', (r) => String(r.result.run.blocks));
line('Deposits', (r) => String(r.result.run.deposits));
for (const stage of ['scene', 'hydraulics', 'exposure', 'soil', 'replay', 'result']) {
  line(`Time, ${stage} (s)`, (r) => fixed(r.seconds[stage] ?? 0));
}
line('Time, total (s)', (r) => fixed(r.total));
line(
  'Exposure sets computed / cached',
  (r) => `${r.result.run.exposureComputed} / ${r.result.run.exposureCacheHits}`,
);
line('GPU memory, scene / peak (MB)', (r) => `${fixed(r.gpuSceneMB)} / ${fixed(r.gpuPeakMB)}`);
line('Process RSS (GB)', (r) => fixed(r.rssGB, 2));
line('Sump return per revolution (%)', (r) =>
  r.result.machine.states
    .map((s) => fixed(100 * (s.exposure.water?.sumpReturnFraction ?? 0), 2))
    .join(', '),
);
line('Water balance closes', (r) =>
  r.result.machine.states.every((s) => s.exposure.water?.closes === true) ? 'yes' : 'no',
);
line(
  'Problems reported (placement and other, machine timeline)',
  (r) => `${r.result.problems.length}, ${r.result.machine.timelineProblems.length}`,
);
line(
  'Mains water (L), energy (kWh)',
  (r) => `${fixed(r.result.machine.water_L)}, ${fixed(r.result.machine.energy_kWh, 2)}`,
);
line(
  'Detergent dissolved (g of dosed)',
  (r) =>
    `${fixed(r.result.machine.detergent.dissolved_g)} of ${fixed(r.result.machine.detergent.dosed_g)}`,
);
summary.push('');
summary.push('## Residue by soil (mg left of mg applied, dry)');
summary.push('');
const soilTypes = [
  ...new Set(rows.flatMap((r) => r.result.items.flatMap((i) => i.soils.map((s) => s.type)))),
].sort();
summary.push(`| Soil | ${rows.map((r) => r.load).join(' | ')} |`);
summary.push(`|---|${rows.map(() => '---').join('|')}|`);
for (const type of soilTypes) {
  summary.push(
    `| ${type} | ${rows
      .map((r) => {
        let left = 0;
        let initial = 0;
        for (const i of r.result.items) {
          for (const s of i.soils) {
            if (s.type !== type) continue;
            left += s.residualMass_mg;
            initial += s.initialMass_mg;
          }
        }
        return initial > 0
          ? `${fixed(left, 1)} of ${fixed(initial, 1)} (${fixed((100 * left) / initial, 0)} %)`
          : '';
      })
      .join(' | ')} |`,
  );
}
summary.push('');
summary.push('## Clean items by type (clean of loaded)');
summary.push('');
const types = [...new Set(rows.flatMap((r) => r.result.items.map((i) => i.typeId)))].sort();
summary.push(`| Type | ${rows.map((r) => r.load).join(' | ')} |`);
summary.push(`|---|${rows.map(() => '---').join('|')}|`);
for (const type of types) {
  summary.push(
    `| ${type} | ${rows
      .map((r) => {
        const of = r.result.items.filter((i) => i.typeId === type);
        return of.length === 0 ? '' : `${of.filter((i) => i.clean).length} of ${of.length}`;
      })
      .join(' | ')} |`,
  );
}
summary.push('');
writeFileSync(
  join(out, tier === 'official' ? 'SUMMARY.md' : `SUMMARY-${tier}.md`),
  summary.join('\n'),
);
console.error(`wrote ${out}`);
process.exit(0);
