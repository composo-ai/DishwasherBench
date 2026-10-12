/**
 * Data schemas of the catalogue package: materials, contact pairs, item types, soils, detergents.
 *
 * Units. Catalogue records are authored in millimetres, grams and degrees (docs/design/
 * platform.md section 2), and every field that is not SI says so in its name (`valueMm`,
 * `valueG`, `rotXyzDeg`, `advancingDeg`). Material properties are SI (kg/m^3, W/(m K),
 * J/(kg K)); temperatures are degrees Celsius. Everything `instantiate` returns is SI.
 *
 * Frames. The item frame is right-handed with z up; z = 0 is the plane the item rests on when
 * upright, and a shell of revolution has its axis along +z. By convention of this catalogue a
 * handle or the long axis of an item lies along +x.
 *
 * Provenance. Every number transcribed from the research dossiers keeps the dossier's tag
 * (docs/research/items.md section 0.1): VERIFIED, RECALLED or ESTIMATED.
 */

import type { Quat, Vec3 } from '@spotless/core';
import type { Aabb, GeometryDefMm, MassProperties, Shape } from '@spotless/geometry';
import type { SoilWorkingQuantity } from './soil-working.ts';

// ---------------------------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------------------------

/**
 * Confidence tag of a value, as used by every research dossier: `VERIFIED` (seen in source text),
 * `RECALLED` (from memory, source not opened) or `ESTIMATED` (a derivation or a choice).
 */
export type Provenance = 'VERIFIED' | 'RECALLED' | 'ESTIMATED';

/** Every {@link Provenance} tag. */
export const PROVENANCE_TAGS: readonly Provenance[] = ['VERIFIED', 'RECALLED', 'ESTIMATED'];

/** A number together with where it comes from. The unit is that of the field holding it. */
export interface Sourced {
  readonly value: number;
  readonly tag: Provenance;
  /** Dossier and section (and original source where the dossier names one). */
  readonly source: string;
  /** Range the source gives around the value, in the same unit. */
  readonly range?: readonly [number, number];
}

// ---------------------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------------------

/**
 * Key into the friction and restitution pair tables (docs/research/items.md section 11). Several
 * materials share a key: the tables are per class of surface, not per material.
 */
export type ContactMaterialKey =
  /** Rack wire with a nylon (PA11) coating: the counter-surface of items.md table 11.1. */
  | 'rack_wire'
  /** Rack wire with a PVC plastisol coating: table 11.1 multiplied by 1.5. */
  | 'rack_wire_pvc'
  | 'ceramic_glazed'
  /** Unglazed foot ring: the high-friction exception on ceramics. */
  | 'ceramic_unglazed'
  /** Soda-lime, Vitrelle, borosilicate, crystal. */
  | 'glass'
  | 'stainless_steel'
  /** Bare or anodised aluminium. */
  | 'aluminium'
  /** PTFE non-stick coating, whatever the metal underneath. */
  | 'ptfe'
  /** Seasoned cast iron. */
  | 'cast_iron'
  /** Polypropylene and polyethylene. */
  | 'polyolefin'
  /** Tritan, SAN, polycarbonate, melamine, nylon. */
  | 'hard_plastic'
  /** Beech, bamboo. */
  | 'wood'
  /** Silicone rubber and other rubbery grips. */
  | 'silicone';

/** Broad family of a material, for grouping and for the `fragile` flag of items. */
export type MaterialFamily = 'ceramic' | 'glass' | 'metal' | 'polymer' | 'elastomer' | 'wood';

/**
 * The three liquors the film model distinguishes (docs/research/films.md section 12.7): clean
 * water (pre-rinse, final rinse without rinse aid), main-wash liquor (surface tension about
 * 40 mN/m) and the final rinse with rinse aid (about 45 mN/m dynamic).
 */
export type LiquorClass = 'clean_water' | 'main_wash' | 'rinse_aid';

/** Every {@link LiquorClass}. */
export const LIQUOR_CLASSES: readonly LiquorClass[] = ['clean_water', 'main_wash', 'rinse_aid'];

/** Advancing and receding contact angle of a liquor on a material, degrees. */
export interface ContactAngles {
  readonly advancingDeg: number;
  readonly recedingDeg: number;
}

