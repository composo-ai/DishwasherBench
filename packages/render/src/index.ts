/**
 * @spotless/render. The Three.js scene of the game: the machine drawn from the machine
 * package's geometry and every item from its catalogue shape, both through the geometry
 * kernel's render meshes, with materials that read as what they are and soil painted where the
 * level says it is. Shared by the web client and, later, by a headless render service for
 * agents (docs/design/platform.md section 7).
 *
 *  - `SpotlessScene`: machine, items, ghost, marks, lights; fed with shapes and draw poses.
 *  - `ViewCameras`, `viewSpec`, `fitView`: the named views (three-quarter, plan, elevations).
 *  - `ItemFactory`, `ThumbnailRenderer`: item objects and small pictures of them.
 *  - `materialAppearance`, `soilAppearance`: how materials and soils look (pure data).
 *  - `soilLayersByRegion`: from a level's soil to what is painted on an item (pure).
 *  - `decodeResidueMap`, `residueTiles`, `RESIDUE_STEPS`, `residueOutline`: from the residue
 *    map of a washed item to the tiles that draw the residue where it is, cell by cell, with
 *    the colour scale and its legend (pure); `buildResidueObject` and
 *    `SpotlessScene.setItemResidue` draw them. `residueLayersByRegion` and `residueColour`
 *    are the older painting by whole regions, for a report that comes without residue maps.
 *
 *  - `namedCameraSpec`, `customCameraSpec`, `ITEM_VIEW_DIRECTIONS`: the views of the `render`
 *    query as cameras; `viewMarks`, `drawOverlay`: the millimetre grid and the item labels
 *    drawn over a picture; `ItemViewRenderer`: a single item from fixed directions. The web
 *    client and the headless render service (`@spotless/render/headless`, Node only) share
 *    them, so a person and a model are offered the same pictures.
 *
 * Scene units are metres in the tub frame, z up.
 */

export * from './types.ts';
export * from './appearance.ts';
export * from './soil-layers.ts';
export * from './views.ts';
export * from './residue-map.ts';
export { buildResidueObject, RESIDUE_OBJECT_NAME, type ResidueObject } from './residue-object.ts';
export { partitionTriangles, partMaterials, SOIL_ATTRIBUTES, toBufferGeometry } from './mesh.ts';
export { createSurfaceMaterial, type SurfaceMaterialOptions } from './surface-material.ts';
export {
  createGhostMaterial,
  createHighlightMaterial,
  ITEM_CHORD_ERROR,
  ItemFactory,
} from './items.ts';
export {
  applyCutaway,
  buildMachineObjects,
  isTine,
  MACHINE_CHORD_ERROR,
  TINE_SHADE,
  type CutawayPanel,
  type MachineObjects,
} from './machine.ts';
export { clipPlanes, ViewCameras } from './camera.ts';
export {
  applyDrawPose,
  GHOST_TINTS,
  LANDING_OPACITY,
  LANDING_TINT,
  SpotlessScene,
  type GhostTint,
  type SceneOptions,
} from './scene.ts';
export { thumbnailDirection, ThumbnailRenderer } from './thumbnail.ts';
export * from './agent-views.ts';
export * from './overlay.ts';
export * from './view-marks.ts';
export {
  ITEM_VIEW_BACKGROUND,
  ItemViewRenderer,
  type ItemViewport,
  type ItemViewSubject,
} from './item-views.ts';
