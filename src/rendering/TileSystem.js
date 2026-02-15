// ============================================================================
// TILE SYSTEM - Stylized tile rendering with neighbor-aware transitions
// ============================================================================

import { TILE_TYPES, TILE, COLORS, GAME_STATES } from "../core/constants.js";
import { renderBuildingTile } from "../WorldManager.js";

function hash2(x, y, seed = 0) {
  const n = x * 374761393 + y * 668265263 + seed * 982451653;
  return (n ^ (n >> 13)) >>> 0;
}

function sampleTile(deps, x, y) {
  if (!deps.getTileAt) return null;
  return deps.getTileAt(x, y);
}

function isShadowNeighborTile(tileType) {
  return (
    tileType === TILE_TYPES.TREE ||
    tileType === TILE_TYPES.WALL ||
    tileType === TILE_TYPES.CHERRY_BLOSSOM
  );
}

function isGrassFamilyTile(tileType) {
  return (
    tileType === TILE_TYPES.GRASS ||
    tileType === TILE_TYPES.CHERRY_BLOSSOM ||
    tileType === TILE_TYPES.TREE
  );
}

function drawGrassTile(ctx, deps) {
  const { x, y, tileX, tileY } = deps;
  const n = hash2(tileX, tileY, 3);

  ctx.fillStyle = (tileX + tileY) % 2 === 0 ? COLORS.GRASS : COLORS.GRASS_MID;
  ctx.fillRect(x, y, TILE, TILE);

  ctx.fillStyle = "rgba(255,255,255,0.09)";
  for (let i = 0; i < 4; i++) {
    const sx = 2 + ((n >> (i * 5)) % (TILE - 6));
    const sy = 2 + ((n >> (i * 6 + 2)) % (TILE - 6));
    ctx.fillRect(x + sx, y + sy, 1, 1);
  }

  for (let i = 0; i < 7; i++) {
    const sx = 1 + ((n >> (i * 3 + 1)) % (TILE - 3));
    const sy = 2 + ((n >> (i * 4 + 2)) % (TILE - 6));
    const h = 2 + ((n >> (i * 5 + 4)) % 3);
    ctx.fillStyle = i % 2 === 0 ? COLORS.GRASS_DARK : COLORS.GRASS_SPECKLE;
    ctx.fillRect(x + sx, y + sy, 1, h);
  }

  const left = sampleTile(deps, tileX - 1, tileY);
  const right = sampleTile(deps, tileX + 1, tileY);
  const top = sampleTile(deps, tileX, tileY - 1);
  const bottom = sampleTile(deps, tileX, tileY + 1);

  ctx.fillStyle = "rgba(0,0,0,0.12)";
  if (isShadowNeighborTile(left)) ctx.fillRect(x, y, 3, TILE);
  if (isShadowNeighborTile(right)) ctx.fillRect(x + TILE - 3, y, 3, TILE);
  if (isShadowNeighborTile(top)) ctx.fillRect(x, y, TILE, 3);
  if (isShadowNeighborTile(bottom)) ctx.fillRect(x, y + TILE - 3, TILE, 3);

  ctx.fillStyle = COLORS.GRASS_LIGHT;
  if (left === TILE_TYPES.PATH) ctx.fillRect(x, y + 1, 2, TILE - 2);
  if (right === TILE_TYPES.PATH) ctx.fillRect(x + TILE - 2, y + 1, 2, TILE - 2);
  if (top === TILE_TYPES.PATH) ctx.fillRect(x + 1, y, TILE - 2, 2);
  if (bottom === TILE_TYPES.PATH) ctx.fillRect(x + 1, y + TILE - 2, TILE - 2, 2);

  if ((n & 31) === 9) {
    ctx.fillStyle = "#e8f7b1";
    ctx.fillRect(x + 11, y + 17, 1, 1);
    ctx.fillRect(x + 12, y + 16, 1, 1);
    ctx.fillRect(x + 13, y + 17, 1, 1);
    ctx.fillRect(x + 12, y + 18, 1, 1);
  }
}

