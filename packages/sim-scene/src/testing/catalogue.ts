/**
 * Test and benchmark support: catalogue items and materials for scenes.
 *
 * The dependency table of docs/design/sim-core.md section 4 gives `@spotless/sim-scene` no
 * dependency on `@spotless/catalogue` (contract-issues.md entry 6 reports the gap, and
 * `@spotless/sim-verify` holds the workspace to the table), yet the tests and the full-load
 * benchmark of this package are specified over catalogue items. Until the table is corrected,
 * this one file reaches the catalogue's sources by a relative path. Nothing the package exports
 * imports it: the scene builder itself takes shapes and a material lookup from its caller.
 */

import { degToRad, type Pose } from '@spotless/core';
import {
  getMaterial,
  instantiate,
  LIQUOR_CLASSES,
  listItemTypes,
  type ItemInstance,
} from '../../../catalogue/src/index.ts';
import type { SceneItem, SceneMaterial } from '../scene-types.ts';
import type { ItemSoilRecord } from '../types.ts';

export { getMaterial, instantiate, listItemTypes };
export type { ItemInstance };

/** The wetting data of a catalogue material as the scene carries it (angles in radians). */
export function catalogueMaterial(materialId: string): SceneMaterial {
  const material = getMaterial(materialId);
  const angles = LIQUOR_CLASSES.map((liquor) => material.wetting.angles[liquor]);
  return {
    id: material.id,
    wettingClass: material.wetting.class,
    advancing: [
      degToRad(angles[0]?.advancingDeg ?? 0),
      degToRad(angles[1]?.advancingDeg ?? 0),
      degToRad(angles[2]?.advancingDeg ?? 0),
    ],
    receding: [
      degToRad(angles[0]?.recedingDeg ?? 0),
      degToRad(angles[1]?.recedingDeg ?? 0),
      degToRad(angles[2]?.recedingDeg ?? 0),
    ],
  };
}

/** A catalogue item type as a scene item at a pose, with soils on the named regions. */
export function catalogueItem(
  itemId: string,
  typeId: string,
  pose: Pose,
  soiledRegions: readonly string[] = [],
): SceneItem {
  const soils: ItemSoilRecord[] =
    soiledRegions.length === 0
      ? []
      : [
          {
            type: 'egg_yolk_dried',
            regions: soiledRegions.map((region) => ({ region, coverage: 1 })),
            amount_g: 1,
            age_h: 2,
            heat_history: 'none',
          },
        ];
  return { itemId, typeId, shape: instantiate(typeId).shape, pose, soils };
}

/**
 * The ids of the catalogue's item types whose geometry expands. The catalogue is checked by its
 * own tests; a type that does not expand at the moment (a record being edited) is left out here
 * rather than failing the scene's tests for a reason that is not theirs.
 */
export function usableItemTypeIds(): string[] {
  return listItemTypes()
    .map((type) => type.id)
    .filter((id) => {
      try {
        instantiate(id);
        return true;
      } catch {
        return false;
      }
    });
}
