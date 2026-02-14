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
        // Enhanced Japanese dojo with beautiful pixel art style
        const roofDarkRed = "#8b2020";
        const roofBrightRed = "#d32f2f";
        const roofHighlight = "#ff6b6b";
        const woodDark = "#5d4037";
        const woodMid = "#795548";
        const woodLight = "#a1887f";
        const wallLight = "#e8d5c4";
        const wallMid = "#d4af7a";
        const wallDark = "#b8956a";
        const shadowColor = "#3e2723";
        const goldAccent = "#ffd700";
        const goldDark = "#daa520";
        const windowColor = "#87ceeb";
        
        // Main wall body with gradient effect
        ctx.fillStyle = wallLight;
        ctx.fillRect(x, y, TILE, TILE);
        
        // Wall shading - darker on bottom for depth
        ctx.fillStyle = "rgba(184, 149, 106, 0.4)";
        ctx.fillRect(x, y + 20, TILE, 12);
        
        // Wall texture - subtle horizontal lines
        ctx.strokeStyle = "rgba(139, 69, 19, 0.15)";
        ctx.lineWidth = 1;
        for (let i = 0; i < TILE; i += 4) {
          ctx.beginPath();
          ctx.moveTo(x, y + i);
          ctx.lineTo(x + TILE, y + i);
          ctx.stroke();
        }
        
        // ROOF (TOP ROW)
        if (isTopRow) {
          // Base roof - broad overhang
          ctx.fillStyle = roofDarkRed;
          ctx.fillRect(x - 2, y - 2, TILE + 4, 12);
          
          // Bright red main roof
          ctx.fillStyle = roofBrightRed;
          ctx.fillRect(x, y, TILE, 9);
          
          // Roof highlight
          ctx.fillStyle = roofHighlight;
          ctx.fillRect(x + 2, y + 1, TILE - 4, 3);
          
          // Roof ridge shadow
          ctx.fillStyle = roofDarkRed;
          ctx.fillRect(x + 1, y + 5, TILE - 2, 2);
          
          // Decorative roof tiles
          for (let i = 0; i < TILE; i += 4) {
            ctx.fillStyle = roofDarkRed;
            ctx.fillRect(x + i, y + 7, 3, 2);
          }
          
          // Gold decorative trim at roof edge
          ctx.fillStyle = goldDark;
          ctx.fillRect(x, y + 9, TILE, 2);
          
          // Corner ornaments
          if (isLeftCol) {
            ctx.fillStyle = goldAccent;
            ctx.beginPath();
            ctx.arc(x + 4, y + 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = goldDark;
            ctx.beginPath();
            ctx.arc(x + 4, y + 5, 1, 0, Math.PI * 2);
            ctx.fill();
          }
          if (isRightCol) {
            ctx.fillStyle = goldAccent;
            ctx.beginPath();
            ctx.arc(x + TILE - 4, y + 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = goldDark;
            ctx.beginPath();
            ctx.arc(x + TILE - 4, y + 5, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        // WOODEN STRUCTURAL POSTS
        if (isLeftCol) {
          // Left pillar with 3D effect
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + 1, y + 10, 5, TILE - 10);
          ctx.fillStyle = woodMid;
          ctx.fillRect(x + 2, y + 10, 3, TILE - 10);
          
          // Post shadow and highlight
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x + 1, y + 10, 2, TILE - 10);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(x + 4, y + 10, 1, TILE - 10);
        }
        
        if (isRightCol) {
          // Right pillar
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + TILE - 6, y + 10, 5, TILE - 10);
          ctx.fillStyle = woodMid;
          ctx.fillRect(x + TILE - 5, y + 10, 3, TILE - 10);
          
          // Post details
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x + TILE - 6, y + 10, 2, TILE - 10);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(x + TILE - 3, y + 10, 1, TILE - 10);
        }
        
        // HORIZONTAL BEAMS
        if (!isTopRow && !isBottomRow) {
          // Upper beam with 3D effect
          ctx.fillStyle = woodDark;
          ctx.fillRect(x, y + 12, TILE, 2);
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x, y + 12, TILE, 1);
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(x, y + 13, TILE, 1);
          
          // Lower beam
          ctx.fillStyle = woodDark;
          ctx.fillRect(x, y + 22, TILE, 2);
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x, y + 22, TILE, 1);
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(x, y + 23, TILE, 1);
        }
        
        // WINDOWS on middle rows
        if (!isTopRow && !isBottomRow && !isLeftCol && !isRightCol) {
          // Window frame
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + 8, y + 14, 16, 10);
          
          // Window panes
          ctx.fillStyle = windowColor;
          ctx.fillRect(x + 10, y + 16, 6, 6);
          ctx.fillRect(x + 18, y + 16, 6, 6);
          
          // Window reflection
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.fillRect(x + 11, y + 17, 2, 2);
          ctx.fillRect(x + 19, y + 17, 2, 2);
          
          // Window divider
          ctx.strokeStyle = woodDark;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 16, y + 16);
          ctx.lineTo(x + 16, y + 22);
          ctx.stroke();
        }
        
        // DOOR FRAME on bottom center
        if (isBottomRow && !isLeftCol && !isRightCol) {
          // Door frame
          ctx.fillStyle = woodDark;
          ctx.fillRect(x + 6, y + 12, 20, 20);
          
          // Door panels
          ctx.fillStyle = "#6d4c41";
          ctx.fillRect(x + 8, y + 14, 8, 16);
          ctx.fillRect(x + 18, y + 14, 8, 16);
          
          // Door panel details
          ctx.fillStyle = "#4caf50";
          ctx.fillRect(x + 9, y + 15, 2, 14);
          ctx.fillRect(x + 19, y + 15, 2, 14);
          
          // Gold ring door handles
          ctx.fillStyle = goldAccent;
          ctx.beginPath();
          ctx.arc(x + 12, y + 22, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + 22, y + 22, 1.5, 0, Math.PI * 2);
          ctx.fill();
          
          // Handle shadows
          ctx.fillStyle = goldDark;
          ctx.beginPath();
          ctx.arc(x + 12, y + 22, 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + 22, y + 22, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // DECORATIVE BORDER
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, TILE, TILE);
        
        // Inner highlight
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        
        // CORNER ORNAMENTS
        if (isTopRow && isLeftCol) {
          ctx.fillStyle = goldAccent;
          ctx.fillRect(x + 2, y + 4, 4, 4);
          ctx.fillStyle = goldDark;
          ctx.fillRect(x + 3, y + 5, 2, 2);
        }
        
        if (isTopRow && isRightCol) {
          ctx.fillStyle = goldAccent;
          ctx.fillRect(x + TILE - 6, y + 4, 4, 4);
          ctx.fillStyle = goldDark;
          ctx.fillRect(x + TILE - 5, y + 5, 2, 2);
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
