# Spike: GPU and CPU compute throughput for Spotless simulation kernels

> **Record of the build, kept as written (8 October 2026).** The hardware trial that chose
> WebGPU through Dawn for the simulation's kernels. It was run on macOS 14 with `webgpu` 0.3.0;
> the project now pins `webgpu` 0.6.2 on macOS 27 (`spike-gpu-compute-macos27-recheck.md`). The
> index of the documents is `docs/README.md`.

Date: 2026-10-08, 15:37 to 16:55 BST. Machine: MacBook Pro, Apple M3 Pro (5 P + 6 E cores, 14-core GPU), 18 GB, macOS 14.7.6 (23H626).
Substrate under test: WGSL compute shaders through WebGPU, driven from Node v20.19.0 via the Dawn bindings (npm `webgpu`).

All code and raw outputs for this report are in `spikes/gpu-compute/`, and paths written as `out/...` are relative to it. The JSON outputs are in the repository; the run logs (`out/*.log`) are not.

## 1. Bottom line

**Go, with one condition.** WebGPU compute driven from Node is fast, stable and bitwise reproducible on this machine, and headless Chrome is a drop-in fallback that produced the same speed and the same bits.

The condition is the package version. On this machine's macOS 14.7.6, **only `webgpu@0.3.0` (a Dawn build from June 2025) loads.** Every later prebuilt binary I tried fails at `dlopen` with a missing Metal symbol. That needs a decision before the project commits (section 3).

What the simulator can count on, in round planning numbers (measured medians are in section 11):

| Kernel type | Planning rate | In 20 minutes of GPU time |
|---|---|---|
| Structured stencil, 16 bytes of state per cell | 3.5 G cell-updates/s | 4.2 x 10^12 cell-updates |
| Structured stencil, 8 bytes per cell (f16 storage) | 7 G cell-updates/s | 8.4 x 10^12 cell-updates |
| Unstructured finite-volume, cells in Morton order | 1.4 G cell-updates/s | 1.7 x 10^12 cell-updates |
| Unstructured finite-volume, cells in random order | 0.45 G cell-updates/s | 5.4 x 10^11 cell-updates |
| Closest-hit rays against a BVH over 1M triangles, mixed coherence | 150 M rays/s | 1.8 x 10^11 rays |
| Rays against a 512^3 signed-distance grid (sphere tracing, nearest lookup) | 400 M rays/s | 4.8 x 10^11 rays |
| Particle-grid step (MLS-MPM style, 256^3 grid), particles kept sorted | 50 to 120 M particle-steps/s | 6 x 10^10 to 1.4 x 10^11 particle-steps |
| Same, particles in random order | 33 M particle-steps/s | 4 x 10^10 particle-steps |

The single most useful finding for the architects: **the stencil kernels are limited by memory traffic (about 110 to 130 GB/s), not by arithmetic.** Doubling the arithmetic per cell cost nothing; halving the bytes per cell doubled the throughput (section 4).

## 2. Conditions of measurement

- **Power.** `pmset -g batt` reported "Now drawing from 'AC Power'" at every check I made (15:38, 15:59, 16:12, 16:24, 16:30, 16:37) and `lowpowermode 0`. The brief said the machine was on battery; it was not during any measurement here. I have no battery or low-power-mode timings.
- **Noise.** The rigid-body spike ran one or two CPU-bound `node` processes for most of the session. On this machine the GPU shares memory bandwidth with the CPU, so that load costs the GPU kernels 5 to 12% (B1 reads 4.0 G cell-updates/s when the machine is quiet and 3.5 to 3.8 G when those processes are running; the sustained run in section 9 logs this per 10 s window). Every figure is best and median of 5 repetitions unless stated; spreads are in the appendix tables.
- **Timing.** The clock stops only after `await device.queue.onSubmittedWorkDone()`. For B1 and B4 I also measured GPU-side time with `timestamp-query`; it agrees with wall time to within 1% (for example 1.049 ms per step on the GPU against 1/952.6 s = 1.050 ms wall at 2048^2), so the wall-clock figures measure the kernel, not the API.
- **Contamination.** Between 15:46 and 15:58 a second run of GPU benchmarks was going from this directory (section 14). Nothing measured in that window is reported; everything was re-run afterwards behind a cross-process lock.

## 3. B0: environment, and the install problem

### The latest package does not load on this OS

`npm install webgpu` gives 0.6.2, which fails immediately:

```
Error: dlopen(.../node_modules/webgpu/dist/darwin-universal/dawn.node, 0x0001):
  Symbol not found: _OBJC_CLASS_$_MTLLogStateDescriptor
  (built for macOS 26.0 which is newer than running OS)
```

`MTLLogStateDescriptor` is a Metal class that macOS 14 does not have. I checked each binary's declared minimum OS (`otool -l`, `LC_BUILD_VERSION`) and tried to load it:

| Package | Published | Binary min OS / SDK | Loads on macOS 14.7.6 |
|---|---|---|---|
| webgpu 0.2.12 | 2025-04-28 | 11.0 / 14.5 | yes |
| **webgpu 0.3.0** | 2025-06-10 | 14.0 / 14.5 | **yes (used for everything below)** |
| webgpu 0.3.8 | 2025-09-25 | 15.0 / 15.5 | no, `MTLLogStateDescriptor` |
| webgpu 0.3.10 | 2026-03-19 | 15.0 / 15.5 | no, same symbol |
| webgpu 0.4.0 | 2026-03-27 | 15.0 / 15.5 | no, same symbol |
| webgpu 0.5.0, 0.6.0, 0.6.1, 0.6.2 | 2026-08-28 to 2026-10-02 | 26.0 / 26.5 | no, same symbol |
| @kmamal/gpu 0.2.1 (another Dawn binding) | 2025-08-28 | 11.0 / 15.0 | no, same symbol |
| @kmamal/gpu 1.0.0-4 | 2026-10-04 | 11.0 / 15.5 | no, same symbol |

Versions 0.3.3 to 0.3.7 were not tested individually. The two `@kmamal/gpu` builds declare a minimum of macOS 11 and still fail, so this is not just one package's build flag: every prebuilt Dawn node binary I tried that was published from late August 2025 onward references this macOS 15 class. Chrome 154 on the same machine runs WebGPU fine, so Dawn itself still works on macOS 14 when built Chrome's way.

Options, in the order I would consider them:

1. **Upgrade the machine to macOS 15 or later** and use the current `webgpu` package. Not tested here (I cannot change the OS), so it needs a re-run of this spike's B0, B1 and B7 afterwards. The Chrome result in section 10 is some evidence it will be uneventful: Chrome's current Dawn gave the same speed and the same bits as the June 2025 build.
2. **Pin `webgpu@0.3.0`.** Works today, measured below. The cost is running a 16-month-old Dawn with the quirks listed next, and no fixes.
3. **Build `dawn.node` from source** with a macOS 14 deployment target. Not attempted: it needs cmake and depot_tools, which are not installed.
4. **Run the kernels in headless Chrome** (section 10). Works today with the installed Chrome.

### Adapter, limits, features (webgpu 0.3.0)

Adapter: vendor `apple`, architecture `metal-3`, device `apple-m3-pro`, description "Metal driver on macOS Version 14.7.6 (Build 23H626)". Not a fallback adapter. Subgroup size 4 to 64.

| Limit | Adapter maximum | Device default if you do not ask |
|---|---|---|
| maxBufferSize | 9,663,676,416 (9 GiB) | 268,435,456 |
| maxStorageBufferBindingSize | 9,663,676,416 (9 GiB) | 134,217,728 |
| maxUniformBufferBindingSize | 9,663,676,416 | 65,536 |
| maxComputeInvocationsPerWorkgroup | 1024 | 256 |
| maxComputeWorkgroupSizeX / Y / Z | 1024 / 1024 / 1024 | 256 / 256 / 64 |
| maxComputeWorkgroupsPerDimension | 65,535 | 65,535 |
| maxComputeWorkgroupStorageSize | 32,768 | 16,384 |
| maxStorageBuffersPerShaderStage | 10 | 8 |
| maxStorageTexturesPerShaderStage | 8 | 4 |
| maxSampledTexturesPerShaderStage | 16 | 16 |
| maxUniformBuffersPerShaderStage | 12 | 12 |
| maxTextureDimension1D / 2D | 16,384 | 8,192 |
| maxTextureDimension3D | 2,048 | 2,048 |
| maxTextureArrayLayers | 2,048 | 256 |
| maxBindGroups / maxBindingsPerBindGroup | 4 / 1000 | 4 / 1000 |
| minStorageBufferOffsetAlignment | 256 | 256 |

Features: `timestamp-query`, `shader-f16`, `float32-filterable`, `float32-blendable`, `subgroups`, `bgra8unorm-storage`, `clip-distances`, `depth-clip-control`, `depth32float-stencil8`, `dual-source-blending`, `indirect-first-instance`, `rg11b10ufloat-renderable`, `texture-compression-astc / bc / etc2`, `core-features-and-limits`. Not present in 0.3.0: `texture-formats-tier1` and `tier2` (Chrome 154 has both). WGSL language features: `readonly_and_readwrite_storage_textures`, `packed_4x8_integer_dot_product`, `pointer_composite_access`, `unrestricted_pointer_parameters`.

**Power preference does not matter.** `high-performance`, `low-power` and unset return the same adapter with the same limits and features, and an interleaved A/B on B1 gave 4.22 against 4.21 G cell-updates/s.

### Things that will bite if not known

- **The default device limits are too small.** A 16M-cell state buffer is 256 MB, twice the default binding limit. Request `requiredLimits` from the adapter explicitly.
- **Bindings of 4 GiB or more are silently wrong** even though the adapter advertises 9 GiB. A buffer of exactly 4 GiB reports `arrayLength` 0; at 4 GiB + 4 KiB the shader sees 1024 elements, and writes past that are dropped without any error (`out/b8_bigbuffer.log`). A 4.5 GiB buffer works correctly when bound as a window (`offset` beyond 4 GiB, `size` 64 MB). Chrome caps both limits at 4 GiB - 4, which avoids the problem. Keep every binding under 4 GiB and assert it in the wrapper.
- **Keep the object returned by `create()` alive.** If it is garbage-collected, later calls reject with `GPUPipelineError: Instance dropped`. I hit this on the first benchmark.
- **`adapter.info` strings come back as decimal character codes** in 0.3.0 (`'97112112108101'` is "apple"). Cosmetic.
- Passing every adapter limit back as `requiredLimits` prints two harmless warnings ("DawnTexelCopyBufferRowAlignmentLimits is not supported in required limits").

## 4. B1: structured stencil

Kernel: 4 x f32 per cell (h, hu, hv, hc), 5-point stencil, a "lazy" Lax-Friedrichs shallow-water update with four flux evaluations, a wet/dry branch and friction; about 80 flops and 5 divisions per cell. Ping-pong buffers. Checked against a JS reference (section 8).

