/**
 * Readers of the design contract itself (docs/design/sim-core.md), so that tests can compare
 * the code with what the document states instead of with a second transcription of it: the
 * dependency table of section 4, the sizes it states for binary records, its offset tables and
 * the interfaces of its `ts` code blocks.
 *
 * Pure functions of the Markdown text; reading the file is left to the caller, so nothing here
 * needs a file system.
 */

// ---------------------------------------------------------------------------------------------
// The dependency table of section 4
// ---------------------------------------------------------------------------------------------

/** One row of the module table of section 4. */
export interface ContractModuleRow {
  /** Module id, `M1` to `M13`. */
  readonly id: string;
  /** Package name without the scope, for example `sim-gpu`. */
  readonly package: string;
  /** The "Depends on" cell, split at commas: module ids, platform package names, or `all`. */
  readonly dependsOn: readonly string[];
}

/** The rows of the module table of section 4 ("| Id | Package | ... | Depends on |"). */
export function extractModuleTable(markdown: string): ContractModuleRow[] {
  const rows: ContractModuleRow[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^\| (M\d+) \| `@spotless\/([\w-]+)` \|.*\| ([^|]+) \|\s*$/.exec(line);
    if (!match) continue;
    rows.push({
      id: match[1] as string,
      package: match[2] as string,
      dependsOn: (match[3] as string).split(',').map((cell) => cell.trim()),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Stated record sizes
// ---------------------------------------------------------------------------------------------

/** A record size as the contract states it. */
export interface StatedSize {
  /** The record name as written, for example `FilmExposure`. */
  readonly name: string;
  /** The stated size, bytes. */
  readonly bytes: number;
  /** The words that state it. */
  readonly source: string;
}

/**
 * Every record size the contract states in one of its three forms: "`Name`, N bytes" in prose;
 * "### 5.x Name: N bytes" in a heading; "| `Name` (per ...) | N |" in the buffer table of
 * section M7.8.
 */
export function extractStatedSizes(markdown: string): StatedSize[] {
  const sizes: StatedSize[] = [];
  for (const line of markdown.split('\n')) {
    for (const match of line.matchAll(/`(\w+)`, (\d+) bytes/g)) {
      sizes.push({ name: match[1] as string, bytes: Number(match[2]), source: match[0] });
    }
    const heading = /^### \d+\.\d+ (\w+): (\d+) bytes/.exec(line);
    if (heading) {
      sizes.push({ name: heading[1] as string, bytes: Number(heading[2]), source: heading[0] });
    }
    const row = /^\| `(\w+)` \(per [^)]*\) \| (\d+) \|/.exec(line);
    if (row) sizes.push({ name: row[1] as string, bytes: Number(row[2]), source: row[0] });
  }
  return sizes;
}

// ---------------------------------------------------------------------------------------------
// Offset tables
// ---------------------------------------------------------------------------------------------

/** One row of an offset table ("| Offset | Field | Type | ..."). */
export interface OffsetRow {
  /** The byte offset the row states. */
  readonly offset: number;
  /** The "Field" cell. */
  readonly field: string;
  /** The "Type" cell. */
  readonly type: string;
  /**
   * The scalar storage types the "Type" cell expands to, in byte order: `f32`, `u32`, `i32`,
   * `f16`, `u16`, `i16`, `u8`, `log8`, or `pad` for a byte of an "N bytes" cell.
   */
  readonly scalars: readonly string[];
  /** Number of bytes the row covers. */
  readonly bytes: number;
}

const SCALAR_BYTES: Readonly<Record<string, number>> = {
  f32: 4,
  u32: 4,
  i32: 4,
  f16: 2,
  u16: 2,
  i16: 2,
  u8: 1,
  log8: 1,
  pad: 1,
};

/** Expands one item of a type cell, such as `vec3 f32`, `log u8`, `u8 / 255` or `name u8`. */
function expandTypeItem(item: string): string[] {
  const text = item.replace(/\/\s*[\d,]+/, '').trim();
  const bytes = /^(\d+) bytes$/.exec(text);
  if (bytes) return new Array<string>(Number(bytes[1])).fill('pad');
  if (/\bvec3 f32$/.test(text)) return ['f32', 'f32', 'f32'];
  if (/\blog u8$/.test(text)) return ['log8'];
  const scalar = /\b(f32|u32|i32|f16|u16|i16|u8)$/.exec(text);
  if (!scalar) throw new Error(`contract type cell: cannot read "${item}"`);
  return [scalar[1] as string];
}

/**
 * Expands a "Type" cell into scalar storage types. The cell is a list of items separated by
 * semicolons; an item is a scalar type, optionally preceded by a count ("4 x f16") and followed
 * by a normalisation ("u8 / 255"), a group in braces repeated by a count
 * ("4 x {phase u8, tauPk log u8}"), or a number of bytes ("28 bytes"). When the cell is a
 * single scalar without a count and the field is written with one ("w[12]"), the field's count
 * applies.
 */
export function expandTypeCell(type: string, field: string): string[] {
  const scalars: string[] = [];
  const items = type.split(';').map((item) => item.trim());
  for (const item of items) {
    const counted = /^(\d+) x (.+)$/.exec(item);
    const count = counted ? Number(counted[1]) : 1;
    const body = counted ? (counted[2] as string) : item;
    const group = /^\{(.+)\}$/.exec(body);
    const one = group
      ? (group[1] as string).split(',').flatMap((member) => expandTypeItem(member))
      : expandTypeItem(body);
    for (let k = 0; k < count; k++) scalars.push(...one);
  }
  const fieldCount = /\[(\d+)\]/.exec(field);
  if (items.length === 1 && !/^\d+ x /.test(items[0] as string) && fieldCount) {
    const single = [...scalars];
    for (let k = 1; k < Number(fieldCount[1]); k++) scalars.push(...single);
  }
  return scalars;
}

/**
 * The rows of the first offset table that follows `anchor` in the document. Throws if the
 * anchor or a table after it is not found.
 */
export function extractOffsetTable(markdown: string, anchor: string): OffsetRow[] {
  const start = markdown.indexOf(anchor);
  if (start < 0) throw new Error(`contract: anchor not found: ${anchor}`);
  const lines = markdown.slice(start).split('\n');
  const header = lines.findIndex((line) => line.startsWith('| Offset | Field | Type |'));
  if (header < 0) throw new Error(`contract: no offset table after: ${anchor}`);
  const rows: OffsetRow[] = [];
  for (let i = header + 2; i < lines.length; i++) {
    const line = lines[i] as string;
    if (!line.startsWith('|')) break;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const field = cells[1] as string;
    const type = cells[2] as string;
    const scalars = expandTypeCell(type, field);
    rows.push({
      offset: Number(cells[0]),
      field,
      type,
      scalars,
      bytes: scalars.reduce((sum, scalar) => sum + (SCALAR_BYTES[scalar] as number), 0),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Interfaces of the ts code blocks
// ---------------------------------------------------------------------------------------------

/** A type declared in a `ts` code block of the contract. */
export interface ContractDeclaration {
  /** `interface`, `type` or `function`. */
  readonly kind: 'interface' | 'type' | 'function';
  /** The declared name. */
  readonly name: string;
  /**
   * Every name the declaration gives to a member or a parameter, at any depth: an identifier
   * followed by `:`, `?:` or `(`.
   */
  readonly members: readonly string[];
}

/** Removes block and line comments from TypeScript source. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** The names of members and parameters in a stretch of TypeScript without comments. */
export function memberNames(source: string): string[] {
  const names = new Set<string>();
  // An identifier followed by an optional `?` and a colon (a property, a parameter, a tuple
  // label), or by an opening parenthesis (a method).
  for (const match of source.matchAll(/\b([A-Za-z_]\w*)\s*(\?)?\s*([:(])/g)) {
    const name = match[1] as string;
    if (
      match[3] === '(' &&
      /^(Promise|Record|Partial|Readonly|ReadonlyMap|Parameters)$/.test(name)
    ) {
      continue;
    }
    names.add(name);
  }
  return [...names];
}

/** The text of every `ts` code block of the document, without comments. */
export function extractTsBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  for (const match of markdown.matchAll(/```ts\n([\s\S]*?)```/g)) {
    blocks.push(stripComments(match[1] as string));
  }
  return blocks;
}

/**
 * Index just past the end of the declaration whose body starts at `from`: the brace that closes
 * an interface, or the semicolon that ends a type alias or a function signature.
 */
function declarationEnd(source: string, from: number, kind: ContractDeclaration['kind']): number {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    const c = source[i] as string;
    if (c === '{' || c === '(' || c === '[') {
      depth++;
    } else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0 && c === '}' && kind === 'interface') return i + 1;
    } else if (c === ';' && depth === 0 && kind !== 'interface') {
      return i + 1;
    }
  }
  return source.length;
}

/**
 * Every interface, type alias and function declared in TypeScript source without comments,
 * with the member and parameter names each gives.
 */
export function extractDeclarations(source: string): ContractDeclaration[] {
  const declarations: ContractDeclaration[] = [];
  const pattern = /\b(interface|type|function)\s+([A-Za-z_]\w*)\s*([={(<]|extends\b)/g;
  for (const match of source.matchAll(pattern)) {
    const kind = match[1] as ContractDeclaration['kind'];
    const bodyStart = (match.index as number) + match[0].length - 1;
    const end = declarationEnd(source, kind === 'type' ? bodyStart + 1 : bodyStart, kind);
    const body = source.slice(bodyStart, end);
    declarations.push({ kind, name: match[2] as string, members: memberNames(body) });
  }
  return declarations;
}

/** Every declaration of every `ts` code block of the contract. */
export function extractContractDeclarations(markdown: string): ContractDeclaration[] {
  return extractTsBlocks(markdown).flatMap((block) => extractDeclarations(block));
}
