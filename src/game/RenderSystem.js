import { AREA_KINDS, GAME_STATES } from "../core/constants.js";

const FONT_12 = "600 12px 'Trebuchet MS', 'Verdana', sans-serif";
const FONT_16 = "600 16px 'Trebuchet MS', 'Verdana', sans-serif";
const FONT_20 = "600 20px 'Trebuchet MS', 'Verdana', sans-serif";
const FONT_22 = "600 22px 'Trebuchet MS', 'Verdana', sans-serif";
const FONT_28 = "700 28px 'Trebuchet MS', 'Verdana', sans-serif";

function drawEntityShadow(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(
    Math.round(x + width / 2),
    Math.round(y + height - 3),
    Math.max(5, Math.round(width * 0.24)),
    Math.max(2, Math.round(height * 0.11)),
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawSkinnedPanel(ctx, x, y, width, height, colors, { titleBand = false } = {}) {
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, colors.PANEL_SURFACE_TOP || colors.POPUP_BG);
  gradient.addColorStop(1, colors.PANEL_SURFACE_BOTTOM || colors.DIALOGUE_BG);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = colors.PANEL_INNER || "rgba(255,255,255,0.04)";
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);

  if (titleBand) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + 2, y + 2, width - 4, 28);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + 2, y + 29, width - 4, 1);
  }

  ctx.strokeStyle = colors.PANEL_BORDER_DARK || colors.DIALOGUE_BORDER;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);

  ctx.strokeStyle = colors.PANEL_BORDER_LIGHT || "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4.5, y + 4.5, width - 9, height - 9);
}

function drawUiText(ctx, text, x, y, colors) {
  ctx.fillStyle = colors.TEXT_SHADOW || "rgba(0,0,0,0.4)";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = colors.TEXT;
  ctx.fillText(text, x, y);
}

function drawPlayer(ctx, state, getHandstandSprite, tileSize, spriteFrameWidth, spriteFrameHeight, spriteFramesPerRow) {
  const { player, cam } = state;
  if (!player.sprite || !player.sprite.width || !player.sprite.height) return;

  const targetHeight = tileSize * player.desiredHeightTiles;
  const scale = targetHeight / spriteFrameHeight;
  const drawWidth = spriteFrameWidth * scale;
  const drawHeight = spriteFrameHeight * scale;
  const drawX = Math.round(player.x - cam.x - (drawWidth - tileSize) / 2);
  const drawY = Math.round(player.y - cam.y - (drawHeight - tileSize));

  drawEntityShadow(ctx, drawX, drawY, drawWidth, drawHeight, "rgba(0,0,0,0.22)");

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

        drawEntityShadow(ctx, drawX, drawY, drawWidth, drawHeight, colors.GROUND_SHADOW);
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

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors);

  ctx.font = FONT_12;
  drawUiText(ctx, `Lv. ${playerStats.disciplineLevel}`, boxX + 8, boxY + 13, colors);
  drawUiText(ctx, `+${trainingPopup.xpGained} XP`, boxX + 78, boxY + 13, colors);

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

  const boxX = 20;
  const boxW = canvas.width - 40;
  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxHeight, colors, { titleBand: true });

  ctx.font = FONT_20;

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
    drawUiText(ctx, dialogue.name, 40, boxY + 28, colors);
  }

  for (let i = 0; i < wrappedLines.length; i++) {
    drawUiText(ctx, wrappedLines[i], textStartX, textStartY + i * lineSpacing, colors);
  }

  if (dialogue.choiceState.active) {
    const optPadding = 10;
    ctx.font = FONT_20;
    let maxW = 0;
    for (const opt of dialogue.choiceState.options) {
      maxW = Math.max(maxW, ctx.measureText(opt).width);
    }

    const optionsW = Math.max(120, maxW + 40);
    const optionsH = dialogue.choiceState.options.length * ui.LINE_SPACING + optPadding * 2;
    const optionsX = 40;
    const optionsY = boxY - optionsH - 12;

    drawSkinnedPanel(ctx, optionsX, optionsY, optionsW, optionsH, colors);

    for (let i = 0; i < dialogue.choiceState.options.length; i++) {
      const optY = optionsY + optPadding + (i + 0.8) * ui.LINE_SPACING;
      const textX = optionsX + 20;
      if (i === dialogue.choiceState.selected) {
        ctx.beginPath();
        ctx.moveTo(textX - 12 + 8, optY - 6);
        ctx.lineTo(textX - 12, optY - 10);
        ctx.lineTo(textX - 12, optY - 2);
        ctx.closePath();
        ctx.fillStyle = colors.PANEL_ACCENT || colors.TEXT;
        ctx.fill();
      }
      drawUiText(ctx, dialogue.choiceState.options[i], textX, optY, colors);
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

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "Inventory", boxX + 24, boxY + 42, colors);

  const entries = Object.entries(playerInventory);
  ctx.font = FONT_20;

  let row = 0;
  if (entries.length === 0) {
    drawUiText(ctx, "(No items)", boxX + 24, boxY + 90, colors);
    row = 1;
  } else {
    for (const [itemName, quantity] of entries) {
      drawUiText(ctx, `${itemName} x${quantity}`, boxX + 24, boxY + 90 + row * 28, colors);
      row++;
    }
  }

  const statsY = boxY + 90 + row * 28 + 18;
  ctx.font = FONT_22;
  drawUiText(ctx, "Stats", boxX + 24, statsY, colors);

  ctx.font = FONT_20;
  const levelY = statsY + 30;
  drawUiText(ctx, `Discipline Lv. ${playerStats.disciplineLevel}`, boxX + 24, levelY, colors);

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

  ctx.font = FONT_16;
  const progressText = `${playerStats.disciplineXP} / ${playerStats.disciplineXPNeeded}`;
  const textWidth = ctx.measureText(progressText).width;
  drawUiText(ctx, progressText, barX + (barW - textWidth) / 2, barY + 15, colors);
}

