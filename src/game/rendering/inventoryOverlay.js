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
const EQUIPMENT_SLOT_ORDER = [
  { id: "head", label: "Headgear" },
  { id: "torso", label: "Torso" },
  { id: "weapon", label: "Wield" },
  { id: "shield", label: "Shield" },
  { id: "legs", label: "Legs" },
  { id: "feet", label: "Feet" }
];

const ITEM_METADATA = Object.freeze({
  "Training Headband": {
    category: "Gear",
    description: "A dojo-issued headband tied to your training challenge.",
    usage: "Quest progression",
    equipSlot: "head"
  },
  "Dojo Membership Card": {
    category: "Key Item",
    description: "Proof of acceptance in Hanami dojo ranks.",
    usage: "Unlocks later story progression",
    equipSlot: null
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

function inferEquipSlot(itemName) {
  const known = ITEM_METADATA[itemName]?.equipSlot;
  if (known) return known;
  const lower = String(itemName || "").toLowerCase();
  if (/(headband|helm|helmet|hood|hat|crown|headgear)/.test(lower)) return "head";
  if (/(armor|armour|chest|robe|coat|vest|torso)/.test(lower)) return "torso";
  if (/(shield|buckler)/.test(lower)) return "shield";
  if (/(sword|blade|staff|bow|dagger|spear|mace|weapon)/.test(lower)) return "weapon";
  if (/(pants|trousers|leggings|greaves|legs)/.test(lower)) return "legs";
  if (/(boots|shoes|sandals|feet)/.test(lower)) return "feet";
  return null;
}

function getItemInfo(itemName, count) {
  const metadata = ITEM_METADATA[itemName] || {};
  return {
    name: itemName,
    count,
    category: metadata.category || inferCategory(itemName),
    description: metadata.description || "No additional details.",
    usage: metadata.usage || "Carry item",
    equipSlot: metadata.equipSlot || inferEquipSlot(itemName)
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

function normalizePlayerEquipment(playerEquipment) {
  if (!playerEquipment || typeof playerEquipment !== "object") return;
  for (const slot of EQUIPMENT_SLOT_ORDER) {
    if (typeof playerEquipment[slot.id] !== "string") {
      playerEquipment[slot.id] = null;
    }
  }
}

function getGridHitTest(mouseX, mouseY, gridX, gridY, slotSize, margin, cols, rows) {
  const width = cols * (slotSize + margin) - margin;
  const height = rows * (slotSize + margin) - margin;
  if (mouseX < gridX || mouseX > gridX + width || mouseY < gridY || mouseY > gridY + height) {
    return { isOverGridSlot: false, slotIndex: -1, width, height };
  }
  const col = Math.floor((mouseX - gridX) / (slotSize + margin));
  const row = Math.floor((mouseY - gridY) / (slotSize + margin));
  const localX = (mouseX - gridX) % (slotSize + margin);
  const localY = (mouseY - gridY) % (slotSize + margin);
  if (localX >= slotSize || localY >= slotSize || col < 0 || row < 0 || col >= cols || row >= rows) {
    return { isOverGridSlot: false, slotIndex: -1, width, height };
  }
  return {
    isOverGridSlot: true,
    slotIndex: row * cols + col,
    width,
    height
  };
}

function buildEquipmentLayout(panelX, panelY, slotSize) {
  const centerX = panelX + 74;
  const headY = panelY + 24;
  const torsoY = headY + slotSize + 20;
  const armY = torsoY + 4;
  const legsY = torsoY + slotSize + 20;
  const feetY = legsY + slotSize + 14;

  const slots = {
    head: { x: centerX, y: headY, w: slotSize, h: slotSize },
    torso: { x: centerX, y: torsoY, w: slotSize, h: slotSize },
    weapon: { x: centerX - slotSize - 20, y: armY, w: slotSize, h: slotSize },
    shield: { x: centerX + slotSize + 20, y: armY, w: slotSize, h: slotSize },
    legs: { x: centerX, y: legsY, w: slotSize, h: slotSize },
    feet: { x: centerX, y: feetY, w: slotSize, h: slotSize }
  };

  return {
    slots,
    centerX: centerX + slotSize * 0.5,
    centerY: torsoY + slotSize * 0.5,
    bottomY: feetY + slotSize
  };
}

function findHoveredEquipmentSlot(mouseX, mouseY, equipmentLayout) {
  for (const slot of EQUIPMENT_SLOT_ORDER) {
    const rect = equipmentLayout.slots[slot.id];
    if (
      mouseX >= rect.x &&
      mouseX <= rect.x + rect.w &&
      mouseY >= rect.y &&
      mouseY <= rect.y + rect.h
    ) {
      return slot.id;
    }
  }
  return "";
}

function addItemToInventory(playerInventory, itemName, amount = 1) {
  if (!itemName || amount <= 0) return;
  playerInventory[itemName] = Math.max(0, Number(playerInventory[itemName] || 0)) + amount;
}

function removeItemFromInventory(playerInventory, itemName, amount = 1) {
  const count = Number(playerInventory[itemName] || 0);
  if (count < amount) return false;
  if (count === amount) {
    delete playerInventory[itemName];
  } else {
    playerInventory[itemName] = count - amount;
  }
  return true;
}

function canEquipItemInSlot(itemName, slotId) {
  if (!itemName || !slotId) return false;
  const item = getItemInfo(itemName, 1);
  return item.equipSlot === slotId;
}

function getEquipmentSlotLabel(slotId) {
  const slot = EQUIPMENT_SLOT_ORDER.find((entry) => entry.id === slotId);
  return slot ? slot.label : "Slot";
}

function isDojoUpstairsHeadbandLock(state, slotId, equippedItemName) {
  return (
    state?.currentTownId === "hanamiTown" &&
    state?.currentAreaId === "hanamiDojoUpstairs" &&
    slotId === "head" &&
    equippedItemName === "Training Headband"
  );
}

function clearItemInspection(mouseUiState) {
  if (!mouseUiState) return;
  mouseUiState.inventoryDetailsIndex = -1;
  mouseUiState.inventoryDetailsAnchorX = -1;
  mouseUiState.inventoryDetailsAnchorY = -1;
}

function restoreDraggedItem(mouseUiState, playerInventory, playerEquipment) {
  const itemName = mouseUiState.inventoryDragItemName;
  if (!itemName) return;

  if (
    mouseUiState.inventoryDragSource === "equipment" &&
    mouseUiState.inventoryDragSourceSlot &&
    playerEquipment &&
    playerEquipment[mouseUiState.inventoryDragSourceSlot] == null
  ) {
    playerEquipment[mouseUiState.inventoryDragSourceSlot] = itemName;
    return;
  }

  addItemToInventory(playerInventory, itemName, 1);
}

function drawItemInSlot(ctx, itemName, x, y, size, colors, getItemSprite) {
  const spriteName = getItemSpriteName(itemName);
  const sprite = spriteName ? getItemSprite(spriteName) : null;
  if (sprite && sprite.naturalWidth > 0 && sprite.naturalHeight > 0) {
    const scale = getItemSpriteScale(spriteName);
    const spriteSize = size * scale;
    const spriteX = x + (size - spriteSize) / 2;
    const spriteY = y + (size - spriteSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.drawImage(sprite, spriteX, spriteY, spriteSize, spriteSize);
    ctx.restore();
    return;
  }
  ctx.font = FONT_12;
  drawUiText(ctx, itemName.slice(0, 7), x + 3, y + 20, colors);
}

export function drawInventoryOverlay(ctx, state, canvas, ui, colors, getItemSprite) {
  const { gameState, playerInventory, playerEquipment, mouseUiState } = state;
  if (gameState !== GAME_STATES.INVENTORY) return;

  normalizePlayerEquipment(playerEquipment);

  ctx.fillStyle = colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = Math.min(ui.INVENTORY_BOX_WIDTH + 260, canvas.width - 40);
  const boxH = Math.min(ui.INVENTORY_BOX_HEIGHT + 170, canvas.height - 40);
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "Inventory", boxX + 24, boxY + 42, colors);

  const slotSize = 36;
  const margin = 2;
  const cols = 10;
  const rows = 4;
  const totalSlots = cols * rows;
  const gridX = boxX + 24;
  const gridY = boxY + 74;

  const sampleGrid = getGridHitTest(gridX, gridY, gridX, gridY, slotSize, margin, cols, rows);
  const gridWidth = sampleGrid.width;
  const gridHeight = sampleGrid.height;

  const equipmentPanelW = 188;
  const slotBodySize = 40;
  const roomOnRight = (boxX + boxW - 24) - (gridX + gridWidth + 24) >= equipmentPanelW;
  const equipmentPanelX = roomOnRight
    ? gridX + gridWidth + 24
    : boxX + boxW - equipmentPanelW - 24;
  const equipmentPanelY = roomOnRight ? gridY + 4 : (gridY + gridHeight + 20);
  const equipmentLayout = buildEquipmentLayout(equipmentPanelX, equipmentPanelY, slotBodySize);

  let sortedItems = sortInventoryItems(playerInventory);
  drawCategorySummary(ctx, sortedItems, boxX, boxY, colors);

  const mouseInsideCanvas = Boolean(mouseUiState?.insideCanvas);
  const mouseX = mouseUiState?.x || 0;
  const mouseY = mouseUiState?.y || 0;

  const computeHoverState = (items) => {
    const gridHit = mouseInsideCanvas
      ? getGridHitTest(mouseX, mouseY, gridX, gridY, slotSize, margin, cols, rows)
      : { isOverGridSlot: false, slotIndex: -1 };
    const hoveredItemIndex = gridHit.isOverGridSlot && gridHit.slotIndex < items.length ? gridHit.slotIndex : -1;
    const hoveredItem = hoveredItemIndex >= 0 ? items[hoveredItemIndex] : null;
    const hoveredEquipmentSlotId = mouseInsideCanvas ? findHoveredEquipmentSlot(mouseX, mouseY, equipmentLayout) : "";
    const hoveredEquipmentItem = hoveredEquipmentSlotId ? playerEquipment?.[hoveredEquipmentSlotId] || null : null;
    return {
      hoveredItemIndex,
      hoveredItem,
      hoveredEquipmentSlotId,
      hoveredEquipmentItem,
      isOverGridSlot: Boolean(gridHit.isOverGridSlot)
    };
  };

  let hover = computeHoverState(sortedItems);

  if (mouseUiState && mouseUiState.inventoryDetailsRequest) {
    if (hover.hoveredItemIndex >= 0) {
      mouseUiState.inventoryDetailsIndex = hover.hoveredItemIndex;
      mouseUiState.inventoryDetailsAnchorX = mouseX;
      mouseUiState.inventoryDetailsAnchorY = mouseY;
    } else {
      clearItemInspection(mouseUiState);
    }
    mouseUiState.inventoryDetailsRequest = false;
  }

  if (mouseUiState?.inventoryDragStartRequest) {
    if (hover.hoveredItemIndex >= 0) {
      const draggedItem = sortedItems[hover.hoveredItemIndex];
      if (draggedItem && removeItemFromInventory(playerInventory, draggedItem.name, 1)) {
        mouseUiState.inventoryDragItemName = draggedItem.name;
        mouseUiState.inventoryDragSource = "inventory";
        mouseUiState.inventoryDragSourceSlot = "";
        clearItemInspection(mouseUiState);
      }
    } else if (hover.hoveredEquipmentSlotId && playerEquipment?.[hover.hoveredEquipmentSlotId]) {
      const slotId = hover.hoveredEquipmentSlotId;
      const equippedItemName = playerEquipment[slotId];
      if (isDojoUpstairsHeadbandLock(state, slotId, equippedItemName)) {
        mouseUiState.inventoryDragStartRequest = false;
        sortedItems = sortInventoryItems(playerInventory);
        hover = computeHoverState(sortedItems);
      } else {
        mouseUiState.inventoryDragItemName = equippedItemName;
        mouseUiState.inventoryDragSource = "equipment";
        mouseUiState.inventoryDragSourceSlot = slotId;
        playerEquipment[slotId] = null;
        clearItemInspection(mouseUiState);
      }
    }
    mouseUiState.inventoryDragStartRequest = false;
    sortedItems = sortInventoryItems(playerInventory);
    hover = computeHoverState(sortedItems);
  }

  if (mouseUiState?.inventoryDragReleaseRequest) {
    const draggedItemName = mouseUiState.inventoryDragItemName;
    if (draggedItemName) {
      let placed = false;
      if (hover.hoveredEquipmentSlotId && canEquipItemInSlot(draggedItemName, hover.hoveredEquipmentSlotId)) {
        if (
          isDojoUpstairsHeadbandLock(
            state,
            hover.hoveredEquipmentSlotId,
            playerEquipment[hover.hoveredEquipmentSlotId]
          ) &&
          draggedItemName !== "Training Headband"
        ) {
          restoreDraggedItem(mouseUiState, playerInventory, playerEquipment);
          mouseUiState.inventoryDragItemName = "";
          mouseUiState.inventoryDragSource = "";
          mouseUiState.inventoryDragSourceSlot = "";
          clearItemInspection(mouseUiState);
          mouseUiState.inventoryDragReleaseRequest = false;
          sortedItems = sortInventoryItems(playerInventory);
          hover = computeHoverState(sortedItems);
          return;
        }
        const swappedItem = playerEquipment[hover.hoveredEquipmentSlotId];
        playerEquipment[hover.hoveredEquipmentSlotId] = draggedItemName;
        if (swappedItem) addItemToInventory(playerInventory, swappedItem, 1);
        placed = true;
      } else if (hover.isOverGridSlot) {
        addItemToInventory(playerInventory, draggedItemName, 1);
        placed = true;
      }

      if (!placed) {
        restoreDraggedItem(mouseUiState, playerInventory, playerEquipment);
      }
      mouseUiState.inventoryDragItemName = "";
      mouseUiState.inventoryDragSource = "";
      mouseUiState.inventoryDragSourceSlot = "";
      clearItemInspection(mouseUiState);
    }
    mouseUiState.inventoryDragReleaseRequest = false;
    sortedItems = sortInventoryItems(playerInventory);
    hover = computeHoverState(sortedItems);
  }

  let inspectedItem = null;
  if (mouseUiState && !mouseUiState.insideCanvas && mouseUiState.inventoryDetailsIndex !== -1) {
    clearItemInspection(mouseUiState);
  }
  const inspectedIndex = Number.isInteger(mouseUiState?.inventoryDetailsIndex)
    ? mouseUiState.inventoryDetailsIndex
    : -1;
  if (inspectedIndex >= 0 && inspectedIndex < sortedItems.length) {
    inspectedItem = sortedItems[inspectedIndex];
  } else if (mouseUiState && mouseUiState.inventoryDetailsIndex !== -1) {
    clearItemInspection(mouseUiState);
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
      drawItemInSlot(ctx, item.name, x, y, slotSize, colors, getItemSprite);

      if (item.count > 1) {
        ctx.font = FONT_12;
        const countText = `x${item.count}`;
        const countWidth = ctx.measureText(countText).width;
        drawUiText(ctx, countText, x + slotSize - countWidth - 2, y + slotSize - 12, colors);
      }
    }

    if (i === hover.hoveredItemIndex) {
      ctx.fillStyle = "rgba(255, 236, 194, 0.16)";
      ctx.fillRect(x, y, slotSize, slotSize);
      ctx.strokeStyle = "rgba(255, 231, 167, 0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, slotSize - 2, slotSize - 2);
    }
  }

  ctx.fillStyle = "rgba(20, 16, 12, 0.35)";
  ctx.fillRect(equipmentPanelX, equipmentPanelY, equipmentPanelW, 250);
  ctx.strokeStyle = "rgba(255, 231, 167, 0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(equipmentPanelX + 0.5, equipmentPanelY + 0.5, equipmentPanelW - 1, 249);

  ctx.font = FONT_16;
  drawUiText(ctx, "Equipment", equipmentPanelX + 12, equipmentPanelY + 18, colors);

  ctx.strokeStyle = "rgba(255, 231, 167, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(equipmentLayout.centerX, equipmentLayout.centerY - 26);
  ctx.lineTo(equipmentLayout.centerX, equipmentLayout.bottomY - 24);
  ctx.moveTo(equipmentLayout.centerX - 20, equipmentLayout.centerY - 8);
  ctx.lineTo(equipmentLayout.centerX + 20, equipmentLayout.centerY - 8);
  ctx.stroke();

  for (const slot of EQUIPMENT_SLOT_ORDER) {
    const rect = equipmentLayout.slots[slot.id];
    const equippedItemName = playerEquipment?.[slot.id] || null;
    const isHovered = slot.id === hover.hoveredEquipmentSlotId;
    const dragItem = mouseUiState?.inventoryDragItemName || "";
    const canDropHere = dragItem ? canEquipItemInSlot(dragItem, slot.id) : false;

    ctx.fillStyle = "rgba(255,255,255,0.11)";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = isHovered
      ? "rgba(255, 231, 167, 0.94)"
      : (canDropHere ? "rgba(134, 220, 160, 0.9)" : colors.INVENTORY_SLOT_BORDER);
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    ctx.font = FONT_12;
    const labelW = ctx.measureText(slot.label).width;
    drawUiText(
      ctx,
      slot.label,
      rect.x + (rect.w - labelW) / 2,
      rect.y + rect.h + 14,
      colors
    );

    if (equippedItemName) {
      drawItemInSlot(ctx, equippedItemName, rect.x, rect.y, rect.w, colors, getItemSprite);
    }
  }

  const draggingItemName = mouseUiState?.inventoryDragItemName || "";
  const hoveredTooltipItem = inspectedItem
    ? null
    : (hover.hoveredItem?.name || hover.hoveredEquipmentItem || "");
  if (hoveredTooltipItem && mouseUiState?.insideCanvas && !draggingItemName) {
    const tooltipText = hoveredTooltipItem;
    ctx.font = FONT_12;
    const paddingX = 8;
    const textW = Math.ceil(ctx.measureText(tooltipText).width);
    const bubbleW = textW + paddingX * 2;
    const bubbleH = 20;
    const maxX = canvas.width - bubbleW - 8;
    const maxY = canvas.height - bubbleH - 8;
    const bubbleX = Math.max(8, Math.min(maxX, mouseX + 14));
    const bubbleY = Math.max(8, Math.min(maxY, mouseY - bubbleH - 10));
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
    const showEquipAction = EQUIPMENT_SLOT_ORDER.some((slot) => slot.id === inspectedItem.equipSlot);
    const actionGapY = 8;
    const actionHeight = 20;
    const actionHintHeight = 14;
    const bubbleW = Math.min(
      320,
      Math.ceil(lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0)) + paddingX * 2
    );
    const textSectionH = lines.length * lineH + 12;
    const bubbleH = textSectionH + (showEquipAction ? actionGapY + actionHeight + actionHintHeight + 8 : 0);
    const anchorX = Number.isFinite(mouseUiState.inventoryDetailsAnchorX)
      ? mouseUiState.inventoryDetailsAnchorX
      : mouseX;
    const anchorY = Number.isFinite(mouseUiState.inventoryDetailsAnchorY)
      ? mouseUiState.inventoryDetailsAnchorY
      : mouseY;
    const maxX = canvas.width - bubbleW - 8;
    const maxY = canvas.height - bubbleH - 8;
    const bubbleX = Math.max(8, Math.min(maxX, anchorX + 14));
    const bubbleY = Math.max(8, Math.min(maxY, anchorY - bubbleH - 12));

    const inspectedCol = inspectedIndex % cols;
    const inspectedRow = Math.floor(inspectedIndex / cols);
    const inspectedSlotX = gridX + inspectedCol * (slotSize + margin);
    const inspectedSlotY = gridY + inspectedRow * (slotSize + margin);
    const hoveringSlot =
      mouseX >= inspectedSlotX &&
      mouseX <= inspectedSlotX + slotSize &&
      mouseY >= inspectedSlotY &&
      mouseY <= inspectedSlotY + slotSize;
    const hoveringBubble =
      mouseX >= bubbleX &&
      mouseX <= bubbleX + bubbleW &&
      mouseY >= bubbleY &&
      mouseY <= bubbleY + bubbleH;
    if (!hoveringSlot && !hoveringBubble) {
      clearItemInspection(mouseUiState);
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

    if (showEquipAction) {
      const slotLabel = getEquipmentSlotLabel(inspectedItem.equipSlot);
      const equipText = "Equip";
      const equipTextW = Math.ceil(ctx.measureText(equipText).width);
      const buttonW = Math.max(66, equipTextW + 18);
      const buttonX = bubbleX + Math.round((bubbleW - buttonW) / 2);
      const buttonY = bubbleY + textSectionH + actionGapY;
      const hoveringEquipButton =
        mouseX >= buttonX &&
        mouseX <= buttonX + buttonW &&
        mouseY >= buttonY &&
        mouseY <= buttonY + actionHeight;

      if (mouseUiState.inventoryClickRequest && hoveringEquipButton) {
        const slotId = inspectedItem.equipSlot;
        const existingItem = playerEquipment[slotId];
        const blockedByHeadbandLock = (
          isDojoUpstairsHeadbandLock(state, slotId, existingItem) &&
          inspectedItem.name !== "Training Headband"
        );
        if (!blockedByHeadbandLock && removeItemFromInventory(playerInventory, inspectedItem.name, 1)) {
          playerEquipment[slotId] = inspectedItem.name;
          if (existingItem) {
            addItemToInventory(playerInventory, existingItem, 1);
          }
          clearItemInspection(mouseUiState);
          mouseUiState.inventoryClickRequest = false;
          sortedItems = sortInventoryItems(playerInventory);
          hover = computeHoverState(sortedItems);
          return;
        }
      }

      ctx.fillStyle = hoveringEquipButton ? "rgba(255, 227, 160, 0.35)" : "rgba(255, 227, 160, 0.2)";
      ctx.fillRect(buttonX, buttonY, buttonW, actionHeight);
      ctx.strokeStyle = hoveringEquipButton ? "rgba(255, 236, 194, 0.95)" : "rgba(255, 231, 167, 0.72)";
      ctx.lineWidth = 1;
      ctx.strokeRect(buttonX + 0.5, buttonY + 0.5, buttonW - 1, actionHeight - 1);
      drawUiText(ctx, equipText, buttonX + Math.round((buttonW - equipTextW) / 2), buttonY + 14, colors);

      if (hoveringEquipButton) {
        const hintText = `Equip to ${slotLabel}`;
        const hintW = Math.ceil(ctx.measureText(hintText).width);
        drawUiText(
          ctx,
          hintText,
          bubbleX + Math.round((bubbleW - hintW) / 2),
          buttonY + actionHeight + 12,
          colors
        );
      }
    }
  }

  if (mouseUiState.inventoryClickRequest) {
    mouseUiState.inventoryClickRequest = false;
  }

  if (draggingItemName && mouseUiState?.insideCanvas) {
    const dragSize = 34;
    const drawX = mouseX + 10;
    const drawY = mouseY + 10;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "rgba(18, 14, 10, 0.7)";
    ctx.fillRect(drawX - 2, drawY - 2, dragSize + 4, dragSize + 4);
    ctx.strokeStyle = "rgba(255, 231, 167, 0.72)";
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX - 1.5, drawY - 1.5, dragSize + 3, dragSize + 3);
    drawItemInSlot(ctx, draggingItemName, drawX, drawY, dragSize, colors, getItemSprite);
    ctx.restore();
  }
}
