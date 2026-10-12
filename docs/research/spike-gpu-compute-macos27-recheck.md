# GPU compute recheck after the macOS update

> **Record of the build, kept as written (8 October 2026).** A recheck of the GPU trial after an
> operating-system update. Its finding that results depend bit for bit on the GPU, the
> operating-system build and the Dawn version still holds and is why every result names its
> stack. The index of the documents is `docs/README.md`.

Date: 2026-10-08, about 19:45 BST. Same machine as the original spike (`spike-gpu-compute.md`): MacBook Pro,
Apple M3 Pro, 18 GB. The operating system was updated that evening from macOS 14.7.6 (23H626) to
macOS 27.0.1 (26A434). Mains power, low-power mode off. Three other jobs of the build were running on the machine
at the time, so throughput figures are indicative, not quiet-machine figures.

Code: `spikes/gpu-compute/` (`b0_env.mjs`, `b1_stencil.mjs quick`, `b7_determinism.mjs --child`), run once
against `webgpu@0.3.0` and once against `webgpu@0.6.2`.

## Results

| Check | webgpu 0.3.0 | webgpu 0.6.2 |
|---|---|---|
| Loads on macOS 27.0.1 | yes | yes (it did not load on macOS 14.7.6) |
| Adapter | apple / metal-3 / apple-m3-pro | same |
| Advertised maxBufferSize, maxStorageBufferBindingSize | 10,726,686,720 (but bindings of 4 GiB or more were silently wrong in this build) | 4,294,967,295 and 4,294,967,292 |
| Extra features | none | texture-formats-tier1 and tier2, subgroup-size-control, atomic-vec2u-min-max, others |
| B1 stencil, 2048 x 2048, storage buffers | 3.94 G cell-updates/s | 4.03 G cell-updates/s |
| B1 stencil, 2048 x 2048, storage textures | 4.28 G | 4.20 to 4.26 G |
| B1 hash, 1024 x 1024, 200 steps | `ba69c15a8d62ffc6` (two runs) | `ba69c15a8d62ffc6` (two runs) |
| B4 particle step hash, 1M particles, 20 steps, i32 fixed-point scatter | `b2604f76e68bdb76` (two runs) | `b8a61cfdcd1f8457` (two runs) |

Before the update (macOS 14.7.6, webgpu 0.3.0) the same two hashes were `ba69c15a8d62ffc6` for B1 and
`a46cbbdde956a6c9` for B4 (`spikes/gpu-compute/out/b7_determinism.json`).

## What this shows

1. **Throughput is unchanged** by the operating-system update and by the bindings version.
2. **The float stencil kernel is bit-identical** across the operating-system update and across both Dawn
   builds (and, from the original spike, in Chrome 154).
3. **The particle kernel is not.** It is still bit-reproducible run to run on any one stack, but its result
   changed across the operating-system update with the *same* Dawn build, and differs again between the two
   Dawn builds. So bit-level results are a function of the whole stack: GPU, operating-system build (Apple's
   Metal shader compiler and driver) and Dawn version. Which operations in that kernel are sensitive has not
   been isolated; the stencil kernel uses only add, multiply and a branch, the particle kernel also does
   float-to-fixed conversion, weights from quadratic B-splines and per-particle matrix arithmetic.

## Consequences for the simulator

- Every result, cache key and golden test must carry the full stack string: simulator version, GPU,
  operating-system build and Dawn (`webgpu` package) version. An operating-system update invalidates caches
  and golden hashes exactly as a simulator version bump does.
- Do not promise identical scores across machines or across operating-system versions; give the
  clean / not-clean decision a dead band or score on one declared reference stack.
- When the GPU foundation package is built, add a determinism probe suite (one small kernel per class of
  operation: add/multiply chains, division, sqrt, exp/log/pow, trigonometry, float-to-int conversion, fused
  multiply-add candidates, integer atomics) whose hashes are recorded per stack, so that a change of bits can
  be traced to an operation class and kernels can avoid the sensitive ones where it matters.
- Move the bindings from 0.3.0 to 0.6.2 when that package is built: it is the maintained build, it caps
  bindings at 4 GiB instead of misreporting, and it now loads on this machine.
