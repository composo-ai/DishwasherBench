/**
 * @spotless/catalogue. The data that describes the physical world of the game, with loaders and
 * validation: materials, friction and restitution pairs, item types, soil identities,
 * detergents and rinse aid.
 *
 *  - `getMaterial`, `listMaterials`: density, contact key, thermal properties, wetting and
 *    service limits of every material, with the confidence tag of every number;
 *  - `frictionPair(a, b, wet)` and `contactPairLookup(wet)`: the pair table the physics package
 *    looks contact coefficients up in;
 *  - `getItemType`, `listItemTypes`: the item types of the starter catalogue, authored in
 *    millimetres and grams;
 *  - `instantiate(itemTypeId)`: an item type as an SI `Shape` with its mass properties, contact
 *    material, bounding box, region areas and named poses (`instantiateItemType` does the same
 *    for a record that is not in the catalogue);
 *  - `getSoil`, `listSoils`, `describeSoil`: soil identities and how they are described;
 *  - `getDetergent`, `listDetergents`, `detergentDoseG`, `getRinseAid`;
 *  - `staticStability`, `jetMobilityNumber`: checks derived from an item's shape and mass;
 *  - `validateCatalogue()`: every consistency check, as a list of problems (empty when sound),
 *    with `validateItemType`, `validateMaterial` and `validateSoilType` for single records.
 *
 * Sources and confidence tags are those of the dossiers in docs/research.
 */

export * from './types.ts';
export {
  CONTINUOUS_FILM_MAX_RECEDING_CLEAN_WATER_DEG,
  CONTINUOUS_FILM_MAX_RECEDING_MAIN_WASH_DEG,
  getMaterial,
  hasMaterial,
  listMaterials,
  materialDensity,
  RIVULET_MIN_RECEDING_MAIN_WASH_DEG,
  WATER_DENSITY_60C,
  wettingClassOf,
} from './materials.ts';
export {
  contactKeyPair,
  contactPairLookup,
  frictionPair,
  PVC_RACK_FRICTION_FACTOR,
  RESTITUTION_VELOCITY_THRESHOLD,
  ROLLING_RESISTANCE_LENGTH_HARD,
  ROLLING_RESISTANCE_LENGTH_ON_WIRE,
  rollingResistanceLength,
  SPIN_FRICTION_LENGTH,
} from './contact.ts';
export {
  bodyMaterialOf,
  getItemType,
  hasItemType,
  instantiate,
  INSTANTIATE_SCALE_RANGE,
  instantiateItemType,
  itemDimensionsMm,
  itemProvenance,
  listItemTypes,
  partMaterialOf,
  poseQuaternion,
} from './catalogue.ts';
export { DEFAULT_POINTS } from './items/builders.ts';
export { massPropertiesOf, measureDimensionMm, scaleShape } from './shape-util.ts';
export {
  lowestPoint,
  restingComHeight,
  STABILITY_DIRECTIONS,
  STABILITY_MIN_RISE,
  STABILITY_PROBE_TILT,
  staticStability,
  type StaticStability,
} from './stability.ts';
export {
  CONCAVE_TURNING_FACTOR,
  isJetMobile,
  JET_MOBILE_THRESHOLD,
  JET_WATER_DENSITY,
  jetMobilityNumber,
  jetMomentumFlux,
} from './mobility.ts';
export {
  describeSoil,
  formatSoilAge,
  getSoil,
  hasSoil,
  IKW_BALLAST_SOIL,
  listSoils,
  type BallastIngredient,
  type SoilDescriptionInput,
} from './soils.ts';
export {
  dryLoadingGPerM2,
  SOIL_APPEARANCES,
  SOIL_WORKING,
  type SoilAppearance,
  type SoilLaidOn,
  type SoilWorkingQuantity,
} from './soil-working.ts';
export {
  detergentDoseG,
  GENERIC_TABLET,
  getDetergent,
  getRinseAid,
  IEC_RINSE_AID_III,
  IEC_TYPE_D,
  ingredientConcentrationsGPerL,
  listDetergents,
  listRinseAids,
} from './detergents.ts';
export {
  DIMENSION_TOLERANCE_MM,
  ESTIMATED_MASS_TOLERANCE,
  RACK_MATERIALS,
  RESTING_PLANE_TOLERANCE_MM,
  STEADY_POSE_MIN_TIP_DEG,
  validateCatalogue,
  validateItemType,
  validateMaterial,
  validateSoilType,
  VERIFIED_MASS_TOLERANCE,
  type CatalogueIssue,
} from './validate.ts';