/**
 * How water films behave on a material, derived from its receding contact angles by the rule of
 * docs/research/films.md section 12.6 and docs/design/sim-core.md section 3.4:
 * - `continuous_film`: receding angle at most 10 degrees in main-wash liquor and at most 20 in
 *   clean water (glass, glazed ceramic): a film stays continuous;
 * - `rivulet_prone`: receding angle above 20 degrees in main-wash liquor (polypropylene, PTFE,
 *   silicone): films break into rivulets and beads;
 * - `partially_wetting`: everything in between (stainless steel, melamine, SAN, copolyester,
 *   polyethylene).
 */
export type WettingClass = 'continuous_film' | 'partially_wetting' | 'rivulet_prone';

/** Wetting data of a material: default contact angles per liquor and the class they imply. */
export interface MaterialWetting {
  readonly class: WettingClass;
  readonly angles: Readonly<Record<LiquorClass, ContactAngles>>;
  /** Always `ESTIMATED`: films.md section 12.7 gives defaults anchored to measured values. */
  readonly tag: Provenance;
  /** The row of films.md table 12.7 the angles are taken from. */
  readonly source: string;
  /**
   * True when the dossier has no row for this material and the angles of the nearest row are
   * used in its place. Such values are the first candidates for calibration.
   */
  readonly standIn: boolean;
}

/** Thermal properties of a material. */
export interface MaterialThermal {
  /** Thermal conductivity, W/(m K). */
  readonly conductivity: Sourced;
  /** Specific heat capacity, J/(kg K). */
  readonly specificHeat: Sourced;
}

/**
 * One catalogue material. A material here is a bulk and its surface together: a PTFE-coated
 * aluminium pan body and a bare aluminium tray are two materials, because parts carry one
 * material id and that id decides mass, friction and wetting alike.
 */
export interface Material {
  /** Catalogue id, for example `porcelain_glazed`. */
  readonly id: string;
  readonly name: string;
  readonly family: MaterialFamily;
  /** Bulk density, kg/m^3. */
  readonly density: Sourced;
  /** Row of the friction and restitution tables this material uses. */
  readonly contactKey: ContactMaterialKey;
  readonly thermal: MaterialThermal;
  readonly wetting: MaterialWetting;
  /**
   * Highest temperature the material takes in service without softening or damage, degrees
   * Celsius; `null` when there is no limit a dishwasher could reach (ceramics, glass, metals).
   */
  readonly maxServiceTempC: Sourced | null;
  /**
   * True when the bulk is less dense than water at 60 degrees C (983 kg/m^3), so that a free
   * piece floats in pooled water (items.md section 3.1).
   */
  readonly floats: boolean;
  readonly notes?: string;
}

/**
 * Friction and restitution of one pair of materials in one state (dry loading or wet washing).
 * Structurally compatible with the physics package's `ContactPairProperties`.
 */
export interface ContactPair {
  /**
   * Kinetic Coulomb friction coefficient: the single coefficient a rigid-body engine uses
   * (items.md section 5.6).
   */
  readonly friction: number;
  /** Static friction coefficient where the dossier gives one (item against rack wire only). */
  readonly staticFriction: number | null;
  /** Coefficient of restitution of the pair, 0 to 1. */
  readonly restitution: number;
  /** Range a calibration campaign should expect the kinetic coefficient to land in. */
  readonly frictionRange: readonly [number, number];
  /** Always `ESTIMATED`: items.md section 11 is a synthesis of the verified data of section 3. */
  readonly tag: Provenance;
  /** The table row or rule the values come from. */
  readonly source: string;
  /** True when the dossier has no row for the pair and the nearest row is used in its place. */
  readonly standIn: boolean;
}

// ---------------------------------------------------------------------------------------------
// Soils
// ---------------------------------------------------------------------------------------------

/**
 * Soil class of docs/research/soils.md section 7.9: which removal mechanisms act.
 * `SOL` soluble (sugars, fresh drinks); `SWP` swelling protein; `SWS` swelling starch; `PEEL`
 * dried sauces and gum films that detach adhesively; `FAT` fats, oils, waxes; `BURN` baked,
 * Maillard-browned or polymerised; `STAIN` chromophore films and dyes; `PART` particles and
 * fibres.
 */
