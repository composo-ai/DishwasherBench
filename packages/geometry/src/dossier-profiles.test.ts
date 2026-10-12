// Every starting profile of docs/research/items.md section 10.2 through the whole kernel.
//
// The table is transcribed as written: mid-surface polylines in mm (r, z, t), the dossier's model
// mass and model centre-of-mass height, all [ESTIMATED] there (fitted to the outer dimensions and
// masses of section 10.1 with the thin-shell estimator of section 2.3). Densities are the "use"
// values of section 3.1. `extrasG` is the lumped add-on mass the dossier lists for the row
// (handle, cap, stem and foot, foot ring where its size is given), which this test subtracts to
// compare shell with shell; `null` marks rows whose add-ons the dossier does not size.

import { describe, expect, it } from 'vitest';
import { expandGeometryMm } from './authoring.ts';
import { buildCollisionPieces, collisionSolids, sorCollisionLayout } from './collision.ts';
import { computeMassProperties } from './mass.ts';
import { meshTopology, meshVolume } from './mesh-metrics.ts';
import { buildRenderMesh } from './mesh.ts';
import { preparePrimitive } from './prepared.ts';
import { signedDistance } from './sdf.ts';
import { profileMm, singlePart } from './test-util.ts';
import { COLLISION_CHORD_ERROR, type SorPrimitive } from './types.ts';

interface Row {
  /** Item and its number in section 10.1. */
  readonly name: string;
  readonly profileMm: readonly (readonly [number, number, number])[];
  /** kg/m^3, items.md section 3.1. */
  readonly density: number;
  /** Dossier model mass, g [ESTIMATED]. */
  readonly modelG: number;
  /** Lumped add-ons included in the model mass, g; null when the dossier does not size them. */
  readonly extrasG: number | null;
  /** Dossier model centre-of-mass height, mm [ESTIMATED]. */
  readonly zcMm: number;
  /** True when the profile is only the bowl of a stemmed glass and `zcMm` is that of the whole. */
  readonly stemware?: boolean;
}

const PORCELAIN = 2400;
const GLASS = 2500;
const PP = 905;
const TRITAN = 1180;
/** Volume of a rectangular annulus, as the dossier counts a foot ring "r, width x height" (mm). */
const ring = (r: number, w: number, h: number, density: number): number =>
  (2 * Math.PI * r * w * h * density) / 1e6;
/** A solid cylinder (stem, foot disc), g, for sizes in mm. */
const cylinder = (d: number, h: number, density: number): number =>
  (Math.PI * (d / 2) ** 2 * h * density) / 1e6;

