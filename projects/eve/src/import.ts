// Write the run a capture is, and read it back before it is kept.
//
//   npx tsx projects/eve/src/import.ts projects/eve/capture/new-eden.json
//
// The capture is read, the run is written beside it in the project folder, and then it is parsed: a run whose verbs the
// reader does not model, or whose counts do not derive, is a failure rather than a file.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScenario } from '@ssccsorg/skene-kernel';
import { runOf, type Capture } from './mapping';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..', '..');

const source = process.argv[2];
if (!source) {
  console.error('usage: tsx projects/eve/src/import.ts <capture.json>');
  process.exit(2);
}

const capturePath = resolve(APP, source);
const capture = JSON.parse(readFileSync(capturePath, 'utf8')) as Capture;
const run = runOf(capture);
// The run stands in the project folder, beside the capture's own directory: a project package is one folder.
const out = join(dirname(capturePath), '..', 'scenario.txt');

// The run is read before it is kept: a file that does not parse, or whose counts do not derive, is not written.
const parsed = (() => {
  try {
    return parseScenario(run);
  } catch (error) {
    console.error(`the run does not parse: ${error instanceof Error ? error.message : String(error)}`);
    return process.exit(1);
  }
})();
if (parsed.unknown.length) {
  console.error(`the run uses verbs the reader does not model: ${parsed.unknown.join(', ')}`);
  process.exit(1);
}
for (const check of parsed.checks) {
  if (check.derived !== check.expected) {
    console.error(`the count at ${check.at}s says ${check.expected}, the reader derived ${check.derived}`);
    process.exit(1);
  }
}
writeFileSync(out, run);
console.log(`wrote ${out}: ${parsed.records.length} records, ${parsed.checks.length} counts`);
