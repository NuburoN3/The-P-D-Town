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
      tile === TILE_TYPES.DOOR
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

  collidesWithNPC(nx, ny, npcs, currentAreaType) {
    const playerRect = {
      x: nx + 5,
      y: ny + 5,
      width: this.tileSize - 10,
      height: this.tileSize - 10
    };

    for (const npc of npcs) {
      if (npc.world !== currentAreaType) continue;
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

const defaultCollisionService = new CollisionService();

export function rectsOverlap(a, b) {
  return defaultCollisionService.rectsOverlap(a, b);
}

export function collidesWithNPC(nx, ny, npcs, currentAreaType) {
  return defaultCollisionService.collidesWithNPC(nx, ny, npcs, currentAreaType);
}

export function tileAtPixel(px, py, currentMap, currentMapW, currentMapH) {
  return defaultCollisionService.tileAtPixel(px, py, currentMap, currentMapW, currentMapH);
}

export function isBlockedAtPixel(px, py, currentMap, currentMapW, currentMapH) {
  return defaultCollisionService.isBlockedAtPixel(px, py, currentMap, currentMapW, currentMapH);
}

export function collides(nx, ny, currentMap, currentMapW, currentMapH) {
  return defaultCollisionService.collides(nx, ny, currentMap, currentMapW, currentMapH);
}

export function doorFromCollision(nx, ny, currentMap, currentMapW, currentMapH) {
  return defaultCollisionService.doorFromCollision(nx, ny, currentMap, currentMapW, currentMapH);
}
