/**
 * Types of module M13, verification (docs/design/sim-core.md section 4, "M13. Verification").
 * The contract gives M13 no interfaces of its own; what is typed here is the dependency table
 * of section 4 as data and the outcome of checking the workspace against it.
 */

/** One module of the table of section 4, with what it may depend on. */
export interface SimModule {
  /** Module id, `M1` to `M13`. */
  readonly id: string;
  /** Package name without the `@spotless/` scope, for example `sim-gpu`. */
  readonly package: string;
  /**
   * What the module depends on, as the table writes it: module ids, platform package names
   * without the scope, or `'all'`.
   */
  readonly dependsOn: readonly string[] | 'all';
}

/** The `@spotless/*` dependencies a package declares, read from its `package.json`. */
export interface PackageManifest {
  /** Package name without the scope. */
  readonly package: string;
  /** Workspace packages it lists under `dependencies` or `devDependencies`, without the scope. */
  readonly workspaceDeps: readonly string[];
  /** Other packages it lists, by name. */
  readonly externalDeps: readonly string[];
}

/** A disagreement between a package and the dependency table. */
export interface DependencyProblem {
  /** The package concerned. */
  readonly package: string;
  /**
   * What is wrong: a dependency of the table that the package does not declare; a dependency
   * it declares that the table does not allow; a cycle; a module without a package; or a row
   * of the table as data that differs from the row in the contract.
   */
  readonly kind: 'missing' | 'forbidden' | 'cycle' | 'unknown-package' | 'table';
  /** The dependency concerned, the cycle as `a -> b -> a`, or the row that differs. */
  readonly detail: string;
}