const ROWS: readonly Row[] = [
  {
    name: 'Dinner plate IEC-type (1)',
    profileMm: [
      [0, 3, 4.2],
      [85, 3, 4.2],
      [98, 9, 4.2],
      [130, 24, 4.2],
    ],
    density: PORCELAIN,
    modelG: 591,
    extrasG: ring(80, 5, 4, PORCELAIN),
    zcMm: 10,
  },
  {
    name: 'IKEA 365+ plate (2)',
    profileMm: [
      [0, 4, 5.2],
      [88, 4, 5.2],
      [100, 10, 5.2],
      [135, 27, 5.2],
    ],
    density: PORCELAIN,
    modelG: 792,
    extrasG: ring(85, 6, 4, PORCELAIN),
    zcMm: 11,
  },
  {
    name: 'Corelle plate (3)',
    profileMm: [
      [0, 1.3, 2.6],
      [85, 1.3, 2.6],
      [100, 6, 2.6],
      [130, 18, 2.6],
    ],
    density: GLASS,
    modelG: 359,
    extrasG: 0,
    zcMm: 6,
  },
  {
    name: 'Dessert plate (5)',
    profileMm: [
      [0, 3, 4.0],
      [60, 3, 4.0],
      [70, 7, 4.0],
      [95, 18, 4.0],
    ],
    density: PORCELAIN,
    modelG: 303,
    extrasG: null,
    zcMm: 8,
  },
  {
    name: 'Soup plate (7)',
    profileMm: [
      [0, 3, 4.2],
      [60, 3, 4.2],
      [82, 26, 4.2],
      [115, 38, 4.2],
    ],
    density: PORCELAIN,
    modelG: 494,
    extrasG: null,
    zcMm: 20,
  },
  {
    name: 'Deep plate 22 cm (8)',
    profileMm: [
      [0, 3, 5],
      [55, 3, 5],
      [90, 25, 5],
      [110, 58, 5],
    ],
    density: PORCELAIN,
    modelG: 646,
    extrasG: null,
    zcMm: 25,
  },
  {
    name: 'Pasta bowl (9)',
    profileMm: [
      [0, 3, 4.5],
      [55, 3, 4.5],
      [85, 25, 4.5],
      [115, 63, 4.5],
    ],
    density: PORCELAIN,
    modelG: 623,
    extrasG: null,
    zcMm: 29,
  },
  {
    name: 'Cereal bowl 16 cm (10)',
    profileMm: [
      [0, 3, 5],
      [40, 3, 5],
      [62, 20, 5],
      [76, 45, 5],
      [80, 68, 5],
    ],
    density: PORCELAIN,
    modelG: 466,
    extrasG: null,
    zcMm: 31,
  },
  {
    name: 'Ramekin (14)',
    profileMm: [
      [0, 2.5, 5],
      [40, 2.5, 5],
      [42, 6, 4.5],
      [44.5, 44, 4.5],
    ],
    density: PORCELAIN,
    modelG: 184,
    extrasG: 0,
    zcMm: 16,
  },
  {
    name: 'Saucer (15)',
    profileMm: [
      [0, 3, 3.8],
      [30, 3, 3.8],
      [40, 7, 3.8],
      [70, 17, 3.8],
    ],
    density: PORCELAIN,
    modelG: 155,
    extrasG: 0,
    zcMm: 10,
  },
  {
    name: 'Tea cup (16)',
    profileMm: [
      [0, 3, 4],
      [24, 3, 4],
      [30, 10, 3.2],
      [40, 45, 3.2],
      [42.5, 65, 3.0],
    ],
    density: PORCELAIN,
    modelG: 156,
    extrasG: 25,
    zcMm: 31,
  },
  {
    name: 'Mug (18)',
    profileMm: [
      [0, 2.5, 5],
      [36, 2.5, 5],
      [38, 6, 4.2],
      [40, 100, 4.2],
    ],
    density: PORCELAIN,
    modelG: 336,
    extrasG: 45,
    zcMm: 43,
  },
  {
    name: 'Espresso cup (20)',
    profileMm: [
      [0, 3, 6],
      [20, 3, 6],
      [24, 10, 5],
      [31, 58, 5],
    ],
    density: PORCELAIN,
    modelG: 148,
    extrasG: 15,
    zcMm: 28,
  },
  {
    name: 'Melamine plate (25)',
    profileMm: [
      [0, 2, 3],
      [80, 2, 3],
      [90, 8, 3],
      [115, 18, 3],
    ],
    density: 1500,
    modelG: 197,
    extrasG: 0,
    zcMm: 7,
  },
  {
    name: 'Melamine bowl (26)',
    profileMm: [
      [0, 2, 3],
      [35, 2, 3],
      [60, 25, 3],
      [75, 60, 3],
    ],
    density: 1500,
    modelG: 136,
    extrasG: 0,
    zcMm: 28,
  },
  {
    name: 'Picardie 250 (27)',
    profileMm: [
      [0, 3.5, 7],
      [27, 3.5, 7],
      [29, 8, 4],
      [40, 60, 3],
      [43.5, 90, 3],
    ],
    density: GLASS,
    modelG: 211,
    extrasG: 0,
    zcMm: 38,
  },
  {
    name: 'Libbey 551HT (30)',
    profileMm: [
      [0, 4.5, 9],
      [28, 4.5, 9],
      [30, 10, 3.2],
      [36.5, 110, 2.8],
      [35, 133, 2.8],
    ],
    density: GLASS,
    modelG: 265,
    extrasG: 0,
    zcMm: 54,
  },
  {
    name: 'Highball (31)',
    profileMm: [
      [0, 5, 10],
      [29, 5, 10],
      [30.5, 12, 3],
      [32.5, 150, 2.4],
    ],
    density: GLASS,
    modelG: 272,
    extrasG: 0,
    zcMm: 56,
  },
  {
    name: 'Pint glass (32)',
    profileMm: [
      [0, 6.5, 13],
      [28, 6.5, 13],
      [30, 14, 4.5],
      [44.5, 149, 3.4],
    ],
    density: GLASS,
    modelG: 422,
    extrasG: 0,
    zcMm: 63,
  },
  {
    name: 'Wine glass 540 ml (33), bowl',
    profileMm: [
      [4, 120, 3],
      [30, 128, 1.6],
      [46, 165, 1.1],
      [44, 200, 1.0],
      [33, 244, 0.9],
    ],
    density: 2550,
    modelG: 161,
    extrasG: cylinder(8, 105, 2550) + cylinder(85, 3.2, 2550),
    zcMm: 114,
    stemware: true,
  },
  {
    name: 'Flute (36), bowl',
    profileMm: [
      [3.5, 95, 3],
      [18, 105, 1.5],
      [27, 150, 1.0],
      [24, 224, 0.9],
    ],
    density: 2550,
    modelG: 93,
    extrasG: cylinder(7, 85, 2550) + cylinder(70, 3, 2550),
    zcMm: 97,
    stemware: true,
  },
  {
    name: 'Glass jug (37)',
    profileMm: [
      [0, 3, 6],
      [48, 3, 6],
      [52, 10, 3.5],
      [55, 150, 3.5],
      [50, 190, 3.5],
    ],
    density: GLASS,
    modelG: 787,
    extrasG: 120,
    zcMm: 80,
  },
  {
    name: 'Measuring jug (39)',
    profileMm: [
      [0, 3, 7],
      [40, 3, 7],
      [46, 12, 5],
      [53.5, 100, 5],
    ],
    density: GLASS,
    modelG: 587,
    extrasG: 110,
    zcMm: 43,
  },
  {
    name: 'Mixing bowl glass (65)',
    profileMm: [
      [0, 3, 6.5],
      [55, 3, 6.5],
      [110, 40, 5.5],
      [145, 85, 5.5],
      [153, 114, 5.5],
    ],
    density: GLASS,
    modelG: 1680,
    extrasG: 0,
    zcMm: 54,
  },
  {
    name: 'Mixing bowl steel (66)',
    profileMm: [
      [0, 0.3, 0.7],
      [50, 0.3, 0.7],
      [97, 35, 0.7],
      [125, 75, 0.7],
      [132, 108, 0.7],
    ],
    density: 7900,
    modelG: 532,
    extrasG: null,
    zcMm: 51,
  },
  {
    name: 'Mixing bowl PP (67)',
    profileMm: [
      [0, 1.5, 2.5],
      [60, 1.5, 2.5],
      [105, 45, 2.5],
      [125, 95, 2.5],
      [130, 125, 2.5],
    ],
    density: PP,
    modelG: 242,
    extrasG: 0,
    zcMm: 59,
  },
  {
    name: 'Saucepan 18 cm disc base',
    profileMm: [
      [0, 0.5, 0.8],
      [85, 0.5, 0.8],
      [90, 5, 0.8],
      [90, 95, 0.8],
    ],
    density: 7900,
    modelG: 1001,
    extrasG: null,
    zcMm: 33,
  },
  {
    name: 'Frying pan clad 10 in (70)',
    profileMm: [
      [0, 1.3, 2.6],
      [95, 1.3, 2.6],
      [112, 15, 2.6],
      [127, 51, 2.6],
    ],
    density: 5600,
    modelG: 1296,
    extrasG: 250,
    zcMm: 16,
  },
  {
    name: 'Non-stick pan 28 cm (71)',
    profileMm: [
      [0, 1.6, 3.6],
      [105, 1.6, 3.6],
      [125, 20, 3.0],
      [140, 48, 3.0],
    ],
    density: 2700,
    modelG: 945,
    extrasG: 220,
    zcMm: 14,
  },
  {
    name: 'Lodge 10.25 in (73)',
    profileMm: [
      [0, 2, 4],
      [108, 2, 4],
      [113, 6, 4.2],
      [130, 51, 4],
    ],
    density: 7200,
    modelG: 2600,
    extrasG: 330,
    zcMm: 15,
  },
  {
    name: 'Lodge 12 in (74)',
    profileMm: [
      [0, 2, 4.2],
      [128, 2, 4.2],
      [133, 6, 4.4],
      [153, 57, 4.2],
    ],
    density: 7200,
    modelG: 3742,
    extrasG: 500,
    zcMm: 16,
  },
  {
    name: 'Stockpot (75)',
    profileMm: [
      [0, 0.5, 0.8],
      [115, 0.5, 0.8],
      [120, 5, 0.8],
      [120, 190, 0.8],
    ],
    density: 7900,
    modelG: 1964,
    extrasG: null,
    zcMm: 73,
  },
  {
    name: 'Glass lid (76)',
    profileMm: [
      [0, 22, 4],
      [60, 18, 4],
      [110, 6, 4],
      [118, 2, 4],
    ],
    density: GLASS,
    modelG: 602,
    extrasG: 150,
    zcMm: 12,
  },
  {
    name: 'Colander (60)',
    profileMm: [
      [0, 0, 0.5],
      [70, 0, 0.5],
      [120, 45, 0.5],
      [143, 110, 0.5],
    ],
    density: 7900,
    modelG: 543,
    extrasG: null,
    zcMm: 49,
  },
  {
    name: 'Nalgene (90)',
    profileMm: [
      [0, 1, 2.4],
      [40, 1, 2.4],
      [44.5, 6, 2.2],
      [44.5, 170, 2.2],
      [31.5, 190, 2.4],
      [31.5, 215, 2.6],
    ],
    density: TRITAN,
    modelG: 193,
    extrasG: 25,
    zcMm: 97,
  },
  {
    name: 'Baby bottle (93)',
    profileMm: [
      [0, 1, 1.8],
      [28, 1, 1.8],
      [33, 8, 1.5],
      [33, 115, 1.5],
      [25, 125, 1.8],
      [25, 140, 2.0],
    ],
    density: PP,
    modelG: 44,
    extrasG: 0,
    zcMm: 64,
  },
  {
    name: 'PP cup (96)',
    profileMm: [
      [0, 1, 1.8],
      [28, 1, 1.8],
      [30, 5, 1.5],
      [42.5, 120, 1.5],
    ],
    density: PP,
    modelG: 41,
    extrasG: 0,
    zcMm: 58,
  },
  {
    name: 'Sippy cup (95)',
    profileMm: [
      [0, 1, 1.8],
      [30, 1, 1.8],
      [32, 5, 1.6],
      [35, 90, 1.6],
    ],
    density: PP,
    modelG: 62,
    extrasG: 30,
    zcMm: 39,
  },
  {
    name: 'Blender jug (97)',
    profileMm: [
      [0, 3, 5],
      [50, 3, 5],
      [57, 20, 3.5],
      [75, 250, 3.5],
    ],
    density: TRITAN,
    modelG: 942,
    extrasG: 470,
    zcMm: 118,
  },
];