function drawPathTile(ctx, deps) {
  const { x, y, tileX, tileY } = deps;
  const n = hash2(tileX, tileY, 19);

  ctx.fillStyle = COLORS.PATH;
  ctx.fillRect(x, y, TILE, TILE);

  for (let i = 0; i < 10; i++) {
    const sx = 2 + ((n >> (i * 2 + 1)) % (TILE - 4));
    const sy = 2 + ((n >> (i * 3 + 2)) % (TILE - 4));
    ctx.fillStyle = i % 3 === 0 ? COLORS.PATH_DARK : COLORS.PATH_LIGHT;
    ctx.fillRect(x + sx, y + sy, 1, 1);
  }

  const same = (tx, ty) => {
    const t = sampleTile(deps, tx, ty);
    return t === TILE_TYPES.PATH;
  };

  const connectTop = same(tileX, tileY - 1);
  const connectBottom = same(tileX, tileY + 1);
  const connectLeft = same(tileX - 1, tileY);
  const connectRight = same(tileX + 1, tileY);

  ctx.fillStyle = COLORS.PATH_EDGE;
  if (!connectTop) ctx.fillRect(x, y, TILE, 3);
  if (!connectBottom) ctx.fillRect(x, y + TILE - 3, TILE, 3);
  if (!connectLeft) ctx.fillRect(x, y, 3, TILE);
  if (!connectRight) ctx.fillRect(x + TILE - 3, y, 3, TILE);

  ctx.fillStyle = COLORS.PATH_LIGHT;
  if (!connectTop) ctx.fillRect(x + 2, y + 1, TILE - 4, 1);
  if (!connectLeft) ctx.fillRect(x + 1, y + 2, 1, TILE - 4);

  const grassNeighbor = (tx, ty) => isGrassFamilyTile(sampleTile(deps, tx, ty));

  ctx.fillStyle = COLORS.GRASS_DARK;
  if (!connectTop && grassNeighbor(tileX, tileY - 1)) {
    for (let px = 2; px < TILE - 2; px += 3) {
      ctx.fillRect(x + px, y + 1, 1, 1);
    }
  }
  if (!connectBottom && grassNeighbor(tileX, tileY + 1)) {
    for (let px = 1; px < TILE - 2; px += 4) {
      ctx.fillRect(x + px, y + TILE - 2, 1, 1);
    }
  }
}

