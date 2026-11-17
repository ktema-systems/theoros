// One project a star system: the region is the board, and a system is a place.
//
// `capture/systems.json` is every system The Forge holds, as ESI answered it, and this writes the folder each of them is:
// `projects/<slug>/project.json` and the run beside it. A run is built by the one mapping (`src/mapping`) and parsed
// before the folder is kept, so a count is the mapping's and a verb this build does not model fails here.
//
//   npm run systems
//
// Jita is the one system whose run is not its own security: `capture/new-eden.json` is the market question, and the units
// it names stand in Jita's place. The fleet stands in Akkio, the system the kills were read in.
//
// The last thing written is `projects/board.json`, so the rail is the systems the source holds rather than a list kept
// by hand.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScenario } from '@ssccsorg/skene-kernel';
import { runOf, type Capture, type Scene, type Step } from '../src/mapping';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const PROJECTS = join(APP, 'projects');

interface System {
  id: number;
  name: string;
  sec: number;
  x: number;
  y: number;
  z: number;
  gates: number;
  stations: number;
}

interface Fleet {
  system: { id: number; name: string };
  kills: {
    id: number;
    attackers: { character_id?: number; ship_type_id: number; damage_done: number }[];
  }[];
  names: Record<string, string>;
}

interface Unit {
  icon: string;
  label: string;
  role?: string;
  abilities?: string[];
  at: { record: [number, number] };
}

interface Pilot {
  id: string;
  name: string;
  hull: string;
  damage: number;
}

const systems = JSON.parse(readFileSync(join(APP, 'capture', 'systems.json'), 'utf8')) as System[];
const fleet = JSON.parse(readFileSync(join(APP, 'capture', 'fleet.json'), 'utf8')) as Fleet;
const market = JSON.parse(readFileSync(join(APP, 'capture', 'new-eden.json'), 'utf8')) as Capture;

const WEB = 'https://esi.evetech.net/latest';
const SYSTEMS_PIN = { source: 'esi', endpoint: WEB, revision: 'server-3698585/2026-11-15', adapter: 'eve/1' };
const FLEET_PIN = { source: 'esi', endpoint: WEB, revision: 'server-3707965/2026-11-17', adapter: 'eve/1' };

/** The place every unit is laid in: one box for the region, so a body keeps its offset across a regeneration. */
const VIEW: [number, number, number, number] = [0, 0, 520, 176];
/** The middle of the box, which is where a system's own star stands: the place is the system's space. */
const MIDDLE: [number, number] = [260, 88];
/** How much of the shell the region covers, in degrees: the board's own patch, read by the frame's minimap. */
const ACROSS = 120;
const UP = 80;

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const [, , width, height] = VIEW;
const span = (values: number[]) => [Math.min(...values), Math.max(...values)];
const [minX, maxX] = span(systems.map((system) => system.x));
const [minZ, maxZ] = span(systems.map((system) => system.z));

/** Where the system stands on the shell, in degrees: the region laid on a patch the minimap can read. */
function sectorOf(system: System): [number, number] {
  const across = (system.x - minX) / (maxX - minX);
  const north = (system.z - minZ) / (maxZ - minZ);
  return [Number(((across - 0.5) * ACROSS).toFixed(3)), Number(((north - 0.5) * UP).toFixed(3))];
}

const nameOf = (id: number) => fleet.names[String(id)] ?? String(id);

// The fleet, as ESI answered it: one pilot a character, with the hull they flew and the damage of every kill they answered
// in. The Serpentis patrols in the same kills carry no character and are not the fleet.
const pilots = new Map<number, Pilot>();
for (const kill of fleet.kills) {
  for (const attacker of kill.attackers) {
    if (!attacker.character_id) continue;
    const seen = pilots.get(attacker.character_id);
    if (seen) {
      seen.damage += attacker.damage_done;
      continue;
    }
    pilots.set(attacker.character_id, {
      id: slug(nameOf(attacker.character_id)),
      name: nameOf(attacker.character_id),
      hull: nameOf(attacker.ship_type_id),
      damage: attacker.damage_done,
    });
  }
}
const roster = [...pilots.values()].sort((left, right) => right.damage - left.damage);
const commander = roster[0];
const hulls = [...new Set(roster.map((pilot) => pilot.hull))].sort();

