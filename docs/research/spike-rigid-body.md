# Spike: rigid-body engine bake-off on a dish-rack scenario

> **Record of the build, kept as written (8 October 2026).** The trial of four rigid-body
> engines that chose Jolt for the loading physics. How loading works today is in
> `docs/design/platform.md`. The index of the documents is `docs/README.md`.

Date: 2026-10-08. Machine: MacBook Pro, Apple M3 Pro, macOS 14.7.6, Node 20, on mains power.

This file is the spike's structured findings. Raw tables for every test are in `spikes/rigid-body/results/tables.md`; code is in `spikes/rigid-body/src/`, the Jolt adapter in `src/engines/jolt.mjs` there. The log files cited below (`logs/*.log`) are not in the repository.

## Verdict

The candidate is viable for the loading phase: a WASM rigid-body engine driven from Node handles thin concave tableware in a wire rack with resting penetration of about 0.1 mm or less, no jitter, bit-identical reruns, and about 4.2 ms per step for a full load (122 bodies, 3028 convex pieces, 1355 static capsules) on one thread. Use Jolt Physics (jolt-physics 1.1.0, MIT) at 1/240 s with manifold reduction off, 5 mm speculative contact distance and LinearCast CCD on every item; it had the lowest penetration, zero creep with sleeping disabled, the smoothest step times and a bit-exact sub-millisecond state save/restore. Rapier 0.21 is a credible fallback only if the world is simulated in decimetres: at metre scale every one of about 30 configurations failed at least one test by millimetres and ran 20-50 times slower, while scaled by 10 it passes everything and matches Jolt's speed. PhysX 5 is accurate but creeps unless bodies sleep, has no state snapshot and its npm build will not run under Node without a shim; MuJoCo (official WASM bindings) overshoots 1-2.5 mm on impact, has no continuous collision detection and left a tumbler impaled on a tine. Out-of-the-box defaults are unsuitable in all four engines. The architects should adopt Jolt, keep the load asleep during the wash and wake only bodies whose jet wrench exceeds friction, and plan for real-world calibration, because 'correct' here means consensus of four engines plus geometric checks, not measured tableware.

## Recommendations

- Adopt Jolt Physics 1.1.0 (jolt-physics, single-thread WASM, MIT) in SI units for the loading simulation.
- Jolt configuration: dt 1/240 s with one collision step; mUseManifoldReduction = false (critical); mSpeculativeContactDistance = 0.005 m; EMotionQuality_LinearCast on every tableware body; mNumVelocitySteps 10 and mNumPositionSteps 4; hull mMaxConvexRadius 0.0002 m (small but non-zero) and mHullTolerance 1e-5; mPenetrationSlop 0.0001 m; mPointVelocitySleepThreshold 0.005 m/s; mMinVelocityForRestitution 0.2 m/s; linear and angular damping 0; mMaxContactConstraints no more than about 16000 because the JS build's temp allocator is a fixed 10 MB.
- Do not run coarser than 1/240 s: at 1/120 s Jolt's CCD let one flat knife through. 1/480 s roughly halves penetration at twice the cost and is the lever if more accuracy is needed.
- Model the rack as one static body holding a StaticCompoundShape of capsules (1355 capsules in one body worked).
- Shape decomposition: plates at least 36 angular segments; bowls 24-32 angular by 5 profile segments, all built with the same facet phase; tumblers and mugs 16 wall segments; cutlery 3-11 pieces with separate fork tines. That is about 3000 pieces for a full load at about 4 ms per step.
- In the game, cap item release speed at about 2 m/s and validate or snap placements so an item geometrically fits before release; a plate tilted more than about 10.8 degrees wedges in a 36 mm slot and engines disagree on the outcome.
- During the wash keep the load asleep and wake only bodies whose jet wrench exceeds their static-friction capacity. Stepping the full load awake costs about 1 s of wall time per simulated second at 240 Hz, so 60 s of awake simulation is about 3% of the 30-minute budget, while stepping continuously would consume all of it.
- Keep the independent float64 penetration check (src/measure.mjs) for tests and scoring; do not rely on any engine's own penetration query.
- Keep Rapier 0.21 as the fallback, only in decimetres: multiply lengths, gravity and velocities by 10, divide density by 1000, set lengthUnit to 1 scaled unit (0.1 m) and soft-CCD prediction to 5 mm. It passed every test and never tunnelled, at the price of 0.1-0.36 mm penetration, 0.02 mm/s creep, 50 ms first-contact spikes and 2 MB snapshots.
- Use MuJoCo WASM only as an offline cross-check (float64, 3 kB bit-exact state), not as the game engine.
- Before committing, run the Jolt preset in a browser to confirm determinism and load time there, and export state through StateRecorderJS to confirm snapshot size for undo and replay.
- Schedule real-world calibration for friction-held poses, jam-versus-seat of wedged plates and bowl nest height; these are the places where the engines disagree and there is no ground truth.

## Headline measurements

| Metric | Value | Notes |
|---|---|---|
| Power state during all runs | AC power, low-power mode off | The brief said battery; pmset showed AC from 15:39 through 16:49 (79% charging at start, 100% at end), lowpowermode 0. All T7/T8 timings were taken 16:28-16:45 on AC. Another spike ran concurrently. |
| T1 single plate, time to rest / final lean / final penetration (dt 1/240 s) | Jolt tuned 0.14 s / 11.85 deg / 0.033 mm; Rapier scaled 0.21 s / 11.93 deg / 0.096 mm; PhysX tuned 0.20 s / 11.81 deg / 0.004 mm; MuJoCo tuned 0.20 s / 11.85 deg / 0.026 mm | All rest on tine tips and two base wires (clearance check). rms velocity over the last second is 0 in all tuned presets. Jolt default leaves 0.762 mm; Rapier with a 0.5 mm contact skin wedges the plate at 7.51 deg, 0.9 mm above the wires. |
| T2 twelve plates, max / final penetration | Jolt 0.095 / 0.080 mm; Rapier scaled 0.363 / 0.112 mm; PhysX 0.094 / 0.004 mm; MuJoCo 1.331 / 0.035 mm | No explosions in any engine or preset. All plates seat at 11.7-12.0 deg. |
| T2 creep over 5 s with sleeping disabled | Jolt 0 mm / <0.001 deg; Rapier scaled 0.117 mm / 0.080 deg; MuJoCo 0.229 mm / 0.117 deg; PhysX 1.851 mm / 0.895 deg | With sleeping on every engine reports zero drift, so sleeping hides creep. |
| T3 nested bowl spacing, facets rotated (ideal 19.40 mm) | Jolt 21.31 / 21.37 / 21.74 mm; Rapier scaled 21.22 / 21.25 / 21.24 mm; PhysX 20.10 / 19.90 / 21.45 mm; MuJoCo 20.01 / 20.57 / 21.11 mm | Final bowl-bowl penetration 0.007, 0.103, 0.133, 0.239 mm respectively. With facets aligned PhysX is within 0.3 mm of ideal. PhysX takes 5.82 s to rest when rotated. |
| T3 failures at default or metre-scale settings | Rapier default: bowls hover 2.1-3.0 mm apart, spacing 29.6-29.9 mm; Rapier lengthUnit 0.1: bowls interpenetrate 5-12 mm and never rest; Jolt default: 7.1 mm overlap | Hover confirmed with a separating-axis lower bound on the gap (src/gap.mjs). |
| T4a tumbler inverted over tines, started at 15 deg | Jolt, Rapier scaled, PhysX: slides upright (0.0 deg), final penetration <= 0.003 mm, rest in 0.7-0.95 s; MuJoCo tuned: stuck at 6.29 deg with a tine 2.000 mm into the 2 mm wall | Nothing in the scenario holds the glass inclined; three engines agree. MuJoCo default never rests (rms 39.9 mm/s). |
| T4b mug on 12 deg shelf, slide in 9 s with sleeping off (mu 0.4 / mu 0.3) | Jolt 0 / 0 mm; Rapier scaled <0.001 / <0.001 mm; MuJoCo tuned 0.026 / 0.037 mm; PhysX tuned 0.343 / 6.17 mm | tan(12 deg) = 0.213 so it should hold in both cases. PhysX slides at 0.69 mm/s at mu 0.3 unless asleep. |
| T5 twenty cutlery pieces, pieces ever outside own cell / max wall penetration / final piece-piece penetration | Jolt 0 / 0.026 mm / 0.043 mm; Rapier scaled 0 / 0.191 mm / 0.114 mm; PhysX 0 / 0.318 mm / 0.194 mm; MuJoCo 20 (transient) / 2.550 mm / 0.002 mm | No explosions. MuJoCo pieces momentarily cross the 2 mm floor on landing then recover. Rapier default leaves 3.86 mm piece-piece overlap; Jolt default leaves 7 pieces outside their cells. |
| T6 straight pass-through events without CCD at 1/240 s (16 knife drops at 2 and 5 m/s, 4 plate drops at 2 m/s) | Jolt 3 knives; PhysX 3 knives; MuJoCo 7 knives and 2 plates impaled; Rapier scaled 0 | All Jolt and PhysX failures are at 5 m/s. Rapier's predictive contacts act as built-in speculative CCD. |
| T6 pass-through events with CCD | Jolt LinearCast: 0 at 1/240 and 1/480, 1 of 16 at 1/120; PhysX swept and speculative CCD: 0; MuJoCo: no CCD exists; Rapier: hard-CCD flag gives results identical to CCD off | Max penetration with Jolt CCD is 0.1 mm. |
| T7 determinism (T2, 10 s, SHA-256 of all state bits) | All four engines identical across two runs in one process and a fresh process, with sleeping on and off | Node on this machine only. Browsers, other CPUs and multithreaded builds not tested. Rapier's deterministic build gives the same hash as the standard build. |
| T7 snapshot at 1 s then replay 2 s | Jolt identical (save 0.6-1.0 ms, restore 0.4-0.8 ms); MuJoCo identical (3.0 kB); Rapier scaled identical (1.98 MB, 4.6 / 9.2 ms); Rapier default identical (28.6 MB, 54 / 48 ms); PhysX different | PhysX bindings have no scene-state snapshot; only poses and velocities were restored. Jolt state was kept in an in-WASM recorder, so its byte size was not measured. |
| T8 full load, all bodies awake, mean step at 1/240 s (best / median of 3) | Jolt 4.14 / 4.25 ms; Rapier scaled 4.26 / 4.65 ms; PhysX 5.29 / 5.89 ms; MuJoCo 6.72 / 6.74 ms; Jolt with CCD 4.77 / 4.80 ms; Rapier default 78.8 ms | Measured on the actual target size: 122 bodies, 3028 pieces, 1355 capsules, 30 boxes. Rapier default is a single run. |
| T8 full load, sleeping allowed, mean step over a 4 s settle at 1/240 s | Jolt 0.750 / 0.781 ms; MuJoCo 0.825 / 0.838 ms; PhysX 1.433 / 1.467 ms; Rapier scaled 1.453 / 1.534 ms; Rapier default 31.0 / 31.2 ms | Best / median of 3 fresh processes. |
| T8 full load awake, p99 and max step | p99: Jolt 4.7-5.1 ms, PhysX 6.3-7.1 ms, MuJoCo 7.9 ms, Rapier scaled 10.6-10.9 ms; max: Jolt 6.7-9.8 ms, MuJoCo 8.9-10.0 ms, PhysX 13.3-14.4 ms, Rapier scaled 51-58 ms | Jolt with CCD: p99 17.4-17.9 ms, max 28-31 ms. |
| T8 twelve plates, all awake, mean step at 1/240 s | Jolt 0.351 / 0.355 ms; MuJoCo 0.516 / 0.531 ms; PhysX 0.540 / 0.541 ms; Rapier scaled 0.606 / 0.608 ms; Rapier default 17.6 / 17.9 ms | Per-step cost is nearly independent of dt, so cost per simulated second scales with 1/dt. |
| Wall time per simulated second, full load fully awake (Jolt) | about 1.0 s at 240 Hz, about 2.0 s at 480 Hz | Cost follows bodies in contact, not piece count: 10x bodies and 3.5x pieces cost 11.8x per step. |
| Full-load resting penetration, wires / item-item | Jolt 0.097 / 0.099 mm; PhysX 0.004 / 0.041 mm; Rapier scaled 0.280 / 0.188 mm; MuJoCo 2.001 / 1.537 mm | From logs/full-load-penetration.log (the logs of the trial are not kept in the repository). MuJoCo: tumblers impaled, pieces overlapping. |
| Process RSS with full load | Jolt 117 MB; PhysX 137 MB; MuJoCo 199 MB; Rapier scaled 288 MB; Rapier default 493 MB | Jolt's WASM heap is a fixed 128 MB. |
| WASM size raw / gzip | Jolt 2.02 / 0.74 MB; Rapier 3.08 / 1.17 MB; PhysX 5.40 / 1.61 MB; MuJoCo 10.37 / 2.54 MB | Module load in Node: Rapier 51-63 ms, Jolt 67-95 ms, MuJoCo about 80 ms, PhysX 104-128 ms. |
| Jolt ablation: manifold reduction on (the default) with everything else tuned | bowls 16.67 mm max / 2.66 mm final overlap; tumbler 2.34 mm; cutlery 6.05 mm max / 1.61 mm final | The single most important Jolt setting. logs/ablation-jolt.log. |
| Jolt ablation: other settings | speculative distance 0.02 m: 3-10x slower in contact-dense scenes, 0.54 mm cutlery overlap; iterations 4/1: resting penetration 0.135 mm vs 0.080 mm; penetration slop, hull tolerance and convex radius defaults: no measurable difference | Convex radius 0 exploded T3 once (27 m/s) in an intermediate configuration, not with the final preset. |
| Plate resting height vs angular segments (Jolt, plate centre) | 124.49 mm (12), 125.40 mm (16), 125.86 mm (24), 126.62 mm (36) | Same trend in every engine. At 24 segments rim facets (33.9 mm) are longer than the base-wire pitch (32 mm). |
| Sensitivity of final plate lean to friction 0.3-0.5, restitution 0.05-0.2, dt 1/120-1/480 | 11.8-11.9 deg in Jolt, PhysX, MuJoCo; 11.8-12.2 deg in Rapier scaled | MuJoCo ignores restitution entirely (identical results for 0.05 and 0.2). |
| T9 disturbance of a settled plate | All engines respond and re-settle in 0.01-0.68 s; peak displacement for a 0.05 N s rock 3.1-3.9 mm in tuned presets; no explosion or tunnelling | Jolt's plate rests where it lands (up to 8 mm off-centre between base wires, 0.75 mm higher) and relaxes when disturbed; others roll to centre during settling. |
| Rapier one-shot contact query error at metre scale | -9.0 mm reported for a pair that is 2.0 mm apart | src/debug-parry.mjs; correct (+2.000 mm) when the same geometry is scaled by 10. My first measurer used this query and was replaced by an independent float64 separating-axis test validated on 16 analytic cases. |
| Results inventory | 234 JSON result files, 4 engines, 9 tests, about 50 sweep configurations | Package versions pinned in package.json: rapier3d-compat / deterministic-compat / simd-compat 0.21.0, jolt-physics 1.1.0, @mujoco/mujoco 3.15.0, physx-js-webidl 2.8.0 (PhysX 5.11.0). |

