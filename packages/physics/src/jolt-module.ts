/**
 * Loading and recycling of Jolt WebAssembly module instances.
 *
 * The JavaScript build of Jolt keeps process-wide state (its type factory) inside the module
 * instance, and destroying one `JoltInterface` tears that state down for every other one in the
 * same instance. A world therefore owns a whole module instance while it lives. Instantiating
 * the module costs 70 to 95 ms and reserves a fixed 128 MB heap, so instances are recycled: a
 * disposed world hands its instance back and the next world reuses it.
 */

import Jolt from 'jolt-physics';

/** One instantiated Jolt WebAssembly module (the namespace of its classes and constants). */
export type JoltModule = typeof Jolt;

/** Version of the `jolt-physics` npm package this wrapper is written against. */
export const JOLT_PACKAGE_VERSION = '1.1.0';
/** Version of Jolt Physics inside that package (its saved-state layout is parsed here). */
export const JOLT_ENGINE_VERSION = '5.6.0';

/**
 * Fraction of the module heap that must be free for an instance to be recycled. A disposed
 * world leaves the heap almost empty; an instance that does not is dropped instead, so a leak
 * can never accumulate across worlds.
 */
const RECYCLE_MIN_FREE_FRACTION = 0.9;

const idleModules: JoltModule[] = [];

/** A per-class table of the bindings: heap address to the JavaScript object wrapping it. */
type WrapperCache = Record<string, unknown>;

/**
 * The bindings' own accessor of a class's wrapper table (`Module.getCache` of the WebIDL binder),
 * which the package's type declarations leave out.
 */
function wrapperCacheOf(module: JoltModule, wrapperClass: unknown): WrapperCache | undefined {
  const getCache = (module as unknown as { getCache?: (c: unknown) => unknown }).getCache;
  if (typeof getCache !== 'function') return undefined;
  const cache: unknown = getCache(wrapperClass);
  return typeof cache === 'object' && cache !== null ? (cache as WrapperCache) : undefined;
}

/** A wrapper class of the bindings. */
interface WrapperClass {
  readonly wrapperClass: unknown;
  /**
   * True for a class implemented in JavaScript (a listener, a collector, a filter): the engine
   * finds the JavaScript object of such an instance through the class's table when it calls
   * back, so its entries must stay for as long as the instance lives.
   */
  readonly implementedInJavaScript: boolean;
}

/** The wrapper classes of a module instance (found once per instance, then remembered). */
const wrapperClasses = new WeakMap<JoltModule, readonly WrapperClass[]>();

function wrapperClassesOf(module: JoltModule): readonly WrapperClass[] {
  let found = wrapperClasses.get(module);
  if (found === undefined) {
    // The base class's table holds the bindings' NULL object and must be left alone.
    const base = wrapperCacheOf(module, undefined);
    const classes: WrapperClass[] = [];
    const seen = new Set<WrapperCache>();
    const table = module as unknown as Record<string, unknown>;
    for (const name of Object.keys(table)) {
      const candidate = table[name];
      if (typeof candidate !== 'function') continue;
      const cache = wrapperCacheOf(module, candidate);
      if (cache === undefined || cache === base || seen.has(cache)) continue;
      seen.add(cache);
      // The bindings name every class a script can implement with the suffix JS.
      classes.push({ wrapperClass: candidate, implementedInJavaScript: name.endsWith('JS') });
    }
    found = classes;
    wrapperClasses.set(module, found);
  }
  return found;
}

/**
 * Number of JavaScript wrapper objects the bindings of a module instance hold on to (for tests
 * and diagnostics). The bindings keep every object they hand out in a per-class table until
 * `destroy` is called on it; objects the engine frees by reference count (shapes, shape
 * settings, bodies) never leave it by themselves.
 */
export function joltWrapperCount(module: JoltModule): number {
  let count = 0;
  for (const { wrapperClass } of wrapperClassesOf(module)) {
    const cache = wrapperCacheOf(module, wrapperClass);
    if (cache !== undefined) count += Object.keys(cache).length;
  }
  return count;
}

