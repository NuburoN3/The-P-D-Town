export function createHouseRenderer(ctx, tileSize) {
  return {
    renderTile(x, y, _tileX, _tileY, isTopRow, _isBottomRow, isLeftCol, isRightCol, building) {
      void _tileX;
      void _tileY;
      void _isBottomRow;
      const style = String(building?.style || "");
      if (style === "glassOffice") {
        const grad = ctx.createLinearGradient(x, y, x, y + tileSize);
        grad.addColorStop(0, "#6b7480");
        grad.addColorStop(1, "#4d5663");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, tileSize, tileSize);

        ctx.fillStyle = "rgba(148, 211, 238, 0.48)";
        ctx.fillRect(x + 4, y + 5, tileSize - 8, tileSize - 10);
        ctx.fillStyle = "rgba(228, 246, 255, 0.22)";
        ctx.fillRect(x + 5, y + 6, tileSize - 16, 2);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x, y + tileSize - 3, tileSize, 3);

        if (isTopRow) {
          ctx.fillStyle = "#8d9aa8";
          ctx.fillRect(x, y, tileSize, 3);
        }
        if (isLeftCol) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x + 1, y + 1, 1, tileSize - 2);
        }
        if (isRightCol) {
          ctx.fillStyle = "rgba(0,0,0,0.24)";
          ctx.fillRect(x + tileSize - 2, y + 1, 1, tileSize - 2);
        }
        return;
      }

      ctx.fillStyle = "#a1887f";
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  };
}

export function createShopRenderer(ctx, tileSize) {
  return {
    renderTile(x, y, _tileX, _tileY, isTopRow, _isBottomRow, isLeftCol, isRightCol, building) {
      void _tileX;
      void _tileY;
      void _isBottomRow;
      const style = String(building?.style || "");
      if (style === "modernShop") {
        const grad = ctx.createLinearGradient(x, y, x, y + tileSize);
        grad.addColorStop(0, "#787f89");
        grad.addColorStop(1, "#5b616b");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, tileSize, tileSize);

        ctx.fillStyle = "rgba(132, 206, 239, 0.45)";
        ctx.fillRect(x + 3, y + 6, tileSize - 6, tileSize - 12);
        ctx.fillStyle = "rgba(220, 247, 255, 0.26)";
        ctx.fillRect(x + 5, y + 8, tileSize - 14, 2);
        ctx.fillStyle = "#d9e1e8";
        ctx.fillRect(x + 2, y + 2, tileSize - 4, 2);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(x, y + tileSize - 2, tileSize, 2);

        if (isTopRow) {
          ctx.fillStyle = "#a4b1be";
          ctx.fillRect(x, y, tileSize, 3);
        }
        if (isLeftCol || isRightCol) {
          ctx.fillStyle = "rgba(24,30,38,0.22)";
          ctx.fillRect(isLeftCol ? x + 1 : x + tileSize - 2, y + 1, 1, tileSize - 2);
        }
        return;
      }

      ctx.fillStyle = "#9b7d6f";
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  };
}

export function createShrineRenderer(ctx, tileSize) {
  return {
    renderTile(x, y) {
      ctx.fillStyle = "#8b6f47";
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  };
}
