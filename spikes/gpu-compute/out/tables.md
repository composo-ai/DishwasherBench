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

