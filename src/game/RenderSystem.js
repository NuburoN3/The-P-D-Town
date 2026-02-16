import { AREA_KINDS, GAME_STATES, isFreeExploreState } from "../core/constants.js";

const FONT_12 = "600 12px 'Trebuchet MS', 'Segoe UI', sans-serif";
const FONT_16 = "600 16px 'Trebuchet MS', 'Segoe UI', sans-serif";
const FONT_20 = "600 20px 'Trebuchet MS', 'Segoe UI', sans-serif";
const FONT_22 = "700 22px 'Trebuchet MS', 'Segoe UI', sans-serif";
const FONT_28 = "700 28px 'Palatino Linotype', 'Book Antiqua', serif";

function hash01(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function keyToDisplayName(key) {
  if (typeof key !== "string" || key.length === 0) return "-";
  if (key === "space") return "Space";
  if (key === "arrowup") return "Up Arrow";
  if (key === "arrowdown") return "Down Arrow";
  if (key === "arrowleft") return "Left Arrow";
  if (key === "arrowright") return "Right Arrow";
  if (key === "escape") return "Esc";
  if (key === "enter") return "Enter";
  return key.length === 1 ? key.toUpperCase() : key;
}

function getPrimaryBindingLabel(state, action) {
  const keys = state.keyBindings?.[action];
  if (!Array.isArray(keys) || keys.length === 0) return "-";
  return keyToDisplayName(keys[0]);
}

function getItemDisplayName(itemName) {
  return itemName;
}

function getItemSpriteName(itemName) {
  const spriteMap = {
    "Training Headband": "trainingHeadband",
    "Dojo Membership Card": "dojoMembership"
  };
  return spriteMap[itemName] || null;
}

function getItemSpriteScale(spriteName) {
  const DEFAULT_SCALE = 1.2; // Default for new items
  const scaleOverrides = {
    trainingHeadband: 1.5,
    dojoMembership: 1.0 // Membership card needs smaller scale since it's larger
  };
  return scaleOverrides[spriteName] ?? DEFAULT_SCALE;
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
  const now = performance.now();
  const defeatSequence = state.playerDefeatSequence;
  const isDefeatFallActive = Boolean(
    defeatSequence?.active &&
    (defeatSequence.phase === "fall" || defeatSequence.phase === "fadeOut")
  );

  const targetHeight = tileSize * player.desiredHeightTiles;
  const scale = targetHeight / spriteFrameHeight;
  const drawWidth = spriteFrameWidth * scale;
  const drawHeight = spriteFrameHeight * scale;
  const drawX = Math.round(player.x - cam.x - (drawWidth - tileSize) / 2);
  const drawY = Math.round(player.y - cam.y - (drawHeight - tileSize));

  drawEntityShadow(ctx, drawX, drawY, drawWidth, drawHeight, "rgba(0,0,0,0.22)");
  ctx.save();
  if (player.invulnerableUntil > now && Math.floor(now / 90) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

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
    ctx.restore();
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
  const defeatFallProgress = isDefeatFallActive
    ? Math.max(0, Math.min(1, defeatSequence.fallProgress || 0))
    : 0;

  if (isDefeatFallActive) {
    const pivotX = drawX + drawWidth / 2;
    const pivotY = drawY + drawHeight - 2;
    const maxFallAngle = Math.PI * 0.44;
    const fallAngle = -maxFallAngle * defeatFallProgress;

    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(fallAngle);
    ctx.translate(-pivotX, -pivotY);
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
    ctx.restore();
    ctx.restore();
    return;
  }

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
  ctx.restore();
}

function drawNPCSprite(ctx, npc, drawX, drawY, drawWidth, drawHeight, colors) {
  const frameWidth = Number.isFinite(npc.spriteFrameWidth) && npc.spriteFrameWidth > 0
    ? npc.spriteFrameWidth
    : null;
  const frameHeight = Number.isFinite(npc.spriteFrameHeight) && npc.spriteFrameHeight > 0
    ? npc.spriteFrameHeight
    : null;
  const framesPerRow = Number.isFinite(npc.spriteFramesPerRow) && npc.spriteFramesPerRow > 0
    ? Math.floor(npc.spriteFramesPerRow)
    : null;

  if (frameWidth && frameHeight && framesPerRow) {
    const directionToRow = {
      down: 0,
      left: 1,
      right: 2,
      up: 3
    };
    const row = directionToRow[npc.dir] ?? 0;
    const frame = Math.min(1, framesPerRow - 1);
    const sx = frame * frameWidth;
    const sy = row * frameHeight;
    ctx.drawImage(
      npc.sprite,
      sx,
      sy,
      frameWidth,
      frameHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
    return;
  }

  ctx.save();
  if (npc.dir === "left") {
    ctx.translate(drawX + drawWidth / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(drawX + drawWidth / 2), 0);
  }
  ctx.drawImage(npc.sprite, drawX, drawY, drawWidth, drawHeight);
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
  const { currentAreaId, npcs, cam } = state;

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

        const frameHeight = Number.isFinite(npc.spriteFrameHeight) && npc.spriteFrameHeight > 0
          ? npc.spriteFrameHeight
          : npc.sprite.height;
        const frameWidth = Number.isFinite(npc.spriteFrameWidth) && npc.spriteFrameWidth > 0
          ? npc.spriteFrameWidth
          : npc.sprite.width;

        if (npc.desiredHeightTiles) {
          const targetHeight = tileSize * npc.desiredHeightTiles;
          const scale = targetHeight / frameHeight;
          drawWidth = frameWidth * scale;
          drawHeight = frameHeight * scale;
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

function drawEnemyPlaceholder(ctx, enemy, ex, ey, tileSize) {
  const base = enemy.state === "attackWindup"
    ? "#bb4a4a"
    : enemy.state === "hitStun"
      ? "#9b7ea6"
      : "#705765";
  const trim = enemy.state === "attackWindup" ? "#ffd0a0" : "#d7bbc5";

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(ex + 16, ey + tileSize - 4, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = base;
  ctx.fillRect(ex + 7, ey + 8, 18, 17);
  ctx.fillStyle = trim;
  ctx.fillRect(ex + 10, ey + 11, 12, 4);
  ctx.fillStyle = "#f1e0d0";
  ctx.fillRect(ex + 11, ey + 17, 10, 5);
  ctx.fillStyle = "#2a2327";
  ctx.fillRect(ex + 12, ey + 18, 1, 1);
  ctx.fillRect(ex + 19, ey + 18, 1, 1);
  ctx.fillStyle = "#3e2529";
  ctx.fillRect(ex + 9, ey + 24, 6, 5);
  ctx.fillRect(ex + 17, ey + 24, 6, 5);

  ctx.fillStyle = "#50323d";
  ctx.beginPath();
  ctx.moveTo(ex + 12, ey + 8);
  ctx.lineTo(ex + 15, ey + 3);
  ctx.lineTo(ex + 17, ey + 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ex + 18, ey + 8);
  ctx.lineTo(ex + 21, ey + 3);
  ctx.lineTo(ex + 23, ey + 8);
  ctx.closePath();
  ctx.fill();
}

function drawEnemyHealthBar(ctx, enemy, ex, ey, tileSize) {
  if (enemy.hp >= enemy.maxHp) return;
  const ratio = Math.max(0, Math.min(1, enemy.hp / Math.max(1, enemy.maxHp)));
  const barW = tileSize - 4;
  const barH = 4;
  const barX = ex + 2;
  const barY = ey - 8;
  ctx.fillStyle = "rgba(10, 10, 14, 0.8)";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = ratio > 0.5 ? "#7ad080" : ratio > 0.25 ? "#ddb95f" : "#d36a6a";
  ctx.fillRect(barX, barY, barW * ratio, barH);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
}

function drawEnemies(ctx, state, canvas, tileSize) {
  const { currentAreaId, enemies, cam } = state;
  if (!Array.isArray(enemies) || enemies.length === 0) return;

  for (const enemy of enemies) {
    if (!enemy || enemy.dead || enemy.world !== currentAreaId) continue;

    const ex = Math.round(enemy.x - cam.x);
    const ey = Math.round(enemy.y - cam.y);
    if (ex > canvas.width || ey > canvas.height || ex < -tileSize || ey < -tileSize) continue;

    if (enemy.sprite && enemy.sprite.width && enemy.sprite.height) {
      ctx.drawImage(enemy.sprite, ex, ey, tileSize, tileSize);
    } else {
      drawEnemyPlaceholder(ctx, enemy, ex, ey, tileSize);
    }

    if (enemy.state === "attackWindup") {
      const now = performance.now();
      const totalWindup = Math.max(1, enemy.attackWindupMs || 1);
      const remaining = Math.max(0, (enemy.attackStrikeAt || now) - now);
      const windupProgress = Math.max(0, Math.min(1, 1 - remaining / totalWindup));
      const centerX = ex + tileSize / 2;
      const centerY = ey + tileSize / 2;

      let facingAngle = Math.PI * 0.5;
      if (enemy.dir === "up") facingAngle = -Math.PI * 0.5;
      else if (enemy.dir === "left") facingAngle = Math.PI;
      else if (enemy.dir === "right") facingAngle = 0;

      const arcWidth = Math.PI * 0.55;
      ctx.fillStyle = `rgba(255, 138, 108, ${0.12 + windupProgress * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, tileSize * (0.9 + windupProgress * 0.22), facingAngle - arcWidth, facingAngle + arcWidth);
      ctx.closePath();
      ctx.fill();

      const pulse = 0.5 + Math.sin(now * 0.02) * 0.5;
      ctx.strokeStyle = `rgba(255, 154, 120, ${0.35 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, tileSize * (0.56 + windupProgress * 0.14), 0, Math.PI * 2);
      ctx.stroke();

      const ringProgressStart = -Math.PI * 0.5;
      const ringProgressEnd = ringProgressStart + Math.PI * 2 * windupProgress;
      ctx.strokeStyle = "rgba(255, 232, 173, 0.92)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, tileSize * 0.68, ringProgressStart, ringProgressEnd);
      ctx.stroke();
    }

    drawEnemyHealthBar(ctx, enemy, ex, ey, tileSize);
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

function drawPlayerDefeatOverlay(ctx, state, canvas) {
  const sequence = state.playerDefeatSequence;
  if (!sequence || !sequence.active) return;

  const alpha = Math.max(0, Math.min(1, sequence.overlayAlpha || 0));
  if (alpha <= 0.001) return;

  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawInventoryOverlay(ctx, state, canvas, ui, colors, getItemSprite) {
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

const PAUSE_OPTION_SUBTITLES = Object.freeze({
  Inventory: "Check your satchel and gathered goods",
  Attributes: "Inspect your discipline and growth",
  Settings: "Tune controls and visual comfort",
  Save: "Save your current game",
  Load: "Restore your last manual save",
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
  const options = pauseMenuState?.options || ["Inventory", "Attributes", "Settings", "Save", "Load", "Quit"];
  const optionStartY = 106;
  const optionStep = 46;
  const minMenuH = 392;
  const requiredMenuH = optionStartY + Math.max(0, options.length - 1) * optionStep + 120;
  const baseDim = state.currentAreaKind === AREA_KINDS.OVERWORLD ? 0.22 : 0.42;
  const dimAlpha = Math.min(0.72, baseDim + (highContrast ? 0.15 : 0));
  ctx.fillStyle = `rgba(18, 14, 24, ${dimAlpha * visibility})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const menuW = 340;
  const menuH = Math.max(minMenuH, requiredMenuH);
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

  const selected = pauseMenuState ? pauseMenuState.selected : 0;
  const hovered = pauseMenuState && Number.isInteger(pauseMenuState.hovered) ? pauseMenuState.hovered : -1;
  const activeIndex = hovered >= 0 ? hovered : selected;
  const shimmerPhase = (performance.now() % 1500) / 1500;

  ctx.font = FONT_20;
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const y = menuY + optionStartY + i * optionStep;
    if (i === activeIndex) {
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
    ctx.fillStyle = i === activeIndex ? (highContrast ? "#f7fdff" : "#3f250e") : (highContrast ? "#deeff9" : "#5a3718");
    ctx.fillText(option, menuX + 44, y);

    const subtitle = PAUSE_OPTION_SUBTITLES[option] || "";
    ctx.font = FONT_12;
    ctx.fillStyle = highContrast ? "rgba(207,232,245,0.92)" : "rgba(88, 56, 26, 0.84)";
    ctx.fillText(subtitle, menuX + 44, y + 14);
    ctx.font = FONT_20;

    // Rune-style separator marks between options.
    if (i < options.length - 1) {
      const sepY = y + 30;
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
  const instructionX = menuX + 28;
  ctx.fillText("W/S or Arrows: Move", instructionX, menuY + menuH - 60);
  ctx.fillText(`Space: Select   ${getPrimaryBindingLabel(state, "pause")}: Resume`, instructionX, menuY + menuH - 40);
  ctx.fillText("Pad: D-Pad/Stick Move   A Select   B/Start Resume", instructionX, menuY + menuH - 20);
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
  const { gameState, pauseMenuState, settingsUiState, settingsItems, userSettings } = state;
  if (gameState !== GAME_STATES.SETTINGS) return;

  const highContrast = Boolean(pauseMenuState?.highContrast);
  ctx.fillStyle = highContrast ? "rgba(0,0,0,0.7)" : colors.INVENTORY_OVERLAY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const boxW = Math.min(canvas.width - 60, 690);
  const boxH = Math.min(canvas.height - 60, 470);
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;

  drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors, { titleBand: true });

  ctx.font = FONT_28;
  drawUiText(ctx, "Settings", boxX + 24, boxY + 42, colors);

  const labelColor = highContrast ? "#f2fbff" : "#1f1203";
  const valueOnColor = highContrast ? "#90e4ff" : "#27632a";
  const valueOffColor = highContrast ? "#ffd57c" : "#7a3f1d";
  const entries = Array.isArray(settingsItems) ? settingsItems : [];
  const selected = Number.isFinite(settingsUiState?.selected) ? settingsUiState.selected : 0;
  const statusText = settingsUiState?.statusText || "";
  const awaitingRebindAction = settingsUiState?.awaitingRebindAction || null;

  const listX = boxX + 24;
  const listY = boxY + 76;
  const rowH = 28;
  const visibleRows = Math.max(8, Math.floor((boxH - 170) / rowH));
  const scrollStart = Math.max(0, Math.min(selected - Math.floor(visibleRows / 2), Math.max(0, entries.length - visibleRows)));
  const visibleEnd = Math.min(entries.length, scrollStart + visibleRows);

  ctx.font = FONT_16;
  for (let i = scrollStart; i < visibleEnd; i++) {
    const item = entries[i];
    const rowY = listY + (i - scrollStart) * rowH;
    const isSelected = i === selected;
    const isRebindingThis = awaitingRebindAction && item?.action === awaitingRebindAction;

    if (isSelected) {
      ctx.fillStyle = highContrast ? "rgba(145, 214, 255, 0.25)" : "rgba(255, 228, 164, 0.35)";
      ctx.fillRect(listX - 8, rowY - 18, boxW - 48, 24);
    }

    ctx.fillStyle = labelColor;
    const prefix = isSelected ? "> " : "  ";
    ctx.fillText(`${prefix}${item?.label || "Unknown setting"}`, listX, rowY);

    let valueText = "";
    let valueColor = valueOffColor;
    if (item?.kind === "toggle") {
      const enabled = item.id === "highContrastMenu"
        ? Boolean(pauseMenuState?.highContrast)
        : Boolean(userSettings?.[item.id]);
      valueText = enabled ? "ON" : "OFF";
      valueColor = enabled ? valueOnColor : valueOffColor;
    } else if (item?.kind === "cycle") {
      if (item.id === "textSpeedMultiplier") {
        const multiplier = Number.isFinite(userSettings?.textSpeedMultiplier) ? userSettings.textSpeedMultiplier : 1;
        valueText = `${Math.round(multiplier * 100)}%`;
      }
      valueColor = highContrast ? "#cfeeff" : "#50320f";
    } else if (item?.kind === "rebind") {
      valueText = isRebindingThis ? "[Press key...]" : getPrimaryBindingLabel(state, item.action);
      valueColor = isRebindingThis
        ? (highContrast ? "#90e4ff" : "#245b92")
        : (highContrast ? "#dbeffd" : "#5a3718");
    } else if (item?.kind === "action") {
      valueText = "Run";
      valueColor = highContrast ? "#dbeffd" : "#5a3718";
    }

    if (valueText) {
      ctx.fillStyle = valueColor;
      const valueWidth = ctx.measureText(valueText).width;
      ctx.fillText(valueText, boxX + boxW - 24 - valueWidth, rowY);
    }
  }

  const instructionsY = boxY + boxH - 74;
  ctx.font = FONT_12;
  ctx.fillStyle = labelColor;
  ctx.fillText("W/S or Arrows: Navigate", boxX + 24, instructionsY);
  ctx.fillText("Space/Enter or Gamepad A: Apply/Toggle", boxX + 24, instructionsY + 18);
  ctx.fillText("Esc or Gamepad B/Start: Back", boxX + 24, instructionsY + 36);

  if (statusText) {
    ctx.font = FONT_16;
    ctx.fillStyle = highContrast ? "#ddf5ff" : "#4e3213";
    ctx.fillText(statusText, boxX + 24, boxY + boxH - 16);
  }
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

function drawCombatHud(ctx, state, colors) {
  if (!isFreeExploreState(state.gameState)) return;
  if (!state.player || !Number.isFinite(state.player.maxHp)) return;

  const showChallenge = Boolean(state.gameFlags?.acceptedTraining);
  const promptMode = state.inputPromptMode === "gamepad" ? "gamepad" : "keyboard";
  const panelX = 14;
  const panelY = 14;
  const panelW = 224;
  const panelH = showChallenge ? 94 : 72;
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors);

  const hpRatio = Math.max(0, Math.min(1, state.player.hp / Math.max(1, state.player.maxHp)));
  const hpBarX = panelX + 12;
  const hpBarY = panelY + 28;
  const hpBarW = panelW - 24;
  const hpBarH = 12;

  ctx.font = FONT_12;
  drawUiText(ctx, `HP ${Math.round(state.player.hp)} / ${Math.round(state.player.maxHp)}`, panelX + 12, panelY + 19, colors);

  ctx.fillStyle = "rgba(11, 12, 16, 0.85)";
  ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
  ctx.fillStyle = hpRatio > 0.5 ? "#7ad080" : hpRatio > 0.25 ? "#ddb95f" : "#d36a6a";
  ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(hpBarX + 0.5, hpBarY + 0.5, hpBarW - 1, hpBarH - 1);

  if (showChallenge) {
    const kills = Number.isFinite(state.gameFlags.hanamiChallengeKills) ? state.gameFlags.hanamiChallengeKills : 0;
    const target = Number.isFinite(state.gameFlags.hanamiChallengeTarget) ? state.gameFlags.hanamiChallengeTarget : 3;
    ctx.font = FONT_12;
    const challengeText = state.gameFlags.completedTraining
      ? "Mr. Hanami challenge complete"
      : `Mr. Hanami challenge: ${kills}/${target}`;
    drawUiText(ctx, challengeText, panelX + 12, panelY + 48, colors);
  }

  ctx.font = FONT_12;
  const promptText = promptMode === "gamepad"
    ? "A Interact  X Attack  Start Menu"
    : `${getPrimaryBindingLabel(state, "interact")} Interact  ${getPrimaryBindingLabel(state, "attack")} Attack  ${getPrimaryBindingLabel(state, "pause")} Menu`;
  drawUiText(ctx, promptText, panelX + 12, panelY + panelH - 10, colors);
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

    const inventoryKey = getPrimaryBindingLabel(state, "inventory");
    const hintText = `New item received - press ${inventoryKey} to view your inventory`;
    const padding = 8;
    const textW = ctx.measureText(hintText).width;
    const boxW = textW + padding * 2;
    const boxH = 28;
    const boxX = Math.round((ctx.canvas.width - boxW) / 2);
    const boxY = 12;

    drawSkinnedPanel(ctx, boxX, boxY, boxW, boxH, colors);
    drawUiText(ctx, hintText, boxX + padding, boxY + 19, colors);
    ctx.restore();
  }
}

function drawAtmosphere(ctx, canvas, colors, state) {
  const isOverworld = state.currentAreaKind === AREA_KINDS.OVERWORLD;
  const reducedFlashes = Boolean(state.userSettings?.reducedFlashes);
  const intensity = reducedFlashes ? 0.58 : 1;

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
  const particleCount = Math.round((isOverworld ? 42 : 18) * intensity);
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
    const alphaBase = isOverworld ? 0.07 + hash01(seed + 4.1) * 0.16 : 0.04 + hash01(seed + 4.1) * 0.08;
    const alpha = alphaBase * intensity;
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

  const reducedFlashes = Boolean(state.userSettings?.reducedFlashes);
  const flashScale = reducedFlashes ? 0.58 : 1;
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
    ctx.globalAlpha = Math.max(0.03, inv * 0.95 * flashScale);
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
    } else if (effect.type === "attackSlash") {
      const start = Math.PI * 0.15 + t * 1.6;
      const end = start + Math.PI * 0.95;
      ctx.strokeStyle = effect.color || "rgba(255, 238, 198, 0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.72 + t * 0.2), start, end);
      ctx.stroke();
    } else if (effect.type === "hitSpark") {
      const rays = 6;
      ctx.strokeStyle = effect.color || "rgba(255, 191, 142, 0.96)";
      ctx.lineWidth = 2;
      for (let i = 0; i < rays; i++) {
        const angle = i * ((Math.PI * 2) / rays) + t * 0.4;
        const inner = baseSize * 0.12;
        const outer = baseSize * (0.45 + t * 0.36);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        ctx.stroke();
      }
    } else if (effect.type === "warningRing") {
      const pulse = 0.5 + Math.sin(t * Math.PI * 2.6) * 0.5;
      ctx.strokeStyle = effect.color || `rgba(255, 163, 131, ${0.46 + pulse * 0.24})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * (0.7 + t * 0.45), 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === "damageText") {
      ctx.font = FONT_16;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const floatY = y - t * 22;
      ctx.fillStyle = effect.color || "rgba(255, 233, 190, 0.98)";
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      const text = String(effect.text || "");
      ctx.strokeText(text, x, floatY);
      ctx.fillText(text, x, floatY);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
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
  const optionCount = Array.isArray(titleState.options) ? titleState.options.length : 0;
  const panelH = Math.max(188, 144 + Math.max(0, optionCount - 1) * 38);
  const panelY = canvas.height - (panelH + 70);
  const panelW = 372;
  drawSkinnedPanel(ctx, panelX, panelY, panelW, panelH, colors, { titleBand: true });

  ctx.font = FONT_16;
  for (let i = 0; i < titleState.options.length; i++) {
    const y = panelY + 64 + i * 38;
    const hovered = Number.isInteger(titleState.hovered) ? titleState.hovered : -1;
    const activeIndex = hovered >= 0 ? hovered : titleState.selected;
    const isSelected = i === activeIndex;
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
    const helpH = 236;
    const helpX = Math.round((canvas.width - helpW) / 2);
    const helpY = Math.round((canvas.height - helpH) / 2);
    drawSkinnedPanel(ctx, helpX, helpY, helpW, helpH, colors, { titleBand: true });
    ctx.font = FONT_22;
    drawUiText(ctx, "How To Play", helpX + 20, helpY + 36, colors);
    ctx.font = FONT_16;
    drawUiText(ctx, `Move: ${getPrimaryBindingLabel(state, "moveUp")} ${getPrimaryBindingLabel(state, "moveLeft")} ${getPrimaryBindingLabel(state, "moveDown")} ${getPrimaryBindingLabel(state, "moveRight")} or arrows`, helpX + 20, helpY + 72, colors);
    drawUiText(ctx, `Interact / Advance: ${getPrimaryBindingLabel(state, "interact")}`, helpX + 20, helpY + 96, colors);
    drawUiText(ctx, `Attack: ${getPrimaryBindingLabel(state, "attack")}`, helpX + 20, helpY + 120, colors);
    drawUiText(ctx, `Pause Menu: ${getPrimaryBindingLabel(state, "pause")}`, helpX + 20, helpY + 144, colors);
    drawUiText(ctx, `Inventory: ${getPrimaryBindingLabel(state, "inventory")}`, helpX + 20, helpY + 168, colors);
    drawUiText(ctx, "Gamepad: Left Stick + A/X + Start", helpX + 20, helpY + 192, colors);
    ctx.font = FONT_12;
    drawUiText(ctx, "Press ESC/B to close this panel", helpX + 20, helpY + 218, colors);
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
  getItemSprite = () => null,
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
  drawEnemies(ctx, state, canvas, tileSize);
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
  drawCombatHud(ctx, state, colors);
  if (typeof drawCustomOverlays === "function") {
    drawCustomOverlays({ ctx, canvas, colors, ui, state });
  }
  drawInventoryOverlay(ctx, state, canvas, ui, colors, getItemSprite);
  drawPauseMenuOverlay(ctx, state, canvas, ui, colors);
  drawAttributesOverlay(ctx, state, canvas, ui, colors);
  drawSettingsOverlay(ctx, state, canvas, ui, colors);
  drawTextbox(ctx, state, canvas, ui, colors, dialogue);
  drawPlayerDefeatOverlay(ctx, state, canvas);
}
