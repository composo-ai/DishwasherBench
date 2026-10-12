// The episode link and the marks of the labelled views.
import { describe, expect, it } from 'vitest';
import { cleanPlayerName, gridFrames, itemCentres, parseEpisodeLink } from './benchmark.ts';

describe('parseEpisodeLink', () => {
  it('reads the episode and, when it is there, the player', () => {
    const id = '4d0c6a0e-7f1b-4c0c-9a51-2f6d2b7f9c11';
    expect(parseEpisodeLink(`#${id}`)).toEqual({ sessionId: id, player: null });
    expect(parseEpisodeLink(`#${id}&player=P07`)).toEqual({ sessionId: id, player: 'P07' });
    expect(parseEpisodeLink(`#${id}&player=Ada%20L.&x=1`)).toEqual({
      sessionId: id,
      player: 'Ada L.',
    });
    expect(parseEpisodeLink(`#${id}&player=Ada+L.`)).toEqual({ sessionId: id, player: 'Ada L.' });
    expect(parseEpisodeLink(`#${id}&player=`)).toEqual({ sessionId: id, player: null });
    expect(parseEpisodeLink(`#${id}&player=%E0%A4%A`)).toEqual({ sessionId: id, player: null });
    expect(parseEpisodeLink('')).toEqual({ sessionId: null, player: null });
    expect(parseEpisodeLink('#')).toEqual({ sessionId: null, player: null });
  });
});

describe('cleanPlayerName', () => {
  it('gives the name the server will take, or none', () => {
    expect(cleanPlayerName('  P07 ')).toBe('P07');
    expect(cleanPlayerName('a\tb\nc')).toBe('a b c');
    expect(cleanPlayerName('   ')).toBeNull();
    expect(cleanPlayerName('x'.repeat(100))).toHaveLength(64);
  });
});

describe('the marks of the page', () => {
  const card = {
    machine: {
      tub_min_mm: [-272, -235, 0],
      tub_max_mm: [273, 265, 640],
      racks: [
        {
          rack: 'lower_rack',
          origin_in_mm: [-262.5, -262, 73],
          origin_out_mm: [-262.5, -762, 73],
          envelope_mm: [525, 512, 292],
          options: [],
        },
        {
          rack: 'upper_rack',
          origin_in_mm: [-244, -258, 420],
          origin_out_mm: [-244, -698, 420],
          envelope_mm: [500, 498, 190],
          options: [],
        },
      ],
    },
  } as never;

  it('takes each basket where it stands now', () => {
    const frames = gridFrames(card, {
      lower_rack: { position_mm: [-262.5, -762, 73], quat_wxyz: [1, 0, 0, 0] },
    });
    expect(frames).toEqual([
      { frame: 'lower_rack', origin_mm: [-262.5, -762, 73], size_mm: [525, 512, 292] },
      // No pose yet: where it is when pushed in.
      { frame: 'upper_rack', origin_mm: [-244, -258, 420], size_mm: [500, 498, 190] },
    ]);
  });

  it('puts the label of an item at the centre of its bounding box, wherever the item points', () => {
    const geometry = {
      items: [{ item_id: 'mug_01', item_type: 'mug' }],
      item_types: { mug: { bbox: { min: [-0.04, -0.04, 0], max: [0.07, 0.04, 0.1] } } },
    } as never;
    const scene = (quat: [number, number, number, number]) =>
      ({
        state: { placed: [{ item_id: 'mug_01' }, { item_id: 'ghost_01' }] },
        poses: { parts: {}, items: { mug_01: { position_mm: [100, -300, 400], quat_wxyz: quat } } },
      }) as never;
    // Upright: the centre of the box is 15 mm along x and 50 mm up from the item's origin.
    const upright = itemCentres(scene([1, 0, 0, 0]), geometry);
    expect(upright).toHaveLength(1);
    expect(upright[0]?.centre_mm.map((v) => Math.round(v * 1000) / 1000)).toEqual([115, -300, 450]);
    // Upside down (half a turn about x): the centre is below the origin.
    const inverted = itemCentres(scene([0, 1, 0, 0]), geometry);
    expect(inverted[0]?.centre_mm.map((v) => Math.round(v * 1000) / 1000)).toEqual([
      115, -300, 350,
    ]);
  });
});
