/**
 * `validateMachineSpec`: everything that can be checked about a machine description without
 * running a wash.
 *
 * - Identifiers: well-formed and unique where they must be.
 * - Provenance: every group of values is there (a part the machine may lack is null, never
 *   absent) and has a record with a known tag and a source, and every per-field tag names a
 *   field that exists.
 * - Geometry: the tub and door are consistent; every basket, at every height position, lies
 *   inside the tub and clear of the feed duct; baskets do not overlap one another; tines and
 *   floor wires lie inside their basket; no spray arm sweeps into a wall, the feed duct, a
 *   fixture on the floor, a basket or the cutlery basket; nozzles lie on their arm.
 * - Units and ranges: every angle is a plausible number of radians (a table left in degrees is
 *   reported), open fractions lie in (0, 1], flows, doses and delays are of a plausible size,
 *   and the height positions of a basket are listed highest first.
 * - Hydraulics and thermal: positive pump curve, areas, flows and heat capacities; every
 *   diverter position and pattern refers to something that exists and dwells longer than the
 *   diverter takes to move; every fed branch passes water at the rated pump speed; every arm
 *   turns the way it is declared to, at about the speed its friction was tuned to give.
 * - Programmes: every step is well formed, detergent is dosed in the main wash and rinse aid
 *   in the final rinse, and the expanded timeline adds up to what the programme declares
 *   (duration, mains water, energy), with no pump running dry, no tank over- or under-drawn,
 *   no target above the heater's cut-out and no dose left unreleased. The primary programme
 *   is held to the machine's nominal bath volumes.
 * - The default configuration is valid and agrees with the default states.
 *
 * It returns problems as values and never throws on a malformed description. What is wrong at
 * every height position of the adjustable baskets alike is reported once; what depends on the
 * position is reported with the position. Lengths in the messages are in millimetres. SI units
 * and platform frames throughout (`types.ts`).
 */

import { isValidId } from '@spotless/core';
import { armSteadyState } from './arm.ts';
import { basketHeightPosition, defaultsAsConfig, validateMachineConfig } from './config.ts';
import { cutleryBasketPlacementProblems } from './cutlery-placement.ts';
import { hydraulicOperatingPoint, sprayLevelCdA } from './hydraulics.ts';
import { basketSideRecessOver, floorReliefMax, floorReliefMin } from './outline.ts';
import type { MachineProblem } from './problems.ts';
import { problem, warning } from './problems.ts';
import { expandProgramme } from './programme.ts';
import type { ProgrammeSpec, ProgrammeStep } from './programme-types.ts';
import { PROGRAMME_PHASES } from './programme-types.ts';
import { isProvenanceTag } from './provenance.ts';
import type {
  BasketSpec,
  DiverterPatternSpec,
  MachineSpec,
  Range,
  SprayArmSpec,
  SprayLevelSpec,
} from './types.ts';

/** Clearance below which two parts are reported as touching, metres (0.05 mm). */
const TOUCH_TOLERANCE = 5e-5;

/** Relative tolerance between a branch's stated sum of C_d A and the sum over its nozzles. */
const CDA_TOLERANCE = 0.01;

/** Largest plausible wash or rinse target, degrees C. */
const MAX_TARGET_TEMPERATURE = 80;

/** Relative difference between an arm's modelled speed and its design speed that is reported. */
const DESIGN_SPEED_TOLERANCE = 0.15;

/** Steepest plausible slope of a tub floor, radians (about 20 degrees). */
const MAX_FLOOR_SLOPE = 0.35;

/** Plausible range of an inlet valve's and a drain pump's flow, m^3/s (0.5 to 60 L/min). */
const PLAUSIBLE_FLOW: Range = [0.5 / 60000, 60 / 60000];

/** Plausible range of a detergent dose, kg (1 g to 100 g). */
const PLAUSIBLE_DETERGENT_MASS: Range = [0.001, 0.1];

/** Largest plausible rinse-aid dose, m^3 (20 mL). */
const MAX_RINSE_AID_VOLUME = 20e-6;

/** Tolerance on a bath volume when the primary programme is held to the nominal one, m^3. */
const BATH_VOLUME_TOLERANCE = 1e-6;

/** A length in metres as text in millimetres with one decimal, for the messages. */
const mmText = (metres: number): string => (metres * 1000).toFixed(1);

/** An axis-aligned box in the tub frame, metres. */
interface Box {
  readonly what: string;
  readonly x: Range;
  readonly y: Range;
  readonly z: Range;
}

/** True when `value` is a finite number. */
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Whether a dotted path (`a.b.2`) names something that exists on `target`. */
function hasPath(target: unknown, path: string): boolean {
  let current: unknown = target;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return false;
    if (!(key in (current as Record<string, unknown>))) return false;
    current = (current as Record<string, unknown>)[key];
  }
  return true;
}

/**
 * Checks one provenance record: present, known tag, a source, and per-field tags that name
 * fields of `fieldsOf` (the group itself, or a representative record of a table).
 */
function checkProvenance(
  problems: MachineProblem[],
  path: string,
  record: unknown,
  fieldsOf: unknown,
): void {
  if (record === null || typeof record !== 'object') {
    problems.push(problem('missing_provenance', path, 'the group has no provenance record'));
    return;
  }
  const p = record as { tag?: unknown; source?: unknown; fields?: unknown };
  if (!isProvenanceTag(p.tag)) {
    problems.push(
      problem('bad_provenance_tag', path, `unknown provenance tag ${JSON.stringify(p.tag)}`),
    );
  }
  if (typeof p.source !== 'string' || p.source.trim().length === 0) {
    problems.push(problem('missing_provenance', path, 'the provenance record names no source'));
  }
  if (p.fields !== undefined) {
    if (p.fields === null || typeof p.fields !== 'object') {
      problems.push(problem('bad_provenance_tag', path, 'the per-field tags are not a record'));
      return;
    }
    const fields = p.fields as Record<string, unknown>;
    for (const key of Object.keys(fields).sort()) {
      if (!isProvenanceTag(fields[key])) {
        problems.push(
          problem(
            'bad_provenance_tag',
            `${path}.fields.${key}`,
            `unknown provenance tag ${JSON.stringify(fields[key])}`,
          ),
        );
      }
      if (fieldsOf !== undefined && !hasPath(fieldsOf, key)) {
        problems.push(
          problem(
            'provenance_unknown_field',
            `${path}.fields.${key}`,
            `the group has no field "${key}"`,
          ),
        );
      }
    }
  }
}

/** Every group of a specification that must carry provenance. */
function checkAllProvenance(spec: MachineSpec, problems: MachineProblem[]): void {
  // A part the machine may lack is null; a part that is not there at all is a problem.
  const group = (
    path: string,
    target: { provenance?: unknown } | null | undefined,
    optional = false,
  ): void => {
    if (target === null && optional) return;
    if (target === null || target === undefined || typeof target !== 'object') {
      problems.push(problem('missing_group', path, `the description has no "${path}"`));
      return;
    }
    checkProvenance(problems, `${path}.provenance`, target.provenance, target);
  };
  group('identity', spec.identity);
  group('tub', spec.tub);
  group('door', spec.door);
  group('sump', spec.sump);
  group('filter.flatPlate', spec.filter.flatPlate);
  group('filter.sumpCover', spec.filter.sumpCover, true);
  group('filter.coarse', spec.filter.coarse);
  group('filter.micro', spec.filter.micro);
  group('saltCap', spec.saltCap, true);
  spec.floorFeatures.forEach((f) => group(`floorFeatures.${f.id}`, f));
  group('feedDuct', spec.feedDuct, true);
  spec.wallFeatures.forEach((f) => group(`wallFeatures.${f.id}`, f));
  group('dispenser', spec.dispenser);
  group('drying', spec.drying);
  group('drying.heatExchanger', spec.drying.heatExchanger, true);
  for (const basket of spec.baskets) {
    const path = `baskets.${basket.id}`;
    group(path, basket);
    group(`${path}.pose`, basket.pose);
    group(`${path}.wires`, basket.wires);
    group(`${path}.floor`, basket.floor);
    basket.tineRows.forEach((r) => group(`${path}.tineRows.${r.id}`, r));
    group(`${path}.wheels`, basket.wheels, true);
    group(`${path}.handle`, basket.handle, true);
    group(`${path}.tabletTray`, basket.tabletTray, true);
    basket.cupShelves.forEach((s) => group(`${path}.cupShelves.${s.id}`, s));
    basket.holders.forEach((h) => group(`${path}.holders.${h.id}`, h));
    group(`${path}.limits`, basket.limits, true);
  }
  group('cutleryBasket', spec.cutleryBasket, true);
  for (const level of spec.sprayLevels) {
    group(`sprayLevels.${level.id}`, level);
    checkProvenance(
      problems,
      `sprayLevels.${level.id}.nozzleProvenance`,
      level.nozzleProvenance,
      level.nozzles[0],
    );
  }
  group('hydraulics.pump', spec.hydraulics.pump);
  spec.hydraulics.branches.forEach((b) => group(`hydraulics.branches.${b.id}`, b));
  group('hydraulics.diverter', spec.hydraulics.diverter);
  group('hydraulics.inventory', spec.hydraulics.inventory);
  group('hydraulics.fill', spec.hydraulics.fill);
  group('hydraulics.drain', spec.hydraulics.drain);
  group('thermal', spec.thermal);
  group('dosing', spec.dosing);
  group('softener', spec.softener, true);
  group('sensors', spec.sensors);
  spec.programmes.forEach((p) => group(`programmes.${p.id}`, p));
}

/** Reports ids that are malformed or repeated within one scope. */
function checkIds(
  problems: MachineProblem[],
  path: string,
  ids: readonly string[],
  what: string,
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== 'string' || !isValidId(id)) {
      problems.push(
        problem(
          'bad_id',
          `${path}.${String(id)}`,
          `${what} id ${JSON.stringify(id)} is not a valid lower-case identifier`,
        ),
      );
    }
    if (seen.has(id)) {
      problems.push(problem('duplicate_id', `${path}.${id}`, `${what} id "${id}" is used twice`));
    }
    seen.add(id);
  }
}

/** Reports a range that is not finite and ordered. */
function checkRange(problems: MachineProblem[], code: string, path: string, range: Range): boolean {
  if (!finite(range[0]) || !finite(range[1]) || !(range[1] > range[0])) {
    problems.push(
      problem(
        code,
        path,
        `the extent [${String(range[0])}, ${String(range[1])}] is not an ordered interval`,
      ),
    );
    return false;
  }
  return true;
}

/**
 * Reports an angle that cannot be a number of radians in its range: what a value left in
 * degrees looks like. `low` and `high` are inclusive.
 */
function checkAngle(
  problems: MachineProblem[],
  path: string,
  value: number,
  low: number,
  high: number,
  what: string,
): void {
  if (!finite(value) || value < low - 1e-9 || value > high + 1e-9) {
    problems.push(
      problem(
        'angle_out_of_range',
        path,
        `${what} is ${String(value)} rad, outside ${low.toFixed(2)} to ${high.toFixed(2)} rad (a value in degrees?)`,
      ),
    );
  }
}

