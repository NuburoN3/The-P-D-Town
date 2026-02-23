// ============================================================================
// COLLISION SYSTEM - Collision queries and tile blocking rules
// ============================================================================

import { TILE, TILE_TYPES } from "./constants.js";

/**
 * CollisionService provides tile and NPC collision helpers.
 */
export class CollisionService {
  /**
   * @param {{tileSize?: number, isTileBlocked?: ((tx:number, ty:number, px:number, py:number) => boolean) | null}} [opts]
   */
  constructor({ tileSize = TILE, isTileBlocked = null } = {}) {
    this.tileSize = tileSize;
    this.isTileBlocked = typeof isTileBlocked === "function" ? isTileBlocked : null;
  }

  /**
   * Check rectangle overlap between two axis-aligned rects.
   * @param {{x:number,y:number,width:number,height:number}} a
   * @param {{x:number,y:number,width:number,height:number}} b
   */
  rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Return the tile type at a pixel coordinate, or TREE if out of bounds.
   * @param {number} px
   * @param {number} py
   * @param {Array<Array<number>>} currentMap
   * @param {number} currentMapW
   * @param {number} currentMapH
   */
  tileAtPixel(px, py, currentMap, currentMapW, currentMapH) {
    const tx = Math.floor(px / this.tileSize);
    const ty = Math.floor(py / this.tileSize);
    if (tx < 0 || ty < 0 || tx >= currentMapW || ty >= currentMapH) {
      return TILE_TYPES.TREE;
    }
    return currentMap[ty][tx];
  }

  /**
   * Return whether a pixel location is considered blocked.
   */
  isBlockedAtPixel(px, py, currentMap, currentMapW, currentMapH) {
    const tile = this.tileAtPixel(px, py, currentMap, currentMapW, currentMapH);
    const blockedByTile = (
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
      tile === TILE_TYPES.HIFI ||
      tile === TILE_TYPES.OVAL_MIRROR
    );
    if (blockedByTile) return true;
    if (!this.isTileBlocked) return false;
    const tx = Math.floor(px / this.tileSize);
    const ty = Math.floor(py / this.tileSize);
    if (tx < 0 || ty < 0 || tx >= currentMapW || ty >= currentMapH) return true;
    return Boolean(this.isTileBlocked(tx, ty, px, py));
  }

  getNpcCollisionRect(npc) {
    const npcWidth = Number.isFinite(npc?.width) ? Math.max(1, npc.width) : this.tileSize;
    const npcHeight = Number.isFinite(npc?.height) ? Math.max(1, npc.height) : this.tileSize;
    const isAnimal = Boolean(npc?.obeyAnimal);
    const insetRatio = isAnimal ? 0.3 : 0.18;
    const insetX = Math.min(npcWidth * 0.45, Math.max(3, npcWidth * insetRatio));
    const insetY = Math.min(npcHeight * 0.45, Math.max(3, npcHeight * insetRatio));
    return {
      x: npc.x + insetX,
      y: npc.y + insetY,
      width: Math.max(1, npcWidth - insetX * 2),
      height: Math.max(1, npcHeight - insetY * 2)
    };
  }

  /**
   * Check whether placing a tile at nx,ny would collide with blocked tiles.
   */
  collides(nx, ny, currentMap, currentMapW, currentMapH) {
    const inset = 5;
    const right = nx + this.tileSize - inset;
    const bottom = ny + this.tileSize - inset;

    // iterate corner coordinates without allocating an array each call
    const checks = [
      [nx + inset, ny + inset],
      [right, ny + inset],
      [nx + inset, bottom],
      [right, bottom]
    ];

    for (let i = 0; i < 4; i++) {
      const [px, py] = checks[i];
      if (this.isBlockedAtPixel(px, py, currentMap, currentMapW, currentMapH)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check rectangle collision with NPCs in the same area.
   */
  collidesWithNPC(nx, ny, npcs, currentAreaId, currentX = null, currentY = null) {
    const playerRect = {
      x: nx + 5,
      y: ny + 5,
      width: this.tileSize - 10,
      height: this.tileSize - 10
    };

    for (const npc of npcs) {
      if (npc.world !== currentAreaId) continue;
      if (npc.isPlayerPet) continue;
      if (npc.blocking === false) continue;
      const npcRect = this.getNpcCollisionRect(npc);
      if (!this.rectsOverlap(playerRect, npcRect)) continue;
      if (Number.isFinite(currentX) && Number.isFinite(currentY)) {
        const currentRect = {
          x: currentX + 5,
          y: currentY + 5,
          width: this.tileSize - 10,
          height: this.tileSize - 10
        };
        const overlapsCurrent = this.rectsOverlap(currentRect, npcRect);
        if (overlapsCurrent) {
          const npcCenterX = npcRect.x + npcRect.width * 0.5;
          const npcCenterY = npcRect.y + npcRect.height * 0.5;
          const currentCenterX = currentRect.x + currentRect.width * 0.5;
          const currentCenterY = currentRect.y + currentRect.height * 0.5;
          const nextCenterX = playerRect.x + playerRect.width * 0.5;
          const nextCenterY = playerRect.y + playerRect.height * 0.5;
          const currentDistSq = (currentCenterX - npcCenterX) ** 2 + (currentCenterY - npcCenterY) ** 2;
          const nextDistSq = (nextCenterX - npcCenterX) ** 2 + (nextCenterY - npcCenterY) ** 2;
          // If already overlapping, let the player move away to avoid sticky trapping.
          if (nextDistSq > currentDistSq + 0.01) continue;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * If any corner overlaps a door tile, return its tx/ty.
   */
  doorFromCollision(nx, ny, currentMap, currentMapW, currentMapH) {

    const inset = 5;
    const right = nx + this.tileSize - inset;
    const bottom = ny + this.tileSize - inset;

    const checks = [
      [nx + inset, ny + inset],
      [right, ny + inset],
      [nx + inset, bottom],
      [right, bottom]
    ];

    for (let i = 0; i < 4; i++) {
      const [px, py] = checks[i];
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
