// The region's ground: ninety places, one cell each, and no two of them claiming the same direction.
//
// A cap round each place's bearing is the right ground for a space of one place, and the wrong one for a deployment
// that stands ninety in one shell: caps of one reach overlap as soon as two places are near, and the fields drawn on
// the shell covered one another. A cell is what replaces the cap, and this file holds the three claims a tiling makes:
// the cells cover the shell, they do not overlap, and a place's members stand inside its own cell.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import {
  angleBetween,
  cellCentre,
  cellOfPlace,
  cellReach,
  onShell,
  shellAt,
} from '@ssccsorg/skene-board';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

type Vec = [number, number, number];

interface Project {
  id: string;
  resources: { kind: string; at: unknown }[];
}

interface Place {
  sector: [number, number];
  cell?: [number, number][];
  mark?: string;
  units: Record<string, { at: Record<string, [number, number]> }>;
}

const board = JSON.parse(readFileSync(`${ROOT}projects.json`, 'utf8')) as { projects: Project[] };
const placeOf = (project: Project) => project.resources.find((each) => each.kind === 'place')?.at as Place;
const places = board.projects.map((project) => ({ id: project.id, ...placeOf(project) }));

const vec = ([azimuth, elevation]: [number, number]): Vec => {
  const [a, e] = [(azimuth * Math.PI) / 180, (elevation * Math.PI) / 180];
  return [Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)];
};

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const unit = (v: Vec): Vec => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

/** The area of the spherical triangle, by the vector form of the excess. */
function triangle(a: Vec, b: Vec, c: Vec): number {
  const triple = Math.abs(dot(a, cross(b, c)));
  return 2 * Math.atan2(triple, 1 + dot(a, b) + dot(b, c) + dot(c, a));
}

function area(cell: [number, number][]): number {
  const points = cell.map(vec);
  let total = 0;
  for (let index = 1; index + 1 < points.length; index += 1) {
    total += triangle(points[0], points[index], points[index + 1]);
  }
  return total;
}

/** Whether a direction is strictly inside a convex cell, with the cell's own middle as the inside side. */
function inside(point: Vec, cell: Vec[]): boolean {
  let sum: Vec = [0, 0, 0];
  for (const corner of cell) sum = [sum[0] + corner[0], sum[1] + corner[1], sum[2] + corner[2]];
  const middle = unit(sum);
  for (let index = 0; index < cell.length; index += 1) {
    const plane = cross(cell[index], cell[(index + 1) % cell.length]);
    if (dot(point, plane) * dot(middle, plane) < 0) return false;
  }
  return true;
}

test('every place holds a cell and stands at its middle', () => {
  expect(places).toHaveLength(90);
  for (const place of places) {
    expect(place.cell, `${place.id} holds a cell`).toBeDefined();
    expect(place.cell!.length, `${place.id} has a cell of at least five sides`).toBeGreaterThanOrEqual(5);
    expect(place.mark, `${place.id} names the unit that stands for it`).toBeDefined();
    expect(place.units[place.mark!], `${place.id} stands the unit it names`).toBeDefined();
    const middle = cellCentre(cellOfPlace(place)!);
    expect(angleBetween(vec(place.sector), shellAt(middle, 1)), `${place.id} stands at its own middle`).toBeLessThan(1e-4);
  }
});

test('the cells cover the shell and do not overlap it twice', () => {
  const total = places.reduce((sum, place) => sum + area(place.cell!), 0);
  expect(total, 'the cells cover the whole sphere once').toBeCloseTo(4 * Math.PI, 3);
  const sizes = places.map((place) => area(place.cell!));
  const mean = total / places.length;
  for (const size of sizes) expect(size, 'no cell is twice another').toBeLessThan(mean * 1.4);
  for (const size of sizes) expect(size).toBeGreaterThan(mean * 0.7);
});

test('no cell reaches into another', () => {
  const celled = places.map((place) => ({ id: place.id, cell: place.cell!.map(vec) }));
  for (const one of celled) {
    for (const other of celled) {
      if (one.id === other.id) continue;
      for (const corner of one.cell) {
        // A shared corner is on the boundary of both cells and belongs to neither's inside.
        if (other.cell.some((theirs) => angleBetween(corner, theirs) < 1e-4)) continue;
        expect(inside(corner, other.cell), `${one.id} has a corner inside ${other.id}`).toBe(false);
      }
    }
  }
});

test('neighbouring cells share an edge, so no crack runs between them', () => {
  const celled = places.map((place) => ({ id: place.id, cell: place.cell! }));
  let edges = 0;
  for (const one of celled) {
    for (const other of celled) {
      if (one.id >= other.id) continue;
      const shared = one.cell.filter((corner) =>
        other.cell.some((theirs) => Math.hypot(corner[0] - theirs[0], corner[1] - theirs[1]) < 0.002),
      );
      if (shared.length === 0) continue;
      expect(shared.length, `${one.id} and ${other.id} share a side`).toBeGreaterThanOrEqual(2);
      edges += 1;
    }
  }
  // A tiling of ninety cells has a connected neighbour graph; Euler's formula puts its edges well above one a cell.
  expect(edges).toBeGreaterThanOrEqual(places.length * 2);
});

test('a place lays every member it stands inside its own cell', () => {
  for (const place of places) {
    const cell = cellOfPlace(place)!;
    const reach = cellReach(cell);
    const middle = shellAt(cellCentre(cell), 1);
    for (const [id, unit] of Object.entries(place.units)) {
      const at = Object.values(unit.at)[0];
      if (!at) continue;
      const point = onShell(
        [(at[0] - 260) / 176, at[1] / 176 - 0.5, 0],
        { aspect: 520 / 176, sector: [place.sector[0] * (Math.PI / 180), place.sector[1] * (Math.PI / 180)], cell },
      );
      expect(angleBetween(point, middle), `${place.id}/${id} stands inside its cell`).toBeLessThan(reach + 1e-6);
    }
  }
});
