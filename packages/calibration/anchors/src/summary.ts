/**
 * What a wash of the standard load is compared with the published results by
 * (docs/research/standards.md sections 5.1, 6.1 and 7.1): the item classes of the round robin,
 * the mean IEC score per class and over all items, the share of items clean by the game's rule,
 * and what is left of each soil.
 *
 * Units: scores 0 to 5; masses in mg of dry soil; areas in mm2.
 */

import type { ItemWashResult, WashResult } from '@spotless/sim-core';

/** The item classes of the round robin (standards 5.1), in the order the dossier prints them. */
export const ITEM_CLASSES = ['crockery', 'cutlery', 'glass', 'melamine', 'pots'] as const;

/** One of the {@link ITEM_CLASSES}. */
export type ItemClass = (typeof ITEM_CLASSES)[number];

/**
 * The class of a catalogue item type as the round robin sorts the standard load (standards
 * 5.1): crockery is every porcelain or ceramic plate, cup, mug, saucer and the platter; cutlery
 * every piece of flatware and serving cutlery; glass the glasses, the glass dessert bowls and
 * the glass bowl; melamine the melamine plates and bowls; pots the two saucepans. Undefined for
 * an item type that is not part of the standard load.
 */
export function itemClassOf(typeId: string): ItemClass | undefined {
  if (/^melamine_/.test(typeId)) return 'melamine';
  if (/^saucepan_/.test(typeId)) return 'pots';
  if (/^(test_glass|dessert_bowl_vitrelle|glass_bowl)/.test(typeId)) return 'glass';
  if (/(fork|knife|spoon|ladle)/.test(typeId)) return 'cutlery';
  if (/(plate|platter|mug|cup|saucer)/.test(typeId)) return 'crockery';
  return undefined;
}

/** Mean score, share clean and count of a group of items. */
export interface GroupSummary {
  readonly items: number;
  readonly soiled: number;
  readonly meanScore: number;
  readonly clean: number;
  /** Items at each score 0 to 5. */
  readonly histogram: readonly number[];
}

/** What is left of one soil over the whole load. */
export interface SoilSummary {
  readonly type: string;
  readonly modelClass: string;
  readonly records: number;
  readonly initial_mg: number;
  readonly residual_mg: number;
  /** Mean IEC score and clean count of the items that carry it. */
  readonly meanScore: number;
  readonly clean: number;
  /** Median visibly soiled area of those items, mm2, and the largest. */
  readonly medianVisibleMm2: number;
  readonly maxVisibleMm2: number;
}

/** The summary of one wash of a standard load. */
export interface WashSummary {
  readonly programme: string;
  readonly tier: string;
  readonly items: number;
  readonly all: GroupSummary;
  readonly soiledOnly: GroupSummary;
  readonly byClass: Readonly<Record<ItemClass, GroupSummary>>;
  readonly byType: Readonly<Record<string, GroupSummary>>;
  readonly bySoil: readonly SoilSummary[];
  readonly soil: { readonly initial_mg: number; readonly remaining_mg: number };
  readonly heldWater_mL: number;
  readonly detergent: { readonly dosed_g: number; readonly dissolved_g: number };
}

function groupOf(items: readonly ItemWashResult[]): GroupSummary {
  const histogram = [0, 0, 0, 0, 0, 0];
  let sum = 0;
  let clean = 0;
  let soiled = 0;
  for (const item of items) {
    const score = Math.max(0, Math.min(5, Math.round(item.score)));
    histogram[score] = (histogram[score] ?? 0) + 1;
    sum += item.score;
    if (item.clean) clean++;
    if (item.initialMass_mg > 0) soiled++;
  }
  return {
    items: items.length,
    soiled,
    meanScore: items.length > 0 ? sum / items.length : Number.NaN,
    clean,
    histogram,
  };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : 0.5 * ((sorted[mid - 1] as number) + (sorted[mid] as number));
}

