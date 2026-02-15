// ============================================================================
// TILE SYSTEM - Strategy-based tile rendering
// ============================================================================

import { TILE_TYPES, TILE, COLORS, GAME_STATES } from "../core/constants.js";
import { renderBuildingTile } from "../WorldManager.js";

function drawGrassTile(ctx, x, y, tileX, tileY) {
  // Almost flat grass: base fill plus a few slightly darker speckles
  ctx.fillStyle = COLORS.GRASS;
  ctx.fillRect(x, y, TILE, TILE);

  // Draw a couple of tiny vertical blade-like speckles so they read as grass
  const blades = 2;
  for (let i = 0; i < blades; i++) {
    const sx = 2 + ((tileX * 13 + tileY * 7 + i * 11) % (TILE - 6));
    const sy = 6 + ((tileX * 5 + tileY * 17 + i * 19) % (TILE - 10));
    const h = 2 + ((tileX + tileY + i) % 2); // 2 or 3 px tall
    const color = i % 2 === 0 ? COLORS.GRASS_SPECKLE : COLORS.GRASS_DARK;
    ctx.fillStyle = color;
    ctx.fillRect(x + sx, y + sy, 1, h);
  }

  // Very subtle bottom shadow to anchor tiles (minimal)
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.fillRect(x, y + TILE - 3, TILE, 3);
}

const tileRenderers = {
  [TILE_TYPES.GRASS]: (ctx, deps) => {
    drawGrassTile(ctx, deps.x, deps.y, deps.tileX, deps.tileY);
  },

  [TILE_TYPES.PATH]: (ctx, deps) => {
    ctx.fillStyle = COLORS.PATH;
    ctx.fillRect(deps.x, deps.y, TILE, TILE);
  },

  [TILE_TYPES.TREE]: (ctx, deps) => {
    const { x, y, tileX, tileY } = deps;
    drawGrassTile(ctx, x, y, tileX, tileY);

    ctx.fillStyle = "#5d4037";
    ctx.fillRect(x + 12, y + 18, 8, 14);
    ctx.fillStyle = "#3e2723";
    ctx.fillRect(x + 12, y + 22, 8, 2);

    ctx.fillStyle = COLORS.TREE_DARK;
    ctx.beginPath();
    ctx.arc(x + 16, y + 16, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.TREE_LIGHT;
    ctx.beginPath();
    ctx.arc(x + 16, y + 10, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4caf50";
    ctx.beginPath();
    ctx.arc(x + 16, y + 5, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(76,175,80,0.6)";
    ctx.beginPath();
    ctx.arc(x + 14, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(46,125,50,0.6)";
    ctx.beginPath();
    ctx.arc(x + 18, y + 14, 4, 0, Math.PI * 2);
    ctx.fill();
  },

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
  },

  [TILE_TYPES.SIGNPOST]: (ctx, deps) => {
    ctx.fillStyle = COLORS.SIGNPOST_WOOD;
    ctx.fillRect(deps.x + 12, deps.y + 8, 8, 18);
    ctx.fillStyle = COLORS.SIGNPOST_SIGN;
    ctx.fillRect(deps.x + 6, deps.y + 6, 20, 10);
  },

  [TILE_TYPES.DOOR]: (ctx, deps) => {
    const isActiveDoor =
      deps.gameState === GAME_STATES.ENTERING_DOOR &&
      deps.tileX === deps.doorSequence.tx &&
      deps.tileY === deps.doorSequence.ty;

    ctx.fillStyle = isActiveDoor ? COLORS.DOOR_ACTIVE : COLORS.DOOR_INACTIVE;
    ctx.fillRect(deps.x, deps.y, TILE, TILE);

    ctx.fillStyle = isActiveDoor ? COLORS.DOOR_FRAME_ACTIVE : COLORS.DOOR_FRAME_INACTIVE;
    ctx.fillRect(deps.x + 6, deps.y + 4, 20, 24);

    ctx.fillStyle = COLORS.DOOR_KNOB;
    ctx.fillRect(deps.x + 18, deps.y + 14, 3, 3);
  },

  [TILE_TYPES.INTERIOR_FLOOR]: (ctx, deps) => {
    ctx.fillStyle = COLORS.INTERIOR_FLOOR_LIGHT;
    ctx.fillRect(deps.x, deps.y, TILE, TILE);

    ctx.strokeStyle = COLORS.INTERIOR_FLOOR_DARK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(deps.x, deps.y + TILE / 2);
    ctx.lineTo(deps.x + TILE, deps.y + TILE / 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(161, 136, 127, 0.4)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < TILE; i += 4) {
      ctx.beginPath();
      ctx.moveTo(deps.x + i, deps.y);
      ctx.lineTo(deps.x + i, deps.y + TILE);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(161, 136, 127, 0.2)";
    ctx.fillRect(deps.x, deps.y, 4, 4);
    ctx.fillRect(deps.x + TILE - 4, deps.y, 4, 4);
    ctx.fillRect(deps.x, deps.y + TILE - 4, 4, 4);
    ctx.fillRect(deps.x + TILE - 4, deps.y + TILE - 4, 4, 4);
  },

  [TILE_TYPES.CHERRY_BLOSSOM]: (ctx, deps) => {
    drawGrassTile(ctx, deps.x, deps.y, deps.tileX, deps.tileY);

    ctx.fillStyle = "#8b6f47";
    ctx.fillRect(deps.x + 11, deps.y + 16, 10, 16);
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(deps.x + 11, deps.y + 20, 10, 2);

    ctx.fillStyle = "#c24d6d";
    ctx.beginPath();
    ctx.arc(deps.x + 16, deps.y + 14, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d8749c";
    ctx.beginPath();
    ctx.arc(deps.x + 16, deps.y + 8, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e8a9c9";
    ctx.beginPath();
    ctx.arc(deps.x + 16, deps.y + 3, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 200, 220, 0.8)";
    const petalPositions = [
      [10, 8], [22, 8], [16, 3], [16, 20], [12, 14], [20, 14]
    ];

    for (const [px, py] of petalPositions) {
      ctx.beginPath();
      ctx.arc(deps.x + px, deps.y + py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  [TILE_TYPES.TRAINING_FLOOR]: (ctx, deps) => {
    ctx.fillStyle = COLORS.TRAINING_FLOOR_LIGHT;
    ctx.fillRect(deps.x, deps.y, TILE, TILE);
    ctx.fillStyle = COLORS.TRAINING_FLOOR_DARK;
    ctx.fillRect(deps.x + 2, deps.y + 2, TILE - 4, TILE - 4);
  }
};

export function drawTile(ctx, currentTownId, currentAreaId, gameState, doorSequence, type, x, y, tileX, tileY, getBuilding) {
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
    getBuilding
  });
}
