import test from "node:test";
import assert from "node:assert/strict";

import { WorldService } from "../src/world/WorldService.js";

function createMap(width, height, fill = 0) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

test("WorldService preserves custom NPC fields for feature modules", () => {
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
            width: 8,
            height: 8,
            generateBaseMap: (w, h) => createMap(w, h, 0)
          }
        },
        spawns: {
          start: { areaId: "overworld", x: 1, y: 1, dir: "down" }
        },
        npcs: [
          {
            id: "npc-1",
            name: "Host",
            spriteName: "host_sprite",
            areaId: "overworld",
            x: 2,
            y: 3,
            dialogue: ["Hi"],
            minigameId: "housePour",
            customFeatureFlag: true
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

  const [npc] = worldService.createNPCsForTown("alpha");
  assert.equal(npc.x, 64);
  assert.equal(npc.y, 96);
  assert.equal(npc.minigameId, "housePour");
  assert.equal(npc.customFeatureFlag, true);
});
