import test from "node:test";
import assert from "node:assert/strict";

import { WorldService } from "../src/world/WorldService.js";

function createMap(width, height, fill = 0) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

test("WorldService resolves enemy archetype defaults with per-enemy overrides", () => {
  const content = {
    training: {},
    towns: {
      alpha: {
        name: "Alpha",
        defaultSpawnId: "start",
        areas: {
          overworld: {
            id: "overworld",
            kind: "overworld",
            width: 12,
            height: 12,
            generateBaseMap: (w, h) => createMap(w, h, 0)
          }
        },
        spawns: {
          start: { areaId: "overworld", x: 1, y: 1, dir: "down" }
        },
        enemies: [
          {
            id: "e-1",
            areaId: "overworld",
            x: 4,
            y: 5,
            archetypeId: "dojoFighter",
            damage: 11
          }
        ]
      }
    }
  };

  const worldService = new WorldService({
    tileSize: 32,
    getSprite: () => null,
    content,
    validateContent: false
  });

  const [enemy] = worldService.createEnemiesForTown("alpha");
  assert.equal(enemy.archetypeId, "dojoFighter");
  assert.equal(enemy.maxHp, 38); // from archetype
  assert.equal(enemy.damage, 11); // overridden by enemy definition
  assert.equal(enemy.behaviorType, "meleeChaser");
  assert.equal(enemy.attackType, "lightSlash");
});
