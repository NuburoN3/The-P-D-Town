import { COLORS } from "../../core/constants.js";
import { hash2 } from "../../rendering/tileHelpers.js";

const IRISH_DRAGON_BAR_SRC = "assets/sprites/TheIrishDragonOutsideBuilding.png";
const IRISH_DRAGON_DRAW_WIDTH_TILES = 6.18;
const IRISH_DRAGON_DRAW_HEIGHT_TILES = 5;
const IRISH_DRAGON_DRAW_OFFSET_X_TILES = -0.52;
const IRISH_DRAGON_DRAW_OFFSET_Y_TILES = 0;
const irishDragonBarSprite = loadIrishDragonBarSprite();

function loadIrishDragonBarSprite() {
  const img = new Image();
  img.src = IRISH_DRAGON_BAR_SRC;
  return img;
}

export function drawIrishDragonBarForeground(ctx, cam, tileSize, building) {
  if (!building || !irishDragonBarSprite.complete || irishDragonBarSprite.naturalWidth <= 0) return;

  const drawX = (building.x + IRISH_DRAGON_DRAW_OFFSET_X_TILES) * tileSize - cam.x;
  const drawY = (building.y + IRISH_DRAGON_DRAW_OFFSET_Y_TILES) * tileSize - cam.y;
  const drawWidth = IRISH_DRAGON_DRAW_WIDTH_TILES * tileSize;
  const drawHeight = IRISH_DRAGON_DRAW_HEIGHT_TILES * tileSize;

  const sideClipY = drawY + tileSize * 1.55;
  const sideClipH = tileSize * 2.05;
  const sideClipW = tileSize * 1.18;
  const rightClipX = drawX + drawWidth - sideClipW;
  const roofClipY = drawY;
  const roofClipH = tileSize * 1.9;

  ctx.save();
  ctx.beginPath();
  ctx.rect(drawX, roofClipY, drawWidth, roofClipH);
  ctx.rect(drawX, sideClipY, sideClipW, sideClipH);
  ctx.rect(rightClipX, sideClipY, sideClipW, sideClipH);
  ctx.clip();
  ctx.drawImage(irishDragonBarSprite, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function drawGrassBackdrop(ctx, tileSize, x, y, tileX, tileY) {
  const n = hash2(tileX, tileY, 3);
  const bleed = 2;

  ctx.fillStyle = (tileX + tileY) % 2 === 0 ? COLORS.GRASS : COLORS.GRASS_MID;
  ctx.fillRect(x - bleed, y - bleed, tileSize + bleed * 2, tileSize + bleed * 2);

  ctx.fillStyle = "rgba(255,255,255,0.09)";
  for (let i = 0; i < 4; i++) {
    const sx = 2 + ((n >> (i * 5)) % (tileSize - 6));
    const sy = 2 + ((n >> (i * 6 + 2)) % (tileSize - 6));
    ctx.fillRect(x + sx, y + sy, 1, 1);
  }

  for (let i = 0; i < 7; i++) {
    const sx = 1 + ((n >> (i * 3 + 1)) % (tileSize - 3));
    const sy = 2 + ((n >> (i * 4 + 2)) % (tileSize - 6));
    const h = 2 + ((n >> (i * 5 + 4)) % 3);
    ctx.fillStyle = i % 2 === 0 ? COLORS.GRASS_DARK : COLORS.GRASS_SPECKLE;
    ctx.fillRect(x + sx, y + sy, 1, h);
  }
}

function renderLegacyBarTile(ctx, tileSize, x, y, isTopRow, isBottomRow, isLeftCol, isRightCol) {
  const roofDark = "#3e1f19";
  const roofLight = "#704034";
  const awningDark = "#7a3032";
  const awningLight = "#d8c29a";
  const wallBase = "#b48a61";
  const wallShade = "#8f6a48";
  const woodDark = "#4f3121";
  const woodMid = "#6d432b";
  const windowGlow = "#f8c977";
  const trim = "#e0be74";

  ctx.fillStyle = wallBase;
  ctx.fillRect(x, y, tileSize, tileSize);

  if (isTopRow) {
    ctx.fillStyle = roofDark;
    ctx.fillRect(x - 2, y - 2, tileSize + 4, 12);
    ctx.fillStyle = roofLight;
    ctx.fillRect(x, y, tileSize, 7);
    ctx.fillStyle = trim;
    ctx.fillRect(x + 1, y + 7, tileSize - 2, 2);

    for (let i = 0; i < tileSize; i += 4) {
      ctx.fillStyle = (i / 4) % 2 === 0 ? awningDark : awningLight;
      ctx.fillRect(x + i, y + 9, 4, 3);
    }
  }

  ctx.fillStyle = wallShade;
  ctx.fillRect(x, y + tileSize - 5, tileSize, 5);

  if (isLeftCol) {
    ctx.fillStyle = woodDark;
    ctx.fillRect(x + 1, y + 10, 4, tileSize - 10);
  }
  if (isRightCol) {
    ctx.fillStyle = woodDark;
    ctx.fillRect(x + tileSize - 5, y + 10, 4, tileSize - 10);
  }

  if (!isTopRow && !isBottomRow && !isLeftCol && !isRightCol) {
    ctx.fillStyle = woodMid;
    ctx.fillRect(x + 7, y + 13, 18, 12);
    ctx.fillStyle = woodDark;
    ctx.fillRect(x + 8, y + 14, 16, 10);
    ctx.fillStyle = windowGlow;
    ctx.fillRect(x + 10, y + 16, 12, 6);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x + 11, y + 17, 3, 2);
    ctx.fillRect(x + 17, y + 18, 2, 1);
  }

  if (isBottomRow && !isLeftCol && !isRightCol) {
    ctx.fillStyle = woodDark;
    ctx.fillRect(x + 7, y + 10, 18, 22);
    ctx.fillStyle = "#7f553a";
    ctx.fillRect(x + 9, y + 12, 14, 18);
    ctx.fillStyle = "#9d6a48";
    ctx.fillRect(x + 12, y + 13, 1, 15);
    ctx.fillRect(x + 19, y + 13, 1, 15);
    ctx.fillStyle = trim;
    ctx.fillRect(x + 17, y + 21, 2, 2);
  }

  if (isTopRow && !isLeftCol && !isRightCol) {
    ctx.fillStyle = "#2f1f18";
    ctx.fillRect(x + 5, y + 12, 22, 8);
    ctx.strokeStyle = trim;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5.5, y + 12.5, 21, 7);
    ctx.fillStyle = "#f5d88e";
    ctx.font = "bold 5px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("SAKABA", x + 6, y + 14);
  }
}

export function createBarRenderer(ctx, tileSize) {
  return {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
      const localX = tileX - building.x;
      const localY = tileY - building.y;
      const isLastTile = localX === building.width - 1 && localY === building.height - 1;

      drawGrassBackdrop(ctx, tileSize, x, y, tileX, tileY);

      if (irishDragonBarSprite.complete && irishDragonBarSprite.naturalWidth > 0) {
        if (!isLastTile) return;

        const drawX = x - (localX * tileSize) + (IRISH_DRAGON_DRAW_OFFSET_X_TILES * tileSize);
        const drawY = y - (localY * tileSize) + (IRISH_DRAGON_DRAW_OFFSET_Y_TILES * tileSize);
        const drawWidth = IRISH_DRAGON_DRAW_WIDTH_TILES * tileSize;
        const drawHeight = IRISH_DRAGON_DRAW_HEIGHT_TILES * tileSize;

        ctx.drawImage(irishDragonBarSprite, drawX, drawY, drawWidth, drawHeight);
        return;
      }

      renderLegacyBarTile(ctx, tileSize, x, y, isTopRow, isBottomRow, isLeftCol, isRightCol);
    }
  };
}
