/**
 * Which parameters the game washes with: the named parameter set and the detergent of a
 * machine, as files, and how a caller chooses otherwise.
 *
 * This module imports nothing of the simulation (the server reads it through
 * `@spotless/wash-runner/contract` to key its stored results).
 *
 * The owner's machine washes, by default, with the current anchored set with the owner's
 * capsule laid over it (`packages/calibration/anchors/`, `CURRENT_ANCHORED` of its
 * `src/scenario.ts`; a test of this package checks that the file named below is there and
 * current; docs/calibration/anchoring-v7.md for the set, on the machine with its corrected
 * upper basket; docs/calibration/owner-wash-01-calibration.md for what the owner's first test
 * wash fixed in it, docs/calibration/anchoring-v5.md for the anchoring it rests on;
 * docs/research/detergent-finish-ultimate.md: Finish Powerball Ultimate, 12.9 g). The rinse
 * aid the owner uses is recorded there and not modelled. The file belongs to the calibration
 * side; this is only where the game is told which one is current. When a new anchoring is
 * made, the path below changes with it.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fastTierNote, readTierAgreement } from '@spotless/sim-core/tier-agreement';

/** The directory of the workspace's packages. */
const PACKAGES_DIR = fileURLToPath(new URL('../../', import.meta.url));

/** The detergent of a wash as files and a dose. */
export interface WashDetergentChoice {
  /** Name of the product, for the record. */
  readonly name: string;
  /** Parameter-set file of its composition (absolute, or relative to `packages/`); none: the reference detergent of the registry. */
  readonly params?: string;
  /** Mass of the dose, grams. */
  readonly dose_g: number;
}

/**
 * A part of the verdicts of a parameter set that no measurement or published result stands
 * behind: on one programme, the soils of some model classes. A wash that judges such a soil
 * says so in its report (a note of the job), so that a player, a benchmark and whoever reads
 * a score can tell a verdict the calibration vouches for from one it does not.
 */
export interface WashVerdictCaveat {
  /** Programme id the caveat holds for. */
  readonly programmeId: string;
  /** Model classes of the soil side (`ItemSoilResult.modelClass`) it concerns. */
  readonly soilClasses: readonly string[];
  /** What a player is told, after the list of the items concerned. */
  readonly note: string;
}

/** Named parameter-set files and a detergent. */
export interface WashParamFilesChoice {
  /** Parameter-set files laid over the registry defaults in order (absolute, or relative to `packages/`). */
  readonly paramSets: readonly string[];
  readonly detergent?: WashDetergentChoice;
  /** What the set does not vouch for (see {@link WashVerdictCaveat}). */
  readonly caveats?: readonly WashVerdictCaveat[];
  /**
   * The measured agreement of the fast tier with the official tier under these parameters
   * (absolute, or relative to `packages/`): a `tiers.<set>.json` of the calibration side. The
   * report of every fast wash quotes it ({@link washTierNoteFor}).
   */
  readonly tierAgreement?: string;
  /**
   * The programme the game is scored on with this machine: the one the set is anchored on
   * and whose verdicts carry no caveat.
   */
  readonly scoredProgramme?: string;
}

/**
 * Which parameters a wash is run with:
 *  - `machine-default` (the default): the set and the detergent of {@link MACHINE_WASH_DEFAULTS}
 *    for the machine of the load; the registry defaults for a machine that has none;
 *  - `registry-defaults`: the registry defaults and the machine's own dose of the reference
 *    detergent (what the simulation's own tests run on);
 *  - named files.
 */
export type WashParamChoice = 'machine-default' | 'registry-defaults' | WashParamFilesChoice;

/** The parameter set and the detergent of each machine that has them, by machine id. */
export const MACHINE_WASH_DEFAULTS: Readonly<Record<string, WashParamFilesChoice>> = {
  bosch_smv4hax40g: {
    // The anchored set with the owner's capsule laid over it by the calibration side (the
    // composition of `detergents/finish-powerball-ultimate.json` and its protease level): one
    // file, so no separate composition layer for the detergent here. Since the evening of
    // 11 October 2026 the seventh anchoring: the sixth (the duty of the soak of Eco 50 as the
    // owner's first test wash fixed it, 0.8) fitted again on the machine with its corrected
    // upper basket and the standard loads settled on it. The sixth and the fifth (duty 0.5,
    // contradicted by his wash) are superseded: each says so in its file and no wash reads
    // them as current.
    paramSets: ['calibration/anchors/anchored-v7.owner-capsule.json'],
    tierAgreement: 'calibration/anchors/tiers.anchored-v7.owner-capsule.json',
    // Decision of 10 October 2026 (docs/reference/owner-measurements.md): the game is scored
    // on Eco 50, the programme the set is anchored on. Its verdicts carry no caveat.
    scoredProgramme: 'eco_50',
    detergent: {
      name: 'Finish Powerball Ultimate',
      // docs/research/detergent-finish-ultimate.md: 12.9 g per capsule (unit prices and pack
      // weights), where the reference detergent the machine data assume is dosed at 20 g.
      dose_g: 12.9,
    },
    caveats: [
      {
        // docs/calibration/anchoring-v5.md, owner-wash-01-calibration.md: the set is anchored
        // to published results of an eco programme with the reference detergent and to one
        // wash of the owner's on Eco 50. On his Auto programme with his capsule nearly every
        // egg-yolk item and every glass of heated milk reads dirty however it is loaded, and
        // a tea stain turns on a tenth of one rate; the test institutes grade Auto as high
        // as Eco. No document decides it, and his first wash was on Eco: a wash on Auto does.
        programmeId: 'auto_145',
        soilClasses: ['egg_yolk', 'milk', 'tea'],
        note: 'carry a protein soil (egg, meat, cheese, heated milk, yoghurt) or a stain (tea, coffee, wine). On this programme the verdicts on these soils are not yet backed by a measurement on this machine: they are provisional.',
      },
    ],
  },
};