| Grid | Cells | Storage buffers, steps/s (best / median) | Storage buffers, cell-updates/s (median) | rgba32float textures, cell-updates/s (median) | GPU-only ms per step |
|---|---|---|---|---|---|
| 1024^2 | 1.05 M | 4010 / 3974 | 4.17 G | 4.38 G | 0.250 |
| 2048^2 | 4.19 M | 957 / 953 | 4.00 G | 4.20 G | 1.049 |
| 4096^2 | 16.8 M | 240 / 238 | 3.99 G | 4.26 G | 4.174 |

- **Throughput is flat across grid size**: 4.0 G cell-updates/s from 1M to 16M cells.
- **Textures against buffers**: textures are 5 to 8% faster. Reading through `texture_2d` + `textureLoad` and through a read-only storage texture perform the same. Not a reason to choose either.
- **Workgroup size does not matter**: 4x4, 8x8, 16x16, 32x8, 32x32, 64x4 and 256x1 are all within 8% of each other, with no consistent winner across grid sizes.
- **Dispatches per submit does not matter for throughput**: from 1 to 256 dispatches per command buffer, and one pass or many, every cell of the sweep is between 3.83 and 4.18 G (appendix). What does matter is awaiting the GPU: awaiting `onSubmittedWorkDone` after every single dispatch drops the 1M-cell grid from 4.0 to 2.4 G (the round trip is about 90 microseconds, section 7). Awaiting every 4 submits of 16 dispatches costs nothing measurable.

### Arithmetic-bound or memory-bound?

| Variant (2048^2, median) | Bytes per cell | Cell-updates/s | Net buffer traffic |
|---|---|---|---|
| vec4f buffers, baseline | 16 | 3.89 G | about 124 GB/s |
| vec4f buffers, update evaluated twice (2x flops) | 16 | 3.94 G | about 126 GB/s |
| vec4&lt;f16&gt; buffers, arithmetic still f32 | 8 | 7.54 G | about 121 GB/s |
| rgba32float textures | 16 | 4.04 G | about 129 GB/s |
| rgba16float textures | 8 | 8.17 G | about 131 GB/s |

Twice the arithmetic at the same bytes: no change. Half the bytes at the same arithmetic: twice the throughput. The 4096^2 rows in the appendix say the same. So for stencil-type kernels on this machine the budget is bytes moved, at roughly 110 to 130 GB/s, and flops are close to free until a kernel is far heavier than this one.

Turning off Dawn's bounds-check robustness (`disable_robustness`) made no measurable difference to B1 or B2, and perhaps 5 to 10% on the BVH kernel, which is inside the noise of that A/B (`out/robustness_ab.log`). Not worth diverging from browser behaviour.

## 5. B2: unstructured stencil

Kernel: finite-volume shallow-water update on a triangle mesh. Per cell: state vec4f, three neighbour ids in a vec4u, two vec4f of edge geometry; Rusanov flux over the three edges, about 130 flops. Ordering (a) row-major and Morton, (b) random shuffle.

| Cells | Ordering | Workgroup | Steps/s (median) | Cell-updates/s (best / median) |
|---|---|---|---|---|
| 2.0 M | row-major | 64 | 690 | 1.38 G / 1.38 G |
| 2.0 M | row-major | 256 | 819 | 1.64 G / 1.64 G |
| 2.0 M | Morton | 64 | 804 | 1.61 G / 1.61 G |
| 2.0 M | random shuffle | 64 | 264 | 530 M / 527 M |
| 8.0 M | row-major | 64 | 146 | 1.17 G / 1.17 G |
| 8.0 M | row-major | 256 | 149 | 1.19 G / 1.19 G |
| 8.0 M | Morton | 64 | 193 | 1.55 G / 1.55 G |
| 8.0 M | random shuffle | 64 | 61 | 488 M / 486 M |

- Coherent numbering is worth about 3x over random (1.55 G against 486 M at 8M cells).
- Morton order holds its rate as the mesh grows (1.61 G at 2M, 1.55 G at 8M); row-major does not (1.38 to 1.64 G at 2M, 1.17 to 1.19 G at 8M). At 8M cells Morton is 30% faster. I did not run Morton with 256-wide workgroups.
- Unlike B1, workgroup size mattered in one case: row-major at 2M cells gained 19% going from 64 to 256.
- A coherent unstructured mesh costs about 2.6x a structured grid per cell. Its 80 bytes of net traffic per cell (64 read, 16 written) against the structured grid's 32 would predict 2.5x.

## 6. B3 and B4: rays and particles

### B3(i): BVH over 1.04M triangles

Scene: 400 thin shells, bowls, discs and tori in a 0.5 m box. It is dense: 18 to 21% of 1 to 2 mm voxels are occupied and the mean hit distance is about 3.7 cm, so a real load with more open space would give longer rays than these. BVH built on the CPU in JS, binned SAH with 16 bins on three axes: **1.40 s best, 1.49 s median**, 665k nodes, depth 26, 21 MB of nodes plus 50 MB of triangles. Traversal: stack-based, nearest child first, closest hit, Moller-Trumbore. The GPU result matched a JS reference tracer on all 1,501 sampled rays in every case.

| Ray set | 1M rays (best / median) | 4M rays (best / median) | BVH nodes per ray | Triangle tests per ray |
|---|---|---|---|---|
| Coherent (16 jet cones from the floor) | 292 M / 290 M | 367 M / 366 M | 37.5 | 8.5 |
| Incoherent (random origin and direction) | 99 M / 99 M | 102 M / 101 M | 33.1 | 6.9 |
| **Mixed 50/50** | **151 M / 150 M** | **161 M / 160 M** | 35.3 | 7.7 |
| Incoherent, Morton-sorted by origin | 136 M / 132 M | 136 M / 136 M | 33.1 | 6.9 |
| Incoherent short segments (1 cm) | 192 M / 182 M | 202 M / 201 M | 18.9 | 2.5 |
| Mixed short segments (1 cm) | 344 M / 337 M | 363 M / 362 M | 15.7 | 1.6 |

Sorting incoherent rays by origin cell buys about 35% for the same work. A stackless traversal was not implemented.

### B3(ii): dense voxel grids

The signed-distance field is voxelised on the GPU from the analytic object list: **114 ms for 256^3 and 892 ms for 512^3** against 400 objects (about 60 G voxel-object tests/s). Bit-packing occupancy takes 3 to 5 ms.

| Kernel, mixed 50/50 rays, 4M rays, median | 256^3 (1.95 mm) | 512^3 (0.98 mm) |
|---|---|---|
| DDA over bit-packed occupancy (storage buffer) | 335 M rays/s | 129 M rays/s |
| Sphere tracing, r32float 3D texture, trilinear sampler | 281 M | 215 M |
| Sphere tracing, r32float 3D texture, `textureLoad` nearest | 663 M | 424 M |
| Sphere tracing, f32 storage buffer, nearest | 644 M | 418 M |
| DDA, short segments (1 cm) | 2.12 G | 535 M |
| Sphere tracing trilinear, short segments (1 cm) | 687 M | 636 M |

Coherent rays reach 2.0 to 2.5 G rays/s with trilinear sphere tracing; incoherent rays fall to 116 to 155 M (appendix). Sphere tracing needs about 6 lookups per ray where DDA needs 34 (256^3) or 70 (512^3), and that ratio decides the long-ray cases. Nearest lookup is twice as fast as hardware trilinear filtering of r32float. A 3D texture and a flat buffer perform the same. All four kernels agree on hit fraction to within half a percentage point.

For this scene a 512^3 distance field answers a mixed ray about 2.7x faster than the 1M-triangle BVH (424 M against 160 M), at the price of 1 mm resolution and 537 MB.

### B4: particle-grid step

Kernel: MLS-MPM-style weakly compressible fluid on a 256^3 grid, 80-byte particles with an APIC affine matrix. Three passes per step: scatter to 27 nodes with atomics (108 atomic adds per particle), grid update over all 16.8M cells, gather from 27 nodes. Buffers: 537 MB of grid plus 80 bytes per particle.

| Particles | Layout and order | Step ms (best / median) | Particle-steps/s (median) | P2G / grid / G2P ms |
|---|---|---|---|---|
| 1.05 M | dense block, sorted | 11.67 / 11.81 | 88.8 M | 6.4 / 4.1 / 1.3 |
| 1.05 M | dense block, shuffled | 15.15 / 15.15 | 69.2 M | 9.0 / 4.1 / 2.0 |
| 1.05 M | dispersed, sorted by cell | 20.48 / 20.56 | 51.0 M | 9.1 / 5.4 / 6.2 |
| 1.05 M | dispersed, shuffled | 31.59 / 32.49 | 32.3 M | 16.2 / 5.6 / 10.2 |
| 4.19 M | dense block, sorted | 34.43 / 34.92 | 120.1 M | 26.0 / 5.2 / 7.2 |
| 4.19 M | dense block, shuffled | 62.55 / 62.87 | 66.7 M | 36.5 / 5.3 / 23.1 |
| 4.19 M | dispersed, sorted by cell | 56.46 / 57.34 | 73.2 M | 34.3 / 5.8 / 16.7 |
| 4.19 M | dispersed, shuffled | 114.19 / 116.80 | 35.9 M | 66.0 / 5.6 / 41.2 |

All of the above use i32 fixed-point `atomicAdd`. Accumulating f32 through a compare-exchange loop instead is 1.4 to 2.8x slower (22.8 to 42.2 M particle-steps/s) and is not reproducible (section 8).

- Particle order is worth 1.3 to 2.0x. A simulation that lets particles disorder will drift from the "sorted" row to the "shuffled" row, so it needs a periodic re-sort. I did not implement or time a GPU sort or the sort/bin alternative to atomics.
- The dense grid pass is a fixed 4 to 6 ms per step however few cells are occupied. At 1M particles that is 17 to 35% of the step; a sparse or blocked grid would recover most of it.

## 7. B5: overheads

| Pattern | Dispatches/s (median) | Each |
|---|---|---|
| One dispatch per pass, encoder and submit; await once at the end | 84.7 k | 11.8 microseconds |
| N passes of one dispatch in one encoder, one submit | 358 k | 2.8 microseconds |
| N dispatches in one pass, rebinding each time | 613 k | 1.6 microseconds |
| N dispatches in one pass, no rebinding | 797 k | 1.3 microseconds |
| Submit and await `onSubmittedWorkDone` after every dispatch | 11.2 k | 89 microseconds |

- Scalar round trip (dispatch, copy 16 bytes, `mapAsync`, read): 0.087 ms best, 0.108 ms median, 0.76 ms worst of 380.
- Cold pipeline creation for the B1 shader: 15.1 ms best, 15.7 ms median.

| Readback | 4 MB | 64 MB | 256 MB |
|---|---|---|---|
| Reused staging buffer: GPU copy + `mapAsync` (best / median ms) | 0.2 / 0.2 | 1.6 / 1.7 | 4.8 / 5.1 |
| plus `getMappedRange` and copy into JS memory | 0.2 / 0.3 | 4.2 / 4.3 | 17.9 / 18.4 |
| Total, reused staging buffer | 0.5 / 0.5 | 5.9 / 6.1 | 23.0 / 23.6 |
| Total, new staging buffer each time | 0.8 / 0.9 | 12.8 / 13.8 | 54.5 / 57.1 |
| Throughput, reused / new | 7.4 / 4.6 GB/s | 10.6 / 4.6 GB/s | 10.9 / 4.5 GB/s |

