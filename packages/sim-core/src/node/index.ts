/**
 * Node-only parts of `@spotless/sim-core` (file system access), kept out of the main entry
 * point so that the simulation itself can run where there is no file system. Import from
 * `@spotless/sim-core/node`.
 *
 *  - `createDiskExposureCache`: exposure sets as files in a directory, kept apart by the
 *    fingerprint of the sources that computed them;
 *  - `exposureFingerprint`, `simulationFingerprint` (`fingerprint.ts`, also importable alone
 *    as `@spotless/sim-core/fingerprint`): the fingerprints of the source;
 *  - `readParamLayerFile`, `composeParamFiles` (`param-files.ts`): named parameter-set files
 *    of a wash, with a loud failure for a stale one;
 *  - `readTierAgreement`, `fastTierNote` (`tier-agreement.ts`): what a report of a fast wash
 *    says about how far the fast tier agrees with the official one;
 *  - `washWithSource`: `wash` with the fingerprint of the source in the result's provenance;
 *  - `runWashFile`: a wash from a JSON description on disk to a JSON result on disk, which is
 *    what the command `spotless-wash` does.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import type { ParamValue } from '@spotless/sim-params';
import type { ExposureCache } from '../exposure-cache.ts';
import { washInputFromDescription, type WashDescription, type WashInput } from '../input.ts';
import type { WashResult } from '../result.ts';
import { washResultToJson } from '../result-json.ts';
import { wash, type WashOptions } from '../wash.ts';
import { exposureFingerprint, simulationFingerprint } from './fingerprint.ts';
import { composeParamFiles } from './param-files.ts';

export * from './fingerprint.ts';
export * from './param-files.ts';
export * from './tier-agreement.ts';

/**
 * The fingerprint of the exposure sources as this process loaded them: read when this module
 * is loaded, which is when the sources themselves are.
 */
const LOADED_EXPOSURE_SOURCE = exposureFingerprint();

/** The fingerprint of the exposure sources this process runs (`exposureFingerprint` at load). */
export function loadedExposureSource(): string {
  return LOADED_EXPOSURE_SOURCE;
}

/** Compression level of cached exposure sets: the tables are mostly zeros, so the fastest does. */
const CACHE_DEFLATE_LEVEL = 1;

/** Hex digits of the fingerprint in the name of a cache directory. */
const SOURCE_TAG_LENGTH = 16;

/**
 * An exposure cache in a directory: one file per key, `<hash>.spxe`, deflated, in a
 * sub-directory named after the fingerprint of the exposure sources this process runs
 * (`src-<first 16 hex digits>`). A set computed by other water code lies in another
 * sub-directory and is never read, whether or not anyone raised a version string; the
 * fingerprint is also the cache's `source`, which `wash` makes part of every key and records
 * in its result. A set is not stored when the sources on disk are no longer those this
 * process loaded (they were edited under a running wash): the set may have been computed by
 * a mixture.
 *
 * A file is written under a temporary name and renamed, so that a reader never sees half of
 * one. The directory is created when the first set is stored.
 */
export function createDiskExposureCache(directory: string): ExposureCache {
  const source = LOADED_EXPOSURE_SOURCE;
  const home = join(directory, `src-${source.slice(0, SOURCE_TAG_LENGTH)}`);
  const fileOf = (key: string): string => join(home, `${key.replace(/[^0-9a-zA-Z]/g, '_')}.spxe`);
  return {
    source,
    async get(key) {
      let bytes: Buffer;
      try {
        bytes = await readFile(fileOf(key));
      } catch {
        return undefined;
      }
      try {
        return new Uint8Array(inflateSync(bytes));
      } catch {
        return undefined;
      }
    },
    async put(key, bytes) {
      if (exposureFingerprint() !== source) return;
      await mkdir(home, { recursive: true });
      const file = fileOf(key);
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, deflateSync(bytes, { level: CACHE_DEFLATE_LEVEL }));
      await rename(temporary, file);
    },
  };
}

/**
 * `wash` for a tool that runs on this workspace's sources: the same wash, with the fingerprint
 * of the simulation's source in the provenance of the result when the caller gives none
 * (`WashProvenance.sourceFingerprint` is otherwise empty, and a result does not say which code
 * produced it). The core `wash` cannot read it itself: it runs where there are no files.
 */