/** The caveats of the parameters a choice gives for a machine and a programme. */
export function washCaveatsFor(
  machineId: string,
  programmeId: string,
  choice: WashParamChoice = 'machine-default',
): readonly WashVerdictCaveat[] {
  const files =
    choice === 'registry-defaults'
      ? undefined
      : choice === 'machine-default'
        ? MACHINE_WASH_DEFAULTS[machineId]
        : choice;
  return (files?.caveats ?? []).filter((caveat) => caveat.programmeId === programmeId);
}

/** A path of a choice as a file: absolute as given, else under `packages/`. */
/**
 * What the report of a wash says about its tier: nothing for an official wash; for a fast
 * one, how often the fast tier's verdicts differ from the official tier's per class of item,
 * as measured for the parameters of the wash (`fastTierNote` of `@spotless/sim-core/node`).
 */
export function washTierNoteFor(
  machineId: string,
  programmeId: string,
  tier: 'official' | 'fast',
  choice: WashParamChoice = 'machine-default',
): string | null {
  if (tier !== 'fast') return null;
  const files =
    choice === 'registry-defaults'
      ? undefined
      : choice === 'machine-default'
        ? MACHINE_WASH_DEFAULTS[machineId]
        : choice;
  const file = files?.tierAgreement;
  return fastTierNote(
    file === undefined ? null : readTierAgreement(washParamPath(file)),
    programmeId,
  );
}

/** The programme the game is scored on with a machine's default parameters; null when none is named. */
export function scoredProgrammeOf(machineId: string): string | null {
  return MACHINE_WASH_DEFAULTS[machineId]?.scoredProgramme ?? null;
}

export function washParamPath(path: string): string {
  return isAbsolute(path) ? path : join(PACKAGES_DIR, path);
}

/**
 * The files a choice names for a machine, with absolute paths, or null for the registry
 * defaults.
 */
export function washParamFilesFor(
  machineId: string,
  choice: WashParamChoice = 'machine-default',
): WashParamFilesChoice | null {
  const files =
    choice === 'registry-defaults'
      ? undefined
      : choice === 'machine-default'
        ? MACHINE_WASH_DEFAULTS[machineId]
        : choice;
  if (files === undefined) return null;
  return {
    paramSets: files.paramSets.map(washParamPath),
    ...(files.detergent === undefined
      ? {}
      : {
          detergent: {
            name: files.detergent.name,
            dose_g: files.detergent.dose_g,
            ...(files.detergent.params === undefined
              ? {}
              : { params: washParamPath(files.detergent.params) }),
          },
        }),
  };
}

function fileHash(path: string): string {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch {
    return 'unreadable';
  }
}

/**
 * What identifies the parameters of a wash of a machine for a store of results: the files a
 * choice names with the hash of their bytes, the dose, and whether stale files are accepted.
 * Two washes with the same identity run with the same parameters (given the same simulation
 * source, which the runner's version covers).
 */
export function washParamsIdentity(
  machineId: string,
  choice: WashParamChoice | undefined,
  acceptStale: boolean,
): unknown {
  const files = washParamFilesFor(machineId, choice);
  if (files === null) return { sets: [], detergent: null, acceptStale };
  return {
    sets: files.paramSets.map((path) => ({ path, sha256: fileHash(path) })),
    detergent:
      files.detergent === undefined
        ? null
        : {
            name: files.detergent.name,
            dose_g: files.detergent.dose_g,
            params:
              files.detergent.params === undefined
                ? null
                : { path: files.detergent.params, sha256: fileHash(files.detergent.params) },
          },
    acceptStale,
  };
}

/**
 * One short fingerprint of the parameters a choice gives, for every machine at once: of the
 * files it names with their bytes (for `machine-default`, those of every machine that has
 * defaults), the doses, and whether stale files are accepted. The server names it in the
 * identity of the code that runs its washes, so that the key of a stored result covers the
 * parameters without the load having to say which machine's defaults apply.
 */
export function washParamsFingerprint(
  choice: WashParamChoice | undefined,
  acceptStale: boolean,
): string {
  const identity =
    choice === undefined || choice === 'machine-default'
      ? Object.keys(MACHINE_WASH_DEFAULTS)
          .sort()
          .map((machineId) => [
            machineId,
            washParamsIdentity(machineId, 'machine-default', acceptStale),
          ])
      : washParamsIdentity('', choice, acceptStale);
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 16);
}