Upload: `queue.writeBuffer` runs at 6.9 to 7.2 GB/s for 64 and 256 MB (35.5 ms for 256 MB); `mappedAtCreation` is slightly slower at 5.8 to 6.1 GB/s. Readback contents were verified.

Nothing here constrains the design. A full 256 MB state checkpoint costs 24 ms; polling a convergence scalar costs 0.1 ms; a thousand small dispatches in one encoder cost 1 to 3 ms.

No single dispatch in this spike ran longer than about 115 ms and no command buffer longer than about 1.1 s, so I never approached whatever limit macOS puts on a long-running GPU command buffer, and I did not probe where it is.

## 8. B6 and B7: CPU baselines and determinism

### B6: the B1 stencil on the CPU, 2048^2

| Implementation | Threads | Cell-updates/s (best / median) | GPU advantage (4.00 G) |
|---|---|---|---|
| JS typed arrays, idiomatic (f64 intermediates) | 1 | 54.7 M / 54.5 M | 73x |
| JS typed arrays, `Math.fround` everywhere (bit-faithful f32) | 1 | 36.4 M / 35.5 M | 113x |
| JS worker_threads + SharedArrayBuffer | 5 | 260 M / 259 M | 15x |
| JS worker_threads + SharedArrayBuffer | 11 | 320 M / 318 M | 13x |
| C, clang -O3 -ffp-contract=off (strict) | 1 | 179 M / 177 M | 23x |
| C, strict, GCD | 5 | 627 M / 607 M | 6.6x |
| C, strict, GCD | 11 | 884 M / 863 M | 4.6x |
| C, clang -O3 default (FMA contraction allowed) | 11 | 960 M / 919 M | 4.4x |
| C, -ffast-math, for reference only | 11 | 1.15 G / 1.11 G | 3.6x |

- **JS against native:** 3.3x slower single-threaded, 2.7x slower on all cores. The multi-threaded JS result is bit-identical to single-threaded.
- **CPU against GPU:** the GPU is 4.6x the best strict all-core C and 13x the best JS. The efficiency cores add little: 5 to 11 threads gains 23% in JS and 42% in C.
- The C baseline is plain scalar code with whatever the compiler auto-vectorises; I did not hand-vectorise it.

### B7: reproducibility

B1, 1024^2, 200 steps, final buffers compared bytewise:

| Compared with the baseline run | Result |
|---|---|
| Second and third runs, same device | bitwise identical |
| 1 dispatch per submit; all 200 dispatches in one pass | bitwise identical |
| Workgroup 16x16; workgroup 256x1 | bitwise identical |
| rgba32float textures instead of buffers (both read modes) | bitwise identical |
| A second `GPUDevice` in the same process | bitwise identical |
| A separate Node process | bitwise identical |
| Headless Chrome 154, which carries a current Dawn (hash comparison) | bitwise identical |
| JS reference with `Math.fround`, and C with -ffp-contract=off | differs: 77% of floats, max abs diff 3.6 x 10^-7 |
| C with clang's default FMA contraction | differs: 73% of floats, max abs diff 3.0 x 10^-7 |

After a single step the GPU and the strict CPU reference already differ in 14% of floats by at most 6 x 10^-8, about one unit in the last place. The two CPU references agree with each other exactly.

B4, 1M particles, 20 steps:

| Compared | Result |
|---|---|
| i32 fixed-point `atomicAdd`: second and third runs, workgroup 256 instead of 64, a separate process | bitwise identical |
| Same, dense block with heavy contention on each cell | bitwise identical |
| Same: grid after one scatter with the particles in shuffled order against sorted order | bitwise identical |
| f32 compare-exchange accumulation: second run | differs: 56 to 61% of floats, max abs diff up to 1.0 x 10^-3 after 20 steps |
| f32 compare-exchange: grid after a single scatter, second run | differs: 0.6% of floats, max abs diff 7.6 x 10^-6 |

**What is reproducible:** everything, run to run, on this GPU, provided scatter accumulation is integer. That includes across dispatch batching, workgroup size, buffers against textures, devices, processes, and Dawn versions 16 months apart.

**What breaks it:**
1. Floating-point accumulation whose order depends on thread scheduling (the compare-exchange scatter). Use fixed-point integers; they are also faster.
2. Comparing GPU against CPU. The Metal-compiled shader does not round like strict IEEE scalar code, so a CPU reference implementation can validate the GPU to about 10^-7 relative but can never be a bitwise oracle.

Not tested, because this machine has one GPU: a different GPU vendor or a different Apple GPU generation. For an LLM benchmark that must score identically everywhere, treat cross-hardware bit equality as unproven.

## 9. B8: sustained load and memory

### Sustained

B1 at 2048^2 flat-out for 420 s, twice, on AC power, logging every 10 s (full curves in the appendix):

| Run | First 10 s | Minimum | Maximum | Mean | Last 10 s | Total cell-updates | Errors, device loss |
|---|---|---|---|---|---|---|---|
| 1 (16:12) | 3.66 G | 3.32 G at 131 s | 4.01 G | 3.79 G | 3.83 G | 1.59 x 10^12 | none |
| 2 (16:30) | 3.77 G | 3.50 G at 71 s | 3.79 G | 3.65 G | 3.71 G | 1.53 x 10^12 | none |

- **No thermal throttling is visible.** Neither run declines over time; both end within 5% of where they started, and `pmset -g therm` recorded no thermal or performance warning throughout.
- **The variation looks like contention, not heat.** Run 1 dipped to 3.32 G at 131 s and was back at the quiet-machine rate of 4.00 to 4.01 G for 50 consecutive seconds from 211 s, which a thermally limited machine would not do. Run 2 logged the other busy processes in every window: one or two `node` processes at about 100% CPU each from the rigid-body spike, and WindowServer at 30 to 70%, were present for almost the whole run, and GPU-side time per step was 1.07 to 1.26 ms against 1.05 ms when quiet. I did not get a 7-minute run on an otherwise idle machine.
- **No leak.** Node RSS went 191 to 127 MB in run 1 and 197 to 228 MB in run 2, of which 9 MB was in the last five minutes.

### Soak of the particle pipeline

The B4 pipeline (1.05M particles on a 256^3 grid, fixed-point scatter, particles dispersed and shuffled at the start, about 620 MB of GPU buffers) ran flat-out for 900 s on AC power: 44,824 steps, 4.70 x 10^10 particle-steps, mean 52.1 M particle-steps/s.

- The rate rose from 30.9 M in the first 30 s to 55 M by 480 s. I read that as the workload changing, not the machine: the particles fall and settle into a dense layer near the floor (mean height of the probed particles went from 0.22 to 0.02 of the domain), which concentrates the grid traffic in fewer cells. The kernel has the memory-access pattern of a particle-grid fluid but is not a validated fluid solver, and that collapse is a sign of it.
- From 480 s to the end it stayed between 55.2 and 56.1 M. In the 8 windows where no other process was busy it stayed between 55.2 and 56.0 M. This is the cleanest evidence against thermal throttling in the spike: a flat rate from minute 8 to minute 15 of continuous load.
- No uncaptured error, no device loss, every probe of the particle buffer finite. Node RSS was 296 MB in the first window and between 112 and 196 MB after that.

I did not run a single continuous 30-minute job. The sustained evidence is 7 + 7 minutes of B1 and 15 minutes of B4.

### Memory

A growing set of 512 MB storage buffers, every byte touched by a compute pass that reads one buffer and writes the next, result verified:

| Total allocated and in use | Traffic, GB/s (three passes) | Verified | System wired memory | Swap used |
|---|---|---|---|---|
| start | | | 3.2 GB | 4.41 GB |
| 1 GB | 86 / 102 / 106 | yes | 4.4 GB | 4.41 GB |
| 2 GB | 108 / 120 / 122 | yes | 5.4 GB | 4.41 GB |
| 4 GB | 100 / 112 / 107 | yes | 7.4 GB | 4.99 GB |
| 6 GB | 95 / 99 / 98 | yes | 9.4 GB | 6.31 GB |
| 8 GB | 105 / 109 / 108 | yes | 11.4 GB | 7.66 GB |

- **8 GB allocates and runs at full speed**, with no error and no device-lost event.
- **The cost falls on the rest of the machine.** GPU buffers are wired memory. With the user's normal applications open, going from 4 to 8 GB pushed 2.7 GB of other processes into swap. The GPU job did not slow down; everything else would have. Benchmarks I ran in the two minutes afterwards read about 12% low while those pages came back.
- Single buffers: 2 GB and 3.5 GiB work; 4 GiB and above do not (section 3).

Practical ceiling on this 18 GB machine with a desktop session running: design for 2 to 3 GB of GPU buffers, treat 4 GB as the limit.

## 10. B9: headless Chrome

Chrome 154.0.8037.98, new headless mode, default flags, driven by `puppeteer-core` 25.13.0 against the installed Chrome. WebGPU was available without any flag; adapter `apple` / `metal-3`; `maxBufferSize` and `maxStorageBufferBindingSize` 4,294,967,292.

| Grid | Chrome, buffers (best / median) | Chrome, textures (best / median) |
|---|---|---|
| 1024^2 | 3.80 G / 3.78 G | 4.08 G / 3.92 G |
| 2048^2 | 3.79 G / 3.74 G | 4.04 G / 4.03 G |
| 4096^2 | 3.76 G / 3.71 G | 4.02 G / 3.97 G |

Node/Dawn measured within the same five minutes, under the same background load, gave 3.89 G (2048^2) and 3.79 G (4096^2) for buffers and 4.04 G and 3.94 G for textures. **Chrome is within 4% of Node, which is inside the noise.** And the final state after 200 steps is bitwise identical to Node's (section 8).

Only the B1 kernel was run in Chrome. Headful Chrome was not tested.

## 11. Headline throughputs

Measured medians, quiet-machine figures where I have them.

