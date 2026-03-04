import { drawEntityShadow } from "./uiPrimitives.js";
import { resolvePlayerAttackFrameIndex } from "../combat/playerAttackAnimationTiming.js";

const ATTACK_HEADGEAR_OFFSETS = [
  { x: 0, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: -2 },
  { x: 1, y: -1 },
  { x: 0, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 0 }
];
const BONK_ATTACK_ID = "bonkStrike";
const BONK_IMPACT_FRAME_INDEX = 4; // 5th frame across (0-based)
const FINAL_REWARD_OBJECTIVE_ID = "basic-training-claim-reward";
const FINAL_REWARD_NPC_IDS = new Set(["mrhanami", "mrhanamibogland"]);
const ELIAS_REWARD_NPC_ID = "farmerelias";

function drawPlayer(
  ctx,
  state,
  getHandstandSprite,
  getEquippedTrainingHeadbandSprite,
  tileSize,
  spriteFrameWidth,
  spriteFrameHeight,
  spriteFramesPerRow
) {
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

  let hasDojoCurtainClip = false;
  if (state.currentAreaId === "hanamiDojo") {
    // Clip player below the dojo curtain, but keep the 6-tile exit opening
    // visible so the player can be seen while moving through the aura/doors.
    const curtainTopY = (tileSize * 9) - cam.y;
    const exitOpeningX = (tileSize * 3) - cam.x;
    const exitOpeningW = tileSize * 6;
    ctx.save();
    ctx.beginPath();
    // Main visible area above curtain.
    ctx.rect(-4096, -4096, 8192, curtainTopY + 4096);
    // Opening through curtain at dojo exits (x=3..8 on bottom row).
    ctx.rect(exitOpeningX, curtainTopY, exitOpeningW, 4096);
    ctx.clip();
    hasDojoCurtainClip = true;
  }

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
    if (hasDojoCurtainClip) ctx.restore();
    return;
  }

  const directionToRow = {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  };
  const isAttacking = player.attackState && player.attackState !== "idle";
  const attackSprite = state?.protagonistBasicAttackSprite;
  const useAttackSprite = Boolean(
    isAttacking &&
    attackSprite &&
    attackSprite.width &&
    attackSprite.height
  );
  const characterSprite = useAttackSprite ? attackSprite : player.sprite;

  let row = directionToRow[player.dir] ?? 0;
  const availableRows = Math.max(1, Math.floor(characterSprite.height / spriteFrameHeight));
  if (row >= availableRows) row = 0;

  let frame = player.walking ? player.animFrame : 1;
  let attackAnimFrame = frame;
  if (useAttackSprite) {
    const isBonkAttack = String(player.activeAttackId || "").toLowerCase() === BONK_ATTACK_ID.toLowerCase();
    const availableFrames = Math.max(1, Math.floor(characterSprite.width / spriteFrameWidth));
    player.attackAnimationFrameCount = availableFrames;
    if (isBonkAttack) {
      const startedAt = Number.isFinite(player.attackStartedAt) ? player.attackStartedAt : now;
      const activeAt = Number.isFinite(player.attackActiveAt) ? player.attackActiveAt : now;
      const recoveryUntil = Number.isFinite(player.attackRecoveryUntil) ? player.attackRecoveryUntil : now;
      const hitFrame = Math.max(0, Math.min(availableFrames - 1, BONK_IMPACT_FRAME_INDEX));

      if (player.attackState === "windup") {
        const windupDuration = Math.max(1, activeAt - startedAt);
        const windupElapsed = Math.max(0, now - startedAt);
        const progress = Math.max(0, Math.min(1, windupElapsed / windupDuration));
        const eased = progress * progress * (3 - 2 * progress); // smoothstep for heavier, slower-feeling windup
        if (hitFrame >= 4) {
          // Hold early swing-back frames longer; flash frame 4 just before impact frame 5.
          if (eased < 0.30) {
            frame = 0;
          } else if (eased < 0.60) {
            frame = 1;
          } else if (eased < 0.88) {
            frame = 2;
          } else if (eased < 0.97) {
            frame = 3;
          } else {
            frame = hitFrame;
          }
        } else {
          frame = Math.min(hitFrame, Math.floor(eased * (hitFrame + 1)));
        }
      } else {
        const postDuration = Math.max(1, recoveryUntil - activeAt);
        const postElapsed = Math.max(0, now - activeAt);
        const postProgress = Math.max(0, Math.min(1, postElapsed / postDuration));
        const postFrames = Math.max(1, availableFrames - hitFrame);
        frame = Math.min(availableFrames - 1, hitFrame + Math.floor(postProgress * postFrames));
      }
    } else {
      const totalAttackDuration = Math.max(
        1,
        (Number.isFinite(player.attackRecoveryUntil) ? player.attackRecoveryUntil : now)
        - (Number.isFinite(player.attackStartedAt) ? player.attackStartedAt : now)
      );
      const elapsed = Math.max(
        0,
        now - (Number.isFinite(player.attackStartedAt) ? player.attackStartedAt : now)
      );
      const progress = Math.max(0, Math.min(1, elapsed / totalAttackDuration));
      frame = resolvePlayerAttackFrameIndex(progress, availableFrames);
    }
    attackAnimFrame = frame;
  }
  const sx = frame * spriteFrameWidth;
  const sy = row * spriteFrameHeight;
  const hasTrainingHeadbandEquipped = state.playerEquipment?.head === "Training Headband";
  const equippedHeadbandSprite = hasTrainingHeadbandEquipped
    ? getEquippedTrainingHeadbandSprite?.()
    : null;
  const shouldDrawEquippedHeadband = Boolean(
    equippedHeadbandSprite &&
    equippedHeadbandSprite.width &&
    equippedHeadbandSprite.height
  );
  const equippedFramesPerRow = shouldDrawEquippedHeadband
    ? Math.max(1, Math.floor(equippedHeadbandSprite.width / spriteFrameWidth))
    : 1;
  const equippedRows = shouldDrawEquippedHeadband
    ? Math.max(1, Math.floor(equippedHeadbandSprite.height / spriteFrameHeight))
    : 1;
  const equippedRow = row < equippedRows ? row : 0;
  const equippedFrame = useAttackSprite
    ? Math.min(1, equippedFramesPerRow - 1)
    : Math.min(frame, equippedFramesPerRow - 1);
  const headgearOffset = useAttackSprite
    ? (ATTACK_HEADGEAR_OFFSETS[attackAnimFrame] || ATTACK_HEADGEAR_OFFSETS[ATTACK_HEADGEAR_OFFSETS.length - 1])
    : { x: 0, y: 0 };
  const equippedSx = equippedFrame * spriteFrameWidth;
  const equippedSy = equippedRow * spriteFrameHeight;
  const equippedDrawX = drawX + headgearOffset.x;
  const equippedDrawY = drawY + headgearOffset.y;
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
      characterSprite,
      sx,
      sy,
      spriteFrameWidth,
      spriteFrameHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
    if (shouldDrawEquippedHeadband) {
      ctx.drawImage(
        equippedHeadbandSprite,
        equippedSx,
        equippedSy,
        spriteFrameWidth,
        spriteFrameHeight,
        equippedDrawX,
        equippedDrawY,
        drawWidth,
        drawHeight
      );
    }
    ctx.restore();
    ctx.restore();
    if (hasDojoCurtainClip) ctx.restore();
    return;
  }

  ctx.drawImage(
    characterSprite,
    sx,
    sy,
    spriteFrameWidth,
    spriteFrameHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  if (shouldDrawEquippedHeadband) {
    ctx.drawImage(
      equippedHeadbandSprite,
      equippedSx,
      equippedSy,
      spriteFrameWidth,
      spriteFrameHeight,
      equippedDrawX,
      equippedDrawY,
      drawWidth,
      drawHeight
    );
  }
  ctx.restore();
  if (hasDojoCurtainClip) ctx.restore();
}

