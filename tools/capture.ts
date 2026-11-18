// What a system holds, as ESI answers it: the star, its planets and their moons and belts, the gates and the stations.
//
// `capture/systems.json` is the region and this adds the units each system stands. The read is pinned by the server it
// was taken from, because a second read is a second capture: the file is what the board draws, not a live query.
//
//   npm run capture
//
// Every planet, moon, belt, gate and station is one unit, so a system shows what the source holds rather than a count.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const BASE = 'https://esi.evetech.net/latest';
const WORKERS = 12;

interface System {
  id: number;
  name: string;
}

interface Point {
  x: number;
  y: number;
  z: number;
}

interface PlanetRecord {
  planet_id: number;
  moons?: number[];
  asteroid_belts?: number[];
}

interface SystemRecord {
  star_id: number;
  planets?: PlanetRecord[];
  stargates?: number[];
  stations?: number[];
}

interface StarRecord {
  name: string;
  radius: number;
  spectral_class: string;
  type_id: number;
  age: number;
  luminosity: number;
  temperature: number;
}

interface Star {
  id: number;
  name: string;
  radius: number;
  spectral: string;
  type: number;
  typeName: string;
  age: number;
  luminosity: number;
  temperature: number;
}

interface Moon {
  id: number;
  name: string;
  x: number;
  z: number;
}

interface Belt {
  id: number;
  name: string;
  x: number;
  z: number;
}

interface Planet {
  id: number;
  name: string;
  type: number;
  typeName: string;
  x: number;
  z: number;
  moons: Moon[];
  belts: Belt[];
}

interface Gate {
  id: number;
  name: string;
  to: number;
  x: number;
  z: number;
}

interface Station {
  id: number;
  name: string;
  type: number;
  typeName: string;
  owner: number;
  race: number;
  services: string[];
  dockable: number;
  officeRent: number;
  reprocessing: number;
  stationsTake: number;
  x: number;
  z: number;
}

interface Units {
  star: Star;
  planets: Planet[];
  gates: Gate[];
  stations: Station[];
}

const systems = JSON.parse(readFileSync(join(APP, 'capture', 'systems.json'), 'utf8')) as System[];

/** One request, retried while the source is busy and refused when the record is not there. */
async function get<T>(path: string): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const answer = await fetch(`${BASE}${path}`);
    if (answer.ok) return (await answer.json()) as T;
    if (answer.status === 404) throw new Error(`${path} is not there`);
    if (attempt >= 5) throw new Error(`${path} answered ${answer.status}`);
    await new Promise((wait) => setTimeout(wait, 400 * 2 ** attempt));
  }
}

const flat = (point: Point): [number, number] => [Math.round(point.x), Math.round(point.z)];

// A type id is a number the panel cannot read, so the name ESI gives it is kept with it. The set of types a region
// holds is small and repeats, so one read per type serves every unit that carries it.
const typeNames = new Map<number, Promise<string>>();
function typeName(id: number): Promise<string> {
  const known = typeNames.get(id);
  if (known) return known;
  const read = get<{ name: string }>(`/universe/types/${id}/`).then((type) => type.name);
  typeNames.set(id, read);
  return read;
}

const detail = new Map<number, Units>();
let done = 0;

type Task = () => Promise<void>;
const tasks: Task[] = [];
let next = 0;

async function worker(): Promise<void> {
  while (next < tasks.length) {
    const task = tasks[next];
    next += 1;
    await task();
    done += 1;
    if (done % 250 === 0) console.log(`${done} records`);
  }
}