| Benchmark | Configuration | Median |
|---|---|---|
| B1 structured stencil | storage buffers, 1M / 4M / 16M cells | 4.17 / 4.00 / 3.99 G cell-updates/s |
| B1 | rgba32float textures, 1M / 4M / 16M | 4.38 / 4.20 / 4.26 G |
| B1 | 8 bytes per cell (f16 buffers / rgba16float), 4M | 7.54 / 8.17 G |
| B1 sustained 7 min, machine shared | 4M cells | 3.65 to 3.79 G mean, 3.32 G worst 10 s |
| B2 unstructured | Morton order, 2M / 8M cells | 1.61 / 1.55 G cell-updates/s |
| B2 | row-major, 2M / 8M | 1.38 / 1.17 G |
| B2 | shuffled, 2M / 8M | 527 / 486 M |
| B3 BVH, 1.04M triangles | mixed rays, 1M / 4M | 150 / 160 M rays/s |
| B3 BVH | coherent / incoherent, 4M | 366 / 101 M |
| B3 BVH | mixed 1 cm segments, 4M | 362 M |
| B3 BVH build | JS, one thread | 1.49 s |
| B3 voxel 512^3 | sphere trace nearest / trilinear / DDA, mixed, 4M | 424 / 215 / 129 M rays/s |
| B3 voxel 256^3 | sphere trace nearest / trilinear / DDA, mixed, 4M | 663 / 281 / 335 M |
| B3 voxelise SDF on GPU | 400 objects, 256^3 / 512^3 | 0.11 / 0.89 s |
| B4 particle-grid, 256^3 | 1M particles, sorted block to shuffled dispersed | 88.8 to 32.3 M particle-steps/s |
| B4 | 4M particles, same range | 120.1 to 35.9 M |
| B5 | dispatch inside one encoder | 1.3 to 2.8 microseconds |
| B5 | await round trip | 89 microseconds |
| B5 | readback 256 MB, reused staging buffer | 23.6 ms |
| B6 CPU, 4M cells | C strict, 1 / 5 / 11 threads | 177 / 607 / 863 M cell-updates/s |
| B6 CPU | JS, 1 thread / 5 / 11 workers | 54.5 / 259 / 318 M |
| B9 Chrome headless | B1 buffers, 4M cells | 3.74 G cell-updates/s |

## 12. What the budget buys, and how to spend it

### Budget

Take 20 of the 30 minutes as GPU kernel time, leaving 10 for loading, voxelisation, CPU work, readback and slack. The planning rates already allow for a shared machine, which delivered 91 to 95% of the quiet-machine rate on average over the sustained runs and 83% in the worst 10 s. Using the planning rates from section 1:

- **Surface film on a texture atlas:** 4.2 x 10^12 cell-updates. A 2048^2 atlas (4.2M texels, which is 1 mm resolution over 4.2 m^2 of dish surface) can take 1.0 million explicit steps. At 8 bytes per texel, 2.0 million. A 4096^2 atlas takes 250,000.
- **Film on an unstructured surface mesh:** 1.7 x 10^12 cell-updates in Morton order: 2M triangles for 840,000 steps.
- **Tracing water parcels:** 1.8 x 10^11 closest-hit rays against a 1M-triangle BVH, or 4.8 x 10^11 against a 512^3 distance field. That is 1M parcels traced 180,000 or 480,000 times.
- **Fully 3D particle fluid:** 4 x 10^10 to 1.4 x 10^11 particle-steps: 1M particles for 40,000 to 140,000 steps.

The last line is the one that shapes the architecture. Whatever the time step, 40,000 to 140,000 steps of a 1M-particle fluid covers seconds of physical time, not the tens of minutes of a wash cycle. The stencil and ray budgets, by contrast, are large enough to follow surface film and soil over a meaningful stretch of a cycle. That points toward resolving jets and impingement with rays or short particle bursts and carrying the long timescales on surface fields. That inference is mine, from the ratios; the spike did not test any physics.

These kernels compete for the same GPU and the same memory bandwidth. The 20 minutes is shared between them, not available to each.

### Engineering patterns

1. **Count bytes, not flops.** Put only hot state in the buffers a kernel reads and writes each step. Store as f16 where 11 bits of mantissa is enough; it doubles stencil throughput. Fuse passes rather than splitting them: extra arithmetic in a pass is free, an extra pass over the data is not.
2. **Batch dispatches, do not await each one.** Encode 16 to 64 steps per command buffer, sized so one command buffer is 50 to 250 ms of GPU work, and `await onSubmittedWorkDone()` every 2 to 4 submits to bound the queue. Never await per step on small grids.
3. **Keep data spatially ordered.** Morton-number unstructured cells at load time (about 3x over random). Re-sort particles by cell periodically (1.3 to 2x). Sort ray or parcel batches by origin cell (1.35x).
4. **Scatter with i32 fixed-point `atomicAdd`.** It is reproducible and 1.4 to 2.8x faster than float compare-exchange.
5. **Buffers or textures: either.** Textures are 5 to 8% faster for stencils and give 2D addressing; buffers give atomics and arbitrary structs. Workgroup size needs no tuning.
6. **For rays, prefer a distance field with nearest lookup where 1 to 2 mm resolution is acceptable**, and keep the BVH for exact surface hits. Voxelising analytic shapes at 512^3 takes under a second, so it can be redone on every load.
7. **Readback:** reuse one staging buffer. Poll scalars freely (0.1 ms). Checkpoint full state when needed (24 ms per 256 MB).
8. **Guard rails in the wrapper:** request limits explicitly; assert every binding is under 4 GiB; hold a reference to the `create()` result; stay under 4 GB of GPU buffers in total; listen for `device.lost` and uncaptured errors (none occurred in any run here).
9. **Determinism:** rely on run-to-run bit equality on one machine. Validate against a CPU reference with a tolerance, not bitwise.

## 13. Go / no-go

**Go on WebGPU compute as the kernel substrate, and on Node + Dawn as the headless driver**, subject to resolving the version question in section 3.

Evidence for: a mean of 3.65 to 3.79 G cell-updates/s over two 7-minute runs on a shared machine, with no decline over time (4.0 G when the machine is quiet); no error, validation failure or device loss in any benchmark; flat process memory; bitwise reproducibility across runs, processes and Dawn versions; API overheads in microseconds; 8 GB of buffers usable; same WGSL, same speed and same bits in Chrome.

Evidence against, or missing:
- The current `webgpu` package does not load on this machine's OS. Pinning 0.3.0 means a June 2025 Dawn.
- The longest continuous run was 15 minutes, not 30.
- Bindings of 4 GiB and above fail silently.
- Nothing here ran on battery or in low-power mode.

**Fallback if Node + Dawn is rejected:** headless Chrome driven by `puppeteer-core` against the installed Chrome. Measured at parity for B1 and bit-identical. It costs a browser process, a 4 GiB buffer cap (harmless), and data transfer through the DevTools protocol rather than direct memory, which I did not measure.

## 14. Files and reproduction

### Reproduce

```
cd spikes/gpu-compute
npm ci                                  # webgpu 0.3.0, puppeteer-core 25.13.0 (package-lock.json)
node b0_env.mjs                         # B0
node b1_stencil.mjs                     # B1, about 6.5 min       (add "quick" for a short run)
node b1x_extras.mjs                     # B1 bytes-per-cell experiment
DAWN_FLAGS="enable-dawn-features=allow_unsafe_apis,disable_robustness" node b1x_extras.mjs
node b2_unstructured.mjs                # B2
node b3a_bvh.mjs                        # B3(i)
node b3b_voxel.mjs                      # B3(ii)
node b4_mpm.mjs                         # B4
node b5_overheads.mjs                   # B5
node b6_cpu_js.mjs && ./b6_run_c.sh     # B6 (the JS run writes out/init_2048x2048.bin, which the C run reads)
node b7_determinism.mjs                 # B7 (needs the b6_stencil_* binaries for the C comparison)
node b8_sustained.mjs 420 2048          # B8 sustained
node b8_memory.mjs 8                    # B8 memory; pushes other applications into swap
node b8_memory.mjs 8 single-only        # single large buffers
node b8_bigbuffer.mjs                   # the 4 GiB boundary
node b8d_soak_mpm.mjs 900               # 15-minute particle soak
node b9_chrome.mjs headless             # B9
node b9b_chrome_hash.mjs                # Chrome against Node bit comparison
node report_tables.mjs                  # regenerates the appendix tables from out/*.json
```

The three C binaries of B6 (`b6_stencil_strict`, `b6_stencil_default`, `b6_stencil_fast`) are not in the repository: `b6_run_c.sh` builds them with clang, and `b7_determinism.mjs` needs them for its C comparison.

Raw JSON is in `out/`. Shared code: `lib.mjs` (device, timing, readback), `benchlock.mjs` (cross-process lock), `stencil.mjs` and `stencil_js.mjs` (B1 WGSL and CPU references), `scene.mjs` and `bvh.mjs` (scene, BVH builder, JS tracer), `mpm.mjs` (B4 kernels). Every GPU script takes the lock in `getDevice()`, so two of them started together run one after the other; `BENCH_NOLOCK=1` opts out.

### An overlap during the run

Two benchmark runs overlapped from 15:49 to 15:53 and each read about half speed. Everything from that window was discarded and re-measured, and the lock above was added so that it cannot happen again.

---

# Appendix: generated tables

Produced by `report_tables.mjs` from `out/*.json`.

### B1 dispatches-per-submit sweep (storage buffers, 8x8 workgroups; cell-updates/s, best / median of 5)

| dispatches per submit | 1024^2 separate passes | 1024^2 one pass | 2048^2 separate passes | 2048^2 one pass | 4096^2 separate passes | 4096^2 one pass |
|---|---|---|---|---|---|---|
| 1 | 4.04 G / 3.99 G | - | 4.05 G / 4.04 G | - | 4.02 G / 3.95 G | - |
| 2 | 4.12 G / 3.99 G | - | 4.03 G / 4.03 G | - | 3.98 G / 3.93 G | - |
| 4 | 4.05 G / 3.94 G | 4.11 G / 4.01 G | 3.92 G / 3.84 G | 3.96 G / 3.92 G | 3.96 G / 3.83 G | 4.01 G / 3.98 G |
| 8 | 4.11 G / 4.09 G | - | 4.05 G / 4.03 G | - | 4.00 G / 3.99 G | - |
| 16 | 4.11 G / 4.00 G | 4.18 G / 4.09 G | 4.05 G / 4.00 G | 4.01 G / 3.92 G | 4.01 G / 4.00 G | 4.02 G / 3.97 G |
| 32 | 4.20 G / 4.17 G | - | 4.01 G / 4.00 G | - | 4.02 G / 3.99 G | - |
| 64 | 4.19 G / 4.18 G | 4.18 G / 4.16 G | 4.03 G / 4.01 G | 4.04 G / 4.03 G | 4.02 G / 4.02 G | 4.02 G / 4.01 G |
| 128 | 4.21 G / 4.17 G | - | 4.02 G / 4.02 G | - | 3.99 G / 3.98 G | - |
| 256 | 4.19 G / 3.87 G | 3.86 G / 3.84 G | 4.03 G / 4.02 G | 4.04 G / 4.02 G | 4.02 G / 4.01 G | 4.02 G / 4.02 G |

### B1 steps/s and spread at the chosen batching (k=32, separate passes)

| grid | cells | steps/s best | steps/s median | spread | cell-updates/s median | GPU-only time per step (timestamp-query) | implied by timestamps |
|---|---|---|---|---|---|---|---|
| 1024x1024 | 1.0 M | 4010.0 | 3973.8 | 1.8% | 4.17 G | 0.250 ms | 4.20 G |
| 2048x2048 | 4.2 M | 956.7 | 952.6 | 1.2% | 4.00 G | 1.049 ms | 4.00 G |
| 4096x4096 | 16.8 M | 239.6 | 237.8 | 3.1% | 3.99 G | 4.174 ms | 4.02 G |

### B1 variants (cell-updates/s, best / median of 5)