/** Reports a quantity that must be positive and is not. */
function checkPositive(
  problems: MachineProblem[],
  code: string,
  path: string,
  value: number,
  what: string,
): void {
  if (!finite(value) || !(value > 0)) {
    problems.push(problem(code, path, `${what} must be positive, not ${String(value)}`));
  }
}

/** The parts of a basket as boxes in the tub frame, at the height position with origin z `originZ`. */
function basketBoxes(basket: BasketSpec, originZ: number): Box[] {
  const [ox, oy] = basket.pose.originXY;
  const [width, depth] = basket.outline.size;
  const boxes: Box[] = [];
  const add = (what: string, x: Range, y: Range, z: Range): void => {
    boxes.push({
      what: `${what} of basket "${basket.id}"`,
      x: [ox + x[0], ox + x[1]],
      y: [oy + y[0], oy + y[1]],
      z: [originZ + z[0], originZ + z[1]],
    });
  };
  const floorRadius = basket.wires.floor.coated / 2;
  const families = [basket.floor.alongX, basket.floor.alongY];
  let floorBottom = Math.min(...families.map((f) => f.z)) - floorRadius;
  let floorTop = Math.max(...families.map((f) => f.z)) + floorRadius;
  for (const family of families) {
    for (const hump of family.humps)
      floorTop = Math.max(floorTop, family.z + hump.rise + floorRadius);
  }
  floorTop += floorReliefMax(basket.floor);
  floorBottom += floorReliefMin(basket.floor);
  if (basket.tray !== null) {
    floorBottom = Math.min(
      floorBottom,
      -(basket.tray.centreDepth - basket.tray.sideDepth) - 2 * floorRadius,
    );
  }
  add('the floor', [0, width], [0, depth], [floorBottom, floorTop]);

  const rimRadius = basket.wires.rim.coated / 2;
  for (const wall of basket.walls) {
    if (wall.horizontalWireZ.length === 0) continue;
    const z: Range = [
      Math.min(...wall.horizontalWireZ, 0) - rimRadius,
      Math.max(...wall.horizontalWireZ) + rimRadius,
    ];
    const t = basket.wires.rim.coated;
    if (wall.side === 'front') add('the front wall', [0, width], [0, t], z);
    else if (wall.side === 'rear') add('the rear wall', [0, width], [depth - t, depth], z);
    else if (wall.side === 'left') add('the left wall', [0, t], [0, depth], z);
    else add('the right wall', [width - t, width], [0, depth], z);
  }

  for (const row of basket.tineRows) {
    const radius = row.wireDiameter / 2;
    const reach = row.height * Math.tan(row.lean) + radius;
    const along: Range = [
      Math.min(row.railSpan[0], ...row.tinePositions) - radius,
      Math.max(row.railSpan[1], ...row.tinePositions) + radius,
    ];
    const leansAlong = row.leanToward.some((d) => d.endsWith(row.runs));
    const alongWithLean: Range = leansAlong ? [along[0] - reach, along[1] + reach] : along;
    const across: Range = leansAlong
      ? [row.railAt - radius, row.railAt + radius]
      : [row.railAt - reach, row.railAt + reach];
    const z: Range = [row.railZ - radius, row.railZ + row.height + row.wireDiameter];
    if (row.runs === 'x') add(`tine row "${row.id}"`, alongWithLean, across, z);
    else add(`tine row "${row.id}"`, across, alongWithLean, z);
  }

  for (const shelf of basket.cupShelves) {
    const x: Range = shelf.side === 'left' ? [0, shelf.size[1]] : [width - shelf.size[1], width];
    add(`cup shelf "${shelf.id}"`, x, shelf.y, [
      shelf.heightAboveGrid - shelf.size[2],
      shelf.heightAboveGrid + shelf.size[1],
    ]);
  }
  for (const holder of basket.holders) {
    if (holder.floorZ === null) continue;
    add(`holder "${holder.id}"`, holder.x, holder.y, [
      holder.floorZ,
      holder.floorZ + holder.size[2],
    ]);
  }
  if (basket.tabletTray !== null) {
    const tray = basket.tabletTray;
    add(
      'the tablet tray',
      [tray.centre[0] - tray.size[0] / 2, tray.centre[0] + tray.size[0] / 2],
      [tray.centre[1] - tray.size[1] / 2, tray.centre[1] + tray.size[1] / 2],
      [tray.rimZ - tray.size[2], tray.rimZ],
    );
  }
  return boxes;
}

/** The lowest and highest z of a set of boxes. */
function zExtent(boxes: readonly Box[]): Range {
  return [Math.min(...boxes.map((b) => b.z[0])), Math.max(...boxes.map((b) => b.z[1]))];
}

/** Horizontal distance from a point to a rectangle (0 inside it). */
function distanceToRect(px: number, py: number, x: Range, y: Range): number {
  const dx = Math.max(x[0] - px, 0, px - x[1]);
  const dy = Math.max(y[0] - py, 0, py - y[1]);
  return Math.hypot(dx, dy);
}

/** The id of every height position combination: one position per adjustable basket. */
function heightCombinations(spec: MachineSpec): Record<string, string>[] {
  let combos: Record<string, string>[] = [{}];
  for (const basket of spec.baskets) {
    if (basket.pose.heightPositions.length <= 1) continue;
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const position of basket.pose.heightPositions) {
        next.push({ ...combo, [basket.id]: position.id });
      }
    }
    combos = next;
  }
  return combos;
}

/** ` with basket "upper" at position "2"`: the words that name a height combination. */
function describeCombo(combo: Record<string, string>): string {
  const keys = Object.keys(combo).sort();
  if (keys.length === 0) return '';
  return ` with ${keys.map((k) => `basket "${k}" at position "${String(combo[k])}"`).join(' and ')}`;
}

/** Something found wrong at one combination of basket height positions. */
interface ComboFinding {
  readonly code: string;
  readonly path: string;
  /** The message without the words that name the combination. */
  readonly text: string;
  /** The words that name the combination (`describeCombo`). */
  readonly combo: string;
}

/**
 * Turns what was found at each height combination into problems: a finding that is the same at
 * every one of the `comboCount` combinations (it does not depend on the basket heights) is
 * reported once; any other is reported with the combination it was found at.
 */
function reportComboFindings(
  problems: MachineProblem[],
  findings: readonly ComboFinding[],
  comboCount: number,
): void {
  const groups = new Map<string, ComboFinding[]>();
  for (const finding of findings) {
    const key = `${finding.code}\u0000${finding.path}\u0000${finding.text}`;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [finding]);
    else group.push(finding);
  }
  for (const group of groups.values()) {
    const first = group[0];
    if (first === undefined) continue;
    if (new Set(group.map((finding) => finding.combo)).size >= comboCount) {
      problems.push(problem(first.code, first.path, first.text));
    } else {
      for (const finding of group) {
        problems.push(problem(finding.code, finding.path, `${finding.text}${finding.combo}`));
      }
    }
  }
}

/** Geometry of the tub, door, sump and fixtures. */
function checkTub(spec: MachineSpec, problems: MachineProblem[]): boolean {
  const { tub, door } = spec;
  const ok =
    checkRange(problems, 'tub_bad_extent', 'tub.x', tub.x) &&
    checkRange(problems, 'tub_bad_extent', 'tub.y', tub.y) &&
    checkRange(problems, 'tub_bad_extent', 'tub.z', tub.z);
  if (!ok) return false;
  if (door.linerPlaneY > door.flangePlaneY + TOUCH_TOLERANCE) {
    problems.push(
      problem(
        'door_liner_inside_tub',
        'door.linerPlaneY',
        `the door liner at y = ${mmText(door.linerPlaneY)} mm is behind the flange plane at ${mmText(door.flangePlaneY)} mm`,
      ),
    );
  }
  if (Math.abs(door.flangePlaneY - tub.y[0]) > 1e-6) {
    problems.push(
      problem(
        'door_flange_off_tub',
        'door.flangePlaneY',
        `the flange plane at y = ${mmText(door.flangePlaneY)} mm is not the front of the tub at ${mmText(tub.y[0])} mm`,
      ),
    );
  }
  const inPlan = (x: number, y: number): boolean =>
    x >= tub.x[0] && x <= tub.x[1] && y >= door.linerPlaneY && y <= tub.y[1];
  if (!inPlan(spec.sump.centre[0], spec.sump.centre[1])) {
    problems.push(problem('fixture_outside_tub', 'sump.centre', 'the sump lies outside the tub'));
  }
  if (!inPlan(spec.filter.axis[0], spec.filter.axis[1])) {
    problems.push(
      problem('fixture_outside_tub', 'filter.axis', 'the filter axis lies outside the tub'),
    );
  }
  const plate = spec.filter.flatPlate;
  if (
    plate.x[0] < tub.x[0] ||
    plate.x[1] > tub.x[1] ||
    plate.y[0] < door.linerPlaneY ||
    plate.y[1] > tub.y[1]
  ) {
    problems.push(
      problem(
        'fixture_outside_tub',
        'filter.flatPlate',
        'the flat filter extends beyond the tub floor',
      ),
    );
  }
  checkAngle(problems, 'tub.floorSlope', tub.floorSlope, 0, MAX_FLOOR_SLOPE, 'the floor slope');
  checkAngle(problems, 'door.openAngle', door.openAngle, 0, Math.PI, 'the door opening angle');
  if (spec.dispenser.lid.kind === 'swings') {
    checkAngle(
      problems,
      'dispenser.lid.angle',
      spec.dispenser.lid.angle,
      0,
      Math.PI,
      'the swing of the dispenser lid',
    );
  }
  for (const [name, value] of [
    ['filter.flatPlate.openFraction', plate.openFraction],
    ['filter.micro.openFraction', spec.filter.micro.openFraction],
  ] as const) {
    if (!finite(value) || !(value > 0) || value > 1) {
      problems.push(
        problem('filter_bad_value', name, `an open fraction of ${String(value)} is not in (0, 1]`),
      );
    }
  }
  checkPositive(
    problems,
    'filter_bad_value',
    'filter.flatPlate.openArea',
    plate.openArea,
    'the open area of the flat filter',
  );
  checkPositive(
    problems,
    'filter_bad_value',
    'filter.micro.area',
    spec.filter.micro.area,
    'the area of the micro filter',
  );
  if (spec.saltCap !== null) {
    const cap = spec.saltCap;
    if (!inPlan(cap.centre[0], cap.centre[1])) {
      problems.push(
        problem('fixture_outside_tub', 'saltCap.centre', 'the salt cap lies outside the tub'),
      );
    }
  }
  if (spec.feedDuct !== null) {
    const duct = spec.feedDuct;
    if (duct.riserX[0] < tub.x[0] || duct.riserX[1] > tub.x[1]) {
      problems.push(
        problem('fixture_outside_tub', 'feedDuct.riserX', 'the riser lies outside the tub'),
      );
    }
    if (duct.topZ > tub.z[1] + TOUCH_TOLERANCE) {
      problems.push(
        problem(
          'duct_above_roof',
          'feedDuct.topZ',
          `the feed duct ends at z = ${mmText(duct.topZ)} mm, above the roof at ${mmText(tub.z[1])} mm`,
        ),
      );
    }
    for (const z of duct.portZ) {
      if (z < tub.z[0] || z > tub.z[1]) {
        problems.push(
          problem(
            'fixture_outside_tub',
            'feedDuct.portZ',
            `a docking port at z = ${mmText(z)} mm is outside the tub`,
          ),
        );
      }
    }
  }
  return true;
}

