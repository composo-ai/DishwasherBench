/**
 * Friction and restitution pair tables for dry loading and for wet washing, and the lookup the
 * physics package uses (docs/design/platform.md section 5: contact coefficients come from a
 * per-pair material table, never from per-body coefficients with a combine rule).
 *
 * Source: docs/research/items.md section 11. Every value there is an [ESTIMATED] synthesis of
 * the measured data of its sections 3.2 to 3.5; no source gives the friction of tableware on
 * coated rack wire, wet or dry, so the whole table is a calibration target.
 * - "Loading" (dry): room temperature, items dry to damp and lightly soiled.
 * - "Wash" (wet): fully wet with detergent solution at 50 to 65 degrees C.
 *
 * The dossier's tables do not cover every pair of surfaces. Pairs without a row use the nearest
 * row by the rules written next to `ITEM_PAIR_RULES`, and are marked `standIn`.
 */

import { getMaterial } from './materials.ts';
import type { ContactMaterialKey, ContactPair } from './types.ts';

/**
 * Speed of approach below which a contact has no restitution, m/s: 0.2, inside the range of
 * 0.05 to 0.3 that items.md sections 3.5 and 11.3 give [ESTIMATED] and above their default of
 * 0.1. The loading physics reads this constant, and 0.2 is the value its engine was measured
 * with [VERIFIED docs/research/spike-rigid-body.md]; at 0.1 the sixty-item mixed load overlapped
 * by 0.44 mm instead of 0.05 mm and twenty pieces of cutlery in a basket did not come to rest
 * [MEASURED, the integration and physics test suites].
 */
export const RESTITUTION_VELOCITY_THRESHOLD = 0.2;

/**
 * Rolling-resistance length on coated wire, metres: resisting moment = length x normal force.
 * [ESTIMATED] items.md section 3.6 (range 1e-4 to 5e-4).
 */
export const ROLLING_RESISTANCE_LENGTH_ON_WIRE = 2e-4;
/** Rolling-resistance length hard on hard, metres. [ESTIMATED] items.md section 3.6. */
export const ROLLING_RESISTANCE_LENGTH_HARD = 5e-5;
/**
 * Torsional (spin) friction length, metres. [ESTIMATED] items.md section 3.6 (range 0.5e-3 to
 * 3e-3).
 */
export const SPIN_FRICTION_LENGTH = 1.5e-3;

/** Factor on table 11.1 for a PVC-coated rack. [ESTIMATED] items.md section 11.1 heading. */
export const PVC_RACK_FRICTION_FACTOR = 1.5;

/** One state (loading or wash) of a row of table 11.1. */
interface WireFriction {
  readonly staticMu: number;
  readonly kineticMu: number;
  readonly range: readonly [number, number];
}

/** Contact keys of items (everything but the two rack-wire keys). */
type ItemKey = Exclude<ContactMaterialKey, 'rack_wire' | 'rack_wire_pvc'>;

/**
 * items.md table 11.1: item material against PA11-coated rack wire. Columns: loading static,
 * loading kinetic, loading range; wash static, wash kinetic, wash range.
 */
const WIRE_TABLE: Readonly<
  Record<
    ItemKey,
    { readonly row: string; readonly loading: WireFriction; readonly wash: WireFriction }
  >