| variant | 1024^2 | 2048^2 | 4096^2 |
|---|---|---|---|
| buffer 8x8 k=1 awaitEvery=1 | 2.55 G / 2.44 G | 3.43 G / 3.39 G | 3.81 G / 3.80 G |
| buffer 8x8 k=16 awaitEvery=1 | 3.87 G / 3.82 G | 3.83 G / 3.80 G | 4.01 G / 4.01 G |
| buffer 8x8 k=16 awaitEvery=4 | 3.90 G / 3.83 G | 4.00 G / 3.99 G | 4.01 G / 4.00 G |
| buffer 16x16 k=32 | 4.05 G / 3.90 G | 4.02 G / 4.01 G | 3.99 G / 3.98 G |
| buffer 32x8 k=32 | 4.19 G / 4.08 G | 4.02 G / 4.00 G | 3.99 G / 3.94 G |
| buffer 32x32 k=32 | 4.18 G / 4.12 G | 3.76 G / 3.72 G | 3.90 G / 3.87 G |
| buffer 64x4 k=32 | 4.16 G / 4.13 G | 3.93 G / 3.78 G | 3.92 G / 3.77 G |
| buffer 4x4 k=32 | 4.15 G / 4.11 G | 3.95 G / 3.90 G | 3.97 G / 3.95 G |
| buffer 256x1 k=32 | 4.20 G / 4.19 G | 4.01 G / 3.97 G | 4.00 G / 3.96 G |
| texture(sampled) 8x8 k=32 | 4.39 G / 4.38 G | 4.26 G / 4.20 G | 4.27 G / 4.26 G |
| texture(sampled) 16x16 k=32 | 4.40 G / 4.38 G | 4.34 G / 4.24 G | 4.28 G / 4.26 G |
| texture(storage) 8x8 k=32 | 4.39 G / 4.38 G | 4.28 G / 4.24 G | 4.31 G / 4.30 G |
| texture(storage) 16x16 k=32 | 4.41 G / 4.40 G | 4.32 G / 4.27 G | 4.31 G / 4.29 G |

### B1 extras: arithmetic-bound or memory-bound?

| grid | variant | bytes/cell | cell-updates/s best | median | spread |
|---|---|---|---|---|---|
| 2048x2048 | vec4f buffers (baseline, 16 B/cell) | 16 | 3.92 G | 3.89 G | 1.8% |
| 2048x2048 | vec4f buffers, update evaluated twice (2x flops) | 16 | 3.96 G | 3.94 G | 0.7% |
| 2048x2048 | vec4<f16> buffers (8 B/cell), f32 arithmetic | 8 | 7.64 G | 7.54 G | 4.6% |
| 2048x2048 | rgba32float textures (16 B/cell) | 16 | 4.09 G | 4.04 G | 2.3% |
| 2048x2048 | rgba16float textures (8 B/cell) | 8 | 8.22 G | 8.17 G | 1.6% |
| 4096x4096 | vec4f buffers (baseline, 16 B/cell) | 16 | 3.82 G | 3.79 G | 1.2% |
| 4096x4096 | vec4f buffers, update evaluated twice (2x flops) | 16 | 3.77 G | 3.76 G | 1.9% |
| 4096x4096 | vec4<f16> buffers (8 B/cell), f32 arithmetic | 8 | 7.40 G | 7.30 G | 2.3% |
| 4096x4096 | rgba32float textures (16 B/cell) | 16 | 4.02 G | 3.94 G | 3.4% |
| 4096x4096 | rgba16float textures (8 B/cell) | 8 | 8.27 G | 7.96 G | 7.8% |

### B1 extras with Dawn robustness disabled (enable-dawn-features=allow_unsafe_apis,disable_robustness)

| grid | variant | bytes/cell | cell-updates/s best | median | spread |
|---|---|---|---|---|---|
| 2048x2048 | vec4f buffers (baseline, 16 B/cell) | 16 | 3.84 G | 3.83 G | 3.9% |
| 2048x2048 | vec4f buffers, update evaluated twice (2x flops) | 16 | 3.87 G | 3.86 G | 1.5% |
| 2048x2048 | vec4<f16> buffers (8 B/cell), f32 arithmetic | 8 | 7.74 G | 7.72 G | 3.7% |
| 2048x2048 | rgba32float textures (16 B/cell) | 16 | 4.12 G | 4.09 G | 2.4% |
| 2048x2048 | rgba16float textures (8 B/cell) | 8 | 8.27 G | 8.23 G | 3.4% |
| 4096x4096 | vec4f buffers (baseline, 16 B/cell) | 16 | 3.82 G | 3.82 G | 0.7% |
| 4096x4096 | vec4f buffers, update evaluated twice (2x flops) | 16 | 3.76 G | 3.74 G | 4.2% |
| 4096x4096 | vec4<f16> buffers (8 B/cell), f32 arithmetic | 8 | 7.50 G | 7.33 G | 5.6% |
| 4096x4096 | rgba32float textures (16 B/cell) | 16 | 4.01 G | 3.98 G | 4.7% |
| 4096x4096 | rgba16float textures (8 B/cell) | 8 | 8.22 G | 8.10 G | 3.3% |

### B2 unstructured finite-volume stencil

| cells | ordering | workgroup | mean abs(i - neighbour) | steps/s best | steps/s median | cell-updates/s best | median | spread |
|---|---|---|---|---|---|---|---|---|
| 2.0 M | row-major | 64 | 666 | 691.2 | 690.2 | 1.38 G | 1.38 G | 1.6% |
| 2.0 M | row-major | 256 | 666 | 820.2 | 819.1 | 1.64 G | 1.64 G | 1.1% |
| 2.0 M | morton | 64 | 646 | 806.1 | 803.7 | 1.61 G | 1.61 G | 0.8% |
| 2.0 M | shuffled | 64 | 666.7 k | 264.9 | 263.7 | 529.8 M | 527.3 M | 0.6% |
| 8.0 M | row-major | 64 | 1.3 k | 145.9 | 145.9 | 1.17 G | 1.17 G | 0.4% |
| 8.0 M | row-major | 256 | 1.3 k | 149.0 | 148.8 | 1.19 G | 1.19 G | 1.2% |
| 8.0 M | morton | 64 | 2.6 k | 193.9 | 193.3 | 1.55 G | 1.55 G | 0.5% |
| 8.0 M | shuffled | 64 | 3 M | 61.0 | 60.7 | 488.2 M | 485.8 M | 1.2% |

### B3(i) BVH: 1.0 M triangles, 400 objects; build 1398 ms best / 1493 ms median (JS, 1 thread); 665.2 k nodes, depth 26, 21.3 MB nodes + 49.8 MB triangles

| rays | ray set | workgroup | rays/s best | rays/s median | spread | ms best | hit % | BVH nodes/ray | triangle tests/ray | GPU vs JS disagreements |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.0 M | coherent (16 jet cones) | 64 | 291.6 M | 290.2 M | 35% | 3.6 | 96.1 | 37.5 | 8.5 | 0/1501 |
| 1.0 M | incoherent (random o,d) | 64 | 99.2 M | 99.0 M | 2% | 10.6 | 67.9 | 33.1 | 6.9 | 0/1501 |
| 1.0 M | mixed 50/50 | 64 | 150.7 M | 149.7 M | 14% | 7.0 | 82.0 | 35.3 | 7.7 | 0/1501 |
| 1.0 M | mixed 50/50 | 256 | 149.2 M | 148.6 M | 3% | 7.0 | 82.0 | 35.3 | 7.7 | - |
| 1.0 M | incoherent, Morton-sorted by origin | 64 | 135.6 M | 131.6 M | 24% | 7.7 | 67.9 | 33.1 | 6.9 | 0/1501 |
| 1.0 M | incoherent short segments (tmax 1 cm) | 64 | 191.6 M | 182.2 M | 30% | 5.5 | 19.0 | 18.9 | 2.5 | 0/1501 |
| 1.0 M | mixed 50/50 short segments (tmax 1 cm) | 64 | 344.0 M | 336.6 M | 25% | 3.0 | 11.0 | 15.7 | 1.6 | 0/1501 |
| 4.2 M | coherent (16 jet cones) | 64 | 366.5 M | 365.9 M | 11% | 11.4 | 96.1 | 37.5 | 8.5 | 0/1501 |
| 4.2 M | incoherent (random o,d) | 64 | 101.6 M | 100.9 M | 2% | 41.3 | 67.9 | 33.1 | 6.9 | 0/1501 |
| 4.2 M | mixed 50/50 | 64 | 161.1 M | 160.2 M | 3% | 26.0 | 82.0 | 35.3 | 7.7 | 0/1501 |
| 4.2 M | mixed 50/50 | 256 | 161.7 M | 159.7 M | 3% | 25.9 | 82.0 | 35.3 | 7.7 | - |
| 4.2 M | incoherent, Morton-sorted by origin | 64 | 135.7 M | 135.6 M | 1% | 30.9 | 67.9 | 33.1 | 6.9 | 0/1501 |
| 4.2 M | incoherent short segments (tmax 1 cm) | 64 | 201.9 M | 201.0 M | 2% | 20.8 | 19.1 | 18.9 | 2.5 | 0/1501 |
| 4.2 M | mixed 50/50 short segments (tmax 1 cm) | 64 | 363.1 M | 361.6 M | 4% | 11.6 | 11.0 | 15.7 | 1.6 | 0/1501 |

### B3(ii) voxel grids: GPU voxelisation

| grid | voxel | objects | SDF voxelise (GPU) | voxel-object tests/s | occupancy bit-pack | texture->buffer copy | occupied |
|---|---|---|---|---|---|---|---|
| 256^3 | 1.95 mm | 400 | 114 ms | 58.86 G | 3 ms | 3 ms | 20.6% |
| 512^3 | 0.98 mm | 400 | 892 ms | 60.16 G | 5 ms | 25 ms | 17.9% |

### B3(ii) voxel grids: rays/s (best / median of 5)

