/**
 * @spotless/sim-gpu. Module M1 of the wash simulation (docs/design/sim-core.md section 4): the
 * GPU compute foundation, so that the determinism rules of section 6 are enforced in one place.
 * Depends on `@spotless/core` only.
 *
 * - `types.ts`: the contract of the module: `GpuContext`, `StackString`, `FieldDef`,
 *   `KernelDef`, `BindingDef`, `OpClass`, `ManagedBuffer`, `Kernel`, `Dispatch`, `BatchOp`,
 *   `AccumulatorPair`, `ReduceSpec`, `StageId`, the shared fixed-point units and the limits.
 * - `context.ts`: `createGpuContext`, the device wrapper that implements `GpuContext`
 *   (buffers, kernel cache, batched dispatch, read-back, failures).
 * - `layout.ts`, `record.ts`, `f16.ts`: binary record layouts as data, the checker every
 *   layout must pass, the typed CPU view of records and the generated WGSL.
 * - `wgsl.ts`: WGSL assembly with `#include`, uniform parameter blocks, and the scan of a
 *   kernel's source for the operation classes it calls (`opClassesInWgsl`, rule 9).
 * - `reduce.ts`, `guard.ts`: exact 64-bit integer reductions and the bit-pattern non-finite
 *   guard.
 * - `probes.ts`: the determinism probe suite, one kernel per operation class.
 * - `bench.ts`: timing of GPU work for benchmarks.
 * - `stack.ts`, `hash.ts`, `usage.ts`, `grid.ts`: the stack string as text, result hashes,
 *   WebGPU usage flags, dispatch sizes.
 *
 * Nothing exported here needs Node. The Node-only parts (the Dawn bindings, the probe files,
 * the benchmark lock) are in `src/node` and are imported from `@spotless/sim-gpu/node`; test
 * fixtures are in `@spotless/sim-gpu/testing`.
 *
 * Use, in outline (all sizes in bytes, planned times in seconds):
 *
 *     const gpu = await createNodeGpuContext({ sim: '0.1.0', physics: 'jolt 5.0' });  // node entry
 *     gpu.wgsl.define(recordInclude(K_HOT_LAYOUT), recordWgsl(K_HOT_LAYOUT));
 *     const kernel = await gpu.kernel({
 *       name: 'k_step', entry: 'main', wgsl: gpu.wgsl.assemble(SOURCE_WITH_INCLUDES),
 *       bindings: [{ group: 0, binding: 0, name: 'hot', kind: 'storage' }],
 *       uses: ['addmul', 'pow'], reads: ['hot'], writes: ['hot'], atomics: [],
 *     });
 *     const hot = gpu.buffer({ name: 'k.hot', owner: 'sim-film', stage: 'G',
 *       bytes: recordBufferBytes(K_HOT_LAYOUT, cells), usage: BUFFER_USAGE.STORAGE,
 *       layout: K_HOT_LAYOUT });
 *     gpu.write(hot, initialBytes);
 *     await gpu.run([{ op: 'dispatch', kernel, bindings: { hot },
 *       workgroups: dispatchGrid(cells, 64).workgroups, plannedTime: cells / planningRate }]);
 *     const [mass] = await gpu.reduceI64(hot, reduceSpecOf(K_HOT_LAYOUT, ['m']));   // exact
 *     if ((await gpu.nonFiniteCount()) !== 0) throw new Error('non-finite film state');
 *     const cellsView = recordView(K_HOT_LAYOUT, await gpu.read(hot));
 *
 * `read`, `reduceI64`, `reduceI64By` and `nonFiniteCount` answer for the buffer as left by the
 * work submitted before the call, so a caller may submit the next step before awaiting them.
 * A process should make one context and reuse it (`createNodeGpuContext`).
 *
 * Not built yet, by decision (docs/design/scope.md): eviction of buffers to a staging file,
 * recovery from device loss, checkpoint and resume, the batch-level check of read, write and
 * atomic declarations, and saturation counters (`GpuContextDeferred` in `types.ts`).
 */

export * from './types.ts';
export * from './layout.ts';
export * from './f16.ts';
export * from './record.ts';
export * from './wgsl.ts';
export * from './usage.ts';
export * from './grid.ts';
export * from './hash.ts';
export * from './stack.ts';
export * from './context.ts';
export * from './reduce.ts';
export * from './guard.ts';
export * from './probes.ts';
export * from './bench.ts';
