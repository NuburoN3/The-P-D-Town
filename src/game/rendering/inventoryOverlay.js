import { GAME_STATES } from "../../core/constants.js";
import {
  FONT_12,
  FONT_16,
  drawUiText,
  getItemSpriteName,
  getItemSpriteScale
} from "./uiPrimitives.js";

const CATEGORY_ORDER = ["Key Item", "Gear", "Consumable", "Material", "Misc"];
const INVENTORY_DETAILS_CLOSE_GRACE_MS = 260;
const INVENTORY_DETAILS_HOVER_PADDING = 12;
const EQUIPMENT_SLOT_ORDER = [
  { id: "head", label: "Head" },
  { id: "torso", label: "Torso" },
  { id: "weapon", label: "Weapon" },
  { id: "shield", label: "Support" },
  { id: "legs", label: "Legs" },
  { id: "feet", label: "Feet" }
];
const PREVIEW_DIRECTION_CYCLE = ["down", "left", "up", "right"];

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

function normalizeInventoryPage(mouseUiState, totalPages) {
  const pageCount = Math.max(1, Number.isFinite(totalPages) ? Math.floor(totalPages) : 1);
  const raw = Number.isFinite(mouseUiState?.inventoryPage) ? Math.floor(mouseUiState.inventoryPage) : 0;
  const clamped = Math.max(0, Math.min(pageCount - 1, raw));
  if (mouseUiState) mouseUiState.inventoryPage = clamped;
  return clamped;
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeInventoryUiLayout(layout) {
  if (!layout || typeof layout !== "object") return null;
  if (!Number.isFinite(layout.inventoryPanelX)) layout.inventoryPanelX = null;
  if (!Number.isFinite(layout.inventoryPanelY)) layout.inventoryPanelY = null;
  if (!Number.isFinite(layout.equipmentPanelX)) layout.equipmentPanelX = null;
  if (!Number.isFinite(layout.equipmentPanelY)) layout.equipmentPanelY = null;
  return layout;
}

function clampPanelPosition(x, y, panelW, panelH, canvas) {
  const minX = 8;
  const minY = 30;
  const maxX = Math.max(minX, canvas.width - panelW - 8);
  const maxY = Math.max(minY, canvas.height - panelH - 8);
  return {
    x: clampValue(x, minX, maxX),
    y: clampValue(y, minY, maxY)
  };
}

function normalizePlayerCurrency(playerCurrency) {
  if (!playerCurrency || typeof playerCurrency !== "object") {
    return { gold: 0, silver: 0 };
  }
  const gold = Number.isFinite(playerCurrency.gold) ? Math.max(0, Math.floor(playerCurrency.gold)) : 0;
  const silverRaw = Number.isFinite(playerCurrency.silver) ? Math.max(0, Math.floor(playerCurrency.silver)) : 0;
  const carry = Math.floor(silverRaw / 100);
  const silver = silverRaw % 100;
  playerCurrency.gold = gold + carry;
  playerCurrency.silver = silver;
  return {
    gold: playerCurrency.gold,
    silver: playerCurrency.silver
  };
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
  const legsY = torsoY + slotSize + 26;
  const torsoBottomY = torsoY + slotSize;
  const gapBetweenTorsoAndLegs = Math.max(0, legsY - torsoBottomY);
  const armY = torsoBottomY + Math.round((gapBetweenTorsoAndLegs - slotSize) / 2);
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

function addCurrency(playerCurrency, goldAmount = 0, silverAmount = 0) {
  if (!playerCurrency || typeof playerCurrency !== "object") return;
  const gold = Number.isFinite(playerCurrency.gold) ? Math.max(0, Math.floor(playerCurrency.gold)) : 0;
  const silver = Number.isFinite(playerCurrency.silver) ? Math.max(0, Math.floor(playerCurrency.silver)) : 0;
  const addGold = Number.isFinite(goldAmount) ? Math.max(0, Math.floor(goldAmount)) : 0;
  const addSilver = Number.isFinite(silverAmount) ? Math.max(0, Math.floor(silverAmount)) : 0;
  const totalSilver = silver + addSilver;
  playerCurrency.gold = gold + addGold + Math.floor(totalSilver / 100);
  playerCurrency.silver = totalSilver % 100;
}

function removeLeftoverById(leftovers, leftoverId) {
  if (!Array.isArray(leftovers) || !leftoverId) return;
  const index = leftovers.findIndex((entry) => entry?.id === leftoverId);
  if (index >= 0) leftovers.splice(index, 1);
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

function clearLeftoversInspection(mouseUiState) {
  if (!mouseUiState) return;
  mouseUiState.leftoversDetailsIndex = -1;
  mouseUiState.leftoversDetailsAnchorX = -1;
  mouseUiState.leftoversDetailsAnchorY = -1;
  mouseUiState.leftoversDetailsCloseGraceUntil = 0;
}

function normalizePreviewDirection(mouseUiState) {
  const current = typeof mouseUiState?.inventoryPreviewDirection === "string"
    ? mouseUiState.inventoryPreviewDirection
    : "";
  if (!PREVIEW_DIRECTION_CYCLE.includes(current)) {
    if (mouseUiState) mouseUiState.inventoryPreviewDirection = "down";
    return "down";
  }
  return current;
}

function rotatePreviewDirection(mouseUiState, step) {
  const current = normalizePreviewDirection(mouseUiState);
  const index = PREVIEW_DIRECTION_CYCLE.indexOf(current);
  const nextIndex = (index + step + PREVIEW_DIRECTION_CYCLE.length) % PREVIEW_DIRECTION_CYCLE.length;
  const next = PREVIEW_DIRECTION_CYCLE[nextIndex];
  if (mouseUiState) mouseUiState.inventoryPreviewDirection = next;
  return next;
}

function getPreviewRotateButtons(equipmentPanelX, equipmentPanelY, equipmentPanelW, equipmentPanelH) {
  const size = 24;
  const inset = 8;
  const y = equipmentPanelY + equipmentPanelH - size - inset;
  return {
    left: { x: equipmentPanelX + inset, y, w: size, h: size },
    right: { x: equipmentPanelX + equipmentPanelW - size - inset, y, w: size, h: size }
  };
}

function drawPreviewRotateButton(ctx, rect, direction, isHovered) {
  const cx = rect.x + rect.w * 0.5;
  const cy = rect.y + rect.h * 0.5;
  const radius = 8;
  const sweep = Math.PI * 1.25;
  const start = direction === "left" ? Math.PI * 0.12 : Math.PI * 0.88;
  const end = direction === "left" ? start + sweep : start - sweep;
  const arrowAngle = direction === "left" ? end : end;

  ctx.save();
  ctx.fillStyle = isHovered ? "rgba(255, 235, 186, 0.28)" : "rgba(255, 235, 186, 0.16)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = isHovered ? "rgba(255, 236, 194, 0.95)" : "rgba(255, 231, 167, 0.72)";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

  ctx.strokeStyle = isHovered ? "rgba(255, 245, 214, 0.96)" : "rgba(255, 233, 178, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end, direction === "right");
  ctx.stroke();

  const tipX = cx + Math.cos(arrowAngle) * radius;
  const tipY = cy + Math.sin(arrowAngle) * radius;
  const wingA = arrowAngle + (direction === "left" ? 0.85 : -0.85);
  const wingB = arrowAngle + (direction === "left" ? -0.85 : 0.85);
  const wingLen = 4.8;
  ctx.fillStyle = isHovered ? "rgba(255, 245, 214, 0.98)" : "rgba(255, 233, 178, 0.92)";
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX + Math.cos(wingA) * wingLen, tipY + Math.sin(wingA) * wingLen);
  ctx.lineTo(tipX + Math.cos(wingB) * wingLen, tipY + Math.sin(wingB) * wingLen);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function formatFacingLabel(direction) {
  const normalized = String(direction || "down").toLowerCase();
  if (normalized === "left") return "Left";
  if (normalized === "right") return "Right";
  if (normalized === "up") return "Up";
  return "Front";
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

function drawSlotLabelInside(ctx, label, x, y, w, h, colors) {
  const words = String(label || "").toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  const maxLineWidth = w - 10;
  ctx.font = "500 7px 'Cinzel', 'Palatino Linotype', 'Book Antiqua', serif";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxLineWidth || current.length === 0) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > 2) {
    lines.length = 2;
    const last = lines[1];
    lines[1] = `${last.slice(0, Math.max(0, last.length - 1))}.`;
  }

  const lineH = 7;
  const totalH = lines.length * lineH;
  let textY = y + Math.round((h - totalH) / 2) + 6;
  for (const line of lines) {
    const lineW = ctx.measureText(line).width;
    drawUiText(ctx, line, x + (w - lineW) / 2, textY, {
      ...colors,
      TEXT: "rgba(246, 224, 180, 0.68)",
      TEXT_SHADOW: "rgba(8, 6, 4, 0.64)"
    });
    textY += lineH;
  }
}

function drawEquipmentSlotShell(ctx, rect, { isHovered = false, canDropHere = false, hasItem = false } = {}) {
  const x = rect.x;
  const y = rect.y;
  const w = rect.w;
  const h = rect.h;
  const pulse = Math.sin(performance.now() * 0.01) * 0.5 + 0.5;

  const outerGlow = isHovered
    ? `rgba(255, 234, 186, ${0.18 + pulse * 0.16})`
    : (canDropHere ? `rgba(143, 226, 169, ${0.14 + pulse * 0.12})` : "rgba(255, 228, 172, 0.09)");
  ctx.fillStyle = outerGlow;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

  const surface = ctx.createLinearGradient(x, y, x, y + h);
  if (hasItem) {
    surface.addColorStop(0, "rgba(95, 86, 59, 0.62)");
    surface.addColorStop(1, "rgba(49, 43, 30, 0.66)");
  } else {
    surface.addColorStop(0, "rgba(255, 244, 214, 0.18)");
    surface.addColorStop(1, "rgba(94, 79, 52, 0.28)");
  }
  ctx.fillStyle = surface;
  ctx.fillRect(x, y, w, h);

  const innerSheen = ctx.createLinearGradient(x + 1, y + 1, x + 1, y + h * 0.55);
  innerSheen.addColorStop(0, "rgba(255,255,255,0.12)");
  innerSheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = innerSheen;
  ctx.fillRect(x + 1, y + 1, w - 2, Math.max(8, h * 0.55));

  ctx.strokeStyle = isHovered
    ? `rgba(255, 239, 201, ${0.78 + pulse * 0.2})`
    : (canDropHere ? `rgba(162, 241, 186, ${0.72 + pulse * 0.22})` : "rgba(233, 210, 154, 0.82)");
  ctx.lineWidth = isHovered ? 2 : 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.strokeStyle = "rgba(62, 46, 24, 0.78)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);

  const accent = isHovered
    ? `rgba(255, 239, 201, ${0.76 + pulse * 0.2})`
    : (canDropHere ? `rgba(176, 244, 198, ${0.66 + pulse * 0.2})` : "rgba(235, 211, 156, 0.76)");
  ctx.fillStyle = accent;
  ctx.fillRect(x + 3, y + 3, 3, 3);
  ctx.fillRect(x + w - 6, y + 3, 3, 3);
  ctx.fillRect(x + 3, y + h - 6, 3, 3);
  ctx.fillRect(x + w - 6, y + h - 6, 3, 3);

  if (isHovered || canDropHere) {
    const ringInset = isHovered ? 3 : 4;
    ctx.strokeStyle = isHovered
      ? `rgba(255, 238, 196, ${0.22 + pulse * 0.24})`
      : `rgba(176, 244, 198, ${0.16 + pulse * 0.18})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x + ringInset + 0.5,
      y + ringInset + 0.5,
      Math.max(2, w - ringInset * 2 - 1),
      Math.max(2, h - ringInset * 2 - 1)
    );
  }

  if (hasItem) {
    ctx.fillStyle = "rgba(255, 232, 176, 0.14)";
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  }
}

function getPlayerPreviewFrameMetrics(sprite) {
  const defaultFrameWidth = 32;
  const defaultFrameHeight = 32;
  const defaultFramesPerRow = 3;
  const defaultRows = 4;
  if (!sprite) {
    return {
      frameWidth: defaultFrameWidth,
      frameHeight: defaultFrameHeight,
      framesPerRow: defaultFramesPerRow,
      rows: defaultRows
    };
  }

  const width = Number.isFinite(sprite.naturalWidth) && sprite.naturalWidth > 0 ? sprite.naturalWidth : sprite.width;
  const height = Number.isFinite(sprite.naturalHeight) && sprite.naturalHeight > 0 ? sprite.naturalHeight : sprite.height;
  const framesPerRow = Number.isFinite(width) && width >= defaultFramesPerRow
    ? defaultFramesPerRow
    : defaultFramesPerRow;
  const rows = Number.isFinite(height) && height >= defaultRows
    ? defaultRows
    : defaultRows;

  return {
    frameWidth: Math.max(1, Math.floor(width / framesPerRow) || defaultFrameWidth),
    frameHeight: Math.max(1, Math.floor(height / rows) || defaultFrameHeight),
    framesPerRow,
    rows
  };
}

function drawEquipmentPreview(
  ctx,
  state,
  equipmentPanelX,
  equipmentPanelY,
  equipmentPanelW,
  equipmentPanelH,
  equipmentLayout,
  getItemSprite,
  previewDirection
) {
  const playerSprite = state?.player?.sprite;
  if (!playerSprite || !(playerSprite.width > 0 || playerSprite.naturalWidth > 0)) return;

  const { frameWidth, frameHeight, framesPerRow } = getPlayerPreviewFrameMetrics(playerSprite);
  const previewFrame = Math.min(1, Math.max(0, framesPerRow - 1));
  const directionToRow = {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  };
  const previewRow = directionToRow[previewDirection] ?? 0;
  const sx = previewFrame * frameWidth;
  const sy = previewRow * frameHeight;

  const previewTop = equipmentPanelY + 24;
  const previewBottom = equipmentPanelY + equipmentPanelH - 14;
  const previewHeight = Math.max(40, previewBottom - previewTop);
  const previewWidth = equipmentPanelW - 16;
  const baseScale = Math.min(previewWidth / frameWidth, previewHeight / frameHeight);
  const scale = Math.max(1.05, Math.min(baseScale * 0.8, 5));
  const drawWidth = frameWidth * scale;
  const drawHeight = frameHeight * scale;
  const drawX = Math.round(equipmentLayout.centerX - drawWidth / 2);
  const centeredY = previewTop + (previewHeight - drawHeight) * 0.5;
  const drawY = Math.round(centeredY - 8);

  ctx.save();
  ctx.beginPath();
  ctx.rect(equipmentPanelX + 1, equipmentPanelY + 1, equipmentPanelW - 2, equipmentPanelH - 2);
  ctx.clip();

  const glow = ctx.createRadialGradient(
    equipmentLayout.centerX,
    drawY + drawHeight * 0.45,
    8,
    equipmentLayout.centerX,
    drawY + drawHeight * 0.55,
    Math.max(36, drawWidth * 0.8)
  );
  glow.addColorStop(0, "rgba(255, 236, 188, 0.3)");
  glow.addColorStop(1, "rgba(255, 231, 167, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(equipmentPanelX + 2, equipmentPanelY + 22, equipmentPanelW - 4, equipmentPanelH - 26);

  ctx.globalAlpha = 0.9;
  ctx.drawImage(playerSprite, sx, sy, frameWidth, frameHeight, drawX, drawY, drawWidth, drawHeight);

  const anchoredSlotRatios = {
    head: { x: 0.5, y: 0.16 },
    torso: { x: 0.5, y: 0.43 },
    weapon: { x: 0.18, y: 0.54 },
    shield: { x: 0.82, y: 0.54 },
    legs: { x: 0.5, y: 0.73 },
    feet: { x: 0.5, y: 0.9 }
  };
  const playerEquipment = state?.playerEquipment || {};

  for (const slot of EQUIPMENT_SLOT_ORDER) {
    const equippedItemName = playerEquipment[slot.id];
    if (!equippedItemName) continue;

    if (equippedItemName === "Training Headband") {
      const overlay = getItemSprite("equipTrainingHeadband");
      if (overlay && (overlay.width > 0 || overlay.naturalWidth > 0)) {
        ctx.drawImage(overlay, sx, sy, frameWidth, frameHeight, drawX, drawY, drawWidth, drawHeight);
      }
      continue;
    }

    const spriteName = getItemSpriteName(equippedItemName);
    const itemSprite = spriteName ? getItemSprite(spriteName) : null;
    const ratio = anchoredSlotRatios[slot.id];
    if (!itemSprite || !(itemSprite.width > 0 || itemSprite.naturalWidth > 0) || !ratio) continue;

    const iconSize = Math.max(16, Math.round(Math.min(drawWidth, drawHeight) * 0.22));
    const iconX = Math.round(drawX + drawWidth * ratio.x - iconSize / 2);
    const iconY = Math.round(drawY + drawHeight * ratio.y - iconSize / 2);
    ctx.globalAlpha = 0.88;
    ctx.drawImage(itemSprite, iconX, iconY, iconSize, iconSize);
  }
  ctx.restore();
}

function drawLeftoversLootOverlay(ctx, state, canvas, colors, getItemSprite) {
  const { playerInventory, playerCurrency, mouseUiState, leftoversUiState, leftovers, inventoryUiLayout } = state;
  if (!leftoversUiState?.active) return false;
  if (!Array.isArray(leftovers)) {
    clearLeftoversInspection(mouseUiState);
    leftoversUiState.active = false;
    leftoversUiState.leftoverId = "";
    leftoversUiState.openedFromInteraction = false;
    leftoversUiState.requestCloseInventory = false;
    return false;
  }

  let activeLeftover = leftovers.find((entry) => entry?.id === leftoversUiState.leftoverId) || null;
  if (!activeLeftover) {
    clearLeftoversInspection(mouseUiState);
    leftoversUiState.active = false;
    leftoversUiState.leftoverId = "";
    leftoversUiState.openedFromInteraction = false;
    leftoversUiState.requestCloseInventory = false;
    return false;
  }
  const lootItems = Array.isArray(activeLeftover.items)
    ? activeLeftover.items.filter((entry) => entry?.name && Number(entry.amount) > 0)
    : [];
  activeLeftover.items = lootItems.map((entry) => ({
    name: String(entry.name),
    amount: Math.max(1, Math.floor(Number(entry.amount) || 1))
  }));
  activeLeftover.silver = Number.isFinite(activeLeftover.silver) ? Math.max(0, Math.floor(activeLeftover.silver)) : 0;
  activeLeftover.gold = Number.isFinite(activeLeftover.gold) ? Math.max(0, Math.floor(activeLeftover.gold)) : 0;

  const slotSize = 36;
  const margin = 2;
  const cols = 8;
  const rows = 3;
  const visibleSlots = cols * rows;
  const gridWidth = cols * (slotSize + margin) - margin;
  const gridHeight = rows * (slotSize + margin) - margin;
  const inventoryPanelW = gridWidth + 20;
  const inventoryPanelH = gridHeight + 42;
  const lootSlotSize = 34;
  const lootCols = 4;
  const initialLootCount = activeLeftover.items.length + (activeLeftover.gold > 0 ? 1 : 0) + (activeLeftover.silver > 0 ? 1 : 0);
  const lootRows = Math.max(2, Math.ceil(Math.max(1, initialLootCount) / lootCols));
  const lootGridW = lootCols * (lootSlotSize + margin) - margin;
  const lootGridH = lootRows * (lootSlotSize + margin) - margin;
  const lootPanelW = lootGridW + 20;
  const lootPanelH = lootGridH + 78;
  const panelGap = 18;

  const defaultClusterW = inventoryPanelW + panelGap + lootPanelW;
  const defaultClusterH = Math.max(inventoryPanelH + 22, lootPanelH + 22);
  const defaultInventoryPanelX = Math.round((canvas.width - defaultClusterW) * 0.5);
  const defaultInventoryPanelY = Math.round((canvas.height - defaultClusterH) * 0.5) + 22;
  const defaultLootPanelX = defaultInventoryPanelX + inventoryPanelW + panelGap;
  const defaultLootPanelY = defaultInventoryPanelY + 12;

  const layoutState = normalizeInventoryUiLayout(inventoryUiLayout);
  let inventoryPanelX = Number.isFinite(layoutState?.inventoryPanelX) ? layoutState.inventoryPanelX : defaultInventoryPanelX;
  let inventoryPanelY = Number.isFinite(layoutState?.inventoryPanelY) ? layoutState.inventoryPanelY : defaultInventoryPanelY;
  let lootPanelX = Number.isFinite(layoutState?.equipmentPanelX) ? layoutState.equipmentPanelX : defaultLootPanelX;
  let lootPanelY = Number.isFinite(layoutState?.equipmentPanelY) ? layoutState.equipmentPanelY : defaultLootPanelY;

  const mouseInsideCanvas = Boolean(mouseUiState?.insideCanvas);
  const mouseX = mouseUiState?.x || 0;
  const mouseY = mouseUiState?.y || 0;

  if (mouseUiState && !mouseUiState.inventoryLeftDown) {
    mouseUiState.inventoryPanelDragTarget = "";
  }
  if (mouseUiState?.inventoryPanelDragTarget && mouseUiState.inventoryLeftDown && mouseInsideCanvas) {
    const target = mouseUiState.inventoryPanelDragTarget;
    if (target === "inventory") {
      inventoryPanelX = mouseX - (mouseUiState.inventoryPanelDragOffsetX || 0);
      inventoryPanelY = mouseY - (mouseUiState.inventoryPanelDragOffsetY || 0);
    } else if (target === "equipment" || target === "leftovers") {
      lootPanelX = mouseX - (mouseUiState.inventoryPanelDragOffsetX || 0);
      lootPanelY = mouseY - (mouseUiState.inventoryPanelDragOffsetY || 0);
    }
  }

  const clampedInventoryPanel = clampPanelPosition(inventoryPanelX, inventoryPanelY, inventoryPanelW, inventoryPanelH, canvas);
  inventoryPanelX = clampedInventoryPanel.x;
  inventoryPanelY = clampedInventoryPanel.y;
  const clampedLootPanel = clampPanelPosition(lootPanelX, lootPanelY, lootPanelW, lootPanelH, canvas);
  lootPanelX = clampedLootPanel.x;
  lootPanelY = clampedLootPanel.y;
  if (layoutState) {
    layoutState.inventoryPanelX = inventoryPanelX;
    layoutState.inventoryPanelY = inventoryPanelY;
    layoutState.equipmentPanelX = lootPanelX;
    layoutState.equipmentPanelY = lootPanelY;
  }

  const sortedItems = sortInventoryItems(playerInventory);
  const totalSlots = Math.max(visibleSlots, sortedItems.length);
  const slotOrder = ensureInventorySlotOrder(mouseUiState, sortedItems, totalSlots);
  const itemsByName = new Map(sortedItems.map((item) => [item.name, item]));
  const gridX = inventoryPanelX + 10;
  const gridY = inventoryPanelY + 14;
  const lootGridX = lootPanelX + 10;
  const lootGridY = lootPanelY + 24;

  ctx.fillStyle = colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = FONT_16;
  const tabPadX = 12;
  const tabH = 24;
  const inventoryTabText = "Inventory";
  const inventoryTabW = Math.ceil(ctx.measureText(inventoryTabText).width) + tabPadX * 2;
  const inventoryTabX = gridX;
  const inventoryTabY = gridY - tabH;
  const leftoversTabText = "Leftovers";
  const leftoversTabW = Math.ceil(ctx.measureText(leftoversTabText).width) + tabPadX * 2;
  const leftoversTabX = lootPanelX + 1;
  const leftoversTabY = lootPanelY - tabH + 1;
  const closeButtonText = "x";
  const closeButtonW = 24;
  const closeButtonH = 16;
  const closeButtonX = Math.round(lootPanelX + (lootPanelW - closeButtonW) * 0.5);
  const closeButtonY = lootPanelY + 4;

  const inventoryTabHovered = mouseInsideCanvas && isPointInsideExpandedRect(
    mouseX, mouseY, inventoryTabX, inventoryTabY, inventoryTabW, tabH, 0
  );
  const leftoversTabHovered = mouseInsideCanvas && isPointInsideExpandedRect(
    mouseX, mouseY, leftoversTabX, leftoversTabY, leftoversTabW, tabH, 0
  );
  const closeButtonHovered = mouseInsideCanvas && isPointInsideExpandedRect(
    mouseX, mouseY, closeButtonX, closeButtonY, closeButtonW, closeButtonH, 0
  );
  if (
    mouseUiState?.inventoryDragStartRequest &&
    !mouseUiState.inventoryDragItemName &&
    (inventoryTabHovered || leftoversTabHovered)
  ) {
    mouseUiState.inventoryPanelDragTarget = inventoryTabHovered ? "inventory" : "leftovers";
    mouseUiState.inventoryPanelDragOffsetX = inventoryTabHovered
      ? (mouseX - inventoryPanelX)
      : (mouseX - lootPanelX);
    mouseUiState.inventoryPanelDragOffsetY = inventoryTabHovered
      ? (mouseY - inventoryPanelY)
      : (mouseY - lootPanelY);
    mouseUiState.inventoryDragStartRequest = false;
    mouseUiState.inventoryClickRequest = false;
    mouseUiState.inventoryDoubleClickRequest = false;
  }
  if (mouseUiState?.inventoryPanelDragTarget) {
    mouseUiState.inventoryClickRequest = false;
    mouseUiState.inventoryDoubleClickRequest = false;
  }

  ctx.fillStyle = colors.INVENTORY_SLOT_BG;
  ctx.fillRect(inventoryTabX, inventoryTabY, inventoryTabW, tabH);
  ctx.strokeStyle = inventoryTabHovered ? "rgba(255, 236, 194, 0.95)" : colors.INVENTORY_SLOT_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(inventoryTabX + 0.5, inventoryTabY + 0.5, inventoryTabW - 1, tabH - 1);
  drawUiText(ctx, inventoryTabText, inventoryTabX + tabPadX, inventoryTabY + 17, colors);

  for (let i = 0; i < visibleSlots; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (slotSize + margin);
    const y = gridY + row * (slotSize + margin);
    const itemName = slotOrder[i];

    ctx.fillStyle = colors.INVENTORY_SLOT_BG;
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = colors.INVENTORY_SLOT_BORDER;
    ctx.strokeRect(x, y, slotSize, slotSize);
    if (!itemName) continue;
    const item = itemsByName.get(itemName) || getItemInfo(itemName, Number(playerInventory[itemName] || 1));
    drawItemInSlot(ctx, item.name, x, y, slotSize, colors, getItemSprite);
    if (item.count > 1) {
      ctx.font = FONT_12;
      const countText = `x${item.count}`;
      const countW = ctx.measureText(countText).width;
      drawUiText(ctx, countText, x + slotSize - countW - 2, y + slotSize - 12, colors);
    }
  }

  const currency = normalizePlayerCurrency(playerCurrency);
  const coinY = gridY + gridHeight + 14;
  const goldX = gridX + 8;
  const silverX = goldX + 66;
  ctx.fillStyle = "rgba(241, 208, 116, 0.98)";
  ctx.beginPath();
  ctx.arc(goldX, coinY, 6, 0, Math.PI * 2);
  ctx.fill();
  drawUiText(ctx, String(currency.gold), goldX + 12, coinY + 4, colors);
  ctx.fillStyle = "rgba(188, 196, 204, 0.95)";
  ctx.beginPath();
  ctx.arc(silverX, coinY, 6, 0, Math.PI * 2);
  ctx.fill();
  drawUiText(ctx, String(currency.silver), silverX + 12, coinY + 4, colors);

  ctx.fillStyle = "rgba(58, 52, 42, 0.42)";
  ctx.fillRect(lootPanelX, lootPanelY, lootPanelW, lootPanelH);
  ctx.strokeStyle = "rgba(255, 231, 167, 0.5)";
  ctx.strokeRect(lootPanelX + 0.5, lootPanelY + 0.5, lootPanelW - 1, lootPanelH - 1);
  ctx.fillStyle = colors.INVENTORY_SLOT_BG;
  ctx.fillRect(leftoversTabX, leftoversTabY, leftoversTabW, tabH);
  ctx.strokeStyle = leftoversTabHovered ? "rgba(255, 236, 194, 0.95)" : colors.INVENTORY_SLOT_BORDER;
  ctx.strokeRect(leftoversTabX + 0.5, leftoversTabY + 0.5, leftoversTabW - 1, tabH - 1);
  drawUiText(ctx, leftoversTabText, leftoversTabX + tabPadX, leftoversTabY + 17, colors);
  ctx.fillStyle = closeButtonHovered ? "rgba(255, 227, 160, 0.35)" : "rgba(255, 227, 160, 0.18)";
  ctx.fillRect(closeButtonX, closeButtonY, closeButtonW, closeButtonH);
  ctx.strokeStyle = closeButtonHovered ? "rgba(255, 236, 194, 0.95)" : "rgba(255, 231, 167, 0.72)";
  ctx.strokeRect(closeButtonX + 0.5, closeButtonY + 0.5, closeButtonW - 1, closeButtonH - 1);
  drawUiText(ctx, closeButtonText, closeButtonX + 9, closeButtonY + 12, colors);

  const lootEntries = [];
  if (activeLeftover.gold > 0) lootEntries.push({ type: "gold", label: "Gold Coin", amount: activeLeftover.gold });
  if (activeLeftover.silver > 0) lootEntries.push({ type: "silver", label: "Silver Coins", amount: activeLeftover.silver });
  for (const item of activeLeftover.items) {
    lootEntries.push({ type: "item", label: item.name, amount: Math.max(1, Math.floor(Number(item.amount) || 1)) });
  }
  const silverCoinSprite = getItemSprite("silverCoins");

  let hoveredLootIndex = -1;
  for (let i = 0; i < lootCols * lootRows; i++) {
    const col = i % lootCols;
    const row = Math.floor(i / lootCols);
    const x = lootGridX + col * (lootSlotSize + margin);
    const y = lootGridY + row * (lootSlotSize + margin);
    const entry = lootEntries[i] || null;
    const isHovered = mouseInsideCanvas && isPointInsideExpandedRect(mouseX, mouseY, x, y, lootSlotSize, lootSlotSize, 0);
    if (isHovered) hoveredLootIndex = i;

    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fillRect(x, y, lootSlotSize, lootSlotSize);
    ctx.strokeStyle = isHovered ? "rgba(255, 236, 194, 0.95)" : colors.INVENTORY_SLOT_BORDER;
    ctx.strokeRect(x, y, lootSlotSize, lootSlotSize);
    if (!entry) continue;

    if (entry.type === "gold" || entry.type === "silver") {
      if (
        entry.type === "silver" &&
        silverCoinSprite &&
        (silverCoinSprite.width > 0 || silverCoinSprite.naturalWidth > 0)
      ) {
        const iconSize = Math.max(18, Math.round(lootSlotSize * 0.66));
        const iconX = Math.round(x + (lootSlotSize - iconSize) * 0.5);
        const iconY = Math.round(y + (lootSlotSize - iconSize) * 0.5);
        ctx.drawImage(silverCoinSprite, iconX, iconY, iconSize, iconSize);
      } else {
        ctx.fillStyle = entry.type === "gold" ? "rgba(241, 208, 116, 0.98)" : "rgba(188, 196, 204, 0.95)";
        ctx.beginPath();
        ctx.arc(x + lootSlotSize * 0.5, y + lootSlotSize * 0.5, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      drawItemInSlot(ctx, entry.label, x, y, lootSlotSize, colors, getItemSprite);
    }
    if (entry.type === "item" && entry.amount > 1) {
      ctx.font = FONT_12;
      const countText = `x${entry.amount}`;
      const countW = ctx.measureText(countText).width;
      drawUiText(ctx, countText, x + lootSlotSize - countW - 2, y + lootSlotSize - 10, colors);
    }
  }

  const takeAllW = 90;
  const takeAllH = 18;
  const takeAllX = Math.round(lootPanelX + (lootPanelW - takeAllW) * 0.5);
  const takeAllY = lootPanelY + lootPanelH - takeAllH - 8;
  const takeAllHovered = mouseInsideCanvas && isPointInsideExpandedRect(mouseX, mouseY, takeAllX, takeAllY, takeAllW, takeAllH, 0);
  ctx.fillStyle = takeAllHovered ? "rgba(255, 227, 160, 0.35)" : "rgba(255, 227, 160, 0.2)";
  ctx.fillRect(takeAllX, takeAllY, takeAllW, takeAllH);
  ctx.strokeStyle = takeAllHovered ? "rgba(255, 236, 194, 0.95)" : "rgba(255, 231, 167, 0.72)";
  ctx.strokeRect(takeAllX + 0.5, takeAllY + 0.5, takeAllW - 1, takeAllH - 1);
  drawUiText(ctx, "Take All", takeAllX + 19, takeAllY + 13, colors);

  const transferLootEntry = (entry) => {
    if (!entry) return;
    if (entry.type === "gold") {
      addCurrency(playerCurrency, entry.amount, 0);
      activeLeftover.gold = 0;
      return;
    }
    if (entry.type === "silver") {
      addCurrency(playerCurrency, 0, entry.amount);
      activeLeftover.silver = 0;
      return;
    }
    addItemToInventory(playerInventory, entry.label, entry.amount);
    const itemIndex = activeLeftover.items.findIndex((item) => item.name === entry.label);
    if (itemIndex >= 0) activeLeftover.items.splice(itemIndex, 1);
  };
  const canTransferHoveredLoot = hoveredLootIndex >= 0 && hoveredLootIndex < lootEntries.length;
  if (mouseUiState?.inventoryClickRequest && closeButtonHovered) {
    leftoversUiState.requestCloseInventory = true;
    mouseUiState.inventoryClickRequest = false;
    mouseUiState.inventoryDoubleClickRequest = false;
  } else if (mouseUiState?.inventoryDoubleClickRequest && canTransferHoveredLoot) {
    transferLootEntry(lootEntries[hoveredLootIndex]);
  } else if (mouseUiState?.inventoryClickRequest && takeAllHovered) {
    for (const entry of lootEntries) transferLootEntry(entry);
  }

  if (mouseUiState?.inventoryDetailsRequest) {
    if (canTransferHoveredLoot) {
      mouseUiState.leftoversDetailsIndex = hoveredLootIndex;
      mouseUiState.leftoversDetailsAnchorX = mouseX;
      mouseUiState.leftoversDetailsAnchorY = mouseY;
      mouseUiState.leftoversDetailsCloseGraceUntil = 0;
    } else {
      clearLeftoversInspection(mouseUiState);
    }
    mouseUiState.inventoryDetailsRequest = false;
    clearItemInspection(mouseUiState);
  }

  const inspectedLootIndex = Number.isInteger(mouseUiState?.leftoversDetailsIndex)
    ? mouseUiState.leftoversDetailsIndex
    : -1;
  const inspectedLootEntry = (inspectedLootIndex >= 0 && inspectedLootIndex < lootEntries.length)
    ? lootEntries[inspectedLootIndex]
    : null;
  if (!inspectedLootEntry && inspectedLootIndex >= 0) {
    clearLeftoversInspection(mouseUiState);
  }

  const leftoverEmpty = activeLeftover.gold <= 0 && activeLeftover.silver <= 0 && activeLeftover.items.length === 0;
  if (leftoverEmpty) {
    activeLeftover.depleted = true;
  }

  const getLootTooltipText = (entry) => {
    if (!entry) return "";
    if (entry.type === "silver") return `Silver Coins: ${entry.amount}`;
    if (entry.type === "gold") return `Gold Coins: ${entry.amount}`;
    return entry.label;
  };
  if (hoveredLootIndex >= 0 && hoveredLootIndex < lootEntries.length && mouseUiState?.insideCanvas && !inspectedLootEntry) {
    const tooltipText = getLootTooltipText(lootEntries[hoveredLootIndex]);
    ctx.font = FONT_12;
    const bubbleW = Math.ceil(ctx.measureText(tooltipText).width) + 16;
    const bubbleH = 20;
    const bubbleX = Math.max(8, Math.min(canvas.width - bubbleW - 8, mouseX + 14));
    const bubbleY = Math.max(8, Math.min(canvas.height - bubbleH - 8, mouseY - bubbleH - 10));
    ctx.fillStyle = "rgba(18, 14, 10, 0.86)";
    ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
    ctx.strokeStyle = "rgba(255, 231, 167, 0.7)";
    ctx.strokeRect(bubbleX + 0.5, bubbleY + 0.5, bubbleW - 1, bubbleH - 1);
    drawUiText(ctx, tooltipText, bubbleX + 8, bubbleY + 14, colors);
  }
  if (leftoverEmpty) {
    const emptyText = "No loot remaining";
    ctx.font = FONT_12;
    const emptyW = Math.ceil(ctx.measureText(emptyText).width);
    drawUiText(
      ctx,
      emptyText,
      Math.round(lootPanelX + (lootPanelW - emptyW) * 0.5),
      lootPanelY + lootPanelH - 30,
      colors
    );
  }

  if (inspectedLootEntry && mouseUiState?.insideCanvas) {
    ctx.font = FONT_12;
    const inspectedCol = inspectedLootIndex % lootCols;
    const inspectedRow = Math.floor(inspectedLootIndex / lootCols);
    const inspectedSlotX = lootGridX + inspectedCol * (lootSlotSize + margin);
    const inspectedSlotY = lootGridY + inspectedRow * (lootSlotSize + margin);
    const inspectedSlotW = lootSlotSize;
    const inspectedSlotH = lootSlotSize;
    const description = inspectedLootEntry.type === "silver"
      ? `A stack of silver coins. Contains ${inspectedLootEntry.amount} silver coins.`
      : inspectedLootEntry.type === "gold"
        ? `A stack of gold coins. Contains ${inspectedLootEntry.amount} gold coins.`
        : getItemInfo(inspectedLootEntry.label, inspectedLootEntry.amount).description;
    const lines = [getLootTooltipText(inspectedLootEntry), description];
    const paddingX = 10;
    const lineH = 14;
    const textSectionH = lines.length * lineH + 10;
    const actionGapY = 8;
    const actionHeight = 20;
    const actionHintHeight = 14;
    const bubbleW = Math.min(
      320,
      Math.ceil(lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0)) + paddingX * 2
    );
    const bubbleH = textSectionH + actionGapY + actionHeight + actionHintHeight + 8;
    const anchorX = Number.isFinite(mouseUiState.leftoversDetailsAnchorX) ? mouseUiState.leftoversDetailsAnchorX : mouseX;
    const anchorY = Number.isFinite(mouseUiState.leftoversDetailsAnchorY) ? mouseUiState.leftoversDetailsAnchorY : mouseY;
    const bubbleX = Math.max(8, Math.min(canvas.width - bubbleW - 8, anchorX + 14));
    const bubbleY = Math.max(8, Math.min(canvas.height - bubbleH - 8, anchorY - bubbleH - 12));

    const hoveringSlot = isPointInsideExpandedRect(
      mouseX, mouseY, inspectedSlotX, inspectedSlotY, inspectedSlotW, inspectedSlotH, INVENTORY_DETAILS_HOVER_PADDING
    );
    const hoveringBubble = isPointInsideExpandedRect(
      mouseX, mouseY, bubbleX, bubbleY, bubbleW, bubbleH, INVENTORY_DETAILS_HOVER_PADDING
    );
    if (!hoveringSlot && !hoveringBubble) {
      const nowMs = performance.now();
      const graceUntil = Number.isFinite(mouseUiState.leftoversDetailsCloseGraceUntil)
        ? mouseUiState.leftoversDetailsCloseGraceUntil
        : 0;
      if (graceUntil <= 0) {
        mouseUiState.leftoversDetailsCloseGraceUntil = nowMs + INVENTORY_DETAILS_CLOSE_GRACE_MS;
      } else if (nowMs >= graceUntil) {
        clearLeftoversInspection(mouseUiState);
      }
    } else {
      mouseUiState.leftoversDetailsCloseGraceUntil = 0;
    }

    ctx.fillStyle = "rgba(18, 14, 10, 0.9)";
    ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
    ctx.strokeStyle = "rgba(255, 231, 167, 0.78)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bubbleX + 0.5, bubbleY + 0.5, bubbleW - 1, bubbleH - 1);
    for (let i = 0; i < lines.length; i++) {
      drawUiText(ctx, lines[i], bubbleX + paddingX, bubbleY + 16 + i * lineH, colors);
    }

    const actionText = "Take";
    const actionTextW = Math.ceil(ctx.measureText(actionText).width);
    const buttonW = Math.max(66, actionTextW + 18);
    const buttonX = bubbleX + Math.round((bubbleW - buttonW) / 2);
    const buttonY = bubbleY + textSectionH + actionGapY;
    const hoveringTakeButton = mouseX >= buttonX && mouseX <= buttonX + buttonW && mouseY >= buttonY && mouseY <= buttonY + actionHeight;
    if (mouseUiState.inventoryClickRequest && hoveringTakeButton) {
      transferLootEntry(inspectedLootEntry);
      clearLeftoversInspection(mouseUiState);
      mouseUiState.inventoryClickRequest = false;
    }
    ctx.fillStyle = hoveringTakeButton ? "rgba(255, 227, 160, 0.35)" : "rgba(255, 227, 160, 0.2)";
    ctx.fillRect(buttonX, buttonY, buttonW, actionHeight);
    ctx.strokeStyle = hoveringTakeButton ? "rgba(255, 236, 194, 0.95)" : "rgba(255, 231, 167, 0.72)";
    ctx.strokeRect(buttonX + 0.5, buttonY + 0.5, buttonW - 1, actionHeight - 1);
    drawUiText(ctx, actionText, buttonX + Math.round((buttonW - actionTextW) / 2), buttonY + 14, colors);
    if (hoveringTakeButton) {
      drawUiText(ctx, "Move to inventory", bubbleX + Math.round((bubbleW - 90) / 2), buttonY + actionHeight + 12, colors);
    }
  }

  if (mouseUiState) {
    mouseUiState.inventoryClickRequest = false;
    mouseUiState.inventoryDoubleClickRequest = false;
    mouseUiState.inventoryDragStartRequest = false;
    mouseUiState.inventoryDragReleaseRequest = false;
    mouseUiState.inventoryDragItemName = "";
    mouseUiState.inventoryDragSource = "";
    mouseUiState.inventoryDragSourceSlot = "";
    clearItemInspection(mouseUiState);
  }
  return true;
}

export function drawInventoryOverlay(ctx, state, canvas, ui, colors, getItemSprite) {
  const { gameState, playerInventory, playerEquipment, mouseUiState } = state;
  if (gameState !== GAME_STATES.INVENTORY) return;

  if (drawLeftoversLootOverlay(ctx, state, canvas, colors, getItemSprite)) {
    return;
  }
  clearLeftoversInspection(mouseUiState);

  normalizePlayerEquipment(playerEquipment);
  const playerCurrency = normalizePlayerCurrency(state?.playerCurrency);

  ctx.fillStyle = colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const slotSize = 36;
  const margin = 2;
  const cols = 8;
  const rows = 3;
  const visibleSlots = cols * rows;
  const gridWidth = cols * (slotSize + margin) - margin;
  const gridHeight = rows * (slotSize + margin) - margin;
  const equipmentPanelW = 228;
  const slotBodySize = 46;
  const projectedEquipmentLayout = buildEquipmentLayout(0, 0, slotBodySize);
  const projectedEquipmentPanelH = Math.max(250, Math.round(projectedEquipmentLayout.bottomY + 44));
  const inventoryPanelW = gridWidth + 20;
  const inventoryPanelMaxH = gridHeight + 68;
  const panelGap = 24;

  let sortedItems = [];
  let itemsByName = new Map();
  let totalSlots = visibleSlots;
  let totalPages = 1;
  let currentPage = 0;
  let pageStartIndex = 0;
  let slotOrder = [];
  const refreshInventoryCollections = () => {
    sortedItems = sortInventoryItems(playerInventory);
    itemsByName = new Map(sortedItems.map((item) => [item.name, item]));
    totalSlots = Math.max(visibleSlots, sortedItems.length);
    totalPages = Math.max(1, Math.ceil(totalSlots / visibleSlots));
    currentPage = normalizeInventoryPage(mouseUiState, totalPages);
    pageStartIndex = currentPage * visibleSlots;
    slotOrder = ensureInventorySlotOrder(mouseUiState, sortedItems, totalSlots);
  };
  refreshInventoryCollections();

  const mouseInsideCanvas = Boolean(mouseUiState?.insideCanvas);
  const mouseX = mouseUiState?.x || 0;
  const mouseY = mouseUiState?.y || 0;
  const showPager = totalPages > 1;
  const inventoryPanelH = gridHeight + (showPager ? 68 : 42);
  const equipmentPanelH = projectedEquipmentPanelH;

  const defaultClusterW = inventoryPanelW + panelGap + equipmentPanelW;
  const defaultClusterH = Math.max(inventoryPanelMaxH, equipmentPanelH);
  const defaultInventoryPanelX = Math.round((canvas.width - defaultClusterW) * 0.5);
  const defaultInventoryPanelY = Math.round((canvas.height - defaultClusterH) * 0.5) + 18;
  const defaultEquipmentPanelX = defaultInventoryPanelX + inventoryPanelW + panelGap;
  const defaultEquipmentPanelY = defaultInventoryPanelY + 4;

  const inventoryLayoutState = normalizeInventoryUiLayout(state?.inventoryUiLayout);
  let inventoryPanelX = Number.isFinite(inventoryLayoutState?.inventoryPanelX)
    ? inventoryLayoutState.inventoryPanelX
    : defaultInventoryPanelX;
  let inventoryPanelY = Number.isFinite(inventoryLayoutState?.inventoryPanelY)
    ? inventoryLayoutState.inventoryPanelY
    : defaultInventoryPanelY;
  let equipmentPanelX = Number.isFinite(inventoryLayoutState?.equipmentPanelX)
    ? inventoryLayoutState.equipmentPanelX
    : defaultEquipmentPanelX;
  let equipmentPanelY = Number.isFinite(inventoryLayoutState?.equipmentPanelY)
    ? inventoryLayoutState.equipmentPanelY
    : defaultEquipmentPanelY;

  if (mouseUiState && !mouseUiState.inventoryLeftDown) {
    mouseUiState.inventoryPanelDragTarget = "";
  }

  if (mouseUiState?.inventoryPanelDragTarget && mouseUiState.inventoryLeftDown && mouseInsideCanvas) {
    const target = mouseUiState.inventoryPanelDragTarget;
    if (target === "inventory") {
      inventoryPanelX = mouseX - (mouseUiState.inventoryPanelDragOffsetX || 0);
      inventoryPanelY = mouseY - (mouseUiState.inventoryPanelDragOffsetY || 0);
    } else if (target === "equipment") {
      equipmentPanelX = mouseX - (mouseUiState.inventoryPanelDragOffsetX || 0);
      equipmentPanelY = mouseY - (mouseUiState.inventoryPanelDragOffsetY || 0);
    }
  }

  const clampedInventoryPanel = clampPanelPosition(inventoryPanelX, inventoryPanelY, inventoryPanelW, inventoryPanelH, canvas);
  inventoryPanelX = clampedInventoryPanel.x;
  inventoryPanelY = clampedInventoryPanel.y;
  const clampedEquipmentPanel = clampPanelPosition(equipmentPanelX, equipmentPanelY, equipmentPanelW, equipmentPanelH, canvas);
  equipmentPanelX = clampedEquipmentPanel.x;
  equipmentPanelY = clampedEquipmentPanel.y;

  if (inventoryLayoutState) {
    inventoryLayoutState.inventoryPanelX = inventoryPanelX;
    inventoryLayoutState.inventoryPanelY = inventoryPanelY;
    inventoryLayoutState.equipmentPanelX = equipmentPanelX;
    inventoryLayoutState.equipmentPanelY = equipmentPanelY;
  }

  const gridX = inventoryPanelX + 10;
  const gridY = inventoryPanelY + 14;
  const equipmentLayout = buildEquipmentLayout(equipmentPanelX, equipmentPanelY, slotBodySize);
  let previewDirection = normalizePreviewDirection(mouseUiState);

  ctx.font = FONT_16;
  const titlePadX = 12;
  const titlePlateH = 24;
  const titleText = "Inventory";
  const titlePlateW = Math.ceil(ctx.measureText(titleText).width) + titlePadX * 2;
  const titlePlateX = gridX;
  const titlePlateY = gridY - titlePlateH;

  const equipmentTitleText = "Equipment";
  const equipmentTitlePadX = 12;
  const equipmentTitleH = 24;
  const equipmentTitleW = Math.ceil(ctx.measureText(equipmentTitleText).width) + equipmentTitlePadX * 2;
  const equipmentTitleX = equipmentPanelX + 1;
  const equipmentTitleY = equipmentPanelY - equipmentTitleH + 1;

  const previewRotateButtons = getPreviewRotateButtons(equipmentPanelX, equipmentPanelY, equipmentPanelW, equipmentPanelH);
  const rotateLeftHovered = mouseInsideCanvas && isPointInsideExpandedRect(
    mouseX,
    mouseY,
    previewRotateButtons.left.x,
    previewRotateButtons.left.y,
    previewRotateButtons.left.w,
    previewRotateButtons.left.h,
    0
  );
  const rotateRightHovered = mouseInsideCanvas && isPointInsideExpandedRect(
    mouseX,
    mouseY,
    previewRotateButtons.right.x,
    previewRotateButtons.right.y,
    previewRotateButtons.right.w,
    previewRotateButtons.right.h,
    0
  );
  const pagerButtonW = 24;
  const pagerButtonH = 18;
  const pagerGap = 58;
  const pagerY = gridY + gridHeight + 8;
  const pagerCenterX = gridX + gridWidth * 0.5;
  const pagerLeftRect = {
    x: Math.round(pagerCenterX - pagerGap),
    y: pagerY,
    w: pagerButtonW,
    h: pagerButtonH
  };
  const pagerRightRect = {
    x: Math.round(pagerCenterX + pagerGap - pagerButtonW),
    y: pagerY,
    w: pagerButtonW,
    h: pagerButtonH
  };
  const pagerLeftHovered = showPager && mouseInsideCanvas && isPointInsideExpandedRect(
    mouseX,
    mouseY,
    pagerLeftRect.x,
    pagerLeftRect.y,
    pagerLeftRect.w,
    pagerLeftRect.h,
    0
  );
  const pagerRightHovered = showPager && mouseInsideCanvas && isPointInsideExpandedRect(
    mouseX,
    mouseY,
    pagerRightRect.x,
    pagerRightRect.y,
    pagerRightRect.w,
    pagerRightRect.h,
    0
  );
  const inventoryTabHovered = mouseInsideCanvas && isPointInsideExpandedRect(
    mouseX,
    mouseY,
    titlePlateX,
    titlePlateY,
    titlePlateW,
    titlePlateH,
    0
  );
  const equipmentTabHovered = mouseInsideCanvas && isPointInsideExpandedRect(
    mouseX,
    mouseY,
    equipmentTitleX,
    equipmentTitleY,
    equipmentTitleW,
    equipmentTitleH,
    0
  );

  if (
    mouseUiState?.inventoryDragStartRequest &&
    !mouseUiState.inventoryDragItemName &&
    (inventoryTabHovered || equipmentTabHovered)
  ) {
    mouseUiState.inventoryPanelDragTarget = inventoryTabHovered ? "inventory" : "equipment";
    mouseUiState.inventoryPanelDragOffsetX = inventoryTabHovered
      ? (mouseX - inventoryPanelX)
      : (mouseX - equipmentPanelX);
    mouseUiState.inventoryPanelDragOffsetY = inventoryTabHovered
      ? (mouseY - inventoryPanelY)
      : (mouseY - equipmentPanelY);
    mouseUiState.inventoryDragStartRequest = false;
    mouseUiState.inventoryClickRequest = false;
    clearItemInspection(mouseUiState);
  }

  if (mouseUiState?.inventoryPanelDragTarget) {
    mouseUiState.inventoryClickRequest = false;
    mouseUiState.inventoryDoubleClickRequest = false;
  }

  if (
    mouseUiState?.inventoryClickRequest &&
    !mouseUiState.inventoryDragItemName &&
    (rotateLeftHovered || rotateRightHovered)
  ) {
    previewDirection = rotatePreviewDirection(mouseUiState, rotateLeftHovered ? 1 : -1);
    mouseUiState.inventoryClickRequest = false;
    clearItemInspection(mouseUiState);
  }

  const computeHoverState = (items) => {
    const itemMap = new Map(items.map((item) => [item.name, item]));
    const gridHit = mouseInsideCanvas
      ? getGridHitTest(mouseX, mouseY, gridX, gridY, slotSize, margin, cols, rows)
      : { isOverGridSlot: false, slotIndex: -1 };
    const hoveredGridSlotLocalIndex = gridHit.isOverGridSlot ? gridHit.slotIndex : -1;
    const hoveredGridSlotIndex = hoveredGridSlotLocalIndex >= 0
      ? pageStartIndex + hoveredGridSlotLocalIndex
      : -1;
    const hoveredItemName = hoveredGridSlotIndex >= 0 ? slotOrder[hoveredGridSlotIndex] : "";
    const hoveredItem = hoveredItemName ? (itemMap.get(hoveredItemName) || null) : null;
    const hoveredItemIndex = hoveredItem ? hoveredGridSlotIndex : -1;
    const hoveredEquipmentSlotId = mouseInsideCanvas ? findHoveredEquipmentSlot(mouseX, mouseY, equipmentLayout) : "";
    const hoveredEquipmentItem = hoveredEquipmentSlotId ? playerEquipment?.[hoveredEquipmentSlotId] || null : null;
    return {
      hoveredGridSlotLocalIndex,
      hoveredGridSlotIndex,
      hoveredItemIndex,
      hoveredItem,
      hoveredEquipmentSlotId,
      hoveredEquipmentItem,
      isOverGridSlot: Boolean(gridHit.isOverGridSlot)
    };
  };

  let hover = computeHoverState(sortedItems);

  if (
    mouseUiState?.inventoryClickRequest &&
    !mouseUiState.inventoryDragItemName &&
    showPager &&
    (pagerLeftHovered || pagerRightHovered)
  ) {
    const delta = pagerLeftHovered ? -1 : 1;
    currentPage = normalizeInventoryPage(mouseUiState, totalPages);
    mouseUiState.inventoryPage = currentPage + delta;
    currentPage = normalizeInventoryPage(mouseUiState, totalPages);
    pageStartIndex = currentPage * visibleSlots;
    mouseUiState.inventoryClickRequest = false;
    clearItemInspection(mouseUiState);
    hover = computeHoverState(sortedItems);
  }

  if (mouseUiState?.inventoryDoubleClickRequest) {
    let handledDoubleClick = false;
    const draggingName = mouseUiState.inventoryDragItemName || "";
    const draggingSource = mouseUiState.inventoryDragSource || "";
    const draggingSourceSlot = mouseUiState.inventoryDragSourceSlot || "";

    if (draggingName && draggingSource === "equipment") {
      const slotId = draggingSourceSlot;
      const blockedByHeadbandLock = isDojoUpstairsHeadbandLock(state, slotId, draggingName);
      if (!blockedByHeadbandLock) {
        addItemToInventory(playerInventory, draggingName, 1);
        handledDoubleClick = true;
      } else if (slotId && playerEquipment && playerEquipment[slotId] == null) {
        playerEquipment[slotId] = draggingName;
      }
    } else {
      const itemToEquip = (
        draggingName && draggingSource === "inventoryGrid"
          ? getItemInfo(draggingName, Number(playerInventory[draggingName] || 1))
          : (hover.hoveredItem || null)
      );
      if (hover.hoveredEquipmentSlotId && hover.hoveredEquipmentItem) {
        const slotId = hover.hoveredEquipmentSlotId;
        const equippedName = playerEquipment?.[slotId] || null;
        const equippedInfo = equippedName ? getItemInfo(equippedName, 1) : null;
        if (equippedName && equippedInfo?.equipSlot) {
          const blockedByHeadbandLock = isDojoUpstairsHeadbandLock(state, slotId, equippedName);
          if (!blockedByHeadbandLock) {
            playerEquipment[slotId] = null;
            addItemToInventory(playerInventory, equippedName, 1);
            handledDoubleClick = true;
          }
        }
      } else if (itemToEquip) {
        const slotId = itemToEquip.equipSlot;
        const supportsEquipSlot = EQUIPMENT_SLOT_ORDER.some((slot) => slot.id === slotId);
        if (slotId && supportsEquipSlot) {
          const existingItem = playerEquipment[slotId];
          const blockedByHeadbandLock = (
            isDojoUpstairsHeadbandLock(state, slotId, existingItem) &&
            itemToEquip.name !== "Training Headband"
          );
          if (!blockedByHeadbandLock && removeItemFromInventory(playerInventory, itemToEquip.name, 1)) {
            playerEquipment[slotId] = itemToEquip.name;
            if (existingItem) addItemToInventory(playerInventory, existingItem, 1);
            handledDoubleClick = true;
          }
        }
      }
    }

    if (
      draggingName &&
      draggingSource === "equipment" &&
      !handledDoubleClick &&
      draggingSourceSlot &&
      playerEquipment &&
      playerEquipment[draggingSourceSlot] == null
    ) {
      playerEquipment[draggingSourceSlot] = draggingName;
    }

    mouseUiState.inventoryDragItemName = "";
    mouseUiState.inventoryDragSource = "";
    mouseUiState.inventoryDragSourceSlot = "";
    mouseUiState.inventoryDoubleClickRequest = false;
    mouseUiState.inventoryClickRequest = false;
    mouseUiState.inventoryDragStartRequest = false;
    mouseUiState.inventoryDragReleaseRequest = false;
    if (handledDoubleClick) {
      clearItemInspection(mouseUiState);
    }
    refreshInventoryCollections();
    hover = computeHoverState(sortedItems);
  }

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

  if (mouseUiState?.inventoryDragStartRequest && !mouseUiState?.inventoryPanelDragTarget) {
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
        refreshInventoryCollections();
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
    refreshInventoryCollections();
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
            refreshInventoryCollections();
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
    refreshInventoryCollections();
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

  ctx.font = FONT_16;
  ctx.fillStyle = colors.INVENTORY_SLOT_BG;
  ctx.fillRect(titlePlateX, titlePlateY, titlePlateW, titlePlateH);
  ctx.strokeStyle = inventoryTabHovered ? "rgba(255, 236, 194, 0.95)" : colors.INVENTORY_SLOT_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(titlePlateX + 0.5, titlePlateY + 0.5, titlePlateW - 1, titlePlateH - 1);
  ctx.strokeStyle = "rgba(255, 242, 214, 0.22)";
  ctx.strokeRect(titlePlateX + 2.5, titlePlateY + 2.5, titlePlateW - 5, titlePlateH - 5);
  drawUiText(ctx, titleText, titlePlateX + titlePadX, titlePlateY + 17, colors);

  for (let i = 0; i < visibleSlots; i++) {
    const globalIndex = pageStartIndex + i;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (slotSize + margin);
    const y = gridY + row * (slotSize + margin);

    ctx.fillStyle = colors.INVENTORY_SLOT_BG;
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = colors.INVENTORY_SLOT_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, slotSize, slotSize);

    const itemNameAtSlot = slotOrder[globalIndex];
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

    if (globalIndex === hover.hoveredItemIndex) {
      ctx.fillStyle = "rgba(255, 236, 194, 0.16)";
      ctx.fillRect(x, y, slotSize, slotSize);
      ctx.strokeStyle = "rgba(255, 231, 167, 0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, slotSize - 2, slotSize - 2);
    }
  }

  if (showPager) {
    const pageText = `${currentPage + 1}/${totalPages}`;
    ctx.font = FONT_12;
    const pageTextW = Math.ceil(ctx.measureText(pageText).width);
    const pagerBarW = 154;
    const pagerBarH = 22;
    const pagerBarX = Math.round(pagerCenterX - pagerBarW * 0.5);
    const pagerBarY = pagerY - 2;
    const pagerBarGradient = ctx.createLinearGradient(pagerBarX, pagerBarY, pagerBarX, pagerBarY + pagerBarH);
    pagerBarGradient.addColorStop(0, "rgba(40, 33, 22, 0.76)");
    pagerBarGradient.addColorStop(1, "rgba(25, 20, 13, 0.84)");
    ctx.fillStyle = pagerBarGradient;
    ctx.fillRect(pagerBarX, pagerBarY, pagerBarW, pagerBarH);
    ctx.strokeStyle = "rgba(232, 208, 154, 0.62)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pagerBarX + 0.5, pagerBarY + 0.5, pagerBarW - 1, pagerBarH - 1);
    ctx.fillStyle = "rgba(236, 214, 168, 0.7)";
    ctx.fillRect(pagerBarX + 4, pagerBarY + 4, 2, 2);
    ctx.fillRect(pagerBarX + pagerBarW - 6, pagerBarY + 4, 2, 2);
    ctx.fillRect(pagerBarX + 4, pagerBarY + pagerBarH - 6, 2, 2);
    ctx.fillRect(pagerBarX + pagerBarW - 6, pagerBarY + pagerBarH - 6, 2, 2);
    drawUiText(ctx, pageText, Math.round(pagerCenterX - pageTextW * 0.5), pagerBarY + 15, colors);

    const drawPagerButton = (rect, text, hovered, disabled) => {
      const buttonGradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      if (disabled) {
        buttonGradient.addColorStop(0, "rgba(94, 80, 54, 0.32)");
        buttonGradient.addColorStop(1, "rgba(58, 48, 32, 0.38)");
      } else if (hovered) {
        buttonGradient.addColorStop(0, "rgba(255, 236, 194, 0.34)");
        buttonGradient.addColorStop(1, "rgba(184, 141, 78, 0.42)");
      } else {
        buttonGradient.addColorStop(0, "rgba(255, 235, 186, 0.2)");
        buttonGradient.addColorStop(1, "rgba(128, 99, 56, 0.28)");
      }
      ctx.fillStyle = buttonGradient;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = disabled
        ? "rgba(255, 231, 167, 0.2)"
        : (hovered ? "rgba(255, 236, 194, 0.95)" : "rgba(255, 231, 167, 0.72)");
      ctx.lineWidth = 1;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.strokeStyle = "rgba(67, 50, 28, 0.72)";
      ctx.strokeRect(rect.x + 2.5, rect.y + 2.5, rect.w - 5, rect.h - 5);
      const textW = Math.ceil(ctx.measureText(text).width);
      drawUiText(
        ctx,
        text,
        Math.round(rect.x + (rect.w - textW) / 2),
        rect.y + 13,
        disabled
          ? { ...colors, TEXT: "rgba(255, 235, 186, 0.42)", TEXT_SHADOW: "rgba(8, 6, 4, 0.55)" }
          : colors
      );
    };
    drawPagerButton(pagerLeftRect, "<", pagerLeftHovered, currentPage <= 0);
    drawPagerButton(pagerRightRect, ">", pagerRightHovered, currentPage >= totalPages - 1);
  }

  const coinRowY = showPager ? (pagerY + 24) : (gridY + gridHeight + 14);
  const coinIconR = 6;
  const goldX = gridX + 8;
  const silverX = goldX + 66;
  const coinTextY = coinRowY + 4;
  ctx.font = FONT_12;

  ctx.fillStyle = "rgba(241, 208, 116, 0.98)";
  ctx.beginPath();
  ctx.arc(goldX, coinRowY, coinIconR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(126, 90, 26, 0.95)";
  ctx.lineWidth = 1;
  ctx.stroke();
  drawUiText(ctx, String(playerCurrency.gold), goldX + 12, coinTextY, colors);

  ctx.fillStyle = "rgba(188, 196, 204, 0.95)";
  ctx.beginPath();
  ctx.arc(silverX, coinRowY, coinIconR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(74, 82, 90, 0.95)";
  ctx.lineWidth = 1;
  ctx.stroke();
  drawUiText(ctx, String(playerCurrency.silver), silverX + 12, coinTextY, colors);

  ctx.fillStyle = "rgba(58, 52, 42, 0.42)";
  ctx.fillRect(equipmentPanelX, equipmentPanelY, equipmentPanelW, equipmentPanelH);
  ctx.strokeStyle = "rgba(255, 231, 167, 0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(equipmentPanelX + 0.5, equipmentPanelY + 0.5, equipmentPanelW - 1, equipmentPanelH - 1);

  ctx.font = FONT_16;
  ctx.fillStyle = colors.INVENTORY_SLOT_BG;
  ctx.fillRect(equipmentTitleX, equipmentTitleY, equipmentTitleW, equipmentTitleH);
  ctx.strokeStyle = equipmentTabHovered ? "rgba(255, 236, 194, 0.95)" : colors.INVENTORY_SLOT_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(equipmentTitleX + 0.5, equipmentTitleY + 0.5, equipmentTitleW - 1, equipmentTitleH - 1);
  ctx.strokeStyle = "rgba(255, 242, 214, 0.22)";
  ctx.strokeRect(equipmentTitleX + 2.5, equipmentTitleY + 2.5, equipmentTitleW - 5, equipmentTitleH - 5);
  drawUiText(ctx, equipmentTitleText, equipmentTitleX + equipmentTitlePadX, equipmentTitleY + 17, colors);
  drawEquipmentPreview(
    ctx,
    state,
    equipmentPanelX,
    equipmentPanelY,
    equipmentPanelW,
    equipmentPanelH,
    equipmentLayout,
    getItemSprite,
    previewDirection
  );
  drawPreviewRotateButton(ctx, previewRotateButtons.left, "left", rotateLeftHovered);
  drawPreviewRotateButton(ctx, previewRotateButtons.right, "right", rotateRightHovered);

  ctx.font = FONT_12;
  const facingText = `View: ${formatFacingLabel(previewDirection)}`;
  const facingTextW = Math.ceil(ctx.measureText(facingText).width);
  const facingBadgeW = facingTextW + 16;
  const facingBadgeH = 18;
  const facingBadgeX = Math.round(equipmentLayout.centerX - facingBadgeW / 2);
  const facingBadgeY = Math.min(
    equipmentPanelY + equipmentPanelH - facingBadgeH - 4,
    previewRotateButtons.left.y + 4
  );
  ctx.fillStyle = "rgba(16, 22, 28, 0.84)";
  ctx.fillRect(facingBadgeX, facingBadgeY, facingBadgeW, facingBadgeH);
  ctx.strokeStyle = "rgba(142, 204, 234, 0.86)";
  ctx.lineWidth = 1;
  ctx.strokeRect(facingBadgeX + 0.5, facingBadgeY + 0.5, facingBadgeW - 1, facingBadgeH - 1);
  drawUiText(
    ctx,
    facingText,
    facingBadgeX + 8,
    facingBadgeY + 13,
    {
      ...colors,
      TEXT: "#dff3ff",
      TEXT_SHADOW: "rgba(6, 11, 16, 0.8)"
    }
  );

  if ((rotateLeftHovered || rotateRightHovered) && !mouseUiState?.inventoryDragItemName) {
    const tooltipText = rotateLeftHovered ? "Rotate Left" : "Rotate Right";
    const tooltipW = Math.ceil(ctx.measureText(tooltipText).width) + 14;
    const tooltipH = 18;
    const anchorRect = rotateLeftHovered ? previewRotateButtons.left : previewRotateButtons.right;
    const tooltipX = Math.round(
      Math.max(
        equipmentPanelX + 6,
        Math.min(
          equipmentPanelX + equipmentPanelW - tooltipW - 6,
          anchorRect.x + anchorRect.w * 0.5 - tooltipW * 0.5
        )
      )
    );
    const tooltipY = Math.round(anchorRect.y - tooltipH - 4);
    ctx.fillStyle = "rgba(18, 14, 10, 0.88)";
    ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
    ctx.strokeStyle = "rgba(255, 231, 167, 0.72)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tooltipX + 0.5, tooltipY + 0.5, tooltipW - 1, tooltipH - 1);
    drawUiText(ctx, tooltipText, tooltipX + 7, tooltipY + 13, colors);
  }

  for (const slot of EQUIPMENT_SLOT_ORDER) {
    const rect = equipmentLayout.slots[slot.id];
    const equippedItemName = playerEquipment?.[slot.id] || null;
    const isHovered = slot.id === hover.hoveredEquipmentSlotId;
    const dragItem = mouseUiState?.inventoryDragItemName || "";
    const canDropHere = dragItem ? canEquipItemInSlot(dragItem, slot.id) : false;
    drawEquipmentSlotShell(
      ctx,
      rect,
      {
        isHovered,
        canDropHere,
        hasItem: Boolean(equippedItemName)
      }
    );

    if (equippedItemName) {
      drawItemInSlot(ctx, equippedItemName, rect.x, rect.y, rect.w, colors, getItemSprite);
    } else {
      ctx.font = FONT_12;
      drawSlotLabelInside(ctx, slot.label, rect.x, rect.y, rect.w, rect.h, colors);
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
      const inspectedLocalIndex = inspectedIndex - pageStartIndex;
      if (inspectedLocalIndex < 0 || inspectedLocalIndex >= visibleSlots) {
        clearItemInspection(mouseUiState);
        return;
      }
      const inspectedCol = inspectedLocalIndex % cols;
      const inspectedRow = Math.floor(inspectedLocalIndex / cols);
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
            refreshInventoryCollections();
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
            refreshInventoryCollections();
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
