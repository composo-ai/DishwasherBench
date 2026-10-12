/**
 * Tests of the hygiene check (pnpm hygiene:test).
 *
 * Every bad example is built here, in memory or in a temporary directory, from pieces: this
 * file must itself pass the check, and no scanner should find a key or a location in it.
 */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import {
  checkFile,
  compiledKind,
  FAIL_BYTES,
  fixCommands,
  iccDescription,
  id3Frames,
  isMpegAudio,
  isPlaceholderUser,
  jpegProblems,
  looksLikeKey,
  pngProblems,
  svgProblems,
  uninspectedFormat,
  WARN_BYTES,
} from './check-hygiene.mjs';

const SCRIPT = fileURLToPath(new URL('./check-hygiene.mjs', import.meta.url));

const found = (level) => (path, content, options) =>
  checkFile(path, Buffer.isBuffer(content) ? content : Buffer.from(content), undefined, options)
    .filter((f) => f.level === level)
    .map((f) => f.reason);
const fails = found('fail');
const warns = found('warn');

// A path is put together from its parts, so that it is not written out here.
const path = (...parts) => `/${parts.join('/')}/`;
const SOMEONE = 'jane.doe';
const bytes = (...values) => Buffer.from(values);
const latin = (text) => Buffer.from(text, 'latin1');

// ---------------------------------------------------------------- personal paths

test('a home directory with a name fails, in each of its forms', () => {
  for (const text of [
    `cd ${path('Users', SOMEONE, 'work')}`,
    `"cwd": "${path('home', SOMEONE)}project"`,
    `file://${path('Users', SOMEONE)}a.png`,
    `C:\\${['Users', SOMEONE, 'work'].join('\\')}`,
    `"C:\\\\${['Users', SOMEONE, 'work'].join('\\\\')}"`,
    `/${['Users', SOMEONE].join('/')}`,
  ]) {
    const reasons = fails('notes.md', text);
    assert.equal(reasons.length, 1, text);
    assert.match(reasons[0], /home directory/);
    assert.match(reasons[0], /jane\.doe/);
  }
});

test('a home directory fails in the spellings it takes on its way into a file', () => {
  const mac = path('Users', SOMEONE, 'work');
  const linux = path('home', SOMEONE, 'work');
  const cases = {
    // What a record of a run or a transcript holds: the path after an escaped line break.
    'after an escaped line break': JSON.stringify({ stderr: `Error\n${linux}a.ts:3` }),
    'after an escaped tab': JSON.stringify({ out: `at\t${linux}` }),
    'after an escaped line break (macOS)': JSON.stringify({ stderr: `Error\n${mac}a.ts:3` }),
    'after a colour code of a terminal': `\x1b[31m${linux}a.ts\x1b[0m`,
    'after a compiler flag': `cc -I${linux}include -L${linux}lib`,
    'after a compiler flag (macOS)': `cc -I${mac}include`,
    'under another volume': `/System/Volumes/Data${mac}`,
    'on a drive of Windows as Linux mounts it': `/mnt/c${mac}`,
    'on a drive of Windows as a shell writes it': `/c${mac}`,
    'in an address with a host': `file://localhost${mac}a.png`,
    'with slashes escaped as JSON may': mac.replaceAll('/', '\\/'),
    'with slashes escaped (Linux)': ` ${linux.replaceAll('/', '\\/')}`,
    'URL-encoded': `?dir=${encodeURIComponent(mac)}`,
    'URL-encoded (Linux, lower case)': `?dir=${encodeURIComponent(linux).toLowerCase()}`,
    'on Windows in lower case': ['c:', 'users', SOMEONE, 'work'].join('\\'),
    'on a share of another machine': `\\\\${['fileserver', 'Users', SOMEONE].join('\\')}`,
    'on a share, escaped': JSON.stringify(`\\\\${['fileserver', 'Users', SOMEONE].join('\\')}`),
  };
  for (const [label, text] of Object.entries(cases)) {
    const reasons = fails('record.json', text);
    assert.equal(reasons.length, 1, `${label}: ${JSON.stringify(reasons)}`);
    assert.match(reasons[0], /home directory/, label);
    assert.match(reasons[0], /jane\.doe/, label);
  }
});

test('the name of a directory made from a home directory fails', () => {
  const slug = (...parts) => ['', ...parts, ''].join('-');
  for (const text of [
    `projects/${slug('Users', 'jane', 'Documents', 'work')}`,
    `"dir": "${slug('Users', 'jane', 'work')}"`,
    `projects/${slug('home', 'jane', 'src')}`,
    `${slug('home', 'jane', 'src')}notes`,
  ]) {
    const reasons = fails('notes.md', text);
    assert.equal(reasons.length, 1, text);
    assert.match(reasons[0], /home directory in the name of a directory/, text);
  }
  for (const text of [
    `projects/${slug('Users', 'you', 'work')}`,
    `projects/${slug('home', 'runner', 'work')}`,
    // Ordinary words with hyphens are not a path.
    `a stay-at${slug('home', 'parent')}`,
    `nav-${slug('home', 'page')}`,
  ]) {
    assert.deepEqual(fails('notes.md', text), [], text);
  }
});

test('a home directory in the path of a file fails, whatever the file holds', () => {
  const slug = (...parts) => ['', ...parts, ''].join('-');
  for (const file of [
    `logs/${slug('Users', 'jane', 'Documents', 'work')}/run.txt`,
    `${slug('Users', 'jane', 'work')}/run.txt`,
    `logs/${slug('home', 'jane', 'src')}/run.txt`,
    `backup${path('Users', SOMEONE)}notes.md`,
  ]) {
    const reasons = fails(file, 'nothing in here');
    assert.equal(reasons.length, 1, file);
    assert.match(reasons[0], /^the path of the file: a home directory/, file);
  }
  for (const file of [
    `logs/${slug('Users', 'you', 'work')}/run.txt`,
    'docs/users/home/notes.md',
    'apps/web/src/stay-at-home-parent.md',
  ]) {
    assert.deepEqual(fails(file, 'nothing in here'), [], file);
  }
});

