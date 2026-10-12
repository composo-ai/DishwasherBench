/**
 * Looking things up in a machine specification, and applying a `MachineConfig` to it.
 *
 * The specification says what can be adjusted (height positions, hinged rows, folding shelves,
 * where the cutlery basket may stand); a configuration says how the player has set it. These
 * functions resolve the two into positions in the tub frame. SI units; frames as in `types.ts`.
 *
 * Lookups by id throw a RangeError for an id the specification does not contain: that is a
 * programmer error. A configuration supplied by a player is checked with
 * `validateMachineConfig`, which returns problems as values.
 */

import type { Vec3 } from '@spotless/core';
import { SAME_PLACEMENT, cutleryBasketPlacementProblems } from './cutlery-placement.ts';
import type { MachineProblem } from './problems.ts';
import { problem } from './problems.ts';
import type {
  BasketHeightPosition,
  BasketSpec,
  BranchSpec,
  CupShelfSpec,
  CutleryBasketPosition,
  DiverterPositionSpec,
  HolderSpec,
  MachineConfig,
  MachineSpec,
  NozzleSpec,
  SprayArmSpec,
  SprayLevelSpec,
  TineRowSpec,
} from './types.ts';

/** The basket with the given id. Throws a RangeError if the machine has none. */
export function getBasket(spec: MachineSpec, basketId: string): BasketSpec {
  const basket = spec.baskets.find((b) => b.id === basketId);
  if (basket === undefined) {
    throw new RangeError(`getBasket: machine ${spec.id} has no basket "${basketId}"`);
  }
  return basket;
}

/** The spray level with the given id. Throws a RangeError if the machine has none. */
export function getSprayLevel(spec: MachineSpec, levelId: string): SprayLevelSpec {
  const level = spec.sprayLevels.find((l) => l.id === levelId);
  if (level === undefined) {
    throw new RangeError(`getSprayLevel: machine ${spec.id} has no spray level "${levelId}"`);
  }
  return level;
}

/** The rotating spray arm with the given id. Throws a RangeError if it is not a rotating arm. */
export function getSprayArm(spec: MachineSpec, levelId: string): SprayArmSpec {
  const level = getSprayLevel(spec, levelId);
  if (level.kind !== 'arm') {
    throw new RangeError(`getSprayArm: spray level "${levelId}" of ${spec.id} is not an arm`);
  }
  return level;
}

/** The nozzle with the given id on a spray level. Throws a RangeError if there is none. */
export function getNozzle(level: SprayLevelSpec, nozzleId: string): NozzleSpec {
  const nozzle = level.nozzles.find((n) => n.id === nozzleId);
  if (nozzle === undefined) {
    throw new RangeError(`getNozzle: spray level "${level.id}" has no nozzle "${nozzleId}"`);
  }
  return nozzle;
}

/** The hydraulic branch with the given id. Throws a RangeError if the machine has none. */
export function getBranch(spec: MachineSpec, branchId: string): BranchSpec {
  const branch = spec.hydraulics.branches.find((b) => b.id === branchId);
  if (branch === undefined) {
    throw new RangeError(`getBranch: machine ${spec.id} has no branch "${branchId}"`);
  }
  return branch;
}

/** The diverter position with the given id. Throws a RangeError if the machine has none. */
export function getDiverterPosition(spec: MachineSpec, positionId: string): DiverterPositionSpec {
  const position = spec.hydraulics.diverter.positions.find((p) => p.id === positionId);
  if (position === undefined) {
    throw new RangeError(
      `getDiverterPosition: machine ${spec.id} has no diverter position "${positionId}"`,
    );
  }
  return position;
}

/** The tine row with the given id in a basket. Throws a RangeError if there is none. */
export function getTineRow(basket: BasketSpec, rowId: string): TineRowSpec {
  const row = basket.tineRows.find((r) => r.id === rowId);
  if (row === undefined) {
    throw new RangeError(`getTineRow: basket "${basket.id}" has no tine row "${rowId}"`);
  }
  return row;
}

/**
 * The height position a configuration puts a basket in: the configured one, else the one of
 * the machine's default configuration, else the basket's first (highest) position. Throws a
 * RangeError if the configuration names a position the basket does not have.
 */
