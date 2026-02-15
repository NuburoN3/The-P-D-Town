import { AREA_KINDS, GAME_STATES } from "../core/constants.js";

const FONT_12 = "600 12px 'Trebuchet MS', 'Segoe UI', sans-serif";
const FONT_16 = "600 16px 'Trebuchet MS', 'Segoe UI', sans-serif";
const FONT_20 = "600 20px 'Trebuchet MS', 'Segoe UI', sans-serif";
const FONT_22 = "700 22px 'Trebuchet MS', 'Segoe UI', sans-serif";
const FONT_28 = "700 28px 'Palatino Linotype', 'Book Antiqua', serif";

function hash01(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const MOOD_PRESETS = Object.freeze({
  goldenDawn: {
    topTint: "rgba(255, 223, 159, 0.13)",
    bottomTint: "rgba(112, 73, 32, 0.14)",
    filmTint: "rgba(255, 231, 188, 0.08)"
  },
  inkQuiet: {
    topTint: "rgba(182, 223, 248, 0.08)",
    bottomTint: "rgba(26, 33, 49, 0.16)",
    filmTint: "rgba(140, 177, 214, 0.06)"
  },
  amberLounge: {
    topTint: "rgba(255, 210, 142, 0.12)",
    bottomTint: "rgba(74, 35, 22, 0.2)",
    filmTint: "rgba(255, 178, 109, 0.1)"
  }
});

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

  const sheen = ctx.createLinearGradient(x + 2, y + 2, x + 2, y + Math.max(4, height * 0.45));
  sheen.addColorStop(0, "rgba(255,255,255,0.14)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x + 2, y + 2, width - 4, Math.max(10, height * 0.45));

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

  ctx.fillStyle = colors.PANEL_ACCENT || "rgba(255, 226, 161, 0.8)";
  ctx.fillRect(x + 8, y + 8, 4, 4);
  ctx.fillRect(x + width - 12, y + 8, 4, 4);
  ctx.fillRect(x + 8, y + height - 12, 4, 4);
  ctx.fillRect(x + width - 12, y + height - 12, 4, 4);
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

function drawDoorTransition(ctx, state, canvas, tileSize, cameraZoom) {
  const { gameState, player, cam, doorSequence } = state;
  if (gameState !== GAME_STATES.TRANSITION) return;

  const transitionRatio = doorSequence.maxFadeRadius > 0
    ? Math.max(0, Math.min(1, doorSequence.fadeRadius / doorSequence.maxFadeRadius))
    : 0;
  const viewW = canvas.width / cameraZoom;
  const viewH = canvas.height / cameraZoom;

  const px = player.x - cam.x + tileSize / 2;
  const py = player.y - cam.y + tileSize / 2;
  const maxHoleRadius = Math.hypot(viewW, viewH) * 0.62;
  const holeRadius = Math.max(0, maxHoleRadius * (1 - transitionRatio));

  ctx.save();
  ctx.fillStyle = `rgba(4, 6, 10, ${0.22 + transitionRatio * 0.74})`;
  ctx.fillRect(0, 0, viewW, viewH);

  if (holeRadius > 0.5) {
    ctx.globalCompositeOperation = "destination-out";
    const feather = ctx.createRadialGradient(
      px,
      py,
      Math.max(0, holeRadius - 28),
      px,
      py,
      holeRadius + 8
    );
    feather.addColorStop(0, "rgba(0,0,0,1)");
    feather.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = feather;
    ctx.beginPath();
    ctx.arc(px, py, holeRadius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  const pulse = 0.5 + Math.sin(performance.now() * 0.011) * 0.5;
  const ringAlpha = Math.max(0.08, (1 - transitionRatio) * 0.22 + pulse * 0.08);
  ctx.strokeStyle = `rgba(248, 214, 140, ${ringAlpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, Math.max(10, holeRadius + 2), 0, Math.PI * 2);
  ctx.stroke();
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

const PAUSE_OPTION_SUBTITLES = Object.freeze({
  Inventory: "Check your satchel and gathered goods",
  Attributes: "Inspect your discipline and growth",
  Settings: "Tune controls and visual comfort",
  Quit: "Leave P-D Town for now"
});

function drawFantasySelectorIcon(ctx, x, y, { highContrast = false, pulse = 0 } = {}) {
  const outer = highContrast ? "#ffffff" : "#7b5124";
  const inner = highContrast ? "#57d4ff" : "#f6d388";
  const glow = highContrast ? "rgba(88,210,255,0.34)" : "rgba(244,208,131,0.34)";

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 10 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 8);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 5);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = highContrast ? "#ffffff" : "#fff7dc";
  ctx.fillRect(-1, -7, 2, 3);
  ctx.fillRect(5, -1, 3, 2);
  ctx.restore();
}

function drawPauseMenuOverlay(ctx, state, canvas, ui, colors) {
  const { gameState, pauseMenuState } = state;
  const isPauseActive = gameState === GAME_STATES.PAUSE_MENU;
  const mode = pauseMenuState?.animationMode || "idle";
  const startedAt = pauseMenuState?.animationStartedAt || 0;
  const duration = Math.max(1, pauseMenuState?.animationDurationMs || 160);
  const t = Math.min(1, (performance.now() - startedAt) / duration);

  let visibility = isPauseActive ? 1 : 0;
  if (mode === "in") {
    visibility = isPauseActive ? t : 0;
    if (isPauseActive && t >= 1 && pauseMenuState) pauseMenuState.animationMode = "idle";
  } else if (mode === "out") {
    visibility = 1 - t;
    if (t >= 1 && pauseMenuState) pauseMenuState.animationMode = "idle";
  }

  if (visibility <= 0.01) return;

  const highContrast = Boolean(pauseMenuState?.highContrast);
  const baseDim = state.currentAreaKind === AREA_KINDS.OVERWORLD ? 0.22 : 0.42;
  const dimAlpha = Math.min(0.72, baseDim + (highContrast ? 0.15 : 0));
  ctx.fillStyle = `rgba(18, 14, 24, ${dimAlpha * visibility})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const menuW = 340;
  const menuH = 392;
  const slideOffset = (1 - visibility) * 34;
  const menuX = canvas.width - menuW - 24 + slideOffset;
  const menuY = (canvas.height - menuH) / 2;

  const aura = ctx.createRadialGradient(
    menuX + menuW * 0.5,
    menuY + menuH * 0.25,
    30,
    menuX + menuW * 0.5,
    menuY + menuH * 0.55,
    menuW
  );
  aura.addColorStop(0, highContrast ? "rgba(96, 182, 234, 0.22)" : "rgba(247, 214, 145, 0.22)");
  aura.addColorStop(1, "rgba(247, 214, 145, 0)");
  ctx.fillStyle = aura;
  ctx.fillRect(menuX - 20, menuY - 20, menuW + 40, menuH + 40);

  const parchment = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH);
  parchment.addColorStop(0, highContrast ? "#212833" : "#f2e1b4");
  parchment.addColorStop(1, highContrast ? "#101722" : "#d7bb7d");
  ctx.fillStyle = parchment;
  ctx.fillRect(menuX, menuY, menuW, menuH);

  const inner = ctx.createLinearGradient(menuX + 5, menuY + 5, menuX + 5, menuY + menuH - 5);
  inner.addColorStop(0, highContrast ? "rgba(48,58,74,0.86)" : "rgba(255,248,222,0.75)");
  inner.addColorStop(1, highContrast ? "rgba(26,35,49,0.82)" : "rgba(230,205,146,0.62)");
  ctx.fillStyle = inner;
  ctx.fillRect(menuX + 5, menuY + 5, menuW - 10, menuH - 10);

  ctx.strokeStyle = highContrast ? "#a6dfff" : "#6c4b1d";
  ctx.lineWidth = 3;
  ctx.strokeRect(menuX + 1.5, menuY + 1.5, menuW - 3, menuH - 3);

  ctx.strokeStyle = highContrast ? "#eef8ff" : "#f7e1ab";
  ctx.lineWidth = 1;
  ctx.strokeRect(menuX + 6.5, menuY + 6.5, menuW - 13, menuH - 13);

  ctx.fillStyle = highContrast ? "#8dc9eb" : "#8b632b";
  ctx.fillRect(menuX + 10, menuY + 10, 12, 4);
  ctx.fillRect(menuX + 10, menuY + 10, 4, 12);
  ctx.fillRect(menuX + menuW - 22, menuY + 10, 12, 4);
  ctx.fillRect(menuX + menuW - 14, menuY + 10, 4, 12);
  ctx.fillRect(menuX + 10, menuY + menuH - 14, 12, 4);
  ctx.fillRect(menuX + 10, menuY + menuH - 22, 4, 12);
  ctx.fillRect(menuX + menuW - 22, menuY + menuH - 14, 12, 4);
  ctx.fillRect(menuX + menuW - 14, menuY + menuH - 22, 4, 12);

  const headerGradient = ctx.createLinearGradient(menuX + 8, menuY + 10, menuX + menuW - 8, menuY + 44);
  if (highContrast) {
    headerGradient.addColorStop(0, "rgba(41, 86, 118, 0.82)");
    headerGradient.addColorStop(0.5, "rgba(67, 132, 179, 0.74)");
    headerGradient.addColorStop(1, "rgba(41, 86, 118, 0.82)");
  } else {
    headerGradient.addColorStop(0, "rgba(116, 74, 32, 0.75)");
    headerGradient.addColorStop(0.5, "rgba(151, 105, 49, 0.65)");
    headerGradient.addColorStop(1, "rgba(116, 74, 32, 0.75)");
  }
  ctx.fillStyle = headerGradient;
  ctx.fillRect(menuX + 8, menuY + 10, menuW - 16, 34);

  ctx.font = FONT_28;
  ctx.fillStyle = highContrast ? "rgba(14, 28, 42, 0.5)" : "rgba(45, 24, 7, 0.45)";
  ctx.fillText("Menu", menuX + 25, menuY + 42);
  ctx.fillStyle = highContrast ? "#f7fdff" : "#fff2ca";
  ctx.fillText("Menu", menuX + 24, menuY + 41);

  const options = pauseMenuState?.options || ['Inventory', 'Attributes', 'Settings', 'Quit'];
  const selected = pauseMenuState ? pauseMenuState.selected : 0;
  const shimmerPhase = (performance.now() % 1500) / 1500;

  ctx.font = FONT_20;
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const y = menuY + 106 + i * 64;
    if (i === selected) {
      const rowGradient = ctx.createLinearGradient(menuX + 24, y - 23, menuX + menuW - 22, y + 21);
      if (highContrast) {
        rowGradient.addColorStop(0, "rgba(82, 150, 196, 0.24)");
        rowGradient.addColorStop(0.5, "rgba(140, 214, 255, 0.5)");
        rowGradient.addColorStop(1, "rgba(82, 150, 196, 0.24)");
      } else {
        rowGradient.addColorStop(0, "rgba(153, 100, 40, 0.22)");
        rowGradient.addColorStop(0.5, "rgba(244, 209, 135, 0.45)");
        rowGradient.addColorStop(1, "rgba(153, 100, 40, 0.22)");
      }
      ctx.fillStyle = rowGradient;
      ctx.fillRect(menuX + 24, y - 23, menuW - 48, 44);

      // Moving light band for a subtle magical shimmer.
      const shimmerX = menuX + 24 + (menuW - 48) * shimmerPhase;
      const shimmer = ctx.createLinearGradient(shimmerX - 28, y - 23, shimmerX + 28, y + 21);
      shimmer.addColorStop(0, "rgba(255,255,255,0)");
      shimmer.addColorStop(0.5, highContrast ? "rgba(229,247,255,0.36)" : "rgba(255,244,212,0.35)");
      shimmer.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shimmer;
      ctx.fillRect(menuX + 24, y - 23, menuW - 48, 44);

      ctx.strokeStyle = highContrast ? "rgba(166, 222, 255, 0.78)" : "rgba(118, 76, 30, 0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(menuX + 24.5, y - 22.5, menuW - 49, 43);

      const pulse = Math.sin(performance.now() * 0.008) * 0.5 + 0.5;
      drawFantasySelectorIcon(ctx, menuX + 29, y - 2, { highContrast, pulse });
    }
    ctx.fillStyle = i === selected ? (highContrast ? "#f7fdff" : "#3f250e") : (highContrast ? "#deeff9" : "#5a3718");
    ctx.fillText(option, menuX + 44, y);

    const subtitle = PAUSE_OPTION_SUBTITLES[option] || "";
    ctx.font = FONT_12;
    ctx.fillStyle = highContrast ? "rgba(207,232,245,0.92)" : "rgba(88, 56, 26, 0.84)";
    ctx.fillText(subtitle, menuX + 44, y + 16);
    ctx.font = FONT_20;

    // Rune-style separator marks between options.
    if (i < options.length - 1) {
      const sepY = y + 32;
      ctx.strokeStyle = highContrast ? "rgba(140, 194, 225, 0.52)" : "rgba(122, 80, 36, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(menuX + 34, sepY);
      ctx.lineTo(menuX + menuW - 34, sepY);
      ctx.stroke();

      ctx.fillStyle = highContrast ? "rgba(182, 230, 255, 0.84)" : "rgba(122, 80, 36, 0.8)";
      ctx.fillRect(menuX + menuW / 2 - 10, sepY - 1, 3, 3);
      ctx.fillRect(menuX + menuW / 2 + 7, sepY - 1, 3, 3);
      ctx.beginPath();
      ctx.moveTo(menuX + menuW / 2 - 2, sepY - 4);
      ctx.lineTo(menuX + menuW / 2 - 6, sepY);
      ctx.lineTo(menuX + menuW / 2 - 2, sepY + 4);
      ctx.lineTo(menuX + menuW / 2 + 2, sepY);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.font = FONT_12;
  ctx.fillStyle = highContrast ? "#d9f2ff" : "#5f3b19";
  ctx.fillText("W/S or Arrows: Move", menuX + 16, menuY + menuH - 52);
  ctx.fillText("Space: Select   Enter/Esc: Resume", menuX + 16, menuY + menuH - 32);
  ctx.fillText("Pad: D-Pad/Stick Move   A Select   B/Start Resume", menuX + 16, menuY + menuH - 12);
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
  const { gameState, pauseMenuState } = state;
  if (gameState !== GAME_STATES.SETTINGS) return;

  const highContrast = Boolean(pauseMenuState?.highContrast);
  ctx.fillStyle = highContrast ? "rgba(0,0,0,0.7)" : colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = ui.INVENTORY_BOX_WIDTH;
  const boxH = ui.INVENTORY_BOX_HEIGHT;
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "Settings", boxX + 24, boxY + 42, colors);

  const labelColor = highContrast ? "#f2fbff" : "#1f1203";
  const valueOnColor = highContrast ? "#90e4ff" : "#27632a";
  const valueOffColor = highContrast ? "#ffd57c" : "#7a3f1d";

  ctx.font = FONT_20;
  ctx.fillStyle = labelColor;
  ctx.fillText("High Contrast Menu", boxX + 24, boxY + 96);

  const statusText = pauseMenuState?.highContrast ? "ON" : "OFF";
  ctx.fillStyle = pauseMenuState?.highContrast ? valueOnColor : valueOffColor;
  ctx.fillText(statusText, boxX + boxW - 78, boxY + 96);

  ctx.font = FONT_16;
  ctx.fillStyle = labelColor;
  ctx.fillText("Space or Gamepad A: Toggle", boxX + 24, boxY + 136);
  ctx.fillText("Enter/Esc or Gamepad B/Start: Back", boxX + 24, boxY + 162);
  ctx.fillText("This affects pause menu readability and contrast.", boxX + 24, boxY + 198);
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
  const isOverworld = state.currentAreaKind === AREA_KINDS.OVERWORLD;

  if (isOverworld) {
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
  }

  const now = performance.now() * 0.001;
  const particleCount = isOverworld ? 42 : 18;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < particleCount; i++) {
    const seed = i * 13.17 + (isOverworld ? 0 : 97.23);
    const speed = isOverworld ? 0.028 + hash01(seed + 0.2) * 0.048 : 0.012 + hash01(seed + 0.2) * 0.02;
    const drift = (now * speed + hash01(seed + 0.8)) % 1;
    const xBase = (1 - drift) * (canvas.width + 120) - 60;
    const yBase = hash01(seed + 1.7) * canvas.height;

    const x = xBase + Math.sin(now * (0.8 + hash01(seed + 2.4)) + seed) * (isOverworld ? 20 : 10);
    const y = yBase + Math.sin(now * (0.75 + hash01(seed + 3.6)) + seed * 1.3) * (isOverworld ? 16 : 7);
    const alpha = isOverworld ? 0.07 + hash01(seed + 4.1) * 0.16 : 0.04 + hash01(seed + 4.1) * 0.08;
    const size = isOverworld ? 1.4 + hash01(seed + 5.5) * 2.6 : 1 + hash01(seed + 5.5) * 1.6;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hash01(seed + 6.8) * Math.PI + now * (isOverworld ? 0.35 : 0.12));
    ctx.fillStyle = isOverworld
      ? `rgba(255, 222, 239, ${alpha})`
      : `rgba(255, 238, 206, ${alpha})`;
    ctx.fillRect(-size * 0.5, -size, size, size * 1.8);
    ctx.restore();
  }

  ctx.restore();

  if (isOverworld) {
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
}

function drawWorldVfx(ctx, state) {
  const effects = Array.isArray(state.vfxEffects) ? state.vfxEffects : null;
  if (!effects || effects.length === 0) return;

  const now = performance.now();
  for (const effect of effects) {
    const age = now - effect.startedAt;
    const life = Math.max(1, effect.durationMs);
    const t = Math.max(0, Math.min(1, age / life));
    const inv = 1 - t;

    const x = effect.x - state.cam.x;
    const y = effect.y - state.cam.y;
    const baseSize = effect.size || 22;
    const glowSize = baseSize * (1.2 + t * 1.1);

    ctx.save();
    ctx.globalAlpha = Math.max(0.03, inv * 0.95);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
    glow.addColorStop(0, effect.glowColor || "rgba(255,255,255,0.34)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowSize, 0, Math.PI * 2);
    ctx.fill();

    if (effect.type === "trainingBurst") {
      ctx.strokeStyle = effect.color || "rgba(255, 224, 157, 0.95)";
      ctx.lineWidth = 2;
      const rays = 8;
      for (let i = 0; i < rays; i++) {
        const angle = i * ((Math.PI * 2) / rays) + t * 0.7;
        const inner = baseSize * (0.2 + t * 0.12);
        const outer = baseSize * (0.75 + t * 0.45);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        ctx.stroke();
      }
    } else if (effect.type === "doorSwirl") {
      ctx.strokeStyle = effect.color || "rgba(250, 240, 195, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.45 + t * 0.65), t * Math.PI * 2, t * Math.PI * 2 + Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.22 + t * 0.45), -t * Math.PI * 2, -t * Math.PI * 2 + Math.PI * 1.3);
      ctx.stroke();
    } else if (effect.type === "pickupGlow") {
      ctx.fillStyle = effect.color || "rgba(171, 238, 255, 0.95)";
      for (let i = 0; i < 6; i++) {
        const angle = i * ((Math.PI * 2) / 6) + t * 2.1;
        const dist = baseSize * (0.22 + t * 0.58);
        const sparkleSize = Math.max(1, baseSize * 0.09 * inv);
        ctx.fillRect(
          x + Math.cos(angle) * dist - sparkleSize * 0.5,
          y + Math.sin(angle) * dist - sparkleSize * 0.5 - t * 9,
          sparkleSize,
          sparkleSize
        );
      }
    } else {
      ctx.strokeStyle = effect.color || "rgba(255, 245, 209, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.34 + t * 0.78), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawMoodGrading(ctx, canvas, state) {
  const preset = MOOD_PRESETS[state.moodPreset];
  if (!preset) return;

  const top = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.7);
  top.addColorStop(0, preset.topTint);
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bottom = ctx.createLinearGradient(0, canvas.height * 0.28, 0, canvas.height);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, preset.bottomTint);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = preset.filmTint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawTitleScreenOverlay(ctx, canvas, state, colors) {
  const titleState = state.titleState;
  if (!titleState || state.gameState !== GAME_STATES.TITLE_SCREEN) return;

  const now = performance.now();
  const elapsed = (now - titleState.startedAt) / 1000;
  const pulse = 0.5 + Math.sin((elapsed + titleState.promptPulseOffset * 0.001) * 2.4) * 0.5;

  const topGlow = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.2,
    20,
    canvas.width * 0.5,
    canvas.height * 0.34,
    canvas.width * 0.7
  );
  topGlow.addColorStop(0, "rgba(255, 214, 158, 0.28)");
  topGlow.addColorStop(1, "rgba(12, 10, 16, 0.78)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(8, 10, 16, 0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = FONT_28;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillText("P-D TOWN", 84, 120);
  const logoGradient = ctx.createLinearGradient(82, 62, 82, 124);
  logoGradient.addColorStop(0, "#fff3d1");
  logoGradient.addColorStop(1, "#e4ba72");
  ctx.fillStyle = logoGradient;
  ctx.fillText("P-D TOWN", 82, 118);

  ctx.font = FONT_20;
  ctx.fillStyle = "rgba(243, 227, 198, 0.92)";
  ctx.fillText("Way of the Cherry Blossom", 84, 148);

  const panelX = 72;
  const panelY = canvas.height - 234;
  const panelW = 372;
  const panelH = 164;
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });

  ctx.font = FONT_16;
  for (let i = 0; i < titleState.options.length; i++) {
    const y = panelY + 64 + i * 38;
    const isSelected = i === titleState.selected;
    if (isSelected) {
      const band = ctx.createLinearGradient(panelX + 14, y - 20, panelX + panelW - 14, y + 7);
      band.addColorStop(0, "rgba(255, 209, 127, 0.14)");
      band.addColorStop(0.5, "rgba(255, 232, 186, 0.32)");
      band.addColorStop(1, "rgba(255, 209, 127, 0.14)");
      ctx.fillStyle = band;
      ctx.fillRect(panelX + 14, y - 20, panelW - 28, 28);
    }
    ctx.fillStyle = isSelected ? "#fff3d3" : "rgba(226, 214, 187, 0.88)";
    ctx.fillText(`${isSelected ? "> " : "  "}${titleState.options[i]}`, panelX + 28, y);
  }

  ctx.font = FONT_12;
  ctx.fillStyle = `rgba(245, 230, 202, ${0.58 + pulse * 0.42})`;
  ctx.fillText("Arrow keys or stick: Navigate", panelX + 22, panelY + panelH - 38);
  ctx.fillText("Enter/Space or A/Start: Confirm", panelX + 22, panelY + panelH - 20);

  if (titleState.showHowTo) {
    const helpW = Math.min(canvas.width - 120, 520);
    const helpH = 210;
    const helpX = Math.round((canvas.width - helpW) / 2);
    const helpY = Math.round((canvas.height - helpH) / 2);
    drawSkinnedPanel(ctx, helpX, helpY, helpW, helpH, colors, { titleBand: true });
    ctx.font = FONT_22;
    drawUiText(ctx, "How To Play", helpX + 20, helpY + 36, colors);
    ctx.font = FONT_16;
    drawUiText(ctx, "Move: W A S D or Arrow Keys", helpX + 20, helpY + 72, colors);
    drawUiText(ctx, "Interact / Advance: Space", helpX + 20, helpY + 96, colors);
    drawUiText(ctx, "Pause Menu: Enter or Esc", helpX + 20, helpY + 120, colors);
    drawUiText(ctx, "Inventory: I", helpX + 20, helpY + 144, colors);
    drawUiText(ctx, "Gamepad: Left Stick + A + Start", helpX + 20, helpY + 168, colors);
    ctx.font = FONT_12;
    drawUiText(ctx, "Press ESC/B to close this panel", helpX + 20, helpY + 192, colors);
  }

  if (titleState.fadeOutActive) {
    const fadeElapsed = now - titleState.fadeOutStartedAt;
    const fadeRatio = Math.max(0, Math.min(1, fadeElapsed / Math.max(1, titleState.fadeOutDurationMs)));
    ctx.fillStyle = `rgba(0,0,0,${fadeRatio})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawForegroundBuildingOccluders(ctx, state, canvas, tileSize, cameraZoom, drawTile) {
  if (typeof state.getBuildingAtWorldTile !== "function") return;

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

      const building = state.getBuildingAtWorldTile(x, y);
      // Redraw dojo top row after entities so roof/eaves occlude player behind it.
      if (!building || building.type !== "DOJO" || y !== building.y) continue;

      const drawX = x * tileSize - state.cam.x;
      const drawY = y * tileSize - state.cam.y;
      drawTile(tileType, drawX, drawY, x, y);
    }
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
  drawCustomOverlays = null,
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
  drawForegroundBuildingOccluders(ctx, state, canvas, tileSize, cameraZoom, drawTile);
  drawWorldVfx(ctx, state);
  drawTrainingPopup(ctx, state, canvas, ui, colors, tileSize);
  drawDoorTransition(ctx, state, canvas, tileSize, cameraZoom);
  ctx.restore();

  drawItemNotifications(ctx, state, cameraZoom, tileSize, colors);
  drawAtmosphere(ctx, canvas, colors, state);
  drawMoodGrading(ctx, canvas, state);
  if (state.gameState === GAME_STATES.TITLE_SCREEN) {
    drawTitleScreenOverlay(ctx, canvas, state, colors);
    return;
  }
  if (typeof drawCustomOverlays === "function") {
    drawCustomOverlays({ ctx, canvas, colors, ui, state });
  }
  drawInventoryOverlay(ctx, state, canvas, ui, colors);
  drawPauseMenuOverlay(ctx, state, canvas, ui, colors);
  drawAttributesOverlay(ctx, state, canvas, ui, colors);
  drawSettingsOverlay(ctx, state, canvas, ui, colors);
  drawTextbox(ctx, state, canvas, ui, colors, dialogue);
}
