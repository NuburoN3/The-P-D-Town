// ============================================================================
// TILE SYSTEM - Stylized tile rendering with neighbor-aware transitions
// ============================================================================

import { TILE_TYPES, TILE, COLORS, GAME_STATES } from "../core/constants.js";
import { BUILDING_TYPES, renderBuildingTile } from "../WorldManager.js";

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
  ctx.arc(x + 16, y + 13, 12.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.TREE_DARK;
  ctx.beginPath();
  ctx.arc(x + 8, y + 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 24, y + 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 16, y + 17, 7.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.TREE_MID;
  ctx.beginPath();
  ctx.arc(x + 16, y + 8.5, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 10, y + 7, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 22, y + 7, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 13, y + 16, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 19, y + 16, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.TREE_LIGHT;
  ctx.beginPath();
  ctx.arc(x + 13, y + 5.8, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 20, y + 5.2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 16, y + 6, 3, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 8; i++) {
    const sx = 7 + ((n >> (i * 3 + 2)) % 18);
    const sy = 3 + ((n >> (i * 4 + 1)) % 10);
    ctx.fillStyle = i % 3 === 0 ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)";
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
  ctx.arc(x + 16, y + 12, 11.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.CHERRY_MID;
  ctx.beginPath();
  ctx.arc(x + 9, y + 11, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 23, y + 11, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 16, y + 7, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 13, y + 15, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 19, y + 15, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.CHERRY_LIGHT;
  for (let i = 0; i < 10; i++) {
    const sx = 7 + ((n >> (i * 3 + 1)) % 18);
    const sy = 2 + ((n >> (i * 4 + 2)) % 12);
    const size = i % 3 === 0 ? 2 : 1;
    ctx.fillRect(x + sx, y + sy, size, size);
  }

  // Falling petal accents
  if ((n & 7) === 2) {
    ctx.fillStyle = "rgba(255, 215, 230, 0.9)";
    ctx.fillRect(x + 9, y + 23, 1, 1);
    ctx.fillRect(x + 22, y + 25, 1, 1);
  }
}

function drawSignpostTile(ctx, deps) {
  // Paint path base beneath signposts so they don't appear on raw grass.
  drawPathTile(ctx, deps);

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
  const building = deps.getBuilding
    ? deps.getBuilding(deps.currentTownId, deps.currentAreaId, deps.tileX, deps.tileY)
    : null;
  const isDojoDoor = building && building.type === "DOJO";

  if (isDojoDoor) {
    // Dojo entrance: open/sliding threshold style, not a standard standalone door tile.
    const localX = deps.tileX - building.x;
    const center = Math.floor(building.width / 2);
    const leftEntranceCol = Math.max(0, center - 1);
    const isLeftPanel = localX === leftEntranceCol;

    const frameDark = "#4e3123";
    const frameMid = "#6f4a35";
    const paper = "#f0e5cd";

    ctx.fillStyle = frameDark;
    ctx.fillRect(deps.x, deps.y, TILE, TILE);

    ctx.fillStyle = frameMid;
    ctx.fillRect(deps.x + 1, deps.y + 1, TILE - 2, TILE - 2);

    // Header beam under eaves.
    ctx.fillStyle = "#3e261b";
    ctx.fillRect(deps.x, deps.y + 2, TILE, 5);

    // Entrance opening + one visible slider panel to imply a wider doorway.
    ctx.fillStyle = "rgba(18,12,9,0.65)";
    ctx.fillRect(deps.x + 6, deps.y + 8, 20, 22);

    ctx.fillStyle = frameDark;
    ctx.fillRect(isLeftPanel ? deps.x + 16 : deps.x + 6, deps.y + 8, 10, 22);
    ctx.fillStyle = paper;
    ctx.fillRect(isLeftPanel ? deps.x + 18 : deps.x + 8, deps.y + 10, 6, 18);
    ctx.fillStyle = "rgba(94,61,42,0.45)";
    ctx.fillRect(isLeftPanel ? deps.x + 21 : deps.x + 11, deps.y + 10, 1, 18);

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(deps.x, deps.y + TILE - 2, TILE, 2);
    return;
  }

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

function drawBarFloorTile(ctx, deps) {
  const alt = (deps.tileX + deps.tileY) % 2 === 0;
  ctx.fillStyle = alt ? COLORS.BAR_FLOOR_LIGHT : COLORS.BAR_FLOOR_DARK;
  ctx.fillRect(deps.x, deps.y, TILE, TILE);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(deps.x + 4, deps.y);
  ctx.lineTo(deps.x + 4, deps.y + TILE);
  ctx.moveTo(deps.x + 16, deps.y);
  ctx.lineTo(deps.x + 16, deps.y + TILE);
  ctx.moveTo(deps.x + 28, deps.y);
  ctx.lineTo(deps.x + 28, deps.y + TILE);
  ctx.stroke();

  ctx.strokeStyle = COLORS.BAR_FLOOR_TRIM;
  ctx.lineWidth = 1;
  ctx.strokeRect(deps.x + 1.5, deps.y + 1.5, TILE - 3, TILE - 3);
}

function drawBarCounterTile(ctx, deps) {
  drawBarFloorTile(ctx, deps);
  ctx.fillStyle = COLORS.BAR_COUNTER_FRONT;
  ctx.fillRect(deps.x + 2, deps.y + 10, TILE - 4, 20);
  ctx.fillStyle = COLORS.BAR_COUNTER_TOP;
  ctx.fillRect(deps.x + 1, deps.y + 6, TILE - 2, 7);
  ctx.fillStyle = COLORS.BAR_COUNTER_EDGE;
  ctx.fillRect(deps.x + 2, deps.y + 7, TILE - 4, 2);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(deps.x + 2, deps.y + 26, TILE - 4, 2);
}

function drawBarStoolTile(ctx, deps) {
  drawBarFloorTile(ctx, deps);
  ctx.fillStyle = COLORS.BAR_STOOL_LEG;
  ctx.fillRect(deps.x + 14, deps.y + 12, 4, 13);
  ctx.fillStyle = COLORS.BAR_STOOL_SEAT;
  ctx.fillRect(deps.x + 9, deps.y + 8, 14, 6);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(deps.x + 10, deps.y + 9, 5, 1);
}

function drawBarTableTile(ctx, deps) {
  drawBarFloorTile(ctx, deps);
  ctx.fillStyle = COLORS.BAR_TABLE_LEG;
  ctx.fillRect(deps.x + 14, deps.y + 13, 4, 14);
  ctx.fillStyle = COLORS.BAR_TABLE_TOP;
  ctx.beginPath();
  ctx.ellipse(deps.x + 16, deps.y + 11, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(deps.x + 11, deps.y + 9, 6, 1);
}

function drawBarDecorTile(ctx, deps) {
  drawBarFloorTile(ctx, deps);
  ctx.fillStyle = "#5b3825";
  ctx.fillRect(deps.x + 6, deps.y + 7, 20, 18);
  ctx.fillStyle = COLORS.BAR_DECOR;
  ctx.fillRect(deps.x + 8, deps.y + 9, 16, 4);
  ctx.fillRect(deps.x + 8, deps.y + 16, 16, 4);
  ctx.fillStyle = "#f0d28a";
  ctx.fillRect(deps.x + 9, deps.y + 10, 3, 2);
  ctx.fillRect(deps.x + 17, deps.y + 17, 3, 2);
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

function drawPorchTile(ctx, deps) {
  ctx.fillStyle = COLORS.PORCH_WOOD_DARK;
  ctx.fillRect(deps.x, deps.y, TILE, TILE);

  ctx.fillStyle = COLORS.PORCH_WOOD_MID;
  ctx.fillRect(deps.x + 1, deps.y + 1, TILE - 2, TILE - 2);

  for (let i = 4; i < TILE; i += 6) {
    ctx.fillStyle = i % 12 === 4 ? COLORS.PORCH_WOOD_LIGHT : COLORS.PORCH_WOOD_MID;
    ctx.fillRect(deps.x, deps.y + i, TILE, 1);
  }

  ctx.strokeStyle = "rgba(39,24,15,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(deps.x + 0.5, deps.y + 0.5, TILE - 1, TILE - 1);

  // Front corner support posts for dojo porch (on front row only).
  if (!deps.getBuilding) return;
  const backOne = deps.getBuilding(deps.currentTownId, deps.currentAreaId, deps.tileX, deps.tileY - 1);
  const backTwo = deps.getBuilding(deps.currentTownId, deps.currentAreaId, deps.tileX, deps.tileY - 2);
  const dojo = (backOne && backOne.type === "DOJO") ? backOne : (backTwo && backTwo.type === "DOJO" ? backTwo : null);
  if (!dojo) return;

  const frontRowY = dojo.y + dojo.height + 1;
  const isFrontRow = deps.tileY === frontRowY;
  const isCorner = deps.tileX === dojo.x || deps.tileX === dojo.x + dojo.width - 1;
  if (!isFrontRow || !isCorner) return;

  ctx.fillStyle = "#4b311f";
  ctx.fillRect(deps.x + 12, deps.y + 4, 8, TILE - 4);
  ctx.fillStyle = "#6a4630";
  ctx.fillRect(deps.x + 14, deps.y + 4, 4, TILE - 4);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(deps.x + 11, deps.y + TILE - 3, 10, 2);
}

function drawDojoPostTile(ctx, deps) {
  // Practice posts sit on packed dirt so they read as training equipment near the dojo.
  drawPathTile(ctx, deps);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(deps.x + 16, deps.y + 24, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.DOJO_POST_WOOD_DARK;
  ctx.fillRect(deps.x + 13, deps.y + 8, 6, 18);
  ctx.fillStyle = COLORS.DOJO_POST_WOOD_MID;
  ctx.fillRect(deps.x + 14, deps.y + 9, 4, 16);

  // Binding rope wraps.
  ctx.fillStyle = COLORS.DOJO_POST_ROPE;
  ctx.fillRect(deps.x + 12, deps.y + 11, 8, 2);
  ctx.fillRect(deps.x + 12, deps.y + 16, 8, 2);
  ctx.fillRect(deps.x + 12, deps.y + 21, 8, 2);
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
  [TILE_TYPES.BAR_FLOOR]: (ctx, deps) => drawBarFloorTile(ctx, deps),
  [TILE_TYPES.BAR_COUNTER]: (ctx, deps) => drawBarCounterTile(ctx, deps),
  [TILE_TYPES.BAR_STOOL]: (ctx, deps) => drawBarStoolTile(ctx, deps),
  [TILE_TYPES.BAR_TABLE]: (ctx, deps) => drawBarTableTile(ctx, deps),
  [TILE_TYPES.BAR_DECOR]: (ctx, deps) => drawBarDecorTile(ctx, deps),
  [TILE_TYPES.TRAINING_FLOOR]: (ctx, deps) => drawTrainingFloorTile(ctx, deps),
  [TILE_TYPES.CHERRY_BLOSSOM]: (ctx, deps) => drawCherryBlossomTile(ctx, deps),
  [TILE_TYPES.PORCH]: (ctx, deps) => drawPorchTile(ctx, deps),
  [TILE_TYPES.DOJO_POST]: (ctx, deps) => drawDojoPostTile(ctx, deps)
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
  if (getBuilding) {
    const building = getBuilding(currentTownId, currentAreaId, tileX, tileY);
    if (building && building.type === BUILDING_TYPES.FOUNTAIN) {
      const rendered = renderBuildingTile(building, x, y, tileX, tileY);
      if (rendered) return;
    }
  }

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
