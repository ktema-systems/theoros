// Assemble the board from the project folders.
//
// A project is one folder: `projects/<id>/project.json` is its entry, and `projects/board.json` names the order. The board
// the frame reads is generated from the two, so adding or removing a project is one folder and one line.
//
// `--check` answers whether the committed board is what the folders say, which is what `tests/board.test.ts` asks: a
// board edited by hand instead of regenerated is the drift this exists to catch.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SPEC = join(ROOT, 'projects', 'board.json');
const BOARD = join(ROOT, 'projects.json');

/** The board the folders declare, or the name that made it impossible. */
function assemble() {
  const spec = JSON.parse(readFileSync(SPEC, 'utf8'));

  const projects = new Map();
  for (const entry of readdirSync(join(ROOT, 'projects'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(ROOT, 'projects', entry.name, 'project.json');
    if (!existsSync(path)) continue;
    const project = JSON.parse(readFileSync(path, 'utf8'));
    if (projects.has(project.id)) {
      throw new Error(`two folders declare ${project.id}: ${entry.name} and the one before it`);
    }
    projects.set(project.id, project);
  }

  for (const id of spec.order) {
    if (!projects.has(id)) throw new Error(`the board names ${id}, and no project.json declares it`);
  }
  for (const id of projects.keys()) {
    if (!spec.order.includes(id)) throw new Error(`${id} is packaged, and the board does not name it`);
  }
  // The project the bare demonstration address opens on. It lives here rather than in an entry so that no entry names
  // a project, and a board exported without that project fails here instead of opening on nothing.
  if (spec.opens !== undefined && !projects.has(spec.opens)) {
    throw new Error(`the board opens on ${spec.opens}, and no project.json declares it`);
  }

  return { note: spec.note, projects: spec.order.map((id) => projects.get(id)) };
}

const text = `${JSON.stringify(assemble(), null, 2)}\n`;

if (process.argv.includes('--check')) {
  const committed = existsSync(BOARD) ? readFileSync(BOARD, 'utf8') : '';
  if (committed !== text) {
    console.error('projects.json is not what the folders say: run `npm run board`');
    process.exit(1);
  }
  console.log('projects.json matches the folders');
} else {
  writeFileSync(BOARD, text);
  console.log(`wrote projects.json: ${JSON.parse(text).projects.length} projects`);
}
