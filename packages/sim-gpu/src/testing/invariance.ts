/**
 * Helper for the invariance tests every kernel must pass (docs/design/sim-core.md section 6,
 * rule 18): the same computation run with its inputs shuffled, with another workgroup size and
 * with another batching must give identical bytes.
 */

import { firstDifferentByte } from '../hash.ts';

/**
 * Runs each variant in turn and returns the names of those whose bytes differ from the first
 * variant's, with the index of the first differing byte: an empty list means invariance.
 */
export async function differingVariants(
  variants: Readonly<Record<string, () => Promise<ArrayBuffer | ArrayBufferView>>>,
): Promise<{ readonly name: string; readonly firstByte: number }[]> {
  const names = Object.keys(variants);
  const differing: { name: string; firstByte: number }[] = [];
  let reference: ArrayBuffer | ArrayBufferView | null = null;
  for (const name of names) {
    const bytes = await (variants[name] as () => Promise<ArrayBuffer | ArrayBufferView>)();
    if (reference === null) {
      reference = bytes;
      continue;
    }
    const firstByte = firstDifferentByte(reference, bytes);
    if (firstByte !== -1) differing.push({ name, firstByte });
  }
  return differing;
}
