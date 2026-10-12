/**
 * Properties of water used by the lumped machine model. SI.
 *
 * The values are the ones both machine dossiers computed their tables with, so that the tables
 * can be reproduced: density 998 kg/m^3 in the hydraulic solve (docs/research/machine.md section
 * 12.2 and the scripts behind docs/research/machine-bosch-smv4hax40g.md section 3.3) and 4186 J
 * per litre and kelvin in the thermal balances (machine.md section 6.2: "15.9 kJ/K at 3.8 kg";
 * the Bosch dossier's hand check in section 4.5: "4.0 x 4.186 kJ/K").
 */

/** Density of water at about 20 degrees C, kg/m^3. */
export const WATER_DENSITY = 998;

/** Specific heat capacity of water, J/(kg K). */
export const WATER_SPECIFIC_HEAT = 4186;

/**
 * Heat capacity of water per unit volume as the dossiers' thermal balances count it, J/(m^3 K):
 * one kilogram per litre at 4186 J/(kg K). The 0.2 % by which this differs from
 * `WATER_DENSITY * WATER_SPECIFIC_HEAT` is far inside every tolerance of the thermal model.
 */
export const WATER_VOLUMETRIC_HEAT_CAPACITY = 4.186e6;

/** Kinematic viscosity of water at 20 degrees C, m^2/s (machine.md section 3.2). */
export const WATER_KINEMATIC_VISCOSITY_20C = 1.0e-6;
