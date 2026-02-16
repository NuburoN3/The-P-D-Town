// ============================================================================
// COLLISION SYSTEM - Collision queries and tile blocking rules
// ============================================================================

import { TILE, TILE_TYPES } from "./constants.js";

export class CollisionService {
  constructor({ tileSize = TILE } = {}) {
    this.tileSize = tileSize;
  }

  rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  tileAtPixel(px, py, currentMap, currentMapW, currentMapH) {
    const tx = Math.floor(px / this.tileSize);
    const ty = Math.floor(py / this.tileSize);
    if (tx < 0 || ty < 0 || tx >= currentMapW || ty >= currentMapH) {
      return TILE_TYPES.TREE;
    }
    return currentMap[ty][tx];
  }

  isBlockedAtPixel(px, py, currentMap, currentMapW, currentMapH) {
    const tile = this.tileAtPixel(px, py, currentMap, currentMapW, currentMapH);
    return (
      tile === TILE_TYPES.TREE ||
      tile === TILE_TYPES.WALL ||
      tile === TILE_TYPES.SIGNPOST ||
      tile === TILE_TYPES.DOOR ||
      tile === TILE_TYPES.BAR_COUNTER ||
      tile === TILE_TYPES.BAR_TABLE ||
      tile === TILE_TYPES.BAR_DECOR ||
      tile === TILE_TYPES.BAR_POSTER ||
      tile === TILE_TYPES.CHURCH_STAINED_GLASS ||
      tile === TILE_TYPES.BED ||
      tile === TILE_TYPES.TV ||
      tile === TILE_TYPES.HIFI
    );
  }

  collides(nx, ny, currentMap, currentMapW, currentMapH) {
    const inset = 5;
    const corners = [
      [nx + inset, ny + inset],
      [nx + this.tileSize - inset, ny + inset],
      [nx + inset, ny + this.tileSize - inset],
      [nx + this.tileSize - inset, ny + this.tileSize - inset]
    ];

    for (const [px, py] of corners) {
      if (this.isBlockedAtPixel(px, py, currentMap, currentMapW, currentMapH)) {
        return true;
      }
    }

    return false;
  }

  collidesWithNPC(nx, ny, npcs, currentAreaId) {
    const playerRect = {
      x: nx + 5,
      y: ny + 5,
      width: this.tileSize - 10,
      height: this.tileSize - 10
    };

    for (const npc of npcs) {
      if (npc.world !== currentAreaId) continue;
      if (npc.blocking === false) continue;
      if (this.rectsOverlap(playerRect, npc)) return true;
    }

    return false;
  }

  doorFromCollision(nx, ny, currentMap, currentMapW, currentMapH) {
    const inset = 5;
    const corners = [
      [nx + inset, ny + inset],
      [nx + this.tileSize - inset, ny + inset],
      [nx + inset, ny + this.tileSize - inset],
      [nx + this.tileSize - inset, ny + this.tileSize - inset]
    ];

    for (const [px, py] of corners) {
      const tx = Math.floor(px / this.tileSize);
      const ty = Math.floor(py / this.tileSize);
      if (tx < 0 || ty < 0 || tx >= currentMapW || ty >= currentMapH) continue;
      if (currentMap[ty][tx] === TILE_TYPES.DOOR) {
        return { tx, ty };
      }
    }

    return null;
  }
}
