import { GAME_STATES } from "../../core/constants.js";
import {
  FONT_12,
  FONT_16,
  FONT_28,
  drawSkinnedPanel,
  drawUiText,
  getItemSpriteName,
  getItemSpriteScale
} from "./uiPrimitives.js";

export function drawInventoryOverlay(ctx, state, canvas, ui, colors, getItemSprite) {
  const { gameState, playerInventory, mouseUiState } = state;
  if (gameState !== GAME_STATES.INVENTORY) return;

  ctx.fillStyle = colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = ui.INVENTORY_BOX_WIDTH;
  const boxH = Math.min(ui.INVENTORY_BOX_HEIGHT, 248);
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "Inventory", boxX + 24, boxY + 42, colors);

  // Draw item grid
  const slotSize = 36;
  const margin = 2;
  const cols = 10;
  const rows = 4;
  const totalSlots = cols * rows;
  const gridWidth = cols * (slotSize + margin) - margin;
  const gridHeight = rows * (slotSize + margin) - margin;
  const gridX = boxX + (boxW - gridWidth) / 2;
  const gridY = boxY + 60;

  const allItems = Object.entries(playerInventory);
  let hoveredItemName = "";
  let hoveredItemIndex = -1;
  if (mouseUiState?.insideCanvas) {
    const mx = mouseUiState.x;
    const my = mouseUiState.y;
    if (
      mx >= gridX &&
      mx <= gridX + gridWidth &&
      my >= gridY &&
      my <= gridY + gridHeight
    ) {
      const col = Math.floor((mx - gridX) / (slotSize + margin));
      const row = Math.floor((my - gridY) / (slotSize + margin));
      const localX = (mx - gridX) % (slotSize + margin);
      const localY = (my - gridY) % (slotSize + margin);
      if (localX < slotSize && localY < slotSize) {
        const slotIndex = row * cols + col;
        if (slotIndex >= 0 && slotIndex < allItems.length) {
          hoveredItemIndex = slotIndex;
          hoveredItemName = allItems[slotIndex][0];
        }
      }
    }
  }

  for (let i = 0; i < totalSlots; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (slotSize + margin);
    const y = gridY + row * (slotSize + margin);

    // Draw slot background
    ctx.fillStyle = colors.INVENTORY_SLOT_BG;
    ctx.fillRect(x, y, slotSize, slotSize);

    // Draw border
    ctx.strokeStyle = colors.INVENTORY_SLOT_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, slotSize, slotSize);

    if (i < allItems.length) {
      const [itemName, count] = allItems[i];
      const spriteName = getItemSpriteName(itemName);
      const sprite = spriteName ? getItemSprite(spriteName) : null;

      if (sprite && sprite.naturalWidth > 0 && sprite.naturalHeight > 0) {
        // Draw sprite centered in slot with scaling (clipped to slot bounds)
        const scale = getItemSpriteScale(spriteName);
        const spriteSize = slotSize * scale;
        const spriteX = x + (slotSize - spriteSize) / 2;
        const spriteY = y + (slotSize - spriteSize) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, slotSize, slotSize);
        ctx.clip();
        ctx.drawImage(sprite, spriteX, spriteY, spriteSize, spriteSize);
        ctx.restore();
      } else {
        // Fallback to text if sprite not loaded
        ctx.font = FONT_12;
        const textWidth = ctx.measureText(itemName).width;
        drawUiText(ctx, itemName, x + (slotSize - textWidth) / 2, y + slotSize / 2 + 4, colors);
      }

      if (count > 1) {
        ctx.font = FONT_12;
        const countText = `x${count}`;
        const countWidth = ctx.measureText(countText).width;
        drawUiText(ctx, countText, x + slotSize - countWidth - 2, y + slotSize - 12, colors);
      }

      if (i === hoveredItemIndex) {
        ctx.fillStyle = "rgba(255, 236, 194, 0.16)";
        ctx.fillRect(x, y, slotSize, slotSize);
        ctx.strokeStyle = "rgba(255, 231, 167, 0.85)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, slotSize - 2, slotSize - 2);
      }
    }
  }

  if (hoveredItemName) {
    ctx.font = FONT_16;
    const nameWidth = ctx.measureText(hoveredItemName).width;
    drawUiText(ctx, hoveredItemName, boxX + (boxW - nameWidth) / 2, gridY + gridHeight + 18, colors);
  }
}
