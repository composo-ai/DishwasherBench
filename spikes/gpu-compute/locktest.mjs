import { getDevice, benchLockStatus, sleep } from './lib.mjs';
const t0 = Date.now();
const { device } = await getDevice();
console.log(process.argv[2], 'got device after', Date.now() - t0, 'ms', JSON.stringify(benchLockStatus()));
await sleep(3000);
console.log(process.argv[2], 'done');
process.exit(0);
