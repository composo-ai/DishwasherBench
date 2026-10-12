/**
 * Provenance of machine data.
 *
 * Every group of values in a machine description carries one {@link Provenance} record: where the
 * values come from and how far they can be trusted. The tags are those of the machine dossiers
 * (docs/research/machine-bosch-smv4hax40g.md section 3: V, S, P, E, G) and of the owner's
 * measurements (docs/research/machine-bosch-owner-update.md section 0: M, C, P, E), so that
 * calibration can replace estimates one at a time and nothing estimated is mistaken for a
 * measurement.
 */

/**
 * How a value was obtained, strongest first:
 * - `measured`: measured on the machine itself by its owner with a tape measure or a gauge
 *   (tag M of the owner update). The note gives the reading error, and says so where the
 *   measurement is stacked on a datum that is itself only estimated;
 * - `verified`: stated for this machine in a document, on a part page for a part in its parts
 *   list, or counted or observed on the owner's photographs (dossier tag V; tag C of the owner
 *   update);
 * - `sister`: taken from a sister model, a sister part, a platform service manual or a patent of
 *   the same maker (S). The source says so; this machine may differ;
 * - `photo`: a length or an angle scaled from a photograph, with the error its source states (P);
 * - `estimated`: a derivation, an engineering judgement or a tuned placeholder (E);
 * - `generic`: the generic SPOT-60 value of docs/research/machine.md, kept because nothing
 *   better exists (G).
 */
export type ProvenanceTag = 'measured' | 'verified' | 'sister' | 'photo' | 'estimated' | 'generic';

/** Every {@link ProvenanceTag}, strongest first. */
export const PROVENANCE_TAGS: readonly ProvenanceTag[] = [
  'measured',
  'verified',
  'sister',
  'photo',
  'estimated',
  'generic',
];

/**
 * Where a group of values comes from.
 *
 * `tag` applies to every field of the group that `fields` does not list. `fields` overrides it
 * for individual fields, keyed by the field's name in the SI type (`tipRadius`, not
 * `tipRadiusMm`); a key may also name a nested field with a dot (`pump.shutOffHead`). The record
 * is unit-free and is copied unchanged from an authoring definition to the loaded specification.
 */
export interface Provenance {
  /** Tag of every field not listed in `fields`. */
  readonly tag: ProvenanceTag;
  /** Dossier and section the values are transcribed from, and the original source where known. */
  readonly source: string;
  /** Per-field tags where they differ from `tag`. */
  readonly fields?: Readonly<Record<string, ProvenanceTag>>;
  /** Stated errors and ranges, what the value was derived from, and what would replace it. */
  readonly note?: string;
}

/** True when `tag` is one of {@link PROVENANCE_TAGS}. */
export function isProvenanceTag(tag: unknown): tag is ProvenanceTag {
  return typeof tag === 'string' && (PROVENANCE_TAGS as readonly string[]).includes(tag);
}

/**
 * The tag that applies to one field of a group: the entry of `fields` for it when there is one,
 * otherwise the group's tag.
 */
export function provenanceTagOf(provenance: Provenance, field: string): ProvenanceTag {
  return provenance.fields?.[field] ?? provenance.tag;
}

/**
 * The weakest tag anywhere in a provenance record (the group tag and every field tag), in the
 * order of {@link PROVENANCE_TAGS}. Useful for reporting how much of a group is fact.
 */
export function weakestProvenanceTag(provenance: Provenance): ProvenanceTag {
  let worst = PROVENANCE_TAGS.indexOf(provenance.tag);
  if (provenance.fields !== undefined) {
    for (const key of Object.keys(provenance.fields).sort()) {
      const tag = provenance.fields[key];
      if (tag !== undefined) worst = Math.max(worst, PROVENANCE_TAGS.indexOf(tag));
    }
  }
  return PROVENANCE_TAGS[worst] ?? provenance.tag;
}