/** Baskets inside the tub, clear of the duct and of one another; rows and wires inside their basket. */
function checkBaskets(spec: MachineSpec, problems: MachineProblem[]): void {
  const { tub, door } = spec;
  checkIds(
    problems,
    'baskets',
    spec.baskets.map((b) => b.id),
    'basket',
  );
  for (const basket of spec.baskets) {
    const path = `baskets.${basket.id}`;
    const [width, depth] = basket.outline.size;
    checkPositive(problems, 'basket_bad_size', `${path}.outline.size`, width, 'the basket width');
    checkPositive(problems, 'basket_bad_size', `${path}.outline.size`, depth, 'the basket depth');
    if (basket.pose.heightPositions.length === 0) {
      problems.push(
        problem(
          'basket_no_position',
          `${path}.pose.heightPositions`,
          'the basket has no height position',
        ),
      );
      continue;
    }
    checkIds(
      problems,
      `${path}.pose.heightPositions`,
      basket.pose.heightPositions.map((p) => p.id),
      'height position',
    );
    for (let i = 1; i < basket.pose.heightPositions.length; i++) {
      const above = basket.pose.heightPositions[i - 1];
      const below = basket.pose.heightPositions[i];
      if (above !== undefined && below !== undefined && !(below.originZ < above.originZ)) {
        problems.push(
          problem(
            'height_positions_not_descending',
            `${path}.pose.heightPositions.${below.id}`,
            `the height positions are listed highest first, but "${below.id}" at ${mmText(below.originZ)} mm is not below "${above.id}" at ${mmText(above.originZ)} mm`,
          ),
        );
        break;
      }
    }
    const relief = basket.floor.relief;
    if (relief !== null) {
      const rises = relief.points.map((point) => point.rise);
      const ordered = relief.points.every(
        (point, i) => i === 0 || point.at >= (relief.points[i - 1]?.at ?? point.at),
      );
      if (
        relief.points.length === 0 ||
        !ordered ||
        rises.some((rise) => !finite(rise)) ||
        !rises.some((rise) => Math.abs(rise) <= TOUCH_TOLERANCE)
      ) {
        problems.push(
          problem(
            'floor_relief_bad',
            `${path}.floor.relief`,
            'the relief of the floor needs ascending positions, finite rises and a point at a rise of 0, the level the heights of the basket are given from',
          ),
        );
      }
    }
    const [ox, oy] = basket.pose.originXY;
    if (ox < tub.x[0] - TOUCH_TOLERANCE || ox + width > tub.x[1] + TOUCH_TOLERANCE) {
      problems.push(
        problem(
          'basket_outside_tub',
          `${path}.pose.originXY`,
          `the basket spans x = ${mmText(ox)} to ${mmText(ox + width)} mm; the tub walls are at ${mmText(tub.x[0])} and ${mmText(tub.x[1])} mm`,
        ),
      );
    }
    if (basket.wheels !== null) {
      const half = basket.wheels.track / 2;
      const centre = ox + width / 2;
      if (
        centre - half < tub.x[0] - TOUCH_TOLERANCE ||
        centre + half > tub.x[1] + TOUCH_TOLERANCE
      ) {
        problems.push(
          problem(
            'basket_outside_tub',
            `${path}.wheels.track`,
            `the wheel track of ${mmText(basket.wheels.track)} mm does not fit between the tub walls`,
          ),
        );
      }
    }
    if (oy < door.linerPlaneY - TOUCH_TOLERANCE) {
      problems.push(
        problem(
          'basket_outside_tub',
          `${path}.pose.originXY`,
          `the front of the basket at y = ${mmText(oy)} mm is beyond the door liner at ${mmText(door.linerPlaneY)} mm`,
        ),
      );
    }
    if (oy + depth > tub.y[1] + TOUCH_TOLERANCE) {
      problems.push(
        problem(
          'basket_outside_tub',
          `${path}.pose.originXY`,
          `the rear of the basket at y = ${mmText(oy + depth)} mm is beyond the rear wall at ${mmText(tub.y[1])} mm`,
        ),
      );
    }
    for (const position of basket.pose.heightPositions) {
      const boxes = basketBoxes(basket, position.originZ);
      const [zLow, zHigh] = zExtent(boxes);
      if (zLow < tub.z[0] - TOUCH_TOLERANCE) {
        problems.push(
          problem(
            'basket_outside_tub',
            `${path}.pose.heightPositions.${position.id}`,
            `the basket reaches down to z = ${mmText(zLow)} mm, below the tub floor`,
          ),
        );
      }
      if (zHigh > tub.z[1] + TOUCH_TOLERANCE) {
        problems.push(
          problem(
            'basket_outside_tub',
            `${path}.pose.heightPositions.${position.id}`,
            `the basket reaches up to z = ${mmText(zHigh)} mm, above the roof at ${mmText(tub.z[1])} mm`,
          ),
        );
      }
      // The feed duct on the rear wall, where the basket is at its height.
      const duct = spec.feedDuct;
      if (duct !== null) {
        const stretch: Range = [duct.riserX[0] - ox, duct.riserX[1] - ox];
        if (stretch[1] > 0 && stretch[0] < width) {
          const nearPorts = duct.portZ.some((z) => z > zLow - 0.03 && z < zHigh + 0.03);
          const proud = nearPorts ? duct.portBlockProud : duct.riserProud;
          const rear = oy + depth - basketSideRecessOver(basket, 'rear', stretch);
          const face = tub.y[1] - proud;
          if (rear > face + TOUCH_TOLERANCE) {
            problems.push(
              problem(
                'basket_hits_feed_duct',
                `${path}.pose.originXY`,
                `behind the basket the feed duct stands ${mmText(proud)} mm proud of the rear wall (its face at y = ${mmText(face)} mm), and the rear of the basket is at ${mmText(rear)} mm at position "${position.id}"`,
              ),
            );
          }
        }
      }
    }

    // Rows, wires and fittings inside the outline.
    checkIds(
      problems,
      `${path}.tineRows`,
      basket.tineRows.map((r) => r.id),
      'tine row',
    );
    for (const row of basket.tineRows) {
      const rowPath = `${path}.tineRows.${row.id}`;
      const alongMax = row.runs === 'x' ? width : depth;
      const acrossMax = row.runs === 'x' ? depth : width;
      if (row.tinePositions.length === 0) {
        problems.push(problem('tine_row_empty', rowPath, 'the row has no tines'));
      }
      if (row.leanToward.length !== row.tinePositions.length) {
        problems.push(
          problem(
            'tine_row_bad_lean',
            rowPath,
            `${row.tinePositions.length} tines but ${row.leanToward.length} lean directions`,
          ),
        );
      }
      for (const p of row.tinePositions) {
        if (!finite(p) || p < 0 || p > alongMax) {
          problems.push(
            problem(
              'tine_outside_basket',
              rowPath,
              `a tine at ${mmText(p)} mm along the row is outside the basket (0 to ${mmText(alongMax)} mm)`,
            ),
          );
          break;
        }
      }
      for (let i = 1; i < row.tinePositions.length; i++) {
        const a = row.tinePositions[i - 1];
        const b = row.tinePositions[i];
        if (a !== undefined && b !== undefined && !(b > a)) {
          problems.push(
            problem(
              'tine_row_not_ascending',
              rowPath,
              'the tine positions are not strictly ascending',
            ),
          );
          break;
        }
      }
      if (!finite(row.railAt) || row.railAt < 0 || row.railAt > acrossMax) {
        problems.push(
          problem(
            'tine_outside_basket',
            rowPath,
            `the rail at ${mmText(row.railAt)} mm is outside the basket (0 to ${mmText(acrossMax)} mm)`,
          ),
        );
      }
      checkPositive(
        problems,
        'tine_row_bad_value',
        `${rowPath}.height`,
        row.height,
        'the tine height',
      );
      checkPositive(
        problems,
        'tine_row_bad_value',
        `${rowPath}.pitch`,
        row.pitch,
        'the tine pitch',
      );
      checkPositive(
        problems,
        'tine_row_bad_value',
        `${rowPath}.wireDiameter`,
        row.wireDiameter,
        'the tine wire diameter',
      );
      if (!finite(row.lean) || row.lean < 0 || row.lean >= Math.PI / 2) {
        problems.push(
          problem(
            'tine_row_bad_value',
            `${rowPath}.lean`,
            `a lean of ${String(row.lean)} rad is not between 0 and a right angle`,
          ),
        );
      }
      if (row.hinge !== null) {
        checkAngle(
          problems,
          `${rowPath}.hinge.foldAngle`,
          row.hinge.foldAngle,
          0,
          Math.PI,
          'the fold angle',
        );
      }
      if (row.hinge === null && row.defaultState !== 'up') {
        problems.push(
          problem('fixed_row_folded', rowPath, 'a fixed row cannot be folded by default'),
        );
      }
    }
    for (const [name, family, acrossMax] of [
      ['alongY', basket.floor.alongY, width],
      ['alongX', basket.floor.alongX, depth],
    ] as const) {
      for (const p of family.positions) {
        if (!finite(p) || p < 0 || p > acrossMax) {
          problems.push(
            problem(
              'floor_wire_outside_basket',
              `${path}.floor.${name}`,
              `a floor wire at ${mmText(p)} mm is outside the basket (0 to ${mmText(acrossMax)} mm)`,
            ),
          );
          break;
        }
      }
      if (family.positions.length === 0) {
        problems.push(
          problem(
            'floor_empty',
            `${path}.floor.${name}`,
            'the floor has no wires in this direction',
          ),
        );
      }
    }
    for (const size of [basket.wires.rim, basket.wires.floor, basket.wires.tine]) {
      if (!(size.coated > 0) || !(size.steel > 0) || size.steel > size.coated) {
        problems.push(
          problem(
            'wire_bad_size',
            `${path}.wires`,
            'a wire needs positive diameters, the bare one no larger than the coated one',
          ),
        );
        break;
      }
    }
    checkIds(
      problems,
      `${path}.shelves`,
      [...basket.cupShelves.map((s) => s.id), ...basket.holders.map((h) => h.id)],
      'shelf or holder',
    );
    if (basket.limits !== null) {
      const of = spec.baskets.find((b) => b.id === basket.limits?.positionOfBasket);
      if (of === undefined) {
        problems.push(
          problem(
            'limits_unknown_basket',
            `${path}.limits.positionOfBasket`,
            `no basket "${basket.limits.positionOfBasket}"`,
          ),
        );
      } else {
        for (const key of Object.keys(basket.limits.maxDiameterByPosition).sort()) {
          if (!of.pose.heightPositions.some((p) => p.id === key)) {
            problems.push(
              problem(
                'limits_unknown_position',
                `${path}.limits.maxDiameterByPosition.${key}`,
                `basket "${of.id}" has no height position "${key}"`,
              ),
            );
          }
        }
      }
    }
  }

  // Baskets one above another must not overlap at any combination of height positions.
  const combos = heightCombinations(spec);
  const findings: ComboFinding[] = [];
  for (const combo of combos) {
    const extents = spec.baskets.map((basket) => {
      const position =
        basket.pose.heightPositions.find((p) => p.id === combo[basket.id]) ??
        basket.pose.heightPositions[0];
      return {
        basket,
        z:
          position === undefined
            ? ([0, 0] as Range)
            : zExtent(basketBoxes(basket, position.originZ)),
      };
    });
    const sorted = [...extents].sort((a, b) => a.z[0] - b.z[0]);
    for (let i = 1; i < sorted.length; i++) {
      const below = sorted[i - 1];
      const above = sorted[i];
      if (below === undefined || above === undefined) continue;
      if (below.z[1] > above.z[0] + TOUCH_TOLERANCE) {
        findings.push({
          code: 'baskets_overlap',
          path: `baskets.${above.basket.id}`,
          text: `basket "${below.basket.id}" reaches up to z = ${mmText(below.z[1])} mm and basket "${above.basket.id}" down to ${mmText(above.z[0])} mm`,
          combo: describeCombo(combo),
        });
      }
    }
  }
  reportComboFindings(problems, findings, combos.length);
}