export function basketHeightPosition(
  spec: MachineSpec,
  basketId: string,
  basketHeights: Readonly<Record<string, string>> = spec.defaultConfig.basketHeights,
): BasketHeightPosition {
  const basket = getBasket(spec, basketId);
  const wanted = basketHeights[basketId] ?? spec.defaultConfig.basketHeights[basketId];
  const position =
    wanted === undefined
      ? basket.pose.heightPositions[0]
      : basket.pose.heightPositions.find((p) => p.id === wanted);
  if (position === undefined) {
    throw new RangeError(
      `basketHeightPosition: basket "${basketId}" of ${spec.id} has no height position "${String(wanted)}"`,
    );
  }
  return position;
}

/**
 * Origin of a basket's rack frame in the tub frame with the basket pushed in, metres: the
 * front-left corner of its outer plan rectangle at the top surface of its base grid, at the
 * configured height position.
 */
export function basketOrigin(
  spec: MachineSpec,
  basketId: string,
  config: MachineConfig = spec.defaultConfig,
): Vec3 {
  const basket = getBasket(spec, basketId);
  const position = basketHeightPosition(spec, basketId, config.basketHeights);
  return [basket.pose.originXY[0], basket.pose.originXY[1], position.originZ];
}

/**
 * Tub-frame z that the heights of a spray level are measured from: 0 for a level fixed to the
 * tub, and the rack-frame origin of the carrying basket at its configured height position for
 * a level that hangs under a basket. Metres.
 */
export function sprayLevelDatumZ(
  spec: MachineSpec,
  level: SprayLevelSpec,
  basketHeights: Readonly<Record<string, string>> = spec.defaultConfig.basketHeights,
): number {
  if (level.mount.kind === 'tub') return 0;
  return basketHeightPosition(spec, level.mount.basketId, basketHeights).originZ;
}

/**
 * Static lift of a branch above the sump level at the configured basket heights, metres. A
 * branch that feeds a level carried by an adjustable basket rises and falls with the basket:
 * its `staticLift` holds at `liftAtPosition`.
 */
export function branchStaticLift(
  spec: MachineSpec,
  branch: BranchSpec,
  basketHeights: Readonly<Record<string, string>> = spec.defaultConfig.basketHeights,
): number {
  if (branch.liftAtPosition === null) return branch.staticLift;
  const level = spec.sprayLevels.find((l) => l.id === branch.id);
  if (level === undefined || level.mount.kind !== 'basket') return branch.staticLift;
  const basket = getBasket(spec, level.mount.basketId);
  const reference = basket.pose.heightPositions.find((p) => p.id === branch.liftAtPosition);
  if (reference === undefined) return branch.staticLift;
  const actual = basketHeightPosition(spec, basket.id, basketHeights);
  return branch.staticLift + (actual.originZ - reference.originZ);
}

/** Whether a configuration has a tine row folded down. A fixed row is never folded. */
export function isTineRowFolded(
  spec: MachineSpec,
  config: MachineConfig,
  basketId: string,
  rowId: string,
): boolean {
  const row = getTineRow(getBasket(spec, basketId), rowId);
  if (row.hinge === null) return false;
  return config.foldedTineRows.some((r) => r.basketId === basketId && r.rowId === rowId);
}

/** The cup shelf or folding holder of a basket with the given id, or undefined. */
function findShelf(basket: BasketSpec, shelfId: string): CupShelfSpec | HolderSpec | undefined {
  return (
    basket.cupShelves.find((s) => s.id === shelfId) ??
    basket.holders.find((h) => h.id === shelfId && h.folds)
  );
}

/**
 * State of a folding cup shelf or holder in a configuration: the configured state, else the
 * shelf's default state. Throws a RangeError for an id that is not a folding shelf or holder.
 */
export function shelfState(
  spec: MachineSpec,
  config: MachineConfig,
  basketId: string,
  shelfId: string,
): 'up' | 'down' {
  const shelf = findShelf(getBasket(spec, basketId), shelfId);
  if (shelf === undefined) {
    throw new RangeError(
      `shelfState: basket "${basketId}" of ${spec.id} has no folding shelf "${shelfId}"`,
    );
  }
  const set = config.shelves.find((s) => s.basketId === basketId && s.shelfId === shelfId);
  return set === undefined ? shelf.defaultState : set.state;
}

