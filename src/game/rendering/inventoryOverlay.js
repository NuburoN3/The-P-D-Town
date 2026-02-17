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

const CATEGORY_ORDER = ["Key Item", "Gear", "Consumable", "Material", "Misc"];

const ITEM_METADATA = Object.freeze({
  "Training Headband": {
    category: "Gear",
    description: "A dojo-issued headband tied to your training challenge.",
    usage: "Quest progression"
  },
  "Dojo Membership Card": {
    category: "Key Item",
    description: "Proof of acceptance in Hanami dojo ranks.",
    usage: "Unlocks later story progression"
  }
});

function inferCategory(itemName) {
  const known = ITEM_METADATA[itemName]?.category;
  if (known) return known;
  if (/card|key|permit|badge/i.test(itemName)) return "Key Item";
  if (/band|headband|blade|sword|staff|armor|shield/i.test(itemName)) return "Gear";
  if (/potion|food|meal|drink|tea/i.test(itemName)) return "Consumable";
  if (/ore|wood|fiber|cloth|stone/i.test(itemName)) return "Material";
  return "Misc";
}

function getItemInfo(itemName, count) {
  const metadata = ITEM_METADATA[itemName] || {};
  return {
    name: itemName,
    count,
    category: metadata.category || inferCategory(itemName),
    description: metadata.description || "No additional details.",
    usage: metadata.usage || "Carry item"
  };
}

function sortInventoryItems(playerInventory) {
  const items = Object.entries(playerInventory).map(([name, count]) => getItemInfo(name, count));
  const rank = (category) => {
    const idx = CATEGORY_ORDER.indexOf(category);
    return idx >= 0 ? idx : CATEGORY_ORDER.length;
  };
  items.sort((a, b) => {
    const categoryDelta = rank(a.category) - rank(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return a.name.localeCompare(b.name);
  });
  return items;
}

function drawCategorySummary(ctx, items, boxX, boxY, colors) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
  }

  let chipX = boxX + 24;
  const chipY = boxY + 48;
  ctx.font = FONT_12;
  for (const category of CATEGORY_ORDER) {
    const value = counts.get(category);
    if (!value) continue;
    const text = `${category} ${value}`;
    const width = Math.ceil(ctx.measureText(text).width) + 16;
    ctx.fillStyle = "rgba(255, 245, 210, 0.14)";
    ctx.fillRect(chipX, chipY - 12, width, 16);
    drawUiText(ctx, text, chipX + 8, chipY, colors);
    chipX += width + 8;
  }
}

