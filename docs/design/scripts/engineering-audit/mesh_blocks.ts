// Throwaway audit: apply the MESH-patch rule of sim-core.md section 3.3 ("macro triangles of the render mesh at 0.05 mm chord error,
// split 1:4 until the longest edge is at most 1.5 D_B") to the platform's real render meshes and count the resulting blocks.
import { expandGeometryMm } from '../../../../packages/geometry/src/authoring.ts';
import { buildRenderMesh } from '../../../../packages/geometry/src/mesh.ts';
import { EXAMPLE_ITEMS } from '../../../../packages/geometry/src/example-items.ts';

const DB = 2e-3;
for (const name of ['fork', 'spoon', 'knife', 'foodContainer', 'mug'] as const) {
  const shape = expandGeometryMm(EXAMPLE_ITEMS[name].def as never);
  const mesh = buildRenderMesh(shape, { chordError: 0.05e-3 });
  const kinds = shape.parts.map((p) => {
    const prim = p.prim as { kind: string; scaleXY?: [number, number] };
    const scaled = prim.kind === 'sor' && prim.scaleXY !== undefined && (prim.scaleXY[0] !== 1 || prim.scaleXY[1] !== 1);
    return prim.kind === 'hull' || scaled ? 'MESH' : prim.kind === 'rbox' ? 'CART' : prim.kind === 'capsule' ? 'REV(capsule)' : 'REV';
  });
  let macro = 0, blocks = 0, area = 0, tiny = 0, minWidth = Infinity, maxAspect = 0;
  const P = mesh.positions, I = mesh.indices;
  for (let t = 0; t < I.length / 3; t++) {
    if (kinds[mesh.triPart[t] as number] !== 'MESH') continue;
    const v = [0, 1, 2].map((k) => { const i = I[3 * t + k] as number; return [P[3 * i] as number, P[3 * i + 1] as number, P[3 * i + 2] as number]; });
    const e = [0, 1, 2].map((k) => Math.hypot(...[0, 1, 2].map((c) => (v[(k + 1) % 3] as number[])[c]! - (v[k] as number[])[c]!)));
    const longest = Math.max(...e);
    const s = (e[0]! + e[1]! + e[2]!) / 2;
    const a = Math.sqrt(Math.max(0, s * (s - e[0]!) * (s - e[1]!) * (s - e[2]!)));
    if (a === 0) continue;
    const levels = Math.max(0, Math.ceil(Math.log2(longest / (1.5 * DB))));
    const n = 4 ** levels;
    const width = (2 * a) / longest / 2 ** levels;       // height of a child triangle over its longest edge
    macro++; blocks += n; area += a; minWidth = Math.min(minWidth, width); maxAspect = Math.max(maxAspect, longest / ((2 * a) / longest));
    if (a / n < 0.1 * 3e-6) tiny += n;
  }
  const partSummary = [...new Set(kinds)].map((k) => `${kinds.filter((x) => x === k).length} ${k}`).join(', ');
  console.log(`${name}: parts ${partSummary}; MESH macro triangles ${macro}, MESH area ${(area * 1e6).toFixed(0)} mm2 -> ${blocks} blocks ` +
    `(budget2.py assumes area / 3 mm2 = ${(area / 3e-6).toFixed(0)}); blocks under 0.3 mm2: ${tiny}; thinnest block ${(minWidth * 1e6).toFixed(1)} um; worst macro aspect ratio ${maxAspect.toFixed(0)}`);
}
