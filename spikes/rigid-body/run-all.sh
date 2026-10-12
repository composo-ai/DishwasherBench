#!/bin/sh
# Reproduce every number in RESULTS.md.  Usage: sh run-all.sh [A|B|C]   (default: all parts)
#   A = correctness tests (T1-T6, T9), engines run in parallel
#   B = timing-sensitive tests (T7 determinism, T8 performance), strictly serial
#   C = sensitivity sweeps (friction, restitution, decomposition granularity)
cd "$(dirname "$0")" || exit 1
mkdir -p logs
part="${1:-ABC}"
R="node src/run.mjs"

partA_engine() {
  e="$1"
  $R "$e" default T1,T2,T3,T4,T5,T6,T9
  $R "$e" tuned T1,T2,T3,T4,T5,T6,T9
  $R "$e" tuned T2,T4 sleep=false tag=nosleep
  $R "$e" tuned T6 s.t6hz=120,480 tag=dtsweep
}

case "$part" in *A*)
  partA_engine jolt > logs/A-jolt.log 2>&1 &
  partA_engine mujoco > logs/A-mujoco.log 2>&1 &
  ( partA_engine rapier; $R rapier small T1,T2,T3,T4,T5
    $R rapier scaled T1,T2,T3,T4,T5,T6,T9; $R rapier scaled T2,T4 sleep=false tag=nosleep
    $R rapier scaled T6 s.t6hz=120,480 tag=dtsweep ) > logs/A-rapier.log 2>&1 &
  ( $R mujoco tuned-noslip T2,T4 sleep=false tag=nosleep; $R jolt tuned-ccd T1,T2,T3,T4,T5 ) > logs/A-extra.log 2>&1 &
  partA_engine physx > logs/A-physx.log 2>&1 &
  wait
;; esac

case "$part" in *B*)
  {
    # T7 determinism
    for e in jolt mujoco physx; do $R "$e" tuned T7; done
    $R rapier default T7
    $R rapier default T7 variant=deterministic tag=deterministic-build
    $R rapier scaled T7
    for e in jolt mujoco physx; do $R "$e" tuned T7 sleep=false tag=nosleep; done
    $R rapier scaled T7 sleep=false tag=nosleep
    # T8 performance, sleeping enabled (the loading phase): 3 scenes x 3 time steps x 3 repeats
    for e in jolt mujoco physx; do $R "$e" tuned T8; done
    $R rapier default T8
    $R rapier scaled T8
    # T8 with sleeping disabled (the wash phase: nothing may sleep while jets push on the load)
    for e in jolt mujoco physx; do $R "$e" tuned T8 sleep=false tag=awake s.t8hz=240; done
    $R rapier scaled T8 sleep=false tag=awake s.t8hz=240
    $R rapier default T8 sleep=false tag=awake s.t8hz=240 s.t8scenes=T2,T5
    $R rapier default T8 sleep=false tag=awake-full-1rep s.t8hz=240 s.t8scenes=FULL s.reps=1
    # Variants
    $R jolt tuned-ccd T8 s.t8hz=240
    $R jolt tuned-ccd T8 sleep=false tag=awake s.t8hz=240
    $R rapier small T8 s.t8hz=240
    $R rapier default T8 variant=simd tag=simd s.t8scenes=T2,T5 s.t8hz=240
    $R jolt default T8 s.t8hz=240
    $R mujoco default T8 s.t8hz=240
    $R physx default T8 s.t8hz=240
  } > logs/B.log 2>&1
;; esac

case "$part" in *C*)
  {
    for e in jolt mujoco rapier physx; do
      for mu in 0.3 0.5; do $R "$e" tuned T1,T2,T4 s.friction=$mu tag=mu$mu; done
      for rest in 0.05 0.2; do $R "$e" tuned T1,T5 s.restitution=$rest tag=e$rest; done
      for n in 12 16 36; do $R "$e" tuned T1 s.plateN=$n tag=plateN$n; done
      for n in 16 32; do $R "$e" tuned T3 s.bowlN=$n tag=bowlN$n; done
      for hz in 120 480; do $R "$e" tuned T1,T2,T3,T5 dt=$hz; done
    done
    for mu in 0.3 0.5; do $R rapier scaled T1,T2,T4 s.friction=$mu tag=mu$mu; done
    for rest in 0.05 0.2; do $R rapier scaled T1,T5 s.restitution=$rest tag=e$rest; done
    for n in 12 16 36; do $R rapier scaled T1 s.plateN=$n tag=plateN$n; done
    for n in 16 32; do $R rapier scaled T3 s.bowlN=$n tag=bowlN$n; done
    for hz in 120 480; do $R rapier scaled T1,T2,T3,T5 dt=$hz; done
  } > logs/C.log 2>&1
;; esac
