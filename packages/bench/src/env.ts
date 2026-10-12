/**
 * The local environment file of the repository (`.env` at its root, ignored by git): where the
 * address and the key of a model's API are kept for runs from this checkout. The command line
 * loads it before anything else; a variable that is already set in the environment wins.
 *
 * Nothing here prints a value: what is reported is the names of the variables that were set.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The `.env` of this repository (three directories above this file). */
export const REPOSITORY_ENV_FILE = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  '..',
  '..',
  '.env',
);

/** The variables of an environment file: `NAME=value` lines; `#` comments; optional quotes. */
export function parseEnvFile(text: string): { [name: string]: string } {
  const out: { [name: string]: string } = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    let value = (match[2] ?? '').trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      // An unquoted value ends at a comment that follows white space.
      value = value.replace(/\s+#.*$/, '');
    }
    out[match[1] as string] = value;
  }
  return out;
}

/**
 * Sets the variables of an environment file that the environment does not have yet. Returns
 * the names it set (never the values); an absent file sets nothing.
 */
export function loadEnvFile(
  file: string = REPOSITORY_ENV_FILE,
  env: { [name: string]: string | undefined } = process.env,
): string[] {
  if (!existsSync(file)) return [];
  const set: string[] = [];
  for (const [name, value] of Object.entries(parseEnvFile(readFileSync(file, 'utf8')))) {
    if (env[name] !== undefined && env[name] !== '') continue;
    env[name] = value;
    set.push(name);
  }
  return set;
}