| grid | rays | ray set | kernel | rays/s best | rays/s median | spread | hit % | steps/ray |
|---|---|---|---|---|---|---|---|---|
| 256^3 | 1.0 M | mixed 50/50 | DDA / bit-packed occupancy buffer | 291.5 M | 238.5 M | 57% | 83.7 | 33.8 |
| 256^3 | 1.0 M | mixed 50/50 | sphere trace / r32float 3D texture, trilinear sampler | 284.6 M | 278.8 M | 6% | 83.4 | 5.3 |
| 256^3 | 1.0 M | mixed 50/50 | sphere trace / r32float 3D texture, textureLoad nearest | 671.0 M | 656.9 M | 4% | 83.7 | 5.0 |
| 256^3 | 1.0 M | mixed 50/50 | sphere trace / f32 storage buffer, nearest | 555.5 M | 531.2 M | 15% | 83.7 | 5.0 |
| 256^3 | 1.0 M | coherent (16 jet cones) | DDA / bit-packed occupancy buffer | 703.4 M | 512.8 M | 50% | 97.0 | 34.1 |
| 256^3 | 1.0 M | coherent (16 jet cones) | sphere trace / r32float 3D texture, trilinear sampler | 1.73 G | 1.62 G | 17% | 96.8 | 5.9 |
| 256^3 | 1.0 M | incoherent (random o,d) | DDA / bit-packed occupancy buffer | 198.0 M | 197.3 M | 6% | 70.4 | 33.5 |
| 256^3 | 1.0 M | incoherent (random o,d) | sphere trace / r32float 3D texture, trilinear sampler | 141.7 M | 140.3 M | 8% | 70.0 | 4.7 |
| 256^3 | 1.0 M | mixed 50/50 short segments (tmax 1 cm) | DDA / bit-packed occupancy buffer | 1.90 G | 1.76 G | 16% | 25.0 | 7.0 |
| 256^3 | 1.0 M | mixed 50/50 short segments (tmax 1 cm) | sphere trace / r32float 3D texture, trilinear sampler | 661.0 M | 639.5 M | 9% | 24.1 | 1.3 |
| 256^3 | 4.2 M | mixed 50/50 | DDA / bit-packed occupancy buffer | 335.7 M | 334.6 M | 4% | 83.7 | 33.8 |
| 256^3 | 4.2 M | mixed 50/50 | sphere trace / r32float 3D texture, trilinear sampler | 282.1 M | 280.9 M | 4% | 83.4 | 5.3 |
| 256^3 | 4.2 M | mixed 50/50 | sphere trace / r32float 3D texture, textureLoad nearest | 677.0 M | 663.0 M | 6% | 83.7 | 5.0 |
| 256^3 | 4.2 M | mixed 50/50 | sphere trace / f32 storage buffer, nearest | 648.2 M | 643.6 M | 1% | 83.7 | 5.0 |
| 256^3 | 4.2 M | coherent (16 jet cones) | DDA / bit-packed occupancy buffer | 901.3 M | 894.3 M | 5% | 97.0 | 34.0 |
| 256^3 | 4.2 M | coherent (16 jet cones) | sphere trace / r32float 3D texture, trilinear sampler | 2.66 G | 2.52 G | 7% | 96.8 | 5.9 |
| 256^3 | 4.2 M | incoherent (random o,d) | DDA / bit-packed occupancy buffer | 211.7 M | 208.2 M | 2% | 70.4 | 33.5 |
| 256^3 | 4.2 M | incoherent (random o,d) | sphere trace / r32float 3D texture, trilinear sampler | 155.5 M | 154.7 M | 3% | 70.1 | 4.7 |
| 256^3 | 4.2 M | mixed 50/50 short segments (tmax 1 cm) | DDA / bit-packed occupancy buffer | 2.16 G | 2.12 G | 7% | 25.0 | 7.0 |
| 256^3 | 4.2 M | mixed 50/50 short segments (tmax 1 cm) | sphere trace / r32float 3D texture, trilinear sampler | 697.7 M | 687.5 M | 4% | 24.1 | 1.3 |
| 512^3 | 1.0 M | mixed 50/50 | DDA / bit-packed occupancy buffer | 123.5 M | 121.4 M | 4% | 83.3 | 70.4 |
| 512^3 | 1.0 M | mixed 50/50 | sphere trace / r32float 3D texture, trilinear sampler | 215.6 M | 214.8 M | 1% | 83.1 | 6.1 |
| 512^3 | 1.0 M | mixed 50/50 | sphere trace / r32float 3D texture, textureLoad nearest | 417.8 M | 416.4 M | 1% | 83.3 | 5.8 |
| 512^3 | 1.0 M | mixed 50/50 | sphere trace / f32 storage buffer, nearest | 401.7 M | 401.6 M | 14% | 83.3 | 5.8 |
| 512^3 | 1.0 M | coherent (16 jet cones) | DDA / bit-packed occupancy buffer | 393.6 M | 392.8 M | 1% | 96.8 | 71.5 |
| 512^3 | 1.0 M | coherent (16 jet cones) | sphere trace / r32float 3D texture, trilinear sampler | 1.44 G | 1.44 G | 2% | 96.7 | 6.8 |
| 512^3 | 1.0 M | incoherent (random o,d) | DDA / bit-packed occupancy buffer | 66.4 M | 65.7 M | 2% | 69.7 | 69.3 |
| 512^3 | 1.0 M | incoherent (random o,d) | sphere trace / r32float 3D texture, trilinear sampler | 115.4 M | 115.2 M | 0% | 69.5 | 5.4 |
| 512^3 | 1.0 M | mixed 50/50 short segments (tmax 1 cm) | DDA / bit-packed occupancy buffer | 518.6 M | 511.6 M | 8% | 22.8 | 13.5 |
| 512^3 | 1.0 M | mixed 50/50 short segments (tmax 1 cm) | sphere trace / r32float 3D texture, trilinear sampler | 599.0 M | 585.3 M | 58% | 22.4 | 1.4 |
| 512^3 | 4.2 M | mixed 50/50 | DDA / bit-packed occupancy buffer | 129.1 M | 128.6 M | 2% | 83.3 | 70.4 |
| 512^3 | 4.2 M | mixed 50/50 | sphere trace / r32float 3D texture, trilinear sampler | 214.8 M | 214.6 M | 0% | 83.1 | 6.1 |
| 512^3 | 4.2 M | mixed 50/50 | sphere trace / r32float 3D texture, textureLoad nearest | 424.8 M | 424.1 M | 9% | 83.3 | 5.8 |
| 512^3 | 4.2 M | mixed 50/50 | sphere trace / f32 storage buffer, nearest | 419.6 M | 417.7 M | 1% | 83.3 | 5.8 |
| 512^3 | 4.2 M | coherent (16 jet cones) | DDA / bit-packed occupancy buffer | 450.0 M | 448.8 M | 0% | 96.8 | 71.5 |
| 512^3 | 4.2 M | coherent (16 jet cones) | sphere trace / r32float 3D texture, trilinear sampler | 2.06 G | 2.05 G | 4% | 96.7 | 6.8 |
| 512^3 | 4.2 M | incoherent (random o,d) | DDA / bit-packed occupancy buffer | 66.7 M | 66.0 M | 2% | 69.8 | 69.3 |
| 512^3 | 4.2 M | incoherent (random o,d) | sphere trace / r32float 3D texture, trilinear sampler | 116.4 M | 115.9 M | 1% | 69.6 | 5.4 |
| 512^3 | 4.2 M | mixed 50/50 short segments (tmax 1 cm) | DDA / bit-packed occupancy buffer | 539.2 M | 534.7 M | 1% | 22.8 | 13.5 |
| 512^3 | 4.2 M | mixed 50/50 short segments (tmax 1 cm) | sphere trace / r32float 3D texture, trilinear sampler | 637.4 M | 635.6 M | 1% | 22.4 | 1.4 |

### B4 MLS-MPM-style step on a 256^3 grid

| particles | layout | order | accumulation | step ms best | step ms median | particle-steps/s best | median | spread | P2G ms | grid ms | G2P ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.0 M | block | sorted | i32 fixed-point atomicAdd | 11.67 | 11.81 | 89.8 M | 88.8 M | 1% | 6.42 | 4.13 | 1.31 |
| 1.0 M | block | shuffled | i32 fixed-point atomicAdd | 15.15 | 15.15 | 69.2 M | 69.2 M | 1% | 8.98 | 4.06 | 2.03 |
| 1.0 M | dispersed | sorted | i32 fixed-point atomicAdd | 20.48 | 20.56 | 51.2 M | 51.0 M | 2% | 9.11 | 5.44 | 6.23 |
| 1.0 M | dispersed | shuffled | i32 fixed-point atomicAdd | 31.59 | 32.49 | 33.2 M | 32.3 M | 10% | 16.19 | 5.64 | 10.16 |
| 1.0 M | block | sorted | f32 compare-exchange loop | 26.28 | 27.24 | 39.9 M | 38.5 M | 4% | 26.87 | 4.13 | 1.31 |
| 1.0 M | dispersed | shuffled | f32 compare-exchange loop | 45.20 | 46.08 | 23.2 M | 22.8 M | 3% | 28.18 | 6.23 | 10.81 |
| 4.2 M | block | sorted | i32 fixed-point atomicAdd | 34.43 | 34.92 | 121.8 M | 120.1 M | 6% | 26.02 | 5.24 | 7.21 |
| 4.2 M | block | shuffled | i32 fixed-point atomicAdd | 62.55 | 62.87 | 67.1 M | 66.7 M | 1% | 36.50 | 5.31 | 23.07 |
| 4.2 M | dispersed | sorted | i32 fixed-point atomicAdd | 56.46 | 57.34 | 74.3 M | 73.2 M | 2% | 34.28 | 5.83 | 16.71 |
| 4.2 M | dispersed | shuffled | i32 fixed-point atomicAdd | 114.19 | 116.80 | 36.7 M | 35.9 M | 6% | 65.99 | 5.57 | 41.16 |
| 4.2 M | block | sorted | f32 compare-exchange loop | 85.47 | 99.32 | 49.1 M | 42.2 M | 21% | 75.17 | 4.39 | 5.77 |
| 4.2 M | dispersed | shuffled | f32 compare-exchange loop | 161.73 | 163.09 | 25.9 M | 25.7 M | 5% | 113.84 | 5.64 | 40.44 |

### B5 tiny dispatches

| pattern | dispatches/s best | median | microseconds each | spread |
|---|---|---|---|---|
| 1 dispatch / pass / encoder / submit (await at end) | 90.6 k | 84.7 k | 11.8 | 10% |
| N passes (1 dispatch each) in ONE encoder, one submit | 360.2 k | 357.8 k | 2.8 | 4% |
| N dispatches in ONE pass (setBindGroup each), one submit | 616.5 k | 612.6 k | 1.6 | 1% |
| N dispatches in ONE pass (no rebinding), one submit | 808.8 k | 796.8 k | 1.3 | 3% |
| submit + await onSubmittedWorkDone after EVERY dispatch | 11.9 k | 11.2 k | 89.2 | 15% |

Scalar round trip (dispatch + 16-byte copy + mapAsync): 0.087 ms best, 0.108 ms median, 0.761 ms worst of 380.
Cold pipeline creation (B1 WGSL): 15.1 ms best, 15.7 ms median; first dispatch 0.6 ms.

### B5 readback (ms, best / median of 5)

| size | staging buffer | GPU copy + mapAsync | getMappedRange + copy to JS | total | MB/s (median) | zero-copy view total | data verified |
|---|---|---|---|---|---|---|---|
| 4 MB | new each time | 0.3 / 0.3 | 0.5 / 0.6 | 0.8 / 0.9 | 4594 | - | true |
| 4 MB | reused | 0.2 / 0.2 | 0.2 / 0.3 | 0.5 / 0.5 | 7370 | 0.2 / 0.2 | true |
| 64 MB | new each time | 3.4 / 4.5 | 9.3 / 9.3 | 12.8 / 13.8 | 4643 | - | true |
| 64 MB | reused | 1.6 / 1.7 | 4.2 / 4.3 | 5.9 / 6.1 | 10567 | 1.9 / 2.0 | true |
| 256 MB | new each time | 15.7 / 16.1 | 38.4 / 40.0 | 54.5 / 57.1 | 4480 | - | true |
| 256 MB | reused | 4.8 / 5.1 | 17.9 / 18.4 | 23.0 / 23.6 | 10868 | 5.6 / 6.0 | true |

