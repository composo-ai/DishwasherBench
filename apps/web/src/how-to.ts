/**
 * The how-to-play panel: the game in a few lines, then the mouse and the keys. Nothing here
 * names a programme: the level card says which one the level is scored on.
 */

import type { LevelCard } from '@spotless/session';
import { h } from './dom.ts';

/**
 * What the game is and what it is not, in one line. The page shows it at the foot of the list
 * of levels and at the foot of this panel, where it stays in view while the panel is scrolled.
 */
export const DISCLAIMER =
  'A simulation of one machine, with many estimated parameters. Not affiliated with or endorsed by the makers of the products named; a verdict here says nothing about a real product.';

/** The mouse and the keys, in the order they are used. */
export const KEYS: readonly (readonly [string, string])[] = [
  [
    'Click a piece in the list, or drag it in',
    'Pick it up. It is shown in the machine where it would be let go, under the cursor, in whichever basket you point at.',
  ],
  [
    'R, or click a picture',
    'Which way up: on edge, upside down, handle down… (Shift+R steps back).',
  ],
  [
    'Q / E, or the wheel',
    'Turn it a quarter to the left / right. Hold Shift for 15°. Over a row of tines a turn makes it face the other way.',
  ],
  [
    'Click',
    'Put it down. It settles by itself, as it would in the machine. A piece shown on the rim or outside the basket (amber) is not put down.',
  ],
  ['Z', 'Take the piece you put down last back into your hand, as you held it (one action).'],
  ['Alt', 'Hold to place freely: a piece on edge then no longer takes up the rows of tines.'],
  ['Click a piece in the machine', 'Pick it up as it stands. Shift+click only selects it.'],
  [
    'Esc',
    'Put the piece in hand back where it was: in the machine if you picked it up there (one more action; it is let go there again and may settle a little differently), else on the counter.',
  ],
  [
    'Backspace, or a click on the counter',
    'Send the piece in hand back to the counter (Backspace also takes out the selected piece).',
  ],
  [
    'Right-drag along an arrow',
    'Push the piece in sideways to where it is shown, with limited force.',
  ],
  ['Space', 'Run the mechanical check (one query).'],
  [
    'Drag / wheel / right-drag',
    'Orbit, zoom and pan the camera. Ctrl + wheel zooms with a piece in hand.',
  ],
];

/** Paragraphs of a text whose paragraphs are separated by blank lines. */
function paragraphs(text: string): HTMLElement[] {
  return text
    .split(/\n\s*\n/)
    .filter((part) => part.trim() !== '')
    .map((part) => h('p', null, part.trim()));
}

/**
 * The content of the how-to panel. `card` adds the rules of the level in play and its manual;
 * `guidance` the generic loading guidance. The manual and the guidance are word for word what
 * an agent is given (the resources of the MCP server).
 */