/**
 * The configuration in which everything is as the specification's defaults say: each row in
 * its `defaultState`, each shelf in its `defaultState`, the cutlery basket at its
 * `defaultPlacement`, and each adjustable basket at the position the machine's `defaultConfig`
 * names. For a consistent specification this equals `spec.defaultConfig`; `validateMachineSpec`
 * checks that it does.
 */
export function defaultsAsConfig(spec: MachineSpec): MachineConfig {
  const basketHeights: Record<string, string> = {};
  const foldedTineRows: { basketId: string; rowId: string }[] = [];
  const shelves: { basketId: string; shelfId: string; state: 'up' | 'down' }[] = [];
  for (const basket of spec.baskets) {
    if (basket.pose.heightPositions.length > 1) {
      basketHeights[basket.id] = basketHeightPosition(spec, basket.id).id;
    }
    for (const row of basket.tineRows) {
      if (row.hinge !== null && row.defaultState === 'folded') {
        foldedTineRows.push({ basketId: basket.id, rowId: row.id });
      }
    }
    for (const shelf of basket.cupShelves) {
      shelves.push({ basketId: basket.id, shelfId: shelf.id, state: shelf.defaultState });
    }
    for (const holder of basket.holders) {
      if (holder.folds) {
        shelves.push({ basketId: basket.id, shelfId: holder.id, state: holder.defaultState });
      }
    }
  }
  return {
    basketHeights,
    foldedTineRows,
    shelves,
    cutleryBasket: spec.cutleryBasket === null ? null : spec.cutleryBasket.defaultPlacement,
  };
}

/**
 * Checks a configuration against a machine: every basket, height position, tine row and shelf
 * it names must exist, only hinged rows can be folded, and the cutlery basket must stand inside
 * the basket it is put in with every rail and tine under it in one of its tunnels
 * (`cutleryBasketPlacementProblems`). Returns the problems found; an empty list means the
 * configuration can be applied.
 */
export function validateMachineConfig(spec: MachineSpec, config: MachineConfig): MachineProblem[] {
  const problems: MachineProblem[] = [];
  const basketOf = (id: string): BasketSpec | undefined => spec.baskets.find((b) => b.id === id);

  for (const basketId of Object.keys(config.basketHeights).sort()) {
    const basket = basketOf(basketId);
    const positionId = config.basketHeights[basketId];
    if (basket === undefined) {
      problems.push(
        problem('config_unknown_basket', `basketHeights.${basketId}`, `no basket "${basketId}"`),
      );
    } else if (!basket.pose.heightPositions.some((p) => p.id === positionId)) {
      problems.push(
        problem(
          'config_unknown_height_position',
          `basketHeights.${basketId}`,
          `basket "${basketId}" has no height position "${String(positionId)}" (it has ${basket.pose.heightPositions.map((p) => p.id).join(', ')})`,
        ),
      );
    }
  }

  const seenRows = new Set<string>();
  config.foldedTineRows.forEach((ref, i) => {
    const path = `foldedTineRows.${i}`;
    const basket = basketOf(ref.basketId);
    const row = basket?.tineRows.find((r) => r.id === ref.rowId);
    const key = `${ref.basketId}.${ref.rowId}`;
    if (basket === undefined) {
      problems.push(problem('config_unknown_basket', path, `no basket "${ref.basketId}"`));
    } else if (row === undefined) {
      problems.push(
        problem(
          'config_unknown_tine_row',
          path,
          `basket "${ref.basketId}" has no tine row "${ref.rowId}"`,
        ),
      );
    } else if (row.hinge === null) {
      problems.push(
        problem('config_row_not_hinged', path, `tine row "${key}" is fixed and cannot be folded`),
      );
    } else if (seenRows.has(key)) {
      problems.push(problem('config_duplicate', path, `tine row "${key}" is listed twice`));
    }
    seenRows.add(key);
  });

  const seenShelves = new Set<string>();
  config.shelves.forEach((entry, i) => {
    const path = `shelves.${i}`;
    const basket = basketOf(entry.basketId);
    const key = `${entry.basketId}.${entry.shelfId}`;
    if (basket === undefined) {
      problems.push(problem('config_unknown_basket', path, `no basket "${entry.basketId}"`));
    } else if (findShelf(basket, entry.shelfId) === undefined) {
      problems.push(
        problem(
          'config_unknown_shelf',
          path,
          `basket "${entry.basketId}" has no folding shelf or holder "${entry.shelfId}"`,
        ),
      );
    } else if (seenShelves.has(key)) {
      problems.push(problem('config_duplicate', path, `shelf "${key}" is listed twice`));
    }
    if (entry.state !== 'up' && entry.state !== 'down') {
      problems.push(
        problem(
          'config_bad_state',
          path,
          `state must be "up" or "down", not "${String(entry.state)}"`,
        ),
      );
    }
    seenShelves.add(key);
  });

  const placement = config.cutleryBasket;
  if (placement !== null) {
    const cutlery = spec.cutleryBasket;
    const basket = basketOf(placement.basketId);
    if (cutlery === null) {
      problems.push(
        problem('config_no_cutlery_basket', 'cutleryBasket', 'this machine has no cutlery basket'),
      );
    } else if (basket === undefined) {
      problems.push(
        problem('config_unknown_basket', 'cutleryBasket', `no basket "${placement.basketId}"`),
      );
    } else if (
      !Number.isFinite(placement.centre[0]) ||
      !Number.isFinite(placement.centre[1]) ||
      (placement.longAxis !== 'x' && placement.longAxis !== 'y')
    ) {
      problems.push(
        problem(
          'config_bad_state',
          'cutleryBasket',
          'the cutlery basket needs a finite centre and a long axis of "x" or "y"',
        ),
      );
    } else {
      problems.push(...cutleryBasketPlacementProblems(basket, cutlery, config, placement));
    }
  }
  return problems;
}

