/**
 * Named parameter sets as layers of a wash (docs/design/scope.md, "Calibration is a
 * first-class feature"): what a wash is run with is the registry defaults, then one or more
 * named sets laid over them in order (an anchored or fitted set, a hand-made one), then the
 * composition of the detergent that is dosed. The result of the wash records which sets these
 * were (`WashProvenance.paramSets`).
 *
 * How a detergent layer is laid over a fitted one. A detergent set states the composition of
 * a product as differences from the registry defaults, which are the reference detergent. A
 * fitted set may have moved one of those same keys to make the REFERENCE detergent agree with
 * a record (the anchoring moves `liq.xProtease`): that is a correction of the model's scale
 * for the key, not a property of the reference product. So where a detergent layer and an
 * earlier set both give a positive scalar key, the detergent's value is taken relative to the
 * registry default and applied to the fitted value (fitted x stated / default), held inside
 * the registered range: "scale the fitted value, do not replace it"
 * (docs/research/detergent-finish-ultimate.md). Every other key of a later layer replaces the
 * earlier value.
 *
 * Pure: reading the files and checking their stored hashes is in `@spotless/sim-core/node`.
 */

import { canonicalHash } from '@spotless/core';
import type { ParamRegistry, ParamValue } from '@spotless/sim-params';

/** One named parameter set laid over the registry defaults. */
export interface ParamLayer {
  /** Name of the set (the `provenance.name` of its file). */
  readonly name: string;
  /**
   * `set`: values that replace what is below them. `detergent`: the composition of a product,
   * stated against the registry defaults (see the file comment).
   */
  readonly role: 'set' | 'detergent';
  readonly overrides: Readonly<Record<string, ParamValue>>;
  /** How the values were obtained (`provenance.origin` of the file). */
  readonly origin?: string;
  /** The file it was read from, as given. */
  readonly file?: string;
  /**
   * True when the hashes stored in the file do not match the registry it was read against
   * and the caller accepted that knowingly.
   */
  readonly stale?: boolean;
}

/** What a wash result records about one parameter set it was run with. */
export interface ParamSetRecord {
  readonly name: string;
  readonly role: 'set' | 'detergent';
  readonly origin: string;
  /** `sha256:` hash of the overrides of the set as read (canonical JSON). */
  readonly overridesHash: string;
  /** Number of keys it overrides. */
  readonly keys: number;
  /** True when it was read although its stored hashes were stale. */
  readonly stale: boolean;
  /** Keys of a detergent layer that were applied as a ratio to a fitted value. */
  readonly scaled: readonly string[];
  readonly file?: string;
}

/** The parameters of a wash composed from layers, with the record of each. */
export interface ComposedParams {
  /** The overrides on the registry defaults: what `WashInput.params` takes. */
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly records: readonly ParamSetRecord[];
}

/**
 * Lays `layers` over the registry defaults in order (see the file comment for the one rule
 * that is not replacement). Values are not validated here: `wash` validates the result.
 */
export function composeParamLayers(
  registry: ParamRegistry,
  layers: readonly ParamLayer[],
): ComposedParams {
  const params: Record<string, ParamValue> = {};
  /** Keys a `set` layer has given so far. */
  const fitted = new Set<string>();
  const records: ParamSetRecord[] = [];
  for (const layer of layers) {
    const scaled: string[] = [];
    for (const key of Object.keys(layer.overrides).sort()) {
      const value = layer.overrides[key] as ParamValue;
      const below = params[key];
      const def = registry.find(key);
      if (
        layer.role === 'detergent' &&
        fitted.has(key) &&
        typeof value === 'number' &&
        typeof below === 'number' &&
        def !== undefined &&
        def.kind !== 'enum' &&
        def.kind !== 'vector' &&
        typeof def.default === 'number' &&
        def.default > 0
      ) {
        params[key] = Math.min(def.max, Math.max(def.min, (below * value) / def.default));
        scaled.push(key);
      } else {
        params[key] = value;
      }
      if (layer.role === 'set') fitted.add(key);
    }
    records.push({
      name: layer.name,
      role: layer.role,
      origin: layer.origin ?? 'manual',
      overridesHash: canonicalHash(layer.overrides),
      keys: Object.keys(layer.overrides).length,
      stale: layer.stale === true,
      scaled,
      ...(layer.file === undefined ? {} : { file: layer.file }),
    });
  }
  return { params, records };
}

/** The detergent a wash doses. */
export interface WashDetergent {
  /** Name of the product, for the record. */
  readonly name: string;
  /** Mass dosed, kg: it replaces the machine's own `dosing.detergentMass`. */
  readonly dose: number;
}
