/**
 * Failures as values.
 *
 * Player-facing failures are never thrown: an action either is accepted or comes back as
 * `{ accepted: false, reason }`. Exceptions are reserved for programmer errors and
 * infrastructure failures (docs/design/platform.md section 2).
 *
 * Two shapes are provided. `Result<T, E>` is the general internal one. `Outcome<T, R>` is the
 * player-facing wire shape with the `accepted` discriminant and a machine-readable `reason`.
 */

/** A successful {@link Result} carrying `value`. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** A failed {@link Result} carrying `error`. */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** Either a value or an error, discriminated by `ok`. */
export type Result<T, E = string> = Ok<T> | Err<E>;

/** Wraps a value as a successful result. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Wraps an error as a failed result. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Type guard for the successful branch. */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/** Type guard for the failed branch. */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/** Applies `fn` to the value of a successful result; passes a failure through unchanged. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/**
 * Returns the value of a successful result. Throws an Error for a failed one: use only where a
 * failure would be a programmer error (tests, invariants), never on player input.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`unwrap: result is an error: ${JSON.stringify(result.error)}`);
}

/**
 * A rejected player action or query: nothing changed, nothing was charged to a budget. `reason`
 * is a stable machine-readable code (for example `collision_at_pose`); `detail` is optional
 * human-readable context.
 */
export interface Rejected<R extends string = string> {
  readonly accepted: false;
  readonly reason: R;
  readonly detail?: string;
}

/** An accepted player action: the payload `T` plus the `accepted: true` discriminant. */
export type Accepted<T extends object> = T & { readonly accepted: true };

/** The player-facing outcome of an action or query: accepted with a payload, or rejected. */
export type Outcome<T extends object, R extends string = string> = Accepted<T> | Rejected<R>;

/** Marks a payload as accepted. */
export function accept<T extends object>(payload: T): Accepted<T> {
  return { ...payload, accepted: true };
}

/** Builds a rejection value with a reason code and optional detail text. */
export function reject<R extends string>(reason: R, detail?: string): Rejected<R> {
  return detail === undefined ? { accepted: false, reason } : { accepted: false, reason, detail };
}
