// The geometric predictions the scenarios rely on, against closed forms worked out by hand from
// the rack's dimension record: a flat disc in a tine slot, a round rim over the tines, a bar on
// the wires of the base grid, and nested cones.
import { instantiate } from '@spotless/catalogue';
import { mmToM } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { kernelNestSpacing, profileNestSpacing } from './nest.ts';
import {
  fitOverTines,
  flatDropVerdict,
  leaningOrientation,
  maxLeanInSlot,
  slotFit,
} from './rack-geometry.ts';
import { STAND_IN_RACK, buildStandInRack } from './stand-in-rack.ts';

const D = STAND_IN_RACK;
const rack = buildStandInRack();
const DEG = Math.PI / 180;
const MM = 1e-3;

/** A flat disc of the given radius and thickness (metres) with a rounded edge, axis along z. */
function disc(radius: number, thickness: number): Shape {
  return {
    parts: [
      {
        id: 'body',
        prim: {
          kind: 'sor',
          profile: [
            { r: 0, z: thickness / 2, t: thickness },
            { r: radius - thickness / 2, z: thickness / 2, t: thickness },
          ],
        },
        pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
        material: 'porcelain_glazed',
      },
    ],
    regions: [],
  };
}

/** A cup with a flat base of radius `r0`, a wall leaning `alpha` from the axis and height `h`. */
function cone(r0: number, alpha: number, h: number, t: number): Shape {
  return {
    parts: [
      {
        id: 'body',
        prim: {
          kind: 'sor',
          profile: [
            { r: 0, z: t / 2, t },
            { r: r0, z: t / 2, t },
            { r: r0 + (h - t / 2) * Math.tan(alpha), z: h, t },
          ],
        },
        pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
        material: 'polypropylene',
      },
    ],
    regions: [],
  };
}

