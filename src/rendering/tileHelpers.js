import { TILE_TYPES } from "../core/constants.js";

export function hash2(x, y, seed = 0) {
  const n = x * 374761393 + y * 668265263 + seed * 982451653;
  return (n ^ (n >> 13)) >>> 0;
}

export function sampleTile(deps, x, y) {
  if (!deps.getTileAt) return null;
  return deps.getTileAt(x, y);
}

export function isShadowNeighborTile(tileType) {
  return (
    tileType === TILE_TYPES.TREE ||
    tileType === TILE_TYPES.WALL ||
    tileType === TILE_TYPES.CHERRY_BLOSSOM ||
    tileType === TILE_TYPES.HILL
  );
}

export function isGrassFamilyTile(tileType) {
  return (
    tileType === TILE_TYPES.GRASS ||
    tileType === TILE_TYPES.HILL ||
    tileType === TILE_TYPES.CHERRY_BLOSSOM ||
    tileType === TILE_TYPES.TREE
  );
}
