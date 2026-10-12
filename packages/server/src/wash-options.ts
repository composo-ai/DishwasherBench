/**
 * The options that say which wash a command runs: the tier and the parameters. One definition
 * for the game server's command line (`spotless-simd serve`) and the benchmark harness's
 * (`spotless-bench run`), so that both spell them the same way and a wash started by either
 * can be started by the other.
 *
 *   --wash-tier official|fast        the tier (the harness also takes --tier)
 *   --wash-params <set.json>...      parameter-set files laid over the registry defaults in order
 *   --detergent <set.json>           the parameter-set file of the detergent's composition
 *   --detergent-name <name>          its name, for the record
 *   --dose-g <grams>                 the mass of the dose
 *   --registry-defaults              the registry defaults and the machine's own dose
 *   --accept-stale-params            wash with a set made for another state of the simulator
 *
 * Without any of them a wash runs at the official tier with the parameters of the machine of
 * the level (`MACHINE_WASH_DEFAULTS` of `@spotless/wash-runner`).
 */

import { resolve } from 'node:path';
import type { WashTier } from '@spotless/session';
import type { WashParamChoice } from '@spotless/wash-runner/contract';

/** The options as `parseArgs` of `node:util` takes them. */
export const WASH_OPTION_FLAGS = {
  'wash-tier': { type: 'string' },
  'wash-params': { type: 'string', multiple: true },
  detergent: { type: 'string' },
  'detergent-name': { type: 'string' },
  'dose-g': { type: 'string' },
  'registry-defaults': { type: 'boolean' },
  'accept-stale-params': { type: 'boolean' },
} as const;

/** The values `parseArgs` gives for {@link WASH_OPTION_FLAGS}. */
export interface WashOptionValues {
  readonly 'wash-tier'?: string | undefined;
  readonly 'wash-params'?: readonly string[] | undefined;
  readonly detergent?: string | undefined;
  readonly 'detergent-name'?: string | undefined;
  readonly 'dose-g'?: string | undefined;
  readonly 'registry-defaults'?: boolean | undefined;
  readonly 'accept-stale-params'?: boolean | undefined;
}

/** What the options ask for, as `ServerOptions` takes it. */
export interface WashOptions {
  readonly washTier?: WashTier;
  readonly washParams?: WashParamChoice;
  readonly acceptStaleParams?: boolean;
}

/** The usage line of the options. */
export const WASH_OPTIONS_USAGE =
  '[--wash-tier official|fast] [--wash-params <set.json>]... [--detergent <set.json> --dose-g <grams> [--detergent-name <name>]] [--registry-defaults] [--accept-stale-params]';

/**
 * Reads the options. Returns what they ask for, or a message saying what is wrong with them.
 * `tier` is the tier named another way (an environment variable, the harness's `--tier`); the
 * option `--wash-tier` wins over it.
 */
export function washOptionsOf(values: WashOptionValues, tier?: string): WashOptions | string {
  const washTier = values['wash-tier'] ?? tier;
  if (washTier !== undefined && washTier !== 'official' && washTier !== 'fast') {
    return `'${washTier}' is not a wash tier (official, fast)`;
  }
  let washParams: WashParamChoice | undefined;
  const named = values['wash-params'] ?? [];
  const dose = values['dose-g'] === undefined ? undefined : Number(values['dose-g']);
  if (dose !== undefined && !(dose >= 0 && Number.isFinite(dose))) {
    return `'${values['dose-g']}' is not a dose in grams`;
  }
  if (values['registry-defaults'] === true) {
    if (named.length > 0 || values.detergent !== undefined || dose !== undefined) {
      return '--registry-defaults goes with no --wash-params, --detergent or --dose-g';
    }
    washParams = 'registry-defaults';
  } else if (named.length > 0 || values.detergent !== undefined || dose !== undefined) {
    if (values.detergent !== undefined && dose === undefined) {
      return '--detergent needs --dose-g (the mass of the dose in grams)';
    }
    washParams = {
      paramSets: named.map((file) => resolve(file)),
      ...(dose === undefined
        ? {}
        : {
            detergent: {
              name: values['detergent-name'] ?? values.detergent ?? 'unnamed detergent',
              dose_g: dose,
              ...(values.detergent === undefined ? {} : { params: resolve(values.detergent) }),
            },
          }),
    };
  }
  return {
    ...(washTier === undefined ? {} : { washTier }),
    ...(washParams === undefined ? {} : { washParams }),
    ...(values['accept-stale-params'] === true ? { acceptStaleParams: true } : {}),
  };
}
