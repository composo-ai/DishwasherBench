/**
 * The 3D stage of the client: the renderer on the page's canvas, the cameras with their orbit
 * control, the named views, and the conversions between the mouse and the tub frame. It draws
 * the scene of `@spotless/render` and decides nothing about the game.
 */

import type {
  OverlayMarks,
  Projector,
  RegionLayers,
  SceneViewName,
  ViewSubject,
} from '@spotless/render';
import {
  clipPlanes,
  drawOverlay,
  fitView,
  ITEM_VIEW_BACKGROUND,
  ITEM_VIEW_DIRECTIONS,
  ItemViewRenderer,
  itemAxisMarks,
  projectorOf,
  SpotlessScene,
  ThumbnailRenderer,
  ViewCameras,
  viewSpec,
} from '@spotless/render';
import {
  NeutralToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** A view of the stage: one of the named views, or the free orbit camera. */
export type StageView = SceneViewName | 'orbit';

/**
 * Computes the marks drawn over the picture (grid, labels) for the camera as it stands: the
 * projection onto the picture, its size in CSS pixels, and the heights the view cuts at.
 */
export type MarksBuilder = (
  project: Projector,
  width: number,
  height: number,
  clip: { readonly above: number | null; readonly below: number | null },
) => OverlayMarks;

/** Edge of a picture of the item in hand, pixels. */
export const ITEM_PICTURE_PX = 132;

/** The canvas, its renderer and its cameras. */
export class Stage {
  readonly scene = new SpotlessScene();
  readonly cameras = new ViewCameras();
  readonly controls: OrbitControls;
  readonly thumbnails: ThumbnailRenderer;
  private readonly renderer: WebGLRenderer;
  private readonly scratch = new Vector3();
  private current: StageView = 'iso_lower';
  private marks: MarksBuilder | null = null;
  private clip: { above: number | null; below: number | null } = { above: null, below: null };
  private itemViews: { renderer: WebGLRenderer; views: ItemViewRenderer } | null = null;

  /**
   * `overlay` is a canvas laid over `canvas`, on which the grid and the labels are drawn; it
   * takes no mouse events.
   */
  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly overlay: HTMLCanvasElement | null = null,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.localClippingEnabled = false;
    this.scene.attachEnvironment(this.renderer);
    this.thumbnails = new ThumbnailRenderer(this.scene.factory);
    this.controls = new OrbitControls(this.cameras.active, canvas);
    this.controls.enableDamping = false;
    this.controls.zoomSpeed = 1.2;
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 6;
    this.controls.maxPolarAngle = Math.PI * 0.95;
    this.resize();
  }

  /** The view last chosen. */
  get view(): StageView {
    return this.current;
  }

  /** Points the camera as a view says. The free orbit view starts from the three-quarter view. */
  setView(view: StageView, subject: ViewSubject): void {
    this.current = view;
    const aspect = this.aspect();
    const spec = fitView(viewSpec(view === 'orbit' ? 'iso_lower' : view, subject), aspect);
    if (view === 'orbit') {
      // The whole machine with whatever is pulled out of it, from a little further away.
      const centre: [number, number, number] = [
        (subject.tub_min_mm[0] + subject.tub_max_mm[0]) / 2,
        subject.tub_min_mm[1],
        (subject.tub_min_mm[2] + subject.tub_max_mm[2]) / 2,
      ];
      const reach = 2300;
      const dx = spec.position_mm[0] - spec.target_mm[0];
      const dy = spec.position_mm[1] - spec.target_mm[1];
      const dz = spec.position_mm[2] - spec.target_mm[2];
      const length = Math.hypot(dx, dy, dz);
      this.cameras.apply({
        ...spec,
        target_mm: centre,
        position_mm: [
          centre[0] + (dx / length) * reach,
          centre[1] + (dy / length) * reach,
          centre[2] + (dz / length) * reach,
        ],
        clip_above_mm: null,
      });
      this.renderer.clippingPlanes = [];
      this.clip = { above: null, below: null };
    } else {
      this.cameras.apply(spec);
      this.renderer.clippingPlanes = clipPlanes(spec.clip_above_mm, spec.clip_below_mm ?? null);
      this.clip = { above: spec.clip_above_mm, below: spec.clip_below_mm ?? null };
    }
    this.controls.object = this.cameras.active;
    this.controls.target.copy(this.cameras.target);
    // A plan view is turned about its own axis only by dragging; keep its up vector.
    this.controls.enableRotate = true;
    this.controls.update();
  }

  private aspect(): number {
    const { clientWidth, clientHeight } = this.canvas;
    return clientHeight > 0 ? clientWidth / clientHeight : 1;
  }

  /** Adapts the renderer and the cameras to the size of the canvas on the page. */
  resize(): void {
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.cameras.resize(clientWidth / clientHeight);
  }

  /** Draws one frame. */
  render(): void {
    this.controls.update();
    const camera = this.cameras.active;
    if (camera === this.cameras.perspective) {
      this.scratch.copy(camera.position);
    } else {
      this.scratch
        .copy(camera.position)
        .sub(this.controls.target)
        .normalize()
        .multiplyScalar(100)
        .add(this.controls.target);
    }
    this.scene.updateCutaway(this.scratch);
    this.renderer.render(this.scene.scene, camera);
    this.drawMarks();
  }

  /**
   * Sets what is drawn over the picture from now on (the grid and the labels of the views an
   * agent is sent); null for nothing.
   */
  setMarks(builder: MarksBuilder | null): void {
    this.marks = builder;
  }

  /** Draws the marks for the camera as it stands on the overlay canvas, or clears it. */
  private drawMarks(): void {
    const overlay = this.overlay;
    if (overlay === null) return;
    const { clientWidth: width, clientHeight: height } = this.canvas;
    const ratio = Math.min(window.devicePixelRatio, 2);
    if (
      overlay.width !== Math.round(width * ratio) ||
      overlay.height !== Math.round(height * ratio)
    ) {
      overlay.width = Math.round(width * ratio);
      overlay.height = Math.round(height * ratio);
    }
    const context = overlay.getContext('2d');
    if (context === null) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, overlay.width, overlay.height);
    if (this.marks === null || width === 0 || height === 0) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawOverlay(
      context,
      this.marks(projectorOf(this.cameras.active, width, height), width, height, this.clip),
    );
  }

  /**
   * Pictures of one item from its four fixed sides, soil showing: the same four an agent gets
   * from `get_item`. PNG data URLs, in the order of `ITEM_VIEW_DIRECTIONS`. With the item's
   * reference point (its own frame, millimetres) the axes of its frame are drawn from it, as
   * on the agent's pictures: which end is +x.
   */
  itemPictures(
    itemType: string,
    layers: RegionLayers,
    referenceMm?: readonly [number, number, number],
  ): string[] {
    if (this.itemViews === null) {
      const canvas = document.createElement('canvas');
      const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = NeutralToneMapping;
      renderer.setPixelRatio(1);
      renderer.setSize(ITEM_PICTURE_PX, ITEM_PICTURE_PX, false);
      this.itemViews = { renderer, views: new ItemViewRenderer(renderer, this.scene.factory) };
    }
    const { renderer, views } = this.itemViews;
    const panel = { x: 0, y: 0, width: ITEM_PICTURE_PX, height: ITEM_PICTURE_PX };
    const bounds = this.scene.factory.bounds(itemType);
    return ITEM_VIEW_DIRECTIONS.map((direction) => {
      renderer.setViewport(0, 0, ITEM_PICTURE_PX, ITEM_PICTURE_PX);
      renderer.setClearColor(ITEM_VIEW_BACKGROUND, 1);
      renderer.clear();
      views.draw({ itemType, layers }, direction.azimuth_deg, direction.elevation_deg, panel);
      if (referenceMm === undefined) return renderer.domElement.toDataURL('image/png');
      // The picture with the axes over it, on a canvas of its own.
      const out = document.createElement('canvas');
      out.width = ITEM_PICTURE_PX;
      out.height = ITEM_PICTURE_PX;
      const context = out.getContext('2d');
      if (context === null) return renderer.domElement.toDataURL('image/png');
      context.drawImage(renderer.domElement, 0, 0);
      drawOverlay(
        context,
        itemAxisMarks({
          min_mm: [bounds.min[0] * 1000, bounds.min[1] * 1000, bounds.min[2] * 1000],
          max_mm: [bounds.max[0] * 1000, bounds.max[1] * 1000, bounds.max[2] * 1000],
          reference_mm: referenceMm,
          azimuth_deg: direction.azimuth_deg,
          elevation_deg: direction.elevation_deg,
          panel,
        }),
      );
      return out.toDataURL('image/png');
    });
  }

  /** A point of the page in normalised device coordinates of the canvas. */
  ndc(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    };
  }

  /** The ray under a point of the page: origin (millimetres) and unit direction, tub frame. */
  ray(
    clientX: number,
    clientY: number,
  ): { origin_mm: [number, number, number]; direction: [number, number, number] } {
    const { x, y } = this.ndc(clientX, clientY);
    const camera = this.cameras.active;
    camera.updateMatrixWorld();
    const origin = new Vector3();
    const direction = new Vector3();
    if (camera === this.cameras.perspective) {
      origin.setFromMatrixPosition(camera.matrixWorld);
      direction.set(x, y, 0.5).unproject(camera).sub(origin).normalize();
    } else {
      origin.set(x, y, -1).unproject(camera);
      direction.set(0, 0, -1).transformDirection(camera.matrixWorld);
    }
    return {
      origin_mm: [origin.x * 1000, origin.y * 1000, origin.z * 1000],
      direction: [direction.x, direction.y, direction.z],
    };
  }

  /** Where a point of the tub frame (millimetres) is on the page, in CSS pixels. */
  project(pointMm: readonly [number, number, number]): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const camera = this.cameras.active;
    camera.updateMatrixWorld();
    const p = this.scratch
      .set(pointMm[0] / 1000, pointMm[1] / 1000, pointMm[2] / 1000)
      .project(camera);
    return [rect.left + ((p.x + 1) / 2) * rect.width, rect.top + ((1 - p.y) / 2) * rect.height];
  }

  /** The item under a point of the page, or null. */
  pick(clientX: number, clientY: number): string | null {
    return this.scene.pickItem(this.ndc(clientX, clientY), this.cameras.active);
  }

  /** The picture on the canvas as a PNG data URL. */
  snapshot(): string {
    this.render();
    return this.canvas.toDataURL('image/png');
  }
}