### B5 upload (ms, best / median of 5)

| size | queue.writeBuffer until GPU done | of which the call itself (median) | MB/s | mappedAtCreation + set + unmap | MB/s |
|---|---|---|---|---|---|
| 4 MB | 0.1 / 0.4 | 0.3 | 11354 | 0.3 / 1.5 | 2713 |
| 64 MB | 8.7 / 9.3 | 6.4 | 6903 | 10.0 / 10.6 | 6058 |
| 256 MB | 34.8 / 35.5 | 26.1 | 7210 | 42.0 / 44.1 | 5811 |

### B6 CPU baselines, JavaScript, 2048x2048

| implementation | variant | threads | cell-updates/s best | median | spread | identical to 1-thread result |
|---|---|---|---|---|---|---|
| JS single thread | f64 intermediates (idiomatic) | 1 | 54.7 M | 54.5 M | 2% | - |
| JS single thread | f32 via Math.fround (bit-faithful) | 1 | 36.4 M | 35.5 M | 4% | - |
| JS worker_threads + SharedArrayBuffer | f64 | 2 | 108.9 M | 108.5 M | 1% | true |
| JS worker_threads + SharedArrayBuffer | f64 | 5 | 259.9 M | 258.5 M | 1% | true |
| JS worker_threads + SharedArrayBuffer | f64 | 8 | 271.5 M | 269.8 M | 2% | true |
| JS worker_threads + SharedArrayBuffer | f64 | 11 | 319.6 M | 318.4 M | 3% | true |
| JS worker_threads + SharedArrayBuffer | f32 | 2 | 72.8 M | 72.3 M | 1% | true |
| JS worker_threads + SharedArrayBuffer | f32 | 5 | 174.4 M | 173.5 M | 2% | true |
| JS worker_threads + SharedArrayBuffer | f32 | 8 | 180.6 M | 176.4 M | 6% | true |
| JS worker_threads + SharedArrayBuffer | f32 | 11 | 188.0 M | 186.0 M | 3% | true |

### B6 CPU baselines, C (clang 16, -O3 -mcpu=native, GCD dispatch_apply), 2048x2048

| FP mode | threads | cell-updates/s best | median | worst |
|---|---|---|---|---|
| -ffp-contract=off (strict IEEE, no FMA) | 1 | 178.8 M | 177.2 M | 170.2 M |
| -ffp-contract=off (strict IEEE, no FMA) | 2 | 350.8 M | 347.7 M | 327.9 M |
| -ffp-contract=off (strict IEEE, no FMA) | 5 | 627.3 M | 607.4 M | 542.2 M |
| -ffp-contract=off (strict IEEE, no FMA) | 8 | 780.6 M | 671.6 M | 582.6 M |
| -ffp-contract=off (strict IEEE, no FMA) | 11 | 884.1 M | 862.9 M | 791.9 M |
| clang default (fp-contract=on) | 1 | 191.2 M | 189.6 M | 183.4 M |
| clang default (fp-contract=on) | 2 | 374.7 M | 371.6 M | 369.7 M |
| clang default (fp-contract=on) | 5 | 693.0 M | 667.9 M | 507.8 M |
| clang default (fp-contract=on) | 8 | 844.3 M | 736.7 M | 675.8 M |
| clang default (fp-contract=on) | 11 | 959.6 M | 919.3 M | 888.0 M |
| -ffast-math (reference only) | 1 | 223.4 M | 221.1 M | 204.5 M |
| -ffast-math (reference only) | 2 | 435.1 M | 417.4 M | 408.3 M |
| -ffast-math (reference only) | 5 | 790.1 M | 775.4 M | 689.4 M |
| -ffast-math (reference only) | 8 | 957.6 M | 918.5 M | 871.0 M |
| -ffast-math (reference only) | 11 | 1.1 G | 1.1 G | 1.0 G |

### B7 determinism

B1 1024x1024, 200 steps, hash ba69c15a8d62ffc6

| B1 comparison against the baseline run | result |
|---|---|
| second run, same device, same settings | bitwise identical |
| third run | bitwise identical |
| 1 dispatch per submit (k=1) | bitwise identical |
| all 200 dispatches in one pass / one submit | bitwise identical |
| workgroup 16x16 | bitwise identical |
| workgroup 256x1 | bitwise identical |
| rgba32float texture formulation (sampled read) | bitwise identical |
| rgba32float texture formulation (storage read) | bitwise identical |
| a second GPUDevice in the same process | bitwise identical |
| vs JS reference with Math.fround (strict f32, no FMA) | differs: 3221079 of 4194304 floats, max abs diff 3.58e-7 |
| vs C clang -O3 -ffp-contract=off (strict) | differs: 3221079 of 4194304 floats, max abs diff 3.58e-7 |
| vs C clang -O3 default (fp-contract=on, FMA allowed) | differs: 3064538 of 4194304 floats, max abs diff 2.98e-7 |
| a separate node process | bitwise identical |

After one step, GPU vs JS f32 reference: 592665 of 4194304 floats differ, max abs diff 5.96e-8.

| B4 comparison | result |
|---|---|
| fixed-point i32 atomicAdd: second run (dispersed, shuffled) | bitwise identical |
| fixed-point i32 atomicAdd: third run | bitwise identical |
| fixed-point i32 atomicAdd: workgroup 256 instead of 64 | bitwise identical |
| fixed-point, dense block (8 particles/cell, heavy contention): 2nd run | bitwise identical |
| fixed-point: grid after scatter, particles in shuffled order vs sorted order | bitwise identical |
| f32 compare-exchange accumulation, dense block: second run | differs: 12872344 of 20971520 floats, max abs diff 2.92e-4 |
| f32 compare-exchange accumulation, dispersed: second run | differs: 11716016 of 20971520 floats, max abs diff 1.00e-3 |
| f32 CAS: grid after ONE scatter, second run | differs: 394581 of 67108864 floats, max abs diff 7.63e-6 |
| f32 CAS: grid after scatter, shuffled vs sorted particle order | differs: 524761 of 67108864 floats, max abs diff 1.05e-5 |
| fixed-point, a separate node process | bitwise identical |

### B8 sustained load (b8_sustained_2048.json): 2048x2048, 420 s, Now drawing from 'AC Power'

first 10 s 3.66 G, minimum 3.32 G (91% of first), maximum 4.01 G, mean 3.79 G, last 3.83 G (105% of first); total 1590.21 G cell-updates; rss 191 -> 127 MB; device lost: null; uncaptured errors: 0

| t (s) | steps/s | cell-updates/s | GPU-only ms/step | rss MB | thermal warning | other busy processes |
|---|---|---|---|---|---|---|
| 10 | 873.3 | 3.66 G | not logged | 191 | none | not logged |
| 20 | 844.9 | 3.54 G | not logged | 199 | none | not logged |
| 30 | 863.3 | 3.62 G | not logged | 202 | none | not logged |
| 40 | 893.7 | 3.75 G | not logged | 203 | none | not logged |
| 50 | 856.7 | 3.59 G | not logged | 211 | none | not logged |
| 60 | 884.8 | 3.71 G | not logged | 214 | none | not logged |
| 70 | 911.7 | 3.82 G | not logged | 215 | none | not logged |
| 80 | 953.4 | 4.00 G | not logged | 215 | none | not logged |
| 90 | 947.7 | 3.98 G | not logged | 218 | none | not logged |
| 100 | 953.2 | 4.00 G | not logged | 218 | none | not logged |
| 110 | 911.4 | 3.82 G | not logged | 133 | none | not logged |
| 121 | 884.1 | 3.71 G | not logged | 137 | none | not logged |
| 131 | 792.6 | 3.32 G | not logged | 102 | none | not logged |
| 141 | 811.7 | 3.40 G | not logged | 117 | none | not logged |
| 151 | 864.9 | 3.63 G | not logged | 133 | none | not logged |
| 161 | 904.3 | 3.79 G | not logged | 136 | none | not logged |
| 171 | 897.8 | 3.77 G | not logged | 137 | none | not logged |
| 181 | 914.9 | 3.84 G | not logged | 139 | none | not logged |
| 191 | 925.8 | 3.88 G | not logged | 140 | none | not logged |
| 201 | 945.2 | 3.96 G | not logged | 140 | none | not logged |
| 211 | 954.9 | 4.01 G | not logged | 140 | none | not logged |
| 221 | 955.6 | 4.01 G | not logged | 141 | none | not logged |
| 231 | 954.4 | 4.00 G | not logged | 141 | none | not logged |
| 241 | 954.4 | 4.00 G | not logged | 141 | none | not logged |
| 251 | 956.3 | 4.01 G | not logged | 141 | none | not logged |
| 261 | 896.4 | 3.76 G | not logged | 128 | none | not logged |
| 271 | 860.6 | 3.61 G | not logged | 124 | none | not logged |
| 281 | 914.7 | 3.84 G | not logged | 132 | none | not logged |
| 291 | 899.2 | 3.77 G | not logged | 116 | none | not logged |
| 302 | 902.8 | 3.79 G | not logged | 132 | none | not logged |
| 312 | 893.6 | 3.75 G | not logged | 135 | none | not logged |
| 322 | 922.2 | 3.87 G | not logged | 137 | none | not logged |
| 332 | 898.7 | 3.77 G | not logged | 133 | none | not logged |
| 342 | 885.1 | 3.71 G | not logged | 132 | none | not logged |
| 352 | 911.1 | 3.82 G | not logged | 124 | none | not logged |
| 362 | 887.4 | 3.72 G | not logged | 121 | none | not logged |
| 372 | 909.0 | 3.81 G | not logged | 127 | none | not logged |
| 382 | 914.2 | 3.83 G | not logged | 127 | none | not logged |
| 392 | 908.7 | 3.81 G | not logged | 126 | none | not logged |
| 402 | 902.7 | 3.79 G | not logged | 127 | none | not logged |
| 412 | 914.3 | 3.83 G | not logged | 127 | none | not logged |

### B8 sustained load (b8_sustained_2048_run2.json): 2048x2048, 420 s, Now drawing from 'AC Power'

first 10 s 3.77 G, minimum 3.50 G (93% of first), maximum 3.79 G, mean 3.65 G, last 3.71 G (98% of first); total 1526.86 G cell-updates; rss 197 -> 228 MB; device lost: null; uncaptured errors: 0