export type SoilClass = 'SOL' | 'SWP' | 'SWS' | 'PEEL' | 'FAT' | 'BURN' | 'STAIN' | 'PART';

/** Every {@link SoilClass}. */
export const SOIL_CLASSES: readonly SoilClass[] = [
  'SOL',
  'SWP',
  'SWS',
  'PEEL',
  'FAT',
  'BURN',
  'STAIN',
  'PART',
];

/** Food group of a soil, following the sub-sections of soils.md section 5. */
export type SoilGroup =
  'egg' | 'dairy' | 'meat' | 'starch' | 'fat' | 'sugar' | 'stain' | 'particle' | 'burnt' | 'mixed';

/**
 * How a soil was heated before the wash, as far as the cook would know. This is the one
 * declaration of the type; the session contract re-exports it for its wire types.
 * `none` never heated on the item; `warm` kept warm or oven-dried at up to about 80 degrees C;
 * `cooked` cooked on the item at about 100 to 150 degrees C; `baked` oven-baked at about 120 to
 * 200 degrees C; `burnt` charred.
 */
export type SoilHeatHistory = 'none' | 'warm' | 'cooked' | 'baked' | 'burnt';

/** Every {@link SoilHeatHistory}, mildest first. */
export const SOIL_HEAT_HISTORIES: readonly SoilHeatHistory[] = [
  'none',
  'warm',
  'cooked',
  'baked',
  'burnt',
];

/** How a soil typically lies on a surface. */
export type SoilPattern =
  /** Thin, even layer over the region. */
  | 'film'
  /** Thin layer spread by a utensil, uneven. */
  | 'smear'
  /** Thick local deposit. */
  | 'patch'
  /** Tide line at a former liquid level. */
  | 'ring'
  /** Tide lines over a faint film (tea in a cup). */
  | 'ring_and_film'
  /** Dried pool in the lowest part of a vessel. */
  | 'bottom_pool'
  /** Short arc at a rim (lipstick). */
  | 'arc'
  /** Run marks below a rim or spout. */
  | 'drips'
  /** Scattered droplets (splatter under a lid, around a pan). */
  | 'splatter'
  /** Hard baked layer, thickest at rims and corners. */
  | 'crust'
  /** Separate particles stuck by a thin binder. */
  | 'specks'
  /** Colour taken up by the material itself. */
  | 'stain';

/** A standard test method that defines a soil. */
export type SoilStandard = 'IEC 60436' | 'AHAM DW-1' | 'IKW';

/** Recipe facts of a standard test soil, as far as the dossiers could verify them. */
export interface StandardSoilSpec {
  readonly method: SoilStandard;
  /** The item the standard applies it to. */
  readonly substrate: string;
  /** Recipe and amount, in words. */
  readonly recipe: string;
  /** Drying or baking the standard prescribes, in words. */
  readonly ageing: string;
  /** Tag of the recipe facts. */
  readonly tag: Provenance;
  /** Dossier section. */
  readonly source: string;
}

/**
 * Words used to describe a soil to a player. `describeSoil` assembles a sentence such as
 * "Porridge, dried on for about 12 hours, on the inside base".
 */
export interface SoilDescriptionTemplates {
  /** Noun phrase per applicable heat history, for example `baked: 'Baked-on egg yolk'`. */
  readonly byHeat: Readonly<Partial<Record<SoilHeatHistory, string>>>;
  /** Phrase for a soil less than an hour old, for example `'still wet'`. */
  readonly fresh: string;
  /** Phrase for an older soil; `{age}` is replaced by the age in words. */
  readonly aged: string;
}

/**
 * Typical amount of a soil per unit of soiled area, g/m^2. The basis says whether the figures
 * are for the soil as applied (`wet`) or for its dry matter (`dry`).
 */
export interface SoilLoading {
  readonly basis: 'wet' | 'dry';
  /** Typical loading, g/m^2. */
  readonly typicalGPerM2: number;
  /** Range met on real tableware or in test methods, g/m^2. */
  readonly rangeGPerM2: readonly [number, number];
  /** Solids mass fraction of the soil as applied, where the dossier gives it; else null. */
  readonly solidsFraction: number | null;
  readonly tag: Provenance;
  readonly source: string;
}

