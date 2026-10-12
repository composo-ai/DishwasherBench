/**
 * Contract of the geometry kernel (docs/design/platform.md section 4).
 *
 * Every item and every machine component is a rigid compound of analytic primitives. The render
 * mesh, the collision pieces, the signed distance, the mass properties and the simulation
 * surfaces all derive from that one description.
 *
 * Units: SI throughout (metres, radians, kilograms, kg/m^3). Catalogue data files are authored
 * in millimetres, grams and degrees and are converted to these types when loaded.
 * Frames: right-handed, z up. In the item frame z = 0 is the plane the item rests on when
 * upright; a shell of revolution has its axis along +z through the origin.
 * All types are plain data (JSON-serialisable unless a field is a typed array) and read-only.
 */

import type { Mat3, Pose, Vec3 } from '@spotless/core';

// ---------------------------------------------------------------------------------------------
// 4.1 Primitives, parts, regions, shapes
// ---------------------------------------------------------------------------------------------

/** One vertex of the mid-surface profile of a shell of revolution, in the (r, z) half-plane. */
export interface SorProfilePoint {
  /** Distance from the axis, metres (>= 0). */
  readonly r: number;
  /** Height along the axis, metres. */
  readonly z: number;
  /** Wall thickness at this vertex, metres; interpolated linearly along each segment. */
  readonly t: number;
}

/**
 * Thick shell of revolution about +z: all points within `t / 2` of the revolved mid-surface
 * polyline. The ends are rounded with radius `t / 2`, so a rim is a semicircle.
 *
 * Precisely, the solid is the union of the balls of radius `t / 2` centred on the mid-surface,
 * with `t` interpolated linearly along each profile segment. Where the thickness is constant
 * that is the set of points within `t / 2` of the mid-surface; where it tapers, the wall faces
 * are the cones tangent to those balls.
 */
export interface SorPrimitive {
  readonly kind: 'sor';
  /**
   * Mid-surface polyline, at least two vertices, ordered from the axis end to the rim end.
   * Walking in that order, the profile's left normal points to the `'in'` side (the food side of
   * a plate or bowl).
   */
  readonly profile: readonly SorProfilePoint[];
  /**
   * Stretch of the revolved solid along x and y (oval platters, spoon bowls). Default `[1, 1]`.
   * The signed distance of a scaled primitive is a bound, not exact.
   */
  readonly scaleXY?: readonly [number, number];
  /**
   * Restricts the revolution to azimuths `[phi0, phi1]` in radians, measured from +x towards +y
   * (corner fillets of box shells). Default: the full turn. The two ends are flat faces in the
   * meridian planes at `phi0` and `phi1`. With `scaleXY`, the azimuths are those of the round
   * solid before it is stretched.
   */
  readonly arc?: readonly [number, number];
}

/**
 * Swept sphere between `a` and `b` (part frame, metres). `a` equal to `b` gives a sphere. Used
 * for wires, tines, handles, stems and chopsticks.
 */
export interface CapsulePrimitive {
  readonly kind: 'capsule';
  readonly a: Vec3;
  readonly b: Vec3;
  /** Radius of the swept sphere, metres. */
  readonly radius: number;
}

/**
 * Box with rounded edges, centred on the part-frame origin: the Minkowski sum of a box with the
 * given half extents and a sphere of the given radius. The outer half extent along each axis is
 * therefore `halfExtents + radius`.
 */
export interface RboxPrimitive {
  readonly kind: 'rbox';
  /** Half extents of the inner box before rounding, metres. */
  readonly halfExtents: Vec3;
  /** Rounding radius, metres (0 for a sharp box). */
  readonly radius: number;
}

/**
 * Rounded convex hull: the Minkowski sum of the convex hull of a few points (part frame, metres)
 * and a sphere. Used for odd convex bits such as knife blades and fork necks.
 */
export interface HullPrimitive {
  readonly kind: 'hull';
  readonly points: readonly Vec3[];
  /** Rounding radius, metres. */
  readonly radius: number;
}

/** One analytic primitive. */
export type Primitive = SorPrimitive | CapsulePrimitive | RboxPrimitive | HullPrimitive;

