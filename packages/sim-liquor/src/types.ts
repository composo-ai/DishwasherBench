/**
 * Contract of module M9, liquor, machine thermal nodes and drying air (docs/design/sim-core.md
 * section 4, "M9. Liquor, machine thermal nodes and drying air"): the well-mixed liquor of the
 * chemistry dossier's section 10, detergent release, acid-base and hardness, bleach and enzyme
 * species, soil in the liquor, filter, foam; the lumped thermal nodes of the machine; the tub
 * air during drying. CPU, f64.
 *
 * Types only. `RateTables` belongs to this module by the contract and is declared in
 * `@spotless/sim-params` (`shared.ts`), because the soil kernel of M8 reads it and may not
 * depend on M9; `MachineTick` (M4) and `SoilRelease` (M8), which `LiquorModel.step` takes, are
 * declared there for the same reason. All are re-exported from this package's entry point.
 *
 * Units: SI. Concentrations of molecular species are in mol/m3 (equivalents per m3 for
 * alkalinity), of products and soils in kg/m3 (section M9, "Equations"). The contract gives no
 * unit per field of `LiquorState`; the units stated below follow that rule and the state vector
 * of the chemistry dossier's section 10.1, and the fields for which that leaves a doubt are
 * reported as a contract issue.
 */

import type { LiquorClassId, MachineTick, RateTables, SoilRelease } from '@spotless/sim-params';

// ---------------------------------------------------------------------------------------------
// Inputs of a wash that the liquor model consumes
// ---------------------------------------------------------------------------------------------

/**
 * The detergent dose of a wash. `WashInput` (section M12) carries a `DetergentSpec` and the
 * contract never defines it; this is the smallest reading of what the release law of section M9
 * needs (m_0, the product form that selects the release constants, and the species x_j that a
 * kilogram of product releases), given that no simulation module may read the catalogue.
 * Reported as a contract issue.
 */
export interface DetergentSpec {
  /** Catalogue detergent id, for example `iec_type_d`. */
  readonly id: string;
  /** Product form; selects the release constants. */
  readonly form: 'powder' | 'tablet' | 'pouch' | 'gel';
  /** Mass of the dose m_0, kg. */
  readonly mass_kg: number;
  /**
   * What one kilogram of product releases, by species key: mol/kg for molecular species, kg/kg
   * for products. The contract does not enumerate the species keys.
   */
  readonly composition: Readonly<Record<string, number>>;
}

/**
 * The rinse-aid dose of a wash; named by `WashInput` and never defined by the contract (see
 * {@link DetergentSpec}).
 */
export interface RinseAidSpec {
  /** Catalogue rinse-aid id. */
  readonly id: string;
  /** Volume dosed into the final rinse, m3. */
  readonly volume_m3: number;
  /** What one cubic metre of rinse aid releases, by species key: mol/m3 or kg/m3. */
  readonly composition: Readonly<Record<string, number>>;
}

/**
 * The water supply of a wash; named by `WashInput` and never defined by the contract (see
 * {@link DetergentSpec}). The fill equation of section M9 needs its temperature and the
 * concentrations c_j,supply (hardness, bicarbonate).
 */