/** Summarises a wash result by item class, item type and soil. */
export function summariseWash(result: WashResult): WashSummary {
  const byClassItems: Record<ItemClass, ItemWashResult[]> = {
    crockery: [],
    cutlery: [],
    glass: [],
    melamine: [],
    pots: [],
  };
  const byTypeItems = new Map<string, ItemWashResult[]>();
  const soils = new Map<
    string,
    { modelClass: string; initial: number; residual: number; items: ItemWashResult[]; n: number }
  >();
  for (const item of result.items) {
    const cls = itemClassOf(item.typeId);
    if (cls !== undefined) byClassItems[cls].push(item);
    const list = byTypeItems.get(item.typeId);
    if (list === undefined) byTypeItems.set(item.typeId, [item]);
    else list.push(item);
    for (const soil of item.soils) {
      let entry = soils.get(soil.type);
      if (entry === undefined) {
        entry = { modelClass: soil.modelClass, initial: 0, residual: 0, items: [], n: 0 };
        soils.set(soil.type, entry);
      }
      entry.initial += soil.initialMass_mg;
      entry.residual += soil.residualMass_mg;
      entry.n++;
      if (!entry.items.includes(item)) entry.items.push(item);
    }
  }
  const byClass = Object.fromEntries(
    ITEM_CLASSES.map((cls) => [cls, groupOf(byClassItems[cls])]),
  ) as Record<ItemClass, GroupSummary>;
  const byType: Record<string, GroupSummary> = {};
  for (const type of [...byTypeItems.keys()].sort()) {
    byType[type] = groupOf(byTypeItems.get(type) ?? []);
  }
  const bySoil: SoilSummary[] = [...soils.keys()].sort().map((type) => {
    const entry = soils.get(type) as NonNullable<ReturnType<typeof soils.get>>;
    const group = groupOf(entry.items);
    const areas = entry.items.map((i) => i.visibleAreaMm2);
    return {
      type,
      modelClass: entry.modelClass,
      records: entry.n,
      initial_mg: entry.initial,
      residual_mg: entry.residual,
      meanScore: group.meanScore,
      clean: group.clean,
      medianVisibleMm2: median(areas),
      maxVisibleMm2: areas.reduce((m, a) => Math.max(m, a), 0),
    };
  });
  return {
    programme: result.machine.programmeId,
    tier: result.provenance.tier,
    items: result.items.length,
    all: groupOf(result.items),
    soiledOnly: groupOf(result.items.filter((i) => i.initialMass_mg > 0)),
    byClass,
    byType,
    bySoil,
    soil: {
      initial_mg: result.machine.soil.initial_mg,
      remaining_mg: result.machine.soil.remaining_mg,
    },
    heldWater_mL: result.machine.heldWater_mL,
    detergent: result.machine.detergent,
  };
}

const f = (v: number, digits = 2): string => (Number.isFinite(v) ? v.toFixed(digits) : 'n/a');

/** A wash summary as lines of text (Markdown tables). */
export function formatSummary(summary: WashSummary, title: string): string {
  const lines: string[] = [];
  lines.push(`### ${title}`);
  lines.push('');
  lines.push(
    `${summary.programme}, tier ${summary.tier}: ${summary.items} items (${summary.all.soiled} soiled); mean score ${f(summary.all.meanScore)}; clean ${summary.all.clean} of ${summary.items} (${f((100 * summary.all.clean) / Math.max(summary.items, 1), 0)} %); soiled items clean ${summary.soiledOnly.clean} of ${summary.soiledOnly.items}; dry soil left ${f(summary.soil.remaining_mg / 1000)} of ${f(summary.soil.initial_mg / 1000)} g (${f((100 * summary.soil.remaining_mg) / Math.max(summary.soil.initial_mg, 1e-9), 1)} %); detergent ${f(summary.detergent.dissolved_g, 1)} of ${f(summary.detergent.dosed_g, 1)} g; water held ${f(summary.heldWater_mL, 0)} mL`,
  );
  lines.push('');
  lines.push('| Class | Items | Mean score | Clean | Scores 0,1,2,3,4,5 |');
  lines.push('|---|---|---|---|---|');
  for (const cls of ITEM_CLASSES) {
    const g = summary.byClass[cls];
    lines.push(
      `| ${cls} | ${g.items} | ${f(g.meanScore)} | ${g.clean} | ${g.histogram.join(', ')} |`,
    );
  }
  lines.push(
    `| all | ${summary.all.items} | ${f(summary.all.meanScore)} | ${summary.all.clean} | ${summary.all.histogram.join(', ')} |`,
  );
  lines.push('');
  lines.push(
    '| Soil | Class | Records | Left (mg of mg) | Left % | Mean score | Clean | Visible area median, max (mm2) |',
  );
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const s of summary.bySoil) {
    lines.push(
      `| ${s.type} | ${s.modelClass} | ${s.records} | ${f(s.residual_mg, 1)} of ${f(s.initial_mg, 1)} | ${f((100 * s.residual_mg) / Math.max(s.initial_mg, 1e-12), 1)} | ${f(s.meanScore)} | ${s.clean} of ${s.records} | ${f(s.medianVisibleMm2, 0)}, ${f(s.maxVisibleMm2, 0)} |`,
    );
  }
  lines.push('');
  lines.push('| Type | Items | Mean score | Clean | Scores 0,1,2,3,4,5 |');
  lines.push('|---|---|---|---|---|');
  for (const [type, g] of Object.entries(summary.byType)) {
    lines.push(
      `| ${type} | ${g.items} | ${f(g.meanScore)} | ${g.clean} | ${g.histogram.join(', ')} |`,
    );
  }
  return lines.join('\n');
}