function drawPauseMenuOverlay(ctx, state, canvas, ui, colors) {
  const { gameState, pauseMenuState } = state;
  if (gameState !== GAME_STATES.PAUSE_MENU) return;

  // Semi-transparent overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Menu panel on the right
  const menuW = 200;
  const menuH = 300;
  const menuX = canvas.width - menuW - 20;
  const menuY = (canvas.height - menuH) / 2;

  drawSkinnedPanel(ctx, menuX, menuY, menuW, menuH, colors, { titleBand: true });

  ctx.font = FONT_28;
  ctx.fillStyle = "black";
  ctx.fillText("Pause Menu", menuX + 24, menuY + 42);

  const options = ['Inventory', 'Attributes', 'Settings', 'Quit'];
  const selected = pauseMenuState ? pauseMenuState.selected : 0;

  ctx.font = FONT_20;
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const y = menuY + 90 + i * 30;
    if (i === selected) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(menuX + 10, y - 18, menuW - 20, 24);
    }
    ctx.fillStyle = "black";
    ctx.fillText(option, menuX + 24, y);
  }
}

function drawAttributesOverlay(ctx, state, canvas, ui, colors) {
  const { gameState, playerStats } = state;
  if (gameState !== GAME_STATES.ATTRIBUTES) return;

  ctx.fillStyle = colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = ui.INVENTORY_BOX_WIDTH;
  const boxH = ui.INVENTORY_BOX_HEIGHT;
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  ctx.fillStyle = "black";
  ctx.fillText("Attributes", boxX + 24, boxY + 42);

  ctx.font = FONT_20;
  ctx.fillStyle = "black";
  const levelY = boxY + 90;
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

  ctx.font = FONT_16;
  const progressText = `${playerStats.disciplineXP} / ${playerStats.disciplineXPNeeded}`;
  const textWidth = ctx.measureText(progressText).width;
  ctx.fillStyle = "black";
  ctx.fillText(progressText, barX + (barW - textWidth) / 2, barY + 15);
}

function drawSettingsOverlay(ctx, state, canvas, ui, colors) {
  const { gameState } = state;
  if (gameState !== GAME_STATES.SETTINGS) return;

  ctx.fillStyle = colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = ui.INVENTORY_BOX_WIDTH;
  const boxH = ui.INVENTORY_BOX_HEIGHT;
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  ctx.fillStyle = "black";
  ctx.fillText("Settings", boxX + 24, boxY + 42);

  ctx.font = FONT_20;
  ctx.fillStyle = "black";
  ctx.fillText("Settings menu placeholder", boxX + 24, boxY + 90);
}