export interface SupplySpec {
  /** Temperature of the supply water, kelvin. */
  readonly T_K: number;
  /** Concentrations in the supply water by species key: mol/m3 or kg/m3. */
  readonly composition: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------------------------
// State and exchanges
// ---------------------------------------------------------------------------------------------

/**
 * The liquor as the other modules see it (section M9): the sump and everything in circulation
 * as one well-mixed tank. Returned by every `step`, and used for the end-of-phase liquors of
 * the fill-fraction mixture and for the liquor of pools and gaps.
 */
export interface LiquorState {
  /** Liquor volume V_w, m3. */
  readonly V_m3: number;
  /** Liquor temperature T_w, kelvin. */
  readonly T_K: number;
  /** pH (derived from alkalinity, total carbonate and temperature). */
  readonly pH: number;
  /** Liquor class. */
  readonly cls: LiquorClassId;
  /** Surface tension, N/m. */
  readonly sigma_N_m: number;
  /** Kinematic viscosity, m2/s. */
  readonly nu_m2_s: number;
  /** Density, kg/m3. */
  readonly rho_kg_m3: number;
  /** Alkalinity Alk, eq/m3 (conserved; mixed linearly). */
  readonly alkalinity: number;
  /** Total carbonate C_carb, mol/m3 (conserved; mixed linearly). */
  readonly carbonate: number;
  /** Active protease E_P, kg/m3 (granulate-equivalent mass). */
  readonly protease: number;
  /** Active amylase E_A, kg/m3 (granulate-equivalent mass). */
  readonly amylase: number;
  /** Total peracetic acid PAA, mol/m3. */
  readonly paa: number;
  /** Perhydroxyl anion HOO-, mol/m3: f_HOO times the total hydrogen peroxide. */
  readonly hoo: number;
  /** Dissolved nonionic surfactant, kg/m3; the liquor is class D above `liq.surfClass`. */
  readonly surfactant: number;
  /** Free chelant capacity, mol/m3 (as Ca equivalents). */
  readonly chelantFree: number;
  /** Free calcium Ca_free, mol/m3. */
  readonly caFree: number;
  /** Free (unstabilised) fat C_fat,free, kg/m3. */
  readonly fatFree: number;
  /** Suspended fines (20 to 150 um), kg/m3. */
  readonly fines: number;
  /** Suspended grit (150 to 1000 um), kg/m3. */
  readonly grit: number;
  /** Total dissolved solids, kg/m3. */
  readonly tds: number;
  /** Dissolved soil (protein, carbohydrate and other dissolved solids), kg/m3. */
  readonly dissolved: number;
  /** Foam state, 0 to 1. */
  readonly foam: number;
  /** Soil mass held on the filter M_filt, kg. */
  readonly filterLoad: number;
  /** Undissolved detergent mass m_tab, kg. */
  readonly tabletLeft_kg: number;
}

/** Number of fields of {@link LiquorState}. */
export const LIQUOR_STATE_FIELDS = 24;

/** State of the detergent dose (sections M9 and M10, "Tablet supply"). */
export type TabletState = 'closed' | 'released' | 'stuck';

/** Every {@link TabletState}. */
export const TABLET_STATES: readonly TabletState[] = ['closed', 'released', 'stuck'];

/** What the timeline tells the release law about the tablet each tick (sections M9, M10). */
export interface TabletSupply {
  /**
   * `closed` before the dispenser opens; `released` once the tablet lies in the machine;
   * `stuck` behind a lid that cannot open, where it releases at `liq.wStuck`.
   */
  readonly state: TabletState;
  /**
   * Wetting factor w_tab of the release law, 0 to 1: min(1, q_tab / q_ref), evaluated by M10 on
   * the tablet's resting place.
   */
  readonly wTab: number;
  /** Where the released species go: the sump, or the reservoir (by index) the tablet rests in. */
  readonly into: 'sump' | { readonly reservoir: number };
}

/** What left the liquor onto surfaces during a tick (sections M9 and M10). */
export interface DepositSinks {
  /** Fines stranded or settled, kg. */
  readonly fines_kg: number;
  /** Grit stranded or settled, kg. */
  readonly grit_kg: number;
  /** Fat deposited, kg. */
  readonly fat_kg: number;
  /** Dissolved solids left as residue, kg. */
  readonly dissolved_kg: number;
  /** Water left on surfaces and carried over, kg. */
  readonly water_kg: number;
}

/** The liquor model (section M9). */
export interface LiquorModel {
  /**
   * Advances the liquor through one tick (0.25 s sub-steps with exact exponentials for the
   * stiff relaxations). The coupling to the soil is explicit with one tick of lag: `release`,
   * `heatToLoad_J` (heat taken up by the load, joules), `tablet`, `deposits` and `exchange` are
   * those of the previous tick. `exchange.fromReservoirs` holds the species arriving with the
   * spill of basins and the exchange of gaps; the contract fixes neither their order nor their
   * unit.
   */
  step(
    tick: MachineTick,
    release: SoilRelease,
    heatToLoad_J: number,
    tablet: TabletSupply,
    deposits: DepositSinks,
    exchange: { readonly fromReservoirs: Float64Array },
  ): LiquorState;
  /** The rate tables for block temperatures from `TminK` to `TmaxK`, kelvin. */
  rateTables(TminK: number, TmaxK: number): RateTables;
  /**
   * The end-of-phase liquor of a fill, for the fill-fraction mixture: 0 pre-rinse, 1 main wash,
   * 2 intermediate rinses, 3 final rinse.
   */
  fillComposition(fill: 0 | 1 | 2 | 3): LiquorState;
  /**
   * A mixture: linear in conserved quantities, with the pH re-solved; used for pools and gaps.
   * The fractions sum to 1.
   */
  mix(parts: readonly { readonly liquor: LiquorState; readonly fraction: number }[]): LiquorState;
  /**
   * The tub air and the condensing walls (drying air model of section M9): air temperature
   * (K), vapour density (kg/m3), tub wall temperature (K) and heat-exchanger wall temperature
   * (K).
   */
  air(): {
    /** Temperature of the tub air, kelvin. */
    readonly T_K: number;
    /** Vapour density of the tub air, kg/m3. */
    readonly rhoV: number;
    /** Temperature of the tub wall, kelvin. */
    readonly T_wall_K: number;
    /** Temperature of the heat-exchanger wall, kelvin. */
    readonly T_hx_K: number;
  };
}
