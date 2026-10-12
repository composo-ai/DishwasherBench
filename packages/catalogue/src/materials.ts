/**
 * The material table: density, contact key, thermal properties, wetting and service limits of
 * every material an item part or a machine part can be made of.
 *
 * Sources. Densities: docs/research/items.md section 3.1. Thermal properties: docs/research/
 * films.md section 9.2 and docs/research/chemistry.md section 6.2 (handbook values, all
 * [RECALLED] there). Contact angles: films.md section 12.7 (all [ESTIMATED] defaults anchored
 * to the measured values of its section 2.3.1). Maximum service temperatures are in no dossier:
 * they are the catalogue engineer's handbook recollection, tagged [RECALLED] with that source,
 * and should be checked against datasheets before anything depends on them.
 *
 * Units: kg/m^3, W/(m K), J/(kg K), degrees, degrees Celsius.
 */

import type {
  ContactAngles,
  ContactMaterialKey,
  LiquorClass,
  Material,
  MaterialFamily,
  MaterialWetting,
  Provenance,
  Sourced,
  WettingClass,
} from './types.ts';

/**
 * Density of water at 60 degrees C, kg/m^3: a material less dense than this floats in the pooled
 * wash liquor. [RECALLED] items.md section 3.1 (998 at 20 degrees C, 983 at 60).
 */
export const WATER_DENSITY_60C = 983;

/** Receding angle in main-wash liquor up to which a film stays continuous, degrees. */
export const CONTINUOUS_FILM_MAX_RECEDING_MAIN_WASH_DEG = 10;
/** Receding angle in clean water up to which a material still counts as film-forming, degrees. */
export const CONTINUOUS_FILM_MAX_RECEDING_CLEAN_WATER_DEG = 20;
/** Receding angle in main-wash liquor above which a material is rivulet-prone, degrees. */
export const RIVULET_MIN_RECEDING_MAIN_WASH_DEG = 20;

/**
 * Wetting class implied by a set of contact angles: the rule of films.md section 12.6 (grid
 * levels by receding angle) and sim-core.md section 3.4 (film class S1 for a receding angle
 * above 10 degrees in main-wash liquor or above 20 degrees in clean water).
 */
export function wettingClassOf(angles: Readonly<Record<LiquorClass, ContactAngles>>): WettingClass {
  const mainWash = angles.main_wash.recedingDeg;
  if (mainWash > RIVULET_MIN_RECEDING_MAIN_WASH_DEG) return 'rivulet_prone';
  if (
    mainWash <= CONTINUOUS_FILM_MAX_RECEDING_MAIN_WASH_DEG &&
    angles.clean_water.recedingDeg <= CONTINUOUS_FILM_MAX_RECEDING_CLEAN_WATER_DEG
  ) {
    return 'continuous_film';
  }
  return 'partially_wetting';
}

/** A row of films.md table 12.7: advancing / receding angles in the three liquors, degrees. */
type WettingRow = readonly [
  cleanAdvancing: number,
  cleanReceding: number,
  washAdvancing: number,
  washReceding: number,
  rinseAdvancing: number,
  rinseReceding: number,
];

/** films.md table 12.7, transcribed. Every value is [ESTIMATED] there. */
const WETTING_ROWS = {
  'Soda-lime glass': [35, 10, 15, 3, 15, 3],
  'Borosilicate glass': [40, 15, 15, 3, 15, 3],
  'Glazed ceramic, porcelain': [45, 15, 20, 5, 20, 5],
  'Stainless steel': [80, 30, 45, 10, 55, 20],
  Polypropylene: [95, 60, 50, 25, 55, 25],
  Polyethylene: [96, 70, 45, 20, 50, 20],
  Melamine: [75, 40, 35, 10, 40, 12],
  SAN: [80, 50, 35, 10, 40, 12],
  'Copolyester (Tritan-type)': [80, 50, 30, 8, 35, 10],
  'PTFE non-stick coating': [110, 90, 70, 45, 72, 50],
  Silicone: [108, 80, 65, 40, 68, 45],
} as const satisfies Record<string, WettingRow>;