> = {
  ceramic_glazed: {
    row: 'Glazed ceramic / porcelain',
    loading: { staticMu: 0.3, kineticMu: 0.25, range: [0.2, 0.4] },
    wash: { staticMu: 0.2, kineticMu: 0.15, range: [0.1, 0.3] },
  },
  ceramic_unglazed: {
    row: 'Unglazed foot ring',
    loading: { staticMu: 0.5, kineticMu: 0.42, range: [0.35, 0.65] },
    wash: { staticMu: 0.4, kineticMu: 0.33, range: [0.25, 0.55] },
  },
  glass: {
    row: 'Glass (soda-lime, Vitrelle, borosilicate, crystal)',
    loading: { staticMu: 0.25, kineticMu: 0.2, range: [0.15, 0.35] },
    wash: { staticMu: 0.18, kineticMu: 0.13, range: [0.08, 0.28] },
  },
  stainless_steel: {
    row: 'Stainless steel',
    loading: { staticMu: 0.28, kineticMu: 0.22, range: [0.16, 0.4] },
    wash: { staticMu: 0.18, kineticMu: 0.14, range: [0.08, 0.28] },
  },
  aluminium: {
    row: 'Aluminium, bare or anodised',
    loading: { staticMu: 0.3, kineticMu: 0.25, range: [0.2, 0.45] },
    wash: { staticMu: 0.2, kineticMu: 0.15, range: [0.1, 0.3] },
  },
  ptfe: {
    row: 'PTFE non-stick coating',
    loading: { staticMu: 0.12, kineticMu: 0.1, range: [0.05, 0.2] },
    wash: { staticMu: 0.1, kineticMu: 0.08, range: [0.04, 0.18] },
  },
  cast_iron: {
    row: 'Cast iron, seasoned',
    loading: { staticMu: 0.35, kineticMu: 0.3, range: [0.25, 0.5] },
    wash: { staticMu: 0.25, kineticMu: 0.2, range: [0.15, 0.4] },
  },
  polyolefin: {
    row: 'PP / PE',
    loading: { staticMu: 0.25, kineticMu: 0.2, range: [0.15, 0.35] },
    wash: { staticMu: 0.2, kineticMu: 0.15, range: [0.08, 0.3] },
  },
  hard_plastic: {
    row: 'Tritan, SAN, PC, melamine',
    loading: { staticMu: 0.3, kineticMu: 0.25, range: [0.18, 0.4] },
    wash: { staticMu: 0.22, kineticMu: 0.16, range: [0.1, 0.3] },
  },
  wood: {
    row: 'Wood (beech, bamboo)',
    loading: { staticMu: 0.4, kineticMu: 0.3, range: [0.25, 0.55] },
    wash: { staticMu: 0.3, kineticMu: 0.25, range: [0.2, 0.45] },
  },
  silicone: {
    row: 'Silicone rubber',
    loading: { staticMu: 0.8, kineticMu: 0.7, range: [0.5, 1.2] },
    wash: { staticMu: 0.5, kineticMu: 0.4, range: [0.3, 0.8] },
  },
};

/** Class of a surface in items.md table 11.2 (item against item). */
type PairClass =
  'glaze' | 'unglazed' | 'glass' | 'steel' | 'plastic' | 'wood' | 'silicone' | 'ptfe';

/**
 * Table 11.2 has one metal row ("steel") and one plastic row. Aluminium and seasoned cast iron
 * use the steel rows and both plastic keys the plastic rows.
 */
const PAIR_CLASS: Readonly<Record<ItemKey, PairClass>> = {
  ceramic_glazed: 'glaze',
  ceramic_unglazed: 'unglazed',
  glass: 'glass',
  stainless_steel: 'steel',
  aluminium: 'steel',
  cast_iron: 'steel',
  ptfe: 'ptfe',
  polyolefin: 'plastic',
  hard_plastic: 'plastic',
  wood: 'wood',
  silicone: 'silicone',
};

/** One row of table 11.2: kinetic friction and its range, loading and wash. */
interface PairRow {
  readonly row: string;
  readonly loading: number;
  readonly loadingRange: readonly [number, number];
  readonly wash: number;
  readonly washRange: readonly [number, number];
}