/**
 * Difficulty of a soil on the 1 (trivial) to 10 (normally survives a standard cycle) scale of
 * soils.md section 5.11, for a 45 to 55 degree C enzymatic cycle. For level design only: it is
 * never shown to players.
 */
export interface SoilDifficulty {
  readonly rank: number;
  /** Range where the dossier gives one (fresh to dried, or by substrate). */
  readonly range: readonly [number, number];
  readonly tag: Provenance;
  readonly source: string;
}

/**
 * Identity of one soil type. Kinetic and adhesion parameters are deliberately absent: they
 * belong to the wash simulation's parameter registry.
 */
export interface SoilType {
  /** Catalogue id, for example `egg_yolk_dried`. */
  readonly id: string;
  /** Display name, for example "Dried egg yolk". */
  readonly name: string;
  readonly group: SoilGroup;
  /** Class of the continuous phase (soils.md section 7.1 assumption 4). */
  readonly soilClass: SoilClass;
  /** Further classes that describe sub-states (a fat film, particles, a stain). */
  readonly secondaryClasses: readonly SoilClass[];
  /** Present for the soils of the standard test methods. */
  readonly standard?: StandardSoilSpec;
  readonly description: SoilDescriptionTemplates;
  /** Heat histories that make sense for this soil; the first is the default. */
  readonly heatHistories: readonly SoilHeatHistory[];
  /** The dossiers' loading, with its provenance. */
  readonly loading: SoilLoading;
  /**
   * The working quantities a soil record is written from: basis, solids fraction, loading of
   * the covered area with its range, usual coverage, usual ageing and appearance
   * (`soil-working.ts`; docs/calibration/soil-quantities.md).
   */
  readonly working: SoilWorkingQuantity;
  /** Region ids the soil typically sits on (`well`, `interior`, `rim`, `tines`, ...). */
  readonly typicalRegions: readonly string[];
  readonly patterns: readonly SoilPattern[];
  readonly difficulty: SoilDifficulty;
  /** What is left on the item when cleaning fails, in words (soils.md section 5). */
  readonly residue: string;
  /** True when the soil carries a dye that hydrophobic plastics take up (soils.md 5.7). */
  readonly stainsPlastics: boolean;
}

// ---------------------------------------------------------------------------------------------
// Item types
// ---------------------------------------------------------------------------------------------

/** Coarse grouping of item types for menus and level themes. */
export type ItemCategory =
  | 'tableware'
  | 'drinkware'
  | 'cutlery'
  | 'utensil'
  | 'prep'
  | 'cookware'
  | 'bakeware'
  | 'storage'
  | 'baby';

/**
 * Shape tag used by the wash simulation to choose a film solver for an item
 * (docs/design/sim-core.md section 3.4). The first ten are hollow ware, the next four flat ware;
 * the rest are classified by material alone.
 */
export type ShapeTag =
  | 'cup'
  | 'mug'
  | 'glass'
  | 'stemware'
  | 'bowl'
  | 'jug'
  | 'pot'
  | 'pan'
  | 'container'
  | 'lid'
  | 'plate'
  | 'saucer'
  | 'platter'
  | 'flat_dish'
  | 'cutlery'
  | 'utensil'
  | 'board'
  | 'bottle'
  | 'wire_rack';

/** Shape tags sim-core.md section 3.4 lists as hollow ware. */
export const HOLLOW_WARE_TAGS: readonly ShapeTag[] = [
  'cup',
  'mug',
  'glass',
  'stemware',
  'bowl',
  'jug',
  'pot',
  'pan',
  'container',
  'lid',
];

/** Shape tags sim-core.md section 3.4 lists as flat ware. */
export const FLAT_WARE_TAGS: readonly ShapeTag[] = ['plate', 'saucer', 'platter', 'flat_dish'];

/**
 * Racks and baskets an item can be placed in (the rack frames of platform.md section 2). The
 * session contract's `RackId` is this type.
 */
