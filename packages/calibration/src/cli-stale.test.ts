// The command line of the calibration refuses a stale parameter file as a wash does. (Review
// of the product, 2026-10-11: `spotless-fit predict --params anchored-v6.owner-capsule.json`
// ran a set that anchored-v7 had replaced with no refusal and no warning, while the wash, the
// server and the phenomena suite all refused it.)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const RECORD = 'records/owner/owner-wash-01-egg-yolk-eco50.measured.json';

function fit(args: readonly string[]): { status: number | null; err: string } {
  const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/spotless-fit.ts', ...args], {
    cwd: packageDir,
    encoding: 'utf8',
    env: { ...process.env, INIT_CWD: packageDir },
  });
  return { status: run.status, err: run.stderr };
}

describe('spotless-fit and a parameter set that another has replaced', () => {
  it('refuses it, naming what replaced it and how to use it knowingly', () => {
    const run = fit(['predict', RECORD, '--params', 'anchors/anchored-v6.owner-capsule.json']);
    expect(run.status).toBe(2);
    expect(run.err).toMatch(/anchored-v6\.owner-capsule\.json is stale/);
    expect(run.err).toMatch(/superseded: replaced by anchored-v7/);
    expect(run.err).toMatch(/--accept-stale-params/);
  }, 120_000);

  it('reads the current default set without complaint and says which parameters are in use', () => {
    // An override of a key that does not exist ends the command once the parameters are read:
    // what was said before that is what this test reads, without a wash.
    const current = fit([
      'predict',
      RECORD,
      '--params',
      'anchors/anchored-v8.owner-capsule.json',
      '--set',
      'no.such.key=1',
    ]);
    expect(current.status).not.toBe(0);
    expect(current.err).not.toMatch(/is stale|STALE/);
    expect(current.err).toMatch(/parameters: .*anchored-v8\.owner-capsule\.json/);
    // Accepted knowingly, the stale set is read and marked.
    const accepted = fit([
      'predict',
      RECORD,
      '--params',
      'anchors/anchored-v6.owner-capsule.json',
      '--accept-stale-params',
      '--set',
      'no.such.key=1',
    ]);
    expect(accepted.err).toMatch(/anchored-v6\.owner-capsule\.json \(STALE, accepted: superseded/);
    // With no --params the registry's defaults are used, and that is said.
    const bare = fit(['predict', RECORD, '--set', 'no.such.key=1']);
    expect(bare.err).toMatch(/parameters: the defaults of the registry \(no --params\)/);
  }, 120_000);
});
