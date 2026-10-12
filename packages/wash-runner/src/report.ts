/**
 * From the simulation's result to the wash report of the session contract, and the residue
 * maps that go with it.
 *
 * What goes into the report, per washed item: clean or not exactly as the simulation's
 * inspector judged it, the points, the IEC-style score, where visible soil remains (by region
 * and by soil), the water it holds, and when it is not clean a short statement of why. Items
 * the session left out of the wash are listed as not loaded and nothing else is said about
 * them. Nothing of how the simulation got there goes in: no exposure, no film, no liquor, no
 * parameter.
 *
 * Deterministic: a pure function of the manifest and of the result's own deterministic part.
 * `runtime_s` is the only wall-clock value and is given by the caller.
 */

import { getSoil, hasSoil, instantiate } from '@spotless/catalogue';
import { compareIds } from '@spotless/core';
import { surfaceArea } from '@spotless/geometry';
import type {
  ResidueMap,
  ResidueRegion,
  ResidueSoil,
  WashManifest,
  WashReport,
  WashReportItem,
  WashTier,
} from '@spotless/session';
import { WASH_RUNNER_VERSION } from './contract.ts';
import type { WashVerdictCaveat } from './defaults.ts';
import type { ResidueCells } from './residue-codec.ts';
import { encodeResidueMap } from './residue-codec.ts';
import type { CleanRule, ItemWashResult, WashResult } from './sim.ts';

/** Thrown when a result cannot be turned into a report: an infrastructure failure. */
export class WashResultError extends Error {
  override readonly name = 'WashResultError';
}

/**
 * Smallest share of a soil still on a cell for the cell to be drawn in a residue map (a cell
 * the inspector calls visibly soiled is always drawn). Below it a cell rounds to bare: half a
 * step of the 8-bit fraction of the packed map.
 */
export const RESIDUE_TRACE_FRACTION = 1 / 510;

/** How many regions a reason names before it says "and others". */
const REASON_REGIONS = 3;

/** Options of {@link washReportOf}. */
export interface WashReportOptions {
  readonly tier: WashTier;
  /** Wall-clock seconds the wash took. */
  readonly runtimeS: number;
  /** The simulation's rule for "clean", for wording reasons; null when it is not known. */
  readonly rule: CleanRule | null;
  /** Version of the simulation, for the label of the report. */
  readonly simVersion: string;
  /**
   * What the parameters of the wash do not vouch for on this programme
   * (`washCaveatsFor`): every washed item that carries a soil of a named class is listed in
   * a note of the job.
   */
  readonly caveats?: readonly WashVerdictCaveat[];
  /**
   * What to say about the tier of the wash (`washTierNoteFor`): for a fast wash, how often
   * its verdicts differ from the official tier's. The first note of the job when given.
   */
  readonly tierNote?: string | null;
}

/** The report of a wash and the residue maps of its washed items, sorted by item id. */
export interface WashReportBundle {
  readonly report: WashReport;
  readonly residue: readonly ResidueMap[];
  /**
   * What the simulation could not simulate as asked, in its own words. For the log of whoever
   * runs the wash: it is written for developers and may name quantities of the simulation, so
   * it is not part of the report (which only counts it).
   */
  readonly problems: readonly string[];
}

const surfaces = new Map<string, number>();

/** The whole surface of an item type, mm2 (computed once per type). */
function surfaceAreaMm2(itemType: string): number {
  let area = surfaces.get(itemType);
  if (area === undefined) {
    area = surfaceArea(instantiate(itemType).shape) * 1e6;
    surfaces.set(itemType, area);
  }
  return area;
}