/**
 * Empties the bindings' wrapper tables of a module instance. Only valid while no JavaScript
 * object of the instance is in use, that is, between worlds: a recycled instance would
 * otherwise keep about a thousand dead wrapper objects per world it has hosted (0.1 to 0.2 MB of
 * JavaScript heap each), for the life of the process.
 */
export function clearJoltWrappers(module: JoltModule): void {
  for (const { wrapperClass } of wrapperClassesOf(module)) {
    const cache = wrapperCacheOf(module, wrapperClass);
    if (cache === undefined) continue;
    for (const key of Object.keys(cache)) delete cache[key];
  }
}

/**
 * Empties the wrapper tables of a module instance while a world is using it, keeping only the
 * objects implemented in JavaScript. The tables are nothing but a memo from heap address to
 * wrapper object: an object that is still held somewhere keeps working without its entry, and
 * the bindings make a new wrapper the next time the address is handed out. A long-lived world
 * calls this now and then, because objects that live inside freed ones (the id of a destroyed
 * body, the result inside a released shape settings object) leave entries behind that nothing
 * else removes. Must not be called from inside an engine callback.
 */
export function trimJoltWrappers(module: JoltModule): void {
  for (const { wrapperClass, implementedInJavaScript } of wrapperClassesOf(module)) {
    if (implementedInJavaScript) continue;
    const cache = wrapperCacheOf(module, wrapperClass);
    if (cache === undefined) continue;
    for (const key of Object.keys(cache)) delete cache[key];
  }
}

/**
 * Removes one wrapper object from the bindings' table without destroying what it wraps: for
 * objects whose native side is freed by reference count, which `destroy` must not be called on.
 * The object must not be used afterwards.
 */
export function forgetJoltWrapper(
  module: JoltModule,
  wrapperClass: unknown,
  object: unknown,
): void {
  const cache = wrapperCacheOf(module, wrapperClass);
  if (cache === undefined) return;
  const pointer = module.getPointer(object);
  if (cache[pointer] === object) delete cache[pointer];
}

// ---------------------------------------------------------------------------------------------
// Fast engine callbacks
// ---------------------------------------------------------------------------------------------

/**
 * How the engine calls a class implemented in JavaScript (a contact listener, a shape filter, a
 * collector), and why this file shortens the way.
 *
 * The bindings compile every such call to one import of the WebAssembly module,
 * `(code, signature, arguments) => result`: `code` names the piece of glue to run, `signature`
 * points at a string with one character per argument, and `arguments` at the arguments on the
 * engine's stack. The glue decodes the string character by character into an array, looks the
 * JavaScript object up by its address in the wrapper table of its class, checks that it has the
 * method, and calls it. Measured here on the reference machine: about 0.3 microseconds per
 * call, which for the per-piece shape filter of a plate landing on a pile was 40,000 to 95,000
 * calls and 15 to 30 ms in every step, a quarter of the whole cost of loading.
 *
 * So the import is wrapped when the module is instantiated. A callback that was handed out by
 * {@link fastJoltCallback} registers itself the first time the glue reaches it: the wrapper
 * then knows which `code` belongs to it and, from the signature, where its arguments are, and
 * from then on calls it straight from the import with the arguments read from the heap. The
 * arguments and the result are the same numbers either way, so nothing about the simulation
 * changes. A call whose first argument (the address of the engine-side object) is not the one
 * that registered goes the slow way, as does every callback whose arguments are not all
 * integers or pointers.
 */
interface CallbackDispatch {
  /** `code` of the glue being run through the slow path at this moment, or -1. */
  code: number;
  /** Address of the signature string of that call. */
  signature: number;
  /** Address of the arguments of that call. */
  args: number;
  /** Per `code`: the registered callback. */
  readonly fast: Map<number, FastCallback>;
}

interface FastCallback {
  /** Address of the engine-side object the callback belongs to (its first argument). */
  readonly self: number;
  /** Reads the arguments at the given address and calls the callback. */
  readonly call: (args: number) => number;
}

/** A callback of a class implemented in JavaScript: numbers in, a number or a flag out. */
export type JoltCallback = (...args: number[]) => number | boolean | void;

const dispatches = new WeakMap<JoltModule, CallbackDispatch>();

