import { createBarRenderer } from "./barRenderer.js";
import { createChurchRenderer } from "./churchRenderer.js";
import { createDojoRenderer } from "./dojoRenderer.js";
import { createFountainRenderer } from "./fountainRenderer.js";
import { createPenRenderer } from "./penRenderer.js";
import { createHouseRenderer, createShopRenderer, createShrineRenderer } from "./simpleRenderers.js";

export function createBuildingRendererRegistry(ctx, tileSize) {
  return {
    DOJO: createDojoRenderer(ctx, tileSize),
    HOUSE: createHouseRenderer(ctx, tileSize),
    SHOP: createShopRenderer(ctx, tileSize),
    BAR: createBarRenderer(ctx, tileSize),
    CHURCH: createChurchRenderer(ctx, tileSize),
    PEN: createPenRenderer(ctx, tileSize),
    SHRINE: createShrineRenderer(ctx, tileSize),
    FOUNTAIN: createFountainRenderer(ctx, tileSize)
  };
}
