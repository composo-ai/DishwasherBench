/**
 * @spotless/web. The human 3D client (Vite + Three.js): `index.html` and `src/main.ts` are the
 * page; this module exports the client's pure logic, which is what its unit tests cover.
 * Every gesture reduces to the session's actions and queries on the server
 * (docs/design/platform.md section 7).
 *
 *  - `pose.ts`: the pose of the item in hand, quantised and composed as the session does.
 *  - `aim.ts`: pointing: the basket under the cursor and the place in it where the piece,
 *    standing where it would be let go, is under the cursor.
 *  - `stance.ts`: which way up a piece is held and which way it faces: its stances in the
 *    order a person reaches for them, the turn steps, and the rows of tines a piece on edge
 *    takes up.
 *  - `format.ts`: feedback, mechanical check and budgets as text.
 *  - `report.ts`: the progress of the wash by its real stages, and the report: every item with
 *    its result, reason, residue by region on the scale the items are painted with, and water.
 *  - `animation.ts`: playback of the poses the server's physics streams.
 *  - `benchmark.ts`: the episode link and the player's name, and the marks of the labelled
 *    and gridded views (the ones an agent's `render` query draws).
 */

export * from './pose.ts';
export * from './aim.ts';
export * from './stance.ts';
export * from './format.ts';
export * from './report.ts';
export * from './animation.ts';
export * from './benchmark.ts';
