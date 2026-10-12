/**
 * The page of the render service: it runs in headless Chrome, builds the same `SpotlessScene`
 * the web client draws, and paints pictures on request (`window.spotlessRender`, see
 * `protocol.ts`). Bundled by `bundle.ts`; never imported by Node code.
 *
 * Nothing here depends on time: a picture is a function of the scene, the poses, the camera
 * and the marks it is given.
 */

import {
  NeutralToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { clipPlanes, ViewCameras } from '../camera.ts';
import { ITEM_VIEW_BACKGROUND, ItemViewRenderer } from '../item-views.ts';
import { drawOverlay } from '../overlay.ts';
import type { ResidueTiles } from '../residue-map.ts';
import { decodeResidueMap, residueTiles } from '../residue-map.ts';
import { SpotlessScene } from '../scene.ts';
import { soilLayersByRegion } from '../soil-layers.ts';
import type { RegionLayers, SoilInput } from '../types.ts';
import type {
  HeadlessItemJob,
  HeadlessPageApi,
  HeadlessRenderJob,
  HeadlessSceneInput,
  HeadlessWashInput,
} from './protocol.ts';

interface LoadedScene {
  readonly scene: SpotlessScene;
  readonly itemViews: ItemViewRenderer;
  readonly itemTypes: Map<string, string>;
  readonly soils: Map<string, readonly SoilInput[]>;
  washKey: string | null;
  /** The residue tiles of the washed items, by item id (null: washed and nothing left). */
  readonly washed: Map<string, ResidueTiles | null>;
}

const BARE: RegionLayers = new Map();

const glCanvas = document.createElement('canvas');
const renderer = new WebGLRenderer({
  canvas: glCanvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = NeutralToneMapping;
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.localClippingEnabled = false;

const outCanvas = document.createElement('canvas');
const cameras = new ViewCameras();
const scenes = new Map<string, LoadedScene>();
const scratch = new Vector3();

function sceneOf(key: string): LoadedScene {
  const loaded = scenes.get(key);
  if (loaded === undefined) throw new Error(`render page: no scene '${key}'`);
  return loaded;
}

function layersOf(loaded: LoadedScene, itemId: string): RegionLayers {
  return loaded.washed.has(itemId) ? BARE : soilLayersByRegion(loaded.soils.get(itemId) ?? []);
}

/** Copies the WebGL picture to the output canvas, draws the marks over it, and encodes it. */
function finish(width: number, height: number, job: { marks: HeadlessRenderJob['marks'] }): string {
  outCanvas.width = width;
  outCanvas.height = height;
  const context = outCanvas.getContext('2d');
  if (context === null) throw new Error('render page: no 2D context');
  context.drawImage(glCanvas, 0, 0, width, height);
  drawOverlay(context, job.marks);
  return outCanvas.toDataURL('image/png').slice('data:image/png;base64,'.length);
}

const api: HeadlessPageApi = {
  loadScene(key: string, input: HeadlessSceneInput): void {
    api.dropScene(key);
    const scene = new SpotlessScene();
    scene.attachEnvironment(renderer);
    scene.setMachine(input.parts);
    scene.addItemTypes(input.item_types);
    const itemTypes = new Map<string, string>();
    const soils = new Map<string, readonly SoilInput[]>();
    for (const item of input.items) {
      itemTypes.set(item.item_id, item.item_type);
      soils.set(item.item_id, item.soils);
      scene.setItem(item.item_id, item.item_type, soilLayersByRegion(item.soils));
    }
    scenes.set(key, {
      scene,
      itemViews: new ItemViewRenderer(renderer, scene.factory),
      itemTypes,
      soils,
      washKey: null,
      washed: new Map(),
    });
  },

  scenes(): string[] {
    return [...scenes.keys()];
  },

  dropScene(key: string): void {
    const loaded = scenes.get(key);
    if (loaded === undefined) return;
    loaded.itemViews.dispose();
    loaded.scene.dispose();
    scenes.delete(key);
  },

  setWash(sceneKey: string, key: string | null, input: HeadlessWashInput | null): void {
    const loaded = sceneOf(sceneKey);
    if (loaded.washKey === key) return;
    // Back to the items as the level soils them.
    for (const itemId of loaded.washed.keys()) {
      loaded.scene.setItemResidue(itemId, null);
      const itemType = loaded.itemTypes.get(itemId);
      if (itemType === undefined) continue;
      loaded.scene.setItem(itemId, itemType, soilLayersByRegion(loaded.soils.get(itemId) ?? []));
    }
    loaded.washed.clear();
    loaded.washKey = key;
    if (key === null || input === null) return;
    for (const item of input.items) {
      const itemType = loaded.itemTypes.get(item.item_id);
      if (itemType === undefined) continue;
      const tiles =
        item.map === null
          ? null
          : residueTiles(decodeResidueMap(item.map), { traces: input.traces === true });
      loaded.washed.set(item.item_id, tiles);
      loaded.scene.setItem(item.item_id, itemType, BARE);
      loaded.scene.setItemResidue(item.item_id, tiles);
    }
  },

  render(job: HeadlessRenderJob): string {
    const loaded = sceneOf(job.scene);
    if (loaded.washKey !== job.wash) {
      throw new Error(
        `render page: scene '${job.scene}' is not in wash state '${String(job.wash)}'`,
      );
    }
    const { scene } = loaded;
    scene.setPartPoses(job.poses.parts);
    scene.setItemPoses(job.poses.items);
    scene.setHighlights(job.highlight);
    scene.setGhost(
      job.ghost === null
        ? null
        : { itemType: job.ghost.item_type, pose: job.ghost.pose, tint: 'unknown' },
    );
    renderer.setSize(job.width, job.height, false);
    renderer.setViewport(0, 0, job.width, job.height);
    cameras.resize(job.width / job.height);
    cameras.apply(job.camera);
    renderer.clippingPlanes = clipPlanes(
      job.camera.clip_above_mm,
      job.camera.clip_below_mm ?? null,
    );
    scene.updateCutaway(cameras.cutawayPoint(scratch));
    renderer.render(scene.scene, cameras.active);
    renderer.clippingPlanes = [];
    scene.setGhost(null);
    scene.setHighlights([]);
    return finish(job.width, job.height, job);
  },

  renderItem(job: HeadlessItemJob): string {
    const loaded = sceneOf(job.scene);
    const itemType = loaded.itemTypes.get(job.item_id);
    if (itemType === undefined) throw new Error(`render page: no item '${job.item_id}'`);
    const washed = job.wash !== null && loaded.washKey === job.wash;
    renderer.setSize(job.width, job.height, false);
    renderer.setViewport(0, 0, job.width, job.height);
    renderer.setClearColor(ITEM_VIEW_BACKGROUND, 1);
    renderer.clear();
    for (const panel of job.panels) {
      const itemId = panel.item_id ?? job.item_id;
      const panelType = loaded.itemTypes.get(itemId);
      if (panelType === undefined) throw new Error(`render page: no item '${itemId}'`);
      loaded.itemViews.draw(
        {
          itemType: panelType,
          layers: washed
            ? layersOf(loaded, itemId)
            : soilLayersByRegion(loaded.soils.get(itemId) ?? []),
          residue: washed ? (loaded.washed.get(itemId) ?? null) : null,
        },
        panel.azimuth_deg,
        panel.elevation_deg,
        panel,
      );
    }
    return finish(job.width, job.height, job);
  },

  gpu(): string {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info === null
      ? String(gl.getParameter(gl.RENDERER))
      : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  },
};

(window as unknown as { spotlessRender: HeadlessPageApi }).spotlessRender = api;