export type RackZone = 'lower_rack' | 'upper_rack' | 'third_rack' | 'cutlery_basket';

/** Every {@link RackZone}. */
export const RACK_ZONES: readonly RackZone[] = [
  'lower_rack',
  'upper_rack',
  'third_rack',
  'cutlery_basket',
];

/**
 * How validation measures a stated dimension on the expanded geometry:
 * - `bbox`: extent of the bounding box along an item-frame axis, of the whole item or of the
 *   parts selected by `parts` (a part id, or a prefix ending in `*`);
 * - `rim_diameter`: outer diameter at the rim end of the shell of revolution `part`
 *   (default `body`);
 * - `base_diameter`: outer diameter at its base corner (the second profile vertex);
 * - `inner_depth`: from the top of its rim down to the inner face of its base.
 */
export type DimensionMeasure =
  | { readonly kind: 'bbox'; readonly axis: 'x' | 'y' | 'z'; readonly parts?: string }
  | { readonly kind: 'rim_diameter'; readonly part?: string }
  | { readonly kind: 'base_diameter'; readonly part?: string }
  | { readonly kind: 'inner_depth'; readonly part?: string };

/** One dimension of an item as the dossier states it, with the dossier's tag. */
export interface StatedDimension {
  /** What is measured: `diameter`, `height`, `length`, `width`, `overall_length`, ... */
  readonly name: string;
  /** The value the geometry is built to, millimetres. */
  readonly valueMm: number;
  readonly tag: Provenance;
  /** Range the dossier gives for the product family, millimetres. */
  readonly rangeMm?: readonly [number, number];
  /**
   * How the dimension is measured on the geometry; validation requires the measured value to be
   * within 2 mm. Absent when the geometry does not model the feature (the note says why).
   */
  readonly measure?: DimensionMeasure;
  readonly note?: string;
}

/** Mass of an item as the dossier states it. */
export interface StatedMass {
  /** The mass the geometry is fitted to, grams. */
  readonly valueG: number;
  readonly tag: Provenance;
  /** Range the dossier gives, grams. */
  readonly rangeG?: readonly [number, number];
  /**
   * A verified figure that includes more than the item (a lid, a cap, packaging), grams: an
   * upper bound on the item's own mass.
   */
  readonly grossG?: number;
  readonly note?: string;
}

/** The product or standard article an item type is modelled on. */
export interface ItemReference {
  /** Reference product, for example "IKEA 365+ plate 27 cm". */
  readonly product: string;
  /** The standard load item it represents, if any, for example "IEC 60436 dinner plate". */
  readonly standardItem: string | null;
  /** Source keys of docs/research/items.md section 15 (or another dossier's section). */
  readonly sources: readonly string[];
}

/** Material of a part or group of parts of an item. */
export interface PartMaterial {
  /** A part id of the expanded shape, or a prefix ending in `*` (`'*'` for every part). */
  readonly part: string;
  /** Catalogue material id. */
  readonly material: string;
}

/** A named region of an item's surface, as shown to players and used to place soil. */
export interface ItemSurfaceRegion {
  /** Region id of the expanded shape, for example `well`, `rim`, `interior`, `handle`. */
  readonly id: string;
  /** What the region is, in words that fit after "on the", for example "eating face". */
  readonly label: string;
  /** True for the surfaces that touch food or drink. */
  readonly foodContact: boolean;
}

/** A soil that items of a type typically carry, by region. */
export interface TypicalSoil {
  /** Region id of the item. */
  readonly region: string;
  /** Catalogue soil id. */
  readonly soil: string;
  readonly pattern: SoilPattern;
}

/**
 * A named orientation of an item: the presets a player cycles through. The rotation maps the
 * item frame to the placement frame and is given as intrinsic X-Y-Z Euler angles in degrees
 * (`quatFromEulerXYZ` of `@spotless/core`).
 */
export interface StablePose {
  /** For example `upright`, `inverted`, `on_edge`. */
  readonly name: string;
  readonly rotXyzDeg: Vec3;
  /**
   * True when the item stands in this orientation on a flat surface without support: its centre
   * of mass is above its support polygon. False for poses that need the rack (on edge between
   * tines, leaning, standing in a basket cell). Validation holds the flag to the statics: a
   * pose marked true must be stable (`staticStability`), and a pose that is stable and tips
   * only beyond 5 degrees must be marked true.
   */
  readonly freeStanding: boolean;
  /** What the pose looks like, in words. */
  readonly description: string;
}