test('the temporary directories of macOS fail', () => {
  assert.match(
    fails('a.json', `{"out":"${path('private', 'tmp', 'x')}"}`)[0],
    /temporary directory/,
  );
  assert.match(
    fails('a.json', `{"out":"${path('var', 'folders', 'zz')}T"}`)[0],
    /temporary directory/,
  );
});

test('placeholders and paths that are not roots pass', () => {
  for (const text of [
    path('Users', 'you', 'project'),
    path('home', 'runner', 'work'),
    path('Users', '<name>', 'project'),
    path('home', '$USER'),
    `C:\\${['Users', '%USERNAME%', 'x'].join('\\')}`,
    path('absolute', 'path', 'to'),
    `https://example.org${path('home', 'page')}`,
    `docs${path('home', 'page')}`,
    'the folder /Users/ holds the homes',
    // Accounts and folders every machine has.
    path('Users', 'Shared', 'data'),
    `C:\\${['Users', 'Public', 'Documents'].join('\\')}`,
    `C:\\${['Users', 'Default'].join('\\')}`,
    path('home', 'linuxbrew', '.linuxbrew'),
    path('home', 'ubuntu', 'work'),
    path('home', 'node', 'app'),
    // A sentence may end on the name.
    `Clone it to /${['Users', 'you'].join('/')}.`,
    `(for example /${['home', 'you'].join('/')}),`,
    // An escaped line break before a word that only begins like a path.
    JSON.stringify({ text: 'see\nhome/page' }),
  ]) {
    assert.deepEqual(fails('notes.md', text), [], text);
  }
  assert.equal(isPlaceholderUser('You'), true);
  assert.equal(isPlaceholderUser('you.'), true);
  assert.equal(isPlaceholderUser(SOMEONE), false);
  assert.equal(isPlaceholderUser(`${SOMEONE}.`), false);
});

test('the line of a path in a text file is given, and a repeat is counted once', () => {
  const p = path('Users', SOMEONE);
  const reasons = fails('log.txt', `first\nsecond ${p}a\nthird ${p}b\n`);
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /^line 2: /);
  assert.match(reasons[0], /\(2 times\)/);
});

test('a path inside a binary file is found, as bytes and as 16-bit text', () => {
  const p = path('Users', SOMEONE, 'Pictures');
  const plain = Buffer.concat([bytes(0, 1, 2, 0), Buffer.from(p), bytes(0, 9)]);
  assert.ok(fails('blob.bin', plain).some((reason) => /home directory/.test(reason)));
  const wide = Buffer.concat([bytes(0, 1, 2, 0), Buffer.from(p, 'utf16le')]);
  assert.ok(fails('blob.bin', wide).some((reason) => /home directory/.test(reason)));
});

// ---------------------------------------------------------------- colour profiles

const u32 = (value) => {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value);
  return out;
};

/** A colour profile with nothing in it but its description, in either of the two forms. */
function profile(description, form = 'mluc') {
  const header = Buffer.alloc(128);
  header.write('acsp', 36, 'latin1');
  let data;
  if (form === 'desc') {
    const text = latin(`${description}\0`);
    data = Buffer.concat([latin('desc\0\0\0\0'), u32(text.length), text]);
  } else {
    const text = Buffer.from(description, 'utf16le').swap16();
    data = Buffer.concat([
      latin('mluc\0\0\0\0'),
      u32(1),
      u32(12),
      latin('enUS'),
      u32(text.length),
      u32(28),
      text,
    ]);
  }
  const table = Buffer.concat([u32(1), latin('desc'), u32(128 + 16), u32(data.length)]);
  return Buffer.concat([header, table, data]);
}
const P3 = 'Display P3';
const OWN = 'Calibrated by a person';

test('the description of a colour profile is read in both of its forms', () => {
  assert.equal(iccDescription(profile(P3)), P3);
  assert.equal(iccDescription(profile('sRGB IEC61966-2.1', 'desc')), 'sRGB IEC61966-2.1');
  assert.equal(iccDescription(Buffer.from('not a profile')), null);
  assert.equal(iccDescription(profile(P3).subarray(0, 150)), null);
});

// ---------------------------------------------------------------- JPEG

const segment = (marker, body) => {
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xff00 | marker, 0);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
};
const SOI = bytes(0xff, 0xd8);
const EOI = bytes(0xff, 0xd9);
const JFIF = segment(0xe0, latin('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'));
const ADOBE = segment(0xee, latin('Adobe\0\x64\0\0\0\0\x01'));
// A scan whose data holds a stuffed zero and a restart marker, as real ones do.
const SCAN = Buffer.concat([
  segment(0xda, bytes(1, 1, 0, 0, 63, 0)),
  bytes(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56),
]);
const jpeg = (...segments) => Buffer.concat([SOI, ...segments, SCAN, EOI]);

/** The pieces of a colour profile as a JPEG carries them: numbered application segments. */
const iccSegments = (whole, pieces = 1) => {
  const size = Math.ceil(whole.length / pieces);
  return Array.from({ length: pieces }, (_, i) =>
    segment(
      0xe2,
      Buffer.concat([
        latin('ICC_PROFILE\0'),
        bytes(i + 1, pieces),
        whole.subarray(i * size, (i + 1) * size),
      ]),
    ),
  );
};

const SHORT = 3;
const RATIONAL = 5;
const ORIENTATION = 0x0112;
const YCBCR = 0x0213;
const UNIT = 0x0128;
const XRES = 0x011a;
const YRES = 0x011b;

/**
 * An Exif segment. A tag is a number (one short value of 1) or `{ tag, type, count, value }`;
 * a tag of the type RATIONAL gets its eight bytes after the directory. `second` adds a second
 * directory, `tail` bytes after everything, `gap` bytes before the directory.
 */
