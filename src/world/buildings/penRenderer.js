export function createPenRenderer(ctx, tileSize) {
  return {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
      const localX = tileX - building.x;
      const gateCenter = Math.floor(building.width / 2);
      const isGateTile =
        isBottomRow &&
        (localX === gateCenter || (building.width % 2 === 0 && localX === gateCenter - 1));
      const onFence = (isTopRow || isBottomRow || isLeftCol || isRightCol) && !isGateTile;

      const dirtDark = "#7d6040";
      const dirtLight = "#9b7a55";
      const fenceDark = "#6a482f";
      const fenceLight = "#9b734f";

      ctx.fillStyle = dirtDark;
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = dirtLight;
      ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

      if (onFence) {
        ctx.fillStyle = fenceDark;
        if (isTopRow || isBottomRow) {
          ctx.fillRect(x, y + (isTopRow ? 2 : tileSize - 5), tileSize, 3);
        }
        if (isLeftCol || isRightCol) {
          ctx.fillRect(x + (isLeftCol ? 2 : tileSize - 5), y, 3, tileSize);
        }
        ctx.fillStyle = fenceLight;
        for (let i = 5; i < tileSize - 4; i += 6) {
          ctx.fillRect(x + i, y + 1, 2, tileSize - 2);
        }
      } else if (isGateTile) {
        ctx.fillStyle = "#c8a37a";
        ctx.fillRect(x + 8, y + tileSize - 6, 16, 4);
      } else {
        ctx.fillStyle = "rgba(198, 165, 99, 0.34)";
        ctx.fillRect(x + 7, y + 9, 3, 2);
        ctx.fillRect(x + 14, y + 15, 4, 2);
        ctx.fillRect(x + 21, y + 11, 3, 2);
      }

      ctx.strokeStyle = "rgba(42,30,18,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
    }
  };
}