## Risks

- No ground truth: correctness here is the consensus of four engines plus geometric checks, not measurements of real tableware.
- Determinism was verified only in Node 20 on this machine (same process and fresh process). Cross-browser, cross-CPU and multithreaded determinism is unverified, which matters for an LLM benchmark.
- Engine defaults are tuned for metre-scale games and fail by millimetres in all four engines; a configuration regression (for example Jolt manifold reduction switched back on) would silently produce 2-17 mm overlaps.
- Thin items at 5 m/s tunnel through a 4 mm wire in Jolt, PhysX and MuJoCo without CCD; Jolt's CCD is linear-cast only (ignores rotation) and missed once at 1/120 s.
- Bowl nest height is off by up to 2.3 mm (19.1-21.7 mm against 19.40 mm ideal) in every engine, because 80-degree walls multiply any normal offset by 5.7; facet misalignment alone adds 1-2 mm.
- Faceted rims bias resting height by 1-2 mm at 24 segments and let a plate sit flat on a facet across two base wires.
- Jolt holds a plate where it lands (up to 8 mm off-centre) while the other engines roll it to the middle; both are valid Coulomb equilibria and the realistic one is unknown.
- Sleeping hides creep: PhysX drifts 1.85 mm in 5 s and lets a mug slide at 0.69 mm/s on a slope it should hold once sleeping is disabled, which will matter when jets keep bodies awake.
- Rapier at metre scale gives wrong results for millimetre features (hovering or sinking bowls, cutlery overlap, a one-shot query wrong by 11 mm) and its hard-CCD flag did nothing; anyone reusing Rapier without the decimetre scaling will hit this.
- PhysX's npm build throws under Node and needs a shim, and has no scene-state snapshot, so replay means re-simulating from the start.
- MuJoCo's soft contacts overshoot 1.3-2.5 mm on ordinary drops, enough to cross a 2 mm wall, and its WASM bindings are labelled work in progress with README/export mismatches.
- Jolt's JS build has a fixed 10 MB temp allocator and a fixed 128 MB heap; a much larger contact count than the tested full load would need a custom build.
- The working Rapier configuration was found late and had less tuning than Jolt's, so the gap between them may be smaller than reported.

## Not done