describe('a plate in a tine slot', () => {
  const slot = rack.slots[3];
  if (slot === undefined) throw new Error('no slot');

  it('stands a flat disc upright where two wires and two rows of tines leave it room (closed form)', () => {
    const [radius, thickness] = [0.1, 0.004];
    const fit = slotFit(rack, slot, disc(radius, thickness), 0);
    // It rests on the two grid wires either side of its centre: two circles touching, the disc's
    // edge of radius R and a wire of radius r whose axis is r below the top of the grid and half
    // a pitch to the side. Height of the disc's axis: sqrt((R + r)^2 - (p / 2)^2) - r.
    const r = mmToM(D.gridWireMm / 2);
    const half = mmToM(D.gridAlongY.pitchMm / 2);
    const z = Math.sqrt((radius + r) ** 2 - half ** 2) - r;
    // The wires are sampled every 0.5 mm along their axes: good to 0.02 mm.
    expect(Math.abs(fit.z - z)).toBeLessThan(0.02 * MM);
    expect(z).toBeLessThan(radius);
    // Its faces are planes: the front one stops at the back of the front tines, the back one at
    // the front of the rear tines. The item origin is on the back face.
    const rTine = mmToM(D.tineWireMm / 2);
    expect(fit.yMin).toBeCloseTo(slot.frontY + rTine + thickness, 6);
    expect(fit.yMax).toBeCloseTo(slot.backY - rTine, 6);
    expect(fit.play).toBeCloseTo(slot.clearWidth - thickness, 6);
  });

  it('gives a disc thicker than the slot no room', () => {
    const thick = slotFit(rack, slot, disc(0.1, slot.clearWidth + 0.002), 0);
    expect(thick.play).toBeCloseTo(-0.002, 6);
    expect(maxLeanInSlot(rack, slot, disc(0.1, slot.clearWidth + 0.002))).toBeNull();
  });

  it('finds the lean at which a disc is caught between the tines before and behind it', () => {
    const shape = disc(0.1, 0.004);
    const lean = maxLeanInSlot(rack, slot, shape);
    if (lean === null) throw new Error('the disc fits upright');
    // At that lean the play is gone, to the resolution of the search (0.01 degree of a disc
    // whose contacts are some 50 mm apart in height is 0.01 mm); a degree less leaves room, a
    // degree more needs more than there is.
    expect(Math.abs(slotFit(rack, slot, shape, lean).play)).toBeLessThan(0.02 * MM);
    expect(slotFit(rack, slot, shape, lean - DEG).play).toBeGreaterThan(0.3 * MM);
    expect(slotFit(rack, slot, shape, lean + DEG).play).toBeLessThan(-0.3 * MM);
    // The disc leans against the tips of the rear tines with its back, and its foot is held by
    // the front tines no higher than its edge at the rails: the two contacts are less than a
    // tine height apart, so the lean exceeds atan(play / tine height) of the upright disc...
    const upright = slotFit(rack, slot, shape, 0).play;
    expect(lean).toBeGreaterThan(Math.atan(upright / slot.tineHeight));
    // ...and a slab of thickness t leaning by a needs at least t / cos(a) of the slot.
    expect(0.004 / Math.cos(lean)).toBeLessThan(slot.clearWidth);
    // A thicker disc of the same size is caught earlier.
    const thicker = maxLeanInSlot(rack, slot, disc(0.1, 0.012));
    if (thicker === null) throw new Error('the thicker disc fits upright');
    expect(thicker).toBeLessThan(lean - 3 * DEG);
  });

  it('orients a leaning plate with its food side to the front and up', () => {
    // Item +z (the food side) at 20 degrees of lean: towards -y, and up by sin(20 degrees).
    const [x, y, z, w] = leaningOrientation(20 * DEG);
    const axis = [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
    expect(axis[0]).toBeCloseTo(0, 12);
    expect(axis[1]).toBeCloseTo(-Math.cos(20 * DEG), 12);
    expect(axis[2]).toBeCloseTo(Math.sin(20 * DEG), 12);
    // Zero lean is the catalogue's on_edge pose, 20 degrees its leaning pose.
    const plate = instantiate('dinner_plate_porcelain_iec');
    const pose = (name: string): readonly number[] =>
      plate.stablePoses.find((p) => p.name === name)?.q ?? [];
    leaningOrientation(0).forEach((c, i) =>
      expect(c).toBeCloseTo(pose('on_edge')[i] as number, 12),
    );
    leaningOrientation(20 * DEG).forEach((c, i) =>
      expect(c).toBeCloseTo(pose('leaning')[i] as number, 12),
    );
  });
});

describe('a round rim over the tines', () => {
  const slot = rack.slots[5];
  if (slot === undefined) throw new Error('no slot');
  const pitch = mmToM(D.tines.pitchMm);
  const rTine = mmToM(D.tineWireMm / 2);
  const mid = (slot.frontY + slot.backY) / 2;

  it('goes over the tines it can take inside and is blocked by a tine under its wall', () => {
    // A rim whose inside just takes the two tines of the slot and whose outside just clears the
    // next two.
    const inner = pitch / 2 + rTine + 0.0005;
    const outer = 1.5 * pitch - rTine - 0.0005;
    const over = fitOverTines(rack, slot.railX[1], mid, inner, outer);
    expect(over).toEqual({ fits: true, inside: 2, blocking: [] });
    // A millimetre narrower inside, the two tines of the slot are under the wall.
    const tight = fitOverTines(rack, slot.railX[1], mid, inner - 0.001, outer);
    expect(tight.fits).toBe(false);
    expect(tight.blocking.map((b) => b.tine)).toEqual([slot.index, slot.index + 1]);
    for (const b of tight.blocking) expect(b.distance).toBeCloseTo(pitch / 2, 12);
    // Centred on a tine instead, that tine is inside and its two neighbours are under the wall.
    const onTine = fitOverTines(rack, slot.railX[1], slot.frontY, inner, outer);
    expect(onTine.fits).toBe(false);
    expect(onTine.inside).toBe(1);
    expect(onTine.blocking.map((b) => b.tine)).toEqual([slot.index - 1, slot.index + 1]);
    // A rim narrower than the gap between two tines goes down between them and takes none in.
    const small = fitOverTines(rack, slot.railX[1], mid, 0.008, pitch / 2 - rTine - 0.0005);
    expect(small).toEqual({ fits: true, inside: 0, blocking: [] });
    // One wide enough to reach the other rail is blocked there too.
    const spacing = slot.railX[1] - slot.railX[0];
    const wide = fitOverTines(rack, slot.railX[1], mid, spacing - 0.001, spacing + 0.004);
    expect(wide.fits).toBe(false);
    expect(
      wide.blocking.some((b) => Math.abs(b.distance - Math.hypot(spacing, pitch / 2)) < 1e-9),
    ).toBe(true);
  });
});

describe('a bar laid flat on the base grid', () => {
  const pitchX = mmToM(D.gridAlongY.pitchMm);
  const pitchY = mmToM(D.gridAlongX.pitchMm);
  const wireX = rack.wiresAlongY[10] as number; // a front-to-back wire, away from the tines
  const wireY = rack.wiresAlongX[2] as number; // a left-to-right wire
  const spoon = { length: 0.13, width: 0.0298, comAlong: 0.06876 };

  it('rests across the front-to-back wires when two of them straddle its centre of mass', () => {
    // Starting 12.5 mm before a wire, a 130 mm bar reaches 12.5 mm past the fourth one on (35 mm
    // apart: 12.5 + 105 + 12.5). The outermost wires under it are 12.5 mm from its ends.
    const verdict = flatDropVerdict(rack, spoon, { along: 'x', start: [wireX - 0.0125, 0.3] });
    expect(verdict.outcome).toBe('rests');
    if (verdict.outcome !== 'rests') return;
    expect(verdict.on).toBe('upper');
    expect(verdict.margin).toBeCloseTo(0.13 - 3 * pitchX - 0.0125, 12);
    expect(verdict.sideSlack).toBeUndefined();
  });

  it('falls through when it is shorter than the opening, or has wires on one side only', () => {
    // 30 mm long, starting 2.5 mm after a wire: it ends 2.5 mm before the next. No wire under it.
    const short = flatDropVerdict(
      rack,
      { length: pitchX - 0.005, width: 0.01, comAlong: 0.015 },
      { along: 'x', start: [wireX + 0.0025, 0.3] },
    );
    expect(short.outcome).toBe('falls_through');
    if (short.outcome === 'falls_through') expect(short.margin).toBeCloseTo(0.0025, 12);
    // 40 mm long with its centre of mass in the middle, starting 12.5 mm before a wire: that
    // wire is under it, 7.5 mm before its centre of mass, and the next is 7.5 mm past its end.
    const tips = flatDropVerdict(
      rack,
      { length: 0.04, width: 0.01, comAlong: 0.02 },
      { along: 'x', start: [wireX - 0.0125, 0.3] },
    );
    expect(tips.outcome).toBe('falls_through');
    if (tips.outcome === 'falls_through') expect(tips.margin).toBeCloseTo(0.0075, 12);
  });

  it('lying along the wires in a gap, rests on the lower layer or tips over one wire of it', () => {
    const gapCentre = wireX + pitchX / 2;
    // Starting 15 mm before a left-to-right wire, a 130 mm bar reaches 15 mm past the next one
    // (100 mm apart). Both are under it, either side of its centre of mass.
    const rests = flatDropVerdict(rack, spoon, { along: 'y', start: [gapCentre, wireY - 0.015] });
    expect(rests.outcome).toBe('rests');
    if (rests.outcome === 'rests') {
      expect(rests.on).toBe('lower');
      expect(rests.margin).toBeCloseTo(0.13 - pitchY - 0.015, 12);
      // 29.8 mm of bowl in a clear gap of pitch less wire diameter: half the difference a side.
      expect(rests.sideSlack).toBeCloseTo((rack.opening.alongX - 0.0298) / 2, 12);
    }
    // Starting 35 mm before the wire, it ends 5 mm short of the next one: one wire under it,
    // 33.76 mm before its centre of mass. The verdict would change if it were 5 mm further on.
    const tips = flatDropVerdict(rack, spoon, { along: 'y', start: [gapCentre, wireY - 0.035] });
    expect(tips.outcome).toBe('falls_through');
    if (tips.outcome === 'falls_through') {
      expect(tips.margin).toBeCloseTo(pitchY - (0.13 - 0.035), 12);
      expect(tips.sideSlack).toBeCloseTo((rack.opening.alongX - 0.0298) / 2, 12);
    }
  });

  it('does not pretend to know what a bar on a wire, or wider than the gap, will do', () => {
    expect(flatDropVerdict(rack, spoon, { along: 'y', start: [wireX, 0.3] }).outcome).toBe(
      'undetermined',
    );
    const wide = { ...spoon, width: rack.opening.alongX + 0.001 };
    expect(
      flatDropVerdict(rack, wide, { along: 'y', start: [wireX + pitchX / 2, 0.3] }).outcome,
    ).toBe('undetermined');
    expect(flatDropVerdict(rack, spoon, { along: 'y', start: [0.001, 0.3] }).outcome).toBe(
      'undetermined',
    );
  });
});

describe('nest spacing of identical shells', () => {
  it('is the wall thickness over the sine of the wall angle for a cone (closed form)', () => {
    // Two parallel walls leaning 30 degrees from the axis, one raised by L, are L sin(30) apart:
    // they touch when that is the wall thickness, so L = t / sin(30) = 4 mm for a 2 mm wall.
    const cup = cone(0.03, 30 * DEG, 0.08, 0.002);
    expect(profileNestSpacing(cup)).toBeCloseTo(0.004, 8);
    // The kernel's signed distance says the same, to its sampling of the rounded edges.
    expect(Math.abs(kernelNestSpacing(cup) - 0.004)).toBeLessThan(0.01 * MM);
    // Steeper walls nest further apart: 10 degrees gives 2 mm / sin(10) = 11.52 mm.
    expect(profileNestSpacing(cone(0.03, 10 * DEG, 0.08, 0.002))).toBeCloseTo(
      0.002 / Math.sin(10 * DEG),
      8,
    );
  });

  it('is the whole height for a straight-sided cup, which does not nest', () => {
    // The base of the upper one lands on the rim of the lower one: rim top at h + t / 2.
    const cup = cone(0.03, 0, 0.08, 0.002);
    expect(profileNestSpacing(cup)).toBeCloseTo(0.081, 8);
    expect(Math.abs(kernelNestSpacing(cup) - 0.081)).toBeLessThan(0.01 * MM);
  });

  it('agrees between profile and kernel for the catalogue bowls, foot rings included', () => {
    for (const id of [
      'cereal_bowl_porcelain_160',
      'cereal_bowl_vitrelle_159',
      'cereal_bowl_stoneware_130',
      'melamine_bowl_150',
    ]) {
      const shape = instantiate(id).shape;
      const fromProfile = profileNestSpacing(shape);
      expect(Math.abs(kernelNestSpacing(shape) - fromProfile), id).toBeLessThan(0.01 * MM);
      // A bowl nests: well under its own height, and by more than its wall thickness.
      const body = shape.parts[0];
      if (body === undefined || body.prim.kind !== 'sor') throw new Error('not a shell');
      const rim = body.prim.profile[body.prim.profile.length - 1];
      if (rim === undefined) throw new Error('no profile');
      expect(fromProfile, id).toBeLessThan(0.75 * (rim.z + rim.t / 2));
      expect(fromProfile, id).toBeGreaterThan(rim.t);
    }
  });
});
