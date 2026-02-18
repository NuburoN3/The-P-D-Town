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
const INVENTORY_DETAILS_CLOSE_GRACE_MS = 260;
const INVENTORY_DETAILS_HOVER_PADDING = 12;
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

function ensureInventorySlotOrder(mouseUiState, items, totalSlots) {
  const emptySlots = Array.from({ length: totalSlots }, () => "");
  if (!mouseUiState || typeof mouseUiState !== "object") return emptySlots;

  const existing = Array.isArray(mouseUiState.inventorySlotOrder) ? mouseUiState.inventorySlotOrder : [];
  const draggedInventoryItemName = (
    mouseUiState.inventoryDragSource === "inventoryGrid" &&
    typeof mouseUiState.inventoryDragItemName === "string"
  )
    ? mouseUiState.inventoryDragItemName
    : "";
  const validNames = new Set(items.map((item) => item.name));
  const seen = new Set();
  const normalized = Array.from({ length: totalSlots }, (_, index) => {
    const name = typeof existing[index] === "string" ? existing[index] : "";
    if (!validNames.has(name) || seen.has(name) || (draggedInventoryItemName && name === draggedInventoryItemName)) return "";
    seen.add(name);
    return name;
  });

  const placed = new Set(normalized.filter(Boolean));
  for (const item of items) {
    if (draggedInventoryItemName && item.name === draggedInventoryItemName) continue;
    if (placed.has(item.name)) continue;
    const emptyIndex = normalized.indexOf("");
    if (emptyIndex === -1) break;
    normalized[emptyIndex] = item.name;
    placed.add(item.name);
  }

  mouseUiState.inventorySlotOrder = normalized;
  return normalized;
}

function placeInFirstEmptyInventorySlot(slotOrder, itemName, disallowIndex = -1) {
  if (!Array.isArray(slotOrder) || !itemName) return false;
  for (let i = 0; i < slotOrder.length; i++) {
    if (i === disallowIndex) continue;
    if (!slotOrder[i]) {
      slotOrder[i] = itemName;
      return true;
    }
  }
  return false;
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
  const centerX = panelX + 91;
  const headY = panelY + 22;
  const torsoY = headY + slotSize + 26;
  const armY = torsoY + 6;
  const legsY = torsoY + slotSize + 26;
  const feetY = legsY + slotSize + 18;

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
  mouseUiState.inventoryDetailsSource = "";
  mouseUiState.inventoryDetailsEquipmentSlot = "";
  mouseUiState.inventoryDetailsAnchorX = -1;
  mouseUiState.inventoryDetailsAnchorY = -1;
  mouseUiState.inventoryDetailsCloseGraceUntil = 0;
}

