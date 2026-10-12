/**
 * Writes a digest of the built geometry of every machine, part by part, so that a change to the
 * machine data or to the geometry builders can be shown to leave the rest of the machine alone:
 *
 *   pnpm --filter @spotless/machine exec tsx scripts/geometry-digest.ts <out.json>
 *   pnpm --filter @spotless/machine exec tsx scripts/geometry-digest.ts --compare <before.json> <after.json>
 *
 * The digest holds, for each machine and each of a few configurations (the default one, every
 * hinged tine row folded, every shelf in the state that is not its default, each height
 * position of each adjustable basket), one SHA-256 per machine part over its shape, frame, pose
 * and motion, and one per entry of the affordances and of the properties (a list split by the
 * frame or basket of its entries). `--compare` lists the digests that differ and exits with
 * status 0 either way: what may differ is for the reader to judge.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MachineConfig, MachineSpec } from '../src/index.ts';
import { buildMachineGeometry, MACHINE_VARIANTS, MACHINES } from '../src/index.ts';

type Digest = Record<string, Record<string, Record<string, string>>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sha = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

function configurations(spec: MachineSpec): [string, MachineConfig][] {
  const base = spec.defaultConfig;
  const out: [string, MachineConfig][] = [['default', base]];
  const hinged = spec.baskets.flatMap((b) =>
    b.tineRows.filter((r) => r.hinge !== null).map((r) => ({ basketId: b.id, rowId: r.id })),
  );
  if (hinged.length > 0) out.push(['rows_folded', { ...base, foldedTineRows: hinged }]);
  const shelves = spec.baskets.flatMap((b) => [
    ...b.cupShelves.map((s) => ({
      basketId: b.id,
      shelfId: s.id,
      state: s.defaultState === 'up' ? ('down' as const) : ('up' as const),
    })),
    ...b.holders
      .filter((h) => h.folds)
      .map((h) => ({
        basketId: b.id,
        shelfId: h.id,
        state: h.defaultState === 'up' ? ('down' as const) : ('up' as const),
      })),
  ]);
  if (shelves.length > 0) out.push(['shelves_toggled', { ...base, shelves }]);
  for (const basket of spec.baskets) {
    for (const position of basket.pose.heightPositions) {
      if (basket.pose.heightPositions.length < 2) continue;
      out.push([
        `${basket.id}_height_${position.id}`,
        { ...base, basketHeights: { ...base.basketHeights, [basket.id]: position.id } },
      ]);
    }
  }
  return out;
}

function digest(): Digest {
  const all: Digest = {};
  for (const spec of [...MACHINES, ...MACHINE_VARIANTS]) {
    const perConfig: Record<string, Record<string, string>> = {};
    for (const [name, config] of configurations(spec)) {
      const geometry = buildMachineGeometry(spec, config);
      const parts: Record<string, string> = {};
      for (const part of geometry.parts) {
        parts[part.id] = sha([part.shape, part.frame, part.pose, part.motion, part.carriedBy]);
      }
      const { parts: _parts, ...rest } = geometry;
      for (const [key, value] of Object.entries(rest)) {
        if (!isRecord(value)) {
          parts[`(${key})`] = sha(value);
          continue;
        }
        // Affordances and properties, entry by entry; a list is split by the frame or the
        // basket of its entries, so that a change in one basket does not hide the others.
        for (const [name, entry] of Object.entries(value)) {
          if (!Array.isArray(entry)) {
            if (isRecord(entry)) {
              for (const [k, v] of Object.entries(entry)) parts[`(${key}.${name}.${k})`] = sha(v);
            } else parts[`(${key}.${name})`] = sha(entry);
            continue;
          }
          const groups = new Map<string, unknown[]>();
          for (const item of entry as unknown[]) {
            const of = isRecord(item)
              ? String(item['frame'] ?? item['basketId'] ?? item['id'] ?? 'all')
              : 'all';
            groups.set(of, [...(groups.get(of) ?? []), item]);
          }
          if (groups.size === 0) parts[`(${key}.${name})`] = sha(entry);
          for (const [of, items] of groups) parts[`(${key}.${name}: ${of})`] = sha(items);
        }
      }
      perConfig[name] = parts;
    }
    all[spec.id] = perConfig;
  }
  return all;
}

if (process.argv[2] === '--compare') {
  const before = JSON.parse(readFileSync(resolve(String(process.argv[3])), 'utf8')) as Digest;
  const after = JSON.parse(readFileSync(resolve(String(process.argv[4])), 'utf8')) as Digest;
  let same = 0;
  const changed = new Map<string, string[]>();
  for (const machine of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const configs = new Set([
      ...Object.keys(before[machine] ?? {}),
      ...Object.keys(after[machine] ?? {}),
    ]);
    for (const config of configs) {
      const a = before[machine]?.[config] ?? {};
      const b = after[machine]?.[config] ?? {};
      for (const part of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (a[part] === b[part]) same++;
        else
          changed.set(`${machine}: ${part}`, [
            ...(changed.get(`${machine}: ${part}`) ?? []),
            config,
          ]);
      }
    }
  }
  console.log(`${same} part digests identical`);
  for (const [part, configs] of [...changed].sort()) {
    console.log(`CHANGED ${part} (${configs.length} configurations: ${configs.join(', ')})`);
  }
} else {
  const out = process.argv[2];
  if (out === undefined) throw new Error('usage: geometry-digest.ts <out.json>');
  const all = digest();
  writeFileSync(resolve(out), JSON.stringify(all, null, 1));
  const count = Object.values(all).reduce(
    (n, c) => n + Object.values(c).reduce((m, p) => m + Object.keys(p).length, 0),
    0,
  );
  console.log(`${out}: ${count} digests`);
}
