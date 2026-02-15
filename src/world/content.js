// ============================================================================
// CONTENT - Data-driven towns, areas, doors, NPCs, and quest text
// ============================================================================

import { TILE_TYPES } from "../core/constants.js";
import { BUILDING_TYPES } from "./buildingRenderers.js";

function createFilledMap(width, height, fillType) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fillType));
}

function paintPath(map, points, width = 1) {
  const radius = Math.max(0, Math.floor(width / 2));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);

      for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          const tx = x + ox;
          const ty = y + oy;
          if (ty < 0 || ty >= map.length) continue;
          if (tx < 0 || tx >= map[0].length) continue;
          map[ty][tx] = TILE_TYPES.PATH;
        }
      }
    }
  }
}

function paintRect(map, x, y, width, height, type) {
  for (let ty = y; ty < y + height; ty++) {
    if (ty < 0 || ty >= map.length) continue;
    for (let tx = x; tx < x + width; tx++) {
      if (tx < 0 || tx >= map[0].length) continue;
      map[ty][tx] = type;
    }
  }
}

function paintPoints(map, points, type) {
  for (const [x, y] of points) {
    if (y < 0 || y >= map.length) continue;
    if (x < 0 || x >= map[0].length) continue;
    map[y][x] = type;
  }
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

  // Central civic plaza around fountain
  paintRect(map, 8, 10, 15, 15, TILE_TYPES.PATH);

  // Main north/south boulevard
  paintPath(
    map,
    [
      { x: 15, y: 1 },
      { x: 15, y: 10 }
    ],
    3
  );
  paintPath(
    map,
    [
      { x: 15, y: 24 },
      { x: 15, y: 28 }
    ],
    3
  );

  // East/west connectors and neighborhood lanes
  paintPath(
    map,
    [
      { x: 8, y: 18 },
      { x: 5, y: 18 },
      { x: 5, y: 24 }
    ],
    2
  );
  paintPath(
    map,
    [
      { x: 22, y: 18 },
      { x: 26, y: 18 },
      { x: 26, y: 24 }
    ],
    2
  );
  paintPath(
    map,
    [
      { x: 9, y: 8 },
      { x: 21, y: 8 }
    ],
    2
  );

  // Structured tree belts
  paintRect(map, 2, 2, 6, 6, TILE_TYPES.TREE);
  paintRect(map, 22, 2, 6, 6, TILE_TYPES.TREE);
  paintRect(map, 2, 22, 5, 6, TILE_TYPES.TREE);
  paintRect(map, 23, 22, 5, 6, TILE_TYPES.TREE);
  paintRect(map, 3, 11, 3, 6, TILE_TYPES.TREE);
  paintRect(map, 24, 11, 3, 6, TILE_TYPES.TREE);

  // Garden accents around the plaza corners and lanes
  const cherryBlossomPositions = [
    [9, 11], [10, 11], [11, 11], [19, 11], [20, 11], [21, 11],
    [9, 24], [10, 24], [11, 24], [19, 24], [20, 24], [21, 24],
    [7, 18], [7, 19], [22, 18], [22, 19], [14, 8], [15, 8], [16, 8]
  ];
  paintPoints(map, cherryBlossomPositions, TILE_TYPES.CHERRY_BLOSSOM);

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

function generateBarInteriorBase(width, height) {
  const map = createFilledMap(width, height, TILE_TYPES.BAR_FLOOR);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        map[y][x] = TILE_TYPES.WALL;
      }
    }
  }

  // Main serving counter
  for (let x = 2; x <= width - 3; x++) {
    map[3][x] = TILE_TYPES.BAR_COUNTER;
  }

  // Shelves behind counter
  for (let x = 3; x <= width - 4; x += 2) {
    map[1][x] = TILE_TYPES.BAR_DECOR;
  }

  // Counter stools
  map[4][3] = TILE_TYPES.BAR_STOOL;
  map[4][5] = TILE_TYPES.BAR_STOOL;
  map[4][7] = TILE_TYPES.BAR_STOOL;
  map[4][9] = TILE_TYPES.BAR_STOOL;

  // Table area
  map[6][3] = TILE_TYPES.BAR_TABLE;
  map[6][8] = TILE_TYPES.BAR_TABLE;
  map[7][5] = TILE_TYPES.BAR_STOOL;
  map[7][10] = TILE_TYPES.BAR_STOOL;

  // Back room decoration
  map[6][1] = TILE_TYPES.BAR_DECOR;
  map[6][10] = TILE_TYPES.BAR_DECOR;

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
          musicSrc: "assets/audio/Anticipation_Game_Audio_BG.wav",
          generateBaseMap: generateHanamiOverworldBase,
          buildings: [
            {
              id: "hanamiDojoFront",
              type: BUILDING_TYPES.DOJO,
              x: 13,
              y: 6,
              width: 5,
              height: 4
            },
            {
              id: "hanamiTownFountain",
              type: BUILDING_TYPES.FOUNTAIN,
              x: 11,
              y: 13,
              width: 9,
              height: 9
            },
            {
              id: "hanamiBarFront",
              type: BUILDING_TYPES.BAR,
              x: 21,
              y: 16,
              width: 5,
              height: 4
            }
          ],
          signposts: [
            { x: 14, y: 10, text: "The Dojo" },
            { x: 21, y: 20, text: "Sakura Bar" },
            { x: 15, y: 23, text: "Hanami Grand Fountain" }
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
        },
        hanamiBar: {
          id: "hanamiBar",
          kind: "interior",
          width: 12,
          height: 10,
          generateBaseMap: generateBarInteriorBase
        }
      },
      spawns: {
        townGate: { areaId: "overworld", x: 15, y: 26, dir: "up" },
        dojoExteriorDoor: { areaId: "overworld", x: 15, y: 10, dir: "down" },
        dojoInteriorDoor: { areaId: "hanamiDojo", x: 6, y: 8, dir: "up" },
        barExteriorDoor: { areaId: "overworld", x: 22, y: 20, dir: "down" },
        barInteriorDoor: { areaId: "hanamiBar", x: 6, y: 8, dir: "up" }
      },
      doors: [
        {
          from: { areaId: "overworld", x: 15, y: 9 },
          to: { townId: "hanamiTown", spawnId: "dojoInteriorDoor" }
        },
        {
          from: { areaId: "hanamiDojo", x: 6, y: 9 },
          to: { townId: "hanamiTown", spawnId: "dojoExteriorDoor" }
        },
        {
          from: { areaId: "overworld", x: 22, y: 19 },
          to: { townId: "hanamiTown", spawnId: "barInteriorDoor" }
        },
        {
          from: { areaId: "hanamiBar", x: 6, y: 9 },
          to: { townId: "hanamiTown", spawnId: "barExteriorDoor" }
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
        },
        {
          id: "mikaBartender",
          name: "Mika",
          spriteName: "bartender_mika",
          desiredHeightTiles: 1.15,
          areaId: "hanamiBar",
          x: 6,
          y: 2,
          dir: "down",
          dialogue: [
            "Welcome to Sakura Bar.",
            "Long day training at the dojo?",
            "Take a breath. Listen to the room.",
            "Want to try the House Pour Challenge?"
          ],
          hasTrainingChoice: false,
          minigameId: "housePour",
          minigamePrompt: "Try the House Pour Challenge?",
          minigameDeclineDialogue: "No worries. Come back when your hands are steady.",
          minigameWinDialogue: "That's a clean pour. You'd survive a rush-hour shift.",
          minigameLoseDialogue: "Not bad. Bar work is rhythm, timing, and patience."
        }
      ]
    }
  }
};
