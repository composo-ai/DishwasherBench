/**
 * The tablet's way from the dispenser to where it is caught.
 *
 * When the lid opens the tablet leaves the chamber at `DispenserSpec.tabletExit` and falls. On
 * a machine with a collecting tray it is meant to land in the tray of a basket; otherwise it
 * falls into a basket. This is geometry only: what stands in the way is the loading physics'
 * concern. Tub frame, metres.
 */

import type { Vec3 } from '@spotless/core';
import { basketOrigin, getBasket } from './config.ts';
import type { MachineConfig, MachineSpec, Range } from './types.ts';

/** Where a tablet released by the dispenser goes. Tub frame, metres. */
export interface TabletDrop {
  /** Where it leaves the chamber: the lower lip of the chamber opening. */
  readonly exit: Vec3;
  /** The point straight below the exit at the height at which it is caught. */
  readonly landing: Vec3;
  /** Height it falls, metres. */
  readonly height: number;
  /** `tray`: caught by the rim plane of a collecting tray; `basket`: by the base grid of a basket. */
  readonly caughtBy: 'tray' | 'basket';
  /** Id of the basket that carries the tray or receives the tablet. */
  readonly basketId: string;
  /** Plan extent of the tray (or of the basket) in the tub frame: x and y ranges. */
  readonly target: { readonly x: Range; readonly y: Range };
  /**
   * Horizontal distance by which the vertical drop line misses the target's plan rectangle,
   * metres; 0 when the tablet falls inside it.
   */
  readonly miss: number;
}

/**
 * The vertical drop of a tablet from the chamber to the tray or basket that is meant to catch
 * it, at the configured basket heights (default: the machine's default configuration). Throws
 * a RangeError if the dispenser names a basket or tray the machine does not have;
 * `validateMachineSpec` reports that as a problem.
 */
export function tabletDrop(
  spec: MachineSpec,
  config: MachineConfig = spec.defaultConfig,
): TabletDrop {
  const { tabletExit: exit, tabletTarget: target } = spec.dispenser;
  const basket = getBasket(spec, target.basketId);
  const origin = basketOrigin(spec, basket.id, config);
  let x: Range;
  let y: Range;
  let z: number;
  let caughtBy: 'tray' | 'basket';
  if (target.kind === 'basket_tray') {
    const tray = basket.tabletTray;
    if (tray === null) {
      throw new RangeError(`tabletDrop: basket "${basket.id}" of ${spec.id} has no tablet tray`);
    }
    x = [
      origin[0] + tray.centre[0] - tray.size[0] / 2,
      origin[0] + tray.centre[0] + tray.size[0] / 2,
    ];
    y = [
      origin[1] + tray.centre[1] - tray.size[1] / 2,
      origin[1] + tray.centre[1] + tray.size[1] / 2,
    ];
    z = origin[2] + tray.rimZ;
    caughtBy = 'tray';
  } else {
    x = [origin[0], origin[0] + basket.outline.size[0]];
    y = [origin[1], origin[1] + basket.outline.size[1]];
    z = origin[2];
    caughtBy = 'basket';
  }
  const dx = Math.max(x[0] - exit[0], 0, exit[0] - x[1]);
  const dy = Math.max(y[0] - exit[1], 0, exit[1] - y[1]);
  return {
    exit,
    landing: [exit[0], exit[1], z],
    height: exit[2] - z,
    caughtBy,
    basketId: basket.id,
    target: { x, y },
    miss: Math.hypot(dx, dy),
  };
}