/** What an arm sweeps: a hub zone and a blade zone, each a disc with a height interval. */
function armSweep(
  spec: MachineSpec,
  arm: SprayArmSpec,
  combo: Record<string, string>,
): { datum: number; zones: { radius: number; z: Range }[] } {
  const datum =
    arm.mount.kind === 'tub' ? 0 : basketHeightPosition(spec, arm.mount.basketId, combo).originZ;
  const top = datum + Math.max(arm.topFaceZ, arm.nozzleUpZ ?? arm.topFaceZ);
  const hubRadius = Math.min(arm.tipRadius, (arm.shape.hubDiameter ?? 0.06) / 2);
  return {
    datum,
    zones: [
      { radius: arm.tipRadius, z: [datum + arm.bladeUndersideZ, top] },
      { radius: hubRadius, z: [datum + Math.min(arm.hubUndersideZ, arm.bladeUndersideZ), top] },
    ],
  };
}

/** Spray levels: nozzle tables, and arms clear of everything through a full turn. */
function checkSprayLevels(spec: MachineSpec, problems: MachineProblem[]): void {
  const { tub, door } = spec;
  checkIds(
    problems,
    'sprayLevels',
    spec.sprayLevels.map((l) => l.id),
    'spray level',
  );
  for (const level of spec.sprayLevels) {
    const path = `sprayLevels.${level.id}`;
    checkIds(
      problems,
      `${path}.nozzles`,
      level.nozzles.map((n) => n.id),
      'nozzle',
    );
    if (level.nozzles.length === 0) {
      problems.push(problem('level_without_nozzles', path, 'the spray level has no nozzles'));
    }
    if (level.mount.kind === 'basket') {
      const basketId = level.mount.basketId;
      if (!spec.baskets.some((b) => b.id === basketId)) {
        problems.push(
          problem(
            'level_unknown_basket',
            `${path}.mount`,
            `no basket "${basketId}" to carry the spray level`,
          ),
        );
        continue;
      }
    }
    for (const nozzle of level.nozzles) {
      const nozzlePath = `${path}.nozzles.${nozzle.id}`;
      if (!finite(nozzle.area) || !(nozzle.area > 0)) {
        problems.push(
          problem(
            'nozzle_bad_area',
            nozzlePath,
            `the opening has an area of ${String(nozzle.area)} m^2`,
          ),
        );
      }
      if (!finite(nozzle.cd) || !(nozzle.cd > 0) || nozzle.cd > 1) {
        problems.push(
          problem(
            'nozzle_bad_coefficient',
            nozzlePath,
            `a discharge coefficient of ${String(nozzle.cd)} is not in (0, 1]`,
          ),
        );
      }
      if (!finite(nozzle.cv) || !(nozzle.cv > 0) || nozzle.cv > 1.05) {
        problems.push(
          problem(
            'nozzle_bad_coefficient',
            nozzlePath,
            `a velocity coefficient of ${String(nozzle.cv)} is not in (0, 1.05]`,
          ),
        );
      }
      if (!finite(nozzle.radius) || nozzle.radius < 0) {
        problems.push(
          problem('nozzle_beyond_arm', nozzlePath, `a radius of ${String(nozzle.radius)} m`),
        );
      } else if (level.kind === 'arm' && nozzle.radius > level.tipRadius + TOUCH_TOLERANCE) {
        problems.push(
          problem(
            'nozzle_beyond_arm',
            nozzlePath,
            `the nozzle at a radius of ${mmText(nozzle.radius)} mm lies beyond the tip of the arm at ${mmText(level.tipRadius)} mm`,
          ),
        );
      }
      if (nozzle.blade === 'axis' && nozzle.radius !== 0) {
        problems.push(
          problem('nozzle_beyond_arm', nozzlePath, 'a nozzle on the axis must have radius 0'),
        );
      }
      checkAngle(
        problems,
        `${nozzlePath}.theta`,
        nozzle.theta,
        0,
        2 * Math.PI,
        'the azimuth theta of the jet',
      );
      checkAngle(
        problems,
        `${nozzlePath}.rho`,
        nozzle.rho,
        -Math.PI / 2,
        Math.PI / 2,
        'the elevation rho of the jet',
      );
      if (
        (nozzle.face === 'top' && !(nozzle.rho > 0)) ||
        (nozzle.face === 'underside' && !(nozzle.rho < 0))
      ) {
        problems.push(
          problem(
            'nozzle_face_direction',
            nozzlePath,
            `a nozzle in the ${nozzle.face} face cannot have an elevation of ${((nozzle.rho * 180) / Math.PI).toFixed(0)} deg`,
          ),
        );
      }
      if (level.kind === 'arm') {
        const plane = nozzle.face === 'top' ? level.nozzleUpZ : level.nozzleDownZ;
        if (plane === null) {
          problems.push(
            problem(
              'nozzle_plane_missing',
              nozzlePath,
              `the arm has no nozzle plane on its ${nozzle.face} face`,
            ),
          );
        }
        const tangential = Math.cos(nozzle.rho) * Math.sin(nozzle.theta);
        if (nozzle.drives && Math.abs(tangential) < 1e-6) {
          problems.push(
            problem(
              'drive_flag_inconsistent',
              nozzlePath,
              'the nozzle is marked as driving the arm but its jet has no tangential component',
            ),
          );
        }
      }
    }
    if (level.kind !== 'arm') {
      checkAngle(
        problems,
        `${path}.spray.coneHalfAngle`,
        level.spray.coneHalfAngle,
        0,
        Math.PI / 2,
        'the half-angle of the spray cone',
      );
      if (level.lowerFaceZ > tub.z[1] || level.outletZ > tub.z[1] + TOUCH_TOLERANCE) {
        problems.push(problem('level_outside_tub', path, 'the sprayer lies above the roof'));
      }
      continue;
    }

    const arm = level;
    checkAngle(
      problems,
      `${path}.shape.tipSweep`,
      arm.shape.tipSweep,
      -Math.PI / 2,
      Math.PI / 2,
      'the tip sweep',
    );
    checkPositive(problems, 'arm_bad_value', `${path}.tipRadius`, arm.tipRadius, 'the tip radius');
    checkPositive(
      problems,
      'arm_bad_value',
      `${path}.inertiaWet`,
      arm.inertiaWet,
      'the moment of inertia',
    );
    checkPositive(
      problems,
      'arm_bad_value',
      `${path}.bearing.hubBore`,
      arm.bearing.hubBore,
      'the hub bore',
    );
    if (!(arm.bearing.frictionRadius >= 0) || !(arm.bearing.viscous >= 0)) {
      problems.push(
        problem('arm_bad_value', `${path}.bearing`, 'the friction parameters must not be negative'),
      );
    }
    const [ax, ay] = arm.axis;
    if (
      ax - arm.tipRadius < tub.x[0] - TOUCH_TOLERANCE ||
      ax + arm.tipRadius > tub.x[1] + TOUCH_TOLERANCE
    ) {
      problems.push(
        problem(
          'arm_outside_tub',
          path,
          `the arm sweeps x = ${mmText(ax - arm.tipRadius)} to ${mmText(ax + arm.tipRadius)} mm; the tub walls are at ${mmText(tub.x[0])} and ${mmText(tub.x[1])} mm`,
        ),
      );
    }
    if (ay - arm.tipRadius < door.linerPlaneY - TOUCH_TOLERANCE) {
      problems.push(
        problem(
          'arm_outside_tub',
          path,
          `the arm sweeps forward to y = ${mmText(ay - arm.tipRadius)} mm, beyond the door liner at ${mmText(door.linerPlaneY)} mm`,
        ),
      );
    }
    if (ay + arm.tipRadius > tub.y[1] + TOUCH_TOLERANCE) {
      problems.push(
        problem(
          'arm_outside_tub',
          path,
          `the arm sweeps back to y = ${mmText(ay + arm.tipRadius)} mm, beyond the rear wall at ${mmText(tub.y[1])} mm`,
        ),
      );
    }

    const combos = heightCombinations(spec);
    const findings: ComboFinding[] = [];
    for (const combo of combos) {
      const where = describeCombo(combo);
      const found = (code: string, at: string, text: string): void => {
        findings.push({ code, path: at, text, combo: where });
      };
      const sweep = armSweep(spec, arm, combo);
      const blade = sweep.zones[0];
      if (blade === undefined) continue;
      if (blade.z[0] < tub.z[0] - TOUCH_TOLERANCE || blade.z[1] > tub.z[1] + TOUCH_TOLERANCE) {
        found(
          'arm_outside_tub',
          path,
          `the arm lies between z = ${mmText(blade.z[0])} and ${mmText(blade.z[1])} mm, outside the tub (floor at ${mmText(tub.z[0])} mm, roof at ${mmText(tub.z[1])} mm)`,
        );
      }
      // The feed duct on the rear wall.
      const duct = spec.feedDuct;
      if (duct !== null) {
        const dx = Math.max(duct.riserX[0] - ax, 0, ax - duct.riserX[1]);
        if (dx < arm.tipRadius) {
          const reach = ay + Math.sqrt(arm.tipRadius * arm.tipRadius - dx * dx);
          const nearPorts = duct.portZ.some((z) => z > blade.z[0] - 0.03 && z < blade.z[1] + 0.03);
          const face = tub.y[1] - (nearPorts ? duct.portBlockProud : duct.riserProud);
          if (reach > face + TOUCH_TOLERANCE) {
            found(
              'arm_hits_feed_duct',
              path,
              `the arm sweeps back to y = ${mmText(reach)} mm where the feed duct's face is at ${mmText(face)} mm`,
            );
          }
        }
      }
      // Fixtures standing on the floor under a tub-mounted arm.
      if (arm.mount.kind === 'tub') {
        const fixtures: {
          what: string;
          path: string;
          x: number;
          y: number;
          radius: number;
          top: number;
        }[] = [];
        if (spec.saltCap !== null) {
          fixtures.push({
            what: 'the salt cap',
            path: 'saltCap.topZ',
            x: spec.saltCap.centre[0],
            y: spec.saltCap.centre[1],
            radius: spec.saltCap.diameter / 2,
            top: spec.saltCap.topZ,
          });
        }
        const coarse = spec.filter.coarse;
        if (coarse.crownTopZ !== null) {
          fixtures.push({
            what: 'the crown of the coarse filter',
            path: 'filter.coarse.crownTopZ',
            x: spec.filter.axis[0],
            y: spec.filter.axis[1],
            radius: (coarse.crownDiameter ?? coarse.diameter) / 2,
            top: coarse.crownTopZ,
          });
        }
        for (const fixture of fixtures) {
          const distance = Math.hypot(fixture.x - ax, fixture.y - ay) - fixture.radius;
          if (
            distance < arm.tipRadius &&
            fixture.top > blade.z[0] - TOUCH_TOLERANCE &&
            blade.z[0] > 0
          ) {
            found(
              'fixture_under_arm',
              fixture.path,
              `${fixture.what} stands ${mmText(fixture.top)} mm high under the sweep of arm "${arm.id}", whose underside is at ${mmText(blade.z[0])} mm`,
            );
          }
        }
      }
      // Baskets, at this combination of height positions.
      const obstacles: Box[] = [];
      for (const basket of spec.baskets) {
        const position =
          basket.pose.heightPositions.find((p) => p.id === combo[basket.id]) ??
          basket.pose.heightPositions[0];
        if (position === undefined) continue;
        obstacles.push(...basketBoxes(basket, position.originZ));
        const cutlery = spec.cutleryBasket;
        if (cutlery !== null && cutlery.defaultPlacement.basketId === basket.id) {
          const placement = cutlery.defaultPlacement;
          const halfX = (placement.longAxis === 'x' ? cutlery.size[0] : cutlery.size[1]) / 2;
          const halfY = (placement.longAxis === 'x' ? cutlery.size[1] : cutlery.size[0]) / 2;
          const [bx, by] = basket.pose.originXY;
          obstacles.push({
            what: 'the cutlery basket with its handle up',
            x: [bx + placement.centre[0] - halfX, bx + placement.centre[0] + halfX],
            y: [by + placement.centre[1] - halfY, by + placement.centre[1] + halfY],
            z: [position.originZ, position.originZ + cutlery.heightWithHandle],
          });
        }
      }
      const struck = new Set<string>();
      for (const zone of sweep.zones) {
        for (const box of obstacles) {
          if (struck.has(box.what)) continue;
          if (distanceToRect(ax, ay, box.x, box.y) >= zone.radius) continue;
          if (zone.z[0] < box.z[1] - TOUCH_TOLERANCE && zone.z[1] > box.z[0] + TOUCH_TOLERANCE) {
            struck.add(box.what);
            found(
              'arm_hits_basket',
              path,
              `arm "${arm.id}" (z = ${mmText(zone.z[0])} to ${mmText(zone.z[1])} mm) would strike ${box.what} (z = ${mmText(box.z[0])} to ${mmText(box.z[1])} mm)`,
            );
          }
        }
      }
    }
    reportComboFindings(problems, findings, combos.length);
  }
}

