// Throwaway: surface area of an IEC-style 13-place-setting load by patch kind and film class, from the real catalogue.
import { instantiate, getItemType } from '../../../../packages/catalogue/src/catalogue.ts';
import { primitiveSurfaceArea } from '../../../../packages/geometry/src/area.ts';
import { getMaterial } from '../../../../packages/catalogue/src/materials.ts';

const load: [string, number][] = [
  ['dinner_plate_porcelain_iec', 7], ['dessert_plate_porcelain_190', 7], ['mug_porcelain_240', 7], ['dessert_bowl_vitrelle_130', 7],
  ['tumbler_250', 13], ['soup_plate_porcelain_230', 6], ['tea_cup_porcelain_210', 6], ['saucer_porcelain_140', 6], ['melamine_plate_230', 6],
  ['dinner_knife_210', 13], ['dinner_fork_185', 13], ['soup_spoon_190', 13], ['dessert_spoon_160', 13], ['teaspoon_130', 13],
  ['oval_platter_porcelain_320', 1], ['serving_bowl_vitrelle_216', 1], ['melamine_bowl_150', 2], ['serving_spoon_216', 2], ['serving_fork_210', 2],
];
const HOLLOW = new Set(['cup','mug','glass','stemware','bowl','jug','pot','pan','container','lid']);
const FLAT = new Set(['plate','saucer','platter','flat_dish']);
const tot: Record<string, number> = {}; const byKind: Record<string, number> = {}; let n = 0; let all = 0;
for (const [id, count] of load) {
  const t = getItemType(id); const inst: any = instantiate(id);
  const shape = inst.shape; let a = 0; const kinds: Record<string, number> = {};
  for (const p of shape.parts) {
    const prim: any = p.prim; const ar = primitiveSurfaceArea(prim);
    let k = prim.kind; if (k === 'sor' && prim.scaleXY && (prim.scaleXY[0] !== 1 || prim.scaleXY[1] !== 1)) k = 'sor-scaled';
    if (k === 'rbox' && prim.halfExtents.some((h: number) => h === 0)) k = 'rbox-degenerate';
    kinds[k] = (kinds[k] ?? 0) + ar; a += ar;
  }
  let mats = new Set(shape.parts.map((p: any) => p.material));
  let wet = 'continuous';
  for (const m of mats) { try { const mm: any = getMaterial(m as string); const w = mm.wetting?.wettingClass ?? mm.wetting?.class ?? mm.wettingClass; if (w && w !== 'continuous_film') wet = w; } catch (e) { wet = 'unknown:' + m; } }
  const cls = t.shapeTag === 'cutlery' || t.shapeTag === 'utensil' ? 'K-cutlery' : wet !== 'continuous' ? 'S1' : HOLLOW.has(t.shapeTag) ? 'S2' : FLAT.has(t.shapeTag) ? 'K2-flat' : 'K2-other';
  tot[cls] = (tot[cls] ?? 0) + a * count; n += count; all += a * count;
  for (const k in kinds) byKind[k] = (byKind[k] ?? 0) + kinds[k] * count;
  console.log(`${id.padEnd(30)} x${String(count).padStart(2)} tag ${t.shapeTag.padEnd(9)} mats ${[...mats].join(',').padEnd(22)} wet ${wet.padEnd(18)} class ${cls.padEnd(10)} area ${(a * 1e4).toFixed(0).padStart(5)} cm2  parts ${Object.entries(kinds).map(([k, v]) => `${k} ${(v * 1e4).toFixed(0)}`).join(', ')}`);
}
console.log(`items ${n}; total area ${all.toFixed(3)} m2 (sum of part areas, overlaps not removed)`);
for (const k in tot) console.log(`  class ${k.padEnd(10)} ${tot[k].toFixed(3)} m2  ${(tot[k] / all * 100).toFixed(1)} %`);
for (const k in byKind) console.log(`  prim  ${k.padEnd(16)} ${byKind[k].toFixed(3)} m2  ${(byKind[k] / all * 100).toFixed(1)} %`);
