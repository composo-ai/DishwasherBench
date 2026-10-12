/**
 * How each plate of the catalogue rests in the tine rows of the Bosch's lower basket, by
 * dropping it in the loading physics.
 *
 *   pnpm --filter @spotless/machine exec tsx scripts/plate-rows.ts [item ids...]
 *
 * For every plate kind and a set of slots it seats the plate by a hand's motion
 * (`seatPlateByHand` of `src/geometry/plate-seat-physics.ts`), lets it settle and prints the lean
 * it comes to rest at, measured the way the owner's loaded photograph was measured: the angle of
 * the eating face from the vertical, positive when the top goes the way the tines lean.
 */

import { listItemTypes } from '../../catalogue/src/index.ts';
import { BOSCH_SMV4HAX40G, buildMachineGeometry } from '../src/index.ts';
import { seatPlateByHand } from '../src/test-physics.ts';

const wanted = process.argv.slice(2);
const plates =
  wanted.length > 0
    ? wanted
    : listItemTypes()
        .filter((t) => t.shapeTag === 'plate' || t.shapeTag === 'saucer')
        .map((t) => t.id);

const geometry = buildMachineGeometry(BOSCH_SMV4HAX40G);
const SLOTS: readonly (readonly [string, number])[] = [
  ['r1', 2],
  ['r1', 8],
  ['r1', 18],
  ['ml', 2],
  ['mr', 3],
];

for (const itemId of plates) {
  const cells: string[] = [];
  for (const [rowId, index] of SLOTS) {
    const result = await seatPlateByHand(geometry, 'lower', rowId, index, itemId);
    cells.push(
      `${rowId}.${index}: ${result.leanDeg.toFixed(1)} deg` +
        ` (start ${result.startLeanDeg.toFixed(0)}, edge ${result.edgeFromSlotMm.toFixed(1)} mm,` +
        ` low ${result.lowestMm.toFixed(1)} mm, on ${result.restsOn.join('+')},` +
        ` force ${result.forceOverWeight.toFixed(1)} W${result.reachedRails ? '' : ', NOT SEATED BY HAND'}${result.atRest ? '' : ', MOVING'})`,
    );
  }
  console.log(`${itemId}\n  ${cells.join('\n  ')}`);
}
