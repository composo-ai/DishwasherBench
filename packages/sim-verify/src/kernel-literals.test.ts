// The stage kernels of the first build hold no physical literal (docs/design/platform.md,
// "every physical constant is a registered parameter"; review of the first build): the files
// that compute exposure, liquor, soil and the replay are scanned with the literal lint of
// `@spotless/sim-params`. What is left in them is marked `literal-ok` with its reason: unit
// conversions, buffer sizes, arithmetic tolerances and sampling patterns.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintLiterals } from '@spotless/sim-params';
import { describe, expect, it } from 'vitest';

const packages = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The files whose arithmetic decides a wash result. */
const KERNELS = [
  'sim-jets/src/jet-stage.ts',
  'sim-spray/src/spray-stage.ts',
  'sim-film/src/cascade.ts',
  'sim-film/src/surface-stage.ts',
  'sim-liquor/src/liquor.ts',
  'sim-soil/src/kinetics.ts',
  'sim-soil/src/soil.ts',
  'sim-timeline/src/replay.ts',
] as const;

describe('the stage kernels', () => {
  it.each(KERNELS)('%s holds no literal the lint does not allow', (file) => {
    const text = readFileSync(join(packages, file), 'utf8');
    const findings = lintLiterals(text, 'ts').map((f) => `${file}:${f.line}: ${f.literal}`);
    expect(findings).toEqual([]);
  });

  it('gives a reason with every literal it keeps', () => {
    for (const file of KERNELS) {
      const text = readFileSync(join(packages, file), 'utf8');
      for (const line of text.split('\n')) {
        const at = line.indexOf('literal-ok-begin');
        if (at < 0) continue;
        // `literal-ok-begin: <reason>`
        expect(line.slice(at), file).toMatch(/^literal-ok-begin: \S.{10,}/);
      }
    }
  });

  it('would catch a physical constant typed into one of them', () => {
    // The same lint on a line that hard-codes a film thickness and a shear level.
    const findings = lintLiterals('const h = 100e-6;\nconst tau = 2.8 * h;\n', 'ts');
    expect(findings.map((f) => f.literal)).toEqual(['100e-6', '2.8']);
  });
});