const ROW_GLAZE_GLAZE: PairRow = {
  row: 'Glaze - glaze',
  loading: 0.22,
  loadingRange: [0.15, 0.35],
  wash: 0.13,
  washRange: [0.08, 0.25],
};
const ROW_UNGLAZED_GLAZE: PairRow = {
  row: 'Unglazed foot - glaze',
  loading: 0.4,
  loadingRange: [0.3, 0.6],
  wash: 0.3,
  washRange: [0.2, 0.5],
};
const ROW_GLASS_GLASS: PairRow = {
  row: 'Glass - glass',
  loading: 0.2,
  loadingRange: [0.1, 0.6],
  wash: 0.1,
  washRange: [0.09, 0.3],
};
const ROW_GLASS_CERAMIC: PairRow = {
  row: 'Glass - ceramic',
  loading: 0.2,
  loadingRange: [0.12, 0.3],
  wash: 0.12,
  washRange: [0.08, 0.25],
};
const ROW_STEEL_CERAMIC: PairRow = {
  row: 'Steel - ceramic',
  loading: 0.16,
  loadingRange: [0.1, 0.25],
  wash: 0.11,
  washRange: [0.07, 0.2],
};
const ROW_STEEL_GLASS: PairRow = {
  row: 'Steel - glass',
  loading: 0.16,
  loadingRange: [0.1, 0.3],
  wash: 0.11,
  washRange: [0.07, 0.25],
};
const ROW_STEEL_STEEL: PairRow = {
  row: 'Steel - steel (cutlery in basket)',
  loading: 0.25,
  loadingRange: [0.15, 0.6],
  wash: 0.15,
  washRange: [0.1, 0.3],
};
const ROW_PLASTIC_HARD: PairRow = {
  row: 'Plastic - ceramic / glass / steel',
  loading: 0.25,
  loadingRange: [0.15, 0.35],
  wash: 0.15,
  washRange: [0.08, 0.3],
};
const ROW_PLASTIC_PLASTIC: PairRow = {
  row: 'Plastic - plastic',
  loading: 0.22,
  loadingRange: [0.15, 0.5],
  wash: 0.14,
  washRange: [0.08, 0.3],
};
const ROW_WOOD: PairRow = {
  row: 'Wood - hard surface',
  loading: 0.3,
  loadingRange: [0.2, 0.55],
  wash: 0.25,
  washRange: [0.2, 0.45],
};
const ROW_SILICONE: PairRow = {
  row: 'Silicone - anything',
  loading: 0.7,
  loadingRange: [0.5, 1.2],
  wash: 0.4,
  washRange: [0.3, 0.8],
};
const ROW_PTFE: PairRow = {
  row: 'PTFE-coated - anything',
  loading: 0.1,
  loadingRange: [0.05, 0.2],
  wash: 0.08,
  washRange: [0.04, 0.18],
};

/** Rows of table 11.2 for pairs of the four hard classes, keyed `a|b` with a <= b. */
const HARD_PAIR_ROWS: Readonly<Record<string, PairRow>> = {
  'glaze|glaze': ROW_GLAZE_GLAZE,
  'glass|glass': ROW_GLASS_GLASS,
  'glass|glaze': ROW_GLASS_CERAMIC,
  'glaze|steel': ROW_STEEL_CERAMIC,
  'glass|steel': ROW_STEEL_GLASS,
  'steel|steel': ROW_STEEL_STEEL,
  'glaze|plastic': ROW_PLASTIC_HARD,
  'glass|plastic': ROW_PLASTIC_HARD,
  'plastic|steel': ROW_PLASTIC_HARD,
  'plastic|plastic': ROW_PLASTIC_PLASTIC,
};

/**
 * Row of table 11.2 for two item surfaces. Rules, applied in this order:
 * 1. a PTFE-coated surface against anything: the PTFE row (also against silicone, where the two
 *    "anything" rows conflict: the low-energy coating is taken to govern);
 * 2. silicone against anything else: the silicone row;
 * 3. wood against anything else: the "wood - hard surface" row (a stand-in when the other side
 *    is wood too);
 * 4. an unglazed foot against anything else: the "unglazed foot - glaze" row (a stand-in unless
 *    the other side is glaze);
 * 5. the rows for glaze, glass, steel and plastic among themselves.
 * A row is a stand-in also when one of the surfaces is aluminium or cast iron, for which the
 * table has no row and the steel rows are used.
 */
