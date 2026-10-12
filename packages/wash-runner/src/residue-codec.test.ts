import { describe, expect, it } from 'vitest';
import type { ResidueCells } from './residue-codec.ts';
import { decodeResidueMap, encodeResidueMap, POSITION_QUANTUM_MM } from './residue-codec.ts';

function cellsOf(count: number, reach: number): ResidueCells {
  const centre = new Float32Array(3 * count);
  const normal = new Float32Array(3 * count);
  const areaMm2 = new Float32Array(count);
  const fraction = new Float32Array(2 * count);
  const visible = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    centre.set([reach * (2 * t - 1), -0.5 * reach * t, 0.123456 * t], 3 * i);
    const angle = 2.4 * i;
    normal.set([Math.cos(angle) * 0.6, Math.sin(angle) * 0.6, 0.8], 3 * i);
    areaMm2[i] = 1 + 3.33 * t;
    fraction[2 * i] = t;
    fraction[2 * i + 1] = i % 2 === 0 ? 0 : 0.0005;
    visible[i] = i % 3 === 0 ? 1 : 0;
  }
  return {
    count,
    centre,
    normal,
    areaMm2,
    soils: ['egg_yolk_dried', 'tea_tannin'],
    fraction,
    visible,
  };
}

describe('residue map packing', () => {
  it('round-trips within its rounding: 0.01 mm, 1/127, 0.005 mm2, 1/510', () => {
    const cells = cellsOf(257, 0.31);
    const map = encodeResidueMap('plate_01', cells);
    expect(map).toMatchObject({
      item_id: 'plate_01',
      cells: 257,
      soils: ['egg_yolk_dried', 'tea_tannin'],
      position_quantum_mm: POSITION_QUANTUM_MM,
    });
    const back = decodeResidueMap(map);
    expect(back.count).toBe(257);
    expect(back.soils).toEqual(cells.soils);
    for (let i = 0; i < 3 * 257; i++) {
      expect(Math.abs((back.centre[i] as number) - (cells.centre[i] as number))).toBeLessThan(
        1.01e-5,
      );
      expect(Math.abs((back.normal[i] as number) - (cells.normal[i] as number))).toBeLessThan(
        0.004,
      );
    }
    for (let i = 0; i < 257; i++) {
      expect(Math.abs((back.areaMm2[i] as number) - (cells.areaMm2[i] as number))).toBeLessThan(
        0.0051,
      );
      expect(back.visible[i]).toBe(cells.visible[i]);
    }
    for (let i = 0; i < 2 * 257; i++) {
      const given = cells.fraction[i] as number;
      const got = back.fraction[i] as number;
      // A trace is never rounded away, and nothing is made of nothing.
      if (given > 0) expect(got).toBeGreaterThan(0);
      else expect(got).toBe(0);
      expect(Math.abs(got - given)).toBeLessThan(1 / 255);
    }
    // JSON, as it travels.
    expect(decodeResidueMap(JSON.parse(JSON.stringify(map)) as typeof map)).toEqual(back);
  });

  it('is compact: 13 bytes a cell and soil before base64', () => {
    const map = encodeResidueMap('plate_01', cellsOf(3000, 0.13));
    const bytes = JSON.stringify(map).length;
    expect(bytes).toBeLessThan(3000 * 14 * (4 / 3) + 400);
  });

  it('widens its step for an item too large for 16 bits at 0.02 mm', () => {
    const map = encodeResidueMap('tray_01', cellsOf(50, 0.9));
    expect(map.position_quantum_mm).toBeGreaterThan(POSITION_QUANTUM_MM);
    expect(map.position_quantum_mm).toBeLessThan(0.03);
    const back = decodeResidueMap(map);
    expect(back.centre[0]).toBeCloseTo(-0.9, 4);
    expect(back.centre[3 * 49]).toBeCloseTo(0.9, 4);
  });

  it('packs an item with nothing left on it as nothing', () => {
    const map = encodeResidueMap('glass_01', cellsOf(0, 0.1));
    expect(map).toMatchObject({ cells: 0, positions: '', normals: '', fractions: '' });
    expect(decodeResidueMap(map).count).toBe(0);
  });

  it('refuses arrays that do not fit their counts', () => {
    const cells = cellsOf(4, 0.1);
    expect(() => encodeResidueMap('x', { ...cells, count: 5 })).toThrow(RangeError);
    const map = encodeResidueMap('x', cells);
    expect(() => decodeResidueMap({ ...map, cells: 5 })).toThrow(RangeError);
    expect(() => decodeResidueMap({ ...map, soils: ['one'] })).toThrow(RangeError);
  });
});
