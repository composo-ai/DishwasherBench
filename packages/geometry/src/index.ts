/**
 * @spotless/geometry. Geometry kernel: primitives, parametric item expansion, render mesh,
 * collision pieces, signed distance and mass properties (docs/design/platform.md section 4).
 *
 * Every item and every machine component is a `Shape`: a rigid compound of analytic primitives
 * (shell of revolution, capsule, rounded box, rounded hull) with named surface regions. All the
 * products below are pure functions of that one description, in SI units and in the item frame:
 *
 *  - `expandGeometry(def)` / `expandGeometryMm(def)`: parametric item classes to a `Shape`
 *    (SI definitions, or authoring definitions in millimetres and degrees);
 *  - `signedDistance`, `signedDistanceGradient`, `sampleSignedDistance`, and `surfaceRegionAt`
 *    for the surface region nearest to a point;
 *  - `buildRenderMesh` (with `meshTopology`, `meshArea`, `meshMoments` to measure a mesh);
 *  - `buildCollisionPieces` (with `sorCollisionLayout` to predict the piece count,
 *    `roundSurfacesOf` for the round rolling surfaces alone and `collisionSolids` to leave
 *    them out);
 *  - `computeMassProperties`, `shapeVolume`, `materialVolume` (perforations taken out);
 *  - `surfaceArea`, `boundingBox`;
 *  - `partSelectorMatches` and `regionIdMatches`: the matching rules of region part selectors
 *    and of compound region renames;
 *  - `prepareProfile`, `profileDistance` and `buildSection`: the meridian cross-section of a
 *    shell of revolution (packed profile and exact boundary), for consumers that evaluate shells
 *    themselves.
 *
 * `geometryKernel` collects the eight contract functions in one object.
 */

import { surfaceArea } from './area.ts';
import { boundingBox } from './bounds.ts';
import { buildCollisionPieces } from './collision.ts';
import { expandGeometry } from './expand.ts';
import { computeMassProperties } from './mass.ts';
import { buildRenderMesh } from './mesh.ts';
import { signedDistance, signedDistanceGradient } from './sdf.ts';
import type { GeometryKernel } from './types.ts';

export * from './types.ts';
export * from './authoring.ts';
export { expandGeometry } from './expand.ts';
export {
  primitiveSignedDistance,
  primitiveSignedDistanceGradient,
  sampleSignedDistance,
  signedDistance,
  signedDistanceGradient,
  surfaceRegionAt,
  type SdfSample,
} from './sdf.ts';
export {
  buildRenderMesh,
  CAPSULE_MIN_SECTORS,
  DEFAULT_MIN_SECTORS,
  MAX_FACET_ANGLE,
} from './mesh.ts';
export {
  meshArea,
  meshMoments,
  meshTopology,
  meshVolume,
  type MeshMoments,
  type MeshTopology,
} from './mesh-metrics.ts';
export {
  buildCollisionPieces,
  COLLISION_TAPER_FRACTION,
  collisionSolids,
  ROUND_SURFACE_MAX_TURN,
  ROUND_SURFACE_MIN_HEIGHT,
  ROUND_SURFACE_MIN_RADIAL,
  ROUND_SURFACE_MIN_WALL,
  roundSurfacesOf,
  sorCollisionLayout,
  type SorCollisionLayout,
  type SorCollisionRow,
} from './collision.ts';
export {
  computeMassProperties,
  materialVolume,
  primitiveMoments,
  primitiveVolume,
  shapeVolume,
  type SolidMoments,
} from './mass.ts';
export { primitiveSurfaceArea, surfaceArea } from './area.ts';
export { boundingBox, primitiveSupport } from './bounds.ts';
export { sectorCount } from './prepared.ts';
export { partSelectorMatches, regionIdMatches } from './regions.ts';
// The meridian cross-section of a shell of revolution, for consumers that evaluate shells
// themselves: the packed profile is what a GPU signed-distance kernel needs, and the exact
// boundary (lines and arcs with their side and arc length) what a surface-element atlas needs.
export {
  buildSection,
  createProfileHit,
  hitArcLength,
  prepareProfile,
  profileClosest,
  profileDistance,
  SEGMENT_STRIDE,
  type PreparedProfile,
  type ProfileHit,
  type SectionArc,
  type SectionLine,
  type SectionLoop,
  type SectionPiece,
  type SectionSide,
  type SorSection,
} from './sor-section.ts';

/**
 * The eight functions of the geometry contract (docs/design/platform.md sections 4.2 and 4.3),
 * for callers that want to be handed a kernel rather than import the functions.
 */
export const geometryKernel: GeometryKernel = {
  expandGeometry,
  buildRenderMesh,
  buildCollisionPieces,
  computeMassProperties,
  signedDistance,
  signedDistanceGradient,
  boundingBox,
  surfaceArea,
};
