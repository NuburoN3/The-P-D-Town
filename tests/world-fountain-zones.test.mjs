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

  // Hanami fountain starts at (12, 14). Local (2,2) is basin water.
  assert.equal(worldService.isFountainWaterTile("hanamiTown", "overworld", 14, 16), true);
  assert.equal(area.map[16][14], TILE_TYPES.PATH);

  // Outer rim remains solid.
  assert.equal(worldService.isFountainWaterTile("hanamiTown", "overworld", 12, 14), false);
  assert.equal(area.map[14][12], TILE_TYPES.WALL);

  // Center plinth remains solid.
  assert.equal(worldService.isFountainWaterTile("hanamiTown", "overworld", 15, 17), false);
  assert.equal(area.map[17][15], TILE_TYPES.WALL);

  // Entry lane through the rim should be walkable so player can reach water.
  assert.equal(worldService.isFountainWaterTile("hanamiTown", "overworld", 15, 20), false);
  assert.equal(area.map[20][15], TILE_TYPES.PATH);
  assert.equal(area.map[19][15], TILE_TYPES.PATH);
});