type WettingRowName = keyof typeof WETTING_ROWS;

/**
 * Wetting data from a row of films.md table 12.7. `standInFor` says why a material without a row
 * of its own borrows this one.
 */
function wetting(row: WettingRowName, standInFor?: string): MaterialWetting {
  const [ca, cr, wa, wr, ra, rr] = WETTING_ROWS[row];
  const angles: Record<LiquorClass, ContactAngles> = {
    clean_water: { advancingDeg: ca, recedingDeg: cr },
    main_wash: { advancingDeg: wa, recedingDeg: wr },
    rinse_aid: { advancingDeg: ra, recedingDeg: rr },
  };
  return {
    class: wettingClassOf(angles),
    angles,
    tag: 'ESTIMATED',
    source:
      standInFor === undefined
        ? `films.md 12.7, row "${row}"`
        : `films.md 12.7, row "${row}" used as a stand-in: ${standInFor}`,
    standIn: standInFor !== undefined,
  };
}

function sourced(
  value: number,
  tag: Provenance,
  source: string,
  range?: readonly [number, number],
): Sourced {
  return range === undefined ? { value, tag, source } : { value, tag, source, range };
}

const ITEMS_3_1 = 'items.md 3.1';
const FILMS_9_2 = 'films.md 9.2';
const CHEM_6_2 = 'chemistry.md 6.2';
/** Source of the service temperatures, which no dossier gives. */
const SERVICE_RECALL = 'catalogue engineer, handbook recollection (not in the dossiers)';

interface MaterialSpec {
  readonly id: string;
  readonly name: string;
  readonly family: MaterialFamily;
  readonly density: Sourced;
  readonly contactKey: ContactMaterialKey;
  readonly conductivity: Sourced;
  readonly specificHeat: Sourced;
  readonly wetting: MaterialWetting;
  readonly maxServiceTempC?: Sourced;
  readonly notes?: string;
}

function material(spec: MaterialSpec): Material {
  return {
    id: spec.id,
    name: spec.name,
    family: spec.family,
    density: spec.density,
    contactKey: spec.contactKey,
    thermal: { conductivity: spec.conductivity, specificHeat: spec.specificHeat },
    wetting: spec.wetting,
    maxServiceTempC: spec.maxServiceTempC ?? null,
    floats: spec.density.value < WATER_DENSITY_60C,
    ...(spec.notes === undefined ? {} : { notes: spec.notes }),
  };
}

// Thermal property sets shared by several materials.
const PORCELAIN_K = sourced(1.5, 'RECALLED', FILMS_9_2, [1.2, 1.8]);
const PORCELAIN_C = sourced(900, 'RECALLED', FILMS_9_2, [800, 1000]);
const STONEWARE_K = sourced(1.3, 'RECALLED', `${CHEM_6_2} (middle of 1.0 to 1.6)`, [1.0, 1.6]);
const STONEWARE_C = sourced(850, 'RECALLED', `${CHEM_6_2} (middle of 800 to 900)`, [800, 900]);
const SODA_LIME_K = sourced(1.0, 'RECALLED', FILMS_9_2);
const SODA_LIME_C = sourced(840, 'RECALLED', FILMS_9_2);
const STAINLESS_K = sourced(16.2, 'RECALLED', FILMS_9_2, [15, 16.2]);
const STAINLESS_C = sourced(500, 'RECALLED', FILMS_9_2);
const CAST_IRON_K = sourced(50, 'RECALLED', CHEM_6_2);
const CAST_IRON_C = sourced(460, 'RECALLED', CHEM_6_2);
const ALUMINIUM_K = sourced(160, 'RECALLED', `${CHEM_6_2} (middle of 120 to 200)`, [120, 200]);
const ALUMINIUM_C = sourced(900, 'RECALLED', FILMS_9_2);
const PP_K = sourced(0.22, 'RECALLED', FILMS_9_2, [0.2, 0.22]);
const PP_C = sourced(1900, 'RECALLED', FILMS_9_2, [1700, 2000]);
const BEECH_K = sourced(0.16, 'RECALLED', `${CHEM_6_2} (across the grain, dry)`, [0.15, 0.17]);
const BEECH_C = sourced(1700, 'RECALLED', `${CHEM_6_2} (dry; about 2400 when wet)`, [1700, 2400]);

