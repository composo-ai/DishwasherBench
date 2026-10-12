/**
 * Wavefront OBJ export of posed shapes, for looking at a scene without a renderer. Every mesh is
 * the geometry kernel's render mesh of the body's `Shape`, so the file shows what the kernel
 * describes, not the collision pieces.
 *
 * The file keeps the frame and units of the platform: right-handed, z up, metres. Most viewers
 * assume y up; turn the model by -90 degrees about x (or choose "Z up" on import) to see it the
 * right way up.
 */

import type { Pose } from '@spotless/core';
import { poseTransformPoint, quatRotate } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import { RENDER_CHORD_ERROR, buildRenderMesh } from '@spotless/geometry';

/** One body to export: a shape at a pose (shape frame to world frame). */
export interface ObjBody {
  /** Object name in the file (`o` line); white space is replaced by underscores. */
  readonly name: string;
  readonly shape: Shape;
  readonly pose: Pose;
}

/** Vertex and triangle counts of one exported object. */
export interface ObjObjectStats {
  readonly name: string;
  readonly vertices: number;
  readonly triangles: number;
}

/** An OBJ document and what it contains. */
export interface ObjDocument {
  /** The text of the file. */
  readonly text: string;
  /** Total number of vertices (`v` lines; as many `vn` lines) and of triangles (`f` lines). */
  readonly vertices: number;
  readonly triangles: number;
  readonly objects: readonly ObjObjectStats[];
}

/** Options of {@link buildObj}. */
export interface ObjOptions {
  /** Chord error of the meshes, metres; defaults to the platform's render chord error (0.1 mm). */
  readonly chordError?: number;
  /** Comment lines for the head of the file. */
  readonly comments?: readonly string[];
}

function safeName(name: string): string {
  return name.replace(/\s+/g, '_');
}

function fixed(x: number): string {
  // Micrometre resolution; avoid "-0.000000".
  const text = x.toFixed(6);
  return text === '-0.000000' ? '0.000000' : text;
}

/**
 * Builds an OBJ document from posed shapes: one object (`o`) per body, one group (`g`) per part
 * of its shape, vertices with normals in the world frame, triangles wound counter-clockwise seen
 * from outside. Bodies with the same `Shape` object share one mesh computation.
 */
export function buildObj(bodies: readonly ObjBody[], options: ObjOptions = {}): ObjDocument {
  const chordError = options.chordError ?? RENDER_CHORD_ERROR;
  const meshes = new Map<Shape, ReturnType<typeof buildRenderMesh>>();
  const lines: string[] = [
    '# Spotless scene: render meshes of the geometry kernel',
    '# frame: right-handed, z up; units: metres',
    `# chord error: ${(chordError * 1000).toFixed(3)} mm`,
  ];
  for (const comment of options.comments ?? []) lines.push(`# ${comment}`);
  const objects: ObjObjectStats[] = [];
  let offset = 0;
  let triangles = 0;
  for (const body of bodies) {
    let mesh = meshes.get(body.shape);
    if (mesh === undefined) {
      mesh = buildRenderMesh(body.shape, { chordError });
      meshes.set(body.shape, mesh);
    }
    const vertexCount = mesh.positions.length / 3;
    const triangleCount = mesh.indices.length / 3;
    lines.push(`o ${safeName(body.name)}`);
    for (let v = 0; v < vertexCount; v++) {
      const p = poseTransformPoint(body.pose, [
        mesh.positions[3 * v] as number,
        mesh.positions[3 * v + 1] as number,
        mesh.positions[3 * v + 2] as number,
      ]);
      lines.push(`v ${fixed(p[0])} ${fixed(p[1])} ${fixed(p[2])}`);
    }
    for (let v = 0; v < vertexCount; v++) {
      const n = quatRotate(body.pose.q, [
        mesh.normals[3 * v] as number,
        mesh.normals[3 * v + 1] as number,
        mesh.normals[3 * v + 2] as number,
      ]);
      lines.push(`vn ${fixed(n[0])} ${fixed(n[1])} ${fixed(n[2])}`);
    }
    // Triangles are stored part by part; start a group whenever the part changes.
    let part = -1;
    for (let t = 0; t < triangleCount; t++) {
      const triPart = mesh.triPart[t] as number;
      if (triPart !== part) {
        part = triPart;
        lines.push(`g ${safeName(body.name)}.${safeName(mesh.partIds[part] as string)}`);
      }
      const a = (mesh.indices[3 * t] as number) + offset + 1;
      const b = (mesh.indices[3 * t + 1] as number) + offset + 1;
      const c = (mesh.indices[3 * t + 2] as number) + offset + 1;
      lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
    }
    objects.push({ name: safeName(body.name), vertices: vertexCount, triangles: triangleCount });
    offset += vertexCount;
    triangles += triangleCount;
  }
  lines.push('');
  return { text: lines.join('\n'), vertices: offset, triangles, objects };
}
