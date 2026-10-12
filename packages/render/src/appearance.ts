/**
 * How materials and soils look. Pure data and lookups, no Three.js: the same tables serve the
 * interactive client, thumbnails and (later) images rendered for agents.
 *
 * A material must read as what it is (glazed ceramic, glass, stainless steel, plastic) and a
 * soil must be visible where the level says it is, because the player decides from what is
 * seen. Nothing here depends on how hard a soil is to remove.
 */

import type { MaterialAppearance, Rgb, SoilAppearance } from './types.ts';

function material(
  label: string,
  colour: Rgb,
  metalness: number,
  roughness: number,
  opacity = 1,
  envIntensity = 1,
): MaterialAppearance {
  return { label, colour, metalness, roughness, opacity, envIntensity };
}

/** Appearance of every catalogue material, by id. */
export const MATERIAL_APPEARANCES: { readonly [materialId: string]: MaterialAppearance } = {
  porcelain_glazed: material('glazed ceramic', [0.95, 0.95, 0.93], 0, 0.16, 1, 0.9),
  porcelain_unglazed: material('unglazed ceramic', [0.9, 0.88, 0.84], 0, 0.85, 1, 0.3),
  stoneware_glazed: material('glazed stoneware', [0.78, 0.8, 0.76], 0, 0.28, 1, 0.8),
  stoneware_unglazed: material('unglazed stoneware', [0.72, 0.66, 0.58], 0, 0.9, 1, 0.3),
  glass_soda_lime: material('glass', [0.82, 0.93, 0.95], 0, 0.04, 0.32, 1.6),
  glass_borosilicate: material('glass', [0.88, 0.94, 0.96], 0, 0.04, 0.3, 1.6),
  glass_vitrelle: material('opal glass', [0.97, 0.97, 0.96], 0, 0.1, 1, 1),
  crystal_lead_free: material('crystal glass', [0.9, 0.95, 0.97], 0, 0.02, 0.26, 1.9),
  crystal_lead: material('crystal glass', [0.9, 0.95, 0.97], 0, 0.02, 0.26, 1.9),
  // Steel is drawn part metal, part bright grey: a pure mirror shows only what is around it, and
  // cutlery standing in the dark of the cutlery basket came out black with banding.
  stainless_steel: material('stainless steel', [0.82, 0.83, 0.85], 0.55, 0.3, 1, 1.25),
  stainless_clad: material('stainless steel', [0.8, 0.81, 0.83], 0.55, 0.32, 1, 1.25),
  stainless_encapsulated_base: material('stainless steel', [0.76, 0.77, 0.79], 0.55, 0.36, 1, 1.2),
  stainless_double_wall: material('stainless steel', [0.82, 0.83, 0.85], 0.55, 0.32, 1, 1.2),
  carbon_steel: material('carbon steel', [0.3, 0.3, 0.31], 0.9, 0.5, 1, 0.8),
  carbon_steel_nonstick: material('non-stick steel', [0.12, 0.12, 0.13], 0.3, 0.55, 1, 0.5),
  cast_iron_seasoned: material('cast iron', [0.09, 0.09, 0.09], 0.4, 0.8, 1, 0.4),
  aluminium: material('aluminium', [0.82, 0.83, 0.84], 1, 0.42, 1, 1),
  aluminium_nonstick: material('non-stick aluminium', [0.14, 0.14, 0.15], 0.3, 0.55, 1, 0.5),
  polypropylene: material('plastic', [0.36, 0.52, 0.72], 0, 0.55, 1, 0.5),
  polyethylene: material('plastic', [0.9, 0.9, 0.86], 0, 0.6, 1, 0.4),
  nylon: material('plastic', [0.13, 0.13, 0.14], 0, 0.5, 1, 0.4),
  tritan: material('clear plastic', [0.8, 0.9, 0.96], 0, 0.12, 0.4, 1.2),
  san: material('clear plastic', [0.86, 0.92, 0.94], 0, 0.12, 0.42, 1.2),
  melamine: material('melamine', [0.93, 0.82, 0.55], 0, 0.35, 1, 0.6),
  silicone: material('silicone', [0.8, 0.26, 0.24], 0, 0.75, 1, 0.3),
  tpe: material('soft plastic', [0.2, 0.2, 0.22], 0, 0.8, 1, 0.3),
  beech: material('wood', [0.78, 0.6, 0.4], 0, 0.75, 1, 0.3),
  bamboo: material('wood', [0.82, 0.68, 0.44], 0, 0.7, 1, 0.3),
  rack_wire_pa11: material('coated wire', [0.5, 0.53, 0.57], 0, 0.45, 1, 0.6),
  rack_wire_pvc: material('coated wire', [0.86, 0.86, 0.84], 0, 0.5, 1, 0.5),
};

