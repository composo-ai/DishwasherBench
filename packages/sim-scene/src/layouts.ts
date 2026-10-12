/**
 * Binary records of module M3 (docs/design/sim-core.md sections 3.2, 3.5, 3.6 and 3.7), as data.
 *
 * Each layout follows the conventions of `layout.ts` of `@spotless/sim-gpu`: little-endian,
 * byte offsets from the start of a record, the value of a field is its stored number times
 * `scale` in `unit`. Every field of these tables is static geometry: written by the scene
 * builder (or by the tracer, for `HitRecord`) and never accumulated into.
 *
 * Where the contract lists the members of a packed word without bit positions they are placed
 * here in the order listed, from the least significant bit; where it names the values of an
 * enumeration without codes they are numbered here in the order listed, from 0. Those choices,
 * the missing bytes of `Primitive` and `Instance` and the scaled units of the `f16` fields of
 * `BlockStatic` are reported as contract issues.
 */

import type { RecordLayout, RecordOf } from '@spotless/sim-gpu';

// ---------------------------------------------------------------------------------------------
// Enumerations stored in the records
// ---------------------------------------------------------------------------------------------

/**
 * Which face of a wall a row or a result element lies on. The codes are those section 5.6 fixes
 * for `ItemWashResult.elements.side` (0 out, 1 in, 2 rim or edge) and are used for the `side`
 * bits of the row table too.
 */
export const SIDE_CODES = { out: 0, in: 1, rim: 2 } as const;

/** Type of a ray primitive (`Primitive.type`; section 3.5), numbered in the order listed. */
export const PRIMITIVE_TYPE_CODES = { frustum: 0, capsule: 1, polygon: 2 } as const;

/**
 * Feature tag of a primitive and of a hit (`Primitive.feature`, bits 0 to 1 of
 * `HitRecord.flags`; section 3.5), numbered in the order listed.
 */
export const FEATURE_TAG_CODES = { smooth: 0, rim: 1, wire: 2, edgeSeam: 3 } as const;

/** Kind of a top-level instance (`Instance.kind`; section 3.5), numbered in the order listed. */
export const INSTANCE_KIND_CODES = { item: 0, wires: 1, basket: 2, tub: 3, arm: 4 } as const;

/**
 * Feature of a block (`BlockStatic.feature`; section 3.7), numbered in the order listed. A dead
 * block is excluded from every solver and from area sums (section 3.1).
 */
export const BLOCK_FEATURE_CODES = {
  smooth: 0,
  edgeRow: 1,
  pit: 2,
  dripSite: 3,
  wire: 4,
  contact: 5,
  pole: 6,
  dead: 7,
} as const;

/**
 * Smallest and largest value of the log-coded radius or width of a feature, metres (code 1 and
 * code 255 of the `featureCode` bits of `HitRecord.flags`). The contract says "radius code" and
 * "width code" and fixes no coding; this is the log u8 of section 5.1 over 0.05 mm to 50 mm.
 */
export const FEATURE_SIZE_LOG_RANGE = { min: 5e-5, max: 5e-2 } as const;

/**
 * Smallest and largest value of the log-coded gap of a block, metres (`BlockStatic.gap`). The
 * contract stores the gap "log-coded" with a reach of 10 mm (`scene.gapReach`) and fixes no
 * range; code 0 is contact, code 255 is no surface within reach.
 */
export const GAP_LOG_RANGE = { min: 1e-5, max: 1e-2 } as const;

// ---------------------------------------------------------------------------------------------
// Ray structure (section 3.5)
// ---------------------------------------------------------------------------------------------

/**
 * `HitRecord`, 32 bytes per segment (section 3.5): the result of a ray or parcel query. The
 * hit normal is not stored: it is always the analytic normal at the patch coordinates.
 */