/** The material table, in id order. */
export const MATERIALS: readonly Material[] = [
  // ---- ceramics ----
  material({
    id: 'porcelain_glazed',
    name: 'Porcelain, glazed',
    family: 'ceramic',
    density: sourced(2400, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox)`, [2300, 2500]),
    contactKey: 'ceramic_glazed',
    conductivity: PORCELAIN_K,
    specificHeat: PORCELAIN_C,
    wetting: wetting('Glazed ceramic, porcelain'),
  }),
  material({
    id: 'porcelain_unglazed',
    name: 'Porcelain, unglazed (foot ring)',
    family: 'ceramic',
    density: sourced(2400, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox)`, [2300, 2500]),
    contactKey: 'ceramic_unglazed',
    conductivity: PORCELAIN_K,
    specificHeat: PORCELAIN_C,
    wetting: wetting(
      'Glazed ceramic, porcelain',
      'no row for unglazed bisque, which is rougher and slightly porous',
    ),
  }),
  material({
    id: 'stoneware_glazed',
    name: 'Stoneware, glazed',
    family: 'ceramic',
    density: sourced(2300, 'RECALLED', ITEMS_3_1, [2100, 2400]),
    contactKey: 'ceramic_glazed',
    conductivity: STONEWARE_K,
    specificHeat: STONEWARE_C,
    wetting: wetting('Glazed ceramic, porcelain'),
  }),
  material({
    id: 'stoneware_unglazed',
    name: 'Stoneware, unglazed (foot ring)',
    family: 'ceramic',
    density: sourced(2300, 'RECALLED', ITEMS_3_1, [2100, 2400]),
    contactKey: 'ceramic_unglazed',
    conductivity: STONEWARE_K,
    specificHeat: STONEWARE_C,
    wetting: wetting(
      'Glazed ceramic, porcelain',
      'no row for unglazed bisque, which is rougher and slightly porous',
    ),
  }),

  // ---- glass ----
  material({
    id: 'glass_soda_lime',
    name: 'Soda-lime glass (also tempered and heat-treated)',
    family: 'glass',
    density: sourced(2500, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox)`, [2400, 2800]),
    contactKey: 'glass',
    conductivity: SODA_LIME_K,
    specificHeat: SODA_LIME_C,
    wetting: wetting('Soda-lime glass'),
  }),
  material({
    id: 'glass_borosilicate',
    name: 'Borosilicate glass',
    family: 'glass',
    density: sourced(2210, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox, "Glass, Pyrex")`),
    contactKey: 'glass',
    conductivity: sourced(1.14, 'RECALLED', FILMS_9_2),
    specificHeat: sourced(830, 'RECALLED', FILMS_9_2),
    wetting: wetting('Borosilicate glass'),
  }),
  material({
    id: 'glass_vitrelle',
    name: 'Vitrelle laminated glass (Corelle)',
    family: 'glass',
    density: sourced(2500, 'ESTIMATED', `${ITEMS_3_1} (treated as soda-lime-like)`),
    contactKey: 'glass',
    conductivity: SODA_LIME_K,
    specificHeat: SODA_LIME_C,
    wetting: wetting('Soda-lime glass', 'a laminate of soda-lime-like glasses'),
  }),
  material({
    id: 'crystal_lead_free',
    name: 'Lead-free crystal glass',
    family: 'glass',
    density: sourced(2550, 'ESTIMATED', `${ITEMS_3_1} (between soda-lime and lead crystal)`),
    contactKey: 'glass',
    conductivity: SODA_LIME_K,
    specificHeat: SODA_LIME_C,
    wetting: wetting('Soda-lime glass', 'no row for crystal glass'),
    notes: 'Thermal properties are those of soda-lime glass, for want of a dossier value.',
  }),
  material({
    id: 'crystal_lead',
    name: 'Lead crystal',
    family: 'glass',
    density: sourced(3100, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox)`),
    contactKey: 'glass',
    conductivity: SODA_LIME_K,
    specificHeat: SODA_LIME_C,
    wetting: wetting('Soda-lime glass', 'no row for crystal glass'),
    notes: 'Thermal properties are those of soda-lime glass, for want of a dossier value.',
  }),

  // ---- metals ----
  material({
    id: 'stainless_steel',
    name: 'Stainless steel 18/10',
    family: 'metal',
    density: sourced(7900, 'RECALLED', ITEMS_3_1, [7900, 8000]),
    contactKey: 'stainless_steel',
    conductivity: STAINLESS_K,
    specificHeat: STAINLESS_C,
    wetting: wetting('Stainless steel'),
  }),
  material({
    id: 'stainless_clad',
    name: 'Tri-ply clad steel (stainless, aluminium, stainless)',
    family: 'metal',
    density: sourced(
      5600,
      'ESTIMATED',
      'items.md 10.2 (density used for the clad frying pan profile)',
    ),
    contactKey: 'stainless_steel',
    // Volume share of steel f from 7900 f + 2700 (1 - f) = 5600: f = 0.558. Layers in series.
    conductivity: sourced(
      27,
      'ESTIMATED',
      'series conduction through 55.8 % steel (16.2) and 44.2 % aluminium (200) by thickness',
    ),
    specificHeat: sourced(
      585,
      'ESTIMATED',
      'mass-weighted mean of steel (500, 78.7 % of the mass) and aluminium (900)',
    ),
    wetting: wetting('Stainless steel'),
  }),
  material({
    id: 'stainless_encapsulated_base',
    name: 'Encapsulated disc base (aluminium disc in a stainless skin)',
    family: 'metal',
    density: sourced(
      3380,
      'ESTIMATED',
      'items.md 10.2 (disc of 4 mm aluminium and 0.6 mm steel): (4 x 2700 + 0.6 x 7900) / 4.6',
    ),
    contactKey: 'stainless_steel',
    conductivity: sourced(
      81,
      'ESTIMATED',
      'series conduction through 0.6 mm steel (16.2) and 4 mm aluminium (200)',
    ),
    specificHeat: sourced(
      778,
      'ESTIMATED',
      'mass-weighted mean of aluminium (900, 69.6 % of the mass) and steel (500)',
    ),
    wetting: wetting('Stainless steel'),
  }),
  material({
    id: 'stainless_double_wall',
    name: 'Double-wall vacuum stainless steel (travel mug body)',
    family: 'metal',
    density: sourced(
      790,
      'ESTIMATED',
      'effective density of a 7 mm wall made of two 0.35 mm steel skins and a sealed gap: 0.70 x 7900 / 7 = 790',
    ),
    contactKey: 'stainless_steel',
    conductivity: STAINLESS_K,
    specificHeat: STAINLESS_C,
    wetting: wetting('Stainless steel'),
    notes:
      'Conductivity and specific heat are those of the steel skins. The skins are thermally ' +
      'isolated from each other by the gap, so conduction through the wall is negligible.',
  }),
  material({
    id: 'carbon_steel',
    name: 'Carbon steel',
    family: 'metal',
    density: sourced(7820, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox)`),
    contactKey: 'stainless_steel',
    conductivity: sourced(50, 'ESTIMATED', `${CHEM_6_2}: cast-iron value used as a stand-in`),
    specificHeat: sourced(460, 'ESTIMATED', `${CHEM_6_2}: cast-iron value used as a stand-in`),
    wetting: wetting('Stainless steel', 'no row for carbon steel'),
    notes: 'Friction uses the stainless-steel rows: items.md section 11 has no carbon-steel row.',
  }),
  material({
    id: 'carbon_steel_nonstick',
    name: 'Carbon steel with a PTFE non-stick coating',
    family: 'metal',
    density: sourced(7820, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox)`),
    contactKey: 'ptfe',
    conductivity: sourced(50, 'ESTIMATED', `${CHEM_6_2}: cast-iron value used as a stand-in`),
    specificHeat: sourced(460, 'ESTIMATED', `${CHEM_6_2}: cast-iron value used as a stand-in`),
    wetting: wetting('PTFE non-stick coating'),
    maxServiceTempC: sourced(260, 'RECALLED', SERVICE_RECALL),
  }),
  material({
    id: 'cast_iron_seasoned',
    name: 'Cast iron, seasoned',
    family: 'metal',
    density: sourced(7200, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox)`, [7000, 7400]),
    contactKey: 'cast_iron',
    conductivity: CAST_IRON_K,
    specificHeat: CAST_IRON_C,
    wetting: wetting(
      'Stainless steel',
      'no row for seasoned cast iron; the polymerised-oil seasoning is probably less wettable',
    ),
  }),
  material({
    id: 'aluminium',
    name: 'Aluminium, bare or anodised',
    family: 'metal',
    density: sourced(2700, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox)`),
    contactKey: 'aluminium',
    conductivity: ALUMINIUM_K,
    specificHeat: ALUMINIUM_C,
    wetting: wetting(
      'Stainless steel',
      'no row for aluminium; films.md 2.3.1 quotes 35.8 to 56.8 degrees for a group of metals and glass',
    ),
  }),
  material({
    id: 'aluminium_nonstick',
    name: 'Aluminium with a PTFE non-stick coating',
    family: 'metal',
    density: sourced(2700, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox)`),
    contactKey: 'ptfe',
    conductivity: ALUMINIUM_K,
    specificHeat: ALUMINIUM_C,
    wetting: wetting('PTFE non-stick coating'),
    maxServiceTempC: sourced(260, 'RECALLED', SERVICE_RECALL),
  }),

  // ---- polymers ----
  material({
    id: 'polypropylene',
    name: 'Polypropylene',
    family: 'polymer',
    density: sourced(
      905,
      'VERIFIED',
      `${ITEMS_3_1} (Engineering Toolbox 910 to 940; use 905 to 920)`,
      [905, 940],
    ),
    contactKey: 'polyolefin',
    conductivity: PP_K,
    specificHeat: PP_C,
    wetting: wetting('Polypropylene'),
    maxServiceTempC: sourced(100, 'RECALLED', SERVICE_RECALL, [90, 110]),
  }),
  material({
    id: 'polyethylene',
    name: 'Polyethylene, high density',
    family: 'polymer',
    density: sourced(960, 'VERIFIED', `${ITEMS_3_1} (Engineering Toolbox, HDPE)`),
    contactKey: 'polyolefin',
    conductivity: sourced(0.48, 'RECALLED', FILMS_9_2, [0.45, 0.48]),
    specificHeat: sourced(1900, 'RECALLED', FILMS_9_2, [1900, 2300]),
    wetting: wetting('Polyethylene'),
    maxServiceTempC: sourced(80, 'RECALLED', SERVICE_RECALL, [70, 90]),
  }),
  material({
    id: 'nylon',
    name: 'Nylon (polyamide 6 or 6,6)',
    family: 'polymer',
    density: sourced(
      1140,
      'VERIFIED',
      `${ITEMS_3_1} (Engineering Toolbox 1120 to 1170)`,
      [1120, 1170],
    ),
    contactKey: 'hard_plastic',
    conductivity: sourced(0.25, 'RECALLED', `${CHEM_6_2} (polyamide utensils)`),
    specificHeat: sourced(1700, 'RECALLED', `${CHEM_6_2} (polyamide utensils)`),
    wetting: wetting('Melamine', 'no row for polyamide'),
    maxServiceTempC: sourced(150, 'RECALLED', SERVICE_RECALL, [120, 200]),
    notes: 'Friction uses the hard-plastic rows (Tritan, SAN, PC, melamine) of items.md 11.',
  }),
  material({
    id: 'tritan',
    name: 'Tritan copolyester',
    family: 'polymer',
    density: sourced(1180, 'RECALLED', ITEMS_3_1),
    contactKey: 'hard_plastic',
    conductivity: sourced(0.2, 'RECALLED', FILMS_9_2),
    specificHeat: sourced(1500, 'RECALLED', FILMS_9_2, [1200, 1500]),
    wetting: wetting('Copolyester (Tritan-type)'),
    maxServiceTempC: sourced(95, 'RECALLED', SERVICE_RECALL, [90, 109]),
  }),
  material({
    id: 'san',
    name: 'Styrene-acrylonitrile (SAN)',
    family: 'polymer',
    density: sourced(1080, 'RECALLED', FILMS_9_2, [1050, 1080]),
    contactKey: 'hard_plastic',
    conductivity: sourced(0.17, 'RECALLED', FILMS_9_2, [0.15, 0.17]),
    specificHeat: sourced(1350, 'RECALLED', FILMS_9_2, [1300, 1350]),
    wetting: wetting('SAN'),
    maxServiceTempC: sourced(90, 'RECALLED', SERVICE_RECALL, [85, 95]),
  }),
  material({
    id: 'melamine',
    name: 'Melamine-formaldehyde, cellulose filled',
    family: 'polymer',
    density: sourced(1500, 'RECALLED', ITEMS_3_1, [1450, 1550]),
    contactKey: 'hard_plastic',
    conductivity: sourced(0.45, 'RECALLED', FILMS_9_2, [0.4, 0.5]),
    specificHeat: sourced(1500, 'RECALLED', FILMS_9_2, [1200, 1700]),
    wetting: wetting('Melamine'),
    maxServiceTempC: sourced(70, 'RECALLED', SERVICE_RECALL, [70, 120]),
  }),
  material({
    id: 'silicone',
    name: 'Silicone rubber',
    family: 'elastomer',
    density: sourced(1150, 'RECALLED', ITEMS_3_1, [1100, 1200]),
    contactKey: 'silicone',
    conductivity: sourced(0.25, 'RECALLED', FILMS_9_2, [0.2, 0.3]),
    specificHeat: sourced(1250, 'RECALLED', FILMS_9_2, [1200, 1300]),
    wetting: wetting('Silicone'),
    maxServiceTempC: sourced(230, 'RECALLED', SERVICE_RECALL, [200, 250]),
  }),
  material({
    id: 'tpe',
    name: 'Thermoplastic elastomer (soft grips, spouts)',
    family: 'elastomer',
    density: sourced(950, 'RECALLED', SERVICE_RECALL, [900, 1100]),
    contactKey: 'silicone',
    conductivity: sourced(
      0.22,
      'ESTIMATED',
      `${FILMS_9_2}: polypropylene value used as a stand-in`,
    ),
    specificHeat: sourced(
      1900,
      'ESTIMATED',
      `${FILMS_9_2}: polypropylene value used as a stand-in`,
    ),
    wetting: wetting('Polypropylene', 'no row for thermoplastic elastomers'),
    maxServiceTempC: sourced(100, 'RECALLED', SERVICE_RECALL, [90, 120]),
    notes:
      'No dossier covers this material. Density is recalled, thermal properties and wetting are ' +
      'those of polypropylene, and friction uses the silicone-rubber rows of items.md 11.',
  }),

  // ---- wood ----
  material({
    id: 'beech',
    name: 'Beech wood',
    family: 'wood',
    density: sourced(700, 'ESTIMATED', `${ITEMS_3_1} (back-calculated from a board)`, [700, 720]),
    contactKey: 'wood',
    conductivity: BEECH_K,
    specificHeat: BEECH_C,
    wetting: wetting('Melamine', 'no row for wood, which also absorbs water'),
    notes: 'Not dishwasher-safe: swells, cracks and loses its finish.',
  }),
  material({
    id: 'bamboo',
    name: 'Bamboo',
    family: 'wood',
    density: sourced(700, 'RECALLED', `${ITEMS_3_1} (bamboo laminate 650 to 750)`, [650, 750]),
    contactKey: 'wood',
    conductivity: sourced(0.16, 'ESTIMATED', `${CHEM_6_2}: beech value used as a stand-in`),
    specificHeat: sourced(1700, 'ESTIMATED', `${CHEM_6_2}: beech value used as a stand-in`),
    wetting: wetting('Melamine', 'no row for wood, which also absorbs water'),
  }),

  // ---- machine parts ----
  material({
    id: 'rack_wire_pa11',
    name: 'Rack wire, steel with a nylon (PA11) coating',
    family: 'metal',
    density: sourced(
      7820,
      'VERIFIED',
      `${ITEMS_3_1}: carbon-steel wire; the coating itself is 1010 kg/m^3 (items.md 3.4, Arkema)`,
    ),
    contactKey: 'rack_wire',
    conductivity: sourced(50, 'ESTIMATED', `${CHEM_6_2}: cast-iron value used as a stand-in`),
    specificHeat: sourced(500, 'ESTIMATED', 'machine.md 6.2 (racks counted at 0.50 kJ/(kg K))'),
    wetting: wetting('Melamine', 'no row for polyamide'),
    maxServiceTempC: sourced(181, 'VERIFIED', 'items.md 3.4 (Vicat softening point, Arkema)'),
  }),
  material({
    id: 'rack_wire_pvc',
    name: 'Rack wire, steel with a PVC plastisol coating',
    family: 'metal',
    density: sourced(7820, 'VERIFIED', `${ITEMS_3_1}: carbon-steel wire`),
    contactKey: 'rack_wire_pvc',
    conductivity: sourced(50, 'ESTIMATED', `${CHEM_6_2}: cast-iron value used as a stand-in`),
    specificHeat: sourced(500, 'ESTIMATED', 'machine.md 6.2 (racks counted at 0.50 kJ/(kg K))'),
    wetting: wetting('SAN', 'no row for PVC'),
    maxServiceTempC: sourced(
      65,
      'RECALLED',
      'items.md 3.4 (softens further at 60 to 70 C)',
      [60, 70],
    ),
  }),
];

const BY_ID: ReadonlyMap<string, Material> = new Map(MATERIALS.map((m) => [m.id, m]));

/** True when the catalogue has a material with this id. */
export function hasMaterial(id: string): boolean {
  return BY_ID.has(id);
}

/**
 * The material with the given catalogue id. Throws a RangeError for an unknown id: material ids
 * come from catalogue data, never from players.
 */
export function getMaterial(id: string): Material {
  const found = BY_ID.get(id);
  if (found === undefined) throw new RangeError(`catalogue: unknown material '${id}'`);
  return found;
}

/** Every material, sorted by id. */
export function listMaterials(): readonly Material[] {
  return SORTED;
}

const SORTED: readonly Material[] = [...MATERIALS].sort((a, b) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
);

/** Density of a material in kg/m^3: a `DensityLookup` for the geometry kernel. */
export function materialDensity(id: string): number {
  return getMaterial(id).density.value;
}
