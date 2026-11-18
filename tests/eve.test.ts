// One project a system, and every run a system's own.
//
// The board is The Forge as ESI answered it: ninety systems, each a project of its own, so the frame's minimap is the
// travel between systems and the rail is the region's list. What this holds is the split: the folders the board names,
// the run each one carries, the place it stands in, and the two projects whose story is not just their security.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import '@ssccsorg/skene-frame';
import '@ssccsorg/skene-view-shell';
import { declaredReadings, landingOf } from '@ssccsorg/skene-frame/lib/readings';
import { seatOf, standing } from '@ssccsorg/skene-frame/lib/packs';
import type { Views } from '@ssccsorg/skene-kernel';
import { parseScenario, chainFor } from '@ssccsorg/skene-kernel';
import { runOf as mapped, type Capture } from '../src/mapping';
import '../src/space';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The pilot a name is a unit under, in the place's own spelling. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const board = JSON.parse(readFileSync(`${ROOT}projects.json`, 'utf8')) as {
  projects: { id: string; resources: { kind: string; at: unknown }[] }[];
};

const specification = JSON.parse(readFileSync(`${ROOT}projects/board.json`, 'utf8')) as {
  opens: string;
  order: string[];
};

interface System {
  id: number;
  name: string;
  sec: number;
  gates: number;
  stations: number;
}

interface Unit {
  icon: string;
  label?: string;
  role?: string;
  at: { record: [number, number] };
}

const systems = JSON.parse(readFileSync(`${ROOT}capture/systems.json`, 'utf8')) as System[];

/** What each system holds, so a run's counts are the capture's own and not a number written twice. */
const held = (
  JSON.parse(readFileSync(`${ROOT}capture/units.json`, 'utf8')) as {
    systems: Record<
      string,
      {
        star: { temperature: number };
        planets: { moons: unknown[]; belts: unknown[] }[];
      }
    >;
  }
).systems;

/** The kills the fleet is read from, and the names ESI answers for every id they carry. */
const FLEET = JSON.parse(readFileSync(`${ROOT}capture/fleet.json`, 'utf8')) as {
  kills: { attackers: { character_id?: number; ship_type_id: number; damage_done: number }[] }[];
  names: Record<string, string>;
};

const viewsOf = (id: string): Views | undefined =>
  board.projects
    .find((project) => project.id === id)
    ?.resources.find((resource) => resource.kind === 'views')?.at as Views | undefined;

const placeOf = (id: string) =>
  board.projects
    .find((project) => project.id === id)
    ?.resources.find((resource) => resource.kind === 'place')?.at as
    | { sector: [number, number]; units: Record<string, Unit> }
    | undefined;

const runOf = (id: string) => readFileSync(`${ROOT}projects/${id}/run.txt`, 'utf8');

/** The roster the kills carry: one entry a pilot, with the damage of every kill they answered in. */
const roster = (() => {
  const damage = new Map<number, number>();
  for (const kill of FLEET.kills) {
    for (const attacker of kill.attackers) {
      if (!attacker.character_id) continue;
      damage.set(attacker.character_id, (damage.get(attacker.character_id) ?? 0) + attacker.damage_done);
    }
  }
  return [...damage.entries()]
    .map(([id, total]) => ({ id, name: FLEET.names[String(id)] ?? String(id), damage: total }))
    .sort((left, right) => right.damage - left.damage);
})();

const seatOfProject = (id: string) => {
  const views = viewsOf(id);
  return seatOf(standing(declaredReadings(), { views }), views);
};

test('the region is a pane beside the shell, and the seat stays the frame own', () => {
  // The shell is still the seat and still the default sphere. The region is a pane of the same space: the frame sizes it
  // the way it sizes Kwai Tsing's map, and the project opens on the sphere with the region standing beside it.
  const views = viewsOf('jita');
  const readings = standing(declaredReadings(), { views });
  expect(seatOfProject('jita')?.key, 'the seat is the shell').toBe('shell');
  expect(readings.find((reading) => reading.pane)?.key, 'the region is the pane').toBe('eve-space');
  expect(readings.some((reading) => reading.key === 'shell'), 'and the sphere stands beside it').toBe(true);
  expect(landingOf(readings, views, null)?.key, 'the project opens on the sphere').toBe('shell');
});

test('the board is the region, one project a system', () => {
  // The folders are the source: a system the capture holds is a project, and a project is a system the capture holds.
  const wanted = systems.map((system) => slug(system.name)).sort();
  expect(board.projects.map((project) => project.id).sort(), 'every system and nothing else').toEqual(wanted);
  expect(specification.order.slice().sort(), 'the board names them all').toEqual(wanted);
  expect(specification.opens, 'the market is what a bare address opens on').toBe('jita');
});

test('a project is its own system, named and stood where the capture puts it', () => {
  for (const system of systems) {
    const id = slug(system.name);
    const unit = placeOf(id)?.units[id];
    expect(unit?.icon, `${id} stands a system`).toBe('system');
    expect(unit?.label, `${id} is named`).toBe(system.name);
    expect(placeOf(id)?.sector, `${id} has a bearing`).toEqual(expect.any(Array));
  }
});