function itemPairRow(a: ItemKey, b: ItemKey): { readonly row: PairRow; readonly standIn: boolean } {
  const ca = PAIR_CLASS[a];
  const cb = PAIR_CLASS[b];
  const metalStandIn =
    a === 'aluminium' || a === 'cast_iron' || b === 'aluminium' || b === 'cast_iron';
  if (ca === 'ptfe' || cb === 'ptfe') return { row: ROW_PTFE, standIn: false };
  if (ca === 'silicone' || cb === 'silicone') return { row: ROW_SILICONE, standIn: false };
  if (ca === 'wood' || cb === 'wood') {
    return { row: ROW_WOOD, standIn: ca === cb };
  }
  if (ca === 'unglazed' || cb === 'unglazed') {
    const other = ca === 'unglazed' ? cb : ca;
    return { row: ROW_UNGLAZED_GLAZE, standIn: other !== 'glaze' };
  }
  const key = ca < cb ? `${ca}|${cb}` : `${cb}|${ca}`;
  const row = HARD_PAIR_ROWS[key];
  if (row === undefined) throw new Error(`catalogue: no friction row for '${key}'`);
  return { row, standIn: metalStandIn };
}

/**
 * Restitution of an item against coated wire, by pair class. [ESTIMATED] items.md sections 3.5
 * and 11.3: 0.25 ceramic, 0.30 glass and steel, 0.35 plastic, 0.40 wood and silicone.
 */
const RESTITUTION_ON_WIRE: Readonly<Record<PairClass, number>> = {
  glaze: 0.25,
  unglazed: 0.25,
  glass: 0.3,
  steel: 0.3,
  ptfe: 0.3,
  plastic: 0.35,
  wood: 0.4,
  silicone: 0.4,
};

/**
 * Restitution of like on like, item against item. [ESTIMATED] items.md sections 3.5 and 11.3:
 * 0.50 ceramic, 0.60 glass, 0.45 steel, 0.40 wood and silicone. The dossier gives no value for
 * plastic on plastic; 0.40 (its value for the other soft materials) is used. A PTFE-coated item
 * is a metal item.
 */
const RESTITUTION_LIKE: Readonly<Record<PairClass, number>> = {
  glaze: 0.5,
  unglazed: 0.5,
  glass: 0.6,
  steel: 0.45,
  ptfe: 0.45,
  plastic: 0.4,
  wood: 0.4,
  silicone: 0.4,
};

/**
 * Friction of coated wire on coated wire (racks and baskets against each other, which only
 * matters when a lookup has to be total). [ESTIMATED] middle of the verified handbook range for
 * nylon on nylon, 0.15 to 0.25 (items.md section 3.3).
 */
const WIRE_ON_WIRE: PairRow = {
  row: 'nylon - nylon (items.md 3.3)',
  loading: 0.2,
  loadingRange: [0.15, 0.25],
  wash: 0.2,
  washRange: [0.15, 0.25],
};

