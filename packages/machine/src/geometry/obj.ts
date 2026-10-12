/**
 * The machine as a Wavefront OBJ document, from the geometry kernel's render meshes, for
 * inspection in a 3D viewer. Tub frame, metres, z up (choose "Z up" when importing).
 */

import type { Pose } from '@spotless/core';
import { poseTransformPoint } from '@spotless/core';
import { buildRenderMesh, RENDER_CHORD_ERROR } from '@spotless/geometry';
import { machinePartPose } from './build.ts';
import type { MachineGeometry, MachinePart } from './types.ts';

/** Options of `machineObj`. */
export interface MachineObjOptions {
  /** Chord error of the render meshes, metres; default the platform's 0.1 mm. */
  readonly chordError?: number;
  /** Which parts to write; default all. */
  readonly include?: (part: MachinePart) => boolean;
  /** Arm angle, radians, applied to every spray arm; default 0. */
  readonly armAngle?: number;
  /** How far each basket is pulled out, metres, by basket id; default pushed in. */
  readonly basketTravel?: Readonly<Record<string, number>>;
}

/** An OBJ document and what is in it. */
export interface MachineObj {
  readonly text: string;
  /** One entry per object written: the part id and its triangle count. */
  readonly objects: readonly { readonly id: string; readonly triangles: number }[];
  readonly vertices: number;
  readonly triangles: number;
}

/**
 * Writes every part of a machine geometry as one OBJ object (`o <part id>`), posed in the tub
 * frame. Vertices are in metres with six decimals; faces index them from 1 as OBJ requires.
 */
export function machineObj(geometry: MachineGeometry, options: MachineObjOptions = {}): MachineObj {
  const chordError = options.chordError ?? RENDER_CHORD_ERROR;
  const lines: string[] = [
    `# ${geometry.machineId}: machine geometry of @spotless/machine`,
    '# tub frame: origin on the lower spray-arm axis at the floor datum, +x right, +y back, +z up; metres',
    `# render chord error ${(chordError * 1000).toFixed(3)} mm`,
  ];
  const objects: { id: string; triangles: number }[] = [];
  let offset = 1;
  let triangles = 0;
  for (const part of geometry.parts) {
    if (options.include !== undefined && !options.include(part)) continue;
    const pose: Pose = machinePartPose(geometry, part, {
      ...(options.armAngle === undefined ? {} : { armAngle: options.armAngle }),
      ...(options.basketTravel === undefined ? {} : { basketTravel: options.basketTravel }),
    });
    const mesh = buildRenderMesh(part.shape, { chordError });
    const count = mesh.positions.length / 3;
    lines.push(`o ${part.id}`);
    for (let i = 0; i < count; i++) {
      const p = poseTransformPoint(pose, [
        mesh.positions[3 * i] as number,
        mesh.positions[3 * i + 1] as number,
        mesh.positions[3 * i + 2] as number,
      ]);
      lines.push(`v ${p[0].toFixed(6)} ${p[1].toFixed(6)} ${p[2].toFixed(6)}`);
    }
    const faces = mesh.indices.length / 3;
    for (let t = 0; t < faces; t++) {
      const a = (mesh.indices[3 * t] as number) + offset;
      const b = (mesh.indices[3 * t + 1] as number) + offset;
      const c = (mesh.indices[3 * t + 2] as number) + offset;
      lines.push(`f ${a} ${b} ${c}`);
    }
    offset += count;
    triangles += faces;
    objects.push({ id: part.id, triangles: faces });
  }
  lines.push('');
  return { text: lines.join('\n'), objects, vertices: offset - 1, triangles };
}