function exif(tags, { second = false, littleEndian = false, tail = 0, gap = 0 } = {}) {
  const entries = tags.map((tag) =>
    typeof tag === 'number'
      ? { tag, type: SHORT, count: 1, value: 1 }
      : { type: SHORT, count: 1, value: 1, ...tag },
  );
  const rationals = entries.filter((entry) => entry.type === RATIONAL && entry.at === undefined);
  const start = 8 + gap;
  const end = start + 2 + 12 * entries.length + 4;
  const tiff = Buffer.alloc(end + 8 * rationals.length + tail);
  const w16 = (v, o) => (littleEndian ? tiff.writeUInt16LE(v, o) : tiff.writeUInt16BE(v, o));
  const w32 = (v, o) => (littleEndian ? tiff.writeUInt32LE(v, o) : tiff.writeUInt32BE(v, o));
  tiff.write(littleEndian ? 'II' : 'MM', 0, 'latin1');
  w16(42, 2);
  w32(start, 4);
  w16(entries.length, start);
  entries.forEach((entry, i) => {
    const o = start + 2 + 12 * i;
    w16(entry.tag, o);
    w16(entry.type, o + 2);
    w32(entry.count, o + 4);
    if (entry.type === RATIONAL && entry.at !== undefined) {
      // A value that is said to stand somewhere it does not belong.
      w32(entry.at, o + 8);
    } else if (entry.type === RATIONAL) {
      const at = end + 8 * rationals.indexOf(entry);
      w32(at, o + 8);
      w32(72, at);
      w32(1, at + 4);
    } else if (entry.spare === true) {
      w32(0x00010203, o + 8);
    } else {
      w16(entry.value, o + 8);
    }
  });
  w32(second ? 8 : 0, end - 4);
  return segment(0xe1, Buffer.concat([latin('Exif\0\0'), tiff]));
}

test('a JPEG with what is allowed passes', () => {
  const resolution = [{ tag: XRES, type: RATIONAL }, { tag: YRES, type: RATIONAL }, UNIT];
  for (const picture of [
    jpeg(),
    jpeg(JFIF),
    jpeg(JFIF, exif([ORIENTATION, YCBCR]), ...iccSegments(profile(P3)), ADOBE),
    jpeg(exif([ORIENTATION], { littleEndian: true }), ...iccSegments(profile(P3), 3)),
    jpeg(exif([ORIENTATION, YCBCR, ...resolution])),
    jpeg(exif([...resolution, ORIENTATION], { littleEndian: true })),
    jpeg(...iccSegments(profile('sRGB IEC61966-2.1', 'desc'))),
  ]) {
    assert.deepEqual(jpegProblems(picture), []);
    assert.deepEqual(fails('photo.jpg', picture), []);
  }
});

test('a JPEG with a location, camera details or a thumbnail in its Exif fails', () => {
  assert.match(jpegProblems(jpeg(exif([ORIENTATION, 0x8825])))[0], /GPS directory \(location\)/);
  assert.match(jpegProblems(jpeg(exif([0x8769])))[0], /Exif sub-directory/);
  assert.match(jpegProblems(jpeg(exif([0x010f, 0x0110, 0x0132])))[0], /Make, Model, DateTime/);
  assert.match(jpegProblems(jpeg(exif([0x9999])))[0], /tag 0x9999/);
  assert.match(jpegProblems(jpeg(exif([ORIENTATION], { second: true })))[0], /thumbnail/);
  assert.match(jpegProblems(jpeg(exif([ORIENTATION], { tail: 20 })))[0], /20 bytes that no tag/);
  assert.match(fails('IMG_0001.JPG', jpeg(exif([0x8825])))[0], /^JPEG metadata: /);
});

test('an allowed Exif tag gives no room for anything else', () => {
  const problem = (tags, options) => jpegProblems(jpeg(exif(tags, options)))[0];
  assert.match(problem([ORIENTATION, ORIENTATION]), /Orientation more than once/);
  // A tag typed as text, or with a count, can hold what it likes.
  assert.match(problem([{ tag: ORIENTATION, type: 2 }]), /Orientation in another form/);
  assert.match(problem([{ tag: ORIENTATION, count: 2 }]), /Orientation in another form/);
  assert.match(problem([{ tag: XRES, type: SHORT }]), /XResolution in another form/);
  assert.match(problem([{ tag: ORIENTATION, spare: true }]), /two bytes beside the value/);
  // The value of a resolution stands right after the directory, and nowhere else.
  assert.match(problem([{ tag: XRES, type: RATIONAL, at: 4 }]), /XResolution .* out of place/);
  assert.match(problem([{ tag: XRES, type: RATIONAL }], { tail: 8 }), /8 bytes that no tag/);
  assert.match(problem([ORIENTATION], { gap: 6 }), /6 bytes that no tag/);
});

test('a JPEG with other segments, a comment or bytes after its end fails', () => {
  const xmp = segment(0xe1, latin('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>'));
  assert.match(jpegProblems(jpeg(JFIF, xmp))[0], /XMP/);
  const iptc = segment(0xed, latin('Photoshop 3.0\x008BIM'));
  assert.match(jpegProblems(jpeg(JFIF, iptc))[0], /IPTC/);
  const mpf = segment(0xe2, latin('MPF\0MM\0*'));
  assert.match(jpegProblems(jpeg(JFIF, mpf))[0], /multi-picture/);
  const maker = segment(0xe4, latin('Vendor\0data'));
  assert.match(jpegProblems(jpeg(JFIF, maker))[0], /APP4 "Vendor"/);
  const thumb = segment(0xe0, latin('JFIF\0\x01\x01\0\0\x01\0\x01\x02\x02'));
  assert.match(jpegProblems(jpeg(thumb))[0], /thumbnail/);
  const comment = segment(0xfe, Buffer.from('made at home'));
  assert.match(jpegProblems(jpeg(JFIF, comment))[0], /comment/);
  const trailing = Buffer.concat([jpeg(JFIF), Buffer.from('more')]);
  assert.match(jpegProblems(trailing)[0], /4 bytes after the end/);
  const cut = jpeg(JFIF).subarray(0, -2);
  assert.match(jpegProblems(cut)[0], /no end-of-image marker/);
});

