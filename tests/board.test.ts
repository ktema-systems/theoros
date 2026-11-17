// The board is assembled from the project folders, so what is committed has to be what the folders say.
//
// The folders are the source and `projects.json` is the artifact. A path edited in the artifact and not in a folder
// survives until a page renders nothing, which is why the artifact is checked rather than trusted.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('the committed board is the one the folders assemble', () => {
  // The generator is the one implementation of the assembly, so the check asks it rather than restating it here.
  expect(() => execFileSync(process.execPath, ['tools/board.mjs', '--check'], { cwd: ROOT })).not.toThrow();
});

test('the run the project names is a file it reads', () => {
  const board = JSON.parse(readFileSync(`${ROOT}projects.json`, 'utf8')) as {
    projects: { id: string; resources: { kind: string; at: unknown }[] }[];
  };
  for (const project of board.projects) {
    const runs = project.resources
      .filter((resource) => resource.kind === 'record' && typeof resource.at === 'string')
      .map((resource) => resource.at as string);
    expect(runs.length, `${project.id} names a run`).toBeGreaterThan(0);
    for (const run of runs) expect(existsSync(`${ROOT}${run}`), `${project.id} names ${run}`).toBe(true);
  }
});
