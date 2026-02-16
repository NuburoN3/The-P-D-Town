import test from "node:test";
import assert from "node:assert/strict";

import { TILE_TYPES } from "../src/core/constants.js";
import { GAME_CONTENT } from "../src/world/content.js";
import { WorldService } from "../src/world/WorldService.js";

test("WorldService marks fountain water as walkable and queryable", () => {
  const worldService = new WorldService({
    tileSize: 32,
    getSprite: () => null,
    content: GAME_CONTENT,
    validateContent: false
  });

  const area = worldService.getArea("hanamiTown", "overworld");
  assert.ok(area);

  // Hanami fountain starts at (25, 19). Local (2,2) is basin water.
  assert.equal(worldService.isFountainWaterTile("hanamiTown", "overworld", 27, 21), true);
  assert.equal(area.map[21][27], TILE_TYPES.PATH);

  // Outer rim remains solid.
  assert.equal(worldService.isFountainWaterTile("hanamiTown", "overworld", 25, 19), false);
  assert.equal(area.map[19][25], TILE_TYPES.WALL);

  // Center plinth remains solid.
  assert.equal(worldService.isFountainWaterTile("hanamiTown", "overworld", 28, 22), false);
  assert.equal(area.map[22][28], TILE_TYPES.WALL);

  // Entry lane through the rim should be walkable so player can reach water.
  assert.equal(worldService.isFountainWaterTile("hanamiTown", "overworld", 28, 25), false);
  assert.equal(area.map[25][28], TILE_TYPES.PATH);
  assert.equal(area.map[24][28], TILE_TYPES.PATH);
});