/** The units the market capture names, which are the ones its run carries a record about. */
const namedByMarket = new Set<string>();
for (const scene of market.scenes) {
  for (const step of scene.steps) {
    for (const arg of step.args) {
      const origin = /^([a-z0-9-]+)\/[a-z0-9-]+$/.exec(arg);
      if (origin?.[1]) namedByMarket.add(origin[1]);
    }
  }
}

/**
 * The units Jita's place adds beyond the systems its run names: the station the order stands at and the pilot who takes
 * the work.
 */
const MARKET_CAST: { id: string; icon: string; label: string; role?: string; offset: [number, number] }[] = [
  { id: 'jita-4-4', icon: 'station', label: 'Jita IV-4', offset: [10, -9] },
  { id: 'saltyfish11', icon: 'person', label: 'saltyfish11', role: 'admin', offset: [26, 4] },
];

const KINDS = {
  station: ['reads', 'writes'],
  gate: ['reads', 'writes'],
  hauler: ['reads', 'writes', 'emits'],
  person: ['person'],
  system: ['reads', 'writes'],
};

/** The abilities the kinds read and write through, and the record every unit keeps. */
const ABILITIES = [
  'console',
  'order-read',
  'order-fill',
  'gate-open',
  'traffic-read',
  'dock-at',
  'work-declare',
  'corridor-hold',
  'jump-run',
  'record',
];

/** The views a system stands: the sphere, the region drawn beside it, and the frame's own readings. */
const VIEWS = { seat: 'shell', on: ['eve-space', 'shell', 'records', 'graph', 'intents', 'act'] };

/** Clamp a unit to the box, so a fleet at a system near the edge is still drawn inside the patch. */
const inside = ([x, y]: [number, number]): [number, number] => [
  Math.min(Math.max(x, 10), width - 10),
  Math.min(Math.max(y, 10), height - 10),
];

const offsetOf = (home: [number, number], [dx, dy]: [number, number]) => inside([home[0] + dx, home[1] + dy]);

/** The place a system is: its star, and whatever the board stands there. */
function placeOf(system: System) {
  const id = slug(system.name);
  const at = MIDDLE;
  const units: Record<string, Unit> = { [id]: { icon: 'system', label: system.name, at: { record: at } } };

  if (system.name === fleet.system.name) {
    // The fleet stands in the system it fought in. The formation falls to the left of the star so a name beside it is not
    // cut off by the patch.
    roster.forEach((pilot, index) => {
      units[pilot.id] = {
        icon: 'person',
        label: pilot.name,
        role: pilot === commander ? 'admin' : 'member',
        at: { record: offsetOf(at, [-34 + (index % 4) * 22, -26 + Math.floor(index / 4) * 20]) },
      };
    });
    hulls.forEach((hull, index) => {
      units[slug(hull)] = { icon: 'hauler', label: hull, at: { record: offsetOf(at, [-92, -20 + index * 24]) } };
    });
  }

  if (id === 'jita') {
    // The systems the market run reads are Jita's neighbours, drawn as a ring around the star: the place is Jita's own
    // space, and a system beside it is reached through a gate rather than stood at its region coordinate.
    const ring = [...namedByMarket]
      .filter((origin) => origin !== id && systems.some((entry) => slug(entry.name) === origin))
      .sort();
    ring.forEach((origin, index) => {
      const angle = (index / ring.length) * Math.PI * 2;
      const system = systems.find((entry) => slug(entry.name) === origin)!;
      units[origin] = {
        icon: 'system',
        label: system.name,
        at: { record: offsetOf(at, [Math.round(Math.cos(angle) * 48), Math.round(Math.sin(angle) * 38)]) },
      };
    });
    for (const cast of MARKET_CAST) {
      units[cast.id] = {
        icon: cast.icon,
        label: cast.label,
        ...(cast.role ? { role: cast.role } : {}),
        ...(cast.id === 'jita-4-4' ? { abilities: ['order-read', 'order-fill'] } : {}),
        at: { record: offsetOf(at, cast.offset) },
      };
    }
  }

  return {
    view: VIEW,
    sector: sectorOf(system),
    store: { label: system.name },
    areas: [{ x: 0, y: 0, w: width, h: height, label: system.name }],
    units,
  };
}