/**
 * Id of the named position (`CutleryBasketSpec.positions`) the cutlery basket stands at in a
 * configuration; null when it is taken out, stands somewhere that has no name, or the machine
 * has no cutlery basket.
 */
export function cutleryBasketPositionId(spec: MachineSpec, config: MachineConfig): string | null {
  const placement = config.cutleryBasket;
  if (spec.cutleryBasket === null || placement === null) return null;
  const found = spec.cutleryBasket.positions.find(
    (position) =>
      position.placement.basketId === placement.basketId &&
      position.placement.longAxis === placement.longAxis &&
      Math.abs(position.placement.centre[0] - placement.centre[0]) < SAME_PLACEMENT &&
      Math.abs(position.placement.centre[1] - placement.centre[1]) < SAME_PLACEMENT,
  );
  return found?.id ?? null;
}

/**
 * The named positions at which the cutlery basket can stand in a configuration: those of the
 * specification that `validateMachineConfig` accepts with the rows folded as the configuration
 * has them (folding a row under the basket's feet takes a position away).
 */
export function cutleryBasketPositions(
  spec: MachineSpec,
  config: MachineConfig = spec.defaultConfig,
): CutleryBasketPosition[] {
  const cutlery = spec.cutleryBasket;
  if (cutlery === null) return [];
  return cutlery.positions.filter((position) => {
    const basket = spec.baskets.find((b) => b.id === position.placement.basketId);
    return (
      basket !== undefined &&
      cutleryBasketPlacementProblems(basket, cutlery, config, position.placement).length === 0
    );
  });
}

/**
 * The configuration with the cutlery basket stood at a named position, or taken out of the
 * machine when `positionId` is null. Throws a RangeError for an id the machine does not have;
 * whether the basket can stand there with the rows as they are is for `validateMachineConfig`.
 */
export function withCutleryBasketAt(
  spec: MachineSpec,
  config: MachineConfig,
  positionId: string | null,
): MachineConfig {
  if (positionId === null) return { ...config, cutleryBasket: null };
  const position = spec.cutleryBasket?.positions.find((p) => p.id === positionId);
  if (position === undefined) {
    throw new RangeError(
      `withCutleryBasketAt: machine ${spec.id} has no cutlery basket position "${positionId}"`,
    );
  }
  return { ...config, cutleryBasket: position.placement };
}
