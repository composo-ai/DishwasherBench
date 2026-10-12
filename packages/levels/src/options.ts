/**
 * The adjustable features of a machine's racks as the `set_rack` action sees them: the height
 * of a height-adjustable basket, hinged tine rows, folding cup shelves and holders, and where
 * the loose cutlery basket stands. Derived from the machine specification, so a machine
 * without a feature offers no option for it.
 *
 * (Whether a rack is pushed in or pulled out is the fourth option, `position`; it is state of
 * the session, not of the machine configuration, and is added by the level card and handled by
 * the session.)
 */

import type {
  BasketSpec,
  CutleryBasketPlacement,
  MachineConfig,
  MachineSpec,
} from '@spotless/machine';
import {
  basketHeightPosition,
  cutleryBasketPositionId,
  cutleryBasketPositions,
  isTineRowFolded,
  shelfState,
} from '@spotless/machine';
import type { RackId } from './card-types.ts';

/** What an option changes in the machine configuration. */
export type RackOptionKind = 'height' | 'tine_row' | 'shelf' | 'cutlery_basket';

/** Value of the cutlery basket's `position` option when the basket is taken out of the machine. */
export const CUTLERY_BASKET_OUT = 'out';
/** Value of that option when the basket stands somewhere that has no name (level data only). */
export const CUTLERY_BASKET_ELSEWHERE = 'elsewhere';

/** One adjustable feature of a rack with its current value. */
export interface RackOption {
  /** The rack frame of the basket. */
  readonly rack: RackId;
  /** Basket id of the machine specification. */
  readonly basketId: string;
  /**
   * Option name: `height`, `tine_row_<row id>` or `shelf_<shelf id>`; `position` for the
   * cutlery basket (rack `cutlery_basket`).
   */
  readonly name: string;
  readonly kind: RackOptionKind;
  /** Id of the height position list (the basket id), of the tine row or of the shelf. */
  readonly targetId: string;
  /** What the option does, in words. */
  readonly description: string;
  /** Allowed values. */
  readonly values: readonly string[];
  /** Current value in the configuration. */
  readonly value: string;
  /**
   * For the cutlery basket: where each value stands it, null for the value that takes it out
   * of the machine.
   */
  readonly placements?: { readonly [value: string]: CutleryBasketPlacement | null };
}

function mm(metres: number): string {
  return `${Math.round(metres * 1000)} mm`;
}

function optionsOfBasket(
  spec: MachineSpec,
  config: MachineConfig,
  basket: BasketSpec,
): RackOption[] {
  const out: RackOption[] = [];
  const rack: RackId = basket.frame;
  const heights = basket.pose.heightPositions;
  if (heights.length > 1) {
    const current = basketHeightPosition(spec, basket.id, config.basketHeights);
    out.push({
      rack,
      basketId: basket.id,
      name: 'height',
      kind: 'height',
      targetId: basket.id,
      description:
        `Height position of the basket. The top of its base grid is ` +
        heights.map((p) => `${mm(p.originZ)} above the tub floor at '${p.id}'`).join(', ') +
        `. Whatever is in the basket travels with it.`,
      values: heights.map((p) => p.id),
      value: current.id,
    });
  }
  for (const row of basket.tineRows) {
    if (row.hinge === null) continue;
    out.push({
      rack,
      basketId: basket.id,
      name: `tine_row_${row.id}`,
      kind: 'tine_row',
      targetId: row.id,
      description: `Hinged tine row ${row.label}: standing up to hold plates, or folded flat to make room for pots and bowls.`,
      values: ['up', 'folded'],
      value: isTineRowFolded(spec, config, basket.id, row.id) ? 'folded' : 'up',
    });
  }
  for (const shelf of basket.cupShelves) {
    out.push({
      rack,
      basketId: basket.id,
      name: `shelf_${shelf.id}`,
      kind: 'shelf',
      targetId: shelf.id,
      description: `Folding cup shelf '${shelf.id}': up against the side of the basket, or down as a second level for cups and a rest for stemware.`,
      values: ['up', 'down'],
      value: shelfState(spec, config, basket.id, shelf.id),
    });
  }
  for (const holder of basket.holders) {
    if (!holder.folds) continue;
    out.push({
      rack,
      basketId: basket.id,
      name: `shelf_${holder.id}`,
      kind: 'shelf',
      targetId: holder.id,
      description: `Folding holder '${holder.id}' (${holder.kind.replace(/_/g, ' ')}): folded up out of the way, or down for long knives and utensils laid flat.`,
      values: ['up', 'down'],
      value: shelfState(spec, config, basket.id, holder.id),
    });
  }
  return out;
}

