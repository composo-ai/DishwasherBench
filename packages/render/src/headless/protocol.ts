/**
 * What goes between the render service (Node) and its page (headless Chrome): plain JSON.
 * The page holds scenes (a machine, item types and the items of a level with their soil) and
 * draws them as it is told; every decision about what a picture shows (the camera, the
 * marks) is taken on the Node side by the pure functions of this package, so the page only
 * builds the scene of `SpotlessScene` and paints.
 */

import type { OverlayMarks } from '../overlay.ts';
import type { ResidueMapInput } from '../residue-map.ts';
import type {
  CameraSpec,
  DrawPoseInput,
  ItemTypeInput,
  MachinePartInput,
  SoilInput,
} from '../types.ts';

/** A scene the page builds once and then draws many times. */
export interface HeadlessSceneInput {
  readonly parts: readonly MachinePartInput[];
  readonly item_types: readonly ItemTypeInput[];
  /** The items of the level: their type and the soil the level puts on them. */
  readonly items: readonly {
    readonly item_id: string;
    readonly item_type: string;
    readonly soils: readonly SoilInput[];
  }[];
}

/** What a finished wash left: the washed items are drawn bare, with their residue where it is. */
export interface HeadlessWashInput {
  readonly items: readonly {
    readonly item_id: string;
    /** The residue map of the item, or null when nothing is left on it. */
    readonly map: ResidueMapInput | null;
  }[];
  /** Also draw the traces too faint to count, as small dots. Default false. */
  readonly traces?: boolean;
}

/** One picture of the machine. */
export interface HeadlessRenderJob {
  /** Key of a scene loaded with `loadScene`. */
  readonly scene: string;
  /** Key of the wash state set with `setWash`, or null for the items as the level soils them. */
  readonly wash: string | null;
  readonly width: number;
  readonly height: number;
  readonly camera: CameraSpec;
  readonly poses: {
    readonly parts: { readonly [partId: string]: DrawPoseInput };
    readonly items: { readonly [itemId: string]: DrawPoseInput };
  };
  /** Items to mark. */
  readonly highlight: readonly string[];
  /** A candidate pose drawn as a translucent ghost, or null. */
  readonly ghost: { readonly item_type: string; readonly pose: DrawPoseInput } | null;
  /** Grid, labels and caption, in image pixels. */
  readonly marks: OverlayMarks;
}

/** One picture of a single item, made of one or more panels. */
export interface HeadlessItemJob {
  readonly scene: string;
  readonly item_id: string;
  /** Draw the item as it came out of the wash (needs the wash state `wash`). */
  readonly wash: string | null;
  readonly width: number;
  readonly height: number;
  readonly panels: readonly {
    /** The item this panel shows when it is not `item_id` (a sheet of several items). */
    readonly item_id?: string;
    readonly azimuth_deg: number;
    readonly elevation_deg: number;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
  readonly marks: OverlayMarks;
}

/** What the page exposes as `window.spotlessRender`. */
export interface HeadlessPageApi {
  /** Builds a scene; replaces a scene of the same key. */
  loadScene(key: string, input: HeadlessSceneInput): void;
  /** Keys of the scenes the page holds. */
  scenes(): string[];
  /** Frees a scene. */
  dropScene(key: string): void;
  /** Sets (or with null clears) what a wash left on the items of a scene. */
  setWash(scene: string, key: string | null, input: HeadlessWashInput | null): void;
  /** Draws a picture of the machine and returns it as base64 PNG. */
  render(job: HeadlessRenderJob): string;
  /** Draws a picture of one item and returns it as base64 PNG. */
  renderItem(job: HeadlessItemJob): string;
  /** The WebGL renderer string of the page (which GPU drew the pictures). */
  gpu(): string;
}
