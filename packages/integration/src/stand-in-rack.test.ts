// The stand-in rack against its own dimension record: every expectation below is computed from
// STAND_IN_RACK (or from a modified copy of it), and measured on the shapes with the geometry
// kernel, so that replacing the record replaces the rack and nothing else needs to change.
import { mmToM } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import {
  COLLISION_CHORD_ERROR,
  boundingBox,
  buildCollisionPieces,
  signedDistance,
} from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import type { StandInRackDimensions } from './stand-in-rack.ts';
import {
  BASKET_MATERIAL,
  ENVELOPE_HEIGHT,
  RACK_MATERIAL,
  STAND_IN_RACK,
  TUB_FLOOR_MATERIAL,
  buildStandInRack,
} from './stand-in-rack.ts';

const D = STAND_IN_RACK;
const rack = buildStandInRack();
const MM = 1e-3;

function countParts(shape: Shape, prefix: string): number {
  return shape.parts.filter((part) => part.id.startsWith(prefix)).length;
}

describe('the stand-in rack is its dimension record', () => {
  it('has one capsule per wire: the grid, the frame and two rails of tines', () => {
    expect(countParts(rack.rack, 'grid_y.')).toBe(D.gridAlongY.count);
    expect(countParts(rack.rack, 'grid_x.')).toBe(D.gridAlongX.count);
    expect(countParts(rack.rack, 'tine.a.')).toBe(D.tines.count);
    expect(countParts(rack.rack, 'tine.b.')).toBe(D.tines.count);
    // Perimeter and rim: four wires each. Posts: four corners, one per left-to-right wire on
    // each side, and one every `postEvery` front-to-back wires at the front and at the back.
    expect(countParts(rack.rack, 'frame.base.')).toBe(4);
    expect(countParts(rack.rack, 'frame.rim.')).toBe(4);
    const alongFront = Math.floor(
      (D.gridAlongY.count - 1 - Math.floor(D.postEvery / 2)) / D.postEvery + 1,
    );
    expect(countParts(rack.rack, 'frame.post.')).toBe(4 + 2 * D.gridAlongX.count + 2 * alongFront);
    expect(rack.rack.parts.every((part) => part.prim.kind === 'capsule')).toBe(true);
    expect(rack.rack.parts.every((part) => part.material === RACK_MATERIAL)).toBe(true);
    // A capsule is its own collision piece: the engine gets exactly the wires of the shape.
    const pieces = buildCollisionPieces(rack.rack, { chordError: COLLISION_CHORD_ERROR });
    expect(pieces).toHaveLength(rack.rack.parts.length);
    expect(pieces.every((piece) => piece.kind === 'capsule')).toBe(true);
    expect(new Set(pieces.map((piece) => piece.part)).size).toBe(pieces.length);
  });

  it('lies in the rack frame: front-left corner at the origin, top of the base grid at z = 0', () => {
    const box = boundingBox(rack.rack);
    // Outer size over the frame wires; from two grid wire diameters below the top of the grid
    // (the lower layer) up to the top of the rim wire. To a nanometre.
    expect(box.min[0]).toBeCloseTo(0, 9);
    expect(box.min[1]).toBeCloseTo(0, 9);
    expect(box.max[0]).toBeCloseTo(mmToM(D.widthMm), 9);
    expect(box.max[1]).toBeCloseTo(mmToM(D.depthMm), 9);
    expect(box.min[2]).toBeCloseTo(-mmToM(2 * D.gridWireMm), 9);
    expect(box.max[2]).toBeCloseTo(mmToM(D.rimHeightMm + D.frameWireMm / 2), 9);
    // The top of every front-to-back wire is on z = 0, and so is the top of the perimeter.
    // (Half-way between two tines, so that on the rails the point is on the wire, not in a tine.)
    const y = mmToM(D.tines.firstMm + D.tines.pitchMm / 2);
    for (const x of rack.wiresAlongY) {
      expect(signedDistance(rack.rack, [x, y, 0])).toBeCloseTo(0, 12);
      expect(signedDistance(rack.rack, [x, y, 0.001])).toBeCloseTo(0.001, 12);
    }
    expect(signedDistance(rack.rack, [mmToM(D.frameWireMm / 2), y, 0])).toBeCloseTo(0, 12);
    // The left-to-right wires lie one wire diameter lower.
    const xMid = (rack.wiresAlongY[0] as number) + mmToM(D.gridAlongY.pitchMm / 2);
    for (const wireY of rack.wiresAlongX) {
      expect(signedDistance(rack.rack, [xMid, wireY, -rack.opening.lowerLayerDrop])).toBeCloseTo(
        0,
        12,
      );
    }
  });

  it('has the grid openings its pitches and wire diameter give', () => {
    expect(rack.opening.alongX).toBeCloseTo(mmToM(D.gridAlongY.pitchMm - D.gridWireMm), 12);
    expect(rack.opening.alongY).toBeCloseTo(mmToM(D.gridAlongX.pitchMm - D.gridWireMm), 12);
    // Measured on the shape, in an opening away from the tines: a ball that just passes between
    // two front-to-back wires has the clear gap as its diameter. Going down the middle of the
    // opening, the least distance to any wire is half that gap, at the level of the wire axes.
    const rail = Math.max(...D.tines.railWires);
    const i = rail + 2;
    const x = ((rack.wiresAlongY[i] as number) + (rack.wiresAlongY[i + 1] as number)) / 2;
    const y = ((rack.wiresAlongX[1] as number) + (rack.wiresAlongX[2] as number)) / 2;
    let least = Infinity;
    for (let z = 0.01; z >= -0.02; z -= 0.0001) {
      least = Math.min(least, signedDistance(rack.rack, [x, y, z]));
    }
    expect(least).toBeCloseTo(rack.opening.alongX / 2, 6);
    // The other way, between two left-to-right wires: taken on their own (the upper layer is
    // nearer everywhere), the point midway between two of them at the level of their axes is
    // half their clear gap from either.
    const lower: Shape = {
      parts: rack.rack.parts.filter((part) => part.id.startsWith('grid_x.')),
      regions: [],
    };
    expect(signedDistance(lower, [x, y, -1.5 * rack.opening.lowerLayerDrop])).toBeCloseTo(
      rack.opening.alongY / 2,
      12,
    );
    // And the two layers touch: the top of a lower wire is the bottom of an upper one.
    const xOnWire = rack.wiresAlongY[i] as number;
    const yOnWire = rack.wiresAlongX[1] as number;
    expect(signedDistance(lower, [xOnWire, yOnWire, -rack.opening.lowerLayerDrop])).toBeCloseTo(
      0,
      12,
    );
  });

  it('has tines of the stated height with round tips, a stated pitch apart', () => {
    expect(rack.slots).toHaveLength(D.tines.count - 1);
    const rTine = mmToM(D.tineWireMm / 2);
    for (const slot of rack.slots) {
      expect(slot.backY - slot.frontY).toBeCloseTo(mmToM(D.tines.pitchMm), 12);
      expect(slot.clearWidth).toBeCloseTo(mmToM(D.tines.pitchMm - D.tineWireMm), 12);
      expect(slot.railX[1] - slot.railX[0]).toBeCloseTo(
        mmToM((D.tines.railWires[1] - D.tines.railWires[0]) * D.gridAlongY.pitchMm),
        12,
      );
      for (const x of slot.railX) {
        // The tip is at the stated height; 1 mm above it there is 1 mm of air.
        expect(signedDistance(rack.rack, [x, slot.frontY, slot.tineHeight])).toBeCloseTo(0, 12);
        expect(signedDistance(rack.rack, [x, slot.frontY, slot.tineHeight + 0.001])).toBeCloseTo(
          0.001,
          12,
        );
        // The tip is a hemisphere: level with its centre, the surface is one radius out.
        expect(
          signedDistance(rack.rack, [x + 2 * rTine, slot.frontY, slot.tineHeight - rTine]),
        ).toBeCloseTo(rTine, 12);
        // Half-way up, the middle of the slot is half the clear width from either tine.
        expect(
          signedDistance(rack.rack, [x, (slot.frontY + slot.backY) / 2, slot.tineHeight / 2]),
        ).toBeCloseTo(slot.clearWidth / 2, 12);
      }
    }
    // The rails are grid wires, and a plate centred between them is centred between two grid
    // wires, where its rim rests on both.
    const first = rack.slots[0];
    if (first === undefined) throw new Error('no slot');
    expect(rack.wiresAlongY).toContain(first.railX[0]);
    expect(rack.wiresAlongY).toContain(first.railX[1]);
    const nearest = Math.min(...rack.wiresAlongY.map((x) => Math.abs(x - first.centreX)));
    expect(nearest).toBeCloseTo(mmToM(D.gridAlongY.pitchMm / 2), 12);
  });

  it('has a basket of cells of the stated clear size standing on the grid', () => {
    const b = D.basket;
    expect(rack.cells).toHaveLength(b.cells[0] * b.cells[1]);
    expect(rack.basket.parts.every((part) => part.material === BASKET_MATERIAL)).toBe(true);
    const box = boundingBox(rack.basket);
    const sizeX = b.cells[0] * b.cellMm[0] + (b.cells[0] + 1) * b.wallMm;
    const sizeY = b.cells[1] * b.cellMm[1] + (b.cells[1] + 1) * b.wallMm;
    expect(box.min[0]).toBeCloseTo(mmToM(b.cornerMm[0]), 12);
    expect(box.min[1]).toBeCloseTo(mmToM(b.cornerMm[1]), 12);
    expect(box.max[0] - box.min[0]).toBeCloseTo(mmToM(sizeX), 12);
    expect(box.max[1] - box.min[1]).toBeCloseTo(mmToM(sizeY), 12);
    expect(box.min[2]).toBeCloseTo(0, 12);
    expect(box.max[2]).toBeCloseTo(mmToM(b.floorMm + b.depthMm), 12);
    // It stands inside the frame.
    expect(box.max[0]).toBeLessThan(mmToM(D.widthMm - D.frameWireMm));
    expect(box.max[1]).toBeLessThan(mmToM(D.depthMm - D.frameWireMm));
    const half = Math.min(b.cellMm[0], b.cellMm[1]) / 2;
    for (const cell of rack.cells) {
      expect(cell.inner.max[0] - cell.inner.min[0]).toBeCloseTo(mmToM(b.cellMm[0]), 12);
      expect(cell.inner.max[1] - cell.inner.min[1]).toBeCloseTo(mmToM(b.cellMm[1]), 12);
      expect(cell.inner.max[2] - cell.inner.min[2]).toBeCloseTo(mmToM(b.depthMm), 12);
      // The middle of a cell at mid height is half the smaller clear size from its walls...
      const mid = (cell.inner.min[2] + cell.inner.max[2]) / 2;
      expect(signedDistance(rack.basket, [cell.centre[0], cell.centre[1], mid])).toBeCloseTo(
        mmToM(half),
        12,
      );
      // ...and 1 mm above the floor it is 1 mm above the floor.
      expect(
        signedDistance(rack.basket, [cell.centre[0], cell.centre[1], cell.inner.min[2] + MM]),
      ).toBeCloseTo(MM, 12);
    }
    // Neighbouring cells are one wall apart.
    const [c0, c1] = [rack.cells[0], rack.cells[1]];
    if (c0 === undefined || c1 === undefined) throw new Error('no cells');
    expect(c1.inner.min[0] - c0.inner.max[0]).toBeCloseTo(mmToM(b.wallMm), 12);
  });

  it('has an envelope that is the inside of the frame, open upwards', () => {
    const frame = mmToM(D.frameWireMm);
    expect(rack.envelope.min[0]).toBeCloseTo(frame, 12);
    expect(rack.envelope.min[1]).toBeCloseTo(frame, 12);
    expect(rack.envelope.max[0]).toBeCloseTo(mmToM(D.widthMm) - frame, 12);
    expect(rack.envelope.max[1]).toBeCloseTo(mmToM(D.depthMm) - frame, 12);
    // From the underside of the grid to well above the rim: a plate on edge stands taller.
    expect(rack.envelope.min[2]).toBeCloseTo(boundingBox(rack.rack).min[2], 12);
    expect(rack.envelope.max[2]).toBe(ENVELOPE_HEIGHT);
    expect(ENVELOPE_HEIGHT).toBeGreaterThan(2 * mmToM(D.rimHeightMm));
    // The inner faces of the frame wires are on its sides.
    const mid = mmToM(D.rimHeightMm);
    expect(
      signedDistance(rack.rack, [rack.envelope.min[0], mmToM(D.depthMm / 2) + 0.01, mid]),
    ).toBeCloseTo(0, 9);
  });

  it('has an open part of the grid beside the plates and behind the basket', () => {
    const b = D.basket;
    const frame = mmToM(D.frameWireMm);
    const rightRail = mmToM(D.gridAlongY.firstMm + D.tines.railWires[1] * D.gridAlongY.pitchMm);
    // From two and a half pitches right of the right-hand rail to the frame; from the back of
    // the basket (its corner, its cells and its walls) to the frame.
    expect(rack.openZone.min[0]).toBeCloseTo(rightRail + mmToM(2.5 * D.gridAlongY.pitchMm), 12);
    expect(rack.openZone.max[0]).toBeCloseTo(mmToM(D.widthMm) - frame, 12);
    expect(rack.openZone.min[1]).toBeCloseTo(
      mmToM(b.cornerMm[1] + b.cells[1] * b.cellMm[1] + (b.cells[1] + 1) * b.wallMm),
      12,
    );
    expect(rack.openZone.max[1]).toBeCloseTo(mmToM(D.depthMm) - frame, 12);
    // The point to stand things on is inside it, half-way front to back, exactly between two
    // front-to-back wires, and far from tines and basket: the nearest thing at 30 mm above the
    // grid is a wire of the grid itself, and the basket is more than 100 mm away.
    const [x, y] = rack.openPoint;
    expect(x).toBeGreaterThan(rack.openZone.min[0]);
    expect(x).toBeLessThan(rack.openZone.max[0]);
    expect(y).toBeCloseTo((rack.openZone.min[1] + rack.openZone.max[1]) / 2, 12);
    const nearest = Math.min(...rack.wiresAlongY.map((wire) => Math.abs(wire - x)));
    expect(nearest).toBeCloseTo(mmToM(D.gridAlongY.pitchMm / 2), 12);
    const rGrid = mmToM(D.gridWireMm / 2);
    expect(signedDistance(rack.rack, [x, y, 0.03])).toBeCloseTo(
      Math.hypot(nearest, 0.03 + rGrid) - rGrid,
      9,
    );
    expect(signedDistance(rack.basket, [x, y, 0.03])).toBeGreaterThan(0.1);
    // A 160 mm bowl stood there is clear of the frame, the basket and a plate in the slots.
    expect(x + 0.08).toBeLessThan(rack.openZone.max[0]);
    expect(x - 0.08).toBeGreaterThan(rack.openZone.min[0]);
    expect(y - 0.08).toBeGreaterThan(rack.openZone.min[1]);
    expect(y + 0.08).toBeLessThan(rack.openZone.max[1]);
    // A rack too narrow to have anything beside the plates has no such zone, and says so.
    const narrow: StandInRackDimensions = {
      ...D,
      widthMm: 340,
      gridAlongY: { ...D.gridAlongY, count: 9 },
      basket: { ...b, cornerMm: [200, 12] },
    };
    expect(() => buildStandInRack(narrow)).toThrow(/no open part of the grid/);
  });

  it('has a tub floor the stated distance below the grid', () => {
    expect(rack.tubFloorZ).toBeCloseTo(-mmToM(D.tubFloorBelowGridMm), 12);
    expect(rack.tubFloor.parts[0]?.material).toBe(TUB_FLOOR_MATERIAL);
    const centre = [mmToM(D.widthMm / 2), mmToM(D.depthMm / 2)] as const;
    expect(signedDistance(rack.tubFloor, [centre[0], centre[1], rack.tubFloorZ])).toBeCloseTo(
      0,
      12,
    );
    expect(signedDistance(rack.tubFloor, [centre[0], centre[1], 0])).toBeCloseTo(
      mmToM(D.tubFloorBelowGridMm),
      12,
    );
    // Nothing of the rack reaches it.
    expect(boundingBox(rack.rack).min[2]).toBeGreaterThan(rack.tubFloorZ + 0.03);
  });
});