| t (s) | steps/s | cell-updates/s | GPU-only ms/step | rss MB | thermal warning | other busy processes |
|---|---|---|---|---|---|---|
| 10 | 899.9 | 3.77 G | 1.065 | 197 | none | knowledgeconstructiond:97% node:101% |
| 20 | 898.0 | 3.77 G | 1.155 | 201 | none | WindowServer:46% knowledgeconstructiond:98% node:98% com.apple.WebKit.WebContent:34% |
| 30 | 885.1 | 3.71 G | 1.090 | 202 | none | WindowServer:51% node:99% |
| 40 | 839.2 | 3.52 G | 1.204 | 203 | none | WindowServer:45% node:122% |
| 50 | 861.9 | 3.62 G | 1.114 | 208 | none | WindowServer:41% node:99% |
| 60 | 861.9 | 3.62 G | 1.130 | 209 | none | WindowServer:40% node:99% |
| 71 | 833.6 | 3.50 G | 1.147 | 212 | none | WindowServer:64% node:121% |
| 81 | 840.0 | 3.52 G | 1.147 | 215 | none | WindowServer:64% node:100% |
| 91 | 839.9 | 3.52 G | 1.122 | 218 | none | WindowServer:63% node:204% |
| 101 | 852.0 | 3.57 G | 1.139 | 219 | none | WindowServer:51% node:100% |
| 111 | 849.7 | 3.56 G | 1.180 | 219 | none | WindowServer:52% node:100% |
| 121 | 856.5 | 3.59 G | 1.073 | 219 | none | WindowServer:44% node:100% |
| 131 | 850.7 | 3.57 G | 1.262 | 219 | none | WindowServer:71% TextEdit:43% node:99% |
| 141 | 845.8 | 3.55 G | 1.130 | 220 | none | WindowServer:49% node:130% |
| 151 | 853.3 | 3.58 G | 1.180 | 220 | none | WindowServer:48% node:99% |
| 161 | 855.7 | 3.59 G | 1.081 | 220 | none | WindowServer:55% node:99% |
| 172 | 898.2 | 3.77 G | 1.065 | 220 | none | WindowServer:40% node:130% |
| 182 | 897.6 | 3.76 G | 1.147 | 220 | none | WindowServer:43% node:100% |
| 192 | 900.2 | 3.78 G | 1.114 | 220 | none | WindowServer:41% node:102% |
| 202 | 902.9 | 3.79 G | 1.073 | 220 | none | WindowServer:36% node:109% |
| 212 | 896.3 | 3.76 G | 1.073 | 220 | none | WindowServer:34% node:99% node:31% node:103% |
| 222 | 892.9 | 3.75 G | 1.122 | 222 | none | WindowServer:41% node:99% node:111% |
| 232 | 865.4 | 3.63 G | 1.180 | 222 | none | WindowServer:45% node:124% node:221% |
| 242 | 858.3 | 3.60 G | 1.204 | 224 | none | WindowServer:43% node:138% node:100% |
| 252 | 846.9 | 3.55 G | 1.196 | 224 | none | WindowServer:42% node:99% node:133% |
| 262 | 855.1 | 3.59 G | 1.139 | 224 | none | WindowServer:43% node:100% |
| 273 | 891.1 | 3.74 G | 1.139 | 224 | none | WindowServer:37% node:99% |
| 283 | 898.1 | 3.77 G | 1.196 | 224 | none | WindowServer:46% node:82% |
| 293 | 891.1 | 3.74 G | 1.122 | 224 | none | WindowServer:42% node:99% |
| 303 | 882.9 | 3.70 G | 1.081 | 226 | none | WindowServer:38% node:99% |
| 313 | 883.8 | 3.71 G | 1.090 | 226 | none | WindowServer:36% node:100% |
| 323 | 892.5 | 3.74 G | 1.221 | 226 | none | WindowServer:40% Google Chrome Helper:39% node:98% claude:67% |
| 333 | 891.4 | 3.74 G | 1.106 | 226 | none | WindowServer:37% node:152% |
| 343 | 849.1 | 3.56 G | 1.155 | 226 | none | WindowServer:48% node:99% |
| 353 | 848.4 | 3.56 G | 1.171 | 226 | none | WindowServer:48% node:100% |
| 363 | 854.4 | 3.58 G | 1.122 | 226 | none | WindowServer:45% node:100% |
| 373 | 852.6 | 3.58 G | 1.130 | 228 | none | WindowServer:43% node:98% |
| 384 | 867.4 | 3.64 G | 1.130 | 228 | none | WindowServer:36% |
| 394 | 888.1 | 3.72 G | 1.098 | 228 | none | WindowServer:30% node:100% |
| 404 | 887.1 | 3.72 G | 1.106 | 228 | none | WindowServer:42% node:99% |
| 414 | 884.9 | 3.71 G | 1.073 | 228 | none | WindowServer:36% |

### B8 soak of the B4 particle pipeline: 1.0 M particles, 256^3 grid, 900 s, Now drawing from 'AC Power'

total 44824 steps = 47.00 G particle-steps; first 30 s 30.9 M, minimum 30.9 M, maximum 56.1 M, mean 52.1 M, last 56.1 M particle-steps/s; rss 296 -> 129 MB; all probes finite: true; device lost: null; uncaptured errors: 0

| t (s) | steps/s | particle-steps/s | rss MB | probe finite | mean z of probe | other busy processes |
|---|---|---|---|---|---|---|
| 30 | 29.4 | 30.9 M | 296 | true | 0.218 | WindowServer:52% node:151% node:99% softwareupdated:93% |
| 60 | 36.5 | 38.3 M | 196 | true | 0.059 | WindowServer:39% node:98% |
| 90 | 40.7 | 42.6 M | 180 | true | 0.041 | WindowServer:47% node:173% |
| 120 | 44.8 | 46.9 M | 131 | true | 0.029 | node:99% node:125% |
| 151 | 47.5 | 49.8 M | 135 | true | 0.028 | node:99% node:112% |
| 181 | 49.0 | 51.4 M | 141 | true | 0.027 | node:100% node:118% |
| 211 | 47.9 | 50.3 M | 146 | true | 0.026 | WindowServer:40% node:96% node:96% |
| 241 | 47.2 | 49.5 M | 136 | true | 0.026 | node:100% node:112% |
| 271 | 49.2 | 51.6 M | 137 | true | 0.025 | node:99% |
| 301 | 48.4 | 50.8 M | 121 | true | 0.025 | node:114% node:99% |
| 331 | 51.8 | 54.3 M | 135 | true | 0.025 | node:122% |
| 361 | 52.0 | 54.6 M | 137 | true | 0.024 | node:100% |
| 392 | 51.8 | 54.3 M | 142 | true | 0.024 | node:177% |
| 422 | 50.6 | 53.0 M | 121 | true | 0.024 | node:76% |
| 452 | 52.0 | 54.6 M | 121 | true | 0.024 | WindowServer:31% Google Drive:40% |
| 482 | 52.7 | 55.2 M | 121 | true | 0.024 |  |
| 512 | 52.9 | 55.5 M | 123 | true | 0.024 |  |
| 542 | 52.9 | 55.5 M | 122 | true | 0.023 |  |
| 572 | 52.9 | 55.5 M | 122 | true | 0.023 |  |
| 602 | 53.2 | 55.8 M | 122 | true | 0.023 |  |
| 632 | 53.3 | 55.9 M | 123 | true | 0.023 |  |
| 663 | 53.4 | 56.0 M | 123 | true | 0.023 |  |
| 693 | 53.3 | 55.9 M | 120 | true | 0.023 |  |
| 723 | 53.5 | 56.1 M | 112 | true | 0.023 | accountsd:65% contactsd:52% |
| 753 | 53.2 | 55.8 M | 120 | true | 0.023 | node:115% |
| 783 | 52.8 | 55.3 M | 123 | true | 0.022 | node:129% |
| 813 | 52.8 | 55.4 M | 128 | true | 0.022 | node:108% |
| 843 | 52.9 | 55.4 M | 131 | true | 0.022 | node:118% |
| 873 | 53.5 | 56.1 M | 129 | true | 0.022 | Python:99% |

### B8 memory: growing set of 512 MB buffers

start: available 5.5 GB, wired 3.2 GB, swap used 4.41 GB, system free 55%

| total | buffers | alloc + first touch | ring passes (ms) | traffic GB/s per pass | verified | swap used after | available after | wired after | error |
|---|---|---|---|---|---|---|---|---|---|
| 1 GB | 2 | 184 ms | 23 / 20 / 19 | 86.1 / 102.1 / 105.6 | true | 4.41 GB | 4.4 GB | 4.4 GB |  |
| 2 GB | 4 | 138 ms | 37 / 33 / 33 | 108.0 / 120.3 / 121.6 | true | 4.41 GB | 3.3 GB | 5.4 GB |  |
| 4 GB | 8 | 389 ms | 80 / 72 / 75 | 100.4 / 111.9 / 107.3 | true | 4.99 GB | 2.1 GB | 7.4 GB |  |
| 6 GB | 12 | 273 ms | 126 / 121 / 122 | 94.9 / 99.4 / 98.0 | true | 6.31 GB | 1.8 GB | 9.4 GB |  |
| 8 GB | 16 | 265 ms | 152 / 147 / 148 | 105.3 / 109.2 / 108.0 | true | 7.66 GB | 1.5 GB | 11.4 GB |  |

stopped escalating because: swap grew by 3.3 GB; device lost: null; uncaptured errors: 0


### B8 the 4 GiB boundary (whole-buffer binding as array<u32>)

| buffer size | bytes | arrayLength seen by the shader | expected | probes read back correctly | 64 MB window bound past 4 GiB |
|---|---|---|---|---|---|
| 3.5 GiB | 3758096384 | 939524096 | 939524096 | true | - |
| 4 GiB - 4 KiB | 4294963200 | 1073740800 | 1073740800 | true | - |
| 4 GiB exactly | 4294967296 | 0 | 1073741824 | true | - |
| 4 GiB + 4 KiB | 4294971392 | 1024 | 1073742848 | false | - |
| 4.5 GiB | 4831838208 | 134217728 | 1207959552 | false | correct |

### B9b Chrome against Node bit comparison

Chrome/154.0.8037.98: hashes ba69c15a8d62ffc6, ba69c15a8d62ffc6; Node/Dawn hash ba69c15a8d62ffc6; equal: true


### B9 Chrome (b9_chrome_headless.json)

**new headless, default flags** - Chrome/154.0.8037.98
adapter {"vendor":"apple","architecture":"metal-3","device":"","description":""}; maxBufferSize 4294967292; maxStorageBufferBindingSize 4294967292; features: bgra8unorm-storage, clip-distances, core-features-and-limits, depth-clip-control, depth32float-stencil8, dual-source-blending, float32-blendable, float32-filterable, indirect-first-instance, primitive-index, rg11b10ufloat-renderable, shader-f16, subgroup-size-control, subgroups, texture-component-swizzle, texture-compression-astc, texture-compression-astc-sliced-3d, texture-compression-bc, texture-compression-bc-sliced-3d, texture-compression-etc2, texture-formats-tier1, texture-formats-tier2, timestamp-query

| grid | formulation | cell-updates/s best | median | note |
|---|---|---|---|---|
| 1024x1024 | buffer | 3.80 G | 3.78 G |  |
| 1024x1024 | texture | 4.08 G | 3.92 G |  |
| 2048x2048 | buffer | 3.79 G | 3.74 G |  |
| 2048x2048 | texture | 4.04 G | 4.03 G |  |
| 4096x4096 | buffer | 3.76 G | 3.71 G |  |
| 4096x4096 | texture | 4.02 G | 3.97 G |  |