function isWire(key: ContactMaterialKey): key is 'rack_wire' | 'rack_wire_pvc' {
  return key === 'rack_wire' || key === 'rack_wire_pvc';
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/**
 * Friction and restitution of a pair of contact keys (see {@link frictionPair}, which takes
 * material ids). Symmetric in its first two arguments.
 */
export function contactKeyPair(
  a: ContactMaterialKey,
  b: ContactMaterialKey,
  wet: boolean,
): ContactPair {
  if (isWire(a) && isWire(b)) {
    const factor =
      (a === 'rack_wire_pvc' ? PVC_RACK_FRICTION_FACTOR : 1) *
      (b === 'rack_wire_pvc' ? PVC_RACK_FRICTION_FACTOR : 1);
    const mu = wet ? WIRE_ON_WIRE.wash : WIRE_ON_WIRE.loading;
    const range = wet ? WIRE_ON_WIRE.washRange : WIRE_ON_WIRE.loadingRange;
    return {
      friction: round3(mu * factor),
      staticFriction: null,
      restitution: RESTITUTION_ON_WIRE.plastic,
      frictionRange: [round3(range[0] * factor), round3(range[1] * factor)],
      tag: 'ESTIMATED',
      source: `items.md 3.3: ${WIRE_ON_WIRE.row}${factor === 1 ? '' : `, x ${factor} for PVC`}`,
      standIn: true,
    };
  }
  if (isWire(a) || isWire(b)) {
    const wire = isWire(a) ? a : b;
    const item = (isWire(a) ? b : a) as ItemKey;
    const entry = WIRE_TABLE[item];
    const state = wet ? entry.wash : entry.loading;
    const factor = wire === 'rack_wire_pvc' ? PVC_RACK_FRICTION_FACTOR : 1;
    return {
      friction: round3(state.kineticMu * factor),
      staticFriction: round3(state.staticMu * factor),
      restitution: RESTITUTION_ON_WIRE[PAIR_CLASS[item]],
      frictionRange: [round3(state.range[0] * factor), round3(state.range[1] * factor)],
      tag: 'ESTIMATED',
      source:
        `items.md 11.1, row "${entry.row}", ${wet ? 'wash' : 'loading'}` +
        (factor === 1 ? '' : `, x ${factor} for a PVC-coated rack`),
      standIn: false,
    };
  }
  const { row, standIn } = itemPairRow(a, b);
  const ca = PAIR_CLASS[a];
  const cb = PAIR_CLASS[b];
  return {
    friction: wet ? row.wash : row.loading,
    staticFriction: null,
    // The more dissipative partner governs: the lower of the two like-on-like values.
    restitution: Math.min(RESTITUTION_LIKE[ca], RESTITUTION_LIKE[cb]),
    frictionRange: wet ? row.washRange : row.loadingRange,
    tag: 'ESTIMATED',
    source: `items.md 11.2, row "${row.row}", ${wet ? 'wash' : 'loading'}`,
    standIn,
  };
}

/**
 * Friction and restitution of two catalogue materials in contact: `wet = false` for loading
 * (dry to damp, room temperature), `wet = true` for the wash (wet with detergent solution at
 * 50 to 65 degrees C). Symmetric in `a` and `b`, pure, and defined for every pair of catalogue
 * materials. Throws a RangeError for an unknown material id.
 *
 * The result has the `friction` and `restitution` fields of the physics package's
 * `ContactPairProperties`. Restitution is the same in both states: the dossier gives one value.
 */
export function frictionPair(a: string, b: string, wet: boolean): ContactPair {
  return contactKeyPair(getMaterial(a).contactKey, getMaterial(b).contactKey, wet);
}

/**
 * Rolling-resistance length of two catalogue materials in contact, metres (items.md section
 * 3.6): {@link ROLLING_RESISTANCE_LENGTH_ON_WIRE} when either is a coated rack wire, whose
 * polymer layer deforms under the item, and {@link ROLLING_RESISTANCE_LENGTH_HARD} for item on
 * item. The dossier gives one value for both states, dry and wet. [ESTIMATED]
 */
export function rollingResistanceLength(a: string, b: string): number {
  return isWire(getMaterial(a).contactKey) || isWire(getMaterial(b).contactKey)
    ? ROLLING_RESISTANCE_LENGTH_ON_WIRE
    : ROLLING_RESISTANCE_LENGTH_HARD;
}

/**
 * The pair lookup the physics world takes (`PhysicsWorldOptions.pairLookup`), with the wet or
 * dry state already chosen: friction and restitution from {@link frictionPair}, the rolling
 * resistance length from {@link rollingResistanceLength} and the spin friction length
 * {@link SPIN_FRICTION_LENGTH} for every pair (metres, items.md section 3.6).
 */
export function contactPairLookup(wet: boolean): (
  materialA: string,
  materialB: string,
) => {
  readonly friction: number;
  readonly restitution: number;
  readonly rollingResistance: number;
  readonly spinResistance: number;
} {
  return (materialA, materialB) => {
    const pair = frictionPair(materialA, materialB, wet);
    return {
      friction: pair.friction,
      restitution: pair.restitution,
      rollingResistance: rollingResistanceLength(materialA, materialB),
      spinResistance: SPIN_FRICTION_LENGTH,
    };
  };
}