test('the deployment installs the reading it names', () => {
  expect(readFileSync(`${ROOT}src/main.tsx`, 'utf8'), 'the entry installs the reading').toContain("'./space'");
});

test('every run parses, counts what it wrote, and stands on units of its own place', () => {
  // A run is the project's own reading, and a record whose origin is not a unit has nowhere to stand on the board.
  for (const project of board.projects) {
    const text = runOf(project.id);
    const parsed = parseScenario(text);
    expect(parsed.unknown, `${project.id} uses verbs the reader models`).toEqual([]);
    for (const check of parsed.checks) {
      expect(check.derived, `${project.id} counts ${check.expected} at ${check.at}s`).toBe(check.expected);
    }
    const units = placeOf(project.id)?.units ?? {};
    for (const record of parsed.records) {
      if (!record.origin) continue;
      const unit = record.origin.split('/')[0] ?? record.origin;
      expect(units[unit], `${project.id} reads ${record.origin}, and no unit stands there`).toBeDefined();
    }
  }
});

test('a system measures its own security, gates and stations', () => {
  for (const system of systems) {
    const id = slug(system.name);
    // Jita's run is the market's, so its own numbers carry its name rather than the system's three labels.
    const label = (name: string) => (id === 'jita' ? `jita-${name}` : name);
    const parsed = parseScenario(runOf(id));
    const measured = (name: string) =>
      parsed.records.find((record) => record.label === label(name))?.measure;
    expect(measured('security')?.value, `${system.name} security`).toBe(system.sec);
    expect(measured('gates')?.value, `${system.name} gates`).toBe(system.gates);
    expect(measured('stations')?.value, `${system.name} stations`).toBe(system.stations);
  }
});

test('a system measures what it holds below the gates and stations', () => {
  for (const system of systems) {
    // Jita's run is the market's, so the system's own counts are not on it.
    if (slug(system.name) === 'jita') continue;
    const one = held[String(system.id)];
    expect(one, `${system.name} is not in capture/units.json`).toBeDefined();
    const parsed = parseScenario(runOf(slug(system.name)));
    const measured = (name: string) =>
      parsed.records.find((record) => record.label === name)?.measure;
    expect(measured('planets')?.value, `${system.name} planets`).toBe(one.planets.length);
    expect(measured('moons')?.value, `${system.name} moons`).toBe(
      one.planets.reduce((count, planet) => count + planet.moons.length, 0),
    );
    expect(measured('belts')?.value, `${system.name} belts`).toBe(
      one.planets.reduce((count, planet) => count + planet.belts.length, 0),
    );
    expect(measured('star-temperature')?.value, `${system.name} star`).toBe(one.star.temperature);
  }
});

test('the run the board names is the one the capture maps to', () => {
  const capture = JSON.parse(readFileSync(`${ROOT}capture/new-eden.json`, 'utf8')) as Capture;
  expect(runOf('jita')).toBe(mapped(capture));
});

// A market fact reports what it observed, and a payload size is the wrong reading for it: the inspector's numeric row
// says "bytes", which a traded volume is not. This is what keeps the two apart as far as the board.
test('the market facts carry a measurement rather than a payload size', () => {
  const { records } = parseScenario(runOf('jita'));
  const spike = records.find((record) => record.label === 'spike-volume');
  expect(spike?.measure, 'the day is a measurement').toEqual({ value: 23321824662, unit: 'units' });
  expect(spike?.bytes, 'and not a payload').toBeUndefined();
  const ask = records.find((record) => record.label === 'best-ask');
  expect(ask?.measure).toEqual({ value: 4.19, unit: 'isk' });
});

test('the fleet is the one the kills carry, pilot by pilot', () => {
  // A roster written for the demonstration would be a name nobody can check. Akkio's people are the pilots ESI answers
  // for, and the one in charge is the pilot whose damage across both kills was the most.
  const units = Object.values(placeOf('akkio')?.units ?? {});
  const people = units.filter((unit) => unit.icon === 'person');
  expect(people.map((unit) => unit.label).sort(), 'the pilots the kills name').toEqual(
    roster.map((pilot) => pilot.name).sort(),
  );
  expect(
    people.filter((unit) => unit.role === 'admin').map((unit) => unit.label),
    'one in charge, and it is the pilot who did the most of it',
  ).toEqual([roster[0]?.name]);
  expect(
    units
      .filter((unit) => unit.icon === 'hauler')
      .map((unit) => unit.label)
      .sort(),
    'and the hulls they flew are a place of their own',
  ).toEqual(['Retribution', 'Stiletto', 'Svipul']);
});

test('the audit chain starts at the measurement and ends at the finding', () => {
  const { records } = parseScenario(runOf('jita'));
  const [chain, ...rest] = chainFor(records);
  expect(rest, 'the run declares one piece of work').toEqual([]);
  expect(chain.from?.label, 'the work starts at the measured day').toBe('spike-volume');
  expect(chain.worker, 'and the pilot the capture names takes it').toBe('saltyfish11');
  expect(chain.produced?.content, 'and the finding is written down').toBe('size-not-breadth');
});