/** The dispenser and the tablet's way down. */
function checkDispenser(spec: MachineSpec, problems: MachineProblem[]): void {
  const { dispenser, door, tub } = spec;
  if (Math.abs(dispenser.chamberCentre[1] - door.linerPlaneY) > 1e-3) {
    problems.push(
      problem(
        'dispenser_off_liner',
        'dispenser.chamberCentre',
        `the detergent chamber at y = ${mmText(dispenser.chamberCentre[1])} mm is not on the door liner at ${mmText(door.linerPlaneY)} mm`,
      ),
    );
  }
  const [cx, , cz] = dispenser.chamberCentre;
  if (cx < tub.x[0] || cx > tub.x[1] || cz < tub.z[0] || cz > tub.z[1]) {
    problems.push(
      problem(
        'fixture_outside_tub',
        'dispenser.chamberCentre',
        'the detergent chamber lies outside the door opening',
      ),
    );
  }
  const target = dispenser.tabletTarget;
  const basket = spec.baskets.find((b) => b.id === target.basketId);
  if (basket === undefined) {
    problems.push(
      problem(
        'tablet_target_missing',
        'dispenser.tabletTarget',
        `no basket "${target.basketId}" for the tablet to fall into`,
      ),
    );
    return;
  }
  if (target.kind === 'basket_tray') {
    if (basket.tabletTray === null) {
      problems.push(
        problem(
          'tablet_target_missing',
          'dispenser.tabletTarget',
          `basket "${basket.id}" has no tablet collecting tray`,
        ),
      );
      return;
    }
    for (const position of basket.pose.heightPositions) {
      const rim = position.originZ + basket.tabletTray.rimZ;
      if (rim > dispenser.tabletExit[2] + TOUCH_TOLERANCE) {
        problems.push(
          problem(
            'tablet_tray_above_chamber',
            `baskets.${basket.id}.tabletTray.rimZ`,
            `at position "${position.id}" the rim of the tablet tray is at z = ${mmText(rim)} mm, above the lip of the detergent chamber at ${mmText(dispenser.tabletExit[2])} mm`,
          ),
        );
      }
    }
    const tray = basket.tabletTray;
    const x = basket.pose.originXY[0] + tray.centre[0];
    if (Math.abs(dispenser.tabletExit[0] - x) > tray.size[0] / 2) {
      problems.push(
        problem(
          'tablet_misses_tray',
          'dispenser.tabletExit',
          `the tablet leaves the chamber at x = ${mmText(dispenser.tabletExit[0])} mm, to the side of the tray (x = ${mmText(x - tray.size[0] / 2)} to ${mmText(x + tray.size[0] / 2)} mm)`,
        ),
      );
    }
  }
}

/** Whether every phase of a pattern names a position of the machine, with a positive dwell. */
function checkPattern(
  spec: MachineSpec,
  problems: MachineProblem[],
  path: string,
  pattern: DiverterPatternSpec,
): boolean {
  let ok = true;
  if (pattern.phases.length === 0) {
    problems.push(problem('pattern_empty', path, 'the diverter pattern has no phase'));
    return false;
  }
  for (const phase of pattern.phases) {
    const position = spec.hydraulics.diverter.positions.find((p) => p.id === phase.position);
    if (position === undefined) {
      problems.push(
        problem(
          'pattern_unknown_position',
          path,
          `the machine has no diverter position "${phase.position}"`,
        ),
      );
      ok = false;
    } else if (position.feeds.length === 0) {
      problems.push(
        problem(
          'pattern_closed_position',
          path,
          `diverter position "${phase.position}" feeds nothing`,
        ),
      );
      ok = false;
    }
    if (!finite(phase.duration) || !(phase.duration > 0)) {
      problems.push(
        problem('pattern_bad_duration', path, `a dwell of ${String(phase.duration)} s`),
      );
      ok = false;
    }
  }
  return ok;
}

