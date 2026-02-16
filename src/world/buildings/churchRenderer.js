export function createChurchRenderer(ctx, tileSize) {
  return {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
      const localX = tileX - building.x;
      const centerX = Math.floor(building.width / 2);
      const stoneDark = "#6b6f7c";
      const stoneMid = "#8f96a6";
      const stoneLight = "#b7bfd1";
      const trimGold = "#d4c28e";
      const roofDark = "#4f2121";
      const roofMid = "#7f3a3a";

      ctx.fillStyle = stoneDark;
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = stoneMid;
      ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

      if (isTopRow) {
        ctx.fillStyle = roofDark;
        ctx.fillRect(x - 1, y, tileSize + 2, 8);
        ctx.fillStyle = roofMid;
        ctx.fillRect(x + 1, y + 1, tileSize - 2, 4);
      }

      if (!isTopRow && !isBottomRow && !isLeftCol && !isRightCol) {
        ctx.fillStyle = "#3e2f3a";
        ctx.fillRect(x + 10, y + 10, 12, 14);
        ctx.fillStyle = "#9dd4ef";
        ctx.fillRect(x + 12, y + 12, 8, 9);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.fillRect(x + 15, y + 12, 1, 9);
        ctx.fillRect(x + 12, y + 16, 8, 1);
      }

      if (isBottomRow && localX === centerX) {
        ctx.fillStyle = "#4b3429";
        ctx.fillRect(x + 8, y + 9, 16, 23);
        ctx.fillStyle = "#6d4a37";
        ctx.fillRect(x + 10, y + 11, 12, 19);
        ctx.fillStyle = trimGold;
        ctx.fillRect(x + 15, y + 11, 1, 19);
      }

      if (isTopRow && localX === centerX) {
        ctx.fillStyle = trimGold;
        ctx.fillRect(x + 14, y - 11, 4, 14);
        ctx.fillRect(x + 11, y - 8, 10, 3);
      }

      ctx.fillStyle = stoneLight;
      ctx.fillRect(x + 2, y + 2, tileSize - 4, 1);
      ctx.strokeStyle = "rgba(28,32,46,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
    }
  };
}
