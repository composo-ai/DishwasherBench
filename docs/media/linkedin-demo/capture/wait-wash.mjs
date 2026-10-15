// Waits until the wash of every session named has finished, printing each one's points; exits 1
// if a wash failed or has not finished within three hours.
//   node wait-wash.mjs <session id> [<session id> ...]
import { SERVER, sleep } from './lib.mjs';

for (const sid of process.argv.slice(2)) {
  const until = Date.now() + 3 * 3600 * 1000;
  for (;;) {
    const s = await (await fetch(`${SERVER}/api/sessions/${sid}`)).json();
    if (s.phase === 'finished') break;
    if (Date.now() > until) { console.error(sid, 'wash not finished after three hours'); process.exit(1); }
    await sleep(15000);
  }
  const r = await (await fetch(`${SERVER}/api/sessions/${sid}/get_report`)).json();
  if (r.status === 'failed') { console.error(sid, 'wash failed:', r.error ?? ''); process.exit(1); }
  const report = r.report ?? r;
  console.log(sid, `${report.score.points} of ${report.score.points_available} points`, report.verdicts.preview ? '(quick preview)' : '');
}