- No separate narrative report was written: the cross-engine comparison and the conclusions exist only in this file. `results/tables.md` holds the raw tables generated by `src/report.mjs` (not regenerated since, so it lacks one repeat row).
- Browser not tested: everything ran in Node 20, so browser compatibility entries come from package documentation and build settings, and browser load time was not measured.
- Bullet/ammo.js and Havok were not evaluated (ammo.js last released on npm in 2022 and Bullet's collision margins suit 2 mm features poorly; Havok skipped for time). MuJoCo was evaluated through its official WASM package, so the Python fallback was not needed.
- T2 deviates from the brief: plates start at 6.5-9.5 degrees rather than 10, because wider tilts geometrically wedge in the slot and engines then disagree with no ground truth. T4a uses a glass zone with every other tine row removed, and the tumbler does not stay inclined in any engine.
- Slightly inclined tines were not run (the option exists as tineLeanDeg); all tines are vertical.
- Per-shape friction and restitution, contact listeners and narrow-phase penetration queries in Jolt and PhysX are reported from their typings, not exercised.
- Jolt state was saved only to an in-WASM recorder; exporting it to a JS buffer and measuring its size was not done.
- Jet-force coupling was only demonstrated (a 2 N force for 0.25 s on one plate); no jet model was coupled.
- Multithreaded WASM builds were not tried.
- The Rapier default full-load all-awake timing is a single run rather than three, and Rapier's friction, restitution and granularity sweeps at metre scale used the contact-skin preset, so only the 'scaled' rows are representative.
- Correctness tests ran in parallel across engines, so step times inside the T1-T5 tables are indicative; only T7/T8 were run serially for timing, and another spike was using the machine throughout.

## Raw tables


### T1 single plate (dt = 1/240 s, 5 s)

| engine / preset | time to rest s | lean from vertical deg | COM y mm | rms v last 1 s mm/s | rms w rad/s | residual KE uJ | max pen mm | final pen mm | asleep at s | step mean ms |
|---|---|---|---|---|---|---|---|---|---|---|
| jolt / default | 0.14 | 12.58 | 125.33 | 0 | 0 | 0 | 0.762 | 0.762 | 0.50 | 0.022 |
| jolt / tuned | 0.14 | 11.85 | 125.86 | 0 | 0 | 0 | 0.108 | 0.033 | 0.59 | 0.012 |
| jolt / tuned-ccd | 0.14 | 11.85 | 125.86 | 0 | 0 | 0 | 0.108 | 0.033 | 0.59 | 0.019 |
| mujoco / default | 0.24 | 11.80 | 125.35 | 0.002 | 0.0002 | <0.001 | 2.367 | 0.026 | no | 0.057 |
| mujoco / tuned | 0.20 | 11.85 | 125.67 | 0 | 0 | 0 | 0.359 | 0.026 | 0.26 | 0.012 |
| physx / default | 0.15 | 11.90 | 125.81 | 0 | 0 | 0 | 0.167 | 0.052 | 0.41 | 0.033 |
| physx / tuned | 0.20 | 11.81 | 125.71 | 0 | 0 | 0 | 0.015 | 0.004 | 0.41 | 0.021 |
| rapier / default | 0.91 | 11.82 | 125.35 | 0 | 0 | 0 | 0.475 | 0.043 | 1.36 | 0.319 |
| rapier / tuned | 0.76 | 7.51 | 128.63 | 0 | 0 | 0 | 0.069 | 0.054 | 1.19 | 0.226 |
| rapier / small | 0.20 | 11.82 | 126.10 | 0 | 0 | 0 | 0.066 | 0.066 | 0.72 | 0.123 |
| rapier / scaled | 0.21 | 11.93 | 126.09 | 0 | 0 | 0 | 0.146 | 0.096 | 0.72 | 0.115 |

### T2 twelve plates (dt = 1/240 s, 10 s)

| engine / preset | exploded | time to rest s | lean min..max deg | max pen wires mm | final pen wires mm | max pen plate-plate mm | drift 5-10 s mm / deg (sleep on) | drift 5-10 s mm / deg (sleep off) | rms v mm/s (sleep off) | sum of step time ms (2400 steps) |
|---|---|---|---|---|---|---|---|---|---|---|
| jolt / default | no | 0.17 | 11.75..12.71 | 1.047 | 0.939 | 0 | 0 / <0.001 | not run | not run | 79 |
| jolt / tuned | no | 0.21 | 11.75..11.86 | 0.095 | 0.080 | 0 | 0 / <0.001 | 0 / <0.001 | <0.001 | 69 |
| jolt / tuned-ccd | no | 0.21 | 11.75..11.86 | 0.095 | 0.080 | 0 | 0 / <0.001 | not run | not run | 118 |
| mujoco / default | no | 0.29 | 11.76..11.83 | 3.735 | 0.026 | 0 | 0.021 / 0.145 | not run | not run | 1368 |
| mujoco / tuned | no | 0.24 | 11.76..11.87 | 1.331 | 0.035 | 0 | 0 / <0.001 | 0.229 / 0.117 | 0.014 | 180 |
| physx / default | no | 0.40 | 11.85..11.99 | 0.440 | 0.191 | 0 | 0 / <0.001 | not run | not run | 1429 |
| physx / tuned | no | 0.29 | 11.74..11.88 | 0.094 | 0.004 | 0 | 0 / <0.001 | 1.851 / 0.895 | 3.232 | 136 |
| rapier / default | no | 0.96 | 11.75..11.87 | 0.989 | 0.049 | 0 | 0 / <0.001 | not run | not run | 6751 |
| rapier / tuned | no | 0.90 | 6.67..9.82 | 0.077 | 0 | 0 | 0 / <0.001 | 0.005 / 0.002 | 0.001 | 6951 |
| rapier / small | no | 0.24 | 11.77..11.89 | 0.235 | 0.085 | 0 | 0 / <0.001 | not run | not run | 365 |
| rapier / scaled | no | 0.25 | 11.80..11.94 | 0.363 | 0.112 | 0 | 0 / <0.001 | 0.117 / 0.080 | 0.006 | 414 |

### T3 four nested bowls (dt = 1/240 s, 8 s); ideal smooth-surface nest spacing 19.40 mm

| engine / preset | facets | time to rest s | spacing 1-2-3 mm | sink vs ideal mm (+ = sunk) | max bowl-bowl pen mm | final bowl-bowl pen mm | final pen wires mm | max tilt deg | rms v mm/s | drift 4-8 s mm | asleep |
|---|---|---|---|---|---|---|---|---|---|---|---|
| jolt / default | rotated | 0.24 | 16.14 / 22.09 / 20.08 | 3.26 / -2.69 / -0.68 | 7.111 | 7.096 | 3.175 | 12.79 | 0 | 0 | 4/4 |
| jolt / default | aligned | 0.24 | 19.68 / 18.41 / 19.18 | -0.28 / 0.99 / 0.22 | 0.876 | 0.874 | 3.737 | 10.77 | 0 | 0 | 4/4 |
| jolt / tuned | rotated | 0.15 | 21.31 / 21.37 / 21.74 | -1.91 / -1.97 / -2.34 | 0.063 | 0.007 | 0.027 | 1.19 | 0 | 0 | 4/4 |
| jolt / tuned | aligned | 0.18 | 20.45 / 19.79 / 20.74 | -1.05 / -0.39 / -1.34 | 0.086 | 0.032 | 0.029 | 1.92 | 0 | 0 | 4/4 |
| jolt / tuned-ccd | rotated | 0.19 | 21.35 / 21.38 / 21.37 | -1.95 / -1.98 / -1.97 | 0.107 | 0.065 | 0.015 | 0.98 | 0 | 0 | 4/4 |
| jolt / tuned-ccd | aligned | 0.18 | 20.46 / 19.98 / 20.66 | -1.06 / -0.58 / -1.26 | 0.064 | <0.001 | 0.045 | 1.49 | 0 | 0 | 4/4 |
| mujoco / default | rotated | 7.56 | 19.56 / 19.95 / 19.03 | -0.16 / -0.55 / 0.37 | 5.605 | 0.064 | 0.022 | 5.40 | 3.073 | 2.572 | 0/4 |
| mujoco / default | aligned | 0.52 | 18.94 / 18.92 / 18.94 | 0.46 / 0.48 / 0.46 | 1.877 | 0.014 | 0.016 | 0.25 | 0.027 | 0.286 | 0/4 |
| mujoco / tuned | rotated | 0.26 | 20.01 / 20.57 / 21.11 | -0.61 / -1.18 / -1.71 | 1.912 | 0.239 | 0.020 | 3.38 | 0 | 0 | 4/4 |
| mujoco / tuned | aligned | 0.22 | 19.30 / 18.62 / 19.23 | 0.10 / 0.78 / 0.17 | 2.144 | 0.194 | 0.020 | 6.35 | 0 | 0 | 4/4 |
| physx / default | rotated | 0.41 | 19.73 / 21.36 / 21.18 | -0.33 / -1.96 / -1.78 | 1.686 | 1.249 | 0.019 | 8.45 | 0 | 0 | 4/4 |
| physx / default | aligned | 0.40 | 14.34 / 18.70 / 19.45 | 5.06 / 0.70 / -0.05 | 2.228 | 1.938 | 0.001 | 3.87 | 0 | 0 | 4/4 |
| physx / tuned | rotated | 5.82 | 20.10 / 19.90 / 21.45 | -0.70 / -0.50 / -2.05 | 0.317 | 0.133 | 0 | 5.77 | 0 | 0.008 | 4/4 |
| physx / tuned | aligned | 0.40 | 19.34 / 19.14 / 19.34 | 0.06 / 0.26 / 0.06 | 0.215 | 0.047 | <0.001 | 3.22 | 0 | 0 | 4/4 |
| rapier / default | rotated | 0.53 | 29.64 / 29.70 / 29.80 | -10.24 / -10.30 / -10.40 | 0 | 0 | 0.020 | 2.75 | 0 | 0 | 4/4 |
| rapier / default | aligned | 0.47 | 29.68 / 29.67 / 29.92 | -10.28 / -10.27 / -10.52 | 0 | 0 | 0.029 | 3.49 | 0 | 0 | 4/4 |
| rapier / tuned | rotated | 0.47 | 31.14 / 31.21 / 31.24 | -11.74 / -11.81 / -11.84 | 0 | 0 | 0 | 3.41 | 0 | 0 | 4/4 |
| rapier / tuned | aligned | 0.50 | 31.19 / 31.19 / 31.47 | -11.79 / -11.79 / -12.07 | 0 | 0 | 0 | 3.22 | 0 | 0 | 4/4 |
| rapier / small | rotated | **never** | -7.85 / -2.58 / 4.34 | 27.25 / 21.98 / 15.06 | 9.832 | 8.267 | 0 | 49.87 | 3.373 | 8.232 | 0/4 |
| rapier / small | aligned | **never** | 4.23 / 3.02 / 6.70 | 15.17 / 16.38 / 12.70 | 13.580 | 12.304 | 0.143 | 36.53 | 8.294 | 8.051 | 0/4 |
| rapier / scaled | rotated | 0.39 | 21.22 / 21.25 / 21.24 | -1.82 / -1.85 / -1.84 | 0.341 | 0.103 | 0.024 | 1.27 | 0 | 0 | 4/4 |
| rapier / scaled | aligned | 0.31 | 20.25 / 19.85 / 20.48 | -0.85 / -0.45 / -1.08 | 0.073 | 0.073 | 0.022 | 3.45 | 0 | 0 | 4/4 |

### T4a tumbler inverted over two tines, started at 15 deg (dt = 1/240 s, 6 s)

| engine / preset | time to rest s | final axis from vertical deg | max pen mm | final pen mm | rms v mm/s | drift 3-6 s mm / deg | drift, sleep off mm / deg | asleep |
|---|---|---|---|---|---|---|---|---|
| jolt / default | 0.66 | 4.11 | 2.389 | 2.295 | 0 | 0 / <0.001 | not run | 1/1 |
| jolt / tuned | 0.73 | 0 | 0.053 | 0.001 | 0 | 0 / <0.001 | 0 / <0.001 | 1/1 |
| jolt / tuned-ccd | 0.73 | 0 | 0.053 | 0.001 | 0 | 0 / <0.001 | not run | 1/1 |
| mujoco / default | 5.59 | 0.01 | 2.004 | 0.009 | 39.881 | 12.242 / 8.765 | not run | 0/1 |
| mujoco / tuned | 0.45 | 6.29 | 2.001 | 2.000 | 0 | 0 / <0.001 | 0.038 / 0.033 | 1/1 |
| physx / default | 0.72 | 0.01 | 0.048 | 0.003 | 0 | 0 / <0.001 | not run | 1/1 |
| physx / tuned | 0.95 | 0 | 0.007 | 0.001 | 0 | 0 / <0.001 | 0.030 / 0.005 | 1/1 |
| rapier / default | 0.34 | 0 | 0.167 | 0.006 | 0 | 0 / <0.001 | not run | 1/1 |
| rapier / tuned | 0.45 | 0 | 0 | 0 | 0 | 0 / <0.001 | 0 / <0.001 | 1/1 |
| rapier / small | 0.59 | 0 | 0.429 | 0.004 | 0 | 0 / <0.001 | not run | 1/1 |
| rapier / scaled | 0.70 | 0 | 0.410 | 0.003 | 0 | 0 / <0.001 | 0.004 / <0.001 | 1/1 |

### T4b mug inverted on a 12 deg wire shelf (tan 12 deg = 0.213; must not slide for mu = 0.4 or 0.3); 10 s

| engine / preset | mu | time to rest s | slide 1-10 s mm (sleep on) | slide 1-10 s mm (sleep off) | slide rate mm/s (sleep off) | final pen mm | asleep |
|---|---|---|---|---|---|---|---|
| jolt / default | 0.4 | 0.25 | 0 | not run | not run | 0.169 | 1/1 |
| jolt / default | 0.3 | 0.25 | 0 | not run | not run | 0.171 | 1/1 |
| jolt / tuned | 0.4 | 0.04 | 0 | 0 | 0 | <0.001 | 1/1 |
| jolt / tuned | 0.3 | 0.04 | 0 | 0 | 0 | <0.001 | 1/1 |
| jolt / tuned-ccd | 0.4 | 0.04 | 0 | not run | not run | <0.001 | 1/1 |
| jolt / tuned-ccd | 0.3 | 0.04 | 0 | not run | not run | <0.001 | 1/1 |
| mujoco / default | 0.4 | 0.12 | 1.632 | not run | not run | 0.004 | 0/1 |
| mujoco / default | 0.3 | 0.12 | 2.222 | not run | not run | 0.002 | 0/1 |
| mujoco / tuned | 0.4 | 0.05 | 0 | 0.026 | 0.0029 | 0.005 | 1/1 |
| mujoco / tuned | 0.3 | 0.05 | 0 | 0.037 | 0.0041 | 0.005 | 1/1 |
| physx / default | 0.4 | 0.04 | 0 | not run | not run | <0.001 | 1/1 |
| physx / default | 0.3 | 0.04 | 0 | not run | not run | 0.001 | 1/1 |
| physx / tuned | 0.4 | 0.03 | 0 | 0.343 | 0.0381 | 0.001 | 1/1 |
| physx / tuned | 0.3 | 0.03 | 0 | 6.170 | 0.6855 | <0.001 | 1/1 |
| rapier / default | 0.4 | 0.04 | 0 | not run | not run | 0.010 | 1/1 |
| rapier / default | 0.3 | 0.04 | 0 | not run | not run | 0.010 | 1/1 |
| rapier / tuned | 0.4 | 0.03 | 0 | -0.001 | -0.0001 | 0 | 1/1 |
| rapier / tuned | 0.3 | 0.03 | 0 | -0.001 | -0.0001 | 0 | 1/1 |
| rapier / small | 0.4 | 0.04 | 0 | not run | not run | 0.010 | 1/1 |
| rapier / small | 0.3 | 0.03 | 0 | not run | not run | 0.010 | 1/1 |
| rapier / scaled | 0.4 | 0.04 | 0 | <0.001 | <0.0001 | 0.009 | 1/1 |
| rapier / scaled | 0.3 | 0.07 | 0 | <0.001 | <0.0001 | 0.009 | 1/1 |

### T5 twenty cutlery pieces into ten basket cells (dt = 1/240 s, 6 s)

| engine / preset | exploded | time to rest s | pieces outside own cell / below floor: ever | at end | worst excursion mm | max pen walls mm | final pen walls mm | max pen piece-piece mm | final pen piece-piece mm | lean from vertical min / median / max deg | max speed m/s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| jolt / default | no | 1.05 | 8 | 7 | 3.29 | 3.288 | 3.170 | 3.485 | 3.485 | 0.2 / 9.5 / 18.2 | 1.43 |
| jolt / tuned | no | 1.16 | 0 | 0 | 0 | 0.026 | 0.026 | 0.046 | 0.043 | 0.9 / 7.3 / 15.1 | 1.43 |
| jolt / tuned-ccd | no | 1.16 | 0 | 0 | 0 | 0.026 | 0.026 | 0.046 | 0.043 | 0.9 / 7.3 / 15.1 | 1.43 |
| mujoco / default | no | **never** | 20 | 0 | 8.18 | 8.184 | 0.041 | 0.968 | 0.059 | <0.1 / 7.6 / 21.4 | 1.47 |
| mujoco / tuned | no | 1.39 | 20 | 0 | 2.55 | 2.550 | 0.038 | 0.289 | 0.002 | <0.1 / 5.8 / 19.2 | 1.47 |
| physx / default | no | 2.15 | 0 | 0 | 0 | 0.449 | 0.132 | 0.221 | 0.164 | 0.1 / 6.2 / 12.8 | 1.43 |
| physx / tuned | no | 1.10 | 0 | 0 | 0 | 0.318 | 0.002 | 0.427 | 0.194 | <0.1 / 6.3 / 12.3 | 1.43 |
| rapier / default | no | 1.28 | 0 | 0 | 0 | 3.953 | 0.250 | 3.864 | 3.864 | 0.9 / 4.9 / 17.2 | 1.03 |
| rapier / tuned | no | 1.21 | 0 | 0 | 0 | 2.462 | 2.228 | 1.467 | 1.467 | 0.5 / 7.2 / 17.5 | 1.02 |
| rapier / small | no | 1.20 | 10 | 0 | 2.71 | 2.705 | 0.089 | 3.558 | 3.353 | <0.1 / 6.8 / 12.9 | 1.47 |
| rapier / scaled | no | 1.35 | 0 | 0 | 0 | 0.191 | 0.080 | 0.161 | 0.114 | <0.1 / 6.2 / 16.3 | 1.47 |

### T6 thin-feature tunnelling: "x/4" = runs (of 4 start heights) in which the object went straight through; (max penetration mm); "+k fell off" = bounced and later dropped off the two wires (not a tunnelling event)

| engine / preset | dt | CCD mode | knife edge-on 2 m/s | knife edge-on 5 m/s | knife flat 2 m/s | knife flat 5 m/s | plate flat on tine tips 2 m/s |
|---|---|---|---|---|---|---|---|
| jolt / default | 1/240 | noCCD | 0/4 (0.1) | 0/4 (0.5) +1 fell off | 0/4 (0.5) | 0/4 (0.6) | 0/4 through, 4/4 impaled (3.0) |
| jolt / default | 1/240 | CCD | 0/4 (0.1) | 0/4 (0.5) +1 fell off | 0/4 (0.5) | 0/4 (0.5) | 0/4 through, 4/4 impaled (3.0) |
| jolt / tuned | 1/240 | noCCD | 0/4 (1.5) | 1/4 (10.0) | 0/4 (2.8) | 2/4 (4.6) | 0/4 through, 0/4 impaled (3.2) |
| jolt / tuned | 1/240 | CCD | 0/4 (0.1) | 0/4 (0.1) | 0/4 (0.1) | 0/4 (0.1) | 0/4 through, 0/4 impaled (0.1) |
| jolt / tuned | 1/120 | noCCD | 0/4 (10.3) | 4/4 (1.7) | 2/4 (5.9) | 4/4 (0) | 0/4 through, 1/4 impaled (4.8) |
| jolt / tuned | 1/120 | CCD | 0/4 (0.1) | 0/4 (0.1) | 1/4 (0.1) | 0/4 (0.1) | 0/4 through, 0/4 impaled (0.1) |
| jolt / tuned | 1/480 | noCCD | 0/4 (<0.1) | 0/4 (5.0) | 0/4 (<0.1) | 0/4 (4.6) | 0/4 through, 0/4 impaled (0.1) |
| jolt / tuned | 1/480 | CCD | 0/4 (<0.1) | 0/4 (0.1) | 0/4 (<0.1) | 0/4 (0.1) | 0/4 through, 0/4 impaled (0.1) |
| mujoco / default | 1/240 | noCCD(only mode) | 3/4 (11.1) +1 fell off | 4/4 (11.3) | 4/4 (5.8) | 4/4 (4.6) | 0/4 through, 3/4 impaled (11.5) |
| mujoco / tuned | 1/240 | noCCD(only mode) | 0/4 (8.3) | 2/4 (10.0) | 2/4 (5.8) | 3/4 (4.6) | 0/4 through, 2/4 impaled (4.8) |
| mujoco / tuned | 1/120 | noCCD(only mode) | 2/4 (10.3) | 4/4 (1.7) | 3/4 (5.9) | 4/4 (0) | 0/4 through, 3/4 impaled (12.4) |
| mujoco / tuned | 1/480 | noCCD(only mode) | 0/4 (4.3) | 0/4 (10.0) +1 fell off | 0/4 (2.7) | 3/4 (4.6) | 0/4 through, 0/4 impaled (3.1) |
| physx / default | 1/240 | noCCD | 0/4 (0.2) | 0/4 (0.3) +1 fell off | 0/4 (0.5) | 0/4 (0.5) +1 fell off | 0/4 through, 0/4 impaled (0.1) |
| physx / default | 1/240 | CCD | 0/4 (0.2) | 0/4 (0.1) +1 fell off | 0/4 (0.5) | 0/4 (0.5) +1 fell off | 0/4 through, 0/4 impaled (0.1) |
| physx / default | 1/240 | speculativeCCD | 0/4 (0.2) | 0/4 (0.3) +1 fell off | 0/4 (0.5) | 0/4 (0.5) +1 fell off | 0/4 through, 0/4 impaled (<0.1) |
| physx / tuned | 1/240 | noCCD | 0/4 (4.5) | 1/4 (10.0) | 0/4 (3.0) | 2/4 (4.6) | 0/4 through, 0/4 impaled (3.2) |
| physx / tuned | 1/240 | CCD | 0/4 (0.1) +2 fell off | 0/4 (<0.1) | 0/4 (0.9) | 0/4 (0.5) | 0/4 through, 0/4 impaled (<0.1) |
| physx / tuned | 1/240 | speculativeCCD | 0/4 (<0.1) | 0/4 (0.5) | 0/4 (0.5) | 0/4 (1.8) | 0/4 through, 0/4 impaled (<0.1) |
| physx / tuned | 1/120 | noCCD | 1/4 (10.3) | 4/4 (1.7) | 2/4 (5.9) | 4/4 (0) | 0/4 through, 1/4 impaled (7.3) |
| physx / tuned | 1/120 | CCD | 0/4 (5.5) +1 fell off | 0/4 (<0.1) | 0/4 (2.1) +1 fell off | 0/4 (0.5) | 0/4 through, 0/4 impaled (<0.1) |
| physx / tuned | 1/120 | speculativeCCD | 0/4 (0.5) | 0/4 (0.5) | 0/4 (0.5) | 0/4 (2.4) | 0/4 through, 0/4 impaled (<0.1) |
| physx / tuned | 1/480 | noCCD | 0/4 (0.6) | 0/4 (5.0) | 0/4 (0.5) | 1/4 (4.6) | 0/4 through, 0/4 impaled (0.1) |
| physx / tuned | 1/480 | CCD | 0/4 (0.6) | 0/4 (0.5) | 0/4 (0.5) | 0/4 (1.6) | 0/4 through, 0/4 impaled (<0.1) |
| physx / tuned | 1/480 | speculativeCCD | 0/4 (0.7) | 0/4 (0.5) | 0/4 (0.5) | 0/4 (1.2) | 0/4 through, 0/4 impaled (<0.1) |
| rapier / default | 1/240 | noCCD | 0/4 (0.1) | 0/4 (0.1) | 0/4 (1.1) | 1/4 (4.8) +1 fell off | 0/4 through, 1/4 impaled (1.3) |
| rapier / default | 1/240 | CCD | 0/4 (0.1) | 0/4 (0.1) | 0/4 (1.1) | 1/4 (4.8) +1 fell off | 0/4 through, 1/4 impaled (1.3) |
| rapier / default | 1/240 | softCCD10mm | 0/4 (0.1) | 0/4 (0.2) | 0/4 (1.0) | 0/4 (1.2) +1 fell off | 0/4 through, 1/4 impaled (2.2) |
| rapier / tuned | 1/240 | noCCD | 0/4 (0) | 0/4 (0) | 0/4 (0) | 0/4 (1.1) +1 fell off | 0/4 through, 0/4 impaled (3.4) |
| rapier / tuned | 1/240 | CCD | 0/4 (0) | 0/4 (0) | 0/4 (0) | 0/4 (1.1) +1 fell off | 0/4 through, 0/4 impaled (3.4) |
| rapier / tuned | 1/240 | softCCD10mm | 0/4 (0) | 0/4 (0) | 0/4 (1.0) | 0/4 (1.1) +1 fell off | 0/4 through, 0/4 impaled (1.2) |
| rapier / tuned | 1/120 | noCCD | 0/4 (0) | 0/4 (0.7) +1 fell off | 0/4 (1.4) | 0/4 (0.1) | 0/4 through, 0/4 impaled (1.7) |
| rapier / tuned | 1/120 | CCD | 0/4 (0) | 0/4 (0.7) +1 fell off | 0/4 (1.4) | 0/4 (0.1) | 0/4 through, 0/4 impaled (1.7) |
| rapier / tuned | 1/120 | softCCD10mm | 0/4 (0) | 0/4 (0.6) +1 fell off | 0/4 (1.6) | 0/4 (0.1) | 0/4 through, 0/4 impaled (<0.1) |
| rapier / tuned | 1/480 | noCCD | 0/4 (0) | 0/4 (0.6) +2 fell off | 0/4 (1.1) | 0/4 (0) +2 fell off | 0/4 through, 0/4 impaled (0.2) |
| rapier / tuned | 1/480 | CCD | 0/4 (0) | 0/4 (0.6) +2 fell off | 0/4 (1.1) | 0/4 (0) +2 fell off | 0/4 through, 0/4 impaled (0.2) |
| rapier / tuned | 1/480 | softCCD10mm | 0/4 (0) | 0/4 (0) +2 fell off | 0/4 (0.5) | 0/4 (1.4) +1 fell off | 0/4 through, 0/4 impaled (0) |
| rapier / scaled | 1/240 | noCCD | 0/4 (0.5) | 0/4 (0.5) | 0/4 (0.7) | 0/4 (2.2) +3 fell off | 0/4 through, 0/4 impaled (0.5) |
| rapier / scaled | 1/240 | CCD | 0/4 (0.5) | 0/4 (0.5) | 0/4 (0.7) | 0/4 (2.2) +3 fell off | 0/4 through, 0/4 impaled (0.5) |
| rapier / scaled | 1/240 | softCCD10mm | 0/4 (0.2) | 0/4 (0.6) | 0/4 (1.0) | 0/4 (2.2) +1 fell off | 0/4 through, 0/4 impaled (0.5) |
| rapier / scaled | 1/120 | noCCD | 0/4 (0.5) | 0/4 (0.5) | 0/4 (2.0) | 0/4 (0.5) | 0/4 through, 0/4 impaled (0.5) |
| rapier / scaled | 1/120 | CCD | 0/4 (0.5) | 0/4 (0.5) | 0/4 (2.0) | 0/4 (0.5) | 0/4 through, 0/4 impaled (0.5) |
| rapier / scaled | 1/120 | softCCD10mm | 0/4 (1.6) | 0/4 (0.5) | 0/4 (2.0) | 0/4 (9.4) +1 fell off | 0/4 through, 0/4 impaled (0.5) |
| rapier / scaled | 1/480 | noCCD | 0/4 (0.1) | 0/4 (0.5) +1 fell off | 0/4 (0.8) | 0/4 (1.0) +4 fell off | 0/4 through, 0/4 impaled (0.1) |
| rapier / scaled | 1/480 | CCD | 0/4 (0.1) | 0/4 (0.5) +1 fell off | 0/4 (0.8) | 0/4 (1.0) +4 fell off | 0/4 through, 0/4 impaled (0.1) |
| rapier / scaled | 1/480 | softCCD10mm | 0/4 (0.1) | 0/4 (0.5) +2 fell off | 0/4 (0.8) | 0/4 (1.3) +2 fell off | 0/4 through, 0/4 impaled (0.1) |

### T7 determinism (T2 scene, 10 s, hash of all positions, rotations and velocities)

| engine / preset | two runs, same process | fresh process | hash | snapshot at 1 s, replay 2 s | snapshot size | save ms | restore ms |
|---|---|---|---|---|---|---|---|
| jolt / tuned | identical | identical | 5e58bc50bca5c7a3 | identical | n/a | 0.62 | 0.36 |
| jolt / tuned [nosleep] | identical | identical | 49552abed4a620b7 | identical | n/a | 1.00 | 0.81 |
| mujoco / tuned | identical | identical | a07f3c8ee82481dc | identical | 3.0 kB | 1.47 | 1.16 |
| mujoco / tuned [nosleep] | identical | identical | 6519e8b8ffa51a20 | identical | 3.0 kB | 1.05 | 1.53 |
| physx / tuned | identical | identical | d6ff1f5b17f8fa2f | **DIFFERENT** | 1.2 kB | 0.13 | 0.34 |
| physx / tuned [nosleep] | identical | identical | 0f504423e1ef57bc | **DIFFERENT** | 1.2 kB | 0.21 | 0.77 |
| rapier / default | identical | identical | b386c554f5e879a2 | identical | 28559.0 kB | 53.86 | 47.94 |
| rapier / default [deterministic-build] | identical | identical | b386c554f5e879a2 | identical | 28559.0 kB | 49.02 | 48.15 |
| rapier / scaled | identical | identical | 644e18108205b5e3 | identical | 1975.3 kB | 4.57 | 9.22 |
| rapier / scaled [nosleep] | identical | identical | ad9278ae327ba4e6 | identical | 1976.4 kB | 4.38 | 8.97 |

### T8 performance: step time in ms, best / median of 3 fresh-process repeats (single thread)

| engine / preset | scene @ dt | bodies / pieces / static capsules | mean step (whole run) | mean step (first 1 s, all awake) | p99 step | max step | scene build | RSS MB | outcome |
|---|---|---|---|---|---|---|---|---|---|
| jolt / default | T2@1/240 | 12 / 876 / 236 | 0.063 / 0.063 | 0.314 / 0.314 | 1.19 / 1.20 | 5.5 / 5.6 | 69 / 70 | 105 | 12/12 asleep, rest 0.17 |
| jolt / default | T5@1/240 | 20 / 140 / 0 | 0.148 / 0.148 | 0.706 / 0.708 | 0.92 / 0.93 | 4.5 / 4.6 | 66 / 68 | 107 | 20/20 asleep, rest 1.05 |
| jolt / default | FULL@1/240 | 122 / 3028 / 1355 | 1.339 / 1.340 | 5.118 / 5.122 | 10.41 / 10.42 | 19.5 / 19.6 | 74 / 77 | 118 | 122/122 asleep, rest 1.04 |
| jolt / tuned | T2@1/120 | 12 / 876 / 236 | 0.069 / 0.069 | 0.342 / 0.342 | 0.95 / 0.96 | 3.2 / 3.3 | 76 / 78 | 100 | 12/12 asleep, rest 0.22 |
| jolt / tuned | T2@1/240 | 12 / 876 / 236 | 0.050 / 0.053 | 0.250 / 0.262 | 0.59 / 0.59 | 3.3 / 3.3 | 77 / 78 | 104 | 12/12 asleep, rest 0.21 |
| jolt / tuned | T2@1/480 | 12 / 876 / 236 | 0.045 / 0.046 | 0.224 / 0.227 | 0.42 / 0.42 | 3.2 / 3.2 | 71 / 74 | 105 | 12/12 asleep, rest 0.21 |
| jolt / tuned | T5@1/120 | 20 / 140 / 0 | 0.081 / 0.081 | 0.346 / 0.348 | 0.41 / 0.42 | 3.4 / 3.5 | 70 / 72 | 104 | 20/20 asleep, rest 1.08 |
| jolt / tuned | T5@1/240 | 20 / 140 / 0 | 0.070 / 0.070 | 0.281 / 0.281 | 0.34 / 0.34 | 3.4 / 3.6 | 71 / 71 | 103 | 20/20 asleep, rest 1.16 |
| jolt / tuned | T5@1/480 | 20 / 140 / 0 | 0.068 / 0.068 | 0.272 / 0.273 | 0.33 / 0.34 | 3.4 / 3.4 | 70 / 71 | 104 | 20/20 asleep, rest 2.13 |
| jolt / tuned | FULL@1/120 | 122 / 3028 / 1355 | 0.821 / 0.847 | 3.127 / 3.232 | 5.37 / 5.38 | 6.3 / 6.4 | 79 / 79 | 111 | 122/122 asleep, rest 1.72 |
| jolt / tuned | FULL@1/240 | 122 / 3028 / 1355 | 0.750 / 0.781 | 2.882 / 3.007 | 4.50 / 4.76 | 6.2 / 6.3 | 80 / 80 | 118 | 122/122 asleep, rest 1.48 |
| jolt / tuned | FULL@1/480 | 122 / 3028 / 1355 | 0.780 / 0.797 | 2.825 / 2.897 | 4.58 / 4.71 | 6.2 / 6.2 | 80 / 81 | 120 | 122/122 asleep, rest 2.50 |
| jolt / tuned-ccd | T2@1/240 | 12 / 876 / 236 | 0.090 / 0.091 | 0.449 / 0.452 | 0.61 / 0.62 | 9.0 / 9.2 | 71 / 74 | 105 | 12/12 asleep, rest 0.21 |
| jolt / tuned-ccd | T5@1/240 | 20 / 140 / 0 | 0.080 / 0.080 | 0.331 / 0.332 | 0.65 / 0.65 | 3.4 / 3.7 | 71 / 72 | 108 | 20/20 asleep, rest 1.16 |
| jolt / tuned-ccd | FULL@1/240 | 122 / 3028 / 1355 | 1.117 / 1.128 | 4.345 / 4.392 | 17.29 / 17.39 | 27.9 / 28.4 | 77 / 79 | 119 | 122/122 asleep, rest 1.48 |
| jolt / tuned-ccd [awake] | T2@1/240 | 12 / 876 / 236 | 0.383 / 0.390 | 0.585 / 0.596 | 0.61 / 0.61 | 9.2 / 9.5 | 71 / 71 | 105 | 0/12 asleep, rest 0.21 |
| jolt / tuned-ccd [awake] | T5@1/240 | 20 / 140 / 0 | 0.290 / 0.296 | 0.327 / 0.330 | 0.61 / 0.62 | 3.3 / 3.3 | 69 / 69 | 103 | 0/20 asleep, rest 1.25 |
| jolt / tuned-ccd [awake] | FULL@1/240 | 122 / 3028 / 1355 | 4.769 / 4.797 | 5.817 / 5.996 | 17.38 / 17.85 | 28.2 / 30.5 | 77 / 85 | 120 | 0/122 asleep, rest 1.73 |
| jolt / tuned [awake] | T2@1/240 | 12 / 876 / 236 | 0.351 / 0.355 | 0.396 / 0.401 | 0.63 / 0.63 | 3.4 / 3.6 | 78 / 79 | 103 | 0/12 asleep, rest 0.21 |
| jolt / tuned [awake] | T5@1/240 | 20 / 140 / 0 | 0.294 / 0.297 | 0.300 / 0.304 | 0.42 / 0.42 | 3.6 / 3.8 | 76 / 78 | 106 | 0/20 asleep, rest 1.25 |
| jolt / tuned [awake] | FULL@1/240 | 122 / 3028 / 1355 | 4.140 / 4.245 | 4.100 / 4.157 | 4.68 / 5.12 | 6.7 / 9.8 | 80 / 86 | 117 | 0/122 asleep, rest 1.73 |
| mujoco / default | T2@1/240 | 12 / 876 / 236 | 0.505 / 0.505 | 0.566 / 0.568 | 1.00 / 1.08 | 2.3 / 2.5 | 126 / 129 | 174 | 0/12 asleep, rest 0.29 |
| mujoco / default | T5@1/240 | 20 / 140 / 0 | 0.235 / 0.241 | 0.257 / 0.260 | 0.37 / 0.37 | 2.2 / 2.2 | 98 / 99 | 166 | 0/20 asleep, rest **never** |
| mujoco / default | FULL@1/240 | 122 / 3028 / 1355 | 6.020 / 6.101 | 5.937 / 6.042 | 7.04 / 7.22 | 7.4 / 8.1 | 245 / 248 | 200 | 0/122 asleep, rest **never** |
| mujoco / tuned | T2@1/120 | 12 / 876 / 236 | 0.117 / 0.119 | 0.351 / 0.373 | 0.98 / 1.29 | 2.5 / 2.7 | 139 / 143 | 166 | 12/12 asleep, rest 0.25 |
| mujoco / tuned | T2@1/240 | 12 / 876 / 236 | 0.089 / 0.098 | 0.234 / 0.270 | 0.89 / 1.07 | 2.2 / 2.5 | 133 / 134 | 178 | 12/12 asleep, rest 0.24 |
| mujoco / tuned | T2@1/480 | 12 / 876 / 236 | 0.077 / 0.079 | 0.179 / 0.183 | 0.68 / 0.73 | 2.4 / 2.4 | 131 / 132 | 180 | 12/12 asleep, rest 0.24 |
| mujoco / tuned | T5@1/120 | 20 / 140 / 0 | 0.079 / 0.080 | 0.325 / 0.333 | 0.56 / 0.56 | 2.3 / 2.3 | 104 / 105 | 161 | 20/20 asleep, rest 0.83 |
| mujoco / tuned | T5@1/240 | 20 / 140 / 0 | 0.066 / 0.068 | 0.247 / 0.249 | 0.39 / 0.41 | 2.3 / 2.3 | 105 / 105 | 171 | 20/20 asleep, rest 1.39 |
| mujoco / tuned | T5@1/480 | 20 / 140 / 0 | 0.070 / 0.073 | 0.202 / 0.205 | 0.31 / 0.31 | 2.4 / 2.4 | 103 / 104 | 168 | 20/20 asleep, rest 3.38 |
| mujoco / tuned | FULL@1/120 | 122 / 3028 / 1355 | 1.172 / 1.278 | 3.886 / 4.327 | 10.32 / 11.68 | 11.7 / 13.6 | 255 / 256 | 205 | 120/122 asleep, rest 1.13 |
| mujoco / tuned | FULL@1/240 | 122 / 3028 / 1355 | 0.825 / 0.838 | 2.618 / 2.626 | 7.99 / 8.03 | 12.4 / 12.6 | 272 / 273 | 195 | 122/122 asleep, rest 1.57 |
| mujoco / tuned | FULL@1/480 | 122 / 3028 / 1355 | 0.990 / 1.003 | 3.033 / 3.098 | 6.69 / 6.99 | 7.9 / 8.4 | 261 / 269 | 202 | 120/122 asleep, rest **never** |
| mujoco / tuned [awake] | T2@1/240 | 12 / 876 / 236 | 0.516 / 0.531 | 0.579 / 0.584 | 0.82 / 0.88 | 2.3 / 2.5 | 132 / 139 | 176 | 0/12 asleep, rest 0.24 |
| mujoco / tuned [awake] | T5@1/240 | 20 / 140 / 0 | 0.232 / 0.233 | 0.268 / 0.280 | 0.38 / 0.42 | 2.4 / 2.5 | 108 / 108 | 167 | 0/20 asleep, rest 1.48 |
| mujoco / tuned [awake] | FULL@1/240 | 122 / 3028 / 1355 | 6.723 / 6.744 | 6.869 / 6.918 | 7.90 / 7.91 | 8.9 / 10.0 | 259 / 268 | 199 | 0/122 asleep, rest 3.34 |
| physx / default | T2@1/240 | 12 / 876 / 236 | 0.920 / 0.925 | 4.578 / 4.606 | 15.23 / 15.28 | 44.2 / 44.3 | 100 / 100 | 161 | 12/12 asleep, rest 0.40 |
| physx / default | T5@1/240 | 20 / 140 / 0 | 0.605 / 0.605 | 1.697 / 1.698 | 2.28 / 2.33 | 13.5 / 13.8 | 95 / 98 | 136 | 20/20 asleep, rest 2.15 |
| physx / default | FULL@1/240 | 122 / 3028 / 1355 | 9.598 / 9.698 | 29.515 / 29.930 | 67.46 / 67.70 | 104.6 / 105.3 | 106 / 106 | 249 | 122/122 asleep, rest 1.83 |
| physx / tuned | T2@1/120 | 12 / 876 / 236 | 0.079 / 0.081 | 0.372 / 0.382 | 1.07 / 1.08 | 8.4 / 8.7 | 105 / 106 | 133 | 12/12 asleep, rest 0.41 |
| physx / tuned | T2@1/240 | 12 / 876 / 236 | 0.075 / 0.078 | 0.354 / 0.368 | 0.83 / 0.83 | 8.7 / 8.8 | 105 / 105 | 131 | 12/12 asleep, rest 0.29 |
| physx / tuned | T2@1/480 | 12 / 876 / 236 | 0.064 / 0.065 | 0.300 / 0.307 | 0.71 / 0.72 | 8.5 / 9.6 | 104 / 107 | 135 | 12/12 asleep, rest 0.25 |
| physx / tuned | T5@1/120 | 20 / 140 / 0 | 0.067 / 0.079 | 0.281 / 0.327 | 0.36 / 0.46 | 7.7 / 8.4 | 101 / 104 | 133 | 20/20 asleep, rest 2.37 |
| physx / tuned | T5@1/240 | 20 / 140 / 0 | 0.059 / 0.060 | 0.263 / 0.266 | 0.36 / 0.36 | 7.6 / 7.8 | 102 / 103 | 131 | 20/20 asleep, rest 1.10 |
| physx / tuned | T5@1/480 | 20 / 140 / 0 | 0.043 / 0.044 | 0.187 / 0.190 | 0.22 / 0.22 | 7.7 / 8.0 | 100 / 103 | 136 | 20/20 asleep, rest 1.16 |
| physx / tuned | FULL@1/120 | 122 / 3028 / 1355 | 1.823 / 1.859 | 3.716 / 3.852 | 5.67 / 6.01 | 12.3 / 13.1 | 95 / 112 | 141 | 112/122 asleep, rest **never** |
| physx / tuned | FULL@1/240 | 122 / 3028 / 1355 | 1.433 / 1.467 | 3.404 / 3.446 | 4.77 / 4.78 | 12.3 / 12.3 | 96 / 97 | 142 | 118/122 asleep, rest 3.14 |
| physx / tuned | FULL@1/480 | 122 / 3028 / 1355 | 0.891 / 0.911 | 2.719 / 2.777 | 4.43 / 4.52 | 12.2 / 12.4 | 97 / 97 | 143 | 120/122 asleep, rest 3.39 |
| physx / tuned [awake] | T2@1/240 | 12 / 876 / 236 | 0.540 / 0.541 | 0.618 / 0.625 | 0.87 / 0.90 | 9.0 / 9.0 | 111 / 111 | 127 | 0/12 asleep, rest 0.29 |
| physx / tuned [awake] | T5@1/240 | 20 / 140 / 0 | 0.264 / 0.264 | 0.297 / 0.301 | 0.37 / 0.39 | 7.8 / 7.9 | 105 / 106 | 132 | 0/20 asleep, rest **never** |
| physx / tuned [awake] | FULL@1/240 | 122 / 3028 / 1355 | 5.286 / 5.890 | 5.329 / 5.434 | 6.29 / 7.06 | 13.3 / 14.4 | 117 / 126 | 137 | 0/122 asleep, rest **never** |
| rapier / default | T2@1/120 | 12 / 876 / 236 | 6.729 / 6.744 | 24.592 / 24.682 | 34.60 / 35.12 | 167.3 / 169.8 | 74 / 74 | 317 | 12/12 asleep, rest 0.97 |
| rapier / default | T2@1/240 | 12 / 876 / 236 | 6.083 / 6.429 | 22.019 / 23.391 | 30.80 / 32.22 | 156.1 / 160.3 | 73 / 75 | 326 | 12/12 asleep, rest 0.96 |
| rapier / default | T2@1/480 | 12 / 876 / 236 | 5.543 / 5.880 | 20.659 / 20.748 | 28.46 / 31.23 | 165.1 / 177.4 | 78 / 80 | 334 | 12/12 asleep, rest 0.91 |
| rapier / default | T5@1/120 | 20 / 140 / 0 | 0.936 / 0.939 | 3.977 / 4.000 | 5.34 / 5.49 | 52.9 / 54.4 | 67 / 67 | 250 | 20/20 asleep, rest 1.21 |
| rapier / default | T5@1/240 | 20 / 140 / 0 | 0.731 / 0.753 | 3.069 / 3.196 | 4.13 / 4.34 | 50.8 / 53.4 | 68 / 69 | 255 | 20/20 asleep, rest 1.28 |
| rapier / default | T5@1/480 | 20 / 140 / 0 | 0.463 / 0.469 | 2.180 / 2.214 | 3.39 / 3.50 | 52.5 / 54.0 | 68 / 70 | 258 | 20/20 asleep, rest 1.04 |
| rapier / default | FULL@1/120 | 122 / 3028 / 1355 | 32.522 / 33.044 | 89.777 / 90.839 | 106.68 / 108.15 | 501.8 / 542.4 | 103 / 107 | 492 | 122/122 asleep, rest 2.02 |
| rapier / default | FULL@1/240 | 122 / 3028 / 1355 | 31.015 / 31.230 | 80.091 / 80.920 | 94.73 / 96.95 | 486.4 / 498.1 | 101 / 105 | 486 | 122/122 asleep, rest 1.86 |
| rapier / default | FULL@1/480 | 122 / 3028 / 1355 | 25.156 / 25.464 | 74.872 / 75.900 | 88.89 / 90.38 | 509.4 / 518.6 | 100 / 101 | 498 | 122/122 asleep, rest 2.57 |
| rapier / default [awake] | T2@1/240 | 12 / 876 / 236 | 17.574 / 17.885 | 19.452 / 20.151 | 26.82 / 29.22 | 163.4 / 163.9 | 75 / 79 | 328 | 0/12 asleep, rest 0.96 |
| rapier / default [awake] | T5@1/240 | 20 / 140 / 0 | 1.735 / 1.777 | 2.622 / 2.652 | 3.51 / 3.91 | 47.5 / 50.8 | 65 / 67 | 247 | 0/20 asleep, rest 2.18 |
| rapier / default [awake-full-1rep] | FULL@1/240 | 122 / 3028 / 1355 | 78.835 / 78.835 | 80.996 / 80.996 | 104.29 / 104.29 | 492.4 / 492.4 | 96 / 96 | 493 | 0/122 asleep, rest 2.70 |
| rapier / default [simd] | T2@1/240 | 12 / 876 / 236 | 3.904 / 3.944 | 14.344 / 14.359 | 21.35 / 21.50 | 143.1 / 144.2 | 74 / 75 | 312 | 12/12 asleep, rest 0.95 |
| rapier / default [simd] | T5@1/240 | 20 / 140 / 0 | 0.296 / 0.301 | 1.108 / 1.148 | 1.92 / 2.11 | 32.8 / 33.2 | 63 / 64 | 239 | 20/20 asleep, rest 1.38 |
| rapier / scaled | T2@1/120 | 12 / 876 / 236 | 0.334 / 0.336 | 1.337 / 1.342 | 3.83 / 4.02 | 42.8 / 43.1 | 70 / 74 | 233 | 12/12 asleep, rest 0.27 |
| rapier / scaled | T2@1/240 | 12 / 876 / 236 | 0.237 / 0.238 | 0.854 / 0.862 | 3.09 / 3.10 | 42.5 / 42.6 | 66 / 71 | 242 | 12/12 asleep, rest 0.25 |
| rapier / scaled | T2@1/480 | 12 / 876 / 236 | 0.187 / 0.187 | 0.610 / 0.611 | 1.31 / 1.46 | 39.8 / 42.0 | 70 / 71 | 254 | 12/12 asleep, rest 0.25 |
| rapier / scaled | T5@1/120 | 20 / 140 / 0 | 0.205 / 0.207 | 0.881 / 0.892 | 0.87 / 0.89 | 38.2 / 39.3 | 59 / 60 | 216 | 20/20 asleep, rest 1.32 |
| rapier / scaled | T5@1/240 | 20 / 140 / 0 | 0.143 / 0.144 | 0.558 / 0.563 | 0.71 / 0.76 | 39.0 / 40.2 | 60 / 60 | 242 | 20/20 asleep, rest 1.35 |
| rapier / scaled | T5@1/480 | 20 / 140 / 0 | 0.092 / 0.095 | 0.342 / 0.359 | 0.44 / 0.55 | 39.3 / 40.4 | 60 / 61 | 237 | 20/20 asleep, rest 1.06 |
| rapier / scaled | FULL@1/120 | 122 / 3028 / 1355 | 2.169 / 2.243 | 7.502 / 7.815 | 16.56 / 16.95 | 58.5 / 62.3 | 95 / 97 | 256 | 122/122 asleep, rest 0.97 |
| rapier / scaled | FULL@1/240 | 122 / 3028 / 1355 | 1.453 / 1.534 | 4.621 / 4.989 | 11.12 / 11.22 | 54.9 / 59.9 | 86 / 100 | 282 | 122/122 asleep, rest 1.11 |
| rapier / scaled | FULL@1/480 | 122 / 3028 / 1355 | 1.284 / 1.825 | 4.050 / 5.893 | 8.58 / 15.24 | 55.5 / 91.2 | 92 / 110 | 149 | 122/122 asleep, rest 1.05 |
| rapier / scaled [awake] | T2@1/240 | 12 / 876 / 236 | 0.606 / 0.608 | 0.990 / 0.990 | 3.14 / 3.22 | 42.6 / 43.1 | 70 / 71 | 243 | 0/12 asleep, rest 0.25 |
| rapier / scaled [awake] | T5@1/240 | 20 / 140 / 0 | 0.312 / 0.313 | 0.571 / 0.572 | 0.65 / 0.75 | 40.5 / 40.6 | 54 / 56 | 236 | 0/20 asleep, rest 1.34 |
| rapier / scaled [awake] | FULL@1/240 | 122 / 3028 / 1355 | 4.261 / 4.647 | 5.799 / 5.857 | 10.56 / 10.92 | 51.2 / 58.3 | 94 / 94 | 288 | 0/122 asleep, rest 1.12 |
| rapier / small | T2@1/240 | 12 / 876 / 236 | 0.268 / 0.272 | 0.959 / 0.978 | 3.64 / 3.65 | 49.7 / 52.3 | 75 / 81 | 245 | 12/12 asleep, rest 0.24 |
| rapier / small | T5@1/240 | 20 / 140 / 0 | 0.175 / 0.180 | 0.708 / 0.737 | 1.31 / 1.73 | 46.5 / 47.6 | 67 / 69 | 238 | 20/20 asleep, rest 1.20 |
| rapier / small | FULL@1/240 | 122 / 3028 / 1355 | 31.765 / 33.238 | 21.857 / 24.519 | 44.12 / 64.85 | 73.2 / 126.9 | 95 / 102 | 141 | 109/122 asleep, rest **never** |

### T9 disturbance of plate 5 in the settled T2 rack (applied at t = 5 s, observed 5 s)

| engine / preset | disturbance | responded | max displacement mm | final displacement mm | max neighbour displacement mm | re-settle time s | exploded | max pen wires mm | max pen plate-plate mm | final lean deg | asleep at end |
|---|---|---|---|---|---|---|---|---|---|---|---|
| jolt / default | rock-z-0.02Ns-top | yes | 0.60 | 0.600 | 0 | 0.05 | no | 1.047 | 0 | 11.84 | 12/12 |
| jolt / default | rock-z-0.05Ns-top | yes | 3.18 | 3.183 | 0 | 0.14 | no | 1.047 | 0 | 11.85 | 12/12 |
| jolt / default | roll-x-0.03Ns-centre | yes | 0.18 | 0.176 | 0 | 0.01 | no | 1.047 | 0 | 11.85 | 12/12 |
| jolt / default | jet-2N-z-0.25s-centre | yes | 14.27 | 3.709 | 0.064 | 0.52 | no | 1.047 | 0 | 12.75 | 12/12 |
| jolt / tuned | rock-z-0.02Ns-top | yes | 0.43 | 0.421 | 0 | 0.05 | no | 0.095 | 0 | 11.82 | 12/12 |
| jolt / tuned | rock-z-0.05Ns-top | yes | 3.22 | 3.217 | 0 | 0.15 | no | 0.095 | 0 | 11.83 | 12/12 |
| jolt / tuned | roll-x-0.03Ns-centre | yes | 0.27 | 0.261 | 0 | 0.02 | no | 0.095 | 0 | 11.82 | 12/12 |
| jolt / tuned | jet-2N-z-0.25s-centre | yes | 19.03 | 10.003 | 0 | 0.52 | no | 0.111 | 0 | 11.89 | 12/12 |
| mujoco / default | rock-z-0.02Ns-top | yes | 0.42 | 0.020 | 0.021 | 0.05 | no | 3.735 | 0 | 11.83 | 0/12 |
| mujoco / default | rock-z-0.05Ns-top | yes | 3.06 | 0.018 | 0.021 | 0.19 | no | 3.735 | 0 | 11.83 | 0/12 |
| mujoco / default | roll-x-0.03Ns-centre | yes | 0.24 | 0.019 | 0.021 | 0.06 | no | 3.735 | 0 | 11.83 | 0/12 |
| mujoco / default | jet-2N-z-0.25s-centre | yes | 11.92 | 0.022 | 0.021 | 0.52 | no | 3.735 | 0 | 11.83 | 0/12 |
| mujoco / tuned | rock-z-0.02Ns-top | yes | 0.44 | 0.334 | 0 | 0.05 | no | 1.331 | 0 | 11.85 | 12/12 |
| mujoco / tuned | rock-z-0.05Ns-top | yes | 3.05 | 0.278 | 0 | 0.15 | no | 1.331 | 0 | 11.85 | 12/12 |
| mujoco / tuned | roll-x-0.03Ns-centre | yes | 0.47 | 0.467 | 0 | 0.02 | no | 1.331 | 0 | 11.86 | 12/12 |
| mujoco / tuned | jet-2N-z-0.25s-centre | yes | 16.46 | 0.306 | 0 | 0.60 | no | 1.331 | 0 | 11.87 | 12/12 |
| physx / default | rock-z-0.02Ns-top | yes | 0.81 | 0.811 | 0.529 | 0.40 | no | 0.440 | 0 | 11.96 | 12/12 |
| physx / default | rock-z-0.05Ns-top | yes | 3.17 | 0.804 | 0.529 | 0.40 | no | 0.440 | 0 | 11.95 | 12/12 |
| physx / default | roll-x-0.03Ns-centre | yes | 0.19 | 0.037 | 0.529 | 0.40 | no | 0.440 | 0 | 11.94 | 12/12 |
| physx / default | jet-2N-z-0.25s-centre | yes | 15.56 | 0.841 | 0.530 | 0.65 | no | 0.440 | 0 | 11.97 | 12/12 |
| physx / tuned | rock-z-0.02Ns-top | yes | 0.45 | 0.132 | 0 | 0.05 | no | 0.094 | 0 | 11.83 | 12/12 |
| physx / tuned | rock-z-0.05Ns-top | yes | 3.07 | 0.129 | 0 | 0.15 | no | 0.094 | 0 | 11.83 | 12/12 |
| physx / tuned | roll-x-0.03Ns-centre | yes | 0.20 | 0.047 | 0 | 0.01 | no | 0.094 | 0 | 11.83 | 12/12 |
| physx / tuned | jet-2N-z-0.25s-centre | yes | 12.57 | 0.130 | 0 | 0.56 | no | 0.094 | 0 | 11.83 | 12/12 |
| rapier / default | rock-z-0.02Ns-top | yes | 0.90 | 0.025 | 0.002 | 0.10 | no | 0.989 | 0 | 11.85 | 12/12 |
| rapier / default | rock-z-0.05Ns-top | yes | 5.60 | 0.009 | 0.002 | 0.24 | no | 0.989 | 0 | 11.83 | 12/12 |
| rapier / default | roll-x-0.03Ns-centre | yes | 0.32 | 0.167 | 0.002 | 0.05 | no | 0.989 | 0 | 11.85 | 12/12 |
| rapier / default | jet-2N-z-0.25s-centre | yes | 26.47 | 0.063 | 8.066 | 0.68 | no | 0.989 | 0.038 | 11.84 | 12/12 |
| rapier / tuned | rock-z-0.02Ns-top | yes | 0.85 | 0.050 | 0 | 0.09 | no | 0.077 | 0 | 9.79 | 12/12 |
| rapier / tuned | rock-z-0.05Ns-top | yes | 5.38 | 0.104 | 0 | 0.23 | no | 0.077 | 0 | 9.79 | 12/12 |
| rapier / tuned | roll-x-0.03Ns-centre | yes | 0.31 | 0.149 | 0 | 0.05 | no | 0.077 | 0 | 9.81 | 12/12 |
| rapier / tuned | jet-2N-z-0.25s-centre | yes | 23.89 | 0.136 | 6.826 | 0.56 | no | 0.077 | 0 | 9.80 | 12/12 |
| rapier / scaled | rock-z-0.02Ns-top | yes | 1.36 | 1.361 | 0 | 0.10 | no | 0.363 | 0 | 11.90 | 12/12 |
| rapier / scaled | rock-z-0.05Ns-top | yes | 3.89 | 2.334 | 0 | 0.18 | no | 0.363 | 0 | 11.92 | 12/12 |
| rapier / scaled | roll-x-0.03Ns-centre | yes | 0.27 | 0.262 | 0 | 0.01 | no | 0.363 | 0 | 11.89 | 12/12 |
| rapier / scaled | jet-2N-z-0.25s-centre | yes | 12.78 | 1.816 | 0 | 0.50 | no | 0.363 | 0 | 11.89 | 12/12 |

### Sensitivity (tuned presets): friction, restitution, time step, decomposition granularity

| engine / preset | variation | test | time to rest s | max pen mm | final pen mm | outcome |
|---|---|---|---|---|---|---|
| jolt / tuned | bowlN16 | T3 | 0.19 | 0.108 | 0.049 | spacing 20.60/20.46/20.64 mm |
| jolt / tuned | bowlN32 | T3 | 0.20 | 0.064 | 0.046 | spacing 20.54/20.38/20.63 mm |
| jolt / tuned | dt=1/120 | T1 | 0.18 | 0.100 | 0.058 | lean 11.88 deg, y 126.02 mm |
| jolt / tuned | dt=1/120 | T2 | 0.22 | 0.306 | 0.110 | lean 11.83..11.98 deg |
| jolt / tuned | dt=1/120 | T3 | 0.28 | 0.135 | 0.084 | spacing 21.33/21.28/21.32 mm |
| jolt / tuned | dt=1/120 | T5 | 1.08 | 0.656 | 0.082 | escaped 10/0 |
| jolt / tuned | dt=1/480 | T1 | 0.13 | 0.015 | 0.012 | lean 11.83 deg, y 125.90 mm |
| jolt / tuned | dt=1/480 | T2 | 0.21 | 0.055 | 0.055 | lean 11.72..11.84 deg |
| jolt / tuned | dt=1/480 | T3 | 0.16 | 0.023 | 0.008 | spacing 21.35/21.35/21.36 mm |
| jolt / tuned | dt=1/480 | T5 | 2.13 | 0.174 | 0.036 | escaped 0/0 |
| jolt / tuned | e0.05 | T1 | 0.14 | 0.098 | 0.035 | lean 11.86 deg, y 125.85 mm |
| jolt / tuned | e0.05 | T5 | 1.35 | 0.042 | 0.016 | escaped 0/0 |
| jolt / tuned | e0.2 | T1 | 0.16 | 0.108 | 0.005 | lean 11.81 deg, y 125.85 mm |
| jolt / tuned | e0.2 | T5 | 1.73 | 0.192 | 0.099 | escaped 0/0 |
| jolt / tuned | mu0.3 | T1 | 0.34 | 0.108 | 0.065 | lean 11.87 deg, y 125.38 mm |
| jolt / tuned | mu0.3 | T2 | 0.36 | 0.122 | 0.060 | lean 11.76..11.85 deg |
| jolt / tuned | mu0.5 | T1 | 0.14 | 0.058 | 0.025 | lean 11.85 deg, y 125.86 mm |
| jolt / tuned | mu0.5 | T2 | 0.17 | 0.089 | 0.087 | lean 11.76..11.86 deg |
| jolt / tuned | plateN12 | T1 | 0.13 | 0.106 | 0.058 | lean 11.82 deg, y 124.49 mm |
| jolt / tuned | plateN16 | T1 | 0.11 | 0.026 | 0.004 | lean 11.79 deg, y 125.40 mm |
| jolt / tuned | plateN36 | T1 | 0.14 | 0.047 | 0.046 | lean 11.86 deg, y 126.62 mm |
| mujoco / tuned | bowlN16 | T3 | 0.31 | 0.855 | 0.409 | spacing 17.46/20.49/19.54 mm |
| mujoco / tuned | bowlN32 | T3 | 0.33 | 0.744 | 0.289 | spacing 19.02/18.32/19.57 mm |
| mujoco / tuned | dt=1/120 | T1 | 0.17 | 1.074 | 0.097 | lean 11.95 deg, y 125.72 mm |
| mujoco / tuned | dt=1/120 | T2 | 0.25 | 2.344 | 0.116 | lean 11.88..11.96 deg |
| mujoco / tuned | dt=1/120 | T3 | 0.19 | 1.706 | 0.292 | spacing 20.25/20.65/20.94 mm |
| mujoco / tuned | dt=1/120 | T5 | 0.83 | 4.804 | 0.129 | escaped 20/0 |
| mujoco / tuned | dt=1/480 | T1 | 0.23 | 1.043 | 0.007 | lean 11.80 deg, y 125.75 mm |
| mujoco / tuned | dt=1/480 | T2 | 0.24 | 1.094 | 0.009 | lean 11.74..11.83 deg |
| mujoco / tuned | dt=1/480 | T3 | 0.55 | 0.328 | 0.053 | spacing 21.17/21.29/21.33 mm |
| mujoco / tuned | dt=1/480 | T5 | 3.38 | 1.420 | 0.009 | escaped 12/0 |
| mujoco / tuned | e0.05 | T1 | 0.20 | 0.359 | 0.026 | lean 11.85 deg, y 125.67 mm |
| mujoco / tuned | e0.05 | T5 | 1.39 | 2.550 | 0.038 | escaped 20/0 |
| mujoco / tuned | e0.2 | T1 | 0.20 | 0.359 | 0.026 | lean 11.85 deg, y 125.67 mm |
| mujoco / tuned | e0.2 | T5 | 1.39 | 2.550 | 0.038 | escaped 20/0 |
| mujoco / tuned | mu0.3 | T1 | 0.40 | 0.525 | 0.018 | lean 11.83 deg, y 125.39 mm |
| mujoco / tuned | mu0.3 | T2 | 0.41 | 1.331 | 0.029 | lean 11.76..11.86 deg |
| mujoco / tuned | mu0.5 | T1 | 0.23 | 2.269 | 0.032 | lean 11.82 deg, y 125.73 mm |
| mujoco / tuned | mu0.5 | T2 | 0.24 | 1.331 | 0.043 | lean 11.77..11.87 deg |
| mujoco / tuned | plateN12 | T1 | 0.17 | 1.140 | 0.029 | lean 11.78 deg, y 124.26 mm |
| mujoco / tuned | plateN16 | T1 | 0.21 | 2.183 | 0.029 | lean 11.86 deg, y 124.84 mm |
| mujoco / tuned | plateN36 | T1 | 0.18 | 0.584 | 0.026 | lean 11.86 deg, y 126.19 mm |
| physx / tuned | bowlN16 | T3 | 3.98 | 1.264 | 0.265 | spacing 20.45/19.85/20.87 mm |
| physx / tuned | bowlN32 | T3 | 0.40 | 0.251 | 0.028 | spacing 18.99/20.20/19.84 mm |
| physx / tuned | dt=1/120 | T1 | 0.41 | 0.040 | 0.015 | lean 11.82 deg, y 125.97 mm |
| physx / tuned | dt=1/120 | T2 | 0.41 | 0.187 | 0.018 | lean 11.75..11.85 deg |
| physx / tuned | dt=1/120 | T3 | 0.41 | 0.997 | 0.106 | spacing 21.26/20.76/21.33 mm |
| physx / tuned | dt=1/120 | T5 | 2.37 | 0.656 | 0.148 | escaped 10/0 |
| physx / tuned | dt=1/480 | T1 | 0.14 | 0.008 | 0.001 | lean 11.81 deg, y 125.85 mm |
| physx / tuned | dt=1/480 | T2 | 0.25 | 0.035 | 0.001 | lean 11.73..11.89 deg |
| physx / tuned | dt=1/480 | T3 | 2.85 | 0.076 | 0.056 | spacing 21.27/20.44/21.05 mm |
| physx / tuned | dt=1/480 | T5 | 1.16 | 0.500 | 0.002 | escaped 0/0 |
| physx / tuned | e0.05 | T1 | 0.24 | 0.073 | 0.004 | lean 11.82 deg, y 125.61 mm |
| physx / tuned | e0.05 | T5 | 1.15 | 0.503 | 0.367 | escaped 0/0 |
| physx / tuned | e0.2 | T1 | 0.21 | 0.040 | 0.004 | lean 11.81 deg, y 125.68 mm |
| physx / tuned | e0.2 | T5 | 2.66 | 0.871 | 0.448 | escaped 0/0 |
| physx / tuned | mu0.3 | T1 | 0.31 | 0.126 | 0.004 | lean 11.81 deg, y 125.42 mm |
| physx / tuned | mu0.3 | T2 | 0.33 | 0.057 | 0.004 | lean 11.74..11.82 deg |
| physx / tuned | mu0.5 | T1 | 0.12 | 0.049 | 0.003 | lean 11.81 deg, y 125.88 mm |
| physx / tuned | mu0.5 | T2 | 0.23 | 0.112 | 0.004 | lean 11.74..11.92 deg |
| physx / tuned | plateN12 | T1 | 0.16 | 0.004 | 0.004 | lean 11.91 deg, y 124.90 mm |
| physx / tuned | plateN16 | T1 | 0.14 | 0.053 | 0.004 | lean 11.81 deg, y 125.26 mm |
| physx / tuned | plateN36 | T1 | 0.15 | 0.053 | 0.004 | lean 11.83 deg, y 126.27 mm |
| rapier / scaled | bowlN16 | T3 | 0.29 | 0.172 | 0.047 | spacing 20.33/20.53/20.68 mm |
| rapier / scaled | bowlN32 | T3 | 0.38 | 0.132 | 0.044 | spacing 20.31/20.41/20.64 mm |
| rapier / scaled | dt=1/120 | T1 | 0.23 | 0.107 | 0.072 | lean 11.89 deg, y 126.10 mm |
| rapier / scaled | dt=1/120 | T2 | 0.27 | 0.588 | 0.273 | lean 11.83..12.13 deg |
| rapier / scaled | dt=1/120 | T3 | 0.41 | 0.615 | 0.072 | spacing 21.26/21.29/21.23 mm |
| rapier / scaled | dt=1/120 | T5 | 1.32 | 0.422 | 0.077 | escaped 0/0 |
| rapier / scaled | dt=1/480 | T1 | 0.18 | 0.032 | 0.032 | lean 11.87 deg, y 126.14 mm |
| rapier / scaled | dt=1/480 | T2 | 0.25 | 0.369 | 0.054 | lean 11.79..11.87 deg |
| rapier / scaled | dt=1/480 | T3 | 0.49 | 0.107 | 0.066 | spacing 21.24/21.25/21.29 mm |
| rapier / scaled | dt=1/480 | T5 | 1.06 | 0.162 | 0.076 | escaped 0/0 |
| rapier / scaled | e0.05 | T1 | 0.20 | 0.052 | 0.033 | lean 11.86 deg, y 126.13 mm |
| rapier / scaled | e0.05 | T5 | 1.04 | 0.176 | 0.082 | escaped 0/0 |
| rapier / scaled | e0.2 | T1 | 0.21 | 0.114 | 0.093 | lean 11.94 deg, y 126.02 mm |
| rapier / scaled | e0.2 | T5 | 1.88 | 0.207 | 0.075 | escaped 0/0 |
| rapier / scaled | mu0.3 | T1 | 0.20 | 0.262 | 0.106 | lean 11.95 deg, y 126.05 mm |
| rapier / scaled | mu0.3 | T2 | 0.27 | 0.421 | 0.128 | lean 11.78..11.98 deg |
| rapier / scaled | mu0.5 | T1 | 0.18 | 0.073 | 0.053 | lean 11.89 deg, y 126.07 mm |
| rapier / scaled | mu0.5 | T2 | 0.23 | 0.363 | 0.282 | lean 11.82..12.15 deg |
| rapier / scaled | plateN12 | T1 | 0.21 | 0.057 | 0.047 | lean 11.79 deg, y 124.59 mm |
| rapier / scaled | plateN16 | T1 | 0.25 | 0.049 | 0.049 | lean 11.84 deg, y 125.50 mm |
| rapier / scaled | plateN36 | T1 | 0.15 | 0.041 | 0.041 | lean 11.90 deg, y 126.40 mm |
| rapier / tuned | bowlN16 | T3 | 0.58 | 0 | 0 | spacing 31.21/31.23/31.34 mm |
| rapier / tuned | bowlN32 | T3 | 0.46 | 0 | 0 | spacing 31.10/31.02/31.19 mm |
| rapier / tuned | dt=1/120 | T1 | 0.82 | 0.214 | 0 | lean 9.79 deg, y 127.50 mm |
| rapier / tuned | dt=1/120 | T2 | 0.94 | 0.081 | 0 | lean 5.63..9.82 deg |
| rapier / tuned | dt=1/120 | T3 | 0.78 | 0 | 0 | spacing 31.14/31.13/31.21 mm |
| rapier / tuned | dt=1/120 | T5 | 1.20 | 3.112 | 0.122 | escaped 0/0 |
| rapier / tuned | dt=1/480 | T1 | 0.84 | 0.316 | 0 | lean 9.91 deg, y 127.47 mm |
| rapier / tuned | dt=1/480 | T2 | 0.95 | 0.170 | 0 | lean 7.47..9.85 deg |
| rapier / tuned | dt=1/480 | T3 | 0.30 | 0 | 0 | spacing 31.14/31.14/31.28 mm |
| rapier / tuned | dt=1/480 | T5 | 1.08 | 3.606 | 2.372 | escaped 0/0 |
| rapier / tuned | e0.05 | T1 | 0.84 | 0.273 | 0 | lean 9.89 deg, y 127.47 mm |
| rapier / tuned | e0.05 | T5 | 1.43 | 2.643 | 1.930 | escaped 0/0 |
| rapier / tuned | e0.2 | T1 | 0.80 | 0.491 | 0 | lean 9.91 deg, y 127.64 mm |
| rapier / tuned | e0.2 | T5 | 1.30 | 2.366 | 1.968 | escaped 0/0 |
| rapier / tuned | mu0.3 | T1 | 0.76 | 0 | 0 | lean 9.77 deg, y 127.50 mm |
| rapier / tuned | mu0.3 | T2 | 1.35 | 2.490 | 2.490 | lean 4.64..9.83 deg |
| rapier / tuned | mu0.5 | T1 | 0.92 | 0 | 0 | lean 9.77 deg, y 127.57 mm |
| rapier / tuned | mu0.5 | T2 | 0.96 | 0.213 | 0 | lean 6.17..9.84 deg |
| rapier / tuned | plateN12 | T1 | 0.86 | 0 | 0 | lean 8.94 deg, y 125.80 mm |
| rapier / tuned | plateN16 | T1 | 0.68 | 0 | 0 | lean 9.95 deg, y 127.03 mm |
| rapier / tuned | plateN36 | T1 | 0.83 | 3.899 | 3.870 | lean 7.45 deg, y 129.61 mm |