describe('another dimension record gives another rack', () => {
  it('follows a change of every group of dimensions', () => {
    const other: StandInRackDimensions = {
      ...D,
      widthMm: 600,
      gridAlongY: { firstMm: 20, pitchMm: 40, count: 14 },
      gridAlongX: { firstMm: 60, pitchMm: 75, count: 6 },
      tines: { railWires: [2, 7], firstMm: 50, pitchMm: 26, count: 9, heightMm: 81 },
      basket: { ...D.basket, cornerMm: [450, 20], cells: [2, 3], cellMm: [50, 70] },
      tubFloorBelowGridMm: 71,
    };
    const built = buildStandInRack(other);
    expect(built.dims).toBe(other);
    expect(boundingBox(built.rack).max[0]).toBeCloseTo(0.6, 9);
    expect(built.wiresAlongY).toHaveLength(14);
    expect(built.wiresAlongY[13]).toBeCloseTo(0.54, 12);
    expect(built.wiresAlongX).toHaveLength(6);
    expect(built.opening.alongX).toBeCloseTo(0.0358, 12);
    expect(built.opening.alongY).toBeCloseTo(0.0708, 12);
    expect(built.slots).toHaveLength(8);
    expect(built.slots[0]?.railX).toEqual([0.1, 0.3]);
    expect(built.slots[0]?.centreX).toBeCloseTo(0.2, 12);
    expect(built.slots[7]?.backY).toBeCloseTo(0.258, 12);
    expect(built.slots[0]?.clearWidth).toBeCloseTo(0.0218, 12);
    expect(built.slots[0]?.tineHeight).toBeCloseTo(0.081, 12);
    expect(built.cells).toHaveLength(6);
    expect(built.cells[5]?.index).toEqual([1, 2]);
    expect(built.tubFloorZ).toBeCloseTo(-0.071, 12);
    // The standard rack is untouched: the builder keeps no state.
    expect(buildStandInRack().wiresAlongY).toEqual(rack.wiresAlongY);
  });

  it('refuses dimensions that do not make a rack', () => {
    const bad: Partial<StandInRackDimensions>[] = [
      { widthMm: 0 },
      { gridWireMm: -1 },
      { gridAlongY: { firstMm: 17.5, pitchMm: 35, count: 16 } }, // the last wire is beyond the frame
      { gridAlongX: { firstMm: 2, pitchMm: 100, count: 5 } }, // the first wire is in the frame wire
      { gridAlongY: { firstMm: 17.5, pitchMm: 4, count: 15 } }, // wires closer than they are thick
      { tines: { ...D.tines, railWires: [6, 3] } },
      { tines: { ...D.tines, railWires: [3, 15] } },
      { tines: { ...D.tines, count: 14 } }, // the last tine is beyond the frame
      { tines: { ...D.tines, pitchMm: 4 } },
      { postEvery: 0 },
      { basket: { ...D.basket, cells: [0, 4] } },
      { basket: { ...D.basket, wallMm: 0 } },
      { tubFloorBelowGridMm: Number.NaN },
    ];
    for (const change of bad) {
      expect(() => buildStandInRack({ ...D, ...change }), JSON.stringify(change)).toThrow(
        RangeError,
      );
    }
  });
});