/** Where and how an item usually goes into a machine. Guidance, never a constraint. */
export interface ItemPlacement {
  /** Racks the item is usually loaded in, most usual first. */
  readonly zones: readonly RackZone[];
  /** Named orientations; the first is the upright pose. */
  readonly stablePoses: readonly StablePose[];
  /** Name of the pose usual practice recommends. */
  readonly recommendedPose: string;
  /** Usual placement of the family, in words (items.md section 10.3). */
  readonly usual: string;
  /** Behaviour of the family the simulation should capture, in words (items.md 10.3). */
  readonly behaviour: string;
}

/** Yes or no properties of an item type. */
export interface ItemFlags {
  /** False for items makers tell users to wash by hand (wood, cast iron, sharp knives, ...). */
  readonly dishwasherSafe: boolean;
  /** True for items that should not go in the lower rack (thin plastics near the heater). */
  readonly topRackOnly: boolean;
  /** True for ceramic and glass items, which chip or break on impact. */
  readonly fragile: boolean;
  /** True when the item floats if it is free in pooled water. */
  readonly floats: boolean;
  /**
   * True when the item has a concave face a jet can enter and be turned back by, which doubles
   * the jet force in the mobility screen (items.md section 4.6).
   */
  readonly concave: boolean;
}

/**
 * One item type of the catalogue: the schema of docs/research/items.md section 9. Everything
 * geometric derives from `geometry`; nothing else stores shape.
 */
export interface ItemType {
  /** Catalogue id, for example `dinner_plate_porcelain_270`. */
  readonly id: string;
  /**
   * Row number in the starter catalogue (items.md table 10.1), or null for an item added from
   * another dossier.
   */
  readonly row: number | null;
  /** Display name, for example "Dinner plate, heavy porcelain, 27 cm". */
  readonly name: string;
  readonly category: ItemCategory;
  /** Item class, for example `dinner_plate`: what level families draw from. */
  readonly itemClass: string;
  readonly shapeTag: ShapeTag;
  readonly reference: ItemReference;
  /** Dimensions as stated by the dossier, each with its own tag. */
  readonly dimensions: readonly StatedDimension[];
  readonly mass: StatedMass;
  /** Tag of the geometric profile, and how it was arrived at. */
  readonly profile: { readonly tag: Provenance; readonly note: string };
  /** Material per part; the first matching entry applies. */
  readonly materials: readonly PartMaterial[];
  /**
   * Parametric geometry in authoring units (millimetres, degrees): always the kernel's
   * `GeometryDefMm`, never its SI `GeometryDef`. `expandGeometryMm(geometry)` is the item's
   * shape at scale 1, the same shape `instantiate` returns, so every consumer sees the same
   * part and region ids. A compound item names the regions of the whole item with the
   * definition's own `regionRenames`.
   */
  readonly geometry: GeometryDefMm;
  /** Every region of the item's surface, with a label. */
  readonly surfaceRegions: readonly ItemSurfaceRegion[];
  readonly typicalSoils: readonly TypicalSoil[];
  readonly placement: ItemPlacement;
  readonly flags: ItemFlags;
  readonly game: { readonly defaultPoints: number };
  readonly notes?: string;
}

/** A named orientation of an instantiated item as a unit quaternion. */
export interface InstancePose {
  readonly name: string;
  /** Item frame to placement frame, `[x, y, z, w]`. */
  readonly q: Quat;
  readonly freeStanding: boolean;
}

/** Options of `instantiate`. */
export interface InstantiateOptions {
  /**
   * Uniform scale applied to every length of the item (default 1): the parametric jitter of
   * dimensions within a class (docs/research/benchmark.md section 4.3). Mass scales with its
   * cube. Must be between 0.5 and 2.
   */
  readonly scale?: number;
}

/**
 * An item type made ready for the physics and render packages. SI units throughout; the shape,
 * the centre of mass and the bounding box are in the item frame.
 */
