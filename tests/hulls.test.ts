// The shapes a mark is drawn with.
//
// MESH.md states the contract a hull has to meet, and the space is drawn every frame, so the cost of a hull is part of
// its shape rather than a property of the machine it is shown on. These hold the numbers rather than a rendering.

import { expect, test } from 'vitest';
import * as THREE from 'three';

import { markGeometry, type MarkKind } from '../src/hulls';

const KINDS: MarkKind[] = ['hauler', 'station', 'gate'];

const sizeOf = (geometry: THREE.BufferGeometry): THREE.Vector3 => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.getSize(new THREE.Vector3());
};

const centreOf = (geometry: THREE.BufferGeometry): THREE.Vector3 => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.getCenter(new THREE.Vector3());
};

test('each kind is one geometry, shared by every mark of that kind', () => {
  for (const kind of KINDS) expect(markGeometry(kind)).toBe(markGeometry(kind));
});

test('a hull is the size a mark on the shell is allowed to be', () => {
  for (const kind of KINDS) {
    const size = sizeOf(markGeometry(kind));
    const largest = Math.max(size.x, size.y, size.z);
    expect(largest, `${kind} is at most 0.08`).toBeLessThanOrEqual(0.08);
    expect(largest, `${kind} is a mark rather than a speck`).toBeGreaterThan(0.03);
    const middle = centreOf(markGeometry(kind));
    expect(Math.abs(middle.x), `${kind} x`).toBeLessThanOrEqual(0.01);
    expect(Math.abs(middle.y), `${kind} y`).toBeLessThanOrEqual(0.01);
    expect(Math.abs(middle.z), `${kind} z`).toBeLessThanOrEqual(0.01);
  }
});

test('a hull stays inside the triangle budget', () => {
  for (const kind of KINDS) {
    const triangles = markGeometry(kind).getAttribute('position').count / 3;
    expect(triangles, `${kind} triangles`).toBeLessThanOrEqual(800);
  }
});

test('a hull carries its own shading, because the scene carries no lights', () => {
  for (const kind of KINDS) {
    const colours = markGeometry(kind).getAttribute('color');
    expect(colours, `${kind} has vertex colours`).toBeDefined();
    let shadowed = 0;
    let lit = 0;
    for (let index = 0; index < colours.count; index += 1) {
      const value = colours.getX(index);
      expect(value, `${kind} vertex brightness at ${index}`).toBeGreaterThan(0);
      expect(value, `${kind} vertex brightness at ${index}`).toBeLessThanOrEqual(1);
      if (value < 0.6) shadowed += 1;
      if (value > 0.9) lit += 1;
    }
    // A form drawn at one brightness is a silhouette, so both ends of the range have to be present.
    expect(shadowed, `${kind} has faces away from the light`).toBeGreaterThan(0);
    expect(lit, `${kind} has faces toward the light`).toBeGreaterThan(0);
  }
});

test('the hauler is longer than it is wide, and tapers to its nose', () => {
  const geometry = markGeometry('hauler');
  const size = sizeOf(geometry);
  expect(size.z, 'length against width').toBeGreaterThan(size.x);
  expect(size.z, 'length against height').toBeGreaterThan(size.y);

  const position = geometry.getAttribute('position');
  const front = geometry.boundingBox!.min.z + 0.006;
  let widest = 0;
  let nose = 0;
  for (let index = 0; index < position.count; index += 1) {
    widest = Math.max(widest, Math.abs(position.getX(index)));
    if (position.getZ(index) <= front) nose = Math.max(nose, Math.abs(position.getX(index)));
  }
  expect(nose, 'the nose has a width rather than a point').toBeGreaterThan(0);
  expect(nose * 2, 'the nose is narrower than the hull').toBeLessThan(widest);
});

test('the exhausts sit at the tail', () => {
  const exhaust = markGeometry('exhaust');
  exhaust.computeBoundingBox();
  expect(exhaust.boundingBox!.min.z).toBeGreaterThan(0.02);
  expect(exhaust.boundingBox!.max.z).toBeLessThan(0.04);
});
