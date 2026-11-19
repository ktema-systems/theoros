// What the deployed bundle is allowed to carry, and the notice it carries it with.
//
// The board is published as static files, so everything npm installs for production is in the artifact a reader loads.
// A licence that asks for more than attribution would make that artifact's terms someone else's, and the deployment is
// where it leaves this repository: the check runs in the build and before a publish, and a package it does not recognise
// stops the run rather than passing quietly.
//
// The allowlist is what the board may be built from, not what it happens to use: a dependency added later is a line here
// that someone argued for.
//
//   npm run licenses                                  the check alone
//   node tools/licenses.mjs --notices dist/third-party.txt   the check, and the notice the licences ask for
//
// Reads the lockfile rather than the tree, so the answer is the artifact's and not this machine's.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';

/**
 * The licences a published board may carry: attribution and no more.
 *
 * PSF-2.0 is argparse's, which markdown-it reaches for, and it is permissive in the same way the rest are: the copyright
 * line and the licence text travel with the code, which is what the notice file below is.
 */
const ALLOWED = new Set([
  '0BSD',
  'Apache-2.0',
  'Apache-2.0 WITH LLVM-exception',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'PSF-2.0',
  'Unlicense',
]);

/** A licence field as the ids it offers, which is how `MIT OR Apache-2.0` is read. */
function idsOf(field) {
  if (typeof field === 'string') {
    return field
      .replace(/[()]/g, ' ')
      .split(/\s+(?:OR|AND)\s+/i)
      .map((part) => part.trim().replace(/\*$/, ''))
      .filter(Boolean);
  }
  if (field && typeof field === 'object' && typeof field.type === 'string') return idsOf(field.type);
  return [];
}

/** The licence text a package ships, or nothing when it ships none. */
function textOf(path) {
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING']) {
    const file = join(ROOT, path, name);
    if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  }
  return '';
}

const noticesAt = (() => {
  const at = process.argv.indexOf('--notices');
  return at === -1 ? null : process.argv[at + 1];
})();

const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
const packages = Object.entries(lock.packages ?? {}).filter(([path]) => path.startsWith('node_modules/'));

const carried = [];
const refused = [];

for (const [path, entry] of packages) {
  // Development packages are not in the bundle. `devOptional` is a package the tree may resolve either way, and a
  // deployment cannot know which, so it is read as carried.
  if (entry.dev === true) continue;
  const manifest = join(ROOT, path, 'package.json');
  const declared = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).license : entry.license;
  const ids = idsOf(declared);
  const name = entry.name ?? path.replace(/^node_modules\//, '');
  const version = entry.version ?? '';
  const line = `${name}@${version}`;
  if (!ids.length) {
    refused.push(`${line}: no licence declared (${path})`);
  } else if (!ids.some((id) => ALLOWED.has(id))) {
    refused.push(`${line}: ${ids.join(', ')} (${path})`);
  } else {
    carried.push({ line, licence: ids.join(' OR '), text: textOf(path) });
  }
}

const counts = new Map();
for (const each of carried) counts.set(each.licence, (counts.get(each.licence) ?? 0) + 1);

console.log(`licences: ${carried.length} production packages`);
for (const [licence, count] of [...counts].sort((left, right) => right[1] - left[1])) {
  console.log(`  ${String(count).padStart(3)}  ${licence}`);
}

if (noticesAt) {
  const body = carried
    .sort((left, right) => left.line.localeCompare(right.line))
    .map((each) => `${each.line} (${each.licence})\n\n${each.text || '(no licence text shipped with the package)'}\n`)
    .join('\n');
  writeFileSync(
    noticesAt,
    [
      'The board carries the packages below. Each is listed with the licence it declares and the text it ships,',
      'because attribution and the licence text are what the permissive licences here ask a redistribution to keep.',
      '',
      body,
    ].join('\n'),
  );
  console.log(`licences: notice written to ${noticesAt}`);
}

if (refused.length) {
  console.error(`\nlicences: ${refused.length} package(s) the board may not carry`);
  for (const line of refused) console.error(`  ${line}`);
  console.error('\nAdd the licence to ALLOWED in tools/licenses.mjs only if the deployment can carry it.');
  process.exit(1);
}
