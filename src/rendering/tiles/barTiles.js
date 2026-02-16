import { COLORS, TILE } from "../../core/constants.js";

export function drawBarFloorTile(ctx, deps) {
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

export function drawBarCounterTile(ctx, deps) {
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

export function drawBarStoolTile(ctx, deps) {
  drawBarFloorTile(ctx, deps);
  ctx.fillStyle = COLORS.BAR_STOOL_LEG;
  ctx.fillRect(deps.x + 14, deps.y + 12, 4, 13);
  ctx.fillStyle = COLORS.BAR_STOOL_SEAT;
  ctx.fillRect(deps.x + 9, deps.y + 8, 14, 6);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(deps.x + 10, deps.y + 9, 5, 1);
}

export function drawBarTableTile(ctx, deps) {
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

export function drawBarDecorTile(ctx, deps) {
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

export function drawBarPosterTile(ctx, deps) {
  drawBarFloorTile(ctx, deps);
  ctx.fillStyle = "#4b2e22";
  ctx.fillRect(deps.x + 6, deps.y + 4, 20, 24);

  ctx.fillStyle = COLORS.BAR_POSTER_BG || "#c94b3b";
  ctx.fillRect(deps.x + 8, deps.y + 6, 16, 20);

  ctx.fillStyle = COLORS.BAR_POSTER_ACCENT || "#f4e0a8";
  ctx.fillRect(deps.x + 10, deps.y + 8, 12, 3);

  // Cherry icon + cola stripe
  ctx.fillStyle = "#8d131f";
  ctx.beginPath();
  ctx.arc(deps.x + 13, deps.y + 15, 2, 0, Math.PI * 2);
  ctx.arc(deps.x + 18, deps.y + 15, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f7d16f";
  ctx.fillRect(deps.x + 11, deps.y + 19, 10, 2);
  ctx.fillRect(deps.x + 12, deps.y + 22, 8, 1);
}
