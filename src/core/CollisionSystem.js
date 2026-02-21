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
  collidesWithNPC(nx, ny, npcs, currentAreaId) {
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
      if (this.rectsOverlap(playerRect, npc)) return true;
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