function drawTreeTile(ctx, deps) {
  const { x, y, tileX, tileY } = deps;
  const n = hash2(tileX, tileY, 47);

  drawGrassTile(ctx, deps);

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 25, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.TREE_TRUNK_DARK;
  ctx.fillRect(x + 11, y + 18, 10, 14);
  ctx.fillStyle = COLORS.TREE_TRUNK;
  ctx.fillRect(x + 12, y + 18, 8, 13);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(x + 13, y + 19, 2, 10);

  ctx.fillStyle = COLORS.TREE_DEEP;
  ctx.beginPath();
  ctx.arc(x + 16, y + 13, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.TREE_DARK;
  ctx.beginPath();
  ctx.arc(x + 9, y + 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 23, y + 12, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.TREE_MID;
  ctx.beginPath();
  ctx.arc(x + 16, y + 8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 10, y + 7, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 22, y + 7, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.TREE_LIGHT;
  ctx.beginPath();
  ctx.arc(x + 13, y + 6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 20, y + 5, 3.5, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const sx = 7 + ((n >> (i * 3 + 2)) % 18);
    const sy = 3 + ((n >> (i * 4 + 1)) % 10);
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
    ctx.fillRect(x + sx, y + sy, 1, 1);
  }
}

function drawCherryBlossomTile(ctx, deps) {
  const { x, y, tileX, tileY } = deps;
  const n = hash2(tileX, tileY, 83);

  drawGrassTile(ctx, deps);

  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 25, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.TREE_TRUNK_DARK;
  ctx.fillRect(x + 11, y + 16, 10, 16);
  ctx.fillStyle = COLORS.TREE_TRUNK;
  ctx.fillRect(x + 12, y + 16, 8, 15);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x + 14, y + 17, 1, 11);

  ctx.fillStyle = COLORS.CHERRY_DARK;
  ctx.beginPath();
  ctx.arc(x + 16, y + 12, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.CHERRY_MID;
  ctx.beginPath();
  ctx.arc(x + 9, y + 11, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 23, y + 11, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 16, y + 7, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.CHERRY_LIGHT;
  for (let i = 0; i < 8; i++) {
    const sx = 7 + ((n >> (i * 3 + 1)) % 18);
    const sy = 2 + ((n >> (i * 4 + 2)) % 12);
    ctx.fillRect(x + sx, y + sy, 2, 2);
  }
}

function drawSignpostTile(ctx, deps) {
  ctx.fillStyle = COLORS.SIGNPOST_WOOD;
  ctx.fillRect(deps.x + 12, deps.y + 8, 8, 18);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(deps.x + 13, deps.y + 9, 1, 16);

  ctx.fillStyle = COLORS.SIGNPOST_SIGN;
  ctx.fillRect(deps.x + 5, deps.y + 5, 22, 11);
  ctx.strokeStyle = "#8a7f75";
  ctx.lineWidth = 1;
  ctx.strokeRect(deps.x + 5.5, deps.y + 5.5, 21, 10);
  ctx.fillStyle = "#78695a";
  ctx.fillRect(deps.x + 9, deps.y + 9, 14, 1);
  ctx.fillRect(deps.x + 9, deps.y + 12, 10, 1);
}

function drawDoorTile(ctx, deps) {
  const isActiveDoor =
    deps.gameState === GAME_STATES.ENTERING_DOOR &&
    deps.tileX === deps.doorSequence.tx &&
    deps.tileY === deps.doorSequence.ty;

  ctx.fillStyle = isActiveDoor ? COLORS.DOOR_ACTIVE : COLORS.DOOR_INACTIVE;
  ctx.fillRect(deps.x, deps.y, TILE, TILE);

  ctx.fillStyle = isActiveDoor ? COLORS.DOOR_FRAME_ACTIVE : COLORS.DOOR_FRAME_INACTIVE;
  ctx.fillRect(deps.x + 5, deps.y + 3, 22, 26);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(deps.x + 6, deps.y + 4, 1, 24);

  ctx.fillStyle = COLORS.DOOR_KNOB;
  ctx.fillRect(deps.x + 19, deps.y + 15, 3, 3);
}

function drawInteriorFloorTile(ctx, deps) {
  const alt = (deps.tileX + deps.tileY) % 2 === 0;
  ctx.fillStyle = alt ? COLORS.INTERIOR_FLOOR_LIGHT : COLORS.INTERIOR_FLOOR_DARK;
  ctx.fillRect(deps.x, deps.y, TILE, TILE);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(deps.x + 1.5, deps.y + 1.5, TILE - 3, TILE - 3);

  ctx.strokeStyle = COLORS.INTERIOR_FLOOR_TRIM;
  ctx.lineWidth = 1;
  ctx.strokeRect(deps.x + 4.5, deps.y + 4.5, TILE - 9, TILE - 9);
}

function drawTrainingFloorTile(ctx, deps) {
  ctx.fillStyle = COLORS.TRAINING_FLOOR_DARK;
  ctx.fillRect(deps.x, deps.y, TILE, TILE);

  ctx.fillStyle = COLORS.TRAINING_FLOOR_LIGHT;
  ctx.fillRect(deps.x + 2, deps.y + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = COLORS.TRAINING_FLOOR_DARK;
  ctx.fillRect(deps.x + 7, deps.y + 7, TILE - 14, TILE - 14);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(deps.x + 12, deps.y + 12, TILE - 24, TILE - 24);
}

const tileRenderers = {
  [TILE_TYPES.GRASS]: (ctx, deps) => drawGrassTile(ctx, deps),
  [TILE_TYPES.PATH]: (ctx, deps) => drawPathTile(ctx, deps),
  [TILE_TYPES.TREE]: (ctx, deps) => drawTreeTile(ctx, deps),
  [TILE_TYPES.WALL]: (ctx, deps) => {
    const building = deps.getBuilding
      ? deps.getBuilding(deps.currentTownId, deps.currentAreaId, deps.tileX, deps.tileY)
      : null;
    if (building) {
      const rendered = renderBuildingTile(building, deps.x, deps.y, deps.tileX, deps.tileY);
      if (rendered) return;
    }

    ctx.fillStyle = COLORS.WALL;
    ctx.fillRect(deps.x, deps.y, TILE, TILE);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(deps.x + 2, deps.y + 2, TILE - 4, 1);
  },
  [TILE_TYPES.SIGNPOST]: (ctx, deps) => drawSignpostTile(ctx, deps),
  [TILE_TYPES.DOOR]: (ctx, deps) => drawDoorTile(ctx, deps),
  [TILE_TYPES.INTERIOR_FLOOR]: (ctx, deps) => drawInteriorFloorTile(ctx, deps),
  [TILE_TYPES.TRAINING_FLOOR]: (ctx, deps) => drawTrainingFloorTile(ctx, deps),
  [TILE_TYPES.CHERRY_BLOSSOM]: (ctx, deps) => drawCherryBlossomTile(ctx, deps)
};

export function drawTile(
  ctx,
  currentTownId,
  currentAreaId,
  gameState,
  doorSequence,
  type,
  x,
  y,
  tileX,
  tileY,
  getBuilding,
  getTileAt
) {
  const renderer = tileRenderers[type];
  if (!renderer) return;

  renderer(ctx, {
    currentTownId,
    currentAreaId,
    gameState,
    doorSequence,
    type,
    x,
    y,
    tileX,
    tileY,
    getBuilding,
    getTileAt
  });
}
