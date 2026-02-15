import test from "node:test";
import assert from "node:assert/strict";

import { GAME_CONTENT } from "../src/world/content.js";
import { assertValidGameContent, validateGameContent } from "../src/world/validateContent.js";

function createMap(width, height, fill = 0) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function createMinimalValidContent() {
  return {
    training: {
      completedPrompt: "Done",
      acceptedDialogue: "Accepted",
      postCompleteDialogue: ["Nice work"],
      declineDialogue: "Later",
      itemName: "Band",
      itemUnlockMessage: "Unlocked",
      itemReceivedMessage: "Received"
    },
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
            generateBaseMap: (w, h) => createMap(w, h, 0),
            buildings: [],
            signposts: []
          }
        },
        spawns: {
          start: { areaId: "overworld", x: 1, y: 1, dir: "down" }
        },
        doors: [],
        npcs: []
      }
    }
  };
}

test("GAME_CONTENT is valid", () => {
  const result = validateGameContent(GAME_CONTENT);
  assert.equal(result.errors.length, 0, result.errors.join("\n"));
});

test("minimal valid content passes strict assertion", () => {
  const content = createMinimalValidContent();
  assert.doesNotThrow(() => assertValidGameContent(content));
});

test("invalid default spawn is rejected", () => {
  const content = createMinimalValidContent();
  content.towns.alpha.defaultSpawnId = "missing";

  assert.throws(() => assertValidGameContent(content), /defaultSpawnId 'missing' does not exist/i);
});

test("invalid door destination is rejected", () => {
  const content = createMinimalValidContent();
  content.towns.alpha.doors.push({
    from: { areaId: "overworld", x: 2, y: 2 },
    to: { townId: "alpha", spawnId: "unknownSpawn" }
  });

  assert.throws(() => assertValidGameContent(content), /to\.spawnId must reference an existing spawn/i);
});

test("invalid map shape is rejected", () => {
  const content = createMinimalValidContent();
  content.towns.alpha.areas.overworld.generateBaseMap = () => [[0]];

  assert.throws(() => assertValidGameContent(content), /row count mismatch/i);
});

test("id/key mismatch surfaces a warning but not an error", () => {
  const content = createMinimalValidContent();
  content.towns.alpha.areas.overworld.id = "different";

  const { errors, warnings } = validateGameContent(content);
  assert.equal(errors.length, 0);
  assert.ok(warnings.some((w) => w.includes("differs from area key")));
});
