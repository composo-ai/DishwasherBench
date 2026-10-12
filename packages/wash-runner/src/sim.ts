/**
 * The one place where this package touches the wash simulation (`@spotless/sim-core`): its
 * entry point `wash`, the types of its input and result, its version, the exposure cache on
 * disk, and the GPU device it traces on. Everything else in the package goes through here, so
 * that a change of the simulation's interface is met in one file.
 *
 * The GPU device. The simulation traces its rays on a device. This module makes that device
 * itself (the Dawn bindings of `@spotless/sim-gpu/node`), hands it to the simulation (the
 * `gpu` option of `wash`, and `setExposureGpu` where the simulation still has it, so that the
 * device stays the process's own after it is destroyed), and destroys it when the wash is
 * over: buffers first, then the device, so that the process can end without
 * the bindings tearing down a device that still has work queued. Where there is no adapter
 * (a machine without a GPU) the simulation traces on the CPU and says so in its result.
 */

import * as simulation from '@spotless/sim-core';
import { SIM_VERSION, wash } from '@spotless/sim-core';
import type {
  ItemWashResult,
  WashInput,
  WashItemInput,
  WashOptions,
  WashProgress,
  WashResult,
} from '@spotless/sim-core';
import {
  composeParamFiles,
  createDiskExposureCache,
  loadedExposureSource,
  ParamSetFileError,
  simulationFingerprint,
  StaleParamSetError,
} from '@spotless/sim-core/node';
import type { GpuContext } from '@spotless/sim-gpu';

export type { ItemWashResult, WashInput, WashItemInput, WashOptions, WashProgress, WashResult };
export {
  composeParamFiles,
  createDiskExposureCache,
  loadedExposureSource,
  ParamSetFileError,
  SIM_VERSION,
  simulationFingerprint,
  StaleParamSetError,
  wash,
};

/** One soil of an item as the simulation takes it. */
export type SimSoilRecord = WashItemInput['soils'][number];

/** The stages the simulation reports progress in, in order (its `WASH_STAGES`). */
export const SIM_STAGES: readonly string[] = [...simulation.WASH_STAGES];

/** A device held for one wash. */
export interface WashDevice {
  /** `gpu` when the simulation traces on a device made here, `default` when it finds its own. */
  readonly kind: 'gpu' | 'default';
  /** What to pass to `wash` so that it traces on this device: nothing when it finds its own. */
  readonly washOptions: Pick<WashOptions, 'gpu'>;
  /** Largest total of live buffers on the device so far, bytes; null when not known. */
  peakBytes(): number | null;
  /** Releases the simulation's buffers and destroys the device. Safe to call twice. */
  release(): Promise<void>;
}

type Optional<T> = T | undefined;

/** A function the simulation exports under `name`, or undefined when it has none. */
function exported<F>(name: string): Optional<F> {
  const value = (simulation as unknown as Record<string, unknown>)[name];
  return typeof value === 'function' ? (value as F) : undefined;
}

/**
 * Makes the GPU device of this process and gives it to the simulation. Never throws: without
 * an adapter, or where the simulation takes no device from outside, the simulation is left to
 * find its own and `release` only releases what it can.
 */
export async function acquireWashDevice(): Promise<WashDevice> {
  const setGpu = exported<(gpu: GpuContext | null | undefined) => void>('setExposureGpu');
  const releaseScene = exported<() => Promise<void>>('releaseExposureGpu');
  let context: GpuContext | null = null;
  try {
    const bindings = await import('@spotless/sim-gpu/node');
    context = await bindings.createNodeGpuContext({ sim: SIM_VERSION });
    setGpu?.(context);
  } catch {
    // No adapter, or no bindings on this platform: the simulation decides for itself (it
    // traces on the CPU and says so in its result).
    context = null;
  }
  let released = false;
  return {
    kind: context === null ? 'default' : 'gpu',
    washOptions: context === null ? {} : { gpu: context },
    peakBytes: () => (context === null ? null : context.stats.peakBytes),
    async release() {
      if (released) return;
      released = true;
      try {
        await releaseScene?.();
      } catch {
        // The buffers go with the device below.
      }
      if (context !== null) {
        try {
          await context.drain();
        } catch {
          // A device that was lost has nothing left to drain.
        }
        // The destroyed context stays the simulation's device: a wash that goes on after its
        // device was taken away (an abort) fails at its next use of it instead of quietly
        // making itself another.
        context.destroy();
      }
    },
  };
}

/** The numbers of the simulation's rule for "clean": what a clean item may still carry. */
export interface CleanRule {
  /** Most separate specks of visible soil. */
  readonly maxSpecks: number;
  /** Largest visibly soiled area, mm2. */
  readonly maxAreaMm2: number;
  /** Most water standing in the item's cavities, millilitres. */
  readonly maxWaterMl: number;
  /**
   * Peak upward force of the jets on an item, over its weight, above which the simulation
   * counts the item as likely to be moved; null when the simulation has no such rule.
   */
  readonly liftWarnRatio: number | null;
}

/**
 * The rule the simulation's inspector applies with the parameters as given (default: the
 * registry's own), read from its parameter registry. The report applies its two soil numbers
 * to the inspector's speck count and visible area (`cleanBySoil`); the water number only says
 * when `holds_water` is flagged.
 * Null when the registry no longer has these keys.
 */
export function cleanRule(overrides: WashInput['params'] = {}): CleanRule | null {
  try {
    const params = simulation.createWashParams(overrides);
    let liftWarnRatio: number | null = null;
    try {
      liftWarnRatio = params.get('inspect.liftWarnRatio');
    } catch {
      liftWarnRatio = null;
    }
    return {
      maxSpecks: params.get('inspect.maxSpecks'),
      maxAreaMm2: params.get('inspect.maxAreaMm2'),
      maxWaterMl: params.get('inspect.maxWaterMl'),
      liftWarnRatio,
    };
  } catch {
    return null;
  }
}