/** One primitive placed in the item frame. */
export interface Part {
  /** Unique within the shape, for example `'body'` or `'handle.2'`. */
  readonly id: string;
  readonly prim: Primitive;
  /** Part frame to item frame. */
  readonly pose: Pose;
  /** Catalogue material id (density, friction pair key, wetting). */
  readonly material: string;
  /**
   * Open-area fraction that lets water through, in [0, 1): 0 is solid (the default); a value
   * above 0 marks perforated sheet and mesh (colanders, sieves, graters). The part then holds
   * `1 - porosity` of the material of the solid primitive, spread evenly over it: its mass,
   * first moment and inertia (`computeMassProperties`) and its material volume
   * (`materialVolume`) are those of the solid times `1 - porosity`. Collision, signed distance,
   * the render mesh, the bounding box and the surface area are those of the solid primitive.
   */
  readonly porosity?: number;
}

/** Which side of a shell's mid-surface a region covers. */
export type SurfaceSide = 'in' | 'out' | 'both';

/**
 * A named patch of an item's surface. Soil is assigned per region and cleanliness is scored per
 * region.
 *
 * A patch of surface belongs to the first region in `Shape.regions` that selects it, so the
 * order of the regions is a priority. Several regions may share an id (one per part or per
 * stretch, for instance); their patches together form the region of that id.
 */
export interface SurfaceRegion {
  /** For example `'well'`, `'rim'`, `'interior'`, `'exterior'`, `'foot'`, `'handle'`. */
  readonly id: string;
  /** A part id, or a prefix ending in `'*'` that selects every part whose id starts with it. */
  readonly part: string;
  /**
   * Which side of the part the region covers. Default `'both'`.
   * - `'sor'` parts: the side of the mid-surface. `'in'` is the side the profile's left normal
   *   points to when walking from the axis outward (the food side of a plate or bowl). The rim
   *   is split at its crest. The flat end faces of a partial shell are on neither side.
   * - `'rbox'` and `'hull'` parts: `'in'` is the surface whose outward normal has a positive
   *   component along the part frame's +z axis, `'out'` the surface where it is negative;
   *   surface whose normal is perpendicular to z is on neither side.
   * - `'capsule'` parts have no sides.
   * Surface on neither side belongs only to regions whose side is `'both'`.
   */
  readonly side?: SurfaceSide;
  /**
   * For `'sor'` parts: the stretch of the profile covered, as normalised arc length of the
   * mid-surface from the axis end (0) to the rim end (1). Default `[0, 1]`. A point of the
   * surface has the arc length of the centre of the ball of the wall it lies on. Ignored for
   * other parts; the end faces of a partial shell belong only to regions with the default range.
   */
  readonly sRange?: readonly [number, number];
}

/** A rigid compound of parts with its named surface regions. The single source of truth. */
export interface Shape {
  readonly parts: readonly Part[];
  readonly regions: readonly SurfaceRegion[];
}

// ---------------------------------------------------------------------------------------------
// 4.2 Derived products (all pure functions of Shape)
// ---------------------------------------------------------------------------------------------

/**
 * Chord error for collision geometry, metres: the largest distance accepted between a flat facet
 * and the curved surface it replaces. platform.md section 4.2; the value is [ESTIMATED] in
 * docs/research/items.md section 5.3.
 */
export const COLLISION_CHORD_ERROR = 0.0005;
/** Chord error for render meshes, metres. platform.md section 4.2 (a design choice). */
export const RENDER_CHORD_ERROR = 0.0001;

/** Options controlling how finely curved surfaces are faceted. */
export interface TessellationOptions {
  /**
   * Largest allowed distance between a facet and the true surface, metres.
   *
   * Collision pieces: a shell of revolution of maximum mid-surface radius R gets
   * `N = max(minSectors, ceil(pi / acos(1 - chordError / R)))` angular sectors, the rule of
   * platform.md section 4.2. Rows of a wall whose thickness varies add up to half the chord
   * error (see `buildCollisionPieces`).
   *
   * Render mesh: every point of every facet is within `chordError` of the surface. Rims and
   * round joins curve both around the axis and along the profile, so half the chord error is
   * spent on each direction: the sector count is the same rule evaluated at `chordError / 2`
   * with the largest outer radius.
   */
  readonly chordError: number;
  /**
   * Lower bound on the number of angular sectors of a shell of revolution per full turn.
   * Default 16 (`DEFAULT_MIN_SECTORS`; the schema example in docs/research/items.md section 9).
   * Capsules have their own lower bound of 8.
   */
  readonly minSectors?: number;
  /**
   * Collision pieces only: also emit the round rolling surfaces of full, unstretched shells of
   * revolution ({@link CollisionRound}). Default true. They add nothing to the solid that the
   * other pieces describe; pass false for a consumer that cannot use them.
   */
  readonly roundSurfaces?: boolean;
}