export function howToPlay(
  card: LevelCard | null,
  guidance: { readonly title: string; readonly text: string } | null = null,
): HTMLElement {
  return h(
    'div',
    { class: 'how-to' },
    h(
      'p',
      null,
      'You are shown a set of dirty items, each worth points, and a dishwasher. Put in what you can, the way you think it will come out clean, then start the cycle. The wash is simulated, and every item that comes out clean scores its points. It is never possible to fit everything.',
    ),
    h(
      'ol',
      null,
      h(
        'li',
        null,
        'Pick a piece from the list on the left: click it, or drag it into the machine. Look at where it is dirty.',
      ),
      h(
        'li',
        null,
        'Point at where it should go. It is drawn where it would be let go: green when it would be let go on the floor of the basket, yellow when it would be let go on top of something (tine tips, another piece, the cutlery basket) and may tip or slide, red when it overlaps something, amber when it cannot be reached or would be let go on the rim or outside the basket and fall out. Green and yellow say where it is let go, not where it ends: that is physics. A basket can only be loaded while it is pulled out; the upper basket hangs over the lower one, so push one in to reach the other (Baskets, on the right).',
      ),
      h(
        'li',
        null,
        'Choose which way up it is (R, or the pictures) and which way it faces (Q and E, or the wheel). A plate, a lid or a board on edge takes up the nearest row of tines by itself: it stands across the row over a gap, comes down between the tines when you let go, and leans on them.',
      ),
      h(
        'li',
        null,
        'Click to put it down (a click made while the page is still asking the game waits for the answer). It settles as it would in the real machine: plates lean in the tines, things roll, fall over or slip through. What falls on the kitchen floor goes back to the counter; what ends up on the door is left out of the wash unless you pick it up and load it.',
      ),
      h(
        'li',
        null,
        'To move a piece, click it in the machine: it comes into your hand as it stands. Click again to put it down, or press Esc to put it back where it was. What leaned on it may fall. Z takes back the piece you put down last. The three elevations (Front, Left side, Right side) are for looking: there the piece keeps its depth and only moves across the picture, so place from a three-quarter or a plan view.',
      ),
      h(
        'li',
        null,
        'Run the mechanical check to find out whether the baskets slide in, the spray arms turn, the door closes and the detergent can get out. It says nothing about how well anything will wash.',
      ),
      h(
        'li',
        null,
        'Start the wash. Where the game offers it, choose the quick preview (about a minute, coarser, a few verdicts may differ) or the full wash (several minutes, the scored result); after a preview the report offers the full wash on the same load. The load is frozen once the wash has started.',
      ),
      h(
        'li',
        null,
        'The report lists every item with its result and, where it is not clean, why. What is left on an item is painted on it in magenta where it is: look round the machine, or choose "Look closely" to turn one item about.',
      ),
    ),
    h(
      'table',
      { class: 'keys' },
      h(
        'tbody',
        null,
        KEYS.map(([key, what]) => h('tr', null, h('th', null, key), h('td', null, what))),
      ),
    ),
    h(
      'p',
      null,
      '"Suggest spots" in the In hand panel asks the game where the piece in hand can stand in the basket (one query): the places are marked in the machine, numbered best first, and a click on a mark puts the piece there.',
    ),
    h(
      'p',
      null,
      'Actions are limited, and so are queries; both are counted at the top of the page. Picking a piece up in the machine and putting one down are one action each; a refused action costs nothing. Pointing is free.',
    ),
    h(
      'p',
      null,
      'For an exact pose, unfold "Exact pose" in the In hand panel: the position of the piece in the frame of its basket (x to the right, y to the back, z up, from the front-left corner on top of the base grid; millimetres and whole degrees) and its orientation as preset and angles or as a quaternion (w, x, y, z). A typed pose stays put until you tick "follows the cursor" again. The Selected panel shows the pose of a piece in the machine in the same numbers.',
    ),
    h(
      'p',
      null,
      '"Sound", at the top right, turns the music and the sounds of the machine on and off and sets the volume. It says what is playing and what comes next, lists the last changes from piece to piece, and "Go to next change" takes the piece to its ending so that the change can be heard at once. The music tells you nothing about the game.',
    ),
    card === null
      ? null
      : h(
          'div',
          { class: 'rules' },
          h('h3', null, `This level: ${card.title}`),
          h('p', null, card.summary),
          h('p', null, card.rules.scoring),
          h('p', null, card.rules.clean_definition),
          h('p', null, card.rules.episode_end),
          h(
            'p',
            null,
            `Budgets: ${card.rules.budgets.actions_max} accepted actions, ${card.rules.budgets.queries_max} charged queries, ${card.rules.budgets.washes_max} wash${card.rules.budgets.washes_max === 1 ? '' : 'es'}.`,
          ),
        ),
    card === null || card.manual === null
      ? null
      : h(
          'div',
          { class: 'rules', id: 'level-manual' },
          h('h3', null, 'The manual of the interface'),
          h(
            'p',
            { class: 'muted' },
            'This is the text a player who plays through the programming interface is given. The names in it (place, set_rack, list_slots, preview, check_load, start_cycle) are the calls behind the buttons of this page.',
          ),
          paragraphs(card.manual),
        ),
    guidance === null
      ? null
      : h(
          'div',
          { class: 'rules', id: 'loading-guidance' },
          h('h3', null, guidance.title),
          h('p', { class: 'muted' }, 'Every player is shown this text, word for word.'),
          paragraphs(guidance.text),
        ),
  );
}