/** Shown for a material this table does not know: a neutral plastic. */
export const FALLBACK_MATERIAL: MaterialAppearance = material(
  'unknown material',
  [0.6, 0.6, 0.6],
  0,
  0.6,
);

/** Appearance of a catalogue material; a neutral grey when the id is unknown. */
export function materialAppearance(materialId: string): MaterialAppearance {
  return MATERIAL_APPEARANCES[materialId] ?? FALLBACK_MATERIAL;
}

/** True when the table knows the material. */
export function hasMaterialAppearance(materialId: string): boolean {
  return MATERIAL_APPEARANCES[materialId] !== undefined;
}

/**
 * Appearance of machine parts, which are drawn by what they are and not only by material: the
 * owner's machine has a stainless tub, grey coated baskets, grey plastic fittings, a darker
 * grey cutlery basket and grey spray arms.
 */
export function machinePartAppearance(
  partId: string,
  role: string,
  materialId: string,
): MaterialAppearance {
  if (partId === 'filter' && materialId === 'stainless_steel') {
    // The perforated sheet over the sump: duller and darker than the tub floor round it
    // (IMG_9082), so that the filter can be told from the floor.
    return material('stainless steel', [0.56, 0.57, 0.59], 0.6, 0.5, 1, 0.8);
  }
  if (materialId === 'stainless_steel') {
    // Brushed sheet: rougher than cutlery so that the tub does not mirror the whole load.
    return material('stainless steel', [0.8, 0.81, 0.83], 1, 0.38, 1, 1.3);
  }
  if (materialId === 'rack_wire_pa11' || materialId === 'rack_wire_pvc') {
    return materialAppearance(materialId);
  }
  if (role === 'arm' || partId.includes('arm')) {
    return material('plastic', [0.47, 0.49, 0.52], 0, 0.5, 1, 0.5);
  }
  if (partId === 'cutlery_basket') return material('plastic', [0.42, 0.45, 0.49], 0, 0.6, 1, 0.4);
  if (partId.includes('tablet_tray')) {
    return material('plastic', [0.58, 0.6, 0.63], 0, 0.5, 1, 0.5);
  }
  if (partId === 'dispenser') return material('plastic', [0.88, 0.89, 0.9], 0, 0.45, 1, 0.5);
  if (partId === 'filter') return material('plastic', [0.55, 0.57, 0.6], 0.3, 0.5, 1, 0.6);
  // Shelves, handles, wheels, the feed duct: the mid grey of the owner's machine (IMG_9083,
  // IMG_9131). They were drawn near white, and a shelf could not be told from the tub in a
  // plan view.
  return material('plastic', [0.54, 0.56, 0.59], 0, 0.55, 1, 0.5);
}

function soil(
  colour: Rgb,
  frequency: number,
  opacity: number,
  roughness: number,
  softness: number,
): SoilAppearance {
  return { colour, frequency, opacity, roughness, softness };
}

// Pattern families. Frequencies are features per metre: a smear has patches a few centimetres
// across, specks a few millimetres.
const SMEAR = { frequency: 38, softness: 0.22 };
const FILM = { frequency: 22, softness: 0.6 };
const SPECKS = { frequency: 260, softness: 0.08 };
const CRUST = { frequency: 70, softness: 0.1 };
const GREASE = { frequency: 30, softness: 0.4 };

/**
 * Soil appearances by rule: the first rule whose pattern is found in the soil id applies, so
 * that the laboratory soils (`iec_egg_yolk`, `aham_oatmeal`) look like their kitchen
 * counterparts and a soil added to the catalogue later still gets a sensible colour.
 */
