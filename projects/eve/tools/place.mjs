// The region's systems, stood where ESI says they are.
//
// A space of fifteen units is a diagram of a corridor, not a region. `capture/systems.json` is every system this map holds as
// the source answered it, and this places them on the board: east is x, north is z, and the box is the map's own frame
// rather than a hand-arranged row. The units a project keeps of its own (the stations and the fleet) stand beside the
// system they belong to, so regenerating the map does not move them.
//
//   npm run place
//
// It writes `project.json`, and the place's units and areas are the only part of it that is its to write.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HOME, '..');

const systems = JSON.parse(readFileSync(join(PROJECT, 'capture', 'systems.json'), 'utf8'));
const file = join(PROJECT, 'project.json');
const document = JSON.parse(readFileSync(file, 'utf8'));

const place = document.resources.find((resource) => resource.kind === 'place');
if (!place) throw new Error('project.json has no place to place anything in');

const [, , width, height] = place.at.view;
/** Room for a name beside the edge of the map, so a label is not cut off by the patch. */
const MARGIN = 30;

const span = (values) => [Math.min(...values), Math.max(...values)];
const [minX, maxX] = span(systems.map((system) => system.x));
const [minZ, maxZ] = span(systems.map((system) => system.z));

/** A galactic coordinate as a point on the board: east is x, north is z. */
const pointOf = (x, z) => {
  const across = (x - minX) / (maxX - minX);
  const down = (z - minZ) / (maxZ - minZ);
  return [
    Math.round(MARGIN + across * (width - MARGIN * 2)),
    Math.round(MARGIN + (1 - down) * (height - MARGIN * 2)),
  ];
};

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The units a project keeps of its own: what stands at a system rather than being one. */
const NEAR = [
  ['jita-4-4', 'station', 'Jita IV-4', ['order-read', 'order-fill'], 'jita', [10, -9]],
  ['perimeter-station', 'station', 'Perimeter II-1', ['dock-at', 'work-declare'], 'perimeter', [11, 9]],
  ['ytiri-storage', 'station', 'Ytiri Storage', ['dock-at', 'work-declare'], 'perimeter', [20, 18]],
];

// The fleet, as ESI answered it: every pilot who appears in the two kills, once each, with the hull they flew. A pilot who
// answered in both kills is one pilot and their damage is the sum of the two, which is what ranks the roster. The Serpentis
// patrols in the same kills carry no character and are not the fleet.
const fleet = JSON.parse(readFileSync(join(PROJECT, 'capture', 'fleet.json'), 'utf8'));
const nameOf = (id) => fleet.names[String(id)] ?? String(id);
const pilots = new Map();
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
/** The pilot who did the most of it, which is this demonstration's reading of who was in charge. */
const commander = roster[0];
/** The hulls the fleet flew, one unit each: the place draws a ship as a hull and the composition is what it says. */
const hulls = [...new Set(roster.map((pilot) => pilot.hull))].sort();

/** The place a fleet stands at, as an offset from the system it stood in: the formation falls toward the middle of the map,
 * so a fleet that stood at a system on the edge is still drawn inside the board and a name beside it is not cut off. */
const formed = (index) => [-100 + (index % 4) * 26, -24 + Math.floor(index / 4) * 22];

const units = {};
const seen = new Set();
for (const system of systems) {
  const id = slug(system.name);
  if (seen.has(id)) throw new Error(`two systems answer to ${id}`);
  seen.add(id);
  units[id] = { icon: 'system', label: system.name, at: { record: pointOf(system.x, system.z) } };
}

/** Stand a unit beside the system it belongs to, and say so when that system is not on the map. */
const at = (id, near, [dx, dy]) => {
  const home = units[near]?.at.record;
  if (!home) throw new Error(`${id} belongs to ${near}, and the map does not hold it`);
  return [home[0] + dx, home[1] + dy];
};

for (const [id, icon, label, abilities, near, offset] of NEAR) {
  units[id] = { icon, label, abilities, at: { record: at(id, near, offset) } };
}

// The fleet stands where ESI saw it, which is one system the map holds.
const home = units[slug(fleet.system.name)];
if (!home) throw new Error(`${fleet.system.name} is not on the map, and the fleet stood in it`);
const beside = ([dx, dy]) => [home.at.record[0] + dx, home.at.record[1] + dy];

roster.forEach((pilot, index) => {
  units[pilot.id] = {
    icon: 'person',
    label: pilot.name,
    role: pilot === commander ? 'admin' : 'member',
    at: { record: beside(formed(index)) },
  };
});

hulls.forEach((hull, index) => {
  units[slug(hull)] = { icon: 'hauler', label: hull, at: { record: beside([-10, -28 + index * 28]) } };
});

place.at.areas = [{ x: 0, y: 0, w: width, h: height, label: 'The Forge' }];
place.at.units = units;

writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
console.log(`placed ${systems.length} systems and ${Object.keys(units).length - systems.length} units of the project's own`);