/**
 * Where the loose cutlery basket stands, as an option of the rack `cutlery_basket`: one value
 * per named position of the machine that is possible with the rows folded as they are, and
 * `out` for the basket taken out of the machine. None for a machine without a cutlery basket.
 */
function cutleryBasketOption(spec: MachineSpec, config: MachineConfig): RackOption[] {
  const cutlery = spec.cutleryBasket;
  if (cutlery === null) return [];
  const positions = cutleryBasketPositions(spec, config);
  const placements: { [value: string]: CutleryBasketPlacement | null } = {};
  for (const position of positions) placements[position.id] = position.placement;
  placements[CUTLERY_BASKET_OUT] = null;
  const current =
    config.cutleryBasket === null
      ? CUTLERY_BASKET_OUT
      : (cutleryBasketPositionId(spec, config) ?? CUTLERY_BASKET_ELSEWHERE);
  const basketId = config.cutleryBasket?.basketId ?? cutlery.defaultPlacement.basketId;
  return [
    {
      rack: 'cutlery_basket',
      basketId,
      name: 'position',
      kind: 'cutlery_basket',
      targetId: 'cutlery_basket',
      description:
        `Where the loose cutlery basket stands in the lower basket: ` +
        positions
          .map(
            (p) =>
              `'${p.id}' (${p.label}, its centre at x ${mm(p.placement.centre[0])}, y ${mm(p.placement.centre[1])} of the rack frame)`,
          )
          .join(', ') +
        `, or '${CUTLERY_BASKET_OUT}' when it is taken out of the machine. It can only be moved while it is empty and where nothing stands in its way; the tine slots it stands over cannot be used.`,
      values: [...positions.map((p) => p.id), CUTLERY_BASKET_OUT],
      value: current,
      placements,
    },
  ];
}

/**
 * Every adjustable feature of the machine's racks in a configuration, baskets from the lowest,
 * the cutlery basket last.
 */
export function rackOptions(spec: MachineSpec, config: MachineConfig): RackOption[] {
  return [
    ...spec.baskets.flatMap((basket) => optionsOfBasket(spec, config, basket)),
    ...cutleryBasketOption(spec, config),
  ];
}

/**
 * The configuration with one option set to a value. Throws a RangeError for a value the option
 * does not allow: the session checks player input first and reports `unknown_option`.
 */
export function applyRackOption(
  config: MachineConfig,
  option: RackOption,
  value: string,
): MachineConfig {
  if (!option.values.includes(value)) {
    throw new RangeError(`levels: option '${option.name}' has no value '${value}'`);
  }
  if (option.kind === 'height') {
    return { ...config, basketHeights: { ...config.basketHeights, [option.basketId]: value } };
  }
  if (option.kind === 'cutlery_basket') {
    return { ...config, cutleryBasket: option.placements?.[value] ?? null };
  }
  if (option.kind === 'tine_row') {
    const others = config.foldedTineRows.filter(
      (r) => !(r.basketId === option.basketId && r.rowId === option.targetId),
    );
    return {
      ...config,
      foldedTineRows:
        value === 'folded'
          ? [...others, { basketId: option.basketId, rowId: option.targetId }]
          : others,
    };
  }
  const others = config.shelves.filter(
    (s) => !(s.basketId === option.basketId && s.shelfId === option.targetId),
  );
  return {
    ...config,
    shelves: [
      ...others,
      {
        basketId: option.basketId,
        shelfId: option.targetId,
        state: value === 'up' ? 'up' : 'down',
      },
    ],
  };
}
