#!/bin/sh
# B6 (iii): C baselines. Builds three FP modes and runs 1/5/8/11 threads on the 2048x2048 grid.
# Requires out/init_2048x2048.bin (written by b6_cpu_js.mjs).
set -e
cd "$(dirname "$0")"
clang -O3 -ffp-contract=off -mcpu=native b6_stencil.c -o b6_stencil_strict
clang -O3 -mcpu=native b6_stencil.c -o b6_stencil_default
clang -O3 -ffast-math -mcpu=native b6_stencil.c -o b6_stencil_fast
for bin in strict default fast; do
  for t in 1 2 5 8 11; do
    printf '%s threads=%s ' "$bin" "$t"
    ./b6_stencil_$bin 2048 2048 $t 5 20 out/init_2048x2048.bin
  done
done
