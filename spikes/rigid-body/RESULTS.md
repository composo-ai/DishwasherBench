# Spike: rigid-body engine bake-off on a dish-rack scenario

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
