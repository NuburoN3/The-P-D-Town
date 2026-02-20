let dojoEntryWallSprite = null;
let dojoEntryWallSpriteLoaded = false;
let dojoBackWallSprite = null;
let dojoBackWallSpriteLoaded = false;
let dojoRoofSprite = null;
let dojoRoofSpriteLoaded = false;
let dojoMiddleOverhangSprite = null;
let dojoMiddleOverhangSpriteLoaded = false;

function getDojoEntryWallSprite() {
  if (dojoEntryWallSpriteLoaded) return dojoEntryWallSprite;
  dojoEntryWallSpriteLoaded = true;
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = "assets/sprites/Dojo Entry_Wall.png";
  dojoEntryWallSprite = img;
  return dojoEntryWallSprite;
}

function getDojoBackWallSprite() {
  if (dojoBackWallSpriteLoaded) return dojoBackWallSprite;
  dojoBackWallSpriteLoaded = true;
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = "assets/sprites/outside_Dojo_Back_wall.png";
  dojoBackWallSprite = img;
  return dojoBackWallSprite;
}

function getDojoRoofSprite() {
  if (dojoRoofSpriteLoaded) return dojoRoofSprite;
  dojoRoofSpriteLoaded = true;
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = "assets/sprites/Outside Dojo Roof.png";
  dojoRoofSprite = img;
  return dojoRoofSprite;
}

function getDojoMiddleOverhangSprite() {
  if (dojoMiddleOverhangSpriteLoaded) return dojoMiddleOverhangSprite;
  dojoMiddleOverhangSpriteLoaded = true;
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = "assets/sprites/Dojo Middle Overhang.png";
  dojoMiddleOverhangSprite = img;
  return dojoMiddleOverhangSprite;
}

