// The Jita corridor's own sphere.
//
// The project names its seat, so the frame asks the project rather than the register. What this holds is that the
// board's declaration resolves to the custom sphere and that every other project keeps the frame's own.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import '@ssccsorg/skene-frame';
import '@ssccsorg/skene-view-shell';
import { declaredReadings, landingOf } from '@ssccsorg/skene-frame/lib/readings';
import { seatOf, standing } from '@ssccsorg/skene-frame/lib/packs';
import type { Views } from '@ssccsorg/skene-kernel';
import { parseScenario, chainFor } from '@ssccsorg/skene-kernel';
import { runOf, type Capture } from '../projects/eve/src/mapping';
import '../projects/eve/src';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const board = JSON.parse(readFileSync(`${ROOT}projects.json`, 'utf8')) as {
  projects: { id: string; resources: { kind: string; at: unknown }[] }[];
};

const viewsOf = (id: string): Views | undefined =>
  board.projects
    .find((project) => project.id === id)
    ?.resources.find((resource) => resource.kind === 'views')?.at as Views | undefined;

/** The kills the corridor's fleet is read from, and the names ESI answers for every id they carry. */
const FLEET = JSON.parse(readFileSync(`${ROOT}projects/eve/capture/fleet.json`, 'utf8')) as {
  kills: {
    attackers: { character_id?: number; ship_type_id: number; damage_done: number }[];
  }[];
  names: Record<string, string>;
};

/** The pilot a name is a unit under, in the place's own spelling. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

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
  const views = viewsOf('eve-online');
  const readings = standing(declaredReadings(), { views });
  expect(seatOfProject('eve-online')?.key, 'the seat is the shell').toBe('shell');
  expect(readings.find((reading) => reading.pane)?.key, 'the region is the pane').toBe('eve-space');
  expect(readings.some((reading) => reading.key === 'shell'), 'and the sphere stands beside it').toBe(true);
  expect(landingOf(readings, views, null)?.key, 'the project opens on the sphere').toBe('shell');
});

test('the board is the one space this app draws', () => {
  // One app and one project: the rail holds New Eden and nothing else, so the shell is the frame's and the project is the
  // whole board.
  expect(board.projects.map((project) => project.id)).toEqual(['eve-online']);
});

test('the deployment installs the sphere it names', () => {
  expect(readFileSync(`${ROOT}src/main.tsx`, 'utf8'), 'the entry installs the project').toContain(
    "'../projects/eve/src'",
  );
});

test('the run the board names is the one the capture maps to', () => {
  const capture = JSON.parse(readFileSync(`${ROOT}projects/eve/capture/new-eden.json`, 'utf8')) as Capture;
  const text = readFileSync(`${ROOT}projects/eve/scenario.txt`, 'utf8');
  expect(text).toBe(runOf(capture));
  const parsed = parseScenario(text);
  expect(parsed.unknown).toEqual([]);
  for (const check of parsed.checks) expect(check.derived, `at ${check.at}s`).toBe(check.expected);
});

// A market fact reports what it observed, and a payload size is the wrong reading for it: the inspector's numeric row
// says "bytes", which a traded volume is not. This is what keeps the two apart as far as the board.
test('the market facts carry a measurement rather than a payload size', () => {
  const { records } = parseScenario(readFileSync(`${ROOT}projects/eve/scenario.txt`, 'utf8'));
  const spike = records.find((record) => record.label === 'spike-volume');
  expect(spike?.measure, 'the day is a measurement').toEqual({ value: 23321824662, unit: 'units' });
  expect(spike?.bytes, 'and not a payload').toBeUndefined();
  const ask = records.find((record) => record.label === 'best-ask');
  expect(ask?.measure).toEqual({ value: 4.19, unit: 'isk' });
});

// The demo's claim is that a real measurement, a bound and a taker make one chain the screen can draw. A run that kept
// the numbers and lost the chain would still pass every count above, so the chain is what this holds.
test('the fleet is the one the kills carry, pilot by pilot', () => {
  // A roster written for the demonstration would be a name nobody can check. The place's people are the pilots ESI answers
  // for, and the one in charge is the reading the capture states.
  const document = board.projects.find((entry) => entry.id === 'eve-online');
  const place = document?.resources.find((resource) => resource.kind === 'place')?.at as
    | { units: Record<string, { icon: string; label?: string; role?: string }> }
    | undefined;
  const people = Object.values(place?.units ?? {}).filter((unit) => unit.icon === 'person');
  expect(people.map((unit) => unit.label).sort(), 'the pilots the kills name').toEqual(
    roster.map((pilot) => pilot.name).sort(),
  );
  expect(
    people.filter((unit) => unit.role === 'admin').map((unit) => unit.label),
    'one in charge, and it is the pilot who did the most of it',
  ).toEqual([roster[0]?.name]);
  expect(
    Object.values(place?.units ?? {})
      .filter((unit) => unit.icon === 'hauler')
      .map((unit) => unit.label)
      .sort(),
    'and the hulls they flew are the place of their own',
  ).toEqual(['Retribution', 'Stiletto', 'Svipul']);
});

test('the audit chain starts at the measurement and ends at the finding', () => {
  const { records } = parseScenario(readFileSync(`${ROOT}projects/eve/scenario.txt`, 'utf8'));
  const [chain, ...rest] = chainFor(records);
  expect(rest, 'the run declares one piece of work').toEqual([]);
  expect(chain.from?.label, 'the work starts at the measured day').toBe('spike-volume');
  expect(chain.worker, 'and a pilot of the fleet takes it').toBe(slug(roster[0]?.name ?? ''));
  expect(chain.produced?.content, 'and the finding is written down').toBe('size-not-breadth');
});
