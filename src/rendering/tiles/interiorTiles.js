import { COLORS, TILE } from "../../core/constants.js";

export function drawInteriorFloorTile(ctx, deps) {
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

export function drawTrainingFloorTile(ctx, deps) {
  ctx.fillStyle = COLORS.TRAINING_FLOOR_DARK;
  ctx.fillRect(deps.x, deps.y, TILE, TILE);

  ctx.fillStyle = COLORS.TRAINING_FLOOR_LIGHT;
  ctx.fillRect(deps.x + 2, deps.y + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = COLORS.TRAINING_FLOOR_DARK;
  ctx.fillRect(deps.x + 7, deps.y + 7, TILE - 14, TILE - 14);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(deps.x + 12, deps.y + 12, TILE - 24, TILE - 24);
}

export function drawChurchStainedGlassTile(ctx, deps) {
  drawInteriorFloorTile(ctx, deps);

  ctx.fillStyle = COLORS.CHURCH_GLASS_FRAME || "#4b3b33";
  ctx.fillRect(deps.x + 5, deps.y + 2, 22, 28);

  ctx.fillStyle = "#e6d0ac";
  ctx.fillRect(deps.x + 6, deps.y + 3, 20, 26);

  // Multicolor panes to read as stained glass.
  ctx.fillStyle = "#8b2d41";
  ctx.fillRect(deps.x + 8, deps.y + 6, 6, 7);
  ctx.fillStyle = "#2f6f8c";
  ctx.fillRect(deps.x + 17, deps.y + 6, 7, 7);
  ctx.fillStyle = "#5a4d97";
  ctx.fillRect(deps.x + 8, deps.y + 16, 6, 8);
  ctx.fillStyle = "#d1993f";
  ctx.fillRect(deps.x + 17, deps.y + 16, 7, 8);

  ctx.fillStyle = COLORS.CHURCH_GLASS_LEAD || "#2f2f38";
  ctx.fillRect(deps.x + 15, deps.y + 5, 1, 20);
  ctx.fillRect(deps.x + 8, deps.y + 14, 16, 1);

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(deps.x + 10, deps.y + 7, 1, 5);
  ctx.fillRect(deps.x + 19, deps.y + 7, 1, 5);
  ctx.fillRect(deps.x + 10, deps.y + 17, 1, 5);
  ctx.fillRect(deps.x + 19, deps.y + 17, 1, 5);
}

export function drawBedTile(ctx, deps) {
  drawInteriorFloorTile(ctx, deps);
  ctx.fillStyle = COLORS.BED_FRAME || "#6b4a30";
  ctx.fillRect(deps.x + 4, deps.y + 6, 24, 22);
  ctx.fillStyle = COLORS.BED_SHEET || "#f1e9d2";
  ctx.fillRect(deps.x + 6, deps.y + 8, 20, 8);
  ctx.fillStyle = COLORS.BED_BLANKET || "#b56576";
  ctx.fillRect(deps.x + 6, deps.y + 16, 20, 10);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(deps.x + 7, deps.y + 17, 8, 1);
}

export function drawTvTile(ctx, deps) {
  drawInteriorFloorTile(ctx, deps);
  ctx.fillStyle = COLORS.TV_FRAME || "#27272d";
  ctx.fillRect(deps.x + 5, deps.y + 7, 22, 16);
  ctx.fillStyle = COLORS.TV_SCREEN || "#5ea2b8";
  ctx.fillRect(deps.x + 7, deps.y + 9, 18, 11);
  ctx.fillStyle = COLORS.TV_GLOW || "rgba(170, 233, 255, 0.35)";
  ctx.fillRect(deps.x + 9, deps.y + 11, 8, 3);
  ctx.fillStyle = "#1f1f25";
  ctx.fillRect(deps.x + 14, deps.y + 23, 4, 4);
  ctx.fillRect(deps.x + 11, deps.y + 27, 10, 2);
}

export function drawHifiTile(ctx, deps) {
  drawInteriorFloorTile(ctx, deps);
  ctx.fillStyle = COLORS.HIFI_BODY || "#3d3b46";
  ctx.fillRect(deps.x + 6, deps.y + 10, 20, 14);
  ctx.fillStyle = COLORS.HIFI_SPEAKER || "#222127";
  ctx.fillRect(deps.x + 8, deps.y + 12, 5, 10);
  ctx.fillRect(deps.x + 19, deps.y + 12, 5, 10);
  ctx.fillStyle = COLORS.HIFI_ACCENT || "#93b7d8";
  ctx.fillRect(deps.x + 14, deps.y + 13, 4, 2);
  ctx.fillRect(deps.x + 14, deps.y + 17, 4, 1);
  ctx.fillRect(deps.x + 14, deps.y + 20, 4, 1);
}
