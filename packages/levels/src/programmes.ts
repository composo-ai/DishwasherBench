/**
 * Which programme the game is scored on, which others the wash can be run on for research, and
 * what is put in the dispenser.
 *
 * Decision of 10 October 2026 (docs/reference/owner-measurements.md, last sections): the game
 * is scored on Eco 50. It is a fixed, printed programme (4 h 55 min, 9.5 L, 0.836 kWh, a wash
 * at 50 degrees C, no sensor decisions), the only regime with a published quantitative result
 * on a sister machine for the wash simulation to be anchored to, and at 50 degrees C the
 * detergent's enzymes survive whatever their grade.
 *
 * Decision of 11 October 2026, after the first play test found remnants of the Auto cycle in
 * the interface: no level of the game offers another programme.
 * A level card lists no secondary programme, `start_cycle` accepts none, and no text a player
 * or an agent reads names one. Auto 45-65 stays a programme of the machine that the wash
 * command line runs for research (`wash-load.ts --programme auto_145`, `reference-table
 * --programme auto_145`); the wash simulation is not calibrated for it and says so there.
 *
 * The detergent is the owner's: one capsule of Finish Powerball Ultimate, 12.9 g
 * (docs/research/detergent-finish-ultimate.md). The wash runner washes the owner's machine
 * with it (`MACHINE_WASH_DEFAULTS` of `@spotless/wash-runner`, which stands above this package
 * and is held equal to what is said here by a test of `@spotless/bench`). His rinse aid is
 * recorded there and is not modelled.
 */

/** The programme every level of the game is scored on. */
export const GAME_PROGRAMME_ID = 'eco_50';

/**
 * Programmes a level of the game offers beside the scored one: none. (Until 11 October 2026:
 * Auto 45-65.) A research level may still name programmes in `Level.secondaryProgrammes`.
 */
export const SECONDARY_PROGRAMME_IDS: readonly string[] = [];

/**
 * Programmes of the owner's machine the wash can be run on from the command line for research,
 * beside the scored one. None of them is calibrated, and none is offered to a player.
 */
export const RESEARCH_PROGRAMME_IDS: readonly string[] = ['auto_145'];

/** What a report says about a programme the wash simulation is not calibrated for. */
export const UNCALIBRATED_PROGRAMME_NOTE =
  'Uncalibrated. The wash simulation is anchored to published results of an Eco programme and to nothing on this one: its verdicts here, above all on egg, meat, cheese, heated milk, tea, coffee and wine, are provisional. A wash on this programme is reported and labelled, and is not a benchmark result.';

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