/**
 * Indexed triangle mesh of a shape in the item frame. Triangles wind counter-clockwise seen
 * from outside. Typed arrays, so not directly JSON: send as binary or re-derive from the shape.
 *
 * The triangles of one part form a closed surface once vertices at identical positions are
 * welded (`meshTopology` checks it). Vertices are duplicated where the surface has a crease, so
 * that each carries the exact normal of its own face. Parts are meshed separately: where parts
 * overlap or touch, the mesh has interior surface.
 */
export interface RenderMesh {
  /** Vertex positions, 3 floats per vertex, metres. */
  readonly positions: Float32Array;
  /** Unit vertex normals, 3 floats per vertex, pointing out of the solid. */
  readonly normals: Float32Array;
  /** Triangle vertex indices, 3 per triangle. */
  readonly indices: Uint32Array;
  /** Per triangle: index into `partIds` of the part the triangle belongs to. */
  readonly triPart: Uint16Array;
  /** Per triangle: index into `regionIds` of its surface region, or -1 if it is in none. */
  readonly triRegion: Int16Array;
  /** Part ids, in the order of the shape's `parts`. */
  readonly partIds: readonly string[];
  /** Region ids, in the order of the shape's `regions`. */
  readonly regionIds: readonly string[];
}

/** Fields common to every collision piece. */
export interface CollisionPieceBase {
  /** Id of the part this piece was generated from (for contact attribution). */
  readonly part: string;
  /**
   * Catalogue material id of that part (key into the friction pair table).
   * `buildCollisionPieces` always sets it; hand-built pieces may omit it, in which case the
   * material of the body they are added to applies.
   */
  readonly material?: string;
}

/**
 * Rounded convex hull of a few points given in the item frame (metres): the Minkowski sum of
 * their hull and a sphere of radius `radius`. A shell-of-revolution wall becomes one such piece
 * of 4 points and radius `t / 2` per profile segment and angular sector; a flat floor that
 * reaches the axis becomes one piece of as many points as there are sectors.
 */
export interface CollisionHull extends CollisionPieceBase {
  readonly kind: 'hull';
  readonly points: readonly Vec3[];
  readonly radius: number;
}

/** Capsule between `a` and `b` in the item frame (metres); `a` equal to `b` is a sphere. */
export interface CollisionCapsule extends CollisionPieceBase {
  readonly kind: 'capsule';
  readonly a: Vec3;
  readonly b: Vec3;
  readonly radius: number;
}

/**
 * Rounded box: Minkowski sum of a box with half extents `halfExtents` (metres) and a sphere of
 * radius `radius`, so the outer half extent is `halfExtents + radius`. Physics engines whose box
 * shape takes the outer size and an inner convex radius must convert.
 */
export interface CollisionBox extends CollisionPieceBase {
  readonly kind: 'box';
  readonly halfExtents: Vec3;
  readonly radius: number;
  /** Box frame to item frame. */
  readonly pose: Pose;
}

/**
 * Round rolling surface of a shell of revolution: the side (not the two flat ends) of the solid
 * frustum between the circle of radius `radiusA` about `a` and the circle of radius `radiusB`
 * about `b`, both perpendicular to the line from `a` to `b` (item frame, metres). The side lies
 * on the outer surface of the shell where that surface faces away from the axis (on it along a
 * straight stretch of wall, within {@link ROUND_SURFACE_DEFICIT} inside it along a rim or a
 * round join, which is followed by chords).
 *
 * It exists because the hull pieces of a wall are flat facets, on which an item lying on its
 * side or standing on edge cannot roll (a 21-sided tumbler stays put on an 8 degree slope). A
 * physics engine gives the side to its contact solver as a truly round surface for whatever
 * the item rolls on.
 *
 * It is a one-sided surface, not a solid: the frustum behind it spans the cavity of the item,
 * which is not part of the shape. A consumer must take a contact with it only from outside
 * (overlapping the frustum by less than the wall thickness, on its side) and must otherwise
 * ignore the piece: the hull pieces of the same wall describe the complete solid. Volume,
 * distance and overlap computations skip pieces of this kind.
 */
