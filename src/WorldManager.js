// ============================================================================
// WORLD MANAGER - Towns, buildings, maps, and NPCs
// ============================================================================

import { TILE_TYPES, OVERWORLD_W, OVERWORLD_H, INTERIOR_W, INTERIOR_H } from './constants.js';
import { AssetManager } from './AssetManager.js';

// Building types enum
export const BUILDING_TYPES = {
  DOJO: 'DOJO',
  HOUSE: 'HOUSE',
  SHOP: 'SHOP',
  SHRINE: 'SHRINE'
};

// Building renderers - will be set after canvas is available
export let buildingRenderers = null;

export function initializeBuildingRenderers(ctx, TILE, COLORS) {
  buildingRenderers = {
    DOJO: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
        const roofColor = "#c41e3a";
        const roofDark = "#8b0000";
        const woodColor = "#8b6f47";
        const wallColor = "#d4af7a";
        const trimColor = "#3d2817";
        
        ctx.fillStyle = wallColor;
        ctx.fillRect(x, y, TILE, TILE);
        
        if (isTopRow) {
          ctx.fillStyle = roofColor;
          ctx.fillRect(x, y, TILE, 10);
          ctx.fillStyle = roofDark;
          ctx.fillRect(x, y + 9, TILE, 2);
          ctx.fillStyle = "rgba(196, 30, 58, 0.6)";
          ctx.fillRect(x + 2, y + 3, TILE - 4, 4);
        }
        
        if (isLeftCol) {
          ctx.fillStyle = woodColor;
          ctx.fillRect(x, y + 6, 4, TILE - 6);
        }
        if (isRightCol) {
          ctx.fillStyle = woodColor;
          ctx.fillRect(x + TILE - 4, y + 6, 4, TILE - 6);
        }
        
        if (!isTopRow && !isBottomRow) {
          ctx.fillStyle = woodColor;
          ctx.fillRect(x, y + 8, TILE, 2);
          ctx.fillRect(x, y + 20, TILE, 2);
        }
        
        if (isTopRow && isLeftCol) {
          ctx.fillStyle = "#ffd700";
          ctx.fillRect(x + 2, y + 5, 3, 3);
        }
        if (isTopRow && isRightCol) {
          ctx.fillStyle = "#ffd700";
          ctx.fillRect(x + TILE - 5, y + 5, 3, 3);
        }
      }
    },
    HOUSE: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
        ctx.fillStyle = "#a1887f";
        ctx.fillRect(x, y, TILE, TILE);
      }
    },
    SHOP: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
        ctx.fillStyle = "#9b7d6f";
        ctx.fillRect(x, y, TILE, TILE);
      }
    },
    SHRINE: {
      renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
        ctx.fillStyle = "#8b6f47";
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  };
}

