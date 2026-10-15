#!/usr/bin/env node
/**
 * The hygiene check: looks at every file git would publish and fails when one of them carries
 * something that should not leave the machine it was written on.
 *
 *   node scripts/check-hygiene.mjs [--root <directory>]        (pnpm hygiene)
 *
 * The files are those of `git ls-files --cached --others --exclude-standard`: what is tracked
 * and what is new and not ignored, so the check works before the first commit too. It fails,
 * naming the file and the reason, on:
 *
 *  - a personal path: a home directory of macOS, Linux or Windows with a user's name in it, in
 *    the spellings such a path takes on its way into a file (plain, after an escaped line
 *    break, with escaped or URL-encoded slashes, under a prefix, as a UNC path, as the name of
 *    a directory made from it), or a path under the temporary directories of macOS. Text and
 *    binary files are both searched, the latter also as 16-bit text;
 *  - metadata in a picture. A JPEG may hold a JFIF header, an Exif segment whose only tags are
 *    Orientation, YCbCrPositioning, the two resolutions and their unit, an ICC colour profile
 *    whose description is one of a short list of standard names, and an Adobe APP14 segment;
 *    any other application segment, a comment, a thumbnail or bytes after the end of the image
 *    fail. A PNG may hold the chunks that make the picture and a colour profile of the same
 *    list; a text chunk, Exif, a time, any other chunk or bytes after its end fail. An SVG
 *    fails on a metadata element. When a picture fails, the commands that make it pass are
 *    printed;
 *  - tags in an MP3 other than the encoder's name;
 *  - a secret: the header of a private key, the common shapes of API keys and tokens, a named
 *    value that looks like a key, a password inside an address, the host of an Azure OpenAI
 *    endpoint, a `.env`, `.envrc` or `.netrc` file, a value filled in in `.env.example`;
 *  - a compiled program (Mach-O, ELF, PE) and a file over 50 MB. A file over 20 MB is a warning;
 *  - a file it cannot look into: a PDF, a picture or a film of another format, an archive, a
 *    database, any other binary file. Such a file passes only when its path and the SHA-256
 *    of its content are on the list `ALLOWED_UNINSPECTED` below: adding a line there is an act
 *    a reviewer sees.
 *
 * Node only, no dependencies. It knows nothing about any one project: no names, no numbers.
 * What it cannot see: text inside compressed data, a face or a street in a photograph, a name
 * that is not part of a path, what a file on the allow-list holds.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

/** A file over this many bytes fails; GitHub refuses 100 MB and complains from 50 MB. */
export const FAIL_BYTES = 50 * 1024 * 1024;
/** A file over this many bytes is a warning. */
export const WARN_BYTES = 20 * 1024 * 1024;

/**
 * Files this check cannot look into that may be published all the same: the path in the
 * repository and the SHA-256 of the content. A file of such a format that is not here, or
 * whose content has changed, fails. Before adding a line, look into the file by other means
 * (the properties of a PDF, the tags of a film); the failure prints the line to add.
 */
export const ALLOWED_UNINSPECTED = new Map([
  // ['docs/example.pdf', '0000000000000000000000000000000000000000000000000000000000000000'],
  // The demo video: its only tags are the container's brand and the encoder's name.
  ['docs/media/linkedin-demo/dishwasherbench-linkedin.mp4', '71b197d33b241b174e6570fdc44627958dec9aedfa77e04a343b622cfc2ab731'],
]);

/**
 * The allow-list: user names that are plainly placeholders or accounts every machine has, so
 * that documentation may write a home directory of `you` and a log may name the account of a
 * hosted machine. Keep it short; a real name never belongs here. `runner` is the account of
 * GitHub's hosted machines, `shared`, `public` and `default` are folders beside the homes on
 * macOS and Windows, `linuxbrew`, `ubuntu` and `node` are accounts of tools and images.
 */
const PLACEHOLDER_USERS = new Set([
  'you',
  'your-name',
  'yourname',
  'user',
  'username',
  'name',
  'me',
  'example',
  'runner',
  'shared',
  'public',
  'default',
  'linuxbrew',
  'ubuntu',
  'node',
]);

/** Also allowed: a name that is a variable or a pattern, such as <name>, $USER, %USERNAME%, {user}, *. */
const PLACEHOLDER_SHAPE = /^(<[^>]*>?|\$.*|%.*%?|\{.*|\*+|\.\.\.|…|~)$/;

/** True when the user's name of a home directory is a placeholder. */
export function isPlaceholderUser(name) {
  // A sentence may end on the name: `…/you.` is still `you`.
  const bare = name.replace(/[.,;:!?)\]}>]+$/, '');
  return (
    PLACEHOLDER_USERS.has(bare.toLowerCase()) ||
    PLACEHOLDER_SHAPE.test(name) ||
    PLACEHOLDER_SHAPE.test(bare)
  );
}