export interface CollisionRound extends CollisionPieceBase {
  readonly kind: 'round';
  /** Centres of the two end circles, item frame, metres; `a` and `b` are distinct. */
  readonly a: Vec3;
  readonly b: Vec3;
  /** Radii of the end circles about `a` and `b`, metres. */
  readonly radiusA: number;
  readonly radiusB: number;
  /**
   * Thickness of the wall whose outer surface this is, metres: what something inside the item
   * overlaps the frustum by at the very least.
   */
  readonly wallThickness: number;
}

/**
 * Largest distance by which a round rolling surface lies inside the true surface along a rim or
 * a round join, metres (0.05 mm): what the chords of {@link CollisionRound} cut off.
 */
export const ROUND_SURFACE_DEFICIT = 0.00005;

/**
 * One collision piece of a shape, expressed in the item frame. The union of a shape's hull,
 * capsule and box pieces, all convex, is its collision geometry; pieces of one shape may
 * overlap. `round` pieces are one-sided surfaces on top of it (see {@link CollisionRound}).
 */
export type CollisionPiece = CollisionHull | CollisionCapsule | CollisionBox | CollisionRound;

/** A collision piece that is a convex solid (every kind but `round`). */
export type CollisionSolid = Exclude<CollisionPiece, CollisionRound>;

/** Mass, centre of mass and inertia of a rigid body. */
export interface MassProperties {
  /** Total mass, kilograms. */
  readonly mass: number;
  /** Centre of mass in the item frame, metres. */
  readonly com: Vec3;
  /** Inertia tensor about the centre of mass, in item-frame axes, kg m^2 (symmetric). */
  readonly inertia: Mat3;
}

/** Returns the density in kg/m^3 of a catalogue material id. */
export type DensityLookup = (material: string) => number;

