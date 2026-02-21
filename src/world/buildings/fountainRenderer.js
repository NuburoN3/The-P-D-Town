import { classifyFountainTile, FOUNTAIN_TILE_KIND } from "../fountainGeometry.js";
import { getFountainRenderSprite } from "./fountainSprite.js";

export function createFountainRenderer(ctx, tileSize) {
  const drawnThisFrame = new Set();

  function renderFallbackTile(x, y, tileX, tileY, building) {
    const localX = tileX - building.x;
    const localY = tileY - building.y;

    const stoneDark = "#6e7d8b";
    const stoneMid = "#8ea0b0";
    const stoneLight = "#b4c5d2";
    const waterDeep = "#2d7da6";
    const waterMid = "#49a3ca";
    const waterLight = "#8fd8f0";

    const tileKind = classifyFountainTile(building, tileX, tileY);

    if (tileKind === FOUNTAIN_TILE_KIND.OUTER_RING) {
      ctx.fillStyle = stoneDark;
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = stoneLight;
      ctx.fillRect(x + 2, y + 2, tileSize - 4, 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x + 2, y + tileSize - 4, tileSize - 4, 2);
    } else if (tileKind === FOUNTAIN_TILE_KIND.CENTER_PLINTH) {
      ctx.fillStyle = stoneMid;
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = stoneLight;
      ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + 4, y + tileSize - 8, tileSize - 8, 2);
    } else if (tileKind === FOUNTAIN_TILE_KIND.INNER_BASIN_EDGE) {
      ctx.fillStyle = stoneMid;
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + 2, y + 2, tileSize - 4, 2);
    } else {
      const waterGradient = ctx.createLinearGradient(x, y, x, y + tileSize);
      waterGradient.addColorStop(0, waterLight);
      waterGradient.addColorStop(0.55, waterMid);
      waterGradient.addColorStop(1, waterDeep);
      ctx.fillStyle = waterGradient;
      ctx.fillRect(x, y, tileSize, tileSize);

      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x + 6, y + 6, 6, 1);
      ctx.fillRect(x + 16, y + 12, 7, 1);
      ctx.fillRect(x + 10, y + 20, 5, 1);
    }

    const center = Math.floor(building.width / 2);
    if (localX === center && localY === center) {
      ctx.fillStyle = stoneDark;
      ctx.fillRect(x + 13, y + 7, 6, 16);
      ctx.fillStyle = stoneLight;
      ctx.fillRect(x + 14, y + 8, 4, 13);

      ctx.fillStyle = "#dff7ff";
      ctx.fillRect(x + 15, y + 4, 2, 2);
      ctx.fillRect(x + 15, y + 2, 2, 1);
    }

    if (
      (localX === center && (localY === center - 2 || localY === center + 2)) ||
      (localY === center && (localX === center - 2 || localX === center + 2))
    ) {
      ctx.fillStyle = "#eefcff";
      ctx.fillRect(x + 14, y + 10, 4, 3);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(x + 15, y + 8, 2, 2);
    }

    ctx.strokeStyle = "rgba(20,35,45,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
  }

  return {
    beginFrame() {
      drawnThisFrame.clear();
    },
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
      const localX = tileX - building.x;
      const localY = tileY - building.y;
      const renderSprite = getFountainRenderSprite();
      if (renderSprite) {
        const key = building.id || `${building.x},${building.y},${building.width},${building.height}`;
        if (drawnThisFrame.has(key)) return;
        drawnThisFrame.add(key);
        const drawX = x - localX * tileSize;
        const drawY = y - localY * tileSize;
        ctx.fillStyle = "#c9ab74";
        ctx.fillRect(drawX, drawY, building.width * tileSize, building.height * tileSize);
        ctx.drawImage(renderSprite, drawX, drawY, building.width * tileSize, building.height * tileSize);
        return;
      }

      renderFallbackTile(x, y, tileX, tileY, building);
    }
  };
}
