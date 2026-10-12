/**
 * How close one item of a built phenomena load lies to another: the area of a region of the
 * first whose surface is within given distances of the surface of the second
 * (`src/phenomena/pair-gap.ts`). The check a load is held to when the phenomenon it stands for
 * is stated as a gap over an area (P03: two plates in one slot some millimetres apart; P15:
 * under 1 mm over about 10 cm2 between two nested spoons).
 *
 *   pnpm --filter @spotless/sim-verify exec tsx scripts/pair-gap.ts <load> <item> <region> <other>
 *        [--bands 0.5,1,2,3,5,7,9,12,15] [--pose "x,y,z,qx,qy,qz,qw"]
 *
 * `<load>` is a file of `phenomena/loads` without `.json`. `--pose` puts `<item>` at another
 * pose (tub frame, metres) than the file's: for trying a set pose before a scenario takes it.
 * Prints the area of the region, mm2, in each band of clearance (mm; a negative clearance is
 * an overlap of the two solids), the area-weighted median clearance of the part within the
 * widest band, and the least clearance. Read-only.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pose } from '@spotless/core';
import { regionClearance } from '../src/phenomena/pair-gap.ts';

/** Upper ends of the bands of clearance that are reported by default, mm. */
const DEFAULT_BANDS = [0.5, 1, 2, 3, 5, 7, 9, 12, 15];
/** Numbers of a pose on the command line: a position and a quaternion. */
const POSE_NUMBERS = 7;

const args = process.argv.slice(2).filter((a) => a !== '--');
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const [loadName, itemId, regionId, otherId] = positional;
if (
  loadName === undefined ||
  itemId === undefined ||
  regionId === undefined ||
  otherId === undefined
) {
  console.error(
    'usage: pair-gap.ts <load> <item> <region> <other> [--bands a,b,c] [--pose x,y,z,qx,qy,qz,qw]',
  );
  process.exit(2);
}
const bandsAt = args.indexOf('--bands');
const bands =
  bandsAt >= 0 ? (args[bandsAt + 1] as string).split(',').map(Number) : [...DEFAULT_BANDS];

interface SavedItem {
  readonly item_id: string;
  readonly item_type: string;
  readonly pose: { readonly p: readonly number[]; readonly q: readonly number[] };
}
const here = dirname(fileURLToPath(import.meta.url));
const load = JSON.parse(
  readFileSync(join(here, '..', 'phenomena', 'loads', `${loadName}.json`), 'utf8'),
) as { readonly items: readonly SavedItem[] };
const find = (id: string): SavedItem => {
  const item = load.items.find((i) => i.item_id === id);
  if (item === undefined) throw new RangeError(`${loadName} holds no item ${id}`);
  return item;
};
const poseOf = (item: SavedItem): Pose => ({
  p: [item.pose.p[0] as number, item.pose.p[1] as number, item.pose.p[2] as number],
  q: [
    item.pose.q[0] as number,
    item.pose.q[1] as number,
    item.pose.q[2] as number,
    item.pose.q[3] as number,
  ],
});
const item = find(itemId);
const other = find(otherId);
const poseAt = args.indexOf('--pose');
const given = poseAt >= 0 ? (args[poseAt + 1] as string).split(',').map(Number) : null;
if (given !== null && (given.length !== POSE_NUMBERS || given.some((v) => !Number.isFinite(v)))) {
  throw new RangeError('--pose takes seven numbers: x,y,z,qx,qy,qz,qw');
}
const pose: Pose =
  given === null
    ? poseOf(item)
    : {
        p: [given[0] as number, given[1] as number, given[2] as number],
        q: [given[3] as number, given[4] as number, given[5] as number, given[6] as number],
      };
const widest = bands[bands.length - 1] as number;
const samples = regionClearance(
  item.item_type,
  pose,
  regionId,
  other.item_type,
  poseOf(other),
  widest + 1,
);
const total = samples.reduce((sum, s) => sum + s.area, 0);
console.log(
  `${loadName}: region ${regionId} of ${itemId} (${item.item_type}), ${total.toFixed(0)} mm2, against ${otherId} (${other.item_type})${given === null ? '' : ', at the pose given'}`,
);
let lower = -Infinity;
let within = 0;
for (const upper of bands) {
  const area = samples
    .filter((s) => s.clearance > lower && s.clearance <= upper)
    .reduce((sum, s) => sum + s.area, 0);
  within += area;
  console.log(
    `  ${lower === -Infinity ? `overlapping or up to ${upper} mm` : `${lower} to ${upper} mm`}: ${area.toFixed(0)} mm2 (up to here ${within.toFixed(0)} mm2, ${((100 * within) / total).toFixed(0)} %)`,
  );
  lower = upper;
}
const near = samples.filter((s) => s.clearance <= widest);
let half = near.reduce((sum, s) => sum + s.area, 0) / 2;
let median = Number.NaN;
for (const s of near) {
  half -= s.area;
  if (half <= 0) {
    median = s.clearance;
    break;
  }
}
const overlapping = samples.filter((s) => s.clearance < 0).reduce((sum, s) => sum + s.area, 0);
console.log(
  `  least clearance ${(samples[0]?.clearance ?? Number.NaN).toFixed(2)} mm; inside the other solid ${overlapping.toFixed(0)} mm2; median of the part within ${widest} mm: ${median.toFixed(2)} mm`,
);
