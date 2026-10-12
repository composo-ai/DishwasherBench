// B6 (iii): the B1 stencil in C, same operation order as the WGSL kernel and the JS f32 reference.
// Build (strict FP, no FMA contraction):  clang -O3 -ffp-contract=off -mcpu=native b6_stencil.c -o b6_stencil_strict
// Usage: b6_stencil W H threads reps steps init.bin [out.bin outSteps]
//   Times `reps` blocks of `steps` steps (after 2 warm-up steps) and prints one JSON line.
//   If out.bin is given, additionally restarts from init.bin, runs exactly outSteps steps and writes the state (for bitwise checks).
// Threads > 1 use Grand Central Dispatch (dispatch_apply over horizontal bands).
#include <dispatch/dispatch.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static const float LAM = 0.2f, GRAV = 1.0f, FRIC = 0.002f, EPS = 1e-4f, DECAY = 1e-4f;

static void step_rows(const float *restrict src, float *restrict dst, int w, int h, int y0, int y1) {
  const float halfLam = 0.5f * LAM, halfG = 0.5f * GRAV;
  for (int y = y0; y < y1; y++) {
    const size_t yd = (size_t)(y > 0 ? y - 1 : 0) * w, yu = (size_t)(y < h - 1 ? y + 1 : h - 1) * w, yc = (size_t)y * w;
    for (int x = 0; x < w; x++) {
      const int xl = x > 0 ? x - 1 : 0, xr = x < w - 1 ? x + 1 : w - 1;
      const float *C = src + (yc + x) * 4, *L = src + (yc + xl) * 4, *R = src + (yc + xr) * 4, *D = src + (yd + x) * 4, *U = src + (yu + x) * 4;
      float ih, vel;
      ih = 1.0f / fmaxf(R[0], EPS); vel = R[1] * ih;
      const float fr0 = R[1], fr1 = R[1] * vel + halfG * R[0] * R[0], fr2 = R[2] * vel, fr3 = R[3] * vel;
      ih = 1.0f / fmaxf(L[0], EPS); vel = L[1] * ih;
      const float fl0 = L[1], fl1 = L[1] * vel + halfG * L[0] * L[0], fl2 = L[2] * vel, fl3 = L[3] * vel;
      ih = 1.0f / fmaxf(U[0], EPS); vel = U[2] * ih;
      const float gu0 = U[2], gu1 = U[1] * vel, gu2 = U[2] * vel + halfG * U[0] * U[0], gu3 = U[3] * vel;
      ih = 1.0f / fmaxf(D[0], EPS); vel = D[2] * ih;
      const float gd0 = D[2], gd1 = D[1] * vel, gd2 = D[2] * vel + halfG * D[0] * D[0], gd3 = D[3] * vel;
      float n0 = (0.5f * C[0] + 0.125f * (((L[0] + R[0]) + D[0]) + U[0])) - halfLam * (((fr0 - fl0) + gu0) - gd0);
      float n1 = (0.5f * C[1] + 0.125f * (((L[1] + R[1]) + D[1]) + U[1])) - halfLam * (((fr1 - fl1) + gu1) - gd1);
      float n2 = (0.5f * C[2] + 0.125f * (((L[2] + R[2]) + D[2]) + U[2])) - halfLam * (((fr2 - fl2) + gu2) - gd2);
      float n3 = (0.5f * C[3] + 0.125f * (((L[3] + R[3]) + D[3]) + U[3])) - halfLam * (((fr3 - fl3) + gu3) - gd3);
      if (n0 < EPS) {
        n0 = fmaxf(n0, 0.0f); n1 = 0.0f; n2 = 0.0f; n3 = fmaxf(n3, 0.0f);
      } else {
        const float s = n0 / (n0 + FRIC);
        n1 = n1 * s; n2 = n2 * s; n3 = fmaxf(n3 - DECAY * C[3], 0.0f);
      }
      float *o = dst + (yc + x) * 4;
      o[0] = n0; o[1] = n1; o[2] = n2; o[3] = n3;
    }
  }
}

static void step(const float *src, float *dst, int w, int h, int threads) {
  if (threads <= 1) { step_rows(src, dst, w, h, 0, h); return; }
  dispatch_apply((size_t)threads, dispatch_get_global_queue(QOS_CLASS_USER_INTERACTIVE, 0), ^(size_t t) {
    step_rows(src, dst, w, h, (int)((long)h * (long)t / threads), (int)((long)h * (long)(t + 1) / threads));
  });
}

static double now_s(void) { struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts); return ts.tv_sec + ts.tv_nsec * 1e-9; }
static int cmpd(const void *a, const void *b) { double x = *(const double *)a, y = *(const double *)b; return (x > y) - (x < y); }

int main(int argc, char **argv) {
  if (argc < 7) { fprintf(stderr, "usage: %s W H threads reps steps init.bin [out.bin outSteps]\n", argv[0]); return 2; }
  const int w = atoi(argv[1]), h = atoi(argv[2]), threads = atoi(argv[3]), reps = atoi(argv[4]), steps = atoi(argv[5]);
  const size_t n = (size_t)w * h * 4;
  float *init = malloc(n * sizeof(float)), *a = malloc(n * sizeof(float)), *b = malloc(n * sizeof(float));
  FILE *f = fopen(argv[6], "rb");
  if (!f || fread(init, sizeof(float), n, f) != n) { fprintf(stderr, "cannot read %s\n", argv[6]); return 1; }
  fclose(f);
  memcpy(a, init, n * sizeof(float)); memset(b, 0, n * sizeof(float));
  for (int s = 0; s < 2; s++) { step(a, b, w, h, threads); float *t = a; a = b; b = t; }
  double rates[64];
  for (int r = 0; r < reps && r < 64; r++) {
    const double t0 = now_s();
    for (int s = 0; s < steps; s++) { step(a, b, w, h, threads); float *t = a; a = b; b = t; }
    rates[r] = (double)w * h * steps / (now_s() - t0);
  }
  qsort(rates, reps, sizeof(double), cmpd);
  double sum = 0; for (size_t i = 0; i < n; i += 97) sum += a[i];
  printf("{\"w\":%d,\"h\":%d,\"threads\":%d,\"reps\":%d,\"steps\":%d,\"best\":%.6g,\"median\":%.6g,\"worst\":%.6g,\"checksum\":%.9g}\n",
         w, h, threads, reps, steps, rates[reps - 1], rates[reps / 2], rates[0], sum);
  if (argc >= 9) {
    const int outSteps = atoi(argv[8]);
    memcpy(a, init, n * sizeof(float));
    for (int s = 0; s < outSteps; s++) { step(a, b, w, h, threads); float *t = a; a = b; b = t; }
    FILE *o = fopen(argv[7], "wb"); fwrite(a, sizeof(float), n, o); fclose(o);
  }
  return 0;
}