/** The run a system is, as the scenario language writes it. */
function captureOf(system: System): Capture {
  const id = slug(system.name);
  const scene: Scene = {
    at: 0,
    note: `00:00 ${system.name} is read.`,
    steps: [
      { verb: 'measured', args: ['security', String(system.sec), 'rating', `${id}/system`] },
      { verb: 'measured', args: ['gates', String(system.gates), 'gates', `${id}/system`] },
      { verb: 'measured', args: ['stations', String(system.stations), 'stations', `${id}/system`] },
    ],
  };
  const scenes: Scene[] = [scene];
  if (system.name === fleet.system.name) {
    const steps: Step[] = [
      { verb: 'measured', args: ['fleet-pilots', String(roster.length), 'pilots', `${id}/fleet`] },
      { verb: 'measured', args: ['fleet-kills', String(fleet.kills.length), 'hulls', `${id}/fleet`] },
    ];
    scenes.push({
      at: 600,
      note: `00:10 The fleet: ${roster.length} pilots, from killmails ${fleet.kills.map((kill) => kill.id).join(' and ')}, read on 2026-11-17 (server 3707965).`,
      steps,
    });
  }
  return {
    pin: SYSTEMS_PIN,
    title: `${system.name}, The Forge.`,
    introduction: [
      'Read from ESI on 2026-11-15, while server 3698585 ran. Security, gates and stations are this system.',
      ...(system.name === fleet.system.name
        ? [`The fleet: source=${FLEET_PIN.source} endpoint=${FLEET_PIN.endpoint} revision=${FLEET_PIN.revision} adapter=${FLEET_PIN.adapter}`]
        : []),
    ],
    seed: 7,
    scenes,
  };
}

/** A run is read before it is kept: a verb this build does not model, or a count that does not derive, is a failure. */
function checked(text: string, who: string): string {
  const parsed = parseScenario(text);
  if (parsed.unknown.length) throw new Error(`${who} uses verbs the reader does not model: ${parsed.unknown.join(', ')}`);
  for (const check of parsed.checks) {
    if (check.derived !== check.expected) {
      throw new Error(`${who} counts ${check.expected} at ${check.at}s, and the reader derives ${check.derived}`);
    }
  }
  return text;
}

const document = (id: string, system: System) => ({
  id,
  resources: [
    { kind: 'abilities', at: ABILITIES },
    { kind: 'channel', at: 'sim' },
    { kind: 'kinds', at: KINDS },
    { kind: 'record', at: `projects/${id}/run.txt` },
    { kind: 'views', at: VIEWS },
    { kind: 'clock', at: { record: `00:00, ${system.name} is read` } },
    { kind: 'status', at: system.name === fleet.system.name ? 'running' : 'idle' },
    { kind: 'place', at: placeOf(system) },
  ],
});

const seen = new Set<string>();
const written: string[] = [];
for (const system of systems) {
  const id = slug(system.name);
  if (seen.has(id)) throw new Error(`two systems answer to ${id}, and a project is one folder`);
  seen.add(id);
  const folder = join(PROJECTS, id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'project.json'), `${JSON.stringify(document(id, system), null, 2)}\n`);
  const capture = id === 'jita' ? market : captureOf(system);
  const run = checked(runOf(capture), `projects/${id}/run.txt`);
  writeFileSync(join(folder, 'run.txt'), run);
  written.push(id);
}

// A folder this generator no longer writes is a system the source no longer holds.
for (const entry of readdirSync(PROJECTS, { withFileTypes: true })) {
  if (!entry.isDirectory() || written.includes(entry.name)) continue;
  rmSync(join(PROJECTS, entry.name), { recursive: true });
}

const order = systems.map((system) => slug(system.name));
writeFileSync(
  join(PROJECTS, 'board.json'),
  `${JSON.stringify(
    {
      note: 'One project a star system: the region is the board, and the frame\'s minimap is the travel between systems.',
      opens: 'jita',
      order,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${written.length} system projects and a board of ${order.length}, every run parsed`);
