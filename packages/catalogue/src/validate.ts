/**
 * Validation of the whole catalogue: every check a data error could fail, as a function that
 * returns the list of problems it finds (empty for a sound catalogue). The package's tests run
 * it; a server can run it at start-up.
 */

import { isValidId, quantiseQuat, quatLength, radToDeg } from '@spotless/core';
import { partSelectorMatches } from '@spotless/geometry';
import {
  hasItemType,
  getItemType,
  instantiate,
  instantiateItemType,
  listItemTypes,
  partMaterialOf,
  poseQuaternion,
} from './catalogue.ts';
import { frictionPair } from './contact.ts';
import { listDetergents, listRinseAids } from './detergents.ts';
import {
  getMaterial,
  hasMaterial,
  listMaterials,
  WATER_DENSITY_60C,
  wettingClassOf,
} from './materials.ts';
import { looseParts, measureDimensionMm, MIN_JOINT_OVERLAP } from './shape-util.ts';
import { SOIL_APPEARANCES } from './soil-working.ts';
import { hasSoil, listSoils } from './soils.ts';
import { settlePose, staticStability } from './stability.ts';
import type { ItemInstance, ItemType, Material, SoilType } from './types.ts';
import { LIQUOR_CLASSES, PROVENANCE_TAGS, RACK_ZONES, SOIL_HEAT_HISTORIES } from './types.ts';

/** One problem found by {@link validateCatalogue}. */
export interface CatalogueIssue {
  /** Which table the problem is in. */
  readonly scope: 'material' | 'item' | 'soil' | 'detergent' | 'contact';
  /** Id of the record. */
  readonly id: string;
  /** What is wrong. */
  readonly message: string;
}

/** Largest difference accepted between a stated dimension and the geometry, millimetres. */
export const DIMENSION_TOLERANCE_MM = 2;
/** Largest relative difference accepted between a verified mass and the geometry's. */
export const VERIFIED_MASS_TOLERANCE = 0.15;
/**
 * Largest relative difference accepted between an estimated or recalled mass and the
 * geometry's: the uncertainty docs/research/items.md section 2.4 gives for such rows.
 */
export const ESTIMATED_MASS_TOLERANCE = 0.25;
/** How far the lowest point of an item may be from z = 0, millimetres. */
export const RESTING_PLANE_TOLERANCE_MM = 0.05;

/**
 * Tipping angle, degrees, from which a pose counts as steady on a flat surface: a pose that
 * stands at least this firmly must be marked free-standing. Below it a pose may be left to the
 * rack (a chopping board balanced on its edge is stable in statics and tips at 3 degrees).
 */
export const STEADY_POSE_MIN_TIP_DEG = 5;

/**
 * How far an item may turn, degrees, when it is released in a free-standing pose as the
 * platform's input quantisation leaves it (quaternion components to 1e-4, an error of up to
 * about 0.01 degrees) and comes to rest.
 */
export const QUANTISED_POSE_SLACK_DEG = 0.05;

/** Rack materials every item material must have a friction pair with. */
export const RACK_MATERIALS: readonly string[] = ['rack_wire_pa11', 'rack_wire_pvc'];

function unique(
  ids: readonly string[],
  scope: CatalogueIssue['scope'],
  out: CatalogueIssue[],
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!isValidId(id)) out.push({ scope, id, message: 'malformed id' });
    if (seen.has(id)) out.push({ scope, id, message: 'duplicate id' });
    seen.add(id);
  }
}

function checkMaterial(m: Material, out: CatalogueIssue[]): void {
  const bad = (message: string): void => {
    out.push({ scope: 'material', id: m.id, message });
  };
  if (!(m.density.value > 0)) bad('density must be positive');
  if (!(m.thermal.conductivity.value > 0)) bad('conductivity must be positive');
  if (!(m.thermal.specificHeat.value > 0)) bad('specific heat must be positive');
  for (const sourced of [m.density, m.thermal.conductivity, m.thermal.specificHeat]) {
    if (!PROVENANCE_TAGS.includes(sourced.tag)) bad('unknown provenance tag');
    if (sourced.range !== undefined) {
      const [lo, hi] = sourced.range;
      if (!(lo <= sourced.value && sourced.value <= hi)) bad('value outside its own range');
    }
  }
  for (const liquor of LIQUOR_CLASSES) {
    const a = m.wetting.angles[liquor];
    if (!(a.recedingDeg >= 0 && a.recedingDeg <= a.advancingDeg && a.advancingDeg <= 180)) {
      bad(`contact angles in ${liquor} must satisfy 0 <= receding <= advancing <= 180`);
    }
  }
  if (m.wetting.class !== wettingClassOf(m.wetting.angles)) {
    bad('wetting class disagrees with the contact angles');
  }
  if (m.floats !== m.density.value < WATER_DENSITY_60C) bad('floats flag disagrees with density');
}

