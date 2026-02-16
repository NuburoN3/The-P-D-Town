export function createDojoRenderer(ctx, tileSize) {
  return {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol, building) {
      const localX = tileX - building.x;
      const center = Math.floor(building.width / 2);
      const leftEntranceCol = Math.max(0, center - 1);
      const rightEntranceCol = center;
      const isEntranceColumn = localX === leftEntranceCol || localX === rightEntranceCol;

      const roofEdge = "#521814";
      const roofMid = "#7e2922";
      const roofLight = "#b74a3a";
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

      // Temple roof drawn once: 2 tiles tall, 1 tile overhang on each side.
      // Keep silhouette flatter so the dojo reads grounded and wide.
      if (isTopRow && isLeftCol) {
        const roofX = x - tileSize;
        const roofTop = y - tileSize * 2;
        const roofW = (building.width + 2) * tileSize;

        // Lower roof mass reaches wall top so it doesn't float.
        ctx.fillStyle = roofMid;
        ctx.fillRect(roofX + 8, roofTop + 38, roofW - 16, 20);
        ctx.fillStyle = roofEdge;
        ctx.fillRect(roofX, roofTop + 48, roofW, 16);

        // Upper slope and ridge highlight.
        ctx.fillStyle = roofEdge;
        ctx.fillRect(roofX + 14, roofTop + 28, roofW - 28, 10);
        ctx.fillStyle = roofMid;
        ctx.fillRect(roofX + 20, roofTop + 22, roofW - 40, 8);
        ctx.fillStyle = roofLight;
        ctx.fillRect(roofX + 26, roofTop + 24, roofW - 52, 3);

        // Slight curved slope hint using side wedges.
        ctx.fillStyle = roofEdge;
        ctx.beginPath();
        ctx.moveTo(roofX, roofTop + 48);
        ctx.lineTo(roofX + 14, roofTop + 36);
        ctx.lineTo(roofX + 14, roofTop + 62);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(roofX + roofW, roofTop + 48);
        ctx.lineTo(roofX + roofW - 14, roofTop + 36);
        ctx.lineTo(roofX + roofW - 14, roofTop + 62);
        ctx.closePath();
        ctx.fill();
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

      if (isBottomRow) {
        // Wall base above front engawa.
        ctx.fillStyle = wallWoodDark;
        ctx.fillRect(x, y + 24, tileSize, 2);

        if (isEntranceColumn) {
          // Wide sliding entrance framing (actual DOOR tile visuals are handled in TileSystem).
          ctx.fillStyle = "#4f3424";
          ctx.fillRect(x + 4, y + 10, 24, 14);
          ctx.fillStyle = "#6f4a34";
          ctx.fillRect(x + 6, y + 12, 20, 10);
        } else {
          ctx.fillStyle = wallWoodDark;
          ctx.fillRect(x + 8, y + 12, 16, 12);
        }
      }

      ctx.strokeStyle = "rgba(43, 25, 16, 0.95)";
      ctx.lineWidth = 1.25;
      ctx.strokeRect(x, y, tileSize, tileSize);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
    }
  };
}