describe('starting profiles of the items dossier (section 10.2)', () => {
  it('transcribes all 39 rows', () => {
    expect(ROWS).toHaveLength(39);
    expect(new Set(ROWS.map((row) => row.name)).size).toBe(39);
  });

  for (const row of ROWS) {
    const prim: SorPrimitive = { kind: 'sor', profile: profileMm(row.profileMm) };
    const shape = singlePart(prim);

    it(`${row.name}: one closed cross-section, closed mesh, pieces as laid out`, () => {
      const prep = preparePrimitive(prim);
      if (prep.kind !== 'sor') throw new Error('not a sor');
      expect(prep.section().loops).toHaveLength(1);
      const mesh = buildRenderMesh(shape, { chordError: COLLISION_CHORD_ERROR });
      expect(meshTopology(mesh).closed).toBe(true);
      expect(meshVolume(mesh)).toBeGreaterThan(0);
      const pieces = collisionSolids(
        buildCollisionPieces(shape, { chordError: COLLISION_CHORD_ERROR }),
      );
      const layout = sorCollisionLayout(prim, { chordError: COLLISION_CHORD_ERROR });
      expect(pieces).toHaveLength(layout.pieces);
      // The mid-surface is inside the wall everywhere: half a thickness deep at each vertex.
      for (const p of prim.profile) {
        expect(signedDistance(shape, [p.r, 0, p.z])).toBeCloseTo(-p.t / 2, 12);
      }
    });

    it(`${row.name}: shell mass and balance height agree with the dossier model`, () => {
      const m = computeMassProperties(shape, () => row.density);
      const grams = m.mass * 1000;
      if (row.extrasG !== null) {
        // Exact solid against thin-shell estimate: the rounded rim adds 1 to 3 %, the bends and
        // tapers a little either way. Within 5 %.
        expect(
          Math.abs(grams / (row.modelG - row.extrasG) - 1),
          `${grams.toFixed(1)} g`,
        ).toBeLessThanOrEqual(0.05);
      } else {
        // The model mass includes add-ons the dossier does not size (foot ring, disc base,
        // rolled rim, handles): the shell alone weighs no more than the model plus 3 %, and
        // at least a quarter of it (the disc-based pots are mostly base).
        expect(grams).toBeLessThanOrEqual(row.modelG * 1.03);
        expect(grams).toBeGreaterThanOrEqual(row.modelG * 0.25);
      }
      expect(m.com[0]).toBe(0);
      expect(m.com[1]).toBe(0);
      // Balance height: the dossier's z_c is that of the profile's shell. Add-ons shift it, so
      // rows with heavy or unsized add-ons get a looser check; stemware is checked whole below.
      if (row.stemware === true) return;
      const light = row.extrasG !== null && row.extrasG <= 0.1 * row.modelG;
      expect(Math.abs(m.com[2] * 1000 - row.zcMm)).toBeLessThanOrEqual(light ? 2 : 12);
    });
  }

  it('stemware as a whole: bowl, stem and foot weigh and balance as the dossier models them', () => {
    // Wine glass (33): stem D 8 x 105, foot D 85 x 3.2, model 161 g, z_c 114 mm (47 % of height).
    // Flute (36): stem D 7 x 85, foot D 70 x 3, model 93 g, z_c 97 mm.
    const cases = [
      {
        row: 'Wine glass 540 ml (33), bowl',
        stemRadiusMm: 4,
        footRadiusMm: 42.5,
        footThicknessMm: 3.2,
      },
      { row: 'Flute (36), bowl', stemRadiusMm: 3.5, footRadiusMm: 35, footThicknessMm: 3 },
    ];
    for (const c of cases) {
      const row = ROWS.find((r) => r.name === c.row);
      if (row === undefined) throw new Error(`no row '${c.row}'`);
      const shape = expandGeometryMm({
        class: 'sor',
        material: 'crystal',
        profileMm: row.profileMm,
        addons: [
          {
            type: 'stem_foot',
            stemRadiusMm: c.stemRadiusMm,
            footRadiusMm: c.footRadiusMm,
            footThicknessMm: c.footThicknessMm,
          },
        ],
      });
      const m = computeMassProperties(shape, () => row.density);
      expect(Math.abs((m.mass * 1000) / row.modelG - 1), c.row).toBeLessThanOrEqual(0.05);
      expect(Math.abs(m.com[2] * 1000 - row.zcMm), c.row).toBeLessThanOrEqual(3);
    }
  });
});
