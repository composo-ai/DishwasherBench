/**
 * Which programme the game is scored on, and what is put in the dispenser.
 *
 * Decision of 10 October 2026 (docs/reference/owner-measurements.md, last sections): the game
 * is scored on Eco 50. It is a fixed, printed programme (4 h 55 min, 9.5 L, 0.836 kWh, a wash
 * at 50 degrees C, no sensor decisions), the only regime with a published quantitative result
 * on a sister machine for the wash simulation to be anchored to, and at 50 degrees C the
 * detergent's enzymes survive whatever their grade. It is the only programme the simulation
 * washes on; the others of the machine are out of scope (docs/design/scope.md).
 *
 * The detergent is the owner's: one capsule of Finish Powerball Ultimate, 12.9 g
 * (docs/research/detergent-finish-ultimate.md). The wash runner washes the owner's machine
 * with it (`MACHINE_WASH_DEFAULTS` of `@spotless/wash-runner`, which stands above this package
 * and is held equal to what is said here by a test of `@spotless/bench`). His rinse aid is
 * recorded there and is not modelled.
 */

/** The programme every level of the game is scored on. */
export const GAME_PROGRAMME_ID = 'eco_50';

/** What a player is told about the scored programme. */
export const SCORED_PROGRAMME_NOTE =
  'The programme the level is scored on: fixed and printed, no sensor decisions.';

/** The detergent of a machine: what the level card names and the wash is run with. */
export interface GameDetergent {
  /** Identifier for the card (`ProgrammeCard.detergent.type`). */
  readonly type: string;
  /** Name of the product, as on the pack. */
  readonly name: string;
  /** Mass of one dose, grams. */
  readonly doseG: number;
}

/** The detergent each machine of the game is washed with, by machine id. */
export const GAME_DETERGENTS: Readonly<Record<string, GameDetergent>> = {
  bosch_smv4hax40g: {
    type: 'finish_powerball_ultimate',
    name: 'Finish Powerball Ultimate',
    doseG: 12.9,
  },
};