export function createDojoRenderer(ctx, tileSize) {
  return {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
      const localX = tileX - building.x;
      const center = Math.floor(building.width / 2);
      const leftEntranceCol = Math.max(0, center - 1);
      const rightEntranceCol = center;
      const isEntranceColumn = localX === leftEntranceCol || localX === rightEntranceCol;

      const roofShadow = "rgba(16,10,8,0.5)";
      const wallWoodDark = "#4b311f";
      const wallWoodMid = "#69452d";
      const wallWoodLight = "#8a5f3f";
      const trimGold = "#b58f53";
      const signBg = "#3f291c";
      const shojiPaper = "#e8dec4";

      // Low, wide wooden wall body.
      ctx.fillStyle = wallWoodDark;
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = wallWoodMid;
      ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

      // Horizontal beam pattern (no brick/plaster style).
      for (let py = 4; py < tileSize - 3; py += 6) {
        ctx.fillStyle = py % 12 === 4 ? wallWoodLight : wallWoodMid;
        ctx.fillRect(x + 1, y + py, tileSize - 2, 1);
      }

      // Temple roof drawn once with 1 tile overhang on each side.
      if (isTopRow && isLeftCol) {
        const roofX = x - tileSize;
        const roofTop = y - tileSize;
        const roofW = (building.width + 2) * tileSize;
        const roofSprite = getDojoRoofSprite();
        if (roofSprite && (roofSprite.width > 0 || roofSprite.complete)) {
          ctx.drawImage(roofSprite, roofX, roofTop, roofW, tileSize);
        }

        // Mid-façade overhang on the second floor.
        // Drawn here so the existing foreground occluder redraw can place it in front of the player.
        const middleOverhangSprite = getDojoMiddleOverhangSprite();
        if (middleOverhangSprite && (middleOverhangSprite.width > 0 || middleOverhangSprite.complete)) {
          const overhangW = (building.width + 3) * tileSize;
          const overhangH = Math.max(1, Math.round(tileSize * 0.5));
          const overhangX = x - tileSize - Math.floor(tileSize * 0.5);
          const overhangY = y + tileSize - Math.floor(overhangH * 0.5);
          ctx.drawImage(middleOverhangSprite, overhangX, overhangY, overhangW, overhangH);
        }
      }

      // Dark shadow line under roof eaves.
      if (isTopRow) {
        ctx.fillStyle = roofShadow;
        ctx.fillRect(x, y, tileSize, 4);
      }

      // Strong corner/segment pillars.
      if (isLeftCol) {
        ctx.fillStyle = wallWoodDark;
        ctx.fillRect(x + 1, y + 10, 4, tileSize - 10);
      }
      if (isRightCol) {
        ctx.fillStyle = wallWoodDark;
        ctx.fillRect(x + tileSize - 5, y + 10, 4, tileSize - 10);
      }

      // Shoji wall section (replaces normal windows).
      if (!isTopRow && !isBottomRow && !isLeftCol && !isRightCol) {
        ctx.fillStyle = wallWoodDark;
        ctx.fillRect(x + 5, y + 13, 22, 11);
        ctx.fillStyle = shojiPaper;
        ctx.fillRect(x + 7, y + 15, 18, 7);
        ctx.fillStyle = "rgba(72,46,31,0.45)";
        ctx.fillRect(x + 13, y + 15, 1, 7);
        ctx.fillRect(x + 19, y + 15, 1, 7);
      }

      // Hanging dojo sign/banner above entrance.
      if (!isTopRow && !isBottomRow && isEntranceColumn) {
        ctx.fillStyle = "#eadfc5";
        ctx.fillRect(x + 6, y + 13, 20, 7);
        ctx.fillStyle = "rgba(70,44,29,0.24)";
        ctx.fillRect(x + 12, y + 13, 1, 7);
        ctx.fillRect(x + 19, y + 13, 1, 7);
        ctx.fillStyle = signBg;
        ctx.fillRect(x + 11, y + 21, 10, 6);
        ctx.strokeStyle = trimGold;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 11.5, y + 21.5, 9, 5);
      }

      // Replace the row directly above aura entry tiles with sprite art.
      if (isTopRow && isRightCol) {
        const backWallSprite = getDojoBackWallSprite();
        if (backWallSprite && (backWallSprite.width > 0 || backWallSprite.complete)) {
          const drawX = x - (building.width - 1) * tileSize;
          ctx.drawImage(backWallSprite, drawX, y, building.width * tileSize, tileSize);
        }
      }

      if (isBottomRow) {
        // Replace the full dojo front bottom row (walls + entry span) with sprite art.
        if (isRightCol) {
          const entryWallSprite = getDojoEntryWallSprite();
          if (entryWallSprite && (entryWallSprite.width > 0 || entryWallSprite.complete)) {
            const drawX = x - (building.width - 1) * tileSize;
            ctx.drawImage(entryWallSprite, drawX, y, building.width * tileSize, tileSize);
          }
        }

        // Make the 3 center front tiles match the dojo interior floor when entering/leaving.
        const middleStart = Math.floor((building.width - 3) / 2);
        const isMiddleFrontFloorTile = localX >= middleStart && localX < middleStart + 3;
        if (isMiddleFrontFloorTile) {
          const seed = ((tileX * 73856093) ^ (tileY * 19349663)) >>> 0;
          ctx.fillStyle = "#6f5a4c";
          ctx.fillRect(x, y, tileSize + 1, tileSize + 1);
          ctx.fillStyle = "rgba(245, 225, 199, 0.06)";
          ctx.fillRect(x + 3 + (seed % 22), y + 6 + ((seed >>> 5) % 18), 2, 1);
          ctx.fillStyle = "rgba(45, 30, 24, 0.07)";
          ctx.fillRect(x + 4 + ((seed >>> 9) % 20), y + 8 + ((seed >>> 14) % 16), 2, 1);
        }
      }

      // Intentionally no per-tile stroke on dojo exterior: keeps facade seamless.
    }
  };
}