/** Pump, branches, diverter, inventory, fill and drain; flows and arm rotation at the rated speed. */
function checkHydraulics(spec: MachineSpec, problems: MachineProblem[]): boolean {
  const h = spec.hydraulics;
  const before = problems.length;
  checkPositive(
    problems,
    'pump_bad_curve',
    'hydraulics.pump.ratedSpeedRpm',
    h.pump.ratedSpeedRpm,
    'the rated pump speed',
  );
  checkPositive(
    problems,
    'pump_bad_curve',
    'hydraulics.pump.shutOffHead',
    h.pump.shutOffHead,
    'the shut-off head',
  );
  checkPositive(
    problems,
    'pump_bad_curve',
    'hydraulics.pump.curveCoefficient',
    h.pump.curveCoefficient,
    'the pump curve coefficient',
  );
  for (const [name, value] of [
    ['hydraulicEfficiency', h.pump.hydraulicEfficiency],
    ['motorEfficiency', h.pump.motorEfficiency],
  ] as const) {
    if (!finite(value) || !(value > 0) || value > 1) {
      problems.push(
        problem(
          'pump_bad_curve',
          `hydraulics.pump.${name}`,
          `an efficiency of ${String(value)} is not in (0, 1]`,
        ),
      );
    }
  }
  checkRange(problems, 'pump_bad_curve', 'hydraulics.pump.speedRangeRpm', h.pump.speedRangeRpm);

  checkIds(
    problems,
    'hydraulics.branches',
    h.branches.map((b) => b.id),
    'branch',
  );
  for (const branch of h.branches) {
    const path = `hydraulics.branches.${branch.id}`;
    const level = spec.sprayLevels.find((l) => l.id === branch.id);
    if (level === undefined) {
      problems.push(
        problem('branch_without_level', path, `branch "${branch.id}" feeds no spray level`),
      );
      continue;
    }
    if (!finite(branch.staticLift) || branch.staticLift < 0) {
      problems.push(
        problem(
          'branch_bad_value',
          `${path}.staticLift`,
          `a static lift of ${String(branch.staticLift)} m`,
        ),
      );
    }
    if (!finite(branch.lossCoefficient) || branch.lossCoefficient < 0) {
      problems.push(
        problem(
          'branch_bad_value',
          `${path}.lossCoefficient`,
          `a loss coefficient of ${String(branch.lossCoefficient)}`,
        ),
      );
    }
    if (!finite(branch.pipeVolume) || branch.pipeVolume < 0) {
      problems.push(
        problem(
          'branch_bad_value',
          `${path}.pipeVolume`,
          `a pipe volume of ${String(branch.pipeVolume)} m^3`,
        ),
      );
    }
    const cdA = sprayLevelCdA(level);
    if (finite(cdA) && cdA > 0 && Math.abs(cdA - branch.statedCdA) > CDA_TOLERANCE * cdA) {
      problems.push(
        problem(
          'cda_mismatch',
          `${path}.statedCdA`,
          `the nozzles of "${branch.id}" add up to C_d A = ${(cdA * 1e6).toFixed(1)} mm2, the branch states ${(branch.statedCdA * 1e6).toFixed(1)} mm2`,
        ),
      );
    }
    if (branch.liftAtPosition !== null) {
      const basket =
        level.mount.kind === 'basket'
          ? spec.baskets.find((b) => level.mount.kind === 'basket' && b.id === level.mount.basketId)
          : undefined;
      if (
        basket === undefined ||
        !basket.pose.heightPositions.some((p) => p.id === branch.liftAtPosition)
      ) {
        problems.push(
          problem(
            'branch_unknown_position',
            `${path}.liftAtPosition`,
            `no height position "${branch.liftAtPosition}" on the basket that carries "${branch.id}"`,
          ),
        );
      }
    }
  }
  for (const level of spec.sprayLevels) {
    if (!h.branches.some((b) => b.id === level.id)) {
      problems.push(
        problem(
          'level_without_branch',
          `sprayLevels.${level.id}`,
          `spray level "${level.id}" has no hydraulic branch`,
        ),
      );
    }
  }

  checkIds(
    problems,
    'hydraulics.diverter.positions',
    h.diverter.positions.map((p) => p.id),
    'diverter position',
  );
  for (const position of h.diverter.positions) {
    for (const feed of position.feeds) {
      if (!h.branches.some((b) => b.id === feed)) {
        problems.push(
          problem(
            'diverter_unknown_branch',
            `hydraulics.diverter.positions.${position.id}`,
            `position "${position.id}" feeds "${feed}", which is not a branch`,
          ),
        );
      }
    }
  }
  checkPattern(spec, problems, 'hydraulics.diverter.defaultPattern', h.diverter.defaultPattern);
  if (!finite(h.diverter.transitionTime) || h.diverter.transitionTime < 0) {
    problems.push(
      problem(
        'diverter_bad_value',
        'hydraulics.diverter.transitionTime',
        `a transition time of ${String(h.diverter.transitionTime)} s`,
      ),
    );
  } else {
    checkDwell(spec, problems, 'hydraulics.diverter.defaultPattern', h.diverter.defaultPattern);
  }

  for (const [name, value, what] of [
    ['hydraulics.fill.inletFlow', h.fill.inletFlow, 'the inlet flow'],
    ['hydraulics.drain.flow', h.drain.flow, 'the drain flow'],
  ] as const) {
    if (!finite(value) || !(value > 0)) {
      problems.push(
        problem('non_positive_flow', name, `${what} must be positive, not ${String(value)}`),
      );
    } else if (value < PLAUSIBLE_FLOW[0] || value > PLAUSIBLE_FLOW[1]) {
      problems.push(
        problem(
          'flow_out_of_range',
          name,
          `${what} is ${(value * 60000).toPrecision(3)} L/min, outside ${(PLAUSIBLE_FLOW[0] * 60000).toFixed(1)} to ${(PLAUSIBLE_FLOW[1] * 60000).toFixed(0)} L/min (a value in the wrong unit?)`,
        ),
      );
    }
  }
  if (h.fill.prestoreVolume !== null) {
    checkPositive(
      problems,
      'fill_bad_value',
      'hydraulics.fill.prestoreVolume',
      h.fill.prestoreVolume,
      'the volume of the pre-store tank',
    );
    if (h.fill.prestoreDischargeFlow === null) {
      problems.push(
        problem(
          'non_positive_flow',
          'hydraulics.fill.prestoreDischargeFlow',
          'a machine with a pre-store tank needs its discharge flow',
        ),
      );
    } else {
      checkPositive(
        problems,
        'non_positive_flow',
        'hydraulics.fill.prestoreDischargeFlow',
        h.fill.prestoreDischargeFlow,
        'the discharge flow of the pre-store tank',
      );
    }
    const tank = spec.drying.heatExchanger?.volume ?? null;
    if (tank === null || Math.abs(tank - h.fill.prestoreVolume) > 1e-9) {
      problems.push(
        problem(
          'prestore_tank_mismatch',
          'hydraulics.fill.prestoreVolume',
          'the pre-store volume is not the volume of the heat exchanger',
        ),
      );
    }
  }
  checkPositive(
    problems,
    'inventory_bad_value',
    'hydraulics.inventory.minSumpVolume',
    h.inventory.minSumpVolume,
    'the minimum sump volume',
  );
  for (const [name, value] of [
    ['flightTime', h.inventory.flightTime],
    ['returnTime', h.inventory.returnTime],
    ['carryOver', h.inventory.carryOver],
  ] as const) {
    if (!finite(value) || value < 0) {
      problems.push(
        problem(
          'inventory_bad_value',
          `hydraulics.inventory.${name}`,
          `${name} is ${String(value)}`,
        ),
      );
    }
  }
  if (
    !finite(h.inventory.topUpVolume) ||
    h.inventory.topUpVolume < 0 ||
    !Number.isInteger(h.inventory.maxTopUpsPerPhase) ||
    h.inventory.maxTopUpsPerPhase < 0
  ) {
    problems.push(
      problem(
        'inventory_bad_value',
        'hydraulics.inventory.topUpVolume',
        'the top-up needs a volume that is not negative and a whole number of top-ups per phase',
      ),
    );
  }
  for (const phase of h.inventory.levelCheckIn) {
    if (!(PROGRAMME_PHASES as readonly string[]).includes(phase)) {
      problems.push(
        problem(
          'inventory_bad_value',
          'hydraulics.inventory.levelCheckIn',
          `"${phase}" is not a programme phase (${PROGRAMME_PHASES.join(', ')})`,
        ),
      );
    }
  }
  if (problems.length > before) return false;

  // Every fed branch must pass water at the rated speed, and every arm must turn its own way.
  const combos = heightCombinations(spec);
  for (const position of h.diverter.positions) {
    if (position.feeds.length === 0) continue;
    const findings: ComboFinding[] = [];
    for (const combo of combos) {
      const where = describeCombo(combo);
      const point = hydraulicOperatingPoint(spec, position.id, h.pump.ratedSpeedRpm, {
        basketHeights: combo,
      });
      for (const branch of point.branches) {
        if (!(branch.flow > 0)) {
          findings.push({
            code: 'non_positive_flow',
            path: `hydraulics.diverter.positions.${position.id}`,
            text: `branch "${branch.id}" passes no water in position "${position.id}" at ${h.pump.ratedSpeedRpm} rpm`,
            combo: where,
          });
          continue;
        }
        const level = spec.sprayLevels.find((l) => l.id === branch.id);
        if (level === undefined || level.kind !== 'arm') continue;
        const state = armSteadyState(level, branch.armPressure);
        if (state.drive < 0) {
          findings.push({
            code: 'arm_drive_reversed',
            path: `sprayLevels.${level.id}.sense`,
            text: `the jets of arm "${level.id}" push it against its declared sense (drive ${state.drive.toFixed(4)} N m in position "${position.id}")`,
            combo: where,
          });
        } else if (state.stalled) {
          findings.push({
            code: 'arm_does_not_turn',
            path: `sprayLevels.${level.id}`,
            text: `arm "${level.id}" does not turn in position "${position.id}" at ${h.pump.ratedSpeedRpm} rpm: drive ${state.drive.toFixed(4)} N m against ${state.staticFriction.toFixed(4)} N m of friction`,
            combo: where,
          });
        }
      }
    }
    reportComboFindings(problems, findings, combos.length);
  }

  // An arm whose friction was tuned to a speed must turn at about that speed where it was
  // tuned: at the rated pump speed, in the first position of the default pattern that feeds it,
  // with the baskets at their default heights.
  for (const level of spec.sprayLevels) {
    if (level.kind !== 'arm' || level.designSpeed === null) continue;
    const phase = h.diverter.defaultPattern.phases.find((p) =>
      h.diverter.positions.find((q) => q.id === p.position)?.feeds.includes(level.id),
    );
    if (phase === undefined) continue;
    const point = hydraulicOperatingPoint(spec, phase.position, h.pump.ratedSpeedRpm, {
      basketHeights: spec.defaultConfig.basketHeights,
    });
    const branch = point.branches.find((b) => b.id === level.id);
    if (branch === undefined) continue;
    const omega = armSteadyState(level, branch.armPressure).omega;
    const design = level.designSpeed;
    if (
      !finite(design) ||
      !(design > 0) ||
      Math.abs(omega - design) > DESIGN_SPEED_TOLERANCE * design
    ) {
      problems.push(
        warning(
          'arm_speed_off_design',
          `sprayLevels.${level.id}.designSpeed`,
          `arm "${level.id}" turns at ${((omega * 30) / Math.PI).toFixed(1)} rpm in position "${phase.position}" at ${h.pump.ratedSpeedRpm} rpm, but its design speed is ${((design * 30) / Math.PI).toFixed(1)} rpm (tolerance ${(DESIGN_SPEED_TOLERANCE * 100).toFixed(0)} %): the bearing friction, the nozzle table or the design speed is off`,
        ),
      );
    }
  }
  return true;
}

/** Reports a pattern whose shortest dwell does not outlast the diverter's transition. */
function checkDwell(
  spec: MachineSpec,
  problems: MachineProblem[],
  path: string,
  pattern: DiverterPatternSpec,
): void {
  if (pattern.phases.length < 2) return;
  const shortest = Math.min(...pattern.phases.map((p) => p.duration));
  const transition = spec.hydraulics.diverter.transitionTime;
  if (finite(shortest) && finite(transition) && transition >= shortest) {
    problems.push(
      problem(
        'diverter_transition_too_long',
        path,
        `the diverter takes ${transition} s to move and the pattern dwells only ${shortest} s in a position`,
      ),
    );
  }
}

/** Thermal constants and dosing. */
function checkThermal(spec: MachineSpec, problems: MachineProblem[]): boolean {
  const t = spec.thermal;
  const before = problems.length;
  checkPositive(
    problems,
    'thermal_bad_value',
    'thermal.heaterPower',
    t.heaterPower,
    'the heater power',
  );
  if (!finite(t.heaterDuty) || !(t.heaterDuty > 0) || t.heaterDuty > 1) {
    problems.push(
      problem(
        'thermal_bad_value',
        'thermal.heaterDuty',
        `a heater duty of ${String(t.heaterDuty)} is not in (0, 1]`,
      ),
    );
  }
  checkPositive(
    problems,
    'thermal_bad_value',
    'thermal.machineHeatCapacity',
    t.machineHeatCapacity,
    'the heat capacity of the machine',
  );
  for (const [name, value] of [
    ['liquorLoadConductance', t.liquorLoadConductance],
    ['liquorMachineConductance', t.liquorMachineConductance],
    ['liquorMachineConductanceIdle', t.liquorMachineConductanceIdle],
    ['loadMachineConductanceIdle', t.loadMachineConductanceIdle],
    ['cabinetConductance', t.cabinetConductance],
    ['referenceLoadHeatCapacity', t.referenceLoadHeatCapacity],
  ] as const) {
    if (!finite(value) || value < 0) {
      problems.push(problem('thermal_bad_value', `thermal.${name}`, `${name} is ${String(value)}`));
    }
  }
  if (!finite(t.inletTemperature) || !finite(t.ambientTemperature)) {
    problems.push(
      problem('thermal_bad_value', 'thermal', 'the inlet and ambient temperatures must be numbers'),
    );
  }
  const tank = spec.drying.heatExchanger;
  if (
    tank !== null &&
    tank.volume !== null &&
    tank.wallConductance !== null &&
    tank.wallConductance < 0
  ) {
    problems.push(
      problem(
        'thermal_bad_value',
        'drying.heatExchanger.wallConductance',
        'the wall conductance must not be negative',
      ),
    );
  }
  const dosing = spec.dosing;
  if (
    !(dosing.detergentMass >= 0) ||
    !(dosing.rinseAidVolume >= 0) ||
    !(dosing.detergentReleaseDelay >= 0) ||
    (dosing.rinseAidDelay !== null && !(dosing.rinseAidDelay >= 0))
  ) {
    problems.push(problem('dosing_bad_value', 'dosing', 'doses and delays must not be negative'));
  } else {
    if (
      dosing.detergentMass < PLAUSIBLE_DETERGENT_MASS[0] ||
      dosing.detergentMass > PLAUSIBLE_DETERGENT_MASS[1]
    ) {
      problems.push(
        problem(
          'dosing_bad_value',
          'dosing.detergentMass',
          `a detergent dose of ${(dosing.detergentMass * 1000).toPrecision(3)} g is outside ${PLAUSIBLE_DETERGENT_MASS[0] * 1000} to ${PLAUSIBLE_DETERGENT_MASS[1] * 1000} g (a value in the wrong unit?)`,
        ),
      );
    }
    if (dosing.rinseAidVolume > MAX_RINSE_AID_VOLUME) {
      problems.push(
        problem(
          'dosing_bad_value',
          'dosing.rinseAidVolume',
          `a rinse-aid dose of ${(dosing.rinseAidVolume * 1e6).toPrecision(3)} mL is more than ${MAX_RINSE_AID_VOLUME * 1e6} mL (a value in the wrong unit?)`,
        ),
      );
    }
  }
  if (
    dosing.rinseAidMinTemperature !== null &&
    (!finite(dosing.rinseAidMinTemperature) ||
      dosing.rinseAidMinTemperature > MAX_TARGET_TEMPERATURE)
  ) {
    problems.push(
      problem(
        'dosing_bad_value',
        'dosing.rinseAidMinTemperature',
        `a rinse-aid temperature of ${String(dosing.rinseAidMinTemperature)} C`,
      ),
    );
  }
  if (
    t.heaterCutOut !== null &&
    (!finite(t.heaterCutOut) || t.heaterCutOut <= t.inletTemperature)
  ) {
    problems.push(
      problem(
        'thermal_bad_value',
        'thermal.heaterCutOut',
        `a heater cut-out of ${String(t.heaterCutOut)} C is not above the inlet temperature`,
      ),
    );
  }
  if (!finite(spec.drying.defaultDuration) || spec.drying.defaultDuration < 0) {
    problems.push(
      problem(
        'thermal_bad_value',
        'drying.defaultDuration',
        `a default drying time of ${String(spec.drying.defaultDuration)} s`,
      ),
    );
  }
  return problems.length === before;
}

