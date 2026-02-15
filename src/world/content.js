// ============================================================================
// CONTENT - Data-driven towns, areas, doors, NPCs, and quest text
// ============================================================================

import { TILE_TYPES } from "../core/constants.js";
import { BUILDING_TYPES } from "./buildingRenderers.js";

function createFilledMap(width, height, fillType) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fillType));
}

function generateHanamiOverworldBase(width, height) {
  const map = createFilledMap(width, height, TILE_TYPES.GRASS);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        map[y][x] = TILE_TYPES.TREE;
      }
    }
  }

  const pathX = 15;
  for (let y = 2; y < height - 2; y++) {
    map[y][pathX] = TILE_TYPES.PATH;
  }

  for (let x = 8; x <= 22; x++) {
    map[15][x] = TILE_TYPES.PATH;
  }

  const treeClusters = [
    [4, 4], [5, 4], [4, 5], [24, 4], [25, 4], [24, 5],
    [5, 23], [4, 24], [24, 23], [25, 24], [22, 20], [8, 20]
  ];

  for (const [x, y] of treeClusters) {
    if (x >= 0 && y >= 0 && x < width && y < height) {
      map[y][x] = TILE_TYPES.TREE;
    }
  }

  const cherryBlossomPositions = [
    [15, 5], [14, 6], [15, 6], [16, 6], [14, 7], [15, 7], [16, 7]
  ];

  for (const [x, y] of cherryBlossomPositions) {
    if (x >= 0 && y >= 0 && x < width && y < height) {
      map[y][x] = TILE_TYPES.CHERRY_BLOSSOM;
    }
  }

  return map;
}

function generateDojoInteriorBase(width, height) {
  const map = createFilledMap(width, height, TILE_TYPES.INTERIOR_FLOOR);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        map[y][x] = TILE_TYPES.WALL;
      }
    }
  }
  return map;
}

export const GAME_CONTENT = {
  training: {
    completedPrompt: "Training complete. Speak to Mr. Hanami.",
    acceptedDialogue: "Your training has already begun. Focus your mind.",
    postCompleteDialogue: [
      "Excellent.",
      "You have mastered the basics and are now ready for your next lesson. I won't tell you what it is though!"
    ],
    declineDialogue: "Come speak to me when you are ready.",
    itemName: "Training Headband",
    itemUnlockMessage: "New item: Training Headband",
    itemReceivedMessage: "You received a Training Headband!"
  },
  towns: {
    hanamiTown: {
      id: "hanamiTown",
      name: "Hanami Town",
      defaultSpawnId: "townGate",
      areas: {
        overworld: {
          id: "overworld",
          kind: "overworld",
          width: 30,
          height: 30,
          generateBaseMap: generateHanamiOverworldBase,
          buildings: [
            {
              id: "hanamiDojoFront",
              type: BUILDING_TYPES.DOJO,
              x: 13,
              y: 10,
              width: 5,
              height: 4
            }
          ],
          signposts: [
            { x: 14, y: 14, text: "The Dojo" }
          ]
        },
        hanamiDojo: {
          id: "hanamiDojo",
          kind: "interior",
          width: 12,
          height: 10,
          musicSrc: "assets/audio/Hanami_Game_Audio_BG.wav",
          generateBaseMap: generateDojoInteriorBase,
          trainingTile: { x: 4, y: 5 }
        }
      },
      spawns: {
        townGate: { areaId: "overworld", x: 15, y: 18, dir: "down" },
        dojoExteriorDoor: { areaId: "overworld", x: 15, y: 14, dir: "down" },
        dojoInteriorDoor: { areaId: "hanamiDojo", x: 6, y: 8, dir: "up" }
      },
      doors: [
        {
          from: { areaId: "overworld", x: 15, y: 13 },
          to: { townId: "hanamiTown", spawnId: "dojoInteriorDoor" }
        },
        {
          from: { areaId: "hanamiDojo", x: 6, y: 9 },
          to: { townId: "hanamiTown", spawnId: "dojoExteriorDoor" }
        }
      ],
      npcs: [
        {
          id: "mrHanami",
          name: "Mr. Hanami",
          spriteName: "mr_hanami",
          desiredHeightTiles: 1.15,
          areaId: "hanamiDojo",
          x: 7,
          y: 4,
          dir: "down",
          dialogue: [
            "Hello there!",
            "Welcome to the dojo.",
            "I train students here",
            "where they practice Hana Sakura style Karate",
            "which means \"the way of the cherry blossom\".",
            "Would you like me to teach you?"
          ],
          hasTrainingChoice: true
        }
      ]
    }
  }
};