function drawBarMinigameOverlay(ctx, state, canvas, colors) {
  if (state.gameState !== GAME_STATES.BAR_MINIGAME) return;
  const minigame = state.barMinigame;
  if (!minigame?.active) return;

  const panelW = Math.min(canvas.width - 40, 520);
  const panelH = 210;
  const panelX = Math.round((canvas.width - panelW) / 2);
  const panelY = Math.round((canvas.height - panelH) / 2);

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.52)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "House Pour Challenge", panelX + 22, panelY + 40, colors);

  ctx.font = FONT_16;
  drawUiText(
    ctx,
    `Round ${minigame.round}/${minigame.totalRounds}   Wins ${minigame.wins}/${minigame.requiredWins}`,
    panelX + 22,
    panelY + 66,
    colors
  );

  const meterX = panelX + 28;
  const meterY = panelY + 96;
  const meterW = panelW - 56;
  const meterH = 34;

  ctx.fillStyle = "rgba(15,18,24,0.95)";
  ctx.fillRect(meterX, meterY, meterW, meterH);
  ctx.strokeStyle = colors.PANEL_BORDER_DARK || colors.DIALOGUE_BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(meterX, meterY, meterW, meterH);

  const targetMin = Math.max(0, minigame.targetCenter - minigame.targetHalfWidth);
  const targetMax = Math.min(100, minigame.targetCenter + minigame.targetHalfWidth);
  const targetX = meterX + (targetMin / 100) * meterW;
  const targetW = ((targetMax - targetMin) / 100) * meterW;

  const targetGradient = ctx.createLinearGradient(0, meterY, 0, meterY + meterH);
  targetGradient.addColorStop(0, "#ffe28f");
  targetGradient.addColorStop(1, "#d6a43a");
  ctx.fillStyle = targetGradient;
  ctx.fillRect(targetX, meterY + 3, targetW, meterH - 6);

  const cursorX = meterX + (Math.max(0, Math.min(100, minigame.cursor)) / 100) * meterW;
  ctx.strokeStyle = "#f5f9ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cursorX, meterY - 4);
  ctx.lineTo(cursorX, meterY + meterH + 4);
  ctx.stroke();

  ctx.font = FONT_20;
  drawUiText(ctx, minigame.feedbackText || "Press ENTER to pour", panelX + 22, panelY + 156, colors);

  ctx.font = FONT_16;
  drawUiText(ctx, "Press ENTER to pour", panelX + 22, panelY + 182, colors);

  ctx.restore();
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
    ctx.font = FONT_16;

    const padding = 8;
    const text = itemAlert.text;
    const textW = ctx.measureText(text).width;
    const boxW = Math.max(120, textW + padding * 2);
    const boxH = 28;
    const boxX = Math.round(screenX - boxW / 2);
    const boxY = Math.round(screenY - boxH);

    drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors);
    drawUiText(ctx, text, boxX + padding, boxY + 19, colors);
    ctx.restore();
  }

  if (inventoryHint.active) {
    const elapsed = performance.now() - inventoryHint.startedAt;
    const alpha = 1 - Math.max(0, (elapsed - (inventoryHint.durationMs - 600)) / 600);

    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    ctx.font = FONT_16;

    const hintText = "New item received - press I to view your inventory";
    const padding = 8;
    const textW = ctx.measureText(hintText).width;
    const boxW = textW + padding * 2;
    const boxH = 28;
    const boxX = 12;
    const boxY = 12;

    drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors);
    drawUiText(ctx, hintText, boxX + padding, boxY + 19, colors);
    ctx.restore();
  }
}

function drawAtmosphere(ctx, canvas, colors, state) {
  if (state.currentAreaKind !== AREA_KINDS.OVERWORLD) return;

  const topLight = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.65);
  topLight.addColorStop(0, colors.AMBIENT_TOP);
  topLight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = topLight;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bottomTint = ctx.createLinearGradient(0, canvas.height * 0.35, 0, canvas.height);
  bottomTint.addColorStop(0, "rgba(0,0,0,0)");
  bottomTint.addColorStop(1, colors.AMBIENT_BOTTOM);
  ctx.fillStyle = bottomTint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const vignette = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.38,
    canvas.height * 0.12,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.62
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, colors.VIGNETTE);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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
  drawAtmosphere(ctx, canvas, colors, state);
  drawBarMinigameOverlay(ctx, state, canvas, colors);
  drawInventoryOverlay(ctx, state, canvas, ui, colors);
  drawPauseMenuOverlay(ctx, state, canvas, ui, colors);
  drawAttributesOverlay(ctx, state, canvas, ui, colors);
  drawSettingsOverlay(ctx, state, canvas, ui, colors);
  drawTextbox(ctx, state, canvas, ui, colors, dialogue);
}