/** One step of a programme: well formed and referring only to what the machine has. */
function checkStep(
  spec: MachineSpec,
  problems: MachineProblem[],
  path: string,
  step: ProgrammeStep,
): boolean {
  const before = problems.length;
  if (!PROGRAMME_PHASES.includes(step.phase)) {
    problems.push(problem('step_bad_phase', path, `unknown phase ${JSON.stringify(step.phase)}`));
  }
  const duration = (value: number | null, required: boolean): void => {
    if (value === null) {
      if (required) problems.push(problem('step_bad_duration', path, 'the step needs a duration'));
      return;
    }
    if (!finite(value) || value < 0) {
      problems.push(problem('step_bad_duration', path, `a duration of ${String(value)} s`));
    }
  };
  const pumped = (pumpRpm: number, given: DiverterPatternSpec | null): void => {
    const pattern = given ?? spec.hydraulics.diverter.defaultPattern;
    const [low, high] = spec.hydraulics.pump.speedRangeRpm;
    if (!finite(pumpRpm) || !(pumpRpm > 0)) {
      problems.push(problem('step_bad_pump_speed', path, `a pump speed of ${String(pumpRpm)} rpm`));
    } else if (pumpRpm < low || pumpRpm > high) {
      problems.push(
        problem(
          'step_pump_speed_out_of_range',
          path,
          `${pumpRpm} rpm is outside the pump's range of ${low} to ${high} rpm`,
        ),
      );
    }
    // The default pattern is checked once, with the diverter.
    if (given !== null && checkPattern(spec, problems, `${path}.diverter`, given)) {
      checkDwell(spec, problems, `${path}.diverter`, given);
    }
  };
  const fills = (
    list: readonly { at: number; volume: number; relative?: boolean }[],
    stepLength: number | null,
  ): void => {
    for (const fill of list) {
      if (!finite(fill.volume) || !(fill.volume > 0)) {
        problems.push(
          problem('step_bad_volume', path, `a pre-store fill of ${String(fill.volume)} m^3`),
        );
      }
      const length = fill.relative === true ? 1 : stepLength;
      if (!finite(fill.at) || fill.at < 0 || (length !== null && fill.at > length)) {
        problems.push(
          problem(
            'step_bad_fill_time',
            path,
            fill.relative === true
              ? `a pre-store fill at the fraction ${String(fill.at)} of its step`
              : `a pre-store fill ${String(fill.at)} s into a step of ${String(length)} s`,
          ),
        );
      }
    }
  };
  switch (step.kind) {
    case 'drain':
      duration(step.duration, true);
      if (step.volume !== null && (!finite(step.volume) || !(step.volume > 0))) {
        problems.push(
          problem('step_bad_volume', path, `a partial drain of ${String(step.volume)} m^3`),
        );
      }
      break;
    case 'fill':
      duration(step.duration, false);
      if (step.sources.length === 0)
        problems.push(problem('step_bad_volume', path, 'a fill with no source'));
      for (const source of step.sources) {
        if (!finite(source.volume) || !(source.volume > 0)) {
          problems.push(
            problem(
              'step_bad_volume',
              path,
              `a fill of ${String(source.volume)} m^3 from the ${source.from}`,
            ),
          );
        }
      }
      fills(step.prestoreFills, step.duration);
      break;
    case 'circulate':
      duration(step.duration, true);
      pumped(step.pumpRpm, step.diverter);
      fills(step.prestoreFills, step.duration);
      break;
    case 'heat':
      duration(step.duration, false);
      pumped(step.pumpRpm, step.diverter);
      fills(step.prestoreFills, step.duration);
      if (
        !finite(step.target) ||
        step.target <= spec.thermal.inletTemperature ||
        step.target > MAX_TARGET_TEMPERATURE
      ) {
        problems.push(
          problem('step_bad_target', path, `a heating target of ${String(step.target)} C`),
        );
      }
      if (!finite(step.timeout) || !(step.timeout > 0)) {
        problems.push(problem('step_bad_duration', path, `a timeout of ${String(step.timeout)} s`));
      }
      break;
    case 'hold':
      duration(step.duration, true);
      pumped(step.pumpRpm, step.diverter);
      fills(step.prestoreFills, step.duration);
      if (step.reheatBand !== null && (step.target === null || !(step.reheatBand > 0))) {
        problems.push(
          problem(
            'step_bad_target',
            path,
            'a hold that reheats needs a target and a positive band',
          ),
        );
      }
      if (step.target !== null && (!finite(step.target) || step.target > MAX_TARGET_TEMPERATURE)) {
        problems.push(
          problem('step_bad_target', path, `a hold target of ${String(step.target)} C`),
        );
      }
      break;
    case 'dose_detergent':
      if (step.phase !== 'main_wash') {
        problems.push(
          problem(
            'dose_in_wrong_phase',
            path,
            `detergent is dosed in the main wash, not in the phase "${step.phase}"`,
          ),
        );
      }
      break;
    case 'dose_rinse_aid':
      if (step.volume !== null && (!finite(step.volume) || !(step.volume > 0))) {
        problems.push(
          problem('step_bad_volume', path, `a rinse-aid dose of ${String(step.volume)} m^3`),
        );
      }
      if (step.phase !== 'final_rinse') {
        problems.push(
          problem(
            'dose_in_wrong_phase',
            path,
            `rinse aid is dosed in the final rinse, not in the phase "${step.phase}"`,
          ),
        );
      }
      break;
    case 'regenerate':
      duration(step.duration, true);
      if (!(step.water >= 0) || !(step.energy >= 0)) {
        problems.push(
          problem('step_bad_volume', path, 'a regeneration with negative water or energy'),
        );
      }
      if (step.pumpRpm !== null) pumped(step.pumpRpm, step.diverter);
      break;
    case 'dry':
      duration(step.duration, false);
      fills(step.prestoreFills, step.duration);
      break;
    default:
      problems.push(
        problem(
          'step_unknown_kind',
          path,
          `unknown step kind ${JSON.stringify((step as { kind?: unknown }).kind)}`,
        ),
      );
  }
  return problems.length === before;
}