export function washWithSource(input: WashInput, options: WashOptions = {}): Promise<WashResult> {
  return wash(input, {
    ...options,
    sourceFingerprint: options.sourceFingerprint ?? simulationFingerprint(),
  });
}

/** Options of {@link runWashFile}. */
export interface RunWashFileOptions {
  /** Where to write the result; default: the input path with `.result.json` for `.json`. */
  readonly output?: string;
  /**
   * Directory of the exposure cache; default `.spotless/exposure-cache` beside the input (the
   * repository ignores `.spotless/`); null for none.
   */
  readonly cacheDir?: string | null;
  /** True to write per-cell arrays for every item. */
  readonly cells?: boolean;
  /** Seconds between the rows of the liquor trace written; 0 for every tick. Default 60. */
  readonly traceInterval?: number;
  readonly onProgress?: WashOptions['onProgress'];
  /**
   * Named parameter-set files laid over the registry defaults before those the description
   * names (`WashDescription.paramSets`), and the detergent: the parameter-set file of its
   * composition and its dose in grams. What is given here replaces the detergent of the
   * description.
   */
  readonly paramSets?: readonly string[];
  readonly detergent?: {
    readonly name?: string;
    readonly params?: string;
    readonly dose_g?: number;
  };
  /** True to read stale parameter-set files all the same (the result records them as stale). */
  readonly acceptStaleParams?: boolean;
}

/**
 * Reads a wash description (see `WashDescription`), runs the wash and writes the result as
 * JSON. The parameters of the wash are the registry defaults, then the named sets of the
 * options and of the description in order, then the composition of the detergent, then the
 * `params` of the description. Throws `StaleParamSetError` for a stale parameter-set file
 * unless `acceptStaleParams` is set. Returns the result and the path written.
 */
export async function runWashFile(
  inputPath: string,
  options: RunWashFileOptions = {},
): Promise<{ readonly result: WashResult; readonly outputPath: string }> {
  const path = resolve(inputPath);
  const description = JSON.parse(await readFile(path, 'utf8')) as WashDescription;
  const beside = (file: string): string => (isAbsolute(file) ? file : join(dirname(path), file));
  const detergentFile =
    options.detergent?.params ??
    (description.detergent?.params === undefined
      ? undefined
      : beside(description.detergent.params));
  const composed = composeParamFiles({
    paramSets: [...(options.paramSets ?? []), ...(description.paramSets ?? []).map(beside)],
    ...(detergentFile === undefined ? {} : { detergent: detergentFile }),
    ...(options.acceptStaleParams === true ? { acceptStale: true } : {}),
  });
  const dose_g = options.detergent?.dose_g ?? description.detergent?.dose_g;
  const detergentName =
    options.detergent?.name ??
    description.detergent?.name ??
    composed.records.find((record) => record.role === 'detergent')?.name;
  const params: Record<string, ParamValue> = { ...composed.params, ...(description.params ?? {}) };
  const { paramSets: _sets, detergent: _detergent, ...plain } = description;
  const input = {
    ...washInputFromDescription({
      ...plain,
      ...(Object.keys(params).length === 0 ? {} : { params }),
      ...(dose_g === undefined
        ? {}
        : {
            detergent: { dose_g, ...(detergentName === undefined ? {} : { name: detergentName }) },
          }),
    }),
    ...(composed.records.length === 0 ? {} : { paramSets: composed.records }),
  };
  const cacheDir =
    options.cacheDir === null
      ? null
      : resolve(options.cacheDir ?? join(dirname(path), '.spotless', 'exposure-cache'));
  const result = await wash(input, {
    ...(cacheDir === null ? {} : { cache: createDiskExposureCache(cacheDir) }),
    ...(options.cells === undefined ? {} : { cells: options.cells }),
    ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
    sourceFingerprint: simulationFingerprint(),
  });
  const outputPath = resolve(options.output ?? path.replace(/(\.json)?$/, '.result.json'));
  await mkdir(dirname(outputPath), { recursive: true });
  const json = washResultToJson(
    result,
    options.traceInterval === undefined ? {} : { traceInterval: options.traceInterval },
  );
  await writeFile(outputPath, `${JSON.stringify(json, null, 2)}\n`);
  return { result, outputPath };
}