function isPointInsideExpandedRect(mouseX, mouseY, x, y, w, h, padding = 0) {
  return (
    mouseX >= x - padding &&
    mouseX <= x + w + padding &&
    mouseY >= y - padding &&
    mouseY <= y + h + padding
  );
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

  const equipmentPanelW = 228;
  const slotBodySize = 46;
  const roomOnRight = (boxX + boxW - 24) - (gridX + gridWidth + 24) >= equipmentPanelW;
  const equipmentPanelX = roomOnRight
    ? gridX + gridWidth + 24
    : boxX + boxW - equipmentPanelW - 24;
  const equipmentPanelY = roomOnRight ? gridY + 4 : (gridY + gridHeight + 20);
  const equipmentLayout = buildEquipmentLayout(equipmentPanelX, equipmentPanelY, slotBodySize);
  const equipmentPanelH = Math.max(250, Math.round((equipmentLayout.bottomY - equipmentPanelY) + 44));

  let sortedItems = sortInventoryItems(playerInventory);
  let itemsByName = new Map(sortedItems.map((item) => [item.name, item]));
  let slotOrder = ensureInventorySlotOrder(mouseUiState, sortedItems, totalSlots);

  const mouseInsideCanvas = Boolean(mouseUiState?.insideCanvas);
  const mouseX = mouseUiState?.x || 0;
  const mouseY = mouseUiState?.y || 0;

  const computeHoverState = (items) => {
    const itemMap = new Map(items.map((item) => [item.name, item]));
    const gridHit = mouseInsideCanvas
      ? getGridHitTest(mouseX, mouseY, gridX, gridY, slotSize, margin, cols, rows)
      : { isOverGridSlot: false, slotIndex: -1 };
    const hoveredGridSlotIndex = gridHit.isOverGridSlot ? gridHit.slotIndex : -1;
    const hoveredItemName = hoveredGridSlotIndex >= 0 ? slotOrder[hoveredGridSlotIndex] : "";
    const hoveredItem = hoveredItemName ? (itemMap.get(hoveredItemName) || null) : null;
    const hoveredItemIndex = hoveredItem ? hoveredGridSlotIndex : -1;
    const hoveredEquipmentSlotId = mouseInsideCanvas ? findHoveredEquipmentSlot(mouseX, mouseY, equipmentLayout) : "";
    const hoveredEquipmentItem = hoveredEquipmentSlotId ? playerEquipment?.[hoveredEquipmentSlotId] || null : null;
    return {
      hoveredGridSlotIndex,
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
      mouseUiState.inventoryDetailsSource = "inventory";
      mouseUiState.inventoryDetailsEquipmentSlot = "";
      mouseUiState.inventoryDetailsCloseGraceUntil = 0;
      mouseUiState.inventoryDetailsAnchorX = mouseX;
      mouseUiState.inventoryDetailsAnchorY = mouseY;
    } else if (hover.hoveredEquipmentSlotId && hover.hoveredEquipmentItem) {
      mouseUiState.inventoryDetailsIndex = -1;
      mouseUiState.inventoryDetailsSource = "equipment";
      mouseUiState.inventoryDetailsEquipmentSlot = hover.hoveredEquipmentSlotId;
      mouseUiState.inventoryDetailsCloseGraceUntil = 0;
      mouseUiState.inventoryDetailsAnchorX = mouseX;
      mouseUiState.inventoryDetailsAnchorY = mouseY;
    } else {
      clearItemInspection(mouseUiState);
    }
    mouseUiState.inventoryDetailsRequest = false;
  }

  if (mouseUiState?.inventoryDragStartRequest) {
    if (hover.hoveredItemIndex >= 0) {
      const draggedItem = hover.hoveredItem;
      if (draggedItem) {
        mouseUiState.inventoryDragItemName = draggedItem.name;
        mouseUiState.inventoryDragSource = "inventoryGrid";
        mouseUiState.inventoryDragSourceSlot = String(hover.hoveredItemIndex);
        slotOrder[hover.hoveredItemIndex] = "";
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
    itemsByName = new Map(sortedItems.map((item) => [item.name, item]));
    slotOrder = ensureInventorySlotOrder(mouseUiState, sortedItems, totalSlots);
    hover = computeHoverState(sortedItems);
  }

  if (mouseUiState?.inventoryDragReleaseRequest) {
    const draggedItemName = mouseUiState.inventoryDragItemName;
    if (draggedItemName) {
      let placed = false;
      const sourceSlotIndex = Number.parseInt(mouseUiState.inventoryDragSourceSlot, 10);

      if (mouseUiState.inventoryDragSource === "inventoryGrid") {
        if (hover.hoveredEquipmentSlotId && canEquipItemInSlot(draggedItemName, hover.hoveredEquipmentSlotId)) {
          if (
            isDojoUpstairsHeadbandLock(
              state,
              hover.hoveredEquipmentSlotId,
              playerEquipment[hover.hoveredEquipmentSlotId]
            ) &&
            draggedItemName !== "Training Headband"
          ) {
            if (Number.isInteger(sourceSlotIndex) && sourceSlotIndex >= 0 && sourceSlotIndex < totalSlots) {
              slotOrder[sourceSlotIndex] = draggedItemName;
            } else {
              placeInFirstEmptyInventorySlot(slotOrder, draggedItemName);
            }
            mouseUiState.inventoryDragItemName = "";
            mouseUiState.inventoryDragSource = "";
            mouseUiState.inventoryDragSourceSlot = "";
            clearItemInspection(mouseUiState);
            mouseUiState.inventoryDragReleaseRequest = false;
            sortedItems = sortInventoryItems(playerInventory);
            itemsByName = new Map(sortedItems.map((item) => [item.name, item]));
            slotOrder = ensureInventorySlotOrder(mouseUiState, sortedItems, totalSlots);
            hover = computeHoverState(sortedItems);
            return;
          }

          const swappedItem = playerEquipment[hover.hoveredEquipmentSlotId];
          if (removeItemFromInventory(playerInventory, draggedItemName, 1)) {
            playerEquipment[hover.hoveredEquipmentSlotId] = draggedItemName;
            if (swappedItem) {
              addItemToInventory(playerInventory, swappedItem, 1);
              if (Number.isInteger(sourceSlotIndex) && sourceSlotIndex >= 0 && sourceSlotIndex < totalSlots) {
                slotOrder[sourceSlotIndex] = swappedItem;
              } else {
                placeInFirstEmptyInventorySlot(slotOrder, swappedItem);
              }
            }
            placed = true;
          } else if (Number.isInteger(sourceSlotIndex) && sourceSlotIndex >= 0 && sourceSlotIndex < totalSlots) {
            slotOrder[sourceSlotIndex] = draggedItemName;
          } else {
            placeInFirstEmptyInventorySlot(slotOrder, draggedItemName);
          }
        } else if (hover.isOverGridSlot && hover.hoveredGridSlotIndex >= 0) {
          const targetIndex = hover.hoveredGridSlotIndex;
          const displaced = slotOrder[targetIndex];
          slotOrder[targetIndex] = draggedItemName;
          if (displaced && displaced !== draggedItemName) {
            if (
              Number.isInteger(sourceSlotIndex) &&
              sourceSlotIndex >= 0 &&
              sourceSlotIndex < totalSlots &&
              !slotOrder[sourceSlotIndex]
            ) {
              slotOrder[sourceSlotIndex] = displaced;
            } else {
              placeInFirstEmptyInventorySlot(slotOrder, displaced, targetIndex);
            }
          }
          placed = true;
        }
      } else if (hover.hoveredEquipmentSlotId && canEquipItemInSlot(draggedItemName, hover.hoveredEquipmentSlotId)) {
        if (
          isDojoUpstairsHeadbandLock(
            state,
            hover.hoveredEquipmentSlotId,
            playerEquipment[hover.hoveredEquipmentSlotId]
          ) &&
          draggedItemName !== "Training Headband"
        ) {
          restoreDraggedItem(mouseUiState, playerInventory, playerEquipment);
        } else {
          const swappedItem = playerEquipment[hover.hoveredEquipmentSlotId];
          playerEquipment[hover.hoveredEquipmentSlotId] = draggedItemName;
          if (swappedItem) addItemToInventory(playerInventory, swappedItem, 1);
          placed = true;
        }
      } else if (hover.isOverGridSlot && hover.hoveredGridSlotIndex >= 0) {
        addItemToInventory(playerInventory, draggedItemName, 1);
        const targetIndex = hover.hoveredGridSlotIndex;
        const displaced = slotOrder[targetIndex];
        slotOrder[targetIndex] = draggedItemName;
        if (displaced && displaced !== draggedItemName) {
          placeInFirstEmptyInventorySlot(slotOrder, displaced, targetIndex);
        }
        placed = true;
      }

      if (!placed) {
        if (mouseUiState.inventoryDragSource === "inventoryGrid") {
          if (Number.isInteger(sourceSlotIndex) && sourceSlotIndex >= 0 && sourceSlotIndex < totalSlots) {
            slotOrder[sourceSlotIndex] = draggedItemName;
          } else {
            placeInFirstEmptyInventorySlot(slotOrder, draggedItemName);
          }
        } else {
          restoreDraggedItem(mouseUiState, playerInventory, playerEquipment);
        }
      }
      mouseUiState.inventoryDragItemName = "";
      mouseUiState.inventoryDragSource = "";
      mouseUiState.inventoryDragSourceSlot = "";
      clearItemInspection(mouseUiState);
    }
    mouseUiState.inventoryDragReleaseRequest = false;
    sortedItems = sortInventoryItems(playerInventory);
    itemsByName = new Map(sortedItems.map((item) => [item.name, item]));
    slotOrder = ensureInventorySlotOrder(mouseUiState, sortedItems, totalSlots);
    hover = computeHoverState(sortedItems);
  }

  let inspectedItem = null;
  if (mouseUiState && !mouseUiState.insideCanvas && (
    mouseUiState.inventoryDetailsIndex !== -1 ||
    mouseUiState.inventoryDetailsSource ||
    mouseUiState.inventoryDetailsEquipmentSlot
  )) {
    clearItemInspection(mouseUiState);
  }
  const inspectedSource = typeof mouseUiState?.inventoryDetailsSource === "string"
    ? mouseUiState.inventoryDetailsSource
    : "";
  const inspectedEquipmentSlot = typeof mouseUiState?.inventoryDetailsEquipmentSlot === "string"
    ? mouseUiState.inventoryDetailsEquipmentSlot
    : "";
  const inspectedIndex = Number.isInteger(mouseUiState?.inventoryDetailsIndex)
    ? mouseUiState.inventoryDetailsIndex
    : -1;
  if (inspectedSource === "inventory" && inspectedIndex >= 0 && inspectedIndex < totalSlots) {
    const inspectedName = slotOrder[inspectedIndex];
    if (inspectedName) {
      inspectedItem = itemsByName.get(inspectedName) || getItemInfo(inspectedName, Number(playerInventory[inspectedName] || 1));
    } else if (mouseUiState) {
      clearItemInspection(mouseUiState);
    }
  } else if (inspectedSource === "equipment" && inspectedEquipmentSlot) {
    const equippedName = playerEquipment?.[inspectedEquipmentSlot] || null;
    if (equippedName) {
      inspectedItem = getItemInfo(equippedName, 1);
    } else {
      clearItemInspection(mouseUiState);
    }
  } else if (mouseUiState && (
    mouseUiState.inventoryDetailsIndex !== -1 ||
    mouseUiState.inventoryDetailsSource ||
    mouseUiState.inventoryDetailsEquipmentSlot
  )) {
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

    const itemNameAtSlot = slotOrder[i];
    if (itemNameAtSlot) {
      const item = itemsByName.get(itemNameAtSlot) || getItemInfo(itemNameAtSlot, Number(playerInventory[itemNameAtSlot] || 1));
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
  ctx.fillRect(equipmentPanelX, equipmentPanelY, equipmentPanelW, equipmentPanelH);
  ctx.strokeStyle = "rgba(255, 231, 167, 0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(equipmentPanelX + 0.5, equipmentPanelY + 0.5, equipmentPanelW - 1, equipmentPanelH - 1);

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
    const showUnequipAction = inspectedSource === "equipment" && Boolean(inspectedEquipmentSlot);
    const actionGapY = 8;
    const actionHeight = 20;
    const actionHintHeight = 14;
    const bubbleW = Math.min(
      320,
      Math.ceil(lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0)) + paddingX * 2
    );
    const textSectionH = lines.length * lineH + 12;
    const showActionRow = showEquipAction || showUnequipAction;
    const bubbleH = textSectionH + (showActionRow ? actionGapY + actionHeight + actionHintHeight + 8 : 0);
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

    let inspectedSlotX = 0;
    let inspectedSlotY = 0;
    let inspectedSlotW = slotSize;
    let inspectedSlotH = slotSize;
    if (inspectedSource === "equipment" && inspectedEquipmentSlot && equipmentLayout.slots[inspectedEquipmentSlot]) {
      const rect = equipmentLayout.slots[inspectedEquipmentSlot];
      inspectedSlotX = rect.x;
      inspectedSlotY = rect.y;
      inspectedSlotW = rect.w;
      inspectedSlotH = rect.h;
    } else {
      const inspectedCol = inspectedIndex % cols;
      const inspectedRow = Math.floor(inspectedIndex / cols);
      inspectedSlotX = gridX + inspectedCol * (slotSize + margin);
      inspectedSlotY = gridY + inspectedRow * (slotSize + margin);
    }
    const hoveringSlot = isPointInsideExpandedRect(
      mouseX,
      mouseY,
      inspectedSlotX,
      inspectedSlotY,
      inspectedSlotW,
      inspectedSlotH,
      INVENTORY_DETAILS_HOVER_PADDING
    );
    const hoveringBubble = isPointInsideExpandedRect(
      mouseX,
      mouseY,
      bubbleX,
      bubbleY,
      bubbleW,
      bubbleH,
      INVENTORY_DETAILS_HOVER_PADDING
    );
    if (!hoveringSlot && !hoveringBubble) {
      const nowMs = performance.now();
      const graceUntil = Number.isFinite(mouseUiState.inventoryDetailsCloseGraceUntil)
        ? mouseUiState.inventoryDetailsCloseGraceUntil
        : 0;
      if (graceUntil <= 0) {
        mouseUiState.inventoryDetailsCloseGraceUntil = nowMs + INVENTORY_DETAILS_CLOSE_GRACE_MS;
      } else if (nowMs >= graceUntil) {
        clearItemInspection(mouseUiState);
        return;
      }
    } else {
      mouseUiState.inventoryDetailsCloseGraceUntil = 0;
    }

    ctx.fillStyle = "rgba(18, 14, 10, 0.9)";
    ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
    ctx.strokeStyle = "rgba(255, 231, 167, 0.78)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bubbleX + 0.5, bubbleY + 0.5, bubbleW - 1, bubbleH - 1);

    for (let i = 0; i < lines.length; i++) {
      drawUiText(ctx, lines[i], bubbleX + paddingX, bubbleY + 16 + i * lineH, colors);
    }

    if (showActionRow) {
      const slotLabel = showUnequipAction
        ? getEquipmentSlotLabel(inspectedEquipmentSlot)
        : getEquipmentSlotLabel(inspectedItem.equipSlot);
      const actionText = showUnequipAction ? "Unequip" : "Equip";
      const actionTextW = Math.ceil(ctx.measureText(actionText).width);
      const buttonW = Math.max(66, actionTextW + 18);
      const buttonX = bubbleX + Math.round((bubbleW - buttonW) / 2);
      const buttonY = bubbleY + textSectionH + actionGapY;
      const hoveringEquipButton =
        mouseX >= buttonX &&
        mouseX <= buttonX + buttonW &&
        mouseY >= buttonY &&
        mouseY <= buttonY + actionHeight;

      if (mouseUiState.inventoryClickRequest && hoveringEquipButton) {
        if (showUnequipAction) {
          const slotId = inspectedEquipmentSlot;
          const equippedName = playerEquipment?.[slotId] || null;
          const blockedByHeadbandLock = isDojoUpstairsHeadbandLock(state, slotId, equippedName);
          if (!blockedByHeadbandLock && equippedName) {
            playerEquipment[slotId] = null;
            addItemToInventory(playerInventory, equippedName, 1);
            clearItemInspection(mouseUiState);
            mouseUiState.inventoryClickRequest = false;
            sortedItems = sortInventoryItems(playerInventory);
            hover = computeHoverState(sortedItems);
            return;
          }
        } else {
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
      }

      ctx.fillStyle = hoveringEquipButton ? "rgba(255, 227, 160, 0.35)" : "rgba(255, 227, 160, 0.2)";
      ctx.fillRect(buttonX, buttonY, buttonW, actionHeight);
      ctx.strokeStyle = hoveringEquipButton ? "rgba(255, 236, 194, 0.95)" : "rgba(255, 231, 167, 0.72)";
      ctx.lineWidth = 1;
      ctx.strokeRect(buttonX + 0.5, buttonY + 0.5, buttonW - 1, actionHeight - 1);
      drawUiText(ctx, actionText, buttonX + Math.round((buttonW - actionTextW) / 2), buttonY + 14, colors);

      if (hoveringEquipButton) {
        const hintText = showUnequipAction ? `Unequip from ${slotLabel}` : `Equip to ${slotLabel}`;
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
    const drawX = Math.round(mouseX - dragSize * 0.5);
    const drawY = Math.round(mouseY - dragSize * 0.5);
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