export interface ItemInstance {
  readonly type: ItemType;
  /** The scale it was instantiated with. */
  readonly scale: number;
  /** The single description every derived product is computed from. */
  readonly shape: Shape;
  /**
   * Mass (kg), centre of mass (m) and inertia about it (kg m^2): the kernel's
   * `computeMassProperties` with the densities of the catalogue's materials. Perforated parts
   * weigh less by their open-area fraction.
   */
  readonly mass: MassProperties;
  /**
   * Material of the body for contact purposes; collision pieces built from `shape` carry the
   * material of their own part, which takes precedence. Structurally the physics package's
   * `ContactMaterial`.
   */
  readonly contact: { readonly material: string };
  /** Tight bounding box, metres. */
  readonly bbox: Aabb;
  /** The point poses refer to: the centre of the bounding box, metres. */
  readonly referencePoint: Vec3;
  /** Volume of material, m^3 (parts counted separately, perforations taken out). */
  readonly volume: number;
  /** Area of each surface region, m^2, keyed by region id. */
  readonly regionAreas: Readonly<Record<string, number>>;
  /** The item's named orientations as quaternions. */
  readonly stablePoses: readonly InstancePose[];
}

// ---------------------------------------------------------------------------------------------
// Detergents and rinse aid
// ---------------------------------------------------------------------------------------------

/** Physical form of a detergent dose. */
export type DetergentForm = 'powder' | 'tablet' | 'pouch' | 'gel';

/** What an ingredient does in the wash. */
export type IngredientRole =
  | 'builder'
  | 'alkalinity'
  | 'bleach'
  | 'bleach_activator'
  | 'surfactant'
  | 'dispersant'
  | 'scale_inhibitor'
  | 'protease'
  | 'amylase'
  | 'glass_care'
  | 'rinse_function'
  | 'hydrotrope'
  | 'acid'
  | 'water';

/** One ingredient of a formulation. */
export interface Ingredient {
  readonly name: string;
  readonly role: IngredientRole;
  /** Share of the formulation by mass, percent. */
  readonly massPercent: number;
  readonly tag: Provenance;
  /** Range the source gives, percent. */
  readonly rangePercent?: readonly [number, number];
  /** Trade name or specification, where the source gives one. */
  readonly specification?: string;
}

/**
 * How much detergent goes into a wash: by the number of place settings loaded (the rule of the
 * test standard) or as one unit dose.
 */
export type DoseRule =
  | {
      readonly kind: 'per_place_setting';
      /** Fixed part of the dose, grams. */
      readonly baseG: number;
      /** Grams per place setting loaded, for machines rated at `smallMachineBelow` or more. */
      readonly perPlaceSettingG: number;
      /** Rated capacity (place settings) below which the small-machine rate applies. */
      readonly smallMachineBelow: number;
      /** Grams per place setting loaded for smaller machines. */
      readonly perPlaceSettingSmallG: number;
      readonly tag: Provenance;
      readonly source: string;
    }
  | {
      readonly kind: 'unit_dose';
      /** Mass of one tablet or pouch, grams. */
      readonly massG: number;
      readonly rangeG: readonly [number, number];
      readonly tag: Provenance;
      readonly source: string;
    };

/** A detergent formulation. */
export interface Detergent {
  /** Catalogue id, for example `iec_type_d`. */
  readonly id: string;
  readonly name: string;
  readonly form: DetergentForm;
  /** Ingredients; their mass percentages add up to 100. */
  readonly ingredients: readonly Ingredient[];
  readonly dose: DoseRule;
  /** What the formulation is and where its composition comes from. */
  readonly reference: string;
}

/** A rinse aid formulation. */
export interface RinseAid {
  /** Catalogue id, for example `iec_formula_iii`. */
  readonly id: string;
  readonly name: string;
  /** Ingredients; their mass percentages add up to 100. */
  readonly ingredients: readonly Ingredient[];
  /** Volume dosed into the final rinse per cycle, millilitres. */
  readonly doseMl: Sourced;
  /** True for an acidic formulation. */
  readonly acidic: boolean;
  readonly reference: string;
}