function drawNPCSprite(ctx, npc, drawX, drawY, drawWidth, drawHeight) {
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

function drawNpcOwBubble(ctx, npc, drawX, drawY, drawWidth) {
  const text = typeof npc.hitBubbleText === "string" && npc.hitBubbleText.length > 0
    ? npc.hitBubbleText
    : "Ow!";
  ctx.save();
  ctx.font = "bold 12px Georgia";
  const previousAlign = ctx.textAlign;
  const previousBaseline = ctx.textBaseline;
  const paddingX = 7;
  const bubbleW = Math.ceil(ctx.measureText(text).width) + paddingX * 2;
  const bubbleH = 20;
  const bubbleX = Math.round(drawX + drawWidth / 2 - bubbleW / 2);
  const bubbleY = Math.round(drawY - 30);
  ctx.fillStyle = "rgba(255, 252, 241, 0.95)";
  ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
  ctx.strokeStyle = "rgba(73, 51, 30, 0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bubbleX + 0.5, bubbleY + 0.5, bubbleW - 1, bubbleH - 1);
  ctx.beginPath();
  ctx.moveTo(bubbleX + bubbleW / 2 - 4, bubbleY + bubbleH);
  ctx.lineTo(bubbleX + bubbleW / 2 + 4, bubbleY + bubbleH);
  ctx.lineTo(Math.round(drawX + drawWidth / 2), bubbleY + bubbleH + 5);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 252, 241, 0.95)";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3a2919";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, Math.round(bubbleX + bubbleW / 2), Math.round(bubbleY + bubbleH / 2));
  ctx.textAlign = previousAlign;
  ctx.textBaseline = previousBaseline;
  ctx.restore();
}