export const HIT_RECORD_LAYOUT = {
  name: 'HitRecord',
  section: '3.5',
  owner: 'M3',
  per: 'segment',
  byteSize: 32,
  fields: [
    {
      name: 't',
      type: 'f32',
      offset: 0,
      role: 'statistic',
      unit: 'm',
      doc: 'Distance of the hit along the segment.',
    },
    {
      name: 'instance',
      type: 'u32',
      offset: 4,
      role: 'statistic',
      unit: '-',
      doc: 'Index of the instance hit; 0xFFFFFFFF when the segment hits nothing (the contract does not say how a miss is recorded).',
    },
    {
      name: 'prim',
      type: 'u32',
      offset: 8,
      role: 'statistic',
      unit: '-',
      doc: 'Index of the primitive hit.',
    },
    {
      name: 'patch',
      type: 'u32',
      offset: 12,
      role: 'statistic',
      unit: '-',
      doc: 'Patch id of the hit.',
    },
    {
      name: 'a',
      type: 'f32',
      offset: 16,
      role: 'statistic',
      unit: 'm',
      doc: 'First patch coordinate: s on a REV patch (unscaled coordinates on a stretched shell), u on a CART patch, the axial parameter on a LINE.',
    },
    {
      name: 'b',
      type: 'f32',
      offset: 20,
      role: 'statistic',
      unit: 'rad or m',
      doc: 'Second patch coordinate: theta (rad) on a REV patch, v (m) on a CART patch.',
    },
    {
      name: 'cosInc',
      type: 'f32',
      offset: 24,
      role: 'statistic',
      unit: '1',
      doc: 'Cosine of the angle of incidence, between the ray and the inward normal, 0 to 1.',
    },
    {
      name: 'flags',
      type: 'u32',
      offset: 28,
      role: 'statistic',
      unit: '-',
      bits: [
        {
          name: 'feature',
          lsb: 0,
          width: 2,
          doc: 'FEATURE_TAG_CODES: smooth, rim, wire, edge seam.',
        },
        {
          name: 'featureCode',
          lsb: 2,
          width: 8,
          doc: 'log u8 over FEATURE_SIZE_LOG_RANGE: rim radius, wire width or edge-seam radius, m.',
        },
        {
          name: 'backFace',
          lsb: 10,
          width: 1,
          doc: 'Hit from inside a solid: a leak (section 3.5).',
        },
        {
          name: 'porousPass',
          lsb: 11,
          width: 1,
          doc: 'The ray passed a porous part before this hit.',
        },
      ],
      doc: 'Feature tag with its size code, back face, porous pass.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link HIT_RECORD_LAYOUT} record. */
export type HitRecord = RecordOf<typeof HIT_RECORD_LAYOUT>;

/**
 * `Primitive`, 48 bytes per ray primitive (section 3.5). The contract lists 44 bytes of fields
 * for its 48; the last word is spare here.
 *
 * The 8 parameters are: frustum r0, z0, r1, z1 (m, item frame), side (SIDE_CODES as a number),
 * theta_min, theta_max (rad), s0 (m, arc length at the band's start); capsule p0 and p1 (m,
 * item frame), radius, width (m); polygon its plane (unit normal and offset, item frame) and
 * its index into the vertex buffer, as a number. The contract names that vertex buffer and
 * lists none among the tables of `Scene.gpu`.
 */
export const PRIMITIVE_LAYOUT = {
  name: 'Primitive',
  section: '3.5',
  owner: 'M3',
  per: 'ray primitive',
  byteSize: 48,
  fields: [
    {
      name: 'type',
      type: 'u8',
      offset: 0,
      role: 'static',
      unit: '-',
      doc: 'PRIMITIVE_TYPE_CODES.',
    },
    {
      name: 'feature',
      type: 'u8',
      offset: 1,
      role: 'static',
      unit: '-',
      doc: 'FEATURE_TAG_CODES.',
    },
    { name: 'patch', type: 'u16', offset: 2, role: 'static', unit: '-', doc: 'Patch id.' },
    {
      name: 'params',
      type: 'f32',
      offset: 4,
      count: 8,
      role: 'static',
      unit: 'm or rad',
      doc: 'The 8 parameters of the primitive type (see the layout comment).',
    },
    {
      name: 'firstRow',
      type: 'u32',
      offset: 36,
      role: 'static',
      unit: '-',
      doc: 'Index in the patch-row table of the first row the primitive covers.',
    },
    {
      name: 'aux',
      type: 'u32',
      offset: 40,
      role: 'static',
      unit: '-',
      doc: 'Auxiliary index of the primitive type (not specified further by the contract).',
    },
    {
      name: 'spare',
      type: 'u32',
      offset: 44,
      role: 'static',
      unit: '-',
      pad: true,
      doc: 'Not listed by the contract: brings its 44 bytes of fields to the stated 48.',
    },
  ],
} as const satisfies RecordLayout;

/**
 * A decoded {@link PRIMITIVE_LAYOUT} record: a ray primitive (not the analytic `Primitive` of
 * `@spotless/geometry`, from which it is derived).
 */
export type Primitive = RecordOf<typeof PRIMITIVE_LAYOUT>;

/**
 * `BvhNode`, 32 bytes per tree node (section 3.5). Used for the top-level hierarchy over
 * instances (tub frame) and for the bottom-level trees (item frame); in an (r, z) tree of a
 * shell of revolution x is r, z is z and the y components are unused.
 */
export const BVH_NODE_LAYOUT = {
  name: 'BvhNode',
  section: '3.5',
  owner: 'M3',
  per: 'tree node',
  byteSize: 32,
  fields: [
    {
      name: 'min',
      type: 'f32',
      offset: 0,
      count: 3,
      role: 'static',
      unit: 'm',
      doc: 'Lower corner of the box.',
    },
    {
      name: 'leftOrFirst',
      type: 'u32',
      offset: 12,
      role: 'static',
      unit: '-',
      doc: 'Inner node: index of the left child (the right child follows it). Leaf: index of its first primitive or instance.',
    },
    {
      name: 'max',
      type: 'f32',
      offset: 16,
      count: 3,
      role: 'static',
      unit: 'm',
      doc: 'Upper corner of the box.',
    },
    {
      name: 'count',
      type: 'u32',
      offset: 28,
      role: 'static',
      unit: '-',
      doc: 'Number of primitives or instances of a leaf; 0 for an inner node.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link BVH_NODE_LAYOUT} record. */
export type BvhNode = RecordOf<typeof BVH_NODE_LAYOUT>;

/**
 * `Instance`, 80 bytes per top-level instance (section 3.5): an item, a wire group, the basket,
 * a tub part or an arm. The contract lists 76 bytes of fields for its 80; a second spare word
 * closes the record here.
 */
export const INSTANCE_LAYOUT = {
  name: 'Instance',
  section: '3.5',
  owner: 'M3',
  per: 'instance',
  byteSize: 80,
  fields: [
    {
      name: 'worldToLocal',
      type: 'f32',
      offset: 0,
      count: 12,
      role: 'static',
      unit: '1 and m',
      doc: 'The 3 x 4 transform from the tub frame to the instance frame, row-major: three rows of (rotation row, translation), so x_local = R x_world + t.',
    },
    {
      name: 'root',
      type: 'u32',
      offset: 48,
      role: 'static',
      unit: '-',
      doc: 'Index of the root node of the bottom-level tree.',
    },
    {
      name: 'primBase',
      type: 'u32',
      offset: 52,
      role: 'static',
      unit: '-',
      doc: 'Index of the first primitive of the instance.',
    },
    {
      name: 'blockBase',
      type: 'u32',
      offset: 56,
      role: 'static',
      unit: '-',
      doc: 'Index of the first block of the instance.',
    },
    {
      name: 'item',
      type: 'u16',
      offset: 60,
      role: 'static',
      unit: '-',
      doc: 'Item index of the instance.',
    },
    {
      name: 'kind',
      type: 'u8',
      offset: 62,
      role: 'static',
      unit: '-',
      doc: 'INSTANCE_KIND_CODES.',
    },
    {
      name: 'arm',
      type: 'u8',
      offset: 63,
      role: 'static',
      unit: '-',
      doc: 'Arm index for an arm instance, 255 otherwise.',
    },
    {
      name: 'boundRadius',
      type: 'f32',
      offset: 64,
      role: 'static',
      unit: 'm',
      doc: 'Radius of the bounding cylinder about the instance z axis, tested before the tree.',
    },
    {
      name: 'boundHalfHeight',
      type: 'f32',
      offset: 68,
      role: 'static',
      unit: 'm',
      doc: 'Half height of the bounding cylinder.',
    },
    {
      name: 'spare',
      type: 'u32',
      offset: 72,
      count: 2,
      role: 'static',
      unit: '-',
      pad: true,
      doc: 'The contract lists one spare word; the second brings its 76 bytes to the stated 80.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link INSTANCE_LAYOUT} record. */
export type Instance = RecordOf<typeof INSTANCE_LAYOUT>;

// ---------------------------------------------------------------------------------------------
// Patch rows (section 3.2)
// ---------------------------------------------------------------------------------------------

/**
 * The row table, 40 bytes per row of a REV patch (section 3.2, "Row table"): the meridian at
 * the row centre and at its two s-faces, in the item frame of the patch's part, and a packed
 * word. Bed potential and normal gravity follow from these numbers and the item's gravity
 * vector analytically; they are never differenced. The contract gives no row table for CART
 * and LINE patches.
 */
export const PATCH_ROW_LAYOUT = {
  name: 'PatchRow',
  section: '3.2',
  owner: 'M3',
  per: 'row',
  byteSize: 40,
  fields: [
    {
      name: 'r',
      type: 'f32',
      offset: 0,
      role: 'static',
      unit: 'm',
      doc: 'Radius r at the row centre.',
    },
    {
      name: 'rPrime',
      type: 'f32',
      offset: 4,
      role: 'static',
      unit: '1',
      doc: "r' = cos(a): radial component of the unit meridian tangent.",
    },
    {
      name: 'zPrime',
      type: 'f32',
      offset: 8,
      role: 'static',
      unit: '1',
      doc: "z' = sin(a): axial component of the unit meridian tangent.",
    },
    {
      name: 'kappaS',
      type: 'f32',
      offset: 12,
      role: 'static',
      unit: '1/m',
      doc: 'Meridional curvature da/ds: finite difference of the tangent angle between row centres, bounded by 1/D_s.',
    },
    {
      name: 'kappaTheta',
      type: 'f32',
      offset: 16,
      role: 'static',
      unit: '1/m',
      doc: "Azimuthal curvature z'/r.",
    },
    {
      name: 'rLower',
      type: 'f32',
      offset: 20,
      role: 'static',
      unit: 'm',
      doc: 'r at the lower s-face of the row.',
    },
    {
      name: 'zLower',
      type: 'f32',
      offset: 24,
      role: 'static',
      unit: 'm',
      doc: 'z at the lower s-face.',
    },
    {
      name: 'rUpper',
      type: 'f32',
      offset: 28,
      role: 'static',
      unit: 'm',
      doc: 'r at the upper s-face.',
    },
    {
      name: 'zUpper',
      type: 'f32',
      offset: 32,
      role: 'static',
      unit: 'm',
      doc: 'z at the upper s-face.',
    },
    {
      name: 'packed',
      type: 'u32',
      offset: 36,
      role: 'static',
      unit: '-',
      bits: [
        {
          name: 'log2Ntheta',
          lsb: 0,
          width: 5,
          doc: 'log2 of the number of columns N_theta of the row.',
        },
        {
          name: 'zone',
          lsb: 5,
          width: 8,
          doc: 'Id of the developable zone the row belongs to (disc, cone, cylinder or fold).',
        },
        { name: 'side', lsb: 13, width: 2, doc: 'SIDE_CODES: out, in or rim.' },
        {
          name: 'convexEdge',
          lsb: 15,
          width: 1,
          doc: 'The row is a convex edge (rim or convex fold).',
        },
        { name: 'concaveFold', lsb: 16, width: 1, doc: 'The row is a concave fold.' },
        {
          name: 'bandAbove',
          lsb: 17,
          width: 1,
          doc: 'N_theta changes between this row and the next (2:1 band boundary above).',
        },
        {
          name: 'bandBelow',
          lsb: 18,
          width: 1,
          doc: 'N_theta changes between this row and the previous one.',
        },
        { name: 'gutterRow', lsb: 19, width: 1, doc: 'The row carries a gutter (LINE elements).' },
        {
          name: 'rimApex',
          lsb: 20,
          width: 1,
          doc: 'The row holds the apex of the rim semicircle.',
        },
        {
          name: 'pole',
          lsb: 21,
          width: 1,
          doc: 'The row is a pole (s = 0 or s = S on a profile that starts on the axis).',
        },
      ],
      doc: 'log2 N_theta (5 bits), zone id (8), side (2), seven flags; 10 bits spare.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link PATCH_ROW_LAYOUT} record. */
export type PatchRow = RecordOf<typeof PATCH_ROW_LAYOUT>;

// ---------------------------------------------------------------------------------------------
// Blocks and soil cells (sections 3.6 and 3.7)
// ---------------------------------------------------------------------------------------------

/**
 * `BlockStatic`, 96 bytes per block (section 3.7): what the placement analysis knows of a
 * block. Recomputed for moved items at every epoch.
 */
export const BLOCK_STATIC_LAYOUT = {
  name: 'BlockStatic',
  section: '3.7',
  owner: 'M3',
  per: 'block',
  byteSize: 96,
  fields: [
    {
      name: 'centre',
      type: 'f32',
      offset: 0,
      count: 3,
      role: 'static',
      unit: 'm',
      doc: 'World centre of the block, tub frame.',
    },
    {
      name: 'area',
      type: 'f32',
      offset: 12,
      role: 'static',
      unit: 'm2',
      doc: 'Area of the block.',
    },
    {
      name: 'normal',
      type: 'i16',
      offset: 16,
      count: 2,
      role: 'static',
      unit: '1',
      scale: 1 / 32767,
      doc: 'Outward unit normal in the tub frame, octahedral: the two coordinates of n / (|nx| + |ny| + |nz|) with the lower hemisphere folded outwards.',
    },
    {
      name: 'gravityDirection',
      type: 'i16',
      offset: 20,
      role: 'static',
      unit: 'rad',
      scale: Math.PI / 32768,
      doc: 'Direction of the tangential gravity g_t in the tangent frame: angle from the first tangent axis (e_s or u) towards the second.',
    },
    {
      name: 'sinBeta',
      type: 'f16',
      offset: 22,
      role: 'static',
      unit: '1',
      doc: 'sin(beta) = |g_t| / g: sine of the tilt from horizontal.',
    },
    {
      name: 'gN',
      type: 'f16',
      offset: 24,
      role: 'static',
      unit: 'm/s2',
      doc: 'Normal gravity G_n = -g.n, positive on upward faces.',
    },
    {
      name: 'flowWidth',
      type: 'f16',
      offset: 26,
      role: 'static',
      unit: 'm',
      scale: 1e-3,
      doc: 'Width W of the block across the flow direction, stored in mm.',
    },
    {
      name: 'curvature',
      type: 'f16',
      offset: 28,
      count: 2,
      role: 'static',
      unit: '1/m',
      doc: 'The two principal curvatures.',
    },
    {
      name: 'donor',
      type: 'u32',
      offset: 32,
      count: 8,
      role: 'static',
      unit: '-',
      doc: 'Blocks that drain into this one (D-infinity links of section 3.7); 0xFFFFFFFF where there is none.',
    },
    {
      name: 'donorWeight',
      type: 'u16',
      offset: 64,
      count: 8,
      role: 'static',
      unit: '1',
      scale: 1 / 65535,
      doc: "Share of each donor's discharge that reaches this block.",
    },
    {
      name: 'twin',
      type: 'u32',
      offset: 80,
      role: 'static',
      unit: '-',
      doc: 'The block on the opposite face of the wall, or 0xFFFFFFFF.',
    },
    {
      name: 'firstFilmCell',
      type: 'u32',
      offset: 84,
      role: 'static',
      unit: '-',
      doc: "Index of the block's first film cell.",
    },
    {
      name: 'firstSoilCell',
      type: 'u32',
      offset: 88,
      role: 'static',
      unit: '-',
      doc: "Index of the block's first soil cell (`blockSoil` in section 3.6), or 0xFFFFFFFF if the block is unsoiled.",
    },
    {
      name: 'gap',
      type: 'log8',
      offset: 92,
      role: 'static',
      unit: 'm',
      log: GAP_LOG_RANGE,
      doc: 'Distance to the nearest other surface along the outward normal: 0 contact, 255 nothing within the 10 mm reach.',
    },
    {
      name: 'material',
      type: 'u8',
      offset: 93,
      role: 'static',
      unit: '-',
      doc: "Index of the block's material in the material table of the scene.",
    },
    {
      name: 'feature',
      type: 'u8',
      offset: 94,
      role: 'static',
      unit: '-',
      doc: 'BLOCK_FEATURE_CODES.',
    },
    {
      name: 'smoothingGroup',
      type: 'u8',
      offset: 95,
      role: 'static',
      unit: '-',
      doc: 'Smoothing group: blocks of the same part and side tag whose normals lie within 30 degrees.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link BLOCK_STATIC_LAYOUT} record. */
export type BlockStatic = RecordOf<typeof BLOCK_STATIC_LAYOUT>;

/** `BlockAux`, 16 bytes per block (section 3.7). */
export const BLOCK_AUX_LAYOUT = {
  name: 'BlockAux',
  section: '3.7',
  owner: 'M3',
  per: 'block',
  byteSize: 16,
  fields: [
    {
      name: 'patchRow',
      type: 'u32',
      offset: 0,
      role: 'static',
      unit: '-',
      bits: [
        { name: 'patch', lsb: 0, width: 16, doc: 'Patch id.' },
        { name: 'row', lsb: 16, width: 16, doc: 'Row of the block within its patch.' },
      ],
      doc: 'Patch id and row.',
    },
    {
      name: 'catchmentArea',
      type: 'f32',
      offset: 4,
      role: 'static',
      unit: 'm2',
      doc: 'Catchment area A_up: area that drains through the block.',
    },
    {
      name: 'basin',
      type: 'u16',
      offset: 8,
      role: 'static',
      unit: '-',
      doc: 'Id of the basin the block lies in, or 0xFFFF.',
    },
    {
      name: 'gutterElement',
      type: 'u16',
      offset: 10,
      role: 'static',
      unit: '-',
      doc: 'Gutter element of the block, or 0xFFFF.',
    },
    {
      name: 'filmClass',
      type: 'u8',
      offset: 12,
      role: 'static',
      unit: '-',
      bits: [
        {
          name: 'filmClass',
          lsb: 0,
          width: 2,
          doc: 'Position of the film class in FILM_CLASSES: S1, S2, K2, LINE.',
        },
        {
          name: 'subCells',
          lsb: 2,
          width: 4,
          doc: 'Number of sub-cells of the block: 4, or 9 for a pole block.',
        },
      ],
      doc: 'Film class and sub-cell count.',
    },
    {
      name: 'region',
      type: 'u8',
      offset: 13,
      role: 'static',
      unit: '-',
      doc: "Index of the block's region in the regions of its item's shape, or 0xFF.",
    },
    {
      name: 'gapReservoir',
      type: 'u16',
      offset: 14,
      role: 'static',
      unit: '-',
      doc: 'Id of the gap reservoir the block belongs to, or 0xFFFF.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link BLOCK_AUX_LAYOUT} record. */
export type BlockAux = RecordOf<typeof BLOCK_AUX_LAYOUT>;

/**
 * `SoilStatic`, 8 bytes per soil cell (section 3.7). The coverage rank is constant along flow
 * lines, depends on the pose and is recomputed with the links at every epoch.
 */
export const SOIL_STATIC_LAYOUT = {
  name: 'SoilStatic',
  section: '3.7',
  owner: 'M3',
  per: 'soil cell',
  byteSize: 8,
  fields: [
    {
      name: 'parentBlock',
      type: 'u32',
      offset: 0,
      role: 'static',
      unit: '-',
      doc: 'The block the soil cell is a sub-cell of.',
    },
    {
      name: 'coverageRank',
      type: 'u8',
      offset: 4,
      role: 'static',
      unit: '1',
      scale: 1 / 255,
      doc: 'Coverage rank u: the cell is under flowing water in a RIVULET block when u is below the wetted width fraction.',
    },
    {
      name: 'region',
      type: 'u8',
      offset: 5,
      role: 'static',
      unit: '-',
      doc: "Index of the cell's region in the regions of its item's shape, or 0xFF.",
    },
    { name: 'spare', type: 'u16', offset: 6, role: 'static', unit: '-', pad: true, doc: 'Spare.' },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link SOIL_STATIC_LAYOUT} record. */
export type SoilStatic = RecordOf<typeof SOIL_STATIC_LAYOUT>;

/**
 * One word of the `blockFilm` table, per block and grid (section 3.6): where the deposit
 * accumulators of a block start, and which solver owns the block.
 */
export const BLOCK_FILM_LAYOUT = {
  name: 'BlockFilm',
  section: '3.6',
  owner: 'M3',
  per: 'block and grid',
  byteSize: 4,
  fields: [
    {
      name: 'word',
      type: 'u32',
      offset: 0,
      role: 'static',
      unit: '-',
      bits: [
        {
          name: 'accumulatorOffset',
          lsb: 0,
          width: 31,
          doc: "Word offset of the block's first deposit accumulator.",
        },
        {
          name: 'sSolved',
          lsb: 31,
          width: 1,
          doc: 'Set when the block is S-solved: five words per film cell; clear for a K block: two words.',
        },
      ],
      doc: 'Bit 31 S-solved; bits 0 to 30 the word offset of the first deposit accumulator.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link BLOCK_FILM_LAYOUT} record. */
export type BlockFilm = RecordOf<typeof BLOCK_FILM_LAYOUT>;
