/**
 * @spotless/integration. The loading chain exercised end to end with real catalogue data:
 * catalogue item types through the geometry kernel into the physics world, on a stand-in rack.
 *
 * The package is a test harness, not a layer of the platform; nothing depends on it. Its entry
 * point exposes what its tests and scripts share:
 *
 *  - `STAND_IN_RACK` and `buildStandInRack`: the stand-in rack, every dimension in one record;
 *  - `createLoadingScene`, `addItem`, `addFixture`, `lowerToContact`: a physics world with the
 *    rack, friction from the catalogue's pair table and catalogue items as bodies;
 *  - `loadPlates`, `loadNestedBowls`, `loadCutlery`, `loadMixedLoad`: the loads of the scenarios;
 *  - `slotFit`, `maxLeanInSlot`, `fitOverTines`, `flatDropVerdict`, `profileNestSpacing`,
 *    `kernelNestSpacing`: what the geometry implies, computed without the physics engine;
 *  - `overlapMeter`, `exactOverlap`: true overlap of collision pieces and of exact shapes;
 *  - `timeSteps`, `summariseStepTimes`: wall-clock cost of stepping;
 *  - `buildObj`: Wavefront OBJ export of posed shapes.
 */

export * from './stand-in-rack.ts';
export * from './scene.ts';
export * from './loads.ts';
export * from './rack-geometry.ts';
export * from './nest.ts';
export * from './overlap.ts';
export * from './timing.ts';
export * from './obj.ts';