// The patterns are written with character classes, so that this file does not contain what it
// looks for. A name ends at a slash, a backslash, a blank or a quotation mark.
const PATH_PATTERNS = [
  {
    // A home directory of macOS, wherever it stands: at the start of a path, after an escaped
    // line break, a colour code or a compiler flag, under a prefix (another volume, a drive
    // of Windows as Linux mounts it), in an address.
    what: 'a home directory',
    regex: /[/]Users[/]([^/\\\s"'`]{1,64})/g,
    user: 1,
  },
  {
    // A home directory of Linux. Not after a letter, a digit or a dot (that is a part of a
    // longer relative path or of an address, not a root), unless what stands before is an
    // escaped line break or tab, a compiler flag (-I, -L) or a colour code of a terminal.
    what: 'a home directory',
    regex:
      /[/](?<=(?<![A-Za-z0-9._~-])[/]|\\[nrt][/]|-[IL][/]|\x1b\[[0-9;]*m[/])home[/]([^/\\\s"'`]{1,64})/g,
    user: 1,
  },
  {
    // A home directory of Windows in either case, with single or doubled (escaped)
    // backslashes, on a drive or on a share of another machine (a UNC path).
    what: 'a home directory (Windows)',
    regex: /(?:[A-Za-z]:|\\{2,4}[A-Za-z0-9._$-]+)\\{1,2}Users\\{1,2}([^/\\\s"'`]{1,64})/gi,
    user: 1,
  },
  {
    // The same with slashes that are escaped (as JSON may write them) or URL-encoded.
    what: 'a home directory (escaped or URL-encoded)',
    regex: /(?:%2[Ff]|\\[/])Users(?:%2[Ff]|\\[/])([^%/\\\s"'`]{1,64})/g,
    user: 1,
  },
  {
    what: 'a home directory (escaped or URL-encoded)',
    regex: /(?<![A-Za-z0-9._~-])(?:%2[Ff]|\\[/])home(?:%2[Ff]|\\[/])([^%/\\\s"'`]{1,64})/g,
    user: 1,
  },
  {
    // The name of a directory that a tool made from a path by writing a hyphen for every
    // slash: it starts with the home directory.
    what: 'a home directory in the name of a directory',
    regex: /(?<![A-Za-z0-9])-Users-([A-Za-z0-9]+)-/g,
    user: 1,
  },
  {
    // The same for Linux, where the words also stand in ordinary names: only at the start of
    // a line or of a path.
    what: 'a home directory in the name of a directory',
    regex: /-home-(?<=(?:^|[/\s"'`=:])-home-)([A-Za-z0-9]+)-/gm,
    user: 1,
  },
  {
    what: 'a temporary directory of macOS',
    regex: /[/]private[/]tmp[/]|[/]var[/]folders[/]/g,
  },
];

/** A value that stands for a secret in an example: `<password>`, `$TOKEN`, `your-key`, `xxxx`. */
const PLACEHOLDER_SECRET =
  /^(?:[<{[$%*].*|(?:your[-_]?)?(?:password|passwd|pass|pwd|secret|token|key)|x{3,}|redacted|changeme)$/i;

/**
 * True when a named value looks like a key and not like words: one of its parts (between
 * hyphens, underscores, slashes and plus signs) has eight characters or more with both a
 * letter and a digit among them. `a-long-name-made-of-words` is not one; 32 hexadecimal
 * digits, or a line of base64, is.
 */
export function looksLikeKey(value) {
  return value
    .split(/[-_/+]/)
    .some((part) => part.length >= 8 && /[0-9]/.test(part) && /[A-Za-z]/.test(part));
}

/** The names of an Azure resource that examples use. */
const PLACEHOLDER_RESOURCES = new Set([
  'your-resource',
  'your-resource-name',
  'my-resource',
  'myresource',
  'resource',
  'example',
  'contoso',
]);

/** The name of the Azure resource that ends where the match begins. */
const resourceBefore = (match) =>
  /[A-Za-z0-9-]*$/.exec(match.input.slice(Math.max(0, match.index - 64), match.index))[0];

const KEY_VALUE = `["']?\\s*[:=]\\s*["']?([A-Za-z0-9+/_-]{24,}={0,2})`;
/** A named value as it is reported: its name and how long the value is, and none of the value. */
const namedValue = (match) =>
  `${match[0].slice(0, match[0].length - match[1].length).trim()} … (${match[1].length} characters)`;
const SECRET_PATTERNS = [
  { what: 'the header of a private key', regex: /-{5}BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY/g },
  { what: 'the header of a private key (PuTTY)', regex: /PuTTY-User-Key-File-[0-9]/g },
  { what: 'a key of the shape sk-…', regex: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/g },
  { what: 'a GitHub token', regex: /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{30,}/g },
  { what: 'a GitHub token', regex: /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}/g },
  { what: 'an AWS access key id', regex: /(?<![A-Za-z0-9])A[KS]IA[0-9A-Z]{16}(?![0-9A-Za-z])/g },
  { what: 'a Slack token', regex: /(?<![A-Za-z0-9])xox[a-z]-[A-Za-z0-9-]{10,}/g },
  { what: 'a Google API key', regex: /(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g },
  { what: 'a bearer token', regex: /\bBearer\s+[A-Za-z0-9._~+/-]{32,}=*/g },
  {
    // npm, Hugging Face, Stripe (secret and restricted keys, live and test).
    what: 'a token of the shape npm_…, hf_…, sk_live_…',
    regex: /(?<![A-Za-z0-9])(?:npm|hf|[sr]k_live|[sr]k_test)_[A-Za-z0-9]{20,}/g,
  },
  { what: 'a GitLab token', regex: /(?<![A-Za-z0-9])glpat-[A-Za-z0-9_-]{20,}/g },
  {
    what: 'a JSON web token',
    regex: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}[.]eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]*/g,
  },
  {
    // A scheme, a user, a colon, a password and an at sign before the host. Printable
    // characters only, so that the compressed data of a picture does not match by chance.
    what: 'a password in an address',
    regex: /:[/][/](?<=[A-Za-z][A-Za-z0-9+.-]*:[/][/])([A-Za-z0-9._~%+-]+):([!-.0-?A-~]{6,})@/g,
    keep: (match) => !PLACEHOLDER_SECRET.test(match[2]),
    show: (match) => `after the user ${match[1].slice(0, 24)} (${match[2].length} characters)`,
  },
  {
    // A value of 24 or more characters after a variable whose name ends in _KEY, whatever
    // stands before. It goes by its value, so that the next pattern does not report it again.
    what: 'a named value that looks like a key',
    regex: new RegExp(`[A-Z][A-Z0-9_]*_KEY${KEY_VALUE}`, 'g'),
    found: (match) => match[1],
    keep: (match) => looksLikeKey(match[1]),
    show: namedValue,
  },
  {
    // The same after a name that says what the value is: an API key, a subscription key, an
    // access or account key, an auth token of npm, a password, a secret, a token.
    what: 'a named value that looks like a key',
    regex: new RegExp(
      `(?:api[-_ ]?key|subscription[-_ ]?key|access[-_ ]?key|account[-_ ]?key|_authToken|password|passwd|secret|token)${KEY_VALUE}`,
      'gi',
    ),
    found: (match) => match[1],
    keep: (match) => looksLikeKey(match[1]),
    show: namedValue,
  },
  {
    what: 'a login of a .netrc file',
    regex: /\bmachine\s+\S+\s+login\s+\S+\s+password\s+(\S+)/g,
    keep: (match) => !PLACEHOLDER_SECRET.test(match[1]),
  },
  {
    // The address of a deployment says whose it is. The name of the resource stands right
    // before the dot; a placeholder in angle brackets leaves no name there, and passes.
    what: 'the host of an Azure OpenAI endpoint',
    regex: /[.](?:openai[.]azure|services[.]ai[.]azure|cognitiveservices[.]azure)[.]com/gi,
    found: (match) => `${resourceBefore(match)}${match[0]}`,
    keep: (match) =>
      resourceBefore(match) !== '' &&
      !PLACEHOLDER_RESOURCES.has(resourceBefore(match).toLowerCase()),
  },
];

/** TIFF types of the Exif tags a JPEG may keep. */
const SHORT = 3;
const RATIONAL = 5;

/**
 * The Exif tags a JPEG may keep: how the picture is turned, where its colour samples sit, and
 * the resolution with its unit, which the Exif standard asks for and some tools write back
 * when everything else is removed. Each may stand once, as one value of its type.
 */
const EXIF_ALLOWED = new Map([
  [0x0112, { name: 'Orientation', type: SHORT }],
  [0x0213, { name: 'YCbCrPositioning', type: SHORT }],
  [0x0128, { name: 'ResolutionUnit', type: SHORT }],
  [0x011a, { name: 'XResolution', type: RATIONAL }],
  [0x011b, { name: 'YResolution', type: RATIONAL }],
]);

/** Names of tags that are often found, for a reason a person can read. */
const EXIF_NAMES = new Map([
  [0x010e, 'ImageDescription'],
  [0x010f, 'Make'],
  [0x0110, 'Model'],
  [0x0131, 'Software'],
  [0x0132, 'DateTime'],
  [0x013b, 'Artist'],
  [0x013c, 'HostComputer'],
  [0x8298, 'Copyright'],
  [0x8769, 'the Exif sub-directory (camera settings, dates)'],
  [0x8825, 'the GPS directory (location)'],
  [0xa005, 'the interoperability directory'],
]);

/**
 * The descriptions of the colour profiles a picture may carry: the standard colour spaces,
 * under the names their profiles go by. A profile made for one screen or one printer carries a
 * name somebody chose for it, and is refused.
 */
const ICC_DESCRIPTIONS = new Set([
  'Display P3',
  'sRGB IEC61966-2.1',
  'sRGB',
  'sRGB built-in',
  'Adobe RGB (1998)',
  'ProPhoto RGB',
  'Generic RGB Profile',
  'Generic Gray Profile',
  'Generic Gray Gamma 2.2 Profile',
]);

/** What tools write as the label of the profile of a PNG when they do not repeat its name. */
const ICC_LABELS = new Set([
  'ICC Profile',
  'ICC profile',
  'icc',
  'icm',
  'kCGColorSpaceDisplayP3',
  'kCGColorSpaceSRGB',
  'kCGColorSpaceAdobeRGB1998',
]);

/**
 * The chunks of a PNG that make the picture: the header, the palette, the image data, the
 * frames of an animation, and how the samples are to be read (transparency, gamma, colour
 * space, bit depth, pixel size, background). A colour profile (iCCP) is looked at separately.
 */
const PNG_ALLOWED = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'gAMA',
  'cHRM',
  'sRGB',
  'sBIT',
  'pHYs',
  'bKGD',
  'hIST',
  'cICP',
  'mDCv',
  'cLLi',
  'acTL',
  'fcTL',
  'fdAT',
]);

/** What the chunks hold that are refused most often. */
const PNG_REFUSED = new Map([
  ['tEXt', 'text'],
  ['iTXt', 'text'],
  ['zTXt', 'text'],
  ['eXIf', 'Exif data'],
  ['tIME', 'the time it was last changed'],
  ['sPLT', 'a palette with a name'],
]);

/** ID3 frames that say nothing about a person: the encoder's name and settings. */
const ID3_ALLOWED = new Set(['TSSE', 'TENC', 'TSS', 'TEN']);

/**
 * The frame names of the ID3 tags of an MP3 (version 2 at the start, version 1 as `ID3v1` at
 * the end), or null when the bytes carry neither.
 */
export function id3Frames(bytes) {
  const ascii = (from, to) => bytes.subarray(from, to).toString('latin1');
  const frames = [];
  let tagged = false;
  if (ascii(0, 3) === 'ID3' && bytes.length >= 10) {
    tagged = true;
    const version = bytes[3];
    const syncsafe = (o) =>
      ((bytes[o] & 0x7f) << 21) |
      ((bytes[o + 1] & 0x7f) << 14) |
      ((bytes[o + 2] & 0x7f) << 7) |
      (bytes[o + 3] & 0x7f);
    const end = Math.min(bytes.length, 10 + syncsafe(6));
    const idLength = version === 2 ? 3 : 4;
    const headLength = version === 2 ? 6 : 10;
    let at = 10;
    while (at + headLength <= end) {
      const id = ascii(at, at + idLength);
      if (!/^[A-Z0-9]+$/.test(id)) break; // padding
      const size =
        version === 2
          ? bytes.readUIntBE(at + 3, 3)
          : version === 4
            ? syncsafe(at + 4)
            : bytes.readUInt32BE(at + 4);
      frames.push(id);
      at += headLength + size;
    }
  }
  if (bytes.length >= 128 && ascii(bytes.length - 128, bytes.length - 125) === 'TAG') {
    // Only after MPEG audio: three letters alone prove little.
    if (tagged || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
      tagged = true;
      frames.push('ID3v1');
    }
  }
  return tagged ? frames : null;
}

/** Bit rates of MPEG audio in kbit/s, by version and layer, then by the index in a frame. */
const MPEG_BITRATES = [
  [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448], // 1, layer I
  [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], // 1, layer II
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // 1, layer III
  [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256], // 2 and 2.5, layer I
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // 2 and 2.5, layers II, III
];

/**
 * True when the bytes begin with two frames of MPEG audio, one right after the other: an MP3
 * without a tag. One frame header alone is two bytes that other files begin with too.
 */
export function isMpegAudio(bytes) {
  /** The length of the frame that starts at `at`, or 0 when none does. */
  const frame = (at) => {
    if (at + 4 > bytes.length || bytes[at] !== 0xff || (bytes[at + 1] & 0xe0) !== 0xe0) return 0;
    const version = (bytes[at + 1] >> 3) & 3; // 3: MPEG 1, 2: MPEG 2, 0: MPEG 2.5
    const layer = (bytes[at + 1] >> 1) & 3; // 3: layer I, 2: layer II, 1: layer III
    const bitrate = bytes[at + 2] >> 4;
    const rate = (bytes[at + 2] >> 2) & 3;
    const padding = (bytes[at + 2] >> 1) & 1;
    if (version === 1 || layer === 0 || bitrate === 0 || bitrate === 15 || rate === 3) return 0;
    const first = version === 3;
    const kbps = MPEG_BITRATES[first ? 3 - layer : layer === 3 ? 3 : 4][bitrate];
    const hz = [44100, 48000, 32000][rate] >> (first ? 0 : version === 2 ? 1 : 2);
    if (layer === 3) return (Math.floor((12000 * kbps) / hz) + padding) * 4;
    return Math.floor(((layer === 1 && !first ? 72000 : 144000) * kbps) / hz) + padding;
  };
  const length = frame(0);
  return length > 0 && frame(length) > 0;
}

/**
 * The description of an ICC colour profile (its `desc` tag, as plain text or as the first of
 * its translations), or null when the bytes are not a profile this function can read.
 */
export function iccDescription(profile) {
  const ascii = (from, to) => profile.subarray(from, to).toString('latin1');
  if (profile.length < 132 || ascii(36, 40) !== 'acsp') return null;
  const count = profile.readUInt32BE(128);
  if (count > 512 || 132 + 12 * count > profile.length) return null;
  for (let i = 0; i < count; i++) {
    const entry = 132 + 12 * i;
    if (ascii(entry, entry + 4) !== 'desc') continue;
    const offset = profile.readUInt32BE(entry + 4);
    const size = profile.readUInt32BE(entry + 8);
    if (size < 12 || offset + size > profile.length) return null;
    const data = profile.subarray(offset, offset + size);
    const type = data.subarray(0, 4).toString('latin1');
    if (type === 'desc') {
      const length = data.readUInt32BE(8);
      if (12 + length > data.length) return null;
      return data
        .subarray(12, 12 + length)
        .toString('latin1')
        .replace(/\0+$/, '');
    }
    if (type === 'mluc') {
      if (data.length < 28 || data.readUInt32BE(8) < 1) return null;
      const length = data.readUInt32BE(20);
      const start = data.readUInt32BE(24);
      if (length % 2 !== 0 || start + length > data.length) return null;
      // UTF-16, big end first.
      return Buffer.from(data.subarray(start, start + length))
        .swap16()
        .toString('utf16le')
        .replace(/\0+$/, '');
    }
    return null;
  }
  return null;
}

/** Why a colour profile is refused, or null: it cannot be read, or its name is not a standard one. */
function profileProblem(profile) {
  const description = profile === null ? null : iccDescription(profile);
  if (description === null) return 'a colour profile that cannot be read';
  if (ICC_DESCRIPTIONS.has(description)) return null;
  const name = description.replace(/[^\x20-\x7e]/g, '?').slice(0, 60);
  return `a colour profile named "${name}", which is not one of the standard colour spaces`;
}

/**
 * Formats this script cannot look into, by their first bytes: what the file is, in words, or
 * null. A file that is none of these and is not text is "a binary file of a kind this check
 * does not know" (see `checkFile`).
 */
export function uninspectedFormat(bytes) {
  const ascii = (from, to) => bytes.subarray(from, to).toString('latin1');
  const starts = (...values) => values.every((value, i) => bytes[i] === value);
  if (ascii(0, 5) === '%PDF-') return 'PDF';
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'GIF';
  if (ascii(0, 4) === 'RIFF' && bytes.length >= 12) {
    const form = ascii(8, 12);
    if (form === 'WEBP') return 'WebP';
    if (form === 'WAVE') return 'WAV';
    if (form === 'AVI ') return 'AVI';
    return 'a RIFF file';
  }
  if (ascii(0, 4) === 'II*\0' || ascii(0, 4) === 'MM\0*' || ascii(0, 4) === 'II+\0') return 'TIFF';
  if (ascii(4, 8) === 'ftyp') return 'HEIF, AVIF, MPEG-4 or QuickTime';
  if (['moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].includes(ascii(4, 8)) && bytes[0] === 0) {
    return 'QuickTime';
  }
  if (
    ascii(0, 2) === 'PK' &&
    bytes.length >= 4 &&
    [0x0304, 0x0506, 0x0708].includes(bytes.readUInt16BE(2))
  ) {
    return 'a zip archive (or an office document, a jar, an EPUB)';
  }
  if (starts(0x1f, 0x8b)) return 'gzip';
  if (ascii(0, 3) === 'BZh' && ascii(4, 10) === '1AY&SY') return 'bzip2';
  if (starts(0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00)) return 'xz';
  if (starts(0x28, 0xb5, 0x2f, 0xfd)) return 'Zstandard';
  if (starts(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return '7z';
  if (ascii(0, 4) === 'Rar!' && bytes[4] === 0x1a && bytes[5] === 0x07) return 'RAR';
  if (ascii(257, 262) === 'ustar') return 'tar';
  if (ascii(0, 4) === 'OggS') return 'Ogg';
  if (ascii(0, 4) === 'fLaC') return 'FLAC';
  if (ascii(0, 4) === 'FORM' && ['AIFF', 'AIFC'].includes(ascii(8, 12))) return 'AIFF';
  if (starts(0x1a, 0x45, 0xdf, 0xa3)) return 'Matroska or WebM';
  if (ascii(0, 4) === '8BPS') return 'a Photoshop document';
  // "BM" alone is two letters: a bitmap also has four zero bytes and a header of a known size.
  if (
    ascii(0, 2) === 'BM' &&
    bytes.length >= 18 &&
    bytes.readUInt32LE(6) === 0 &&
    [12, 40, 52, 56, 64, 108, 124].includes(bytes.readUInt32LE(14))
  ) {
    return 'BMP';
  }
  if (ascii(0, 4) === '\0asm') return 'WebAssembly';
  if (ascii(0, 8) === '!<arch>\n') return 'a static library or an ar archive';
  if (ascii(0, 16) === 'SQLite format 3\0') return 'an SQLite database';
  if (ascii(0, 8) === '\0\0\0\x01Bud1') return 'a .DS_Store file of the Finder';
  return null;
}

const hex = (n, width = 4) => `0x${n.toString(16).toUpperCase().padStart(width, '0')}`;

/** True when the bytes look like text to git: no zero byte among the first 8000. */
export function isText(bytes) {
  return !bytes.subarray(0, 8000).includes(0);
}

/**
 * The reasons a JPEG fails, as strings. Walks the segments from the start-of-image marker to
 * the end-of-image marker, through the compressed data of every scan.
 */
export function jpegProblems(bytes) {
  const problems = [];
  /** The pieces of the colour profile, by their number. */
  const profile = new Map();
  let profilePieces = 0;
  let at = 2;
  let ended = false;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) {
      problems.push(`not a marker at byte ${at}: the file is damaged or holds foreign data`);
      return problems;
    }
    // Fill bytes before a marker.
    while (at < bytes.length && bytes[at + 1] === 0xff) at += 1;
    const marker = bytes[at + 1];
    if (marker === undefined) break;
    at += 2;
    if (marker === 0xd9) {
      ended = true;
      break;
    }
    // Markers without a length: restart markers and TEM.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (at + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(at);
    const body = bytes.subarray(at + 2, at + length);
    const head = body.subarray(0, 32).toString('latin1');
    if (marker === 0xfe) {
      problems.push('a comment segment');
    } else if (marker >= 0xf0 && marker <= 0xfd) {
      // Markers the standard keeps in reserve: no picture needs one.
      problems.push(`a reserved segment (marker ${hex(0xff00 | marker)})`);
    } else if (marker >= 0xe0 && marker <= 0xef) {
      const n = marker - 0xe0;
      if (n === 0 && head.startsWith('JFIF\0')) {
        // The JFIF header may carry a thumbnail of its own: width and height at bytes 12, 13.
        if ((body[12] ?? 0) !== 0 || (body[13] ?? 0) !== 0) problems.push('a thumbnail (JFIF)');
        else if (body.length !== 14) {
          problems.push(`a JFIF header with ${body.length - 14} bytes that do not belong to it`);
        }
      } else if (n === 0 && head.startsWith('JFXX\0')) {
        problems.push('a thumbnail (JFIF extension)');
      } else if (n === 1 && head.startsWith('Exif\0\0')) {
        problems.push(...exifProblems(body.subarray(6)));
      } else if (n === 2 && head.startsWith('ICC_PROFILE\0')) {
        // A colour profile, in numbered pieces: looked at when all are in.
        profilePieces = body[13] ?? 0;
        profile.set(body[12] ?? 0, body.subarray(14));
      } else if (n === 14 && head.startsWith('Adobe')) {
        // Adobe's colour transform flag: twelve bytes, no more.
        if (body.length !== 12) {
          problems.push(`an Adobe segment with ${body.length - 12} bytes that do not belong to it`);
        }
      } else if (n === 1 && head.startsWith('http://ns.adobe.com/x')) {
        problems.push('an XMP packet (APP1)');
      } else if (n === 13 && head.startsWith('Photoshop')) {
        problems.push('Photoshop and IPTC records (APP13)');
      } else if (n === 2 && head.startsWith('MPF\0')) {
        problems.push('a multi-picture index (APP2 MPF): further pictures follow the first');
      } else {
        const label = head.replace(/[^\x20-\x7e].*$/s, '').slice(0, 24);
        problems.push(`an application segment APP${n}${label === '' ? '' : ` "${label}"`}`);
      }
    }
    at += length;
    if (marker === 0xda) {
      // Compressed data follows a start-of-scan: up to the next marker that is neither a
      // stuffed zero nor a restart marker.
      while (at < bytes.length) {
        const next = bytes.indexOf(0xff, at);
        if (next < 0) {
          at = bytes.length;
          break;
        }
        const after = bytes[next + 1];
        if (after === 0x00 || (after !== undefined && after >= 0xd0 && after <= 0xd7)) {
          at = next + 2;
        } else if (after === 0xff) {
          at = next + 1;
        } else {
          at = next;
          break;
        }
      }
    }
  }
  if (profile.size > 0) {
    const pieces = [];
    for (let i = 1; i <= profilePieces; i++) pieces.push(profile.get(i));
    const whole =
      profile.size === profilePieces && pieces.every((piece) => piece !== undefined)
        ? Buffer.concat(pieces)
        : null;
    const problem = profileProblem(whole);
    if (problem !== null) problems.push(problem);
  }
  if (!ended) {
    problems.push('no end-of-image marker: the file is cut short or damaged');
  } else if (at < bytes.length) {
    problems.push(`${bytes.length - at} bytes after the end of the image`);
  }
  return problems;
}

/** The reasons an Exif block (a TIFF structure) fails. */
function exifProblems(tiff) {
  const order = tiff.subarray(0, 2).toString('latin1');
  if (tiff.length < 14 || (order !== 'II' && order !== 'MM')) {
    return ['an Exif segment that cannot be read'];
  }
  const little = order === 'II';
  const u16 = (o) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const first = u32(4);
  if (first < 8 || first + 2 > tiff.length) return ['an Exif segment that cannot be read'];
  const count = u16(first);
  const end = first + 2 + 12 * count;
  if (end + 4 > tiff.length) return ['an Exif segment that cannot be read'];
  const problems = [];
  const others = [];
  const seen = new Set();
  /** Where the values stand that do not fit into their entry (the two resolutions). */
  const outside = [];
  for (let i = 0; i < count; i++) {
    const entry = first + 2 + 12 * i;
    const tag = u16(entry);
    const allowed = EXIF_ALLOWED.get(tag);
    if (allowed === undefined) {
      others.push(EXIF_NAMES.get(tag) ?? `tag ${hex(tag)}`);
      continue;
    }
    if (seen.has(tag)) {
      problems.push(`Exif holds ${allowed.name} more than once`);
      continue;
    }
    seen.add(tag);
    // One value of the tag's own type: a tag typed as text, or with a count, is room for more.
    if (u16(entry + 2) !== allowed.type || u32(entry + 4) !== 1) {
      problems.push(`Exif holds ${allowed.name} in another form than one value of its type`);
    } else if (allowed.type === SHORT) {
      // A short number fills two of the four bytes of its entry: the other two are zero.
      if (tiff[entry + 10] !== 0 || tiff[entry + 11] !== 0) {
        problems.push(`Exif holds two bytes beside the value of ${allowed.name}`);
      }
    } else {
      outside.push({ name: allowed.name, at: u32(entry + 8) });
    }
  }
  if (others.length > 0) problems.push(`Exif holds ${others.join(', ')}`);
  if (u32(end) !== 0) problems.push('Exif holds a second directory (a thumbnail)');
  // Every byte belongs to the header, to the directory or to one of the two resolutions.
  outside.sort((a, b) => a.at - b.at);
  let free = end + 4;
  for (const value of outside) {
    if (value.at !== free || value.at + 8 > tiff.length) {
      problems.push(`Exif holds ${value.name} with its value out of place`);
    } else {
      free += 8;
    }
  }
  const unreferenced = first - 8 + (tiff.length - free);
  if (problems.length === 0 && unreferenced > 0) {
    problems.push(`Exif holds ${unreferenced} bytes that no tag refers to`);
  }
  return problems;
}

/** The reasons a PNG fails. */
export function pngProblems(bytes) {
  const problems = [];
  const found = new Map();
  let at = 8;
  let ended = false;
  while (at + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString('latin1');
    if (type === 'iCCP') {
      // A colour profile: a label, a zero, the method of compression, the compressed profile.
      const data = bytes.subarray(at + 8, at + 8 + length);
      const zero = data.indexOf(0);
      const label = data.subarray(0, Math.max(zero, 0)).toString('latin1');
      let profile = null;
      try {
        profile = zero < 0 ? null : inflateSync(data.subarray(zero + 2));
      } catch {
        profile = null;
      }
      const problem = profileProblem(profile);
      if (problem !== null) problems.push(problem);
      else if (!ICC_LABELS.has(label) && !ICC_DESCRIPTIONS.has(label)) {
        const name = label.replace(/[^\x20-\x7e]/g, '?').slice(0, 60);
        problems.push(`a colour profile labelled "${name}"`);
      }
    } else if (!PNG_ALLOWED.has(type)) {
      const name = /^[A-Za-z]{4}$/.test(type) ? type : hex(bytes.readUInt32BE(at + 4), 8);
      found.set(name, (found.get(name) ?? 0) + 1);
    }
    at += 12 + length;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  for (const [type, n] of found) {
    const what = PNG_REFUSED.get(type) ?? 'not a part of the picture';
    problems.push(`${n === 1 ? 'a' : n} ${type} chunk${n === 1 ? '' : 's'} (${what})`);
  }
  if (!ended) problems.push('no IEND chunk: the file is cut short or damaged');
  else if (at < bytes.length)
    problems.push(`${bytes.length - at} bytes after the end of the image`);
  return problems;
}

/** The reasons an SVG fails: what a drawing program writes about the file and its author. */
export function svgProblems(text) {
  if (!/<svg[\s>]/.test(text.slice(0, 4000))) return [];
  const problems = [];
  if (/<metadata[\s>]/.test(text)) problems.push('a metadata element');
  if (/<(?:rdf:RDF|dc:[A-Za-z]+|cc:[A-Za-z]+)[\s>]/.test(text)) {
    problems.push('a description in RDF (who made it, when, under which licence)');
  }
  if (/(?:sodipodi:docname|inkscape:export-filename)\s*=/.test(text)) {
    problems.push('the name or the path of the file it was drawn in');
  }
  return problems;
}

/** What kind of compiled program the bytes are, or null. */
export function compiledKind(bytes) {
  if (bytes.length < 4) return null;
  const magic = bytes.readUInt32BE(0);
  if (
    magic === 0xfeedface ||
    magic === 0xfeedfacf ||
    magic === 0xcefaedfe ||
    magic === 0xcffaedfe
  ) {
    return 'Mach-O';
  }
  // A universal Mach-O and a Java class share their first four bytes: both are compiled.
  if (magic === 0xcafebabe || magic === 0xbebafeca) return 'Mach-O universal (or a Java class)';
  if (magic === 0x7f454c46) return 'ELF';
  if (bytes[0] === 0x4d && bytes[1] === 0x5a && bytes.length >= 0x40) {
    const pe = bytes.readUInt32LE(0x3c);
    if (pe + 4 <= bytes.length && bytes.subarray(pe, pe + 4).toString('latin1') === 'PE\0\0') {
      return 'PE (Windows)';
    }
  }
  return null;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = text.indexOf('\n'); i >= 0 && i < index; i = text.indexOf('\n', i + 1)) line += 1;
  return line;
}

/** Collects, per distinct match, the first place and the number of times it was found. */
function scan(text, patterns, textual, add) {
  for (const pattern of patterns) {
    const seen = new Map();
    for (const match of text.matchAll(pattern.regex)) {
      if (pattern.user !== undefined && isPlaceholderUser(match[pattern.user] ?? '')) continue;
      if (pattern.keep !== undefined && !pattern.keep(match)) continue;
      // What was found, as the text that is reported once however often it stands there.
      const found = pattern.found === undefined ? match[0] : pattern.found(match);
      const entry = seen.get(found);
      if (entry === undefined) seen.set(found, { index: match.index, count: 1, match });
      else entry.count += 1;
    }
    for (const [found, { index, count, match }] of seen) {
      add(pattern, found, index, count, textual, match);
    }
  }
}

/** Shows the start of a secret only, so that a log of this check does not repeat it. */
const masked = (secret) => `${secret.slice(0, 8)}… (${secret.length} characters)`;

/** The example files of an environment: they hold names and no values. */
const ENV_EXAMPLES = new Set(['.env.example', '.env.sample', '.env.template']);

/**
 * Checks one file. `path` is its path in the repository (forward slashes), `bytes` its
 * content, `size` its size when the content was not read in full. `options.allowed` is the
 * list of files that may be published although they cannot be looked into (path to SHA-256;
 * `ALLOWED_UNINSPECTED` unless given).
 *
 * Returns findings: `{ file, level: 'fail' | 'warn', reason }`, and on some of them `fix`,
 * which says how the file is made to pass (`fixCommands`).
 */
export function checkFile(path, bytes, size = bytes.length, options = {}) {
  const allowed = options.allowed ?? ALLOWED_UNINSPECTED;
  const findings = [];
  const fail = (reason, fix) =>
    findings.push({ file: path, level: 'fail', reason, ...(fix === undefined ? {} : { fix }) });
  const warn = (reason) => findings.push({ file: path, level: 'warn', reason });
  const mb = (size / (1024 * 1024)).toFixed(1);

  if (size > FAIL_BYTES) fail(`${mb} MB: over the limit of 50 MB`);
  else if (size > WARN_BYTES) warn(`${mb} MB: over 20 MB`);

  // The path of the file itself: a directory named after a home directory (the form in which a
  // tool writes a hyphen for every slash, for one) is published with every file under it.
  scan(`/${path}`, PATH_PATTERNS, false, (pattern, found) =>
    fail(`the path of the file: ${pattern.what}: ${found}`),
  );

  // Environment and login files, and key stores, by their names.
  const name = basename(path);
  if (
    name === '.env' ||
    name === '.envrc' ||
    /[.]env$/.test(name) ||
    (name.startsWith('.env.') && !ENV_EXAMPLES.has(name))
  ) {
    fail('an environment file: only .env.example may be published');
  }
  if (name === '.netrc' || name === '_netrc') fail('a login file (.netrc)');
  if (/[.](?:p12|pfx|jks|keystore)$/i.test(name)) fail('a key store');
  if (/[.]py[co]$/.test(name)) fail('a compiled program (Python bytecode)');
  if (ENV_EXAMPLES.has(name)) {
    const lines = bytes.toString('utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(\s*)(.*?)\s*$/.exec(line);
      if (match === null) return;
      const value = match[3];
      // Empty, an empty pair of quotation marks, or a comment after a blank.
      const empty =
        value === '' || value === '""' || value === "''" || (match[2] !== '' && value[0] === '#');
      if (!empty) fail(`line ${i + 1}: ${match[1]} has a value; ${name} holds names only`);
    });
  }

  const kind = compiledKind(bytes);
  if (kind !== null) fail(`a compiled program (${kind})`);

  // Pictures and sound, by their first bytes and not by their names.
  const textual = isText(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const problems = jpegProblems(bytes);
    // What ExifTool does not put right: a damaged file, a reserved segment.
    const beyond = problems.some((p) => /damaged|reserved segment/.test(p));
    const profile = problems.some((p) => p.startsWith('a colour profile'));
    for (const problem of problems) {
      fail(`JPEG metadata: ${problem}`, beyond ? 'again' : profile ? 'jpeg-plain' : 'jpeg');
    }
  } else if (bytes.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n') {
    const problems = pngProblems(bytes);
    // ExifTool removes text, Exif, the time and the colour profile; other chunks stay until
    // the picture is written again.
    const fix = problems.some((p) => p.includes('damaged'))
      ? 'again'
      : problems.some((p) => /not a part of the picture|a palette with a name/.test(p))
        ? 'png-again'
        : 'png';
    for (const problem of problems) fail(`PNG metadata: ${problem}`, fix);
  } else if (id3Frames(bytes) !== null) {
    const frames = id3Frames(bytes).filter((id) => !ID3_ALLOWED.has(id));
    if (frames.length > 0) {
      fail(`MP3 metadata: ID3 tags ${[...new Set(frames)].join(', ')}`, 'mp3');
    }
  } else if (isMpegAudio(bytes)) {
    // An MP3 without a tag: nothing to look at.
  } else if (kind === null) {
    const format =
      uninspectedFormat(bytes) ??
      (name === '.DS_Store' ? 'a .DS_Store file of the Finder' : null) ??
      (textual ? null : 'a binary file of a kind this check does not know');
    if (format !== null) {
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (allowed.get(path) !== sha256) {
        const why = allowed.has(path)
          ? 'its content is not the content that was allowed'
          : 'this check cannot look into it, and it is not on the list of files allowed all the same';
        fail(`${format}: ${why}`, { allow: sha256 });
      }
    }
  }
  const texts = [bytes.toString('latin1')];
  if (textual) for (const problem of svgProblems(texts[0])) fail(`SVG metadata: ${problem}`);

  // Paths and secrets, in the bytes as they are and, for a binary file, also read as 16-bit
  // text (every other byte zero).
  if (!textual) texts.push(texts[0].replaceAll('\0', ''));
  const reported = new Set();
  const report = (secret) => (pattern, found, index, count, asText, match) => {
    if (reported.has(found)) return;
    reported.add(found);
    const where = asText ? `line ${lineOf(texts[0], index)}: ` : '';
    const times = count > 1 ? ` (${count} times)` : '';
    // A secret is never printed whole: its start, or what its pattern chooses to show.
    const shown = pattern.show !== undefined ? pattern.show(match) : secret ? masked(found) : found;
    fail(`${where}${pattern.what}: ${shown}${times}`);
  };
  texts.forEach((text, i) => {
    scan(text, PATH_PATTERNS, textual && i === 0, report(false));
    scan(text, SECRET_PATTERNS, textual && i === 0, report(true));
  });
  return findings;
}

/** The files git would publish from `root`, as paths with forward slashes. */
export function publishedFiles(root) {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  return [
    ...new Set(
      out
        .toString('utf8')
        .split('\0')
        .filter((p) => p !== ''),
    ),
  ].sort();
}

/** Checks every file git would publish from `root`. `options` are those of `checkFile`. */
export function checkTree(root, options = {}) {
  const files = publishedFiles(root);
  const findings = [];
  let checked = 0;
  for (const file of files) {
    const full = join(root, file);
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      continue; // In the index and deleted from the working directory.
    }
    if (stat.isSymbolicLink()) {
      findings.push(
        ...checkFile(file, Buffer.from(readlinkSync(full)), undefined, options).map((f) => ({
          ...f,
          reason: `symbolic link: ${f.reason}`,
        })),
      );
    } else if (stat.isFile()) {
      // A file over the limit fails on its size; its content is not read.
      const bytes = stat.size > FAIL_BYTES ? Buffer.alloc(0) : readFileSync(full);
      findings.push(...checkFile(file, bytes, stat.size, options));
    } else {
      // A repository inside this one (a submodule, or a directory with a .git of its own).
      findings.push({
        file,
        level: 'warn',
        reason: 'a repository inside this one: its files are not looked at',
      });
      continue;
    }
    checked += 1;
  }
  return { files: checked, findings };
}

/** A path as a shell takes it: in single quotation marks when it holds anything unusual. */
const quoted = (path) =>
  /^[A-Za-z0-9_./+-]+$/.test(path) ? path : `'${path.replaceAll("'", `'\\''`)}'`;

/** A name for the file a command writes beside `path`: `a/b.png` gives `a/b.clean.png`. */
const beside = (path) => path.replace(/([.][A-Za-z0-9]+)?$/, (ext) => `.clean${ext}`);

/**
 * How the files that failed are made to pass, as lines to print: the exact command for every
 * picture and every MP3, and the line of the allow-list for a file that cannot be looked
 * into. Empty when no failure has such a cure.
 *
 * The commands are those of ExifTool and ffmpeg. They were tried with ExifTool 13.55 and
 * ffmpeg 7.1.1 on JPEGs and PNGs that carried a position, the camera, dates, an author,
 * comments, thumbnails, XMP, IPTC, text chunks, a time, a private chunk, a colour profile
 * under a name of its own and bytes after their end, and on an MP3 with an artist and a
 * title. What the commands left passed this check; where the pixels were compared (one JPEG,
 * two PNGs) they were the same as before.
 */
export function fixCommands(findings) {
  const fixes = new Map();
  for (const f of findings) {
    if (f.level === 'fail' && f.fix !== undefined && !fixes.has(f.file)) fixes.set(f.file, f.fix);
  }
  const of = (kind) => [...fixes].filter(([, fix]) => fix === kind).map(([file]) => file);
  const lines = [];
  const pictures = [...of('jpeg'), ...of('jpeg-plain'), ...of('png'), ...of('png-again')];
  if (pictures.length > 0) {
    lines.push(
      'To make these pictures pass, with ExifTool (https://exiftool.org). Each command rewrites',
      'the file in place. A JPEG keeps which way up it is and, where the check accepts it, its',
      'colour profile; a PNG loses its colour profile with the rest:',
    );
    for (const file of of('jpeg')) {
      lines.push(
        `  exiftool -all= -tagsfromfile @ -Orientation -icc_profile -overwrite_original ${quoted(file)}`,
      );
    }
    for (const file of of('jpeg-plain')) {
      lines.push(
        `  exiftool -all= -tagsfromfile @ -Orientation -overwrite_original ${quoted(file)}`,
      );
    }
    for (const file of of('png')) {
      lines.push(`  exiftool -all= -overwrite_original ${quoted(file)}`);
    }
    for (const file of of('png-again')) {
      // A chunk ExifTool does not know stays: write the picture again first.
      const clean = beside(file);
      lines.push(
        `  ffmpeg -y -i ${quoted(file)} -map_metadata -1 -bitexact ${quoted(clean)} && exiftool -all= -overwrite_original ${quoted(clean)} && mv ${quoted(clean)} ${quoted(file)}`,
      );
    }
  }
  if (of('mp3').length > 0) {
    lines.push(
      'To take the tags out of an MP3, with ffmpeg (the sound is copied, not encoded again):',
    );
    for (const file of of('mp3')) {
      const clean = beside(file);
      lines.push(
        `  ffmpeg -y -i ${quoted(file)} -map 0:a:0 -map_metadata -1 -c:a copy -bitexact ${quoted(clean)} && mv ${quoted(clean)} ${quoted(file)}`,
      );
    }
  }
  if (of('again').length > 0) {
    lines.push(
      'No command repairs a picture that is damaged or holds a reserved segment: save it again',
      `from an image program (${of('again').map(quoted).join(', ')}).`,
    );
  }
  if (lines.length > 0) lines.push('Then run the check again.');
  if (pictures.length > 0) {
    lines.push('And look at each picture itself: no command removes what a picture shows.');
  }
  const allow = [...fixes].filter(([, fix]) => typeof fix === 'object');
  if (allow.length > 0) {
    lines.push(
      'A file this check cannot look into: convert it to a format the check reads (a picture: JPEG',
      'or PNG; a document: text). If it has to be published as it is, look into it by other means,',
      'then add its line to ALLOWED_UNINSPECTED in scripts/check-hygiene.mjs in the same change:',
    );
    for (const [file, fix] of allow) {
      lines.push(`  [${JSON.stringify(file)}, '${fix.allow}'],`);
    }
  }
  return lines;
}

function main(argv) {
  let root = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = resolve(argv[++i] ?? '.');
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('usage: node scripts/check-hygiene.mjs [--root <directory>]');
      return 0;
    } else {
      console.error(`check-hygiene: unknown option ${argv[i]}`);
      return 2;
    }
  }
  let result;
  try {
    result = checkTree(root);
  } catch (error) {
    console.error(`check-hygiene: cannot list the files of ${root} (is it a git repository?)`);
    console.error(error instanceof Error ? error.message.split('\n')[0] : String(error));
    return 2;
  }
  const fails = result.findings.filter((f) => f.level === 'fail');
  const warns = result.findings.filter((f) => f.level === 'warn');
  for (const f of warns) console.log(`warning  ${f.file}: ${f.reason}`);
  for (const f of fails) console.log(`FAIL     ${f.file}: ${f.reason}`);
  const cures = fixCommands(fails);
  if (cures.length > 0) console.log(`\n${cures.join('\n')}\n`);
  const failedFiles = new Set(fails.map((f) => f.file)).size;
  console.log(
    `hygiene: ${result.files} files checked, ${fails.length} failure${fails.length === 1 ? '' : 's'}` +
      ` in ${failedFiles} file${failedFiles === 1 ? '' : 's'}, ${warns.length} warning${warns.length === 1 ? '' : 's'}`,
  );
  return fails.length > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