/** Signature characters of the bindings: a 32-bit integer and a pointer. */
const SIGNATURE_INT = 105;
const SIGNATURE_POINTER = 112;
/** Largest number of arguments, beside the object itself, a fast callback can take. */
const FAST_CALLBACK_MAX_ARGUMENTS = 6;

type AsmImport = (code: number, signature: number, args: number) => number;

/**
 * Wraps the three imports through which the engine reaches JavaScript-implemented classes (all
 * three run the same glue function) so that registered callbacks are called directly.
 */
function wrapCallbackImports(
  imports: Record<string, unknown>,
  dispatch: CallbackDispatch,
  heap: () => Int32Array,
): boolean {
  let wrapped = 0;
  for (const name of Object.keys(imports)) {
    const original = imports[name];
    // The glue imports are the ones that take (code, signature, arguments) and do nothing but
    // hand them on: recognised by their source, which is the same for the three of them.
    if (typeof original !== 'function' || original.length !== 3) continue;
    const source = Function.prototype.toString.call(original);
    if (!/^\(\w+,\s*\w+,\s*\w+\)\s*=>\s*\w+\(\w+,\s*\w+,\s*\w+\)$/.test(source)) continue;
    const slow = original as AsmImport;
    imports[name] = (code: number, signature: number, args: number): number => {
      const entry = dispatch.fast.get(code);
      if (entry !== undefined && heap()[args >> 2] === entry.self) return entry.call(args);
      const outerCode = dispatch.code;
      const outerSignature = dispatch.signature;
      const outerArgs = dispatch.args;
      dispatch.code = code;
      dispatch.signature = signature;
      dispatch.args = args;
      try {
        return slow(code, signature, args);
      } finally {
        dispatch.code = outerCode;
        dispatch.signature = outerSignature;
        dispatch.args = outerArgs;
      }
    };
    wrapped++;
  }
  return wrapped > 0;
}

/** The instantiation in progress, if any: they are done one at a time (see below). */
let instantiating: Promise<unknown> = Promise.resolve();

/**
 * Instantiates a module with its callback imports wrapped (see {@link CallbackDispatch}). One
 * at a time: the interception below is global for as long as a module loads, and two modules
 * loading at once could not be told apart.
 */
function instantiateJoltModule(): Promise<JoltModule> {
  const next = instantiating.then(instantiateOneJoltModule);
  instantiating = next.catch(() => undefined);
  return next;
}

async function instantiateOneJoltModule(): Promise<JoltModule> {
  const dispatch: CallbackDispatch = { code: -1, signature: 0, args: 0, fast: new Map() };
  let module: JoltModule | undefined;
  const heap = (): Int32Array => (module as JoltModule).HEAP32;
  // The bindings instantiate their WebAssembly module with `WebAssembly.instantiate(bytes,
  // imports)` and give no other access to the imports. The call is intercepted for the time
  // the module loads; an instantiation of anything else passes through untouched (its imports
  // have no glue of this shape).
  const realInstantiate = WebAssembly.instantiate;
  let done = false;
  const patched = function (
    this: unknown,
    source: unknown,
    imports?: Record<string, Record<string, unknown>>,
  ): unknown {
    if (!done && imports !== undefined && imports !== null) {
      for (const namespace of Object.values(imports)) {
        if (typeof namespace !== 'object' || namespace === null) continue;
        if (wrapCallbackImports(namespace, dispatch, heap)) done = true;
      }
    }
    return Reflect.apply(realInstantiate, WebAssembly, [source, imports]);
  };
  WebAssembly.instantiate = patched as typeof WebAssembly.instantiate;
  try {
    module = await Jolt();
  } finally {
    if (WebAssembly.instantiate === (patched as typeof WebAssembly.instantiate)) {
      WebAssembly.instantiate = realInstantiate;
    }
  }
  // Without the wrapper everything still works, the slow way.
  if (done) dispatches.set(module, dispatch);
  return module;
}

/**
 * Wraps a callback of a JavaScript-implemented class of `module` so that, once the engine has
 * called it for the first time, later calls skip the bindings' glue (see
 * {@link CallbackDispatch}). The callback receives what the glue would hand it: every argument
 * but the object itself, as numbers. Assign the result to the method of the object, for
 * example `listener.OnContactAdded = fastJoltCallback(jolt, (b1, b2, manifold, out) => ...)`.
 * Only one object per class may use it in a module at a time (a second one is served the slow
 * way); {@link clearJoltCallbacks} forgets them all.
 */
