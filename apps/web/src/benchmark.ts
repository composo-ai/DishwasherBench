/**
 * What the page needs for benchmark play beyond the game itself: who is playing (the link a
 * participant is given names an episode and may name them), and the marks of the labelled
 * and gridded views, which are the ones an agent's `render` query draws. Pure logic; the
 * page (`app.ts`) does the fetching and the drawing.
 */

import { quatRotate } from '@spotless/core';
import type { GridFrame, SceneNote, ViewMarksInput } from '@spotless/render';
import type { GeometryPayload, SceneView } from '@spotless/server';
import type { LevelCard } from '@spotless/session';

/** What the part of the address after `#` says. */
export interface EpisodeLink {
  /** The episode (session) to open; null when the address names none. */
  readonly sessionId: string | null;
  /** The player's name, when the link carries one (`#<episode>&player=<name>`). */
  readonly player: string | null;
}

/** Longest player name the server takes. */
export const PLAYER_NAME_MAX = 64;

/**
 * Reads an episode link: `#<episode id>`, optionally followed by `&player=<name>` (the name
 * URL-encoded). Anything else after the id is ignored.
 */
export function parseEpisodeLink(hash: string): EpisodeLink {
  const [first, ...rest] = hash.replace(/^#/, '').split('&');
  const sessionId = first === undefined || first === '' ? null : first;
  let player: string | null = null;
  for (const part of rest) {
    const at = part.indexOf('=');
    if (at < 0 || part.slice(0, at) !== 'player') continue;
    try {
      player = cleanPlayerName(decodeURIComponent(part.slice(at + 1).replace(/\+/g, ' ')));
    } catch {
      player = null;
    }
  }
  return { sessionId, player };
}

/**
 * A name as the server will take it: trimmed, without control characters, at most 64
 * characters; null when nothing is left.
 */
export function cleanPlayerName(name: string): string | null {
  // eslint-disable-next-line no-control-regex
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, PLAYER_NAME_MAX)
    .trim();
  return cleaned === '' ? null : cleaned;
}

/** The baskets (and the cutlery basket) as they stand now, for the grid of a view. */
export function gridFrames(card: LevelCard, parts: SceneView['poses']['parts']): GridFrame[] {
  return card.machine.racks.map((rack) => ({
    frame: rack.rack,
    origin_mm: parts[rack.rack]?.position_mm ?? rack.origin_in_mm,
    size_mm: rack.envelope_mm,
  }));
}

/** The centre of every item in the machine, tub frame, millimetres: where its label goes. */
export function itemCentres(
  view: SceneView,
  geometry: GeometryPayload,
): { item_id: string; centre_mm: [number, number, number] }[] {
  const types = new Map(geometry.items.map((item) => [item.item_id, item.item_type]));
  const out: { item_id: string; centre_mm: [number, number, number] }[] = [];
  for (const placed of view.state.placed) {
    const pose = view.poses.items[placed.item_id];
    const type = geometry.item_types[types.get(placed.item_id) ?? ''];
    if (pose === undefined || type === undefined) continue;
    const [w, x, y, z] = pose.quat_wxyz;
    const length = Math.hypot(w, x, y, z) || 1;
    const centre = quatRotate(
      [x / length, y / length, z / length, w / length],
      [
        (type.bbox.min[0] + type.bbox.max[0]) / 2,
        (type.bbox.min[1] + type.bbox.max[1]) / 2,
        (type.bbox.min[2] + type.bbox.max[2]) / 2,
      ],
    );
    out.push({
      item_id: placed.item_id,
      centre_mm: [
        pose.position_mm[0] + centre[0] * 1000,
        pose.position_mm[1] + centre[1] * 1000,
        pose.position_mm[2] + centre[2] * 1000,
      ],
    });
  }
  return out;
}

/** The ids of the tine rows at their first tines, as the `render` query writes them in a plan view. */
export function tineRowNotes(geometry: GeometryPayload, frames: readonly GridFrame[]): SceneNote[] {
  const notes: SceneNote[] = [];
  for (const row of geometry.machine.affordances.tineRows) {
    const frame = frames.find((f) => f.frame === row.frame);
    const first = row.tines[0];
    if (frame === undefined || first === undefined) continue;
    notes.push({
      text: `tine_row_${row.rowId}${row.state === 'folded' ? ' (folded)' : ''}`,
      frame: row.frame,
      at_mm: [
        frame.origin_mm[0] + first.base[0] * 1000,
        frame.origin_mm[1] + first.base[1] * 1000,
        frame.origin_mm[2] + first.base[2] * 1000,
      ],
    });
  }
  return notes;
}

/**
 * Everything `viewMarks` needs but the projection, from what the page holds: the same input
 * the server's render service builds from the session, so the page's labelled and gridded
 * views carry the same marks as the pictures an agent is sent.
 */
export function marksInput(
  card: LevelCard,
  geometry: GeometryPayload,
  view: SceneView,
  parts: SceneView['poses']['parts'],
): Omit<
  ViewMarksInput,
  'view' | 'width' | 'height' | 'project' | 'grid' | 'labels' | 'clip_above_mm'
> {
  const frames = gridFrames(card, parts);
  return {
    tub_min_mm: card.machine.tub_min_mm,
    tub_max_mm: card.machine.tub_max_mm,
    frames,
    items: itemCentres(view, geometry),
    notes: tineRowNotes(geometry, frames),
  };
}
