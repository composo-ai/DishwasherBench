/**
 * Prints a summary of every level of the game: items, points, the programme, validation
 * problems, soil records that disagree with the soil data, items with an unsettled soil, and
 * the capacity estimate. Exits 1 when a level has a problem.
 * Run with `pnpm --filter @spotless/levels exec tsx scripts/summary.ts`.
 */
import { getItemType } from '@spotless/catalogue';
import {
  allLevels,
  capacityEstimate,
  levelCard,
  levelSoilFindings,
  unsettledItems,
  validateLevel,
} from '../src/index.ts';

let bad = false;
for (const level of allLevels()) {
  const problems = [...validateLevel(level), ...levelSoilFindings(level)];
  const unsettled = unsettledItems(level);
  const estimate = capacityEstimate(level);
  const points = level.items.reduce((sum, item) => sum + item.points, 0);
  const cutlery = level.items.filter(
    (item) => getItemType(item.itemType).shapeTag === 'cutlery',
  ).length;
  const card = levelCard(level);
  console.log(
    `${level.id}: ${level.items.length} items (${cutlery} cutlery), ${points} points, ${card.programme.display_name}, needs ${(estimate.neededArea * 1e4).toFixed(0)} cm2 of ${(estimate.availableArea * 1e4).toFixed(0)} cm2 (ratio ${estimate.ratio.toFixed(2)}), ${problems.length} problems, ${unsettled.length} items with an unsettled soil, card ${JSON.stringify(card).length} bytes`,
  );
  for (const problem of problems) console.log(`  ${problem.path}: ${problem.message}`);
  if (unsettled.length > 0) console.log(`  unsettled: ${unsettled.join(', ')}`);
  if (problems.length > 0 || unsettled.length > 0) bad = true;
}
process.exit(bad ? 1 : 0);