function shouldDrawFinalRewardGlow(state, npc) {
  const npcId = String(npc?.id || "").toLowerCase();
  const objectiveId = String(state?.objectiveState?.id || "");
  if (objectiveId === FINAL_REWARD_OBJECTIVE_ID && FINAL_REWARD_NPC_IDS.has(npcId)) {
    return true;
  }
  if (npcId !== ELIAS_REWARD_NPC_ID) return false;
  const townId = String(state?.currentTownId || "");
  if (!townId) return false;
  const townProgress = state?.gameFlags?.townProgress?.[townId];
  return Boolean(townProgress?.eliasQuestRewardReady && !townProgress?.eliasQuestClaimed);
}

function drawFinalRewardGlow(ctx, drawX, drawY, drawWidth, drawHeight, now) {
  const pulse = 0.5 + Math.sin(now * 0.008) * 0.5;
  const centerX = drawX + drawWidth * 0.5;
  const centerY = drawY + drawHeight * 0.56;
  const radius = Math.max(drawWidth, drawHeight) * (0.54 + pulse * 0.08);

  ctx.save();
  const halo = ctx.createRadialGradient(centerX, centerY, radius * 0.18, centerX, centerY, radius);
  halo.addColorStop(0, `rgba(255, 231, 109, ${(0.2 + pulse * 0.1).toFixed(3)})`);
  halo.addColorStop(1, "rgba(255, 231, 109, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 239, 156, ${(0.45 + pulse * 0.35).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * (0.8 + pulse * 0.08), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawNPCs(ctx, state, canvas, tileSize, colors, owBubbleQueue = null, shouldDrawNpc = null) {
  const { currentAreaId, npcs, cam } = state;
  const now = performance.now();

  for (const npc of npcs) {
    if (npc.world !== currentAreaId) continue;
    if (typeof shouldDrawNpc === "function" && !shouldDrawNpc(npc)) continue;
    const isPassedOutPet = Boolean(npc.isPlayerPet && (npc.passedOut || (Number.isFinite(npc.hp) && npc.hp <= 0)));
    if (isPassedOutPet && (!Number.isFinite(npc.passedOutAt) || npc.passedOutAt <= 0)) {
      npc.passedOutAt = now;
    }
    const passedOutElapsed = isPassedOutPet && Number.isFinite(npc.passedOutAt) ? Math.max(0, now - npc.passedOutAt) : 0;
    const passedOutFadeDurationMs = 540;
    if (isPassedOutPet && passedOutElapsed >= passedOutFadeDurationMs) {
      continue;
    }
    const passedOutProgress = isPassedOutPet
      ? Math.max(0, Math.min(1, passedOutElapsed / passedOutFadeDurationMs))
      : 0;

    let shakeX = 0;
    let shakeY = 0;
    const shakeUntil = Number.isFinite(npc.hitShakeUntil) ? npc.hitShakeUntil : 0;
    if (now < shakeUntil) {
      const t = (shakeUntil - now) / 220;
      const amp = 1.1 + Math.max(0, t) * 1.8;
      shakeX = Math.sin(now * 0.09 + npc.x * 0.01) * amp;
      shakeY = Math.cos(now * 0.11 + npc.y * 0.01) * amp * 0.45;
    }

    const nx = npc.x - cam.x + shakeX;
    const ny = npc.y - cam.y + shakeY;

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
          drawX = Math.round(npc.x - cam.x - (drawWidth - tileSize) / 2 + shakeX);
          drawY = Math.round(npc.y - cam.y - (drawHeight - tileSize) + shakeY);
        } else {
          drawWidth = npc.spriteWidth || tileSize;
          drawHeight = npc.spriteHeight || tileSize;
          drawX = Math.round(npc.x - cam.x - (drawWidth - tileSize) / 2 + shakeX);
          drawY = Math.round(npc.y - cam.y - (drawHeight - tileSize) + shakeY);
        }
        const sinkOffset = isPassedOutPet ? Math.round(passedOutProgress * 12) : 0;
        drawY += sinkOffset;

        if (shouldDrawFinalRewardGlow(state, npc)) {
          drawFinalRewardGlow(ctx, drawX, drawY, drawWidth, drawHeight, now);
        }
        drawEntityShadow(ctx, drawX, drawY, drawWidth, drawHeight, colors.GROUND_SHADOW);
        if (isPassedOutPet) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - passedOutProgress);
          drawNPCSprite(ctx, npc, drawX, drawY, drawWidth, drawHeight);
          ctx.restore();
        } else {
          drawNPCSprite(ctx, npc, drawX, drawY, drawWidth, drawHeight);
        }
        if (now < (Number.isFinite(npc.hitBubbleUntil) ? npc.hitBubbleUntil : 0)) {
          if (Array.isArray(owBubbleQueue)) {
            owBubbleQueue.push({ npc, drawX, drawY, drawWidth });
          } else {
            drawNpcOwBubble(ctx, npc, drawX, drawY, drawWidth);
          }
        }
      } else {
        if (isPassedOutPet) {
          continue;
        }
        if (shouldDrawFinalRewardGlow(state, npc)) {
          drawFinalRewardGlow(ctx, nx, ny, npc.width || tileSize, npc.height || tileSize, now);
        }
        drawNPCPlaceholder(ctx, nx, ny, colors);
        if (now < (Number.isFinite(npc.hitBubbleUntil) ? npc.hitBubbleUntil : 0)) {
          if (Array.isArray(owBubbleQueue)) {
            owBubbleQueue.push({ npc, drawX: nx, drawY: ny, drawWidth: npc.width || tileSize });
          } else {
            drawNpcOwBubble(ctx, npc, nx, ny, npc.width || tileSize);
          }
        }
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

function drawEnemyHealthBar(ctx, enemy, ex, ey, drawWidth) {
  if (enemy.hp >= enemy.maxHp) return;
  const ratio = Math.max(0, Math.min(1, enemy.hp / Math.max(1, enemy.maxHp)));
  const barW = Math.max(12, Math.round(drawWidth) - 4);
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

function drawEnemies(ctx, state, canvas, tileSize, shouldDrawEnemy = null) {
  const { currentAreaId, enemies, cam } = state;
  if (!Array.isArray(enemies) || enemies.length === 0) return;
  const now = performance.now();

  for (const enemy of enemies) {
    if (!enemy || enemy.dead || enemy.world !== currentAreaId) continue;
    if (typeof shouldDrawEnemy === "function" && !shouldDrawEnemy(enemy)) continue;

    let drawWidth = tileSize;
    let drawHeight = tileSize;
    let ex = Math.round(enemy.x - cam.x);
    let ey = Math.round(enemy.y - cam.y);

    const enemySprite = (enemy?.directionalSprites && enemy.directionalSprites[enemy.dir]) || enemy.sprite;
    if (enemySprite && enemySprite.width && enemySprite.height) {
      const sourceHeight = Number.isFinite(enemy.spriteHeight) && enemy.spriteHeight > 0
        ? enemy.spriteHeight
        : enemySprite.height;
      const sourceWidth = Number.isFinite(enemy.spriteWidth) && enemy.spriteWidth > 0
        ? enemy.spriteWidth
        : enemySprite.width;
      if (Number.isFinite(enemy.desiredHeightTiles) && enemy.desiredHeightTiles > 0) {
        drawHeight = tileSize * enemy.desiredHeightTiles;
        const scale = drawHeight / sourceHeight;
        drawWidth = sourceWidth * scale;
      } else {
        drawWidth = Number.isFinite(enemy.spriteWidth) && enemy.spriteWidth > 0
          ? enemy.spriteWidth
          : tileSize;
        drawHeight = Number.isFinite(enemy.spriteHeight) && enemy.spriteHeight > 0
          ? enemy.spriteHeight
          : tileSize;
      }
      ex = Math.round(enemy.x - cam.x - (drawWidth - tileSize) / 2);
      ey = Math.round(enemy.y - cam.y - (drawHeight - tileSize));
    }

    const baseEy = ey;
    if (String(enemy.id || "").toLowerCase() === "thebrog" && enemy.state === "brogLeap") {
      const leapStartAt = Number.isFinite(enemy.brogLeapStartAt) ? enemy.brogLeapStartAt : now;
      const leapLandAt = Number.isFinite(enemy.brogLeapLandAt) ? enemy.brogLeapLandAt : now;
      const leapDuration = Math.max(1, leapLandAt - leapStartAt);
      const t = Math.max(0, Math.min(1, (now - leapStartAt) / leapDuration));
      const leapLift = Math.sin(t * Math.PI) * (tileSize * 2.6);
      ey -= leapLift;

      const shadowPulse = 0.18 + (1 - t) * t * 0.35;
      ctx.fillStyle = `rgba(0,0,0,${shadowPulse.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(ex + drawWidth * 0.5, baseEy + drawHeight - 3, Math.max(10, drawWidth * 0.18), Math.max(4, drawWidth * 0.07), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (ex > canvas.width || ey > canvas.height || ex < -drawWidth || ey < -drawHeight) continue;

    if (enemySprite && enemySprite.width && enemySprite.height) {
      ctx.drawImage(enemySprite, ex, ey, drawWidth, drawHeight);
    } else {
      drawEnemyPlaceholder(ctx, enemy, ex, ey, tileSize);
    }

    if (enemy.state === "attackWindup") {
      const now = performance.now();
      const totalWindup = Math.max(1, enemy.attackWindupMs || 1);
      const remaining = Math.max(0, (enemy.attackStrikeAt || now) - now);
      const windupProgress = Math.max(0, Math.min(1, 1 - remaining / totalWindup));
      const enemyId = String(enemy.id || "").toLowerCase();
      const centerX = ex + drawWidth / 2;
      const centerY = ey + drawHeight / 2;

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

      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const countdown = Math.max(0, Math.ceil(remaining / 120));
      ctx.fillStyle = "rgba(255, 242, 198, 0.96)";
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeText(String(countdown), centerX, ey - 8);
      ctx.fillText(String(countdown), centerX, ey - 8);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";

      if (enemyId === "thebrog") {
        const barW = Math.max(120, Math.min(220, drawWidth * 0.62));
        const barH = 8;
        const barX = centerX - barW / 2;
        const barY = ey + drawHeight + 8;
        const label = "Venom Spit";
        const fillW = Math.max(0, Math.min(barW, barW * windupProgress));
        ctx.save();
        ctx.fillStyle = "rgba(6, 16, 10, 0.88)";
        ctx.fillRect(barX, barY, barW, barH);
        const fill = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        fill.addColorStop(0, "rgba(157, 242, 123, 0.96)");
        fill.addColorStop(0.5, "rgba(93, 196, 98, 0.96)");
        fill.addColorStop(1, "rgba(56, 133, 67, 0.96)");
        ctx.fillStyle = fill;
        ctx.fillRect(barX, barY, fillW, barH);
        ctx.strokeStyle = "rgba(222, 255, 213, 0.85)";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "rgba(235, 255, 226, 0.95)";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, centerX, barY - 2);
        ctx.restore();
      }
    }

    drawEnemyHealthBar(ctx, enemy, ex, ey, drawWidth);
  }
}

function drawEnemyProjectiles(ctx, state, canvas, tileSize, shouldDrawProjectile = null) {
  const { currentAreaId, enemyProjectiles, cam } = state;
  if (!Array.isArray(enemyProjectiles) || enemyProjectiles.length === 0) return;

  for (const projectile of enemyProjectiles) {
    if (!projectile || projectile.areaId !== currentAreaId) continue;
    if (typeof shouldDrawProjectile === "function" && !shouldDrawProjectile(projectile)) continue;
    const radius = Number.isFinite(projectile.radius) ? Math.max(2, projectile.radius) : tileSize * 0.2;
    const px = projectile.x - cam.x;
    const py = projectile.y - cam.y;
    if (px + radius < 0 || py + radius < 0 || px - radius > canvas.width || py - radius > canvas.height) continue;

    const pulse = 0.5 + Math.sin((performance.now() + px * 0.2) * 0.02) * 0.5;
    if (String(projectile.projectileType || "") === "venomGlob") {
      const vx = Number.isFinite(projectile.vx) ? projectile.vx : 0;
      const vy = Number.isFinite(projectile.vy) ? projectile.vy : 0;
      const speed = Math.max(0.001, Math.hypot(vx, vy));
      const nx = vx / speed;
      const ny = vy / speed;
      const tx = -ny;
      const ty = nx;
      const tailLen = radius * (1.9 + pulse * 0.5);
      const tailX = px - nx * tailLen;
      const tailY = py - ny * tailLen;
      const smearW = Math.max(1, radius * 0.8);

      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(46, 122, 64, 0.72)";
      ctx.lineWidth = smearW;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      ctx.fillStyle = "rgba(73, 168, 92, 0.92)";
      ctx.beginPath();
      ctx.ellipse(px, py, radius * 0.95, radius * 0.82, Math.atan2(vy, vx), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(129, 208, 138, 0.4)";
      ctx.beginPath();
      ctx.ellipse(px - nx * radius * 0.16, py - ny * radius * 0.16, radius * 0.38, radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(22, 79, 42, 0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(px, py, radius * 0.95, radius * 0.82, Math.atan2(vy, vx), 0, Math.PI * 2);
      ctx.stroke();

      // Tiny deterministic drip particles for a more liquid-looking venom trail.
      const now = performance.now();
      const phase = now * 0.014 + px * 0.03 + py * 0.021;
      const dripCount = 3;
      for (let i = 0; i < dripCount; i++) {
        const t = (i + 1) / (dripCount + 0.3);
        const spineX = px - nx * (tailLen * (0.45 + t * 0.75));
        const spineY = py - ny * (tailLen * (0.45 + t * 0.75));
        const sway = Math.sin(phase + i * 1.37) * radius * (0.18 + t * 0.18);
        const dripX = spineX + tx * sway;
        const dripY = spineY + ty * sway;
        const dripR = Math.max(0.8, radius * (0.16 + (1 - t) * 0.1));

        ctx.fillStyle = "rgba(66, 153, 86, 0.68)";
        ctx.beginPath();
        ctx.arc(dripX, dripY, dripR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      continue;
    }

    const outer = radius * (2 + pulse * 0.6);
    const glow = ctx.createRadialGradient(px, py, radius * 0.2, px, py, outer);
    glow.addColorStop(0, "rgba(170, 255, 165, 0.95)");
    glow.addColorStop(0.6, "rgba(67, 196, 95, 0.5)");
    glow.addColorStop(1, "rgba(41, 112, 62, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, outer, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(120, 255, 134, 0.9)";
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(238, 255, 231, 0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, radius - 1), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPoisonPuddles(ctx, state, canvas, tileSize, shouldDrawPuddle = null) {
  const { currentTownId, currentAreaId, poisonPuddles, cam } = state;
  if (!Array.isArray(poisonPuddles) || poisonPuddles.length === 0) return;
  const now = performance.now();

  for (const puddle of poisonPuddles) {
    if (!puddle || puddle.townId !== currentTownId || puddle.areaId !== currentAreaId) continue;
    if (typeof shouldDrawPuddle === "function" && !shouldDrawPuddle(puddle)) continue;
    const expiresAt = Number.isFinite(puddle.expiresAt) ? puddle.expiresAt : now;
    if (now >= expiresAt) continue;
    const createdAt = Number.isFinite(puddle.createdAt) ? puddle.createdAt : now;
    const life = Math.max(1, expiresAt - createdAt);
    const t = Math.max(0, Math.min(1, (now - createdAt) / life));
    const fade = 1 - Math.max(0, Math.min(1, (now - (expiresAt - 1200)) / 1200));
    const px = (Number.isFinite(puddle.x) ? puddle.x : 0) - cam.x;
    const py = (Number.isFinite(puddle.y) ? puddle.y : 0) - cam.y;
    const baseR = Number.isFinite(puddle.radius) ? Math.max(5, puddle.radius) : tileSize * 0.6;
    const radius = baseR * (0.88 + Math.sin(now * 0.006 + px * 0.03) * 0.03);
    if (px + radius < 0 || py + radius < 0 || px - radius > canvas.width || py - radius > canvas.height) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    const pool = ctx.createRadialGradient(px - radius * 0.2, py - radius * 0.15, radius * 0.2, px, py, radius);
    pool.addColorStop(0, "rgba(96, 177, 105, 0.78)");
    pool.addColorStop(0.65, "rgba(58, 126, 71, 0.88)");
    pool.addColorStop(1, "rgba(36, 88, 49, 0.7)");
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(px, py, radius, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    const dripCount = 4;
    for (let i = 0; i < dripCount; i++) {
      const angle = (i / dripCount) * Math.PI * 2 + now * 0.0015;
      const dx = Math.cos(angle) * radius * (0.45 + (i % 2) * 0.24);
      const dy = Math.sin(angle) * radius * 0.26;
      const dripR = Math.max(1, radius * 0.11 - i * 0.12);
      ctx.fillStyle = "rgba(71, 152, 82, 0.72)";
      ctx.beginPath();
      ctx.arc(px + dx, py + dy, dripR, 0, Math.PI * 2);
      ctx.fill();
    }

    if (t < 0.35) {
      const splashPulse = 1 - t / 0.35;
      ctx.strokeStyle = `rgba(140, 214, 118, ${(0.42 * splashPulse).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(px, py, radius * (1.15 + splashPulse * 0.2), radius * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawLeftovers(ctx, state, canvas, tileSize, shouldDrawLeftover = null) {
  const { leftovers, currentTownId, currentAreaId, cam } = state;
  if (!Array.isArray(leftovers) || leftovers.length === 0) return;
  const leftoversSprite = state?.leftoversSprite;
  const hasSprite = Boolean(leftoversSprite && (leftoversSprite.width > 0 || leftoversSprite.naturalWidth > 0));

  for (const leftover of leftovers) {
    if (!leftover) continue;
    if (leftover.depleted) continue;
    const hasLoot = (Number(leftover.gold) > 0) || (Number(leftover.silver) > 0) || (Array.isArray(leftover.items) && leftover.items.length > 0);
    if (!hasLoot) continue;
    if (leftover.townId !== currentTownId || leftover.areaId !== currentAreaId) continue;
    if (typeof shouldDrawLeftover === "function" && !shouldDrawLeftover(leftover)) continue;

    const worldX = Number.isFinite(leftover.x) ? leftover.x : 0;
    const worldY = Number.isFinite(leftover.y) ? leftover.y : 0;
    const ex = Math.round(worldX - cam.x - tileSize * 0.34);
    const ey = Math.round(worldY - cam.y - tileSize * 0.2);
    const drawSize = Math.max(12, Math.round(tileSize * 0.58));
    if (ex > canvas.width || ey > canvas.height || ex < -drawSize || ey < -drawSize) continue;

    const pulse = 0.5 + Math.sin((performance.now() + worldX * 0.2) * 0.005) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(ex + drawSize * 0.5, ey + drawSize * 0.86, drawSize * 0.34, drawSize * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hasSprite) {
      ctx.globalAlpha = 0.94;
      ctx.drawImage(leftoversSprite, ex, ey, drawSize, drawSize);
    } else {
      ctx.fillStyle = "rgba(241, 233, 217, 0.95)";
      ctx.fillRect(ex + drawSize * 0.39, ey + drawSize * 0.42, drawSize * 0.22, drawSize * 0.3);
      ctx.fillRect(ex + drawSize * 0.28, ey + drawSize * 0.52, drawSize * 0.12, drawSize * 0.08);
      ctx.fillRect(ex + drawSize * 0.6, ey + drawSize * 0.52, drawSize * 0.12, drawSize * 0.08);
      ctx.fillRect(ex + drawSize * 0.42, ey + drawSize * 0.72, drawSize * 0.08, drawSize * 0.2);
      ctx.fillRect(ex + drawSize * 0.5, ey + drawSize * 0.72, drawSize * 0.08, drawSize * 0.2);

      ctx.beginPath();
      ctx.arc(ex + drawSize * 0.5, ey + drawSize * 0.25, drawSize * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(41, 34, 27, 0.82)";
      ctx.fillRect(ex + drawSize * 0.43, ey + drawSize * 0.22, 2, 2);
      ctx.fillRect(ex + drawSize * 0.55, ey + drawSize * 0.22, 2, 2);
    }

    const glowR = drawSize * (0.48 + pulse * 0.08);
    const glow = ctx.createRadialGradient(
      ex + drawSize * 0.5,
      ey + drawSize * 0.5,
      2,
      ex + drawSize * 0.5,
      ey + drawSize * 0.5,
      glowR
    );
    glow.addColorStop(0, "rgba(215, 255, 233, 0.14)");
    glow.addColorStop(1, "rgba(215, 255, 233, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(ex - 6, ey - 6, drawSize + 12, drawSize + 12);
    ctx.restore();
  }
}

function drawPlayerAttackReadability(ctx, state, tileSize) {
  const { player, cam } = state;
  if (!player || player.attackState !== "active") return;

  const now = performance.now();
  const attackEndsAt = Number.isFinite(player.attackActiveUntil) ? player.attackActiveUntil : now;
  const attackStartedAt = Number.isFinite(player.attackActiveAt) ? player.attackActiveAt : now - 1;
  const total = Math.max(1, attackEndsAt - attackStartedAt);
  const t = Math.max(0, Math.min(1, (now - attackStartedAt) / total));

  const cx = player.x - cam.x + tileSize * 0.5;
  const cy = player.y - cam.y + tileSize * 0.5;
  const radius = Number.isFinite(player.attackHitRadius) ? player.attackHitRadius : tileSize * 0.7;

  let facingAngle = Math.PI * 0.5;
  if (player.dir === "up") facingAngle = -Math.PI * 0.5;
  else if (player.dir === "left") facingAngle = Math.PI;
  else if (player.dir === "right") facingAngle = 0;

  const span = Math.PI * 0.62;
  const start = facingAngle - span;
  const end = facingAngle + span;
  ctx.fillStyle = `rgba(255, 228, 166, ${0.12 + (1 - t) * 0.16})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius + tileSize * 0.28, start, end);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 241, 204, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + tileSize * 0.12, start, end);
  ctx.stroke();
}

export function drawEntitiesLayer({
  ctx,
  state,
  canvas,
  tileSize,
  colors,
  getHandstandSprite,
  getEquippedTrainingHeadbandSprite,
  spriteFrameWidth,
  spriteFrameHeight,
  spriteFramesPerRow
}) {
  const owBubbleQueue = [];
  const playerFootY = (state?.player?.y || 0) + tileSize;
  const isBehindPlayer = (footY) => footY <= playerFootY;
  const isInFrontOfPlayer = (footY) => footY > playerFootY;

  drawNPCs(
    ctx,
    state,
    canvas,
    tileSize,
    colors,
    owBubbleQueue,
    (npc) => isBehindPlayer((Number.isFinite(npc?.y) ? npc.y : 0) + tileSize)
  );
  drawEnemies(
    ctx,
    state,
    canvas,
    tileSize,
    (enemy) => isBehindPlayer((Number.isFinite(enemy?.y) ? enemy.y : 0) + tileSize)
  );
  drawEnemyProjectiles(
    ctx,
    state,
    canvas,
    tileSize,
    (projectile) => isBehindPlayer((Number.isFinite(projectile?.y) ? projectile.y : 0) + tileSize * 0.6)
  );
  drawPoisonPuddles(
    ctx,
    state,
    canvas,
    tileSize,
    (puddle) => isBehindPlayer(Number.isFinite(puddle?.y) ? puddle.y : 0)
  );
  drawLeftovers(
    ctx,
    state,
    canvas,
    tileSize,
    (leftover) => isBehindPlayer(Number.isFinite(leftover?.y) ? leftover.y : 0)
  );
  drawPlayerAttackReadability(ctx, state, tileSize);
  drawPlayer(
    ctx,
    state,
    getHandstandSprite,
    getEquippedTrainingHeadbandSprite,
    tileSize,
    spriteFrameWidth,
    spriteFrameHeight,
    spriteFramesPerRow
  );
  drawNPCs(
    ctx,
    state,
    canvas,
    tileSize,
    colors,
    owBubbleQueue,
    (npc) => isInFrontOfPlayer((Number.isFinite(npc?.y) ? npc.y : 0) + tileSize)
  );
  drawEnemies(
    ctx,
    state,
    canvas,
    tileSize,
    (enemy) => isInFrontOfPlayer((Number.isFinite(enemy?.y) ? enemy.y : 0) + tileSize)
  );
  drawEnemyProjectiles(
    ctx,
    state,
    canvas,
    tileSize,
    (projectile) => isInFrontOfPlayer((Number.isFinite(projectile?.y) ? projectile.y : 0) + tileSize * 0.6)
  );
  drawPoisonPuddles(
    ctx,
    state,
    canvas,
    tileSize,
    (puddle) => isInFrontOfPlayer(Number.isFinite(puddle?.y) ? puddle.y : 0)
  );
  drawLeftovers(
    ctx,
    state,
    canvas,
    tileSize,
    (leftover) => isInFrontOfPlayer(Number.isFinite(leftover?.y) ? leftover.y : 0)
  );
  for (const bubble of owBubbleQueue) {
    drawNpcOwBubble(ctx, bubble.npc, bubble.drawX, bubble.drawY, bubble.drawWidth);
  }
}
