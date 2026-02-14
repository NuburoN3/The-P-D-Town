// ============================================================================
// ENTITY MANAGER - Player, NPCs, and camera
// ============================================================================

import { TILE, PLAYER_SPRITE_HEIGHT_TILES, SPRITE_FRAME_WIDTH, SPRITE_FRAME_HEIGHT, SPRITE_FRAMES_PER_ROW } from './constants.js';
import { AssetManager } from './AssetManager.js';
import { npcRegistry } from './WorldManager.js';

// Player entity
export const player = {
  x: 15 * TILE,
  y: 18 * TILE,
  speed: 2.2,
  dir: "down",
  walking: false,
  frame: 0,
  animTimer: 0,
  animFrame: 1,
  sprite: null,
  desiredHeightTiles: PLAYER_SPRITE_HEIGHT_TILES
};

// Camera
export const cam = { x: 0, y: 0 };

// NPCs array
export let npcs = [];

// Initialize player sprite
export function initializePlayer() {
  player.sprite = AssetManager.getSprite('protagonist');
}

// Load NPCs for a specific town
export function loadNPCsForTown(townId) {
  npcs.length = 0;
  
  for (const npcId in npcRegistry) {
    const npcDef = npcRegistry[npcId];
    const townData = npcDef.towns[townId];
    
    if (townData) {
      npcs.push({
        id: npcId,
        world: townData.interiorId,
        x: townData.x,
        y: townData.y,
        width: TILE,
        height: TILE,
        desiredHeightTiles: npcDef.desiredHeightTiles,
        name: npcDef.name,
        sprite: AssetManager.getSprite(npcDef.spriteName),
        dialogue: npcDef.dialogue,
        alreadyTrainingDialogue: npcDef.alreadyTrainingDialogue,
        hasTrainingChoice: npcDef.hasTrainingChoice,
        dir: townData.dir
      });
    }
  }
}

// Get player tile position
export function playerTilePosition() {
  return {
    x: Math.floor((player.x + TILE / 2) / TILE),
    y: Math.floor((player.y + TILE / 2) / TILE)
  };
}

// Update player animation
export function updatePlayerAnimation() {
  if (player.walking) {
    player.animTimer += 1;
    if (player.animTimer >= 8) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % SPRITE_FRAMES_PER_ROW;
    }
  } else {
    player.animTimer = 0;
    player.animFrame = 1;
  }
}
