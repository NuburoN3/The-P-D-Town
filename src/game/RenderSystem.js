import { AREA_KINDS, GAME_STATES } from "../core/constants.js";

function drawPlayer(ctx, state, getHandstandSprite, tileSize, spriteFrameWidth, spriteFrameHeight, spriteFramesPerRow) {
  const { player, cam } = state;
  if (!player.sprite || !player.sprite.width || !player.sprite.height) return;

  const targetHeight = tileSize * player.desiredHeightTiles;
  const scale = targetHeight / spriteFrameHeight;
  const drawWidth = spriteFrameWidth * scale;
  const drawHeight = spriteFrameHeight * scale;
  const drawX = Math.round(player.x - cam.x - (drawWidth - tileSize) / 2);
  const drawY = Math.round(player.y - cam.y - (drawHeight - tileSize));

  if (player.isTraining) {
    const handSprite = getHandstandSprite() || player.sprite;
    const frame = player.handstandFrame || 0;
    const sx = frame * spriteFrameWidth;
    const sy = 0;
    ctx.drawImage(
      handSprite,
      sx,
      sy,
      spriteFrameWidth,
      spriteFrameHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
    return;
  }

  const directionToRow = {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  };
  const row = directionToRow[player.dir] ?? 0;
  const frame = player.walking ? player.animFrame : 1;
  const sx = frame * spriteFrameWidth;
  const sy = row * spriteFrameHeight;

  ctx.drawImage(
    player.sprite,
    sx,
    sy,
    spriteFrameWidth,
    spriteFrameHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
}

function drawNPCSprite(ctx, npc, drawX, drawY, drawWidth, drawHeight, colors) {
  ctx.save();
  if (npc.dir === "left") {
    ctx.translate(drawX + drawWidth / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(drawX + drawWidth / 2), 0);
  }
  ctx.drawImage(npc.sprite, drawX, drawY, drawWidth, drawHeight);
  if (npc.dir === "up") {
    ctx.fillStyle = colors.SHADOW;
    ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
  }
  ctx.restore();
}

function drawNPCPlaceholder(ctx, nx, ny, colors) {
  ctx.fillStyle = colors.NPC_BODY;
  ctx.fillRect(nx + 6, ny + 8, 20, 20);
  ctx.fillStyle = colors.NPC_FACE;
  ctx.fillRect(nx + 10, ny + 4, 12, 8);
  ctx.fillStyle = colors.NPC_LEGS;
  ctx.fillRect(nx + 10, ny + 26, 6, 6);
  ctx.fillRect(nx + 16, ny + 26, 6, 6);
}

function drawNPCs(ctx, state, canvas, tileSize, colors) {
  const { currentAreaId, currentAreaKind, npcs, cam } = state;
  if (currentAreaKind === AREA_KINDS.OVERWORLD) return;

  for (const npc of npcs) {
    if (npc.world !== currentAreaId) continue;

    const nx = npc.x - cam.x;
    const ny = npc.y - cam.y;

    if (nx > -npc.width && ny > -npc.height && nx < canvas.width && ny < canvas.height) {
      if (npc.sprite && npc.sprite.width && npc.sprite.height) {
        let drawWidth;
        let drawHeight;
        let drawX;
        let drawY;

        if (npc.desiredHeightTiles) {
          const targetHeight = tileSize * npc.desiredHeightTiles;
          const scale = targetHeight / npc.sprite.height;
          drawWidth = npc.sprite.width * scale;
          drawHeight = npc.sprite.height * scale;
          drawX = Math.round(npc.x - cam.x - (drawWidth - tileSize) / 2);
          drawY = Math.round(npc.y - cam.y - (drawHeight - tileSize));
        } else {
          drawWidth = npc.spriteWidth || tileSize;
          drawHeight = npc.spriteHeight || tileSize;
          drawX = Math.round(npc.x - cam.x - (drawWidth - tileSize) / 2);
          drawY = Math.round(npc.y - cam.y - (drawHeight - tileSize));
        }

        drawNPCSprite(ctx, npc, drawX, drawY, drawWidth, drawHeight, colors);
      } else {
        drawNPCPlaceholder(ctx, nx, ny, colors);
      }
    }
  }
}

function drawTrainingPopup(ctx, state, canvas, ui, colors, tileSize) {
  const { trainingPopup, player, cam, playerStats } = state;
  if (!trainingPopup.active) return;

  const elapsed = performance.now() - trainingPopup.startedAt;
  const fadeRatio = Math.max(0, 1 - elapsed / trainingPopup.durationMs);
  if (fadeRatio <= 0) return;

  const px = player.x - cam.x + tileSize / 2;
  const py = player.y - cam.y;

  const boxW = ui.TRAINING_POPUP_WIDTH;
  const boxH = ui.TRAINING_POPUP_HEIGHT;
  let boxX = Math.round(px - boxW / 2);
  let boxY = Math.round(py - 58);

  if (boxY < 0) {
    boxY = Math.round(py + tileSize + 10);
  }

  boxX = Math.max(0, Math.min(boxX, canvas.width - boxW));
  boxY = Math.max(0, boxY);

  let progressRatio;
  if (trainingPopup.levelUp) {
    const fillProgress = Math.min(1, elapsed / trainingPopup.animDurationMs);
    const holdEnd = trainingPopup.animDurationMs + trainingPopup.levelUpHoldMs;
    progressRatio = elapsed < trainingPopup.animDurationMs ? fillProgress : elapsed < holdEnd ? 1 : 0;
  } else {
    const animationProgress = Math.min(1, elapsed / trainingPopup.animDurationMs);
    const displayXP = trainingPopup.startXP + (trainingPopup.targetXP - trainingPopup.startXP) * animationProgress;
    progressRatio = Math.min(1, displayXP / trainingPopup.xpNeededSnapshot);
  }

  ctx.save();
  ctx.globalAlpha = fadeRatio;

  ctx.fillStyle = colors.POPUP_BG;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.strokeStyle = colors.POPUP_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = colors.TEXT;
  ctx.font = "12px monospace";
  ctx.fillText(`Lv. ${playerStats.disciplineLevel}`, boxX + 8, boxY + 13);
  ctx.fillText(`+${trainingPopup.xpGained} XP`, boxX + 78, boxY + 13);

  const barX = boxX + 8;
  const barY = boxY + 21;
  const barW = boxW - 16;
  const barH = 14;

  ctx.fillStyle = colors.POPUP_BAR_BG;
  ctx.fillRect(barX, barY, barW, barH);

  ctx.fillStyle = colors.POPUP_BAR_FILL;
  ctx.fillRect(barX, barY, Math.round(barW * progressRatio), barH);

  ctx.restore();
}

function drawTextbox(ctx, state, canvas, ui, colors, dialogue) {
  if (!dialogue.isActive() || state.gameState === GAME_STATES.INVENTORY) return;

  const boxHeight = ui.TEXT_BOX_HEIGHT;
  const boxY = canvas.height - boxHeight - 20;

  ctx.fillStyle = colors.DIALOGUE_BG;
  ctx.fillRect(20, boxY, canvas.width - 40, boxHeight);

  ctx.strokeStyle = colors.DIALOGUE_BORDER;
  ctx.lineWidth = 3;
  ctx.strokeRect(20, boxY, canvas.width - 40, boxHeight);

  ctx.fillStyle = colors.TEXT;
  ctx.font = "20px monospace";

  const textStartX = 40;
  const lineSpacing = ui.LINE_SPACING;
  dialogue.updateVisibleCharacters();

  const fullPageLines = dialogue.currentLine().split("\n");
  const wrappedLines = [];
  let remainingCharacters = dialogue.visibleCharacters;

  for (const line of fullPageLines) {
    if (remainingCharacters <= 0) break;
    const visibleInLine = Math.min(line.length, remainingCharacters);
    wrappedLines.push(line.slice(0, visibleInLine));
    remainingCharacters -= visibleInLine;
    if (visibleInLine < line.length) break;
  }

  const textHeight = wrappedLines.length * lineSpacing;
  const textStartY = boxY + (boxHeight - textHeight) / 2 + lineSpacing - 6;

  if (dialogue.name) {
    ctx.fillText(dialogue.name, 40, boxY + 28);
  }

  for (let i = 0; i < wrappedLines.length; i++) {
    ctx.fillText(wrappedLines[i], textStartX, textStartY + i * lineSpacing);
  }

  if (dialogue.choiceState.active) {
    const optPadding = 10;
    ctx.font = "20px monospace";
    let maxW = 0;
    for (const opt of dialogue.choiceState.options) {
      maxW = Math.max(maxW, ctx.measureText(opt).width);
    }

    const optionsW = Math.max(120, maxW + 40);
    const optionsH = dialogue.choiceState.options.length * ui.LINE_SPACING + optPadding * 2;
    const optionsX = 40;
    const optionsY = boxY - optionsH - 12;

    ctx.fillStyle = colors.POPUP_BG;
    ctx.fillRect(optionsX, optionsY, optionsW, optionsH);
    ctx.strokeStyle = colors.DIALOGUE_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(optionsX, optionsY, optionsW, optionsH);

    for (let i = 0; i < dialogue.choiceState.options.length; i++) {
      const optY = optionsY + optPadding + (i + 0.8) * ui.LINE_SPACING;
      const textX = optionsX + 20;
      if (i === dialogue.choiceState.selected) {
        ctx.beginPath();
        ctx.moveTo(textX - 12 + 8, optY - 6);
        ctx.lineTo(textX - 12, optY - 10);
        ctx.lineTo(textX - 12, optY - 2);
        ctx.closePath();
        ctx.fillStyle = colors.TEXT;
        ctx.fill();
      }
      ctx.fillStyle = colors.TEXT;
      ctx.fillText(dialogue.choiceState.options[i], textX, optY);
    }
  }

  const pageComplete = dialogue.visibleCharacters >= dialogue.currentVisibleLength();
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (pageComplete && !dialogue.choiceState.active && blink) {
    const bobOffsetY = Math.sin(performance.now() * 0.008) * 3;
    const indicatorY = boxY + boxHeight - 12 + bobOffsetY;
    const indicatorX = canvas.width - 28;
    ctx.beginPath();
    ctx.moveTo(indicatorX + 8, indicatorY);
    ctx.lineTo(indicatorX, indicatorY - 6);
    ctx.lineTo(indicatorX, indicatorY + 6);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDoorTransition(ctx, state, canvas, tileSize) {
  const { gameState, player, cam, doorSequence } = state;
  if (gameState !== GAME_STATES.TRANSITION) return;

  const px = player.x - cam.x + tileSize / 2;
  const py = player.y - cam.y + tileSize / 2;

  ctx.save();
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(px, py, doorSequence.fadeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawInventoryOverlay(ctx, state, canvas, ui, colors) {
  const { gameState, playerInventory, playerStats } = state;
  if (gameState !== GAME_STATES.INVENTORY) return;

  ctx.fillStyle = colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = ui.INVENTORY_BOX_WIDTH;
  const boxH = ui.INVENTORY_BOX_HEIGHT;
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  ctx.fillStyle = colors.INVENTORY_BG;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.strokeStyle = colors.DIALOGUE_BORDER;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = colors.TEXT;
  ctx.font = "28px monospace";
  ctx.fillText("Inventory", boxX + 24, boxY + 42);

  const entries = Object.entries(playerInventory);
  ctx.font = "20px monospace";

  let row = 0;
  if (entries.length === 0) {
    ctx.fillText("(No items)", boxX + 24, boxY + 90);
    row = 1;
  } else {
    for (const [itemName, quantity] of entries) {
      ctx.fillText(`${itemName} x${quantity}`, boxX + 24, boxY + 90 + row * 28);
      row++;
    }
  }

  const statsY = boxY + 90 + row * 28 + 18;
  ctx.font = "22px monospace";
  ctx.fillText("Stats", boxX + 24, statsY);

  ctx.font = "20px monospace";
  const levelY = statsY + 30;
  ctx.fillText(`Discipline Lv. ${playerStats.disciplineLevel}`, boxX + 24, levelY);

  const barX = boxX + 24;
  const barY = levelY + 18;
  const barW = boxW - 48;
  const barH = 20;
  const progressRatio = Math.min(1, playerStats.disciplineXP / playerStats.disciplineXPNeeded);

  ctx.fillStyle = colors.POPUP_BAR_BG;
  ctx.fillRect(barX, barY, barW, barH);

  ctx.fillStyle = colors.INVENTORY_BAR_FILL;
  ctx.fillRect(barX, barY, barW * progressRatio, barH);

  ctx.strokeStyle = colors.DIALOGUE_BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = colors.TEXT;
  ctx.font = "16px monospace";
  const progressText = `${playerStats.disciplineXP} / ${playerStats.disciplineXPNeeded}`;
  const textWidth = ctx.measureText(progressText).width;
  ctx.fillText(progressText, barX + (barW - textWidth) / 2, barY + 15);
}

function drawItemNotifications(ctx, state, cameraZoom, tileSize, colors) {
  const { itemAlert, inventoryHint, player, cam } = state;

  if (itemAlert.active) {
    const elapsed = performance.now() - itemAlert.startedAt;
    const alpha = 1 - Math.max(0, (elapsed - (itemAlert.durationMs - 400)) / 400);

    const screenX = (player.x - cam.x) * cameraZoom + (tileSize * cameraZoom) / 2;
    const screenY = (player.y - cam.y) * cameraZoom - 18;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "18px monospace";

    const padding = 8;
    const text = itemAlert.text;
    const textW = ctx.measureText(text).width;
    const boxW = Math.max(120, textW + padding * 2);
    const boxH = 28;
    const boxX = Math.round(screenX - boxW / 2);
    const boxY = Math.round(screenY - boxH);

    ctx.fillStyle = colors.POPUP_BG;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = colors.POPUP_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = colors.TEXT;
    ctx.fillText(text, boxX + padding, boxY + 19);
    ctx.restore();
  }

  if (inventoryHint.active) {
    const elapsed = performance.now() - inventoryHint.startedAt;
    const alpha = 1 - Math.max(0, (elapsed - (inventoryHint.durationMs - 600)) / 600);

    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    ctx.font = "16px monospace";

    const hintText = "New item received - press I to view your inventory";
    const padding = 8;
    const textW = ctx.measureText(hintText).width;
    const boxW = textW + padding * 2;
    const boxH = 28;
    const boxX = 12;
    const boxY = 12;

    ctx.fillStyle = colors.POPUP_BG;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = colors.POPUP_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = colors.TEXT;
    ctx.fillText(hintText, boxX + padding, boxY + 19);
    ctx.restore();
  }
}

export function renderGameFrame({
  ctx,
  canvas,
  cameraZoom,
  tileSize,
  spriteFrameWidth,
  spriteFrameHeight,
  spriteFramesPerRow,
  colors,
  ui,
  drawTile,
  getHandstandSprite,
  state,
  dialogue
}) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(cameraZoom, cameraZoom);
  const visibleW = canvas.width / cameraZoom;
  const visibleH = canvas.height / cameraZoom;

  const startX = Math.max(0, Math.floor(state.cam.x / tileSize) - 1);
  const endX = Math.min(state.currentMapW - 1, Math.ceil((state.cam.x + visibleW) / tileSize) + 1);
  const startY = Math.max(0, Math.floor(state.cam.y / tileSize) - 1);
  const endY = Math.min(state.currentMapH - 1, Math.ceil((state.cam.y + visibleH) / tileSize) + 1);

  for (let y = startY; y <= endY; y++) {
    const row = state.currentMap[y];
    if (!row) continue;
    for (let x = startX; x <= endX; x++) {
      const tileType = row[x];
      if (typeof tileType !== "number") continue;
      const drawX = x * tileSize - state.cam.x;
      const drawY = y * tileSize - state.cam.y;
      drawTile(tileType, drawX, drawY, x, y);
    }
  }

  drawNPCs(ctx, state, canvas, tileSize, colors);
  drawPlayer(ctx, state, getHandstandSprite, tileSize, spriteFrameWidth, spriteFrameHeight, spriteFramesPerRow);
  drawTrainingPopup(ctx, state, canvas, ui, colors, tileSize);
  drawDoorTransition(ctx, state, canvas, tileSize);
  ctx.restore();

  drawItemNotifications(ctx, state, cameraZoom, tileSize, colors);
  drawInventoryOverlay(ctx, state, canvas, ui, colors);
  drawTextbox(ctx, state, canvas, ui, colors, dialogue);
}
