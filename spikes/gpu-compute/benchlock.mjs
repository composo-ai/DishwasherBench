// Cross-process benchmark mutex for this spike directory.
//
// WHY: on 2026-10-08 two benchmark runs were found going from this same directory at the same time. Two GPU
// benchmarks that overlap each get roughly half the throughput (measured: 4.1 -> 2.0 G cell-updates/s), so any
// number taken during an overlap is wrong. This module makes benchmark processes take turns.
//
// HOW: lib.mjs getDevice() calls acquireBenchLock() before touching the GPU. The lock is a directory created with
// mkdir (atomic) at <spike root>/.benchlock containing owner.json {pid, cmd, since}. It is released when the process
// exits. A lock whose owner pid is no longer alive is treated as stale and taken over.
// While you wait you will see "[benchlock] waiting ..." lines on stderr every 20 s: that is another benchmark
// finishing, not a hang. Set BENCH_NOLOCK=1 to opt out (your timings may then be contaminated).
import { mkdirSync, writeFileSync, readFileSync, rmSync, statSync, realpathSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SPIKE_ROOT = realpathSync(HERE);
const LOCK = join(SPIKE_ROOT, '.benchlock');
const AWARE = join(SPIKE_ROOT, '.benchlock-aware');
const CMD = process.argv.slice(1).map((a) => a.replace(SPIKE_ROOT + '/', '')).join(' ');

let held = false;
const status = { locked: false, waitedMs: 0, proceededUnlocked: false, foreignAtStart: [] };
export function benchLockStatus() { return { ...status }; }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}
function readOwner() {
  try { return JSON.parse(readFileSync(join(LOCK, 'owner.json'), 'utf8')); } catch { return null; }
}
function release() {
  if (!held) return;
  held = false;
  try { const o = readOwner(); if (o && o.pid === process.pid) rmSync(LOCK, { recursive: true, force: true }); } catch {}
  try { rmSync(join(AWARE, String(process.pid)), { force: true }); } catch {}
}

/**
 * Other node processes whose working directory is inside this spike directory and that are NOT lock-aware
 * (started before the lock existed, or opted out). Read-only: uses ps and lsof, never signals anything.
 */
export function foreignBenchProcs() {
  const res = [];
  let ps = '';
  try { ps = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }); } catch { return res; }
  for (const line of ps.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const pid = Number(m[1]), cmd = m[2];
    if (pid === process.pid || pid === process.ppid) continue;
    if (!/(^|\/)node(\s|$)/.test(cmd.split(' ')[0] + ' ')) continue;
    if (existsSync(join(AWARE, String(pid)))) continue;
    let cwd = '';
    try {
      const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' });
      cwd = (out.split('\n').find((l) => l.startsWith('n')) ?? '').slice(1);
    } catch { continue; }
    if (cwd === SPIKE_ROOT || cwd.startsWith(SPIKE_ROOT + '/')) res.push({ pid, cmd: cmd.slice(0, 120), cwd: cwd.replace(SPIKE_ROOT, '.') });
  }
  return res;
}

export async function acquireBenchLock({ maxWaitMs = 45 * 60e3 } = {}) {
  if (held || process.env.BENCH_NOLOCK === '1') return benchLockStatus();
  mkdirSync(AWARE, { recursive: true });
  // forget markers of dead processes, then register ourselves as lock-aware
  try { for (const f of readdirSync(AWARE)) if (!alive(Number(f))) rmSync(join(AWARE, f), { force: true }); } catch {}
  writeFileSync(join(AWARE, String(process.pid)), CMD);
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { release(); process.exit(128); });
  const t0 = Date.now();
  let lastLog = 0;
  for (;;) {
    try {
      mkdirSync(LOCK);
      writeFileSync(join(LOCK, 'owner.json'), JSON.stringify({ pid: process.pid, cmd: CMD, since: new Date().toISOString() }));
      await sleep(150); // settle: if two waiters raced on a stale lock, only the one whose pid survived in owner.json proceeds
      if (readOwner()?.pid === process.pid) break;
      continue;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const o = readOwner();
    let stale = false;
    if (o) stale = !alive(o.pid);
    else { try { stale = Date.now() - statSync(LOCK).mtimeMs > 5000; } catch { stale = false; } }
    if (stale) { try { rmSync(LOCK, { recursive: true, force: true }); } catch {} continue; }
    const waited = Date.now() - t0;
    if (waited - lastLog >= 20000 || lastLog === 0) {
      lastLog = waited || 1;
      console.error(`[benchlock] waiting ${(waited / 1000).toFixed(0)} s for pid ${o?.pid} (${o?.cmd}) holding it since ${o?.since}`);
    }
    if (waited > maxWaitMs) {
      console.error('[benchlock] gave up waiting; proceeding UNLOCKED, timings may be contaminated');
      status.proceededUnlocked = true; status.waitedMs = waited;
      return benchLockStatus();
    }
    await sleep(500);
  }
  held = true; status.locked = true;
  // Also wait for lock-unaware benchmark processes already running here (they cannot be serialised by the lock).
  lastLog = 0;
  for (;;) {
    const f = foreignBenchProcs();
    if (!f.length) break;
    const waited = Date.now() - t0;
    if (waited - lastLog >= 20000 || lastLog === 0) {
      lastLog = waited || 1;
      console.error(`[benchlock] holding lock, waiting for ${f.length} lock-unaware process(es): ` + f.map((p) => `${p.pid} ${p.cmd}`).join(' | '));
    }
    if (waited > maxWaitMs) { status.foreignAtStart = f; console.error('[benchlock] lock-unaware process still running; proceeding, timings may be contaminated'); break; }
    await sleep(1000);
  }
  status.waitedMs = Date.now() - t0;
  if (status.waitedMs > 2000) console.error(`[benchlock] acquired after ${(status.waitedMs / 1000).toFixed(0)} s`);
  return benchLockStatus();
}