const SOIL_RULES: readonly (readonly [RegExp, SoilAppearance])[] = [
  [
    /burnt_carbon|carbonised/,
    soil([0.07, 0.05, 0.04], CRUST.frequency, 0.97, 0.95, CRUST.softness),
  ],
  [/burnt_sugar/, soil([0.16, 0.08, 0.03], CRUST.frequency, 0.95, 0.6, CRUST.softness)],
  [
    /milk_burnt|milk_microwaved|iec_milk/,
    soil([0.55, 0.36, 0.16], CRUST.frequency, 0.92, 0.85, 0.14),
  ],
  [/fat_polymerised/, soil([0.42, 0.24, 0.07], 45, 0.85, 0.45, 0.3)],
  [/cheese_baked/, soil([0.72, 0.42, 0.12], CRUST.frequency, 0.94, 0.7, 0.12)],
  [/creme_brulee/, soil([0.8, 0.58, 0.2], CRUST.frequency, 0.92, 0.6, 0.14)],
  [/egg_white/, soil([0.93, 0.9, 0.8], SMEAR.frequency, 0.75, 0.6, 0.3)],
  [/egg/, soil([0.93, 0.66, 0.08], SMEAR.frequency, 0.93, 0.7, SMEAR.softness)],
  [/milk_skin/, soil([0.86, 0.78, 0.56], SMEAR.frequency, 0.88, 0.75, 0.25)],
  [/milk|cream$|yoghurt/, soil([0.9, 0.85, 0.68], FILM.frequency, 0.88, 0.7, 0.3)],
  [/cheese/, soil([0.95, 0.74, 0.22], SMEAR.frequency, 0.92, 0.55, SMEAR.softness)],
  [/minced_meat|ground_beef/, soil([0.42, 0.24, 0.14], 150, 0.93, 0.9, 0.12)],
  [/gravy/, soil([0.45, 0.28, 0.12], SMEAR.frequency, 0.88, 0.5, 0.3)],
  [/porridge|oat|wheat_biscuit|cereal/, soil([0.8, 0.68, 0.48], 110, 0.92, 0.95, 0.14)],
  [/rice_grains/, soil([0.93, 0.87, 0.68], SPECKS.frequency, 0.95, 0.8, SPECKS.softness)],
  [/starch|pasta|potato|dough|batter|hummus|corn/, soil([0.9, 0.84, 0.66], 60, 0.85, 0.9, 0.25)],
  [/butter|margarine|lard|tallow/, soil([0.98, 0.88, 0.42], GREASE.frequency, 0.72, 0.18, 0.35)],
  [/vegetable_oil/, soil([0.93, 0.8, 0.25], GREASE.frequency, 0.5, 0.08, GREASE.softness)],
  [/mayonnaise/, soil([0.97, 0.93, 0.72], SMEAR.frequency, 0.88, 0.3, SMEAR.softness)],
  [/sugar_syrup/, soil([0.9, 0.75, 0.4], FILM.frequency, 0.55, 0.1, 0.4)],
  [/caramel/, soil([0.7, 0.4, 0.08], SMEAR.frequency, 0.88, 0.2, 0.25)],
  [/jam|raspberry/, soil([0.62, 0.05, 0.16], SMEAR.frequency, 0.9, 0.25, SMEAR.softness)],
  [/peanut_butter/, soil([0.66, 0.44, 0.2], SMEAR.frequency, 0.94, 0.7, SMEAR.softness)],
  [/chocolate/, soil([0.26, 0.13, 0.06], SMEAR.frequency, 0.94, 0.5, SMEAR.softness)],
  [/tea/, soil([0.6, 0.36, 0.14], FILM.frequency, 0.7, 0.5, FILM.softness)],
  [/coffee/, soil([0.33, 0.19, 0.08], FILM.frequency, 0.8, 0.5, 0.45)],
  [/red_wine/, soil([0.45, 0.05, 0.2], FILM.frequency, 0.75, 0.4, 0.45)],
  [/spinach/, soil([0.1, 0.33, 0.08], SPECKS.frequency, 0.95, 0.85, SPECKS.softness)],
  [/seeds/, soil([0.2, 0.15, 0.08], 340, 0.97, 0.8, 0.06)],
  [/tomato/, soil([0.78, 0.12, 0.05], SMEAR.frequency, 0.93, 0.5, SMEAR.softness)],
  [/curry/, soil([0.86, 0.56, 0.05], SMEAR.frequency, 0.93, 0.45, SMEAR.softness)],
  [/lipstick/, soil([0.8, 0.06, 0.24], 55, 0.95, 0.35, 0.15)],
  [/avocado/, soil([0.48, 0.58, 0.18], SMEAR.frequency, 0.92, 0.6, SMEAR.softness)],
  [/mustard/, soil([0.85, 0.68, 0.08], SMEAR.frequency, 0.93, 0.5, SMEAR.softness)],
];

/** Shown for a soil no rule matches: a mid brown smear. */
export const FALLBACK_SOIL: SoilAppearance = soil(
  [0.5, 0.34, 0.18],
  SMEAR.frequency,
  0.9,
  0.7,
  SMEAR.softness,
);

/** Appearance of a catalogue soil; a brown smear when no rule knows the id. */
export function soilAppearance(soilId: string): SoilAppearance {
  for (const [pattern, appearance] of SOIL_RULES) {
    if (pattern.test(soilId)) return appearance;
  }
  return FALLBACK_SOIL;
}

/** True when a rule knows the soil. */
export function hasSoilAppearance(soilId: string): boolean {
  return SOIL_RULES.some(([pattern]) => pattern.test(soilId));
}

/** An sRGB triple as a CSS colour, for legends and swatches. */
export function rgbToCss(colour: Rgb): string {
  const byte = (x: number): number => Math.max(0, Math.min(255, Math.round(x * 255)));
  return `rgb(${byte(colour[0])}, ${byte(colour[1])}, ${byte(colour[2])})`;
}
