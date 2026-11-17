# A ship mesh for this space

A brief for whoever builds the hull. It states the stack, the numbers the scene is drawn at, and what a
model has to be to land in it.

## What a mark is for

The space is a representation of entities, not a game. A mark says what a thing is: its kind, drawn by
its silhouette and colour, and its name, drawn beside it. The reading under it is the entity's own
records. Nothing here is trying to look like EVE's client, and a hull that is recognisable as a hauler
at a glance has done all the work a hull has to do.

That is also why the sizes are this small. A mark is a statement in a map, and a map that drew one
entity large would be making a claim about importance that the record does not make.

## What was decided

No model is imported. The marks are built in `projects/eve/src/hulls.ts` from boxes, cones, cylinders and
tori, and each kind is one geometry shared by every mark of that kind: a hauler is 204 triangles, a
station 268, a gate 340, with no texture, no loader and no asset. Shading is baked into the vertex
colours, because the scene carries no lights.

That is a settled decision rather than a first attempt, for two reasons. CCP's terms do not allow an EVE
model on a public page without written permission, so using one would make the demonstration's legal
position worse than its data's. A CC0 model is safe, but importing one needs a loader and an asset
pipeline this tree does not have, and decimating it needs a person with Blender in the loop every time
the shape changes. A component has neither cost.

The rest of this file is the contract, kept because a better hull is still allowed. Anything that meets
it can replace the geometry `hulls.ts` builds.

## The platform

Three.js through React Three Fiber. Not a game engine: no Babylon, no Unity, no PixiJS, no glTF runtime.

| What | Version in this tree |
|---|---|
| react | 19.2 |
| three | 0.181 |
| @react-three/fiber | 9.4 |
| vite | 6.3 |
| @react-three/drei | not installed |
| GLTFLoader / useGLTF / .glb | nothing in the repository uses one |

The view is `projects/eve/src/space.tsx`, a React component registered as a seat reading:

```tsx
export const EVE_SPACE = registerReading({
  key: 'eve-space',
  path: '/eden',
  View: EveSpace,
  seat: true,
});
```

## The scene it lands in

```tsx
<Canvas flat dpr={[1, 2]} camera={{ fov: 52, position: [0, 0, 0] }}>
  <color attach="background" args={['#05070d']} />
  <Pilot camera={camera} />          // sets fov and lookAt(forwardOf(view)) every frame
  <points>…900 stars, radius 7 to 11, size 0.018…</points>
  {systems.map(…)  // one mesh per unit
  {routes}         // THREE.Line along each unit's path
</Canvas>
```

The camera stands at the origin and looks outward. Units are placed on a shell of radius `1.25`
around it by `placed(at, aspect, sector)`. Nothing is at the origin, so the hull never sits in the
camera's eye.

Current mark sizes, in the same units:

| Mark | Geometry | Bounding box | Triangles |
|---|---|---|---|
| hauler | 11 boxes, a cone and two cylinders | 0.045 x 0.027 x 0.073 | 204 |
| station | a core, a torus, four spokes, a mast and two panels | 0.059 x 0.014 x 0.062 | 268 |
| gate | two tori, an arm and two struts | 0.046 x 0.052 x 0.046 | 340 |
| system | `sphereGeometry` | radius 0.006 | 80 |
| starfield | `points` | 0.018, at radius 7 to 11 | none |

Longest side against the contract: the hauler's 0.073 is inside the 0.08 a mark is allowed, and the
station and the gate sit below it so no kind of entity is drawn larger than another on the strength of
what it is.

Materials are `meshBasicMaterial` only. There are no lights in the scene, so a hull brings its own
shading in vertex colours and the material's colour multiplies it; that is also what lets a pick change
the colour without touching the geometry.

## What to deliver

Either form is acceptable.

A procedural React component is preferred. It needs no asset, no loader and no build change:

```tsx
<group position={[x, y, z]}>
  <mesh>
    <bufferGeometry … />
    <meshBasicMaterial vertexColors />
  </mesh>
</group>
```

A `.glb` is acceptable if it is worth the loader. It would need `GLTFLoader` from
`three/examples/jsm`, a Vite `?url` import, and the file shipped in `dist` and `dist-demo`.

## The numbers it has to hit

- Triangles: at most 3,000 per hull, and under 800 is better. The whole space is drawn every frame.
- Largest dimension: 0.08 units. The hull is a mark on a shell of radius 1.25, not a model in a
  hangar, so a ship that fills the screen is the wrong object.
- Centred on its own origin, Y up, nose toward -Z. Camera forward is -Z.
- No textures, no external fetches, no CDN, no HDR environment.
- Reads as a ship at 0.05 units wide and at a 52 degree field of view from 1.25 units away.

## House rules of this repository

- Code, comments and output in English.
- A comment says why, in one or two lines. It does not restate the code.
- No em dashes.
- No EVE unit ids in the source. A test reads the project's own vocabulary out of the board and fails
  if the source names any of it, so a hull must take its identity from props and not from a constant.
- `npm run typecheck`, `npm test` and `npm run build` in `apps/eve` have to pass.
- The app warns above 1,200 kB per chunk. The space chunk is about 1,000 kB today.

## What the caller passes

`space.tsx` picks a shape from the unit's icon and leaves the pick with the reading:

```tsx
{system.icon === 'hauler' ? <Hauler colour={colour} heading={system.heading} />
  : system.icon === 'station' ? <Structure kind="station" colour={colour} />
  : system.icon === 'gate' ? <Structure kind="gate" colour={colour} />
  : <mesh>…the system mark, a point of light…</mesh>}
```

A hull keeps that shape: it takes `colour` and, when it is worth it, a `heading` in radians, and it owns
no state. `onClick` stays with the caller, because picking is the reading's and not the model's.
