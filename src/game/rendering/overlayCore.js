import { GAME_STATES } from "../../core/constants.js";
import { FONT_12, FONT_20, drawControlChip, drawSkinnedPanel, drawUiText, getPrimaryBindingLabel } from "./uiPrimitives.js";

export function drawTrainingPopup(ctx, state, canvas, ui, colors, tileSize) {
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

export function drawTextbox(ctx, state, canvas, ui, colors, dialogue) {
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

  ctx.font = FONT_12;
  const skipKey = state.inputPromptMode === "gamepad" ? "X" : getPrimaryBindingLabel(state, "attack");
  const skipLabel = "Fast skip text";
  const skipTextW = ctx.measureText(skipLabel).width;
  const chipW = Math.ceil(ctx.measureText(skipKey).width) + 12;
  const hintX = boxX + boxW - (chipW + skipTextW + 22);
  const hintY = boxY + boxHeight - 18;
  const renderedChipW = drawControlChip(ctx, skipKey, hintX, hintY, colors, { highlighted: true });
  drawUiText(ctx, skipLabel, hintX + renderedChipW + 8, boxY + boxHeight - 10, colors);
}

export function drawDoorTransition(ctx, state, canvas, tileSize, cameraZoom) {
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
  const blackoutAlpha = Math.min(1, 0.24 + transitionRatio * 0.86);
  ctx.fillStyle = `rgba(4, 6, 10, ${blackoutAlpha})`;
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

export function drawPlayerDefeatOverlay(ctx, state, canvas) {
  const sequence = state.playerDefeatSequence;
  if (!sequence || !sequence.active) return;

  const alpha = Math.max(0, Math.min(1, sequence.overlayAlpha || 0));
  if (alpha <= 0.001) return;

  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