/** Axis-aligned bounding box, metres. */
export interface Aabb {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** `buildRenderMesh(shape, { chordError })`: triangle mesh with per-triangle part and region. */
export type BuildRenderMesh = (shape: Shape, options: TessellationOptions) => RenderMesh;

/**
 * `buildCollisionPieces(shape, { chordError })`: sor to rounded convex quads (4 points, radius
 * t/2; 3 points where the profile touches the axis) per profile segment and angular sector,
 * with a flat stretch that reaches the axis as one rounded polygon;
 * capsule to capsule; rbox to box with convex radius; hull to rounded hull (to a capsule when
 * its points are coincident or collinear). A profile segment whose thickness varies is cut into
 * rows of constant radius. A full, unstretched shell also yields the round rolling surfaces of
 * its outer side (`round` pieces, see {@link CollisionRound}). The order of the result is
 * deterministic.
 */
export type BuildCollisionPieces = (shape: Shape, options: TessellationOptions) => CollisionPiece[];

/**
 * `computeMassProperties(shape, densityOf)`: about the centre of mass, item axes. A part with a
 * porosity weighs `1 - porosity` of its solid weight (see {@link Part.porosity}).
 */
export type ComputeMassProperties = (shape: Shape, densityOf: DensityLookup) => MassProperties;

/**
 * `signedDistance(shape, p)`: distance in metres from the point `p` (item frame) to the surface,
 * negative inside. The union of parts is the minimum over parts.
 *
 * Outside the shape the value is the exact distance for capsules, rounded boxes, hulls and
 * unscaled shells of revolution (for a partial shell: within a quarter turn of its end faces).
 * In the remaining cases (stretched shells, far behind the end of a partial shell, and inside
 * the solid next to a concave crease or where parts overlap) the sign is exact and the magnitude
 * never exceeds the true distance, so the value is always safe to step by.
 */
export type SignedDistance = (shape: Shape, p: Vec3) => number;

/** `signedDistanceGradient(shape, p)`: unit outward direction of steepest distance increase. */
export type SignedDistanceGradient = (shape: Shape, p: Vec3) => Vec3;

/**
 * `boundingBox(shape, pose?)`: tight axis-aligned box of the shape, in the item frame or, when a
 * pose (item frame to parent frame) is given, in the parent frame.
 */
export type BoundingBox = (shape: Shape, pose?: Pose) => Aabb;

/** `surfaceArea(shape, regionId?)`: area in m^2 of the whole surface or of one region. */
export type SurfaceArea = (shape: Shape, regionId?: string) => number;

// ---------------------------------------------------------------------------------------------
// 4.3 Parametric item definitions
// ---------------------------------------------------------------------------------------------

/**
 * Foot ring under the base of a shell of revolution: an annulus of mean radius `r`, radial
 * width `width` and height `height`, standing on z = 0, with its edges rounded all round (radius
 * half of the smaller of the two sizes). It should reach into the base: the part of it inside
 * the base joins the two without a crevice, and its mass is counted on top of the base's, as the
 * estimator of docs/research/items.md section 2.3 counts a foot ring. A ring that is twice as
 * high as it shows below the base keeps that extra to a minimum. All metres.
 */
export interface FootRingDef {
  readonly r: number;
  readonly width: number;
  readonly height: number;
  /** Material of the ring if it differs from the body (unglazed foot rings). */
  readonly material?: string;
}

/**
 * C-shaped loop handle of a mug or jug: a strap whose lower and upper arms meet the wall at
 * heights `attachZ[0]` and `attachZ[1]` (their centrelines; lower first) and whose outer face
 * stands `reach` off the outer wall. `section` = (width across the handle, tangential;
 * thickness in the plane of the loop). The opening left for a rack tine is `reach - thickness`
 * wide and `attachZ[1] - attachZ[0] - thickness` high; both must be positive. Azimuth in
 * radians from +x towards +y; default 0. All lengths in metres.
 */
export interface HandleLoopAddon {
  readonly type: 'handle_loop';
  readonly attachZ: readonly [number, number];
  readonly reach: number;
  readonly section: readonly [number, number];
  readonly azimuth?: number;
  readonly material?: string;
}

/**
 * Straight handle of a pan: starts in the wall at height `attachZ`, runs `length` beyond the
 * outer wall at `azimuth` (radians from +x, default 0), raised by `elevation` radians above
 * horizontal (default 0), with cross-section `section` = (width, horizontal; thickness). Its end
 * is rounded and so reaches a little further. Lengths in metres.
 */
export interface HandleBarAddon {
  readonly type: 'handle_bar';
  readonly attachZ: number;
  readonly length: number;
  readonly section: readonly [number, number];
  readonly azimuth?: number;
  readonly elevation?: number;
  readonly material?: string;
}

/**
 * Stem and foot of stemware: a foot disc of radius `footRadius` and thickness `footThickness`
 * standing on z = 0 (with a rounded edge), and a stem of radius `stemRadius` from the foot up to
 * the height at which the bowl profile starts, which must be at least a stem diameter up. A bowl
 * profile that starts off the axis is continued to the axis at its starting height and
 * thickness, so that the bowl is closed by a floor of its own and the stem ends inside that
 * floor. Cannot be combined with a foot ring. Metres.
 */
export interface StemFootAddon {
  readonly type: 'stem_foot';
  readonly stemRadius: number;
  readonly footRadius: number;
  readonly footThickness: number;
  readonly material?: string;
}

/**
 * Knob or hub on the axis (the knob of a pan lid, the blade hub on the floor of a blender jug):
 * base at height `z`, of the given radius and height: a puck with a rounded edge when it is
 * lower than it is wide, an upright capsule otherwise. Part id `knob`. Metres.
 */
export interface KnobAddon {
  readonly type: 'knob';
  readonly z: number;
  readonly radius: number;
  readonly height: number;
  readonly material?: string;
}

/**
 * Disc under the base of a pot or pan (an encapsulated or clad base): a puck of the given
 * radius and thickness with a rounded edge (radius half the thickness), standing on z = 0 under
 * the body. The body profile should start on top of the disc (its base underside at
 * `thickness`, or a little lower so that the two join without a crevice; what overlaps is
 * counted in the mass of both). An oval body (`scaleXY`) stretches the disc with it. Cannot be
 * combined with a foot ring or a stem foot. Part id `base`. Metres.
 */
export interface BaseDiscAddon {
  readonly type: 'base_disc';
  readonly radius: number;
  readonly thickness: number;
  /** Material of the disc if it differs from the body (aluminium core clad in steel). */
  readonly material?: string;
}

/**
 * Pouring lip at the rim: a flat tongue of the rim's thickness, centred on `azimuth` (radians
 * from +x), `width` along the rim and projecting `reach` beyond the rim circle. The rim itself
 * is not cut. Lengths in metres.
 */
export interface SpoutAddon {
  readonly type: 'spout';
  readonly azimuth: number;
  readonly width: number;
  readonly reach: number;
}

/** An add-on of a shell-of-revolution item. */
export type SorAddon =
  HandleLoopAddon | HandleBarAddon | StemFootAddon | KnobAddon | BaseDiscAddon | SpoutAddon;

/** Fields shared by every non-compound geometry definition. */
export interface GeometryDefBase {
  /** Catalogue material id of the main body. */
  readonly material: string;
  /** Open-area fraction of the body (colanders, sieves); default 0. */
  readonly porosity?: number;
  /**
   * Surface regions, referring to the part ids the expansion generates for this class. When
   * omitted the expansion supplies the default regions of the class.
   */
  readonly regions?: readonly SurfaceRegion[];
}

/** Plates, bowls, mugs, glasses, pans, jugs: a shell of revolution with optional add-ons. */
export interface SorDef extends GeometryDefBase {
  readonly class: 'sor';
  /** Mid-surface profile from the axis end to the rim end (see {@link SorPrimitive}). */
  readonly profile: readonly SorProfilePoint[];
  /** Stretch along x and y for oval items; default `[1, 1]`. */
  readonly scaleXY?: readonly [number, number];
  readonly footRing?: FootRingDef;
  readonly addons?: readonly SorAddon[];
}

/**
 * Oven dishes, trays, food containers: an open rounded-rectangle tray standing on z = 0, centred
 * on the z axis, length along x and width along y. All metres.
 */
export interface BoxShellDef extends GeometryDefBase {
  readonly class: 'box_shell';
  /** Outer length along x at the top of the wall, excluding any flange. */
  readonly length: number;
  /** Outer width along y at the top of the wall, excluding any flange. */
  readonly width: number;
  /** Outer height along z of the tray itself (a lid lip adds its own height underneath). */
  readonly height: number;
  /** Thickness of the walls and the floor. */
  readonly wall: number;
  /** Outer corner radius in plan view. */
  readonly cornerRadius: number;
  /** Width of a horizontal flange projecting outward from the top of the wall; default none. */
  readonly flange?: number;
  /**
   * Draft of the walls, radians from the vertical (0 to 0.6): they lean outward as they rise,
   * which is what lets moulded containers nest. Length, width and corner radius are measured at
   * the top; the floor is smaller. Default 0 (upright walls).
   */
  readonly draft?: number;
  /**
   * For lids: a lip of this height projecting from the underside, its outer face set in from the
   * outer edge by `inset`, that plugs into a container. The item then stands on the lip.
   */
  readonly lidLip?: { readonly height: number; readonly inset: number };
}

/** Chopping boards and flat lids: a rounded box lying on z = 0, centred on the z axis. Metres. */
export interface SlabDef extends GeometryDefBase {
  readonly class: 'slab';
  /** Size along x. */
  readonly length: number;
  /** Size along y. */
  readonly width: number;
  /** Size along z. */
  readonly thickness: number;
  /** Radius of the rounded edges (at most half the thickness). */
  readonly edgeRadius: number;
  /**
   * Corners cut off at 45 degrees: the length taken off both edges at the corners towards
   * (+x, +y), (-x, +y), (-x, -y) and (+x, -y), in that order; 0 leaves a corner square. With
   * any cut the slab is a rounded polygon (a `hull` part) instead of a rounded box: pieces of
   * sheet that have to fit round a circle without overlapping what lies beside them.
   */
  readonly cornerCuts?: readonly [number, number, number, number];
}

/**
 * One node of a rod centreline with the cross-section there. The link between two nodes has a
 * rounded rectangular section whose corner radius is half the smallest of the section sizes at
 * its two nodes, so a bar that is as wide as it is thick at both ends is round. Metres, item
 * frame.
 */
export interface RodNode {
  readonly p: Vec3;
  /** Section size across the rod, in the horizontal direction perpendicular to the centreline. */
  readonly width: number;
  /** Section size in the remaining perpendicular direction. */
  readonly thickness: number;
}

/**
 * The working end of a rod, attached at the last centreline node and continuing the direction of
 * the last link (add a short last link to aim the head). `length`, `width`, `depth` and
 * `thickness` are in metres. A spoon bowl is a concave shell, hollow towards the thickness
 * direction, whose rim meets the last node; fork tines are separate prongs joined at their roots;
 * a blade is a wedge with its spine on the +width side.
 */
export type RodHead =
  | { readonly type: 'none' }
  | {
      readonly type: 'spoon_bowl';
      readonly length: number;
      readonly width: number;
      /** Depth of the bowl below its rim. */
      readonly depth: number;
      readonly thickness: number;
    }
  | {
      readonly type: 'fork_tines';
      readonly count: number;
      readonly length: number;
      /** Overall width across all tines. */
      readonly width: number;
      readonly thickness: number;
    }
  | {
      readonly type: 'blade';
      readonly length: number;
      /** Blade height from spine to edge. */
      readonly width: number;
      /** Thickness at the spine. */
      readonly thickness: number;
    };

/** Cutlery, utensils, chopsticks: a section swept along a centreline, with a head. */
export interface RodDef extends GeometryDefBase {
  readonly class: 'rod';
  /** Centreline from the handle end to the head end, at least two nodes. */
  readonly nodes: readonly RodNode[];
  readonly head: RodHead;
}

/** One wire: a polyline swept by a sphere of the given radius. Metres, item frame. */
export interface WirePolyline {
  readonly points: readonly Vec3[];
  readonly radius: number;
  /** True to join the last point back to the first. Default false. */
  readonly closed?: boolean;
}

/** Whisks and cooling racks: capsule chains. */
export interface WireDef extends GeometryDefBase {
  readonly class: 'wire';
  readonly wires: readonly WirePolyline[];
}

/**
 * One rule for naming the surface regions of a compound: every region whose id, already
 * prefixed with the id of its child, matches `from` gets the id `to`. In `from` a `*` stands
 * for any run of characters, an empty one included (`'cup_*.interior'`, `'lug_*'`).
 */
export interface RegionRename {
  readonly from: string;
  readonly to: string;
}

/**
 * Several sub-definitions rigidly joined (muffin tin, lunch box with lid). Part and region ids of
 * a child are prefixed with the child's `id` and a dot.
 */
export interface CompoundDef {
  readonly class: 'compound';
  readonly children: readonly {
    readonly id: string;
    readonly def: GeometryDef;
    /** Child item frame to compound item frame. */
    readonly pose: Pose;
  }[];
  /**
   * Names for the regions of the whole item. Without it a region cannot span children, because
   * every region id carries the prefix of its child (twelve muffin cups give twelve
   * `cup_N.interior` regions). The rules are tried in order on each prefixed region id and the
   * first that matches renames it; several regions may end up with the same id and then form
   * one region (`SurfaceRegion`). A region that matches no rule keeps its prefixed id. The
   * order of the regions, which is their priority, does not change. A rule that renames no
   * region is a data error.
   */
  readonly regionRenames?: readonly RegionRename[];
}

/**
 * Parametric geometry definition in SI units (metres and radians): what `expandGeometry` takes.
 *
 * Catalogue item types do not carry this form. Catalogue files are written in millimetres and
 * degrees (platform.md section 2), so an item type carries the same definition in authoring
 * units, the `GeometryDefMm` types of `authoring.ts`, and is expanded with `expandGeometryMm`
 * (`geometryDefFromMm` converts to this type). Code that builds geometry itself (the machine
 * package, tests) may use either form; a `Shape` is always SI.
 */
export type GeometryDef = SorDef | BoxShellDef | SlabDef | RodDef | WireDef | CompoundDef;

/**
 * `expandGeometry(def)`: the shape described by a parametric definition. The part ids and the
 * default surface regions of each class are documented with the expansion of that class.
 */
export type ExpandGeometry = (def: GeometryDef) => Shape;

/**
 * The functions `@spotless/geometry` exports, collected so an implementation can be checked
 * against the contract (`const kernel: GeometryKernel = { buildRenderMesh, ... }`).
 */
export interface GeometryKernel {
  readonly expandGeometry: ExpandGeometry;
  readonly buildRenderMesh: BuildRenderMesh;
  readonly buildCollisionPieces: BuildCollisionPieces;
  readonly computeMassProperties: ComputeMassProperties;
  readonly signedDistance: SignedDistance;
  readonly signedDistanceGradient: SignedDistanceGradient;
  readonly boundingBox: BoundingBox;
  readonly surfaceArea: SurfaceArea;
}