/** One programme: its steps, and the timeline it expands to against what it declares. */
function checkProgramme(
  spec: MachineSpec,
  problems: MachineProblem[],
  programme: ProgrammeSpec,
): void {
  const path = `programmes.${programme.id}`;
  checkIds(
    problems,
    `${path}.steps`,
    programme.steps.map((s) => s.id),
    'step',
  );
  if (programme.steps.length === 0) {
    problems.push(problem('programme_empty', path, 'the programme has no steps'));
    return;
  }
  let wellFormed = true;
  for (const step of programme.steps) {
    if (!checkStep(spec, problems, `${path}.steps.${step.id}`, step)) wellFormed = false;
  }
  // The phases follow one another in their order: a step does not belong to an earlier phase
  // than the step before it (a dose moved into another bath shows up here).
  let reached = 0;
  for (const step of programme.steps) {
    const index = PROGRAMME_PHASES.indexOf(step.phase);
    if (index < 0) continue;
    if (index < reached) {
      problems.push(
        problem(
          'step_phase_out_of_order',
          `${path}.steps.${step.id}`,
          `the step belongs to the phase "${step.phase}" but follows a step of the phase "${String(PROGRAMME_PHASES[reached])}"`,
        ),
      );
      wellFormed = false;
      break;
    }
    reached = index;
  }
  if (
    !(programme.conditions.loadHeatCapacity >= 0) ||
    !(programme.conditions.prestoreInitialVolume >= 0)
  ) {
    problems.push(
      problem(
        'programme_bad_conditions',
        `${path}.conditions`,
        'the conditions must not be negative',
      ),
    );
    wellFormed = false;
  }
  const capacity = spec.hydraulics.fill.prestoreVolume;
  if (programme.conditions.prestoreInitialVolume > (capacity ?? 0) + 1e-9) {
    problems.push(
      problem(
        'programme_bad_conditions',
        `${path}.conditions.prestoreInitialVolume`,
        'more water in the pre-store tank at the start than it holds',
      ),
    );
    wellFormed = false;
  }
  if (!wellFormed) return;

  const timeline = expandProgramme(spec, programme);
  for (const p of timeline.problems) {
    problems.push(problem(`programme_${p.code}`, `${path}.steps.${p.stepId}`, p.message));
  }
  const declared = programme.declared;
  const totals = timeline.totals;
  if (Math.abs(totals.duration - declared.duration) > declared.durationTolerance) {
    problems.push(
      problem(
        'programme_duration_mismatch',
        `${path}.declared.duration`,
        `the steps add up to ${(totals.duration / 60).toFixed(1)} min, the programme declares ${(declared.duration / 60).toFixed(1)} min (tolerance ${(declared.durationTolerance / 60).toFixed(1)} min)`,
      ),
    );
  }
  if (Math.abs(totals.mainsWater - declared.mainsWater) > declared.waterTolerance) {
    problems.push(
      problem(
        'programme_water_mismatch',
        `${path}.declared.mainsWater`,
        `the steps draw ${(totals.mainsWater * 1000).toFixed(2)} L of mains water, the programme declares ${(declared.mainsWater * 1000).toFixed(2)} L`,
      ),
    );
  }
  if (
    declared.energy !== null &&
    Math.abs(totals.energy - declared.energy) > declared.energyTolerance * declared.energy
  ) {
    problems.push(
      problem(
        'programme_energy_mismatch',
        `${path}.declared.energy`,
        `the model gives ${(totals.energy / 3.6e6).toFixed(3)} kWh, the programme declares ${(declared.energy / 3.6e6).toFixed(3)} kWh (tolerance ${(declared.energyTolerance * 100).toFixed(0)} %)`,
      ),
    );
  }
  for (const segment of timeline.segments) {
    for (const interval of segment.diverter) {
      if (!(interval.flow > 0)) {
        problems.push(
          problem(
            'programme_zero_flow',
            `${path}.steps.${segment.stepId}`,
            `no water circulates in diverter position "${interval.position}" at ${segment.pumpRpm} rpm`,
          ),
        );
        break;
      }
    }
  }
  // A fill that takes longer than the row of the programme table allows it.
  for (const step of programme.steps) {
    if (step.kind !== 'fill' || step.duration === null) continue;
    const event = timeline.events.find((e) => e.kind === 'fill' && e.stepId === step.id);
    if (event !== undefined && event.kind === 'fill' && event.duration > step.duration + 0.5) {
      problems.push(
        warning(
          'programme_fill_exceeds_row',
          `${path}.steps.${step.id}`,
          `the fill takes ${event.duration.toFixed(0)} s at the machine's flows, longer than the ${step.duration.toFixed(0)} s its step allows`,
        ),
      );
    }
  }
  // The primary programme is held to the machine's nominal bath volumes.
  if (programme.id === spec.primaryProgramme) {
    const fillOf = (step: ProgrammeStep | undefined): number | null =>
      step === undefined || step.kind !== 'fill'
        ? null
        : step.sources.reduce((sum, source) => sum + source.volume, 0);
    const first = fillOf(programme.steps.find((s) => s.kind === 'fill'));
    const final = fillOf(
      programme.steps.find((s) => s.kind === 'fill' && s.phase === 'final_rinse'),
    );
    for (const [name, found, nominal] of [
      ['firstBathVolume', first, spec.hydraulics.fill.firstBathVolume],
      ['laterBathVolume', final, spec.hydraulics.fill.laterBathVolume],
    ] as const) {
      if (found !== null && Math.abs(found - nominal) > BATH_VOLUME_TOLERANCE) {
        problems.push(
          warning(
            'bath_volume_differs',
            `hydraulics.fill.${name}`,
            `the machine's ${name} is ${(nominal * 1000).toFixed(2)} L, but the ${name === 'firstBathVolume' ? 'first fill' : 'final-rinse fill'} of its primary programme "${programme.id}" is ${(found * 1000).toFixed(2)} L: the programme's steps are what is run`,
          ),
        );
      }
    }
  }
  const last = timeline.segments[timeline.segments.length - 1];
  if (last !== undefined && last.liquorVolume.end > spec.hydraulics.inventory.carryOver + 1e-9) {
    problems.push(
      problem(
        'programme_ends_with_water',
        path,
        `the programme ends with ${(last.liquorVolume.end * 1000).toFixed(2)} L in the tub`,
      ),
    );
  }
  if (
    capacity !== null &&
    Math.abs(totals.prestoreVolumeAtEnd - programme.conditions.prestoreInitialVolume) > 1e-7
  ) {
    problems.push(
      warning(
        'programme_prestore_not_restored',
        path,
        `the pre-store tank holds ${(totals.prestoreVolumeAtEnd * 1000).toFixed(2)} L at the end and ${(programme.conditions.prestoreInitialVolume * 1000).toFixed(2)} L at the start`,
      ),
    );
  }
  const heats = programme.steps.some((s) => s.kind === 'heat' && s.phase === 'main_wash');
  const doses = timeline.events.filter((e) => e.kind === 'detergent_release').length;
  if (heats && doses !== 1) {
    problems.push(
      problem(
        'programme_detergent_count',
        path,
        `a programme with a heated main wash releases detergent once, not ${doses} times`,
      ),
    );
  }
  if (timeline.events.filter((e) => e.kind === 'rinse_aid_release').length > 1) {
    problems.push(problem('programme_rinse_aid_count', path, 'rinse aid is dosed more than once'));
  }
}

/** The programmes of a machine. */
function checkProgrammes(spec: MachineSpec, problems: MachineProblem[]): void {
  checkIds(
    problems,
    'programmes',
    spec.programmes.map((p) => p.id),
    'programme',
  );
  if (!spec.programmes.some((p) => p.id === spec.primaryProgramme)) {
    problems.push(
      problem(
        'primary_programme_missing',
        'primaryProgramme',
        `the machine has no programme "${spec.primaryProgramme}"`,
      ),
    );
  }
  for (const programme of spec.programmes) {
    try {
      checkProgramme(spec, problems, programme);
    } catch (error) {
      problems.push(
        problem(
          'validation_exception',
          `programmes.${programme.id}`,
          `the programme could not be expanded: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}

/** The default configuration: valid, and the one the default states imply. */
function checkDefaultConfig(spec: MachineSpec, problems: MachineProblem[]): void {
  for (const p of validateMachineConfig(spec, spec.defaultConfig)) {
    problems.push({ ...p, path: `defaultConfig.${p.path}` });
  }
  const expected = defaultsAsConfig(spec);
  const key = (rows: readonly { basketId: string; rowId: string }[]): string =>
    rows
      .map((r) => `${r.basketId}.${r.rowId}`)
      .sort()
      .join(',');
  if (key(expected.foldedTineRows) !== key(spec.defaultConfig.foldedTineRows)) {
    problems.push(
      problem(
        'default_config_inconsistent',
        'defaultConfig.foldedTineRows',
        'the folded rows of the default configuration are not the rows whose default state is "folded"',
      ),
    );
  }
  for (const entry of spec.defaultConfig.shelves) {
    const wanted = expected.shelves.find(
      (s) => s.basketId === entry.basketId && s.shelfId === entry.shelfId,
    );
    if (wanted !== undefined && wanted.state !== entry.state) {
      problems.push(
        problem(
          'default_config_inconsistent',
          'defaultConfig.shelves',
          `shelf "${entry.basketId}.${entry.shelfId}" is "${entry.state}" in the default configuration and "${wanted.state}" by its default state`,
        ),
      );
    }
  }
  if (spec.cutleryBasket !== null && spec.defaultConfig.cutleryBasket !== null) {
    const a = spec.cutleryBasket.defaultPlacement;
    const b = spec.defaultConfig.cutleryBasket;
    if (
      a.basketId !== b.basketId ||
      a.longAxis !== b.longAxis ||
      a.centre[0] !== b.centre[0] ||
      a.centre[1] !== b.centre[1]
    ) {
      problems.push(
        problem(
          'default_config_inconsistent',
          'defaultConfig.cutleryBasket',
          'the cutlery basket of the default configuration is not at its default placement',
        ),
      );
    }
  }
  checkCutleryPositions(spec, problems);
}

/** The named positions of the cutlery basket: the default one first, each one a place it can stand. */
function checkCutleryPositions(spec: MachineSpec, problems: MachineProblem[]): void {
  const cutlery = spec.cutleryBasket;
  if (cutlery === null) return;
  const first = cutlery.positions[0];
  const a = cutlery.defaultPlacement;
  if (
    first === undefined ||
    first.placement.basketId !== a.basketId ||
    first.placement.longAxis !== a.longAxis ||
    first.placement.centre[0] !== a.centre[0] ||
    first.placement.centre[1] !== a.centre[1]
  ) {
    problems.push(
      problem(
        'cutlery_position_invalid',
        'cutleryBasket.positions',
        'the first named position of the cutlery basket must be its default placement',
      ),
    );
  }
  const seen = new Set<string>();
  cutlery.positions.forEach((position, i) => {
    const path = `cutleryBasket.positions.${i}`;
    if (seen.has(position.id)) {
      problems.push(
        problem('cutlery_position_invalid', path, `position "${position.id}" is listed twice`),
      );
    }
    seen.add(position.id);
    const basket = spec.baskets.find((b) => b.id === position.placement.basketId);
    if (basket === undefined) {
      problems.push(
        problem(
          'cutlery_position_invalid',
          path,
          `position "${position.id}" is in basket "${position.placement.basketId}", which the machine does not have`,
        ),
      );
      return;
    }
    for (const found of cutleryBasketPlacementProblems(
      basket,
      cutlery,
      spec.defaultConfig,
      position.placement,
    )) {
      problems.push(
        problem('cutlery_position_invalid', path, `position "${position.id}": ${found.message}`),
      );
    }
  });
}

/** Every `SprayLevelSpec` kind this validator knows. */
function isKnownLevel(level: SprayLevelSpec): boolean {
  return level.kind === 'arm' || level.kind === 'fixed';
}

/**
 * Checks a machine specification and returns everything that is wrong with it; an empty list
 * means the description is self-consistent. See the file comment for what is checked. A
 * problem of severity `error` makes the description unusable; a `warning` does not.
 */
export function validateMachineSpec(spec: MachineSpec): MachineProblem[] {
  const problems: MachineProblem[] = [];
  const section = (name: string, check: () => void): void => {
    try {
      check();
    } catch (error) {
      problems.push(
        problem(
          'validation_exception',
          name,
          `the ${name} could not be checked: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  };
  if (typeof spec.id !== 'string' || !isValidId(spec.id)) {
    problems.push(
      problem(
        'bad_id',
        'id',
        `machine id ${JSON.stringify(spec.id)} is not a valid lower-case identifier`,
      ),
    );
  }
  section('provenance', () => checkAllProvenance(spec, problems));
  let tubOk = false;
  section('tub', () => {
    tubOk = checkTub(spec, problems);
  });
  section('spray level kinds', () => {
    for (const level of spec.sprayLevels) {
      if (!isKnownLevel(level)) {
        problems.push(
          problem(
            'level_unknown_kind',
            `sprayLevels.${String((level as { id?: unknown }).id)}`,
            'unknown kind of spray level',
          ),
        );
      }
    }
  });
  if (tubOk) {
    section('baskets', () => checkBaskets(spec, problems));
    section('spray levels', () => checkSprayLevels(spec, problems));
    section('dispenser', () => checkDispenser(spec, problems));
  }
  let hydraulicsOk = false;
  section('hydraulics', () => {
    hydraulicsOk = checkHydraulics(spec, problems);
  });
  let thermalOk = false;
  section('thermal', () => {
    thermalOk = checkThermal(spec, problems);
  });
  if (hydraulicsOk && thermalOk) section('programmes', () => checkProgrammes(spec, problems));
  section('default configuration', () => checkDefaultConfig(spec, problems));
  return problems;
}
