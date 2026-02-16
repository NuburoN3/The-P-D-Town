export function createBarRenderer(ctx, tileSize) {
  return {
    renderTile(x, y, tileX, tileY, isTopRow, isBottomRow, isLeftCol, isRightCol) {
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

        // striped awning edge
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

      // SAKABA sign board
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
  };
}