function checkItem(type: ItemType, out: CatalogueIssue[]): ItemInstance | undefined {
  const bad = (message: string): void => {
    out.push({ scope: 'item', id: type.id, message });
  };
  for (const entry of type.materials) {
    if (!hasMaterial(entry.material)) bad(`unknown material '${entry.material}'`);
  }
  if (type.placement.zones.length === 0) bad('no placement zone');
  for (const zone of type.placement.zones) {
    if (!RACK_ZONES.includes(zone)) bad(`unknown zone '${zone}'`);
  }
  if (type.flags.topRackOnly && type.placement.zones.includes('lower_rack')) {
    bad('is top rack only but lists the lower rack among its usual zones');
  }
  if (!(type.mass.valueG > 0)) bad('stated mass must be positive');
  if (!(type.game.defaultPoints > 0)) bad('default points must be positive');
  if (type.dimensions.length === 0) bad('no stated dimension');
  const dimNames = new Set<string>();
  for (const d of type.dimensions) {
    if (dimNames.has(d.name)) bad(`dimension '${d.name}' stated twice`);
    dimNames.add(d.name);
    if (!(d.valueMm > 0)) bad(`dimension '${d.name}' must be positive`);
    if (d.rangeMm !== undefined && !(d.rangeMm[0] <= d.valueMm && d.valueMm <= d.rangeMm[1])) {
      bad(`dimension '${d.name}' is outside the range stated for it`);
    }
    if (d.measure === undefined && d.note === undefined) {
      bad(`dimension '${d.name}' is not measured and does not say why`);
    }
  }
  if (type.mass.rangeG !== undefined) {
    const [lo, hi] = type.mass.rangeG;
    if (!(lo <= type.mass.valueG && type.mass.valueG <= hi)) bad('stated mass outside its range');
  }

  let instance: ItemInstance;
  try {
    // A record of the catalogue comes from the cache; any other record is built afresh.
    instance =
      hasItemType(type.id) && getItemType(type.id) === type
        ? instantiate(type.id)
        : instantiateItemType(type);
  } catch (error) {
    bad(`does not expand: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  const { shape } = instance;

  // Materials: every part is covered by the item's list and agrees with the geometry.
  for (const part of shape.parts) {
    let listed: string;
    try {
      listed = partMaterialOf(type, part.id);
    } catch {
      bad(`part '${part.id}' has no entry in materials`);
      continue;
    }
    if (listed !== part.material) {
      bad(`part '${part.id}' is '${part.material}' in the geometry but '${listed}' in materials`);
    }
    if (!hasMaterial(part.material))
      bad(`part '${part.id}' has unknown material '${part.material}'`);
  }
  for (const entry of type.materials) {
    const used = shape.parts.some((p) => partSelectorMatches(entry.part, p.id));
    if (!used) bad(`materials entry '${entry.part}' selects no part`);
  }

  // The item is in one piece: every part is joined to the rest by more than a touch.
  for (const loose of looseParts(shape)) {
    const [own, other] = loose.between;
    bad(
      `part '${loose.part}' is not joined to the rest of the item: ` +
        (loose.overlap > 0
          ? `'${own}' and '${other}' overlap by only ${(loose.overlap * 1000).toFixed(3)} mm`
          : `'${own}' and '${other}' are ${(-2 * loose.overlap * 1000).toFixed(2)} mm apart or merely touch`) +
        ` (a joint needs ${(MIN_JOINT_OVERLAP * 1000).toFixed(2)} mm)`,
    );
  }

  // The item rests on z = 0.
  if (Math.abs(instance.bbox.min[2]) * 1000 > RESTING_PLANE_TOLERANCE_MM) {
    bad(`lowest point is at z = ${(instance.bbox.min[2] * 1000).toFixed(3)} mm, not 0`);
  }

  // Stated dimensions.
  for (const d of type.dimensions) {
    if (d.measure === undefined) continue;
    let measured: number;
    try {
      measured = measureDimensionMm(shape, d.measure);
    } catch (error) {
      bad(`dimension '${d.name}': ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (Math.abs(measured - d.valueMm) > DIMENSION_TOLERANCE_MM) {
      bad(`dimension '${d.name}' is ${measured.toFixed(1)} mm, stated ${d.valueMm} mm`);
    }
  }

  // Mass.
  const grams = instance.mass.mass * 1000;
  if (!(grams > 0) || !Number.isFinite(grams)) bad('computed mass is not positive');
  const tolerance =
    type.mass.tag === 'VERIFIED' ? VERIFIED_MASS_TOLERANCE : ESTIMATED_MASS_TOLERANCE;
  if (Math.abs(grams / type.mass.valueG - 1) > tolerance) {
    bad(`computed mass ${grams.toFixed(1)} g, stated ${type.mass.valueG} g (${type.mass.tag})`);
  }
  if (type.mass.grossG !== undefined && grams > type.mass.grossG) {
    bad(`computed mass ${grams.toFixed(1)} g exceeds the gross figure ${type.mass.grossG} g`);
  }
  const inertia = instance.mass.inertia;
  if (!(inertia[0] > 0 && inertia[4] > 0 && inertia[8] > 0)) bad('inertia is not positive');

  // Regions.
  const shapeRegions = new Set(shape.regions.map((r) => r.id));
  const listedRegions = new Set(type.surfaceRegions.map((r) => r.id));
  if (listedRegions.size !== type.surfaceRegions.length) bad('surface region listed twice');
  for (const id of shapeRegions) {
    if (!listedRegions.has(id)) bad(`region '${id}' of the shape is not listed`);
  }
  for (const id of listedRegions) {
    if (!shapeRegions.has(id)) bad(`listed region '${id}' is not a region of the shape`);
    else if (!((instance.regionAreas[id] ?? 0) > 0)) bad(`region '${id}' has no area`);
  }

  // Typical soils.
  if (type.typicalSoils.length === 0) bad('no typical soil');
  for (const s of type.typicalSoils) {
    if (!listedRegions.has(s.region)) bad(`typical soil on unknown region '${s.region}'`);
    if (!hasSoil(s.soil)) bad(`typical soil '${s.soil}' is not in the catalogue`);
  }

  // Poses.
  const poses = type.placement.stablePoses;
  if (poses.length === 0) bad('no stable pose');
  const poseNames = new Set(poses.map((p) => p.name));
  if (poseNames.size !== poses.length) bad('pose name used twice');
  if (!poseNames.has(type.placement.recommendedPose)) {
    bad(`recommended pose '${type.placement.recommendedPose}' is not one of its poses`);
  }
  let freeStanding = 0;
  for (const pose of poses) {
    const q = poseQuaternion(pose);
    if (Math.abs(quatLength(q) - 1) > 1e-12) bad(`pose '${pose.name}' is not a unit rotation`);
    const s = staticStability(shape, instance.mass.com, q);
    if (pose.freeStanding) {
      freeStanding++;
      if (!s.stable) {
        bad(
          `pose '${pose.name}' is marked free-standing but a tilt of 0.25 degrees changes the height of its centre of mass by ${(s.probeRise * 1e6).toFixed(2)} micrometres`,
        );
      } else {
        // And at the precision the platform carries: an item released in the pose as the
        // input quantisation leaves it (platform.md section 2) must come to rest next to it.
        // (A unit quaternion always has a quantised form: null is for one without direction.)
        const settled = settlePose(shape, instance.mass.com, quantiseQuat(q) ?? q);
        const steady =
          settled.settled &&
          radToDeg(settled.rotation) <= QUANTISED_POSE_SLACK_DEG &&
          staticStability(shape, instance.mass.com, settled.q).stable;
        if (!steady) {
          bad(
            `pose '${pose.name}' is free-standing only at a precision the platform does not carry: released in the quantised pose, the item turns by ${radToDeg(settled.rotation).toFixed(3)} degrees${settled.settled ? '' : ' and is still falling'}`,
          );
        }
      }
    } else if (s.stable && radToDeg(s.tipAngle) >= STEADY_POSE_MIN_TIP_DEG) {
      bad(
        `pose '${pose.name}' is not marked free-standing but stands on a flat surface and tips only at ${radToDeg(s.tipAngle).toFixed(1)} degrees`,
      );
    }
  }
  if (freeStanding === 0) bad('no free-standing pose');

  // Flags that follow from the materials (an unknown body material is reported above).
  if (hasMaterial(instance.contact.material)) {
    const body = getMaterial(instance.contact.material);
    const brittle = body.family === 'ceramic' || body.family === 'glass';
    if (type.flags.fragile !== brittle) {
      bad(`fragile flag is ${String(type.flags.fragile)} but the body is ${body.family}`);
    }
  }
  const meanDensity = instance.mass.mass / instance.volume;
  if (type.flags.floats !== meanDensity < WATER_DENSITY_60C) {
    bad(
      `floats flag is ${String(type.flags.floats)} but the mean density is ${meanDensity.toFixed(0)} kg/m^3`,
    );
  }
  return instance;
}

function checkContact(materialsInUse: ReadonlySet<string>, out: CatalogueIssue[]): void {
  const ids = [...materialsInUse].sort();
  for (const a of ids) {
    for (const b of ids) {
      for (const wet of [false, true]) {
        const id = `${a} / ${b} (${wet ? 'wet' : 'dry'})`;
        try {
          const ab = frictionPair(a, b, wet);
          const ba = frictionPair(b, a, wet);
          if (ab.friction !== ba.friction || ab.restitution !== ba.restitution) {
            out.push({ scope: 'contact', id, message: 'lookup is not symmetric' });
          }
          if (!(ab.friction > 0 && Number.isFinite(ab.friction))) {
            out.push({ scope: 'contact', id, message: 'friction is not positive' });
          }
          if (!(ab.restitution >= 0 && ab.restitution <= 1)) {
            out.push({ scope: 'contact', id, message: 'restitution outside 0 to 1' });
          }
          if (!(ab.frictionRange[0] <= ab.friction && ab.friction <= ab.frictionRange[1])) {
            out.push({ scope: 'contact', id, message: 'friction outside its own range' });
          }
        } catch (error) {
          out.push({
            scope: 'contact',
            id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }
}

function checkSoil(s: SoilType, out: CatalogueIssue[]): void {
  const bad = (message: string): void => {
    out.push({ scope: 'soil', id: s.id, message });
  };
  if (s.heatHistories.length === 0) bad('no heat history');
  for (const h of s.heatHistories) {
    if (!SOIL_HEAT_HISTORIES.includes(h)) bad(`unknown heat history '${h}'`);
    if ((s.description.byHeat[h] ?? '').length === 0) bad(`no description for heat '${h}'`);
  }
  if (!s.description.aged.includes('{age}')) bad('aged description has no {age} placeholder');
  const { typicalGPerM2, rangeGPerM2, solidsFraction } = s.loading;
  if (!(rangeGPerM2[0] > 0 && rangeGPerM2[0] <= typicalGPerM2 && typicalGPerM2 <= rangeGPerM2[1])) {
    bad('typical loading is not inside a positive range');
  }
  if (solidsFraction !== null && !(solidsFraction > 0 && solidsFraction <= 1)) {
    bad('solids fraction outside 0 to 1');
  }
  const w = s.working;
  if (!(w.solidsFraction > 0 && w.solidsFraction <= 1))
    bad('working solids fraction outside 0 to 1');
  if (w.basis === 'dry' && w.solidsFraction !== 1) bad('a soil stated dry is all dry matter');
  if (!(w.rangeGPerM2[0] > 0 && w.rangeGPerM2[0] <= w.gPerM2 && w.gPerM2 <= w.rangeGPerM2[1])) {
    bad('working loading is not inside a positive range');
  }
  if (!(w.coverage > 0 && w.coverage <= 1)) bad('usual coverage outside 0 to 1');
  if (!s.heatHistories.includes(w.heatHistory)) {
    bad(`usual heat history '${w.heatHistory}' is not one of the soil's`);
  }
  if (!(w.ageH >= 0)) bad('usual age is negative');
  if (!SOIL_APPEARANCES.includes(w.appearance)) bad(`unknown appearance '${w.appearance}'`);
  if ((s.soilClass === 'STAIN') !== (w.appearance === 'stain')) {
    bad('the appearance stain goes with the class STAIN and with no other');
  }
  const { rank, range } = s.difficulty;
  if (!(Number.isInteger(rank) && rank >= 1 && rank <= 10)) bad('difficulty rank outside 1 to 10');
  if (!(range[0] >= 1 && range[0] <= rank && rank <= range[1] && range[1] <= 10)) {
    bad('difficulty rank outside its range');
  }
  if (s.typicalRegions.length === 0) bad('no typical region');
  if (s.patterns.length === 0) bad('no pattern');
  if (s.soilClass === 'STAIN' && s.loading.basis !== 'dry') bad('a stain is loaded as dry matter');
  if (s.secondaryClasses.includes(s.soilClass)) bad('primary class repeated as secondary');
}

function checkFormulations(out: CatalogueIssue[]): void {
  const detergents = listDetergents();
  const rinseAids = listRinseAids();
  unique([...detergents.map((d) => d.id), ...rinseAids.map((r) => r.id)], 'detergent', out);
  for (const f of [...detergents, ...rinseAids]) {
    const total = f.ingredients.reduce((sum, i) => sum + i.massPercent, 0);
    if (Math.abs(total - 100) > 1e-9) {
      out.push({
        scope: 'detergent',
        id: f.id,
        message: `ingredients add up to ${total.toFixed(3)} %, not 100`,
      });
    }
    for (const i of f.ingredients) {
      if (i.rangePercent !== undefined) {
        const [lo, hi] = i.rangePercent;
        if (!(lo <= i.massPercent && i.massPercent <= hi)) {
          out.push({
            scope: 'detergent',
            id: f.id,
            message: `'${i.name}' is outside the range stated for it`,
          });
        }
      }
    }
  }
}

/**
 * Checks one material record: positive properties, values inside their own ranges, contact
 * angles with `0 <= receding <= advancing <= 180` degrees in every liquor, and the wetting
 * class and the floats flag agreeing with the numbers. Returns the problems found.
 */
export function validateMaterial(material: Material): CatalogueIssue[] {
  const out: CatalogueIssue[] = [];
  checkMaterial(material, out);
  return out;
}

/**
 * Checks one item type record, which need not be in the catalogue, and returns the problems
 * found: see {@link validateCatalogue} for the list of checks on items.
 */
export function validateItemType(type: ItemType): CatalogueIssue[] {
  const out: CatalogueIssue[] = [];
  checkItem(type, out);
  return out;
}

/**
 * Checks one soil record: heat histories and their descriptions, a typical loading inside a
 * positive range, a difficulty rank of 1 to 10 inside its range, at least one region and one
 * pattern, and stains loaded as dry matter. Returns the problems found.
 */
export function validateSoilType(soil: SoilType): CatalogueIssue[] {
  const out: CatalogueIssue[] = [];
  checkSoil(soil, out);
  return out;
}

/**
 * Checks the whole catalogue and returns every problem found; an empty list means it is sound.
 *
 * Items: ids unique and well formed; the geometry expands and rests on z = 0; every part has a
 * known material that agrees with the item's material list; every stated dimension that names
 * a measurement is within {@link DIMENSION_TOLERANCE_MM}; the mass from geometry is within
 * {@link VERIFIED_MASS_TOLERANCE} of a verified mass ({@link ESTIMATED_MASS_TOLERANCE}
 * otherwise) and below any gross figure; listed regions are exactly the shape's and have area;
 * typical soils name existing regions and soils; poses are unit rotations with unique names,
 * the recommended pose exists, at least one pose is free-standing, every free-standing pose is
 * statically stable on a flat surface (`staticStability`) and no pose that tips only beyond
 * {@link STEADY_POSE_MIN_TIP_DEG} is left unmarked; `fragile` and `floats` agree with the
 * materials, and a top-rack-only item does not list the lower rack. Contact: the friction lookup is symmetric and defined, dry and wet, for every
 * pair of the materials in use and the rack materials. Soils, detergents and materials: ranges,
 * totals and tags are consistent.
 */
export function validateCatalogue(): CatalogueIssue[] {
  const out: CatalogueIssue[] = [];
  const materials = listMaterials();
  unique(
    materials.map((m) => m.id),
    'material',
    out,
  );
  for (const material of materials) checkMaterial(material, out);
  const types = listItemTypes();
  unique(
    types.map((t) => t.id),
    'item',
    out,
  );
  const inUse = new Set<string>(RACK_MATERIALS);
  for (const type of types) {
    const instance = checkItem(type, out);
    if (instance !== undefined) {
      for (const part of instance.shape.parts) inUse.add(part.material);
    }
  }
  checkContact(inUse, out);
  const soils = listSoils();
  unique(
    soils.map((s) => s.id),
    'soil',
    out,
  );
  for (const soil of soils) checkSoil(soil, out);
  checkFormulations(out);
  return out;
}