// Town definitions
export const townDefinitions = {
  hanamiTown: {
    id: 'hanamiTown',
    name: 'Hanami Town',
    areaLabel: 'hanamiTown',
    buildings: [
      {
        type: BUILDING_TYPES.DOJO,
        x: 13,
        y: 10,
        width: 5,
        height: 4,
        doorPos: { x: 15, y: 13 },
        interiorId: 'hanamiDojo',
        npcId: 'mrHanami'
      }
    ],
    overworldMap: null,
    interiorMaps: {
      hanamiDojo: null
    },
    
    generateOverworldMap() {
      const map = Array.from({ length: OVERWORLD_H }, (_, y) =>
        Array.from({ length: OVERWORLD_W }, (_, x) => {
          if (x === 0 || y === 0 || x === OVERWORLD_W - 1 || y === OVERWORLD_H - 1) {
            return TILE_TYPES.TREE;
          }
          return TILE_TYPES.GRASS;
        })
      );

      const pathX = 15;
      for (let y = 2; y < OVERWORLD_H - 2; y++) {
        map[y][pathX] = TILE_TYPES.PATH;
      }

      for (let x = 8; x <= 22; x++) {
        map[15][x] = TILE_TYPES.PATH;
      }

      for (const building of this.buildings) {
        for (let y = building.y; y < building.y + building.height; y++) {
          for (let x = building.x; x < building.x + building.width; x++) {
            map[y][x] = TILE_TYPES.WALL;
          }
        }
      }

      const building = this.buildings[0];
      map[building.doorPos.y][building.doorPos.x] = TILE_TYPES.DOOR;
      map[14][14] = TILE_TYPES.SIGNPOST;

      const treeClusters = [
        [4, 4], [5, 4], [4, 5], [24, 4], [25, 4], [24, 5],
        [5, 23], [4, 24], [24, 23], [25, 24], [22, 20], [8, 20]
      ];
      for (const [x, y] of treeClusters) {
        map[y][x] = TILE_TYPES.TREE;
      }

      const cherryBlossomPositions = [
        [15, 5], [14, 6], [15, 6], [16, 6], [14, 7], [15, 7], [16, 7]
      ];
      for (const [x, y] of cherryBlossomPositions) {
        if (x >= 0 && x < OVERWORLD_W && y >= 0 && y < OVERWORLD_H) {
          map[y][x] = TILE_TYPES.CHERRY_BLOSSOM;
        }
      }

      return map;
    },

    generateInteriorMap(interiorId) {
      const map = Array.from({ length: INTERIOR_H }, (_, y) =>
        Array.from({ length: INTERIOR_W }, (_, x) => {
          if (x === 0 || y === 0 || x === INTERIOR_W - 1 || y === INTERIOR_H - 1) {
            return TILE_TYPES.WALL;
          }
          return TILE_TYPES.INTERIOR_FLOOR;
        })
      );

      const door = { x: Math.floor(INTERIOR_W / 2), y: INTERIOR_H - 1 };
      map[door.y][door.x] = TILE_TYPES.DOOR;

      const trainingTile = { x: 4, y: 5 };
      map[trainingTile.y][trainingTile.x] = TILE_TYPES.TRAINING_FLOOR;

      return { map, door, trainingTile };
    }
  }
};

// Initialize town maps
export function initializeTowns() {
  for (const townId in townDefinitions) {
    const town = townDefinitions[townId];
    town.overworldMap = town.generateOverworldMap();
    for (const interiorId in town.interiorMaps) {
      const interior = town.generateInteriorMap(interiorId);
      town.interiorMaps[interiorId] = {
        map: interior.map,
        door: interior.door,
        trainingTile: interior.trainingTile
      };
    }
  }
}

// NPC Registry
export const npcRegistry = {
  mrHanami: {
    id: 'mrHanami',
    name: 'Mr. Hanami',
    spriteName: 'mr_hanami',
    desiredHeightTiles: 1.15,
    dialogue: [
      "Hello there!",
      "Welcome to the dojo.",
      "I train students here",
      "where they practice Hana Sakura style Karate",
      "which means \"the way of the cherry blossom\".",
      "Would you like me to teach you?"
    ],
    alreadyTrainingDialogue: "Your training has already begun. Focus your mind.",
    hasTrainingChoice: true,
    towns: {
      hanamiTown: {
        interiorId: 'hanamiDojo',
        x: 7 * 32,
        y: 4 * 32,
        dir: 'down'
      }
    }
  }
};

// Helper functions
export function getBuilding(townId, tileX, tileY) {
  const town = townDefinitions[townId];
  if (!town) return null;
  
  for (const building of town.buildings) {
    if (tileX >= building.x && tileX < building.x + building.width &&
        tileY >= building.y && tileY < building.y + building.height) {
      return building;
    }
  }
  return null;
}

export function renderBuildingTile(building, x, y, tileX, tileY) {
  const isTopRow = tileY === building.y;
  const isBottomRow = tileY === building.y + building.height - 1;
  const isLeftCol = tileX === building.x;
  const isRightCol = tileX === building.x + building.width - 1;

  if (!buildingRenderers) return false;
  const renderer = buildingRenderers[building.type];
  if (!renderer) return false;

  renderer.renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol);
  return true;
}

export function areaNameForTown(townId) {
  const town = townDefinitions[townId];
  return town ? town.areaLabel : null;
}
