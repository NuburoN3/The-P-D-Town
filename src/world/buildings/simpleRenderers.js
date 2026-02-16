export function createHouseRenderer(ctx, tileSize) {
  return {
    renderTile(x, y) {
      ctx.fillStyle = "#a1887f";
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  };
}

export function createShopRenderer(ctx, tileSize) {
  return {
    renderTile(x, y) {
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
