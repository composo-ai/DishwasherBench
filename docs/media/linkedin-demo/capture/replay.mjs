// Replays a saved load (packages/loader/loads/<name>.json) into a new session; prints its id.
//   node replay.mjs dinner-party-careful
import { replay } from './lib.mjs';

const { sid, actions } = await replay(process.argv[2]);
console.error(`replayed ${process.argv[2]}: ${actions.length} actions`);
console.log(sid);