export function drawInventoryOverlay(ctx, state, canvas, ui, colors, getItemSprite) {
  const { gameState, playerInventory, mouseUiState } = state;
  if (gameState !== GAME_STATES.INVENTORY) return;

  ctx.fillStyle = colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = Math.min(ui.INVENTORY_BOX_WIDTH + 40, canvas.width - 40);
  const boxH = Math.min(ui.INVENTORY_BOX_HEIGHT + 60, canvas.height - 40);
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "Inventory", boxX + 24, boxY + 42, colors);

  const sortedItems = sortInventoryItems(playerInventory);
  drawCategorySummary(ctx, sortedItems, boxX, boxY, colors);

  // Draw item grid
  const slotSize = 36;
  const margin = 2;
  const cols = 10;
  const rows = 4;
  const totalSlots = cols * rows;
  const gridWidth = cols * (slotSize + margin) - margin;
  const gridHeight = rows * (slotSize + margin) - margin;
  const gridX = boxX + 24;
  const gridY = boxY + 74;

  let hoveredItem = null;
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
        if (slotIndex >= 0 && slotIndex < sortedItems.length) {
          hoveredItemIndex = slotIndex;
          hoveredItem = sortedItems[slotIndex];
        }
      }
    }
  }

  if (mouseUiState && mouseUiState.inventoryDetailsRequest) {
    if (hoveredItemIndex >= 0) {
      mouseUiState.inventoryDetailsIndex = hoveredItemIndex;
      mouseUiState.inventoryDetailsAnchorX = mouseUiState.x;
      mouseUiState.inventoryDetailsAnchorY = mouseUiState.y;
    } else {
      mouseUiState.inventoryDetailsIndex = -1;
      mouseUiState.inventoryDetailsAnchorX = -1;
      mouseUiState.inventoryDetailsAnchorY = -1;
    }
    mouseUiState.inventoryDetailsRequest = false;
  }

  let inspectedItem = null;
  if (mouseUiState && !mouseUiState.insideCanvas && mouseUiState.inventoryDetailsIndex !== -1) {
    mouseUiState.inventoryDetailsIndex = -1;
    mouseUiState.inventoryDetailsAnchorX = -1;
    mouseUiState.inventoryDetailsAnchorY = -1;
  }
  const inspectedIndex = Number.isInteger(mouseUiState?.inventoryDetailsIndex)
    ? mouseUiState.inventoryDetailsIndex
    : -1;
  if (inspectedIndex >= 0 && inspectedIndex < sortedItems.length) {
    inspectedItem = sortedItems[inspectedIndex];
  } else if (mouseUiState && mouseUiState.inventoryDetailsIndex !== -1) {
    mouseUiState.inventoryDetailsIndex = -1;
    mouseUiState.inventoryDetailsAnchorX = -1;
    mouseUiState.inventoryDetailsAnchorY = -1;
  }

  for (let i = 0; i < totalSlots; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (slotSize + margin);
    const y = gridY + row * (slotSize + margin);

    ctx.fillStyle = colors.INVENTORY_SLOT_BG;
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = colors.INVENTORY_SLOT_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, slotSize, slotSize);

    if (i < sortedItems.length) {
      const item = sortedItems[i];
      const spriteName = getItemSpriteName(item.name);
      const sprite = spriteName ? getItemSprite(spriteName) : null;

      if (sprite && sprite.naturalWidth > 0 && sprite.naturalHeight > 0) {
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
        ctx.font = FONT_12;
        const label = item.name.slice(0, 7);
        drawUiText(ctx, label, x + 3, y + 20, colors);
      }

      if (item.count > 1) {
        ctx.font = FONT_12;
        const countText = `x${item.count}`;
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

  if (hoveredItem && !inspectedItem) {
    const tooltipText = hoveredItem.name;
    ctx.font = FONT_12;
    const paddingX = 8;
    const paddingY = 6;
    const textW = Math.ceil(ctx.measureText(tooltipText).width);
    const bubbleW = textW + paddingX * 2;
    const bubbleH = 20;
    const maxX = canvas.width - bubbleW - 8;
    const maxY = canvas.height - bubbleH - 8;
    const bubbleX = Math.max(8, Math.min(maxX, mouseUiState.x + 14));
    const bubbleY = Math.max(8, Math.min(maxY, mouseUiState.y - bubbleH - 10));
    ctx.fillStyle = "rgba(18, 14, 10, 0.86)";
    ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
    ctx.strokeStyle = "rgba(255, 231, 167, 0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bubbleX + 0.5, bubbleY + 0.5, bubbleW - 1, bubbleH - 1);
    drawUiText(ctx, tooltipText, bubbleX + paddingX, bubbleY + 14, colors);
  }

  if (inspectedItem && mouseUiState?.insideCanvas) {
    ctx.font = FONT_12;
    const lines = [];
    const descWords = inspectedItem.description.split(/\s+/).filter(Boolean);
    let descLine = "";
    const maxDescW = 300;
    for (const word of descWords) {
      const next = descLine ? `${descLine} ${word}` : word;
      if (ctx.measureText(next).width <= maxDescW || descLine.length === 0) {
        descLine = next;
      } else {
        lines.push(descLine);
        descLine = word;
      }
      if (lines.length >= 7) break;
    }
    if (descLine && lines.length < 8) lines.push(descLine);

    const paddingX = 10;
    const lineH = 14;
    const bubbleW = Math.min(
      320,
      Math.ceil(lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0)) + paddingX * 2
    );
    const bubbleH = lines.length * lineH + 12;
    const anchorX = Number.isFinite(mouseUiState.inventoryDetailsAnchorX)
      ? mouseUiState.inventoryDetailsAnchorX
      : mouseUiState.x;
    const anchorY = Number.isFinite(mouseUiState.inventoryDetailsAnchorY)
      ? mouseUiState.inventoryDetailsAnchorY
      : mouseUiState.y;
    const maxX = canvas.width - bubbleW - 8;
    const maxY = canvas.height - bubbleH - 8;
    const bubbleX = Math.max(8, Math.min(maxX, anchorX + 14));
    const bubbleY = Math.max(8, Math.min(maxY, anchorY - bubbleH - 12));

    const inspectedCol = inspectedIndex % cols;
    const inspectedRow = Math.floor(inspectedIndex / cols);
    const inspectedSlotX = gridX + inspectedCol * (slotSize + margin);
    const inspectedSlotY = gridY + inspectedRow * (slotSize + margin);
    const mx = mouseUiState.x;
    const my = mouseUiState.y;
    const hoveringSlot =
      mx >= inspectedSlotX &&
      mx <= inspectedSlotX + slotSize &&
      my >= inspectedSlotY &&
      my <= inspectedSlotY + slotSize;
    const hoveringBubble =
      mx >= bubbleX &&
      mx <= bubbleX + bubbleW &&
      my >= bubbleY &&
      my <= bubbleY + bubbleH;
    if (!hoveringSlot && !hoveringBubble) {
      mouseUiState.inventoryDetailsIndex = -1;
      mouseUiState.inventoryDetailsAnchorX = -1;
      mouseUiState.inventoryDetailsAnchorY = -1;
      return;
    }

    ctx.fillStyle = "rgba(18, 14, 10, 0.9)";
    ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
    ctx.strokeStyle = "rgba(255, 231, 167, 0.78)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bubbleX + 0.5, bubbleY + 0.5, bubbleW - 1, bubbleH - 1);

    for (let i = 0; i < lines.length; i++) {
      drawUiText(ctx, lines[i], bubbleX + paddingX, bubbleY + 16 + i * lineH, colors);
    }
  }
}