for (const system of systems) {
  tasks.push(async () => {
    const record = await get<SystemRecord>(`/universe/systems/${system.id}/`);
    const star = await get<StarRecord>(`/universe/stars/${record.star_id}/`);
    const units: Units = {
      star: {
        id: record.star_id,
        name: star.name,
        radius: star.radius,
        spectral: star.spectral_class,
        type: star.type_id,
        typeName: await typeName(star.type_id),
        age: star.age,
        luminosity: star.luminosity,
        temperature: star.temperature,
      },
      planets: [],
      gates: [],
      stations: [],
    };
    detail.set(system.id, units);

    for (const gate of record.stargates ?? []) {
      tasks.push(async () => {
        const one = await get<{ stargate_id: number; name: string; destination: { system_id: number }; position: Point }>(
          `/universe/stargates/${gate}/`,
        );
        const [x, z] = flat(one.position);
        units.gates.push({ id: one.stargate_id, name: one.name, to: one.destination.system_id, x, z });
      });
    }
    for (const station of record.stations ?? []) {
      tasks.push(async () => {
        const one = await get<{
          station_id: number;
          name: string;
          type_id: number;
          owner: number;
          race_id: number;
          services?: string[];
          max_dockable_ship_volume: number;
          office_rental_cost: number;
          reprocessing_efficiency: number;
          reprocessing_stations_take: number;
          position: Point;
        }>(`/universe/stations/${station}/`);
        const [x, z] = flat(one.position);
        units.stations.push({
          id: one.station_id,
          name: one.name,
          type: one.type_id,
          typeName: await typeName(one.type_id),
          owner: one.owner,
          race: one.race_id,
          services: [...(one.services ?? [])].sort(),
          dockable: one.max_dockable_ship_volume,
          officeRent: one.office_rental_cost,
          reprocessing: one.reprocessing_efficiency,
          stationsTake: one.reprocessing_stations_take,
          x,
          z,
        });
      });
    }
    for (const planet of record.planets ?? []) {
      tasks.push(async () => {
        const one = await get<{ planet_id: number; name: string; type_id: number; position: Point }>(
          `/universe/planets/${planet.planet_id}/`,
        );
        const [x, z] = flat(one.position);
        const made: Planet = {
          id: one.planet_id,
          name: one.name,
          type: one.type_id,
          typeName: await typeName(one.type_id),
          x,
          z,
          moons: [],
          belts: [],
        };
        units.planets.push(made);
        for (const moon of planet.moons ?? []) {
          tasks.push(async () => {
            const body = await get<{ moon_id: number; name: string; position: Point }>(`/universe/moons/${moon}/`);
            const [mx, mz] = flat(body.position);
            made.moons.push({ id: body.moon_id, name: body.name, x: mx, z: mz });
          });
        }
        for (const belt of planet.asteroid_belts ?? []) {
          tasks.push(async () => {
            const ring = await get<{ name: string; position: Point }>(`/universe/asteroid_belts/${belt}/`);
            const [bx, bz] = flat(ring.position);
            made.belts.push({ id: belt, name: ring.name, x: bx, z: bz });
          });
        }
      });
    }
  });
}

await Promise.all(Array.from({ length: WORKERS }, worker));

const status = await get<{ server_version: string; start_time: string }>('/status/');
const revision = `server-${status.server_version}/${status.start_time.slice(0, 10)}`;

// The record is written in the order the region holds it, and every list inside it by id, so a second run over the same
// source is the same file and a diff is a change at the source rather than in this script.
const document = {
  pin: { source: 'esi', endpoint: BASE, revision, adapter: 'eve/units/2' },
  systems: Object.fromEntries(
    systems.map((system) => {
      const units = detail.get(system.id);
      if (!units) throw new Error(`${system.name} was never read`);
      units.planets.sort((left, right) => left.id - right.id);
      units.gates.sort((left, right) => left.id - right.id);
      units.stations.sort((left, right) => left.id - right.id);
      for (const planet of units.planets) {
        planet.moons.sort((left, right) => left.id - right.id);
        planet.belts.sort((left, right) => left.id - right.id);
      }
      return [String(system.id), units];
    }),
  ),
};

writeFileSync(join(APP, 'capture', 'units.json'), `${JSON.stringify(document, null, 1)}\n`);
const units = Object.values(document.systems).reduce(
  (count, one) =>
    count +
    1 +
    one.gates.length +
    one.stations.length +
    one.planets.reduce((inner, planet) => inner + 1 + planet.moons.length + planet.belts.length, 0),
  0,
);
console.log(`wrote capture/units.json: ${units} units in ${systems.length} systems, ${revision}`);