function finite(value: number, what: string, itemId: string): number {
  if (!Number.isFinite(value)) {
    throw new WashResultError(`the simulation produced a non-finite ${what} for ${itemId}`);
  }
  return value;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** A region id in words: `interior_base` is "interior base". */
function regionWords(region: string): string {
  return region.replaceAll('_', ' ');
}

/** The name of a soil for a sentence: the catalogue's display name, else the id in words. */
function soilWords(type: string): string {
  return type
    .split('+')
    .map((id) => (hasSoil(id) ? getSoil(id).name : id.replaceAll('_', ' ')))
    .join(' and ');
}

function sentenceCase(text: string): string {
  return text.length === 0 ? text : `${text[0]?.toUpperCase() ?? ''}${text.slice(1)}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Rounds for a sentence: whole numbers from 10 up, one decimal below. */
function tidy(value: number): string {
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

/**
 * The columns of an item's residue: one per model class of its soils, labelled with the
 * catalogue ids of the soils of the item that the class stands for.
 */
interface SoilColumn {
  readonly label: string;
  /** Index of the class among the simulation's soil classes. */
  readonly classIndex: number;
}

function soilColumns(item: ItemWashResult, soilClasses: readonly string[]): SoilColumn[] {
  const byClass = new Map<number, string[]>();
  for (const soil of item.soils) {
    const classIndex = soilClasses.indexOf(soil.modelClass);
    if (classIndex < 0) continue;
    const types = byClass.get(classIndex) ?? [];
    if (!types.includes(soil.type)) types.push(soil.type);
    byClass.set(classIndex, types);
  }
  return [...byClass.keys()]
    .sort((a, b) => a - b)
    .map((classIndex) => ({
      classIndex,
      label: (byClass.get(classIndex) as string[]).join('+'),
    }));
}

/** Per region of an item and per soil column: dry soil before and after, mg. */
function soilByRegion(
  item: ItemWashResult,
  columns: readonly SoilColumn[],
  classCount: number,
): Map<string, { initial: number[]; residual: number[] }> {
  const out = new Map<string, { initial: number[]; residual: number[] }>();
  const cells = item.cells;
  if (cells === undefined) return out;
  for (let e = 0; e < cells.count; e++) {
    const region = item.regionIds[cells.region[e] as number];
    if (region === undefined) continue;
    let sums = out.get(region);
    if (sums === undefined) {
      sums = { initial: columns.map(() => 0), residual: columns.map(() => 0) };
      out.set(region, sums);
    }
    // mg/cm2 times mm2 is mg / 100.
    const area = (cells.areaMm2[e] as number) / 100;
    columns.forEach((column, k) => {
      const at = classCount * e + column.classIndex;
      sums.initial[k] = (sums.initial[k] as number) + (cells.initial_mg_cm2[at] as number) * area;
      sums.residual[k] =
        (sums.residual[k] as number) + (cells.residual_mg_cm2[at] as number) * area;
    });
  }
  return out;
}

/** The cells of an item that still carry soil, in the simulation's order. */
function residueCells(
  item: ItemWashResult,
  columns: readonly SoilColumn[],
  classCount: number,
): ResidueCells {
  const cells = item.cells;
  const labels = columns.map((column) => column.label);
  if (cells === undefined || cells.count === 0 || columns.length === 0) {
    return {
      count: 0,
      centre: new Float32Array(0),
      normal: new Float32Array(0),
      areaMm2: new Float32Array(0),
      soils: labels,
      fraction: new Float32Array(0),
      visible: new Uint8Array(0),
    };
  }
  const k = columns.length;
  const kept: number[] = [];
  const fractions: number[] = [];
  for (let e = 0; e < cells.count; e++) {
    let any = cells.visible[e] === 1;
    const row: number[] = [];
    for (const column of columns) {
      const at = classCount * e + column.classIndex;
      const initial = cells.initial_mg_cm2[at] as number;
      const residual = cells.residual_mg_cm2[at] as number;
      const fraction = initial > 0 ? clamp01(residual / initial) : 0;
      if (fraction >= RESIDUE_TRACE_FRACTION) any = true;
      row.push(fraction);
    }
    if (!any) continue;
    kept.push(e);
    fractions.push(...row);
  }
  const n = kept.length;
  const centre = new Float32Array(3 * n);
  const normal = new Float32Array(3 * n);
  const areaMm2 = new Float32Array(n);
  const visible = new Uint8Array(n);
  kept.forEach((e, i) => {
    for (let axis = 0; axis < 3; axis++) {
      centre[3 * i + axis] = finite(cells.centre[3 * e + axis] as number, 'position', item.itemId);
      normal[3 * i + axis] = finite(cells.normal[3 * e + axis] as number, 'normal', item.itemId);
    }
    areaMm2[i] = cells.areaMm2[e] as number;
    visible[i] = cells.visible[e] === 1 ? 1 : 0;
  });
  if (fractions.length !== n * k) throw new WashResultError('residue map: lost count of cells');
  return {
    count: n,
    centre,
    normal,
    areaMm2,
    soils: labels,
    fraction: Float32Array.from(fractions),
    visible,
  };
}

/**
 * Whether an item is clean, as the level card defines it for every player: at most the
 * rule's specks and the rule's area of visible soil on the whole item. The visible soil
 * counts, as the card says, the residue left where dirty water stood: what the water left
 * standing in the item held of the soil of the liquor is laid on the surface under it by the
 * simulation and is part of the item's visible area. Water as such is reported
 * (`holds_water`, `retained_water_ml`) and does not decide: the card says so,
 * docs/design/platform.md section 6 says so, and it is the recommendation of the benchmark
 * dossier (docs/research/benchmark.md section 9, item 2: soil residue only). The simulation's
 * inspector also fails an item that holds more than `inspect.maxWaterMl`; that part of its
 * verdict is not taken over. Without the rule's numbers the inspector's verdict stands.
 */
export function cleanBySoil(item: ItemWashResult, rule: CleanRule | null): boolean {
  if (rule === null) return item.clean;
  return item.specks <= rule.maxSpecks && item.visibleAreaMm2 <= rule.maxAreaMm2;
}

/** Why an item is not clean, in a sentence or two of fact. Soil only: water does not decide. */
function reasonOf(
  item: ItemWashResult,
  regions: readonly ResidueRegion[],
  rule: CleanRule | null,
): string {
  const water = item.water.pooled_mL;
  const soilFails =
    rule === null
      ? item.visibleAreaMm2 > 0 || item.specks > 0
      : item.specks > rule.maxSpecks || item.visibleAreaMm2 > rule.maxAreaMm2;
  // Only where the rule is not known can water have been what the inspector failed it for.
  const waterFails = rule === null && water > 0;
  const parts: string[] = [];
  if (soilFails) {
    const ranked = [...regions].sort(
      (a, b) =>
        (b.visible_area_mm2 ?? 0) - (a.visible_area_mm2 ?? 0) || compareIds(a.region, b.region),
    );
    for (const region of ranked.slice(0, REASON_REGIONS)) {
      const left = (region.soils ?? []).filter((soil) => soil.residual_fraction > 0);
      const what = left.length === 0 ? 'soil' : left.map((soil) => soilWords(soil.type)).join(', ');
      const specks = region.specks ?? 0;
      parts.push(
        `${what} left on the ${regionWords(region.region)} ` +
          `(${tidy(region.visible_area_mm2 ?? 0)} mm2 visibly soiled` +
          `${specks > 0 ? `, ${plural(specks, 'speck')}` : ''})`,
      );
    }
    if (ranked.length > REASON_REGIONS) {
      parts.push(`soil left on ${plural(ranked.length - REASON_REGIONS, 'other region')}`);
    }
    if (ranked.length === 0) {
      parts.push(
        `${tidy(item.visibleAreaMm2)} mm2 visibly soiled, ${plural(item.specks, 'speck')}`,
      );
    }
  }
  // What standing water left where it stood is soil like any other; the reader is told that
  // it came from the water, which is what to change about the placement.
  const standing = item.water.standingVisibleAreaMm2 ?? 0;
  if (soilFails && standing > 0) {
    parts.push(
      `${tidy(water)} ml of water stood in it to the end of the cycle and left what it held ` +
        `where it stood (${tidy(standing)} mm2)`,
    );
  }
  if (waterFails) parts.push(`holds ${tidy(water)} ml of water`);
  if (parts.length === 0) return 'Not clean by the inspection.';
  return `${sentenceCase(parts.join('; '))}.`;
}

/** Hex digits of the source fingerprint quoted in a report. */
const SOURCE_DIGITS = 16;

/**
 * What computed the report, in one line: the version of the simulation, the named parameter
 * sets it was run with (the registry defaults when none), the detergent and its dose, and the
 * fingerprint of the simulation's source. A report, wherever it is copied to, says which
 * parameters and which code produced it.
 */
export function simVersionOf(simVersion: string, result: WashResult): string {
  const p = result.provenance;
  const sets =
    p.paramSets.length === 0
      ? 'registry defaults'
      : p.paramSets.map((set) => `${set.name}${set.stale ? ' (stale)' : ''}`).join(' + ');
  const source =
    p.sourceFingerprint === '' ? '' : `; source ${p.sourceFingerprint.slice(0, SOURCE_DIGITS)}`;
  return `${simVersion}; parameters ${sets}; detergent ${p.detergent.name} ${p.detergent.dose_g.toFixed(1)} g${source}`;
}

/**
 * The notes of the job: what the load did to the machine, in this runner's own words from the
 * facts. The simulation's own remarks are counted, not quoted (see `WashReportBundle.problems`).
 */
function jobNotes(
  manifest: WashManifest,
  result: WashResult,
  moved: readonly string[],
  caveats: readonly WashVerdictCaveat[],
  tierNote: string | null,
): string[] {
  const notes: string[] = [];
  if (tierNote !== null) notes.push(tierNote);
  for (const caveat of caveats) {
    const concerned = result.items
      .filter((item) => item.soils.some((soil) => caveat.soilClasses.includes(soil.modelClass)))
      .map((item) => item.itemId)
      .sort(compareIds);
    if (concerned.length > 0) notes.push(`${concerned.join(', ')} ${caveat.note}`);
  }
  const check = manifest.prechecks;
  if (check !== undefined) {
    for (const arm of check.spray_arms) {
      if (arm.full_rotation) continue;
      notes.push(
        `The ${arm.arm.replaceAll('_', ' ')} could not turn` +
          `${arm.blocked_by === undefined ? '' : `: ${arm.blocked_by} held it still`}` +
          '. It sprayed from where it stood for the whole wash.',
      );
    }
    if (!check.dispenser_opens) {
      const by = check.dispenser_blocked_by.join(', ');
      notes.push(
        `The detergent dispenser could not open${by === '' ? '' : ` (${by})`}: the wash ran without detergent.`,
      );
    } else if (!check.tablet_path_clear) {
      const by = check.tablet_blocked_by.join(', ');
      notes.push(
        `The detergent tablet could not fall into its tray${by === '' ? '' : ` (${by})`}: the wash ran without detergent.`,
      );
    }
  }
  if (result.provenance.exposureStandIn) {
    notes.push('The water of this wash was computed by a stand-in model, not the full one.');
  }
  const stale = result.provenance.paramSets.filter((set) => set.stale).map((set) => set.name);
  if (stale.length > 0) {
    notes.push(
      `The parameter set${stale.length === 1 ? '' : 's'} ${stale.join(', ')} ${stale.length === 1 ? 'was' : 'were'} made for another state of the simulator and ${stale.length === 1 ? 'was' : 'were'} used all the same: this result is provisional.`,
    );
  }
  // Items whose verdict depends on how sharp an eye judges them: clean at one end of the band
  // in which their residue becomes visible, not clean at the other.
  const edge = result.items
    .filter((item) => item.band !== undefined && !item.band.decided)
    .map((item) => item.itemId)
    .sort(compareIds);
  if (edge.length > 0) {
    notes.push(
      `${edge.join(', ')} ${edge.length === 1 ? 'is' : 'are'} at the edge of clean: what is left on ${edge.length === 1 ? 'it' : 'them'} is seen by a sharp eye and not by a lenient one. The verdict given is that of the standard inspector.`,
    );
  }
  const backend = result.provenance.exposureBackend;
  if (backend === 'cpu' || backend === 'mixed') {
    notes.push(
      "No GPU was available for all of this wash: it was traced on the CPU, whose results differ from the GPU's on rare grazing rays.",
    );
  }
  if (moved.length > 0) {
    notes.push(
      `${moved.join(', ')} ${moved.length === 1 ? 'was' : 'were'} pushed by the jets hard enough to have been moved. ` +
        'The wash is simulated with every item where it was placed.',
    );
  }
  const remarks = result.problems.length + result.machine.timelineProblems.length;
  if (remarks > 0) {
    notes.push(
      `The simulation made ${remarks} remark${remarks === 1 ? '' : 's'} on what it could not simulate as asked; they are in the log of the server.`,
    );
  }
  return notes;
}

/**
 * The wash report of a result, with the residue maps of the washed items. Throws a
 * {@link WashResultError} when the result is not a result of this load (an item missing) or
 * holds a value that is not a finite number.
 */
export function washReportOf(
  manifest: WashManifest,
  result: WashResult,
  options: WashReportOptions,
): WashReportBundle {
  const washed = new Map(result.items.map((item) => [item.itemId, item]));
  const loaded = new Map(manifest.items.map((item) => [item.item_id, item]));
  const classCount = result.soilClasses.length;
  const residue: ResidueMap[] = [];
  const moved: string[] = [];
  const liftWarn = options.rule?.liftWarnRatio ?? null;
  let points = 0;
  let pointsLoaded = 0;
  let graded = 0;
  const items: WashReportItem[] = [...manifest.level.items]
    .sort((a, b) => compareIds(a.id, b.id))
    .map((levelItem): WashReportItem => {
      const entry = loaded.get(levelItem.id);
      // Not washed: nothing is said about it.
      if (entry === undefined) return { item_id: levelItem.id, loaded: false };
      const item = washed.get(levelItem.id);
      if (item === undefined) {
        throw new WashResultError(`the simulation returned no result for ${levelItem.id}`);
      }
      const id = item.itemId;
      const instance = instantiate(entry.item_type);
      const columns = soilColumns(item, result.soilClasses);
      const bySoil = soilByRegion(item, columns, classCount);
      const regions: ResidueRegion[] = item.regions
        .filter((region) => region.visibleAreaMm2 > 0 || region.specks > 0)
        .map((region): ResidueRegion => {
          const visible = finite(region.visibleAreaMm2, 'soiled area', id);
          const whole = (instance.regionAreas[region.regionId] ?? 0) * 1e6;
          // A region the catalogue gives no area for is measured by what carried soil.
          const denominator = whole > 0 ? Math.max(whole, visible) : region.areaMm2;
          const sums = bySoil.get(region.regionId);
          const soils: ResidueSoil[] = [];
          columns.forEach((column, k) => {
            const initial = sums?.initial[k] ?? 0;
            if (!(initial > 0)) return;
            soils.push({
              type: column.label,
              residual_fraction: clamp01(finite((sums?.residual[k] ?? 0) / initial, 'soil', id)),
            });
          });
          return {
            region: region.regionId,
            fraction: denominator > 0 ? clamp01(visible / denominator) : 0,
            visible_area_mm2: visible,
            soiled_area_mm2: finite(region.areaMm2, 'area', id),
            specks: region.specks,
            soils,
          };
        })
        .sort((a, b) => compareIds(a.region, b.region));
      const surface = surfaceAreaMm2(entry.item_type);
      const visibleArea = finite(item.visibleAreaMm2, 'soiled area', id);
      const score = finite(item.score, 'score', id);
      const pooled = finite(item.water.pooled_mL, 'amount of water', id);
      const map = encodeResidueMap(id, residueCells(item, columns, classCount));
      residue.push(map);
      const clean = cleanBySoil(item, options.rule);
      const awarded = clean ? levelItem.points : 0;
      const gradedScore = clamp01(score / 5);
      const lift = item.jetLiftRatio;
      const likelyMoved =
        liftWarn !== null && lift !== undefined && finite(lift, 'jet force', id) > liftWarn;
      if (likelyMoved) moved.push(id);
      points += awarded;
      pointsLoaded += levelItem.points;
      graded += levelItem.points * gradedScore;
      return {
        item_id: id,
        loaded: true,
        clean,
        points_awarded: awarded,
        graded_score: gradedScore,
        residual_fraction_area: surface > 0 ? clamp01(visibleArea / surface) : 0,
        residue_regions: regions,
        // The load is static in this build of the simulation: nothing is moved by the wash.
        moved_during_wash: false,
        ...(likelyMoved ? { likely_moved: true } : {}),
        holds_water: options.rule === null ? pooled > 0 : pooled > options.rule.maxWaterMl,
        retained_water_ml: pooled,
        score_iec: score,
        ...(clean ? {} : { reason: reasonOf(item, regions, options.rule) }),
        visible_area_mm2: visibleArea,
        specks: item.specks,
        residual_mass_fraction:
          item.initialMass_mg > 0
            ? clamp01(finite(item.residualMass_mg / item.initialMass_mg, 'soil mass', id))
            : 0,
        surface_film_g: finite(item.water.film_g, 'water film', id),
        residue_cells: map.cells,
      };
    });
  for (const item of manifest.items) {
    if (!manifest.level.items.some((levelItem) => levelItem.id === item.item_id)) {
      throw new WashResultError(
        `the manifest loads ${item.item_id}, which the level does not have`,
      );
    }
  }
  const notes = jobNotes(manifest, result, moved, options.caveats ?? [], options.tierNote ?? null);
  const report: WashReport = {
    benchmark_version: manifest.load.benchmark_version,
    level_id: manifest.load.level_id,
    state_hash: manifest.load.state_hash,
    job: {
      status: 'done',
      runtime_s: options.runtimeS,
      fidelity: options.tier,
      sim_version: simVersionOf(options.simVersion, result),
      runner_version: WASH_RUNNER_VERSION,
      result_hash: result.provenance.resultHash,
      ...(notes.length === 0 ? {} : { notes }),
    },
    score: {
      points,
      points_available: manifest.level.items.reduce((sum, item) => sum + item.points, 0),
      graded_points: graded,
      points_loaded: pointsLoaded,
    },
    items,
  };
  return {
    report,
    residue,
    problems: [...result.problems, ...result.machine.timelineProblems],
  };
}
