import { strict as assert } from 'assert';
import test from 'node:test';
import { CollisionService } from '../src/core/CollisionSystem.js';
import { TILE_TYPES } from '../src/core/constants.js';

test('tileAtPixel and isBlockedAtPixel basic behavior', () => {
  const cs = new CollisionService({ tileSize: 10 });
  const map = [
    [TILE_TYPES.GRASS, TILE_TYPES.TREE],
    [TILE_TYPES.GRASS, TILE_TYPES.DOOR]
  ];
  const w = 2;
  const h = 2;

  // pixel at (15, 5) -> tile (1,0) which is TREE
  assert.equal(cs.tileAtPixel(15, 5, map, w, h), TILE_TYPES.TREE);
  assert.equal(cs.isBlockedAtPixel(15, 5, map, w, h), true);

  // pixel at (5,15) -> tile (0,1) which is GRASS
  assert.equal(cs.tileAtPixel(5, 15, map, w, h), TILE_TYPES.GRASS);
  assert.equal(cs.isBlockedAtPixel(5, 15, map, w, h), false);
});

test('collides detects blocked tiles', () => {
  const cs = new CollisionService({ tileSize: 10 });
  const map = [
    [TILE_TYPES.GRASS, TILE_TYPES.TREE],
    [TILE_TYPES.GRASS, TILE_TYPES.GRASS]
  ];
  const w = 2;
  const h = 2;

  // Place player so one of the corners overlaps the TREE at (1,0)
  const nx = 8; // near tile boundary
  const ny = 0;
  assert.equal(cs.collides(nx, ny, map, w, h), true);

  // empty area
  assert.equal(cs.collides(0, 0, map, w, h), false);
});

test('collidesWithNPC respects world and blocking flag', () => {
  const cs = new CollisionService({ tileSize: 10 });
  const npcs = [
    { x: 20, y: 20, width: 8, height: 8, world: 'a', blocking: true },
    { x: 0, y: 0, width: 8, height: 8, world: 'b', blocking: true },
    { x: 5, y: 5, width: 8, height: 8, world: 'a', blocking: false }
  ];

  // player overlapping first npc
  assert.equal(cs.collidesWithNPC(18, 18, npcs, 'a'), true);
  // different world
  assert.equal(cs.collidesWithNPC(18, 18, npcs, 'b'), false);
  // non-blocking npc should not collide
  assert.equal(cs.collidesWithNPC(4, 4, npcs, 'a'), false);
});

test('doorFromCollision returns door tile coords', () => {
  const cs = new CollisionService({ tileSize: 10 });
  const map = [
    [TILE_TYPES.GRASS, TILE_TYPES.DOOR],
    [TILE_TYPES.GRASS, TILE_TYPES.GRASS]
  ];
  const w = 2;
  const h = 2;

  const res = cs.doorFromCollision(12, 2, map, w, h);
  assert.equal(res.tx, 1);
  assert.equal(res.ty, 0);
});