test('the allowed segments of a JPEG give no room for anything else', () => {
  const stuffedJfif = segment(0xe0, latin('JFIF\0\x01\x01\0\0\x01\0\x01\0\0hidden'));
  assert.match(jpegProblems(jpeg(stuffedJfif))[0], /JFIF header with 6 bytes/);
  const stuffedAdobe = segment(0xee, latin('Adobe\0\x64\0\0\0\0\x01and more'));
  assert.match(jpegProblems(jpeg(stuffedAdobe))[0], /Adobe segment with 8 bytes/);
  for (const marker of [0xf0, 0xf7, 0xfd]) {
    const reserved = segment(marker, Buffer.from('anything'));
    assert.match(jpegProblems(jpeg(JFIF, reserved))[0], /reserved segment/, String(marker));
  }
});

test('a colour profile of a JPEG passes only under a standard name', () => {
  const own = jpegProblems(jpeg(JFIF, ...iccSegments(profile(OWN))));
  assert.equal(own.length, 1);
  assert.match(own[0], /colour profile named "Calibrated by a person"/);
  // Anything may follow the words that open the segment: it has to be a profile.
  const fake = segment(0xe2, latin('ICC_PROFILE\0\x01\x01anything at all'));
  assert.match(jpegProblems(jpeg(JFIF, fake))[0], /colour profile that cannot be read/);
  // A piece is missing.
  const [first] = iccSegments(profile(P3), 2);
  assert.match(jpegProblems(jpeg(JFIF, first))[0], /colour profile that cannot be read/);
});

test('a JPEG is known by its bytes, not its name', () => {
  assert.match(fails('picture.png', jpeg(exif([0x8825])))[0], /^JPEG metadata: /);
});

// ---------------------------------------------------------------- PNG