export function fastJoltCallback<T extends JoltCallback>(module: JoltModule, callback: T): T {
  const dispatch = dispatches.get(module);
  if (dispatch === undefined) return callback;
  let registered = false;
  const first = (...args: number[]): number | boolean | void => {
    if (!registered && dispatch.code >= 0 && !dispatch.fast.has(dispatch.code)) {
      registered = true;
      // The signature: one character per argument, the object itself first.
      const bytes = module.HEAPU8;
      let count = 0;
      let plain = true;
      for (let at = dispatch.signature; bytes[at] !== 0; at++) {
        const c = bytes[at];
        if (c !== SIGNATURE_INT && c !== SIGNATURE_POINTER) plain = false;
        count++;
      }
      const own = count - 1;
      if (plain && own >= 0 && own <= FAST_CALLBACK_MAX_ARGUMENTS && own === args.length) {
        const self = module.HEAP32[dispatch.args >> 2] as number;
        const fn = callback as (...values: number[]) => number | boolean | void;
        const result = (value: number | boolean | void): number =>
          value === true ? 1 : value === false || value === undefined ? 0 : value;
        dispatch.fast.set(dispatch.code, {
          self,
          call: (at: number): number => {
            const h = module.HEAP32;
            const i = at >> 2;
            switch (own) {
              case 0:
                return result(fn());
              case 1:
                return result(fn(h[i + 1] as number));
              case 2:
                return result(fn(h[i + 1] as number, h[i + 2] as number));
              case 3:
                return result(fn(h[i + 1] as number, h[i + 2] as number, h[i + 3] as number));
              case 4:
                return result(
                  fn(
                    h[i + 1] as number,
                    h[i + 2] as number,
                    h[i + 3] as number,
                    h[i + 4] as number,
                  ),
                );
              case 5:
                return result(
                  fn(
                    h[i + 1] as number,
                    h[i + 2] as number,
                    h[i + 3] as number,
                    h[i + 4] as number,
                    h[i + 5] as number,
                  ),
                );
              default:
                return result(
                  fn(
                    h[i + 1] as number,
                    h[i + 2] as number,
                    h[i + 3] as number,
                    h[i + 4] as number,
                    h[i + 5] as number,
                    h[i + 6] as number,
                  ),
                );
            }
          },
        });
      }
    }
    return callback(...args);
  };
  return first as T;
}

/**
 * Forgets every callback registered with {@link fastJoltCallback} in a module instance. Called
 * when the world that owns the callbacks is disposed, before the instance is recycled.
 */
export function clearJoltCallbacks(module: JoltModule): void {
  dispatches.get(module)?.fast.clear();
}

/** Number of callbacks of a module instance that are served the fast way (for tests). */
export function fastJoltCallbackCount(module: JoltModule): number {
  return dispatches.get(module)?.fast.size ?? 0;
}

/** Takes an idle module instance, or instantiates a new one. */
export async function acquireJoltModule(): Promise<JoltModule> {
  const idle = idleModules.pop();
  if (idle !== undefined) return idle;
  return await instantiateJoltModule();
}

/**
 * Returns a module instance whose world has been destroyed. It is kept for reuse when its heap
 * is (almost) empty again and dropped otherwise. Its wrapper tables are emptied first (see
 * {@link clearJoltWrappers}).
 */
export function releaseJoltModule(module: JoltModule): void {
  const total = module.JoltInterface.prototype.sGetTotalMemory();
  const free = module.JoltInterface.prototype.sGetFreeMemory();
  if (free < RECYCLE_MIN_FREE_FRACTION * total) return;
  // No JavaScript object of the disposed world is in use any more: drop them all, so that the
  // instance starts its next world with empty wrapper tables, and none of its callbacks.
  clearJoltCallbacks(module);
  clearJoltWrappers(module);
  idleModules.push(module);
}

/** Number of idle module instances waiting for reuse (for tests and diagnostics). */
export function idleJoltModuleCount(): number {
  return idleModules.length;
}
