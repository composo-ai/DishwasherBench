/** Entry point of the page. */

import { App } from './app.ts';
import { startAudio } from './audio/index.ts';

const root = document.getElementById('app');
if (root === null) throw new Error('the page has no #app element');
const app = new App(root);
// For the screenshot script: lets it wait until the page has caught up with the server.
(window as unknown as { spotless: App }).spotless = app;
void app.start();
startAudio();