const chunk = (type, data = Buffer.alloc(0)) => {
  const body = Buffer.concat([latin(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
const PNG_SIGNATURE = latin('\x89PNG\r\n\x1a\n');
const IHDR = chunk('IHDR', bytes(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0));
const png = (...chunks) =>
  Buffer.concat([PNG_SIGNATURE, IHDR, ...chunks, chunk('IDAT', bytes(0)), chunk('IEND')]);
/** The colour profile of a PNG: a label, a zero, the method, the compressed profile. */
const iccp = (label, whole) =>
  chunk('iCCP', Buffer.concat([latin(`${label}\0\0`), deflateSync(whole)]));

test('a PNG of picture chunks only passes', () => {
  for (const picture of [
    png(),
    png(chunk('gAMA', Buffer.alloc(4)), chunk('pHYs', Buffer.alloc(9))),
    png(chunk('sRGB', bytes(0)), chunk('cHRM', Buffer.alloc(32)), chunk('bKGD', bytes(0, 0))),
    png(chunk('PLTE', Buffer.alloc(3)), chunk('tRNS', bytes(0)), chunk('sBIT', bytes(8))),
    png(chunk('cICP', bytes(12, 13, 0, 1))),
    png(iccp('ICC Profile', profile(P3))),
    png(iccp('icm', profile(P3))),
    png(iccp(P3, profile(P3))),
    png(iccp('kCGColorSpaceDisplayP3', profile(P3))),
  ]) {
    assert.deepEqual(pngProblems(picture), []);
    assert.deepEqual(fails('shot.png', picture), []);
  }
});

test('a PNG with text, Exif or a time fails', () => {
  for (const type of ['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']) {
    const reasons = fails('shot.png', png(chunk(type, Buffer.from('Software\0tool'))));
    assert.equal(reasons.length, 1, type);
    assert.match(reasons[0], new RegExp(`^PNG metadata: a ${type} chunk`));
  }
  const two = png(chunk('tEXt', Buffer.from('a\0b')), chunk('tEXt', Buffer.from('c\0d')));
  assert.match(pngProblems(two)[0], /^2 tEXt chunks/);
  assert.match(
    pngProblems(Buffer.concat([png(), Buffer.from('tail')]))[0],
    /4 bytes after the end/,
  );
  assert.match(pngProblems(png().subarray(0, -12))[0], /no IEND chunk/);
});

test('a PNG with any chunk that is not a part of the picture fails', () => {
  assert.match(pngProblems(png(chunk('sPLT', Buffer.from('mine\0'))))[0], /sPLT chunk \(a palette/);
  // A chunk of a program's own, and one nobody has defined.
  for (const type of ['prVt', 'vpAg', 'meTa']) {
    const reasons = fails('shot.png', png(chunk(type, Buffer.from('anything'))));
    assert.equal(reasons.length, 1, type);
    assert.match(reasons[0], new RegExp(`a ${type} chunk \\(not a part of the picture\\)`));
  }
  const unreadable = png(chunk('\x01\x02\x03\x04', Buffer.from('anything')));
  assert.match(pngProblems(unreadable)[0], /0x01020304 chunk/);
});

test('a colour profile of a PNG passes only under a standard name', () => {
  assert.match(
    pngProblems(png(iccp('ICC Profile', profile(OWN))))[0],
    /colour profile named "Calibrated by a person"/,
  );
  // The label is a name too.
  assert.match(
    pngProblems(png(iccp('Screen of a person', profile(P3))))[0],
    /colour profile labelled "Screen of a person"/,
  );
  const broken = chunk('iCCP', latin('ICC Profile\0\0not compressed data'));
  assert.match(pngProblems(png(broken))[0], /colour profile that cannot be read/);
});

// ---------------------------------------------------------------- SVG

test('an SVG fails on what a drawing program writes about the file and its author', () => {
  const svg = (inside, attributes = '') =>
    `<${'svg'} xmlns="http://www.w3.org/2000/svg"${attributes}>${inside}<rect width="1" height="1"/></${'svg'}>`;
  assert.deepEqual(svgProblems(svg('')), []);
  assert.deepEqual(fails('drawing.svg', svg('<title>A drawing</title>')), []);
  assert.match(fails('drawing.svg', svg(`<${'metadata'}>x</${'metadata'}>`))[0], /^SVG metadata: /);
  const rdf = svg(`<${'rdf:RDF'}><${'dc:creator'}>a person</${'dc:creator'}></${'rdf:RDF'}>`);
  assert.match(svgProblems(rdf)[0], /description in RDF/);
  const named = svg('', ` ${'sodipodi'}:docname="drawing of a person.svg"`);
  assert.match(svgProblems(named)[0], /name or the path of the file/);
  // The word in a text that is not a drawing proves nothing.
  assert.deepEqual(svgProblems(`A page about the ${'metadata'} element <${'metadata'}>.`), []);
});

// ---------------------------------------------------------------- secrets

const letters = (n) => 'aB3dE5gH7jK9mN1pQ2rS4tU6vW8xY0zA'.repeat(4).slice(0, n);
const hexDigits = (n) => '0f1e2d3c4b5a69788796a5b4c3d2e1f0'.repeat(4).slice(0, n);

test('keys and tokens of the common shapes fail, and are not printed whole', () => {
  const examples = {
    'private key': `${'-'.repeat(5)}BEGIN RSA PRIVATE KEY${'-'.repeat(5)}`,
    'PuTTY key': `${['PuTTY', 'User', 'Key', 'File'].join('-')}-2: ssh-rsa`,
    'sk-': `key = "${'sk'}-${letters(40)}"`,
    'GitHub token': `${'gh'}p_${letters(36)}`,
    'GitHub token ': `${'github'}_pat_${letters(40)}`,
    AWS: `${'AK'}IA${'ABCDEFGH12345678'}`,
    Slack: `${'xo'}xb-${'1234567890-abcdefghij'}`,
    Google: `${'AI'}za${letters(35)}`,
    bearer: `Authorization: ${'Bear'}er ${letters(48)}`,
    npm: `${'np'}m_${letters(36)}`,
    'Hugging Face': `${'h'}f_${letters(34)}`,
    Stripe: `${'sk'}_live_${letters(24)}`,
    'Stripe test': `${'rk'}_test_${letters(24)}`,
    GitLab: `${'gl'}pat-${letters(20)}`,
    JWT: [`${'ey'}J${letters(20)}`, `${'ey'}J${letters(30)}`, letters(43)].join('.'),
  };
  for (const [label, text] of Object.entries(examples)) {
    const reasons = fails('config.ts', `// ${label.trim()}\n${text}\n`);
    assert.equal(reasons.length, 1, `${label}: ${JSON.stringify(reasons)}`);
    assert.match(reasons[0], /^line 2: /, label);
    if (!/key$/.test(label)) assert.ok(!reasons[0].includes(letters(20)), label);
  }
});

test('a named value that looks like a key fails, and none of it is printed', () => {
  const named = (name, value, between = '=') => `${name}${between}${value}`;
  const examples = [
    // The key of the provider this project documents: 32 hexadecimal digits, or a longer line.
    named(['SPOTLESS', 'OPENAI', 'API', 'KEY'].join('_'), hexDigits(32)),
    named(['AZURE', 'OPENAI', 'KEY'].join('_'), letters(84)),
    named(`"${'api'}-key"`, `"${hexDigits(32)}"`, ': '),
    named(`${'Ocp-Apim-Subscription'}-Key`, hexDigits(32), ': '),
    named(`Account${'Key'}`, `${letters(86)}==`),
    named(['aws', 'secret', 'access', 'key'].join('_'), letters(40), ' = '),
    named(`//registry.example.org/:_auth${'Token'}`, letters(36)),
    named(['SPOTLESS', 'ADMIN', 'TOKEN'].join('_'), hexDigits(32)),
    named(`"${'pass'}word"`, `"${letters(24)}"`, ': '),
    named(`client_${'secret'}`, `'${letters(40)}'`, ' = '),
  ];
  for (const text of examples) {
    const reasons = fails('settings.txt', `first line\n${text}\n`);
    assert.equal(reasons.length, 1, `${text.slice(0, 24)}: ${JSON.stringify(reasons)}`);
    assert.match(reasons[0], /^line 2: a named value that looks like a key: /);
    assert.match(reasons[0], /… \(\d+ characters\)$/);
    assert.ok(!reasons[0].includes(letters(8)) && !reasons[0].includes(hexDigits(8)), text);
  }
});

test('a named value made of words, or a short one, passes', () => {
  assert.equal(looksLikeKey(hexDigits(32)), true);
  assert.equal(looksLikeKey(letters(40)), true);
  assert.equal(looksLikeKey('a-long-name-made-of-words-and-hyphens'), false);
  assert.equal(looksLikeKey('SPOTLESS_OPENAI_PRICE_GPT_6_1_SOL_INPUT'), false);
  for (const text of [
    `${'tok'}en = a-long-name-made-of-words-and-hyphens`,
    `${'pass'}word: the_password_of_the_account_goes_here`,
    `admin${'Token'}: 'mcp-test-admin-token'`,
    `${'sec'}ret=${letters(23)}`,
    `prompt_${'tok'}ens: 123456789012345678901234`,
    `${['SPOTLESS', 'OPENAI', 'API', 'KEY'].join('_')}=`,
    `${'api'}Key: process.env['${['SPOTLESS', 'OPENAI', 'API', 'KEY'].join('_')}'],`,
    `cache_key: "${hexDigits(64)}"`,
  ]) {
    assert.deepEqual(fails('notes.md', text), [], text);
  }
});

test('a password in an address, a login and the host of an endpoint fail', () => {
  const address = (password) => `${'https'}://${'deploy'}:${password}@host.example.org/x`;
  const withPassword = fails('remote.txt', `origin ${address(letters(16))}\n`);
  assert.equal(withPassword.length, 1);
  assert.match(
    withPassword[0],
    /a password in an address: after the user deploy \(16 characters\)/,
  );
  assert.ok(!withPassword[0].includes(letters(6)));
  for (const placeholder of ['<password>', '$PASSWORD', 'password', 'your-token', 'xxxxxxxx']) {
    assert.deepEqual(fails('remote.md', address(placeholder)), [], placeholder);
  }
  // An address with a port, and one with an at sign in its path, hold no password.
  assert.deepEqual(
    fails('a.md', `${'http'}://127.0.0.1:8787/api and ${'https'}://a.example/@b`),
    [],
  );

  const login = ['machine', 'api.example.org', 'login', 'jane', 'password', letters(12)].join(' ');
  assert.match(fails('notes.txt', login)[0], /a login of a \.netrc file/);

  const host = (resource, service) => [resource, ...service, 'azure', 'com'].join('.');
  for (const service of [['openai'], ['services', 'ai'], ['cognitiveservices']]) {
    const reasons = fails('record.json', `{"url":"https://${host('acme-prod-eu', service)}/v1"}`);
    assert.equal(reasons.length, 1, service.join('.'));
    assert.match(reasons[0], /the host of an Azure OpenAI endpoint/);
    for (const placeholder of ['<resource>', 'your-resource', 'YOUR-RESOURCE', 'example']) {
      assert.deepEqual(fails('README.md', `https://${host(placeholder, service)}/v1`), []);
    }
  }
  // The domain alone names nobody.
  assert.deepEqual(fails('a.ts', `if (host.endsWith('.${['azure', 'com'].join('.')}')) {}`), []);
});

test('words that only begin like a key pass', () => {
  for (const text of [
    'a task-list-of-many-small-things-to-do-today',
    'risk-assessment-of-the-whole-machine-here',
    'sk-short',
    'Bearer <token>',
    'the Bearer token goes in the header',
    'sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0',
    `the ${'np'}m_config_registry_of_the_whole_workspace variable`,
    `${'ey'}J is how a JSON object in base64 begins`,
  ]) {
    assert.deepEqual(fails('notes.md', text), [], text);
  }
});

test('environment and login files: only an example, and with names only', () => {
  assert.match(fails('.env', 'A=\n')[0], /environment file/);
  assert.match(fails('packages/x/.env.local', '')[0], /environment file/);
  assert.match(fails('.envrc', 'export A=1\n')[0], /environment file/);
  assert.match(fails('deploy/prod.env', 'A=1\n')[0], /environment file/);
  assert.match(fails('.netrc', '')[0], /login file/);
  assert.match(fails('certs/server.p12', bytes(0x30, 0x82, 1, 2)).join(' '), /key store/);
  assert.deepEqual(fails('.env.example', '# a comment = with a sign\nA=\nexport B=\nC=""\n'), []);
  // A comment after an empty value is still an empty value; so is another name for an example.
  assert.deepEqual(fails('.env.example', 'A= # the key of the service\nB=\t# another\n'), []);
  assert.deepEqual(fails('.env.sample', 'A=\n'), []);
  assert.deepEqual(fails('.env.template', 'A=\n'), []);
  const reasons = fails('.env.example', '# names\nA=\nB=something\n');
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /^line 3: B has a value/);
  assert.match(fails('.env.example', 'A=#not-a-comment\n')[0], /^line 1: A has a value/);
  assert.match(fails('.env.sample', 'A=1\n')[0], /\.env\.sample holds names only/);
});

// ---------------------------------------------------------------- compiled programs and size

test('compiled programs are known by their first bytes', () => {
  const start = (...values) => Buffer.concat([bytes(...values), Buffer.alloc(64)]);
  assert.equal(compiledKind(start(0xcf, 0xfa, 0xed, 0xfe)), 'Mach-O');
  assert.equal(compiledKind(start(0xfe, 0xed, 0xfa, 0xce)), 'Mach-O');
  assert.match(compiledKind(start(0xca, 0xfe, 0xba, 0xbe)), /universal/);
  assert.equal(compiledKind(start(0x7f, 0x45, 0x4c, 0x46)), 'ELF');
  const pe = Buffer.alloc(0x90);
  pe.write('MZ', 0, 'latin1');
  pe.writeUInt32LE(0x80, 0x3c);
  pe.write('PE\0\0', 0x80, 'latin1');
  assert.equal(compiledKind(pe), 'PE (Windows)');
  assert.equal(compiledKind(Buffer.from('MZ is how this sentence starts, and it is text')), null);
  assert.equal(compiledKind(Buffer.from('#!/bin/sh\n')), null);
  // One reason, not two: a program is not also "a file that cannot be looked into".
  assert.deepEqual(fails('tool', start(0x7f, 0x45, 0x4c, 0x46)), ['a compiled program (ELF)']);
  assert.match(fails('a/__pycache__/m.cpython-312.pyc', 'x')[0], /Python bytecode/);
});

test('size: a warning over 20 MB, a failure over 50 MB', () => {
  const sized = (size) => checkFile('data.txt', Buffer.from('x'), size);
  assert.deepEqual(sized(WARN_BYTES), []);
  assert.equal(sized(WARN_BYTES + 1)[0].level, 'warn');
  assert.equal(sized(FAIL_BYTES)[0].level, 'warn');
  assert.equal(sized(FAIL_BYTES + 1)[0].level, 'fail');
});

// ---------------------------------------------------------------- sound

const id3Frame = (id, text) => {
  const head = Buffer.alloc(10);
  head.write(id, 0, 'latin1');
  head.writeUInt32BE(text.length + 1, 4);
  return Buffer.concat([head, bytes(0), Buffer.from(text)]);
};
/** Two frames of MPEG 1 layer III at 128 kbit/s and 44.1 kHz: 417 bytes each. */
const mpegFrames = () => {
  const frame = Buffer.alloc(417);
  bytes(0xff, 0xfb, 0x90, 0x00).copy(frame);
  return Buffer.concat([frame, frame]);
};
const tagged = (...frames) => {
  const body = Buffer.concat(frames);
  const head = bytes(0x49, 0x44, 0x33, 3, 0, 0, 0, 0, body.length >> 7, body.length & 0x7f);
  return Buffer.concat([head, body, mpegFrames()]);
};

test('an MP3 with only the encoder named passes; other tags fail', () => {
  assert.deepEqual(id3Frames(tagged(id3Frame('TSSE', 'encoder 1'))), ['TSSE']);
  assert.deepEqual(fails('a.mp3', tagged(id3Frame('TSSE', 'encoder 1'))), []);
  assert.deepEqual(warns('a.mp3', tagged(id3Frame('TSSE', 'encoder 1'))), []);
  const reasons = fails('a.mp3', tagged(id3Frame('TPE1', 'a person'), id3Frame('TSSE', 'x')));
  assert.deepEqual(reasons, ['MP3 metadata: ID3 tags TPE1']);
  assert.equal(id3Frames(Buffer.from('plain text')), null);
});

test('an MP3 without a tag passes, and two bytes alone do not make one', () => {
  assert.equal(isMpegAudio(mpegFrames()), true);
  assert.deepEqual(fails('a.mp3', mpegFrames()), []);
  // The same two bytes open a text of 16-bit characters: that is not sound.
  const wide = Buffer.concat([bytes(0xff, 0xfe), Buffer.from('a text of some length', 'utf16le')]);
  assert.equal(isMpegAudio(wide), false);
  assert.match(fails('notes.txt', wide)[0], /binary file of a kind this check does not know/);
  assert.equal(isMpegAudio(bytes(0xff, 0xfb, 0x90, 0x00)), false);
});

// ---------------------------------------------------------------- files that cannot be looked into

/** The first bytes of each format, padded so that it is plainly not text. */
const FORMATS = {
  PDF: latin('%PDF-1.7\n'),
  GIF: latin('GIF89a\x01\0\x01\0'),
  WebP: latin('RIFF\x10\0\0\0WEBPVP8 '),
  WAV: latin('RIFF\x10\0\0\0WAVEfmt '),
  TIFF: latin('II*\0\x08\0\0\0'),
  'HEIF, AVIF, MPEG-4 or QuickTime': latin('\0\0\0\x18ftypheic'),
  QuickTime: latin('\0\0\0\x08moov\0\0\0\0'),
  'a zip archive': latin('PK\x03\x04\x14\0\0\0'),
  gzip: bytes(0x1f, 0x8b, 8, 0, 0, 0, 0, 0),
  bzip2: latin('BZh91AY&SY\0\0'),
  xz: bytes(0xfd, 0x37, 0x7a, 0x58, 0x5a, 0, 0, 4),
  '7z': bytes(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4),
  RAR: latin('Rar!\x1a\x07\x01\0'),
  tar: Buffer.concat([Buffer.alloc(257), latin('ustar\0' + '00')]),
  Ogg: latin('OggS\0\x02\0\0'),
  FLAC: latin('fLaC\0\0\0\x22'),
  BMP: Buffer.concat([latin('BM'), bytes(70, 0, 0, 0, 0, 0, 0, 0, 54, 0, 0, 0, 40, 0, 0, 0)]),
  WebAssembly: latin('\0asm\x01\0\0\0'),
  'a static library': latin('!<arch>\nmember.o/      '),
  'an SQLite database': latin('SQLite format 3\0\x10\0\x01\x01'),
  'a .DS_Store file': latin('\0\0\0\x01Bud1\0\0\x10\0'),
};

test('a file that cannot be looked into fails', () => {
  for (const [label, start] of Object.entries(FORMATS)) {
    const content = Buffer.concat([start, Buffer.alloc(16)]);
    assert.ok(uninspectedFormat(content)?.startsWith(label), label);
    const reasons = fails('docs/thing', content);
    assert.equal(reasons.length, 1, `${label}: ${JSON.stringify(reasons)}`);
    assert.ok(reasons[0].startsWith(`${label}`), reasons[0]);
    assert.match(reasons[0], /cannot look into it, and it is not on the list/);
    assert.deepEqual(warns('docs/thing', content), []);
  }
  // A text that is a PDF, and a file that is nothing this check knows.
  assert.match(fails('a.pdf', '%PDF-1.7\nall text\n')[0], /^PDF: /);
  assert.match(
    fails('font.woff2', Buffer.concat([latin('wOF2'), Buffer.alloc(40)]))[0],
    /^a binary file of a kind this check does not know: /,
  );
  assert.match(fails('.DS_Store', 'x')[0], /\.DS_Store file/);
  // Two letters do not make a picture.
  assert.equal(uninspectedFormat(Buffer.from('BMW is how this sentence starts')), null);
  assert.deepEqual(fails('notes.txt', 'BMW is how this sentence starts'), []);
  assert.deepEqual(fails('empty.txt', ''), []);
});

test('a file on the allow-list passes while its path and its content are those allowed', () => {
  const content = Buffer.concat([FORMATS.PDF, Buffer.from('the manual\n')]);
  const sha256 = createHash('sha256').update(content).digest('hex');
  const allowed = new Map([['docs/manual.pdf', sha256]]);
  assert.deepEqual(fails('docs/manual.pdf', content, { allowed }), []);
  assert.match(fails('docs/other.pdf', content, { allowed })[0], /not on the list/);
  const changed = Buffer.concat([content, Buffer.from('and a page more\n')]);
  assert.match(
    fails('docs/manual.pdf', changed, { allowed })[0],
    /its content is not the content that was allowed/,
  );
  // Being allowed is no licence for a path inside the file.
  const withPath = Buffer.concat([FORMATS.PDF, Buffer.from(path('Users', SOMEONE))]);
  const listed = new Map([['a.pdf', createHash('sha256').update(withPath).digest('hex')]]);
  assert.match(fails('a.pdf', withPath, { allowed: listed })[0], /home directory/);
});

// ---------------------------------------------------------------- what to do about a failure

test('the commands that make a picture pass are given for each file', () => {
  const failed = [
    ...checkFile('docs/photo.jpg', jpeg(JFIF, exif([ORIENTATION, 0x8825]))),
    ...checkFile("docs/a person's photo.jpg", jpeg(JFIF, segment(0xfe, Buffer.from('x')))),
    ...checkFile('docs/own.jpg', jpeg(JFIF, ...iccSegments(profile(OWN)))),
    ...checkFile('docs/shot.png', png(chunk('tEXt', Buffer.from('a\0b')))),
    ...checkFile('docs/odd.png', png(chunk('prVt', Buffer.from('x')))),
    ...checkFile('docs/cut.png', png().subarray(0, -12)),
    ...checkFile('sound/a.mp3', tagged(id3Frame('TPE1', 'a person'))),
    ...checkFile('docs/notes.md', Buffer.from(path('Users', SOMEONE))),
  ];
  const lines = fixCommands(failed);
  const keep = 'exiftool -all= -tagsfromfile @ -Orientation -icc_profile -overwrite_original';
  assert.ok(lines.includes(`  ${keep} docs/photo.jpg`), lines.join('\n'));
  // A name with a blank or a quotation mark is quoted for the shell.
  assert.ok(lines.includes(`  ${keep} 'docs/a person'\\''s photo.jpg'`), lines.join('\n'));
  // A profile that is refused goes with the rest.
  assert.ok(
    lines.includes(
      '  exiftool -all= -tagsfromfile @ -Orientation -overwrite_original docs/own.jpg',
    ),
  );
  assert.ok(lines.includes('  exiftool -all= -overwrite_original docs/shot.png'));
  // A chunk ExifTool leaves: the picture is written again first.
  assert.ok(
    lines.includes(
      '  ffmpeg -y -i docs/odd.png -map_metadata -1 -bitexact docs/odd.clean.png && exiftool -all= -overwrite_original docs/odd.clean.png && mv docs/odd.clean.png docs/odd.png',
    ),
  );
  assert.ok(
    lines.includes(
      '  ffmpeg -y -i sound/a.mp3 -map 0:a:0 -map_metadata -1 -c:a copy -bitexact sound/a.clean.mp3 && mv sound/a.clean.mp3 sound/a.mp3',
    ),
  );
  assert.ok(lines.some((line) => /No command repairs/.test(line)));
  assert.ok(lines.some((line) => line.includes('docs/cut.png')));
  // Nothing is offered for a path in a text: that is rewritten by hand.
  assert.ok(!lines.some((line) => line.includes('notes.md')));
  assert.deepEqual(
    fixCommands(checkFile('docs/notes.md', Buffer.from(path('Users', SOMEONE)))),
    [],
  );
  assert.deepEqual(fixCommands([]), []);
});

test('the line of the allow-list is given for a file that cannot be looked into', () => {
  const content = Buffer.concat([FORMATS.PDF, Buffer.from('the manual\n')]);
  const sha256 = createHash('sha256').update(content).digest('hex');
  const lines = fixCommands(checkFile('docs/manual.pdf', content));
  assert.ok(lines.some((line) => line.includes('ALLOWED_UNINSPECTED')));
  assert.ok(lines.includes(`  ["docs/manual.pdf", '${sha256}'],`), lines.join('\n'));
});

// ---------------------------------------------------------------- the command

test('the command checks what git would publish, and nothing git ignores', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hygiene-test-'));
  const run = () => spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: dir });
    writeFileSync(join(dir, '.gitignore'), 'ignored/\n.env\n');
    writeFileSync(join(dir, 'README.md'), `Clone it to ${path('Users', 'you', 'project')}\n`);
    writeFileSync(join(dir, '.env.example'), 'KEY=\n');
    writeFileSync(join(dir, '.env'), 'KEY=filled-in\n');
    mkdirSync(join(dir, 'ignored'));
    writeFileSync(join(dir, 'ignored', 'log.txt'), path('Users', SOMEONE));
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'docs', 'ok.jpg'), jpeg(JFIF, exif([ORIENTATION])));

    const clean = run();
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /4 files checked, 0 failures/);
    assert.ok(!clean.stdout.includes('exiftool'));

    // New files that are not ignored count before any commit; so do tracked ones.
    writeFileSync(join(dir, 'docs', 'photo.jpg'), jpeg(JFIF, exif([ORIENTATION, 0x8825])));
    writeFileSync(join(dir, 'docs', 'run.json'), `{"cwd":"${path('home', SOMEONE, 'run')}"}\n`);
    writeFileSync(join(dir, 'docs', 'manual.pdf'), FORMATS.PDF);
    execFileSync('git', ['add', 'docs/run.json'], { cwd: dir });
    const dirty = run();
    assert.equal(dirty.status, 1);
    assert.match(dirty.stdout, /FAIL {5}docs\/photo\.jpg: JPEG metadata: .*GPS directory/);
    assert.match(dirty.stdout, /FAIL {5}docs\/run\.json: line 1: a home directory/);
    assert.match(dirty.stdout, /FAIL {5}docs\/manual\.pdf: PDF: this check cannot look into it/);
    assert.match(dirty.stdout, /3 failures in 3 files/);
    assert.ok(!dirty.stdout.includes('ignored/'));

    // A directory named after a home directory fails by its name alone.
    const named = join(dir, 'logs', ['', 'Users', 'jane', 'Documents', 'work', ''].join('-'));
    mkdirSync(named, { recursive: true });
    writeFileSync(join(named, 'run.txt'), 'nothing in here\n');
    const byName = run();
    assert.equal(byName.status, 1);
    assert.match(byName.stdout, /run\.txt: the path of the file: a home directory in the name/);
    assert.match(byName.stdout, /4 failures in 4 files/);
    rmSync(join(dir, 'logs'), { recursive: true });
    // What to do is printed with the failures, before the last line.
    assert.match(
      dirty.stdout,
      /\n {2}exiftool -all= -tagsfromfile @ -Orientation -icc_profile -overwrite_original docs\/photo\.jpg\n/,
    );
    assert.match(dirty.stdout, /\n {2}\["docs\/manual\.pdf", '[0-9a-f]{64}'\],\n/);
    assert.match(dirty.stdout.trimEnd().split('\n').at(-1), /^hygiene: 7 files checked/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a repository inside the repository is named, since its files are not looked at', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hygiene-test-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: dir });
    writeFileSync(join(dir, 'README.md'), 'outside\n');
    mkdirSync(join(dir, 'vendor', 'inner'), { recursive: true });
    execFileSync('git', ['init', '--quiet'], { cwd: join(dir, 'vendor', 'inner') });
    writeFileSync(join(dir, 'vendor', 'inner', 'log.txt'), path('Users', SOMEONE));
    const result = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /warning {2}vendor\/inner\/?: a repository inside this one/);
    assert.match(result.stdout, /1 files checked, 0 failures in 0 files, 1 warning/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('outside a git repository the command says so', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hygiene-test-'));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, '--root', dir], {
      encoding: 'utf8',
      env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() },
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /is it a git repository/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
