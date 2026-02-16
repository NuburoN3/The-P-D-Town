import { AREA_KINDS, GAME_STATES, isFreeExploreState } from "../core/constants.js";

export function createInteractionSystem({
  tileSize,
  ui,
  training,
  canvas,
  gameFlags,
  playerInventory,
  playerStats,
  trainingPopup,
  itemAlert,
  inventoryHint,
  player,
  npcs,
  doorSequence,
  musicManager,
  worldService,
  trainingContent,
  getCurrentTownId,
  getCurrentAreaId,
  getCurrentAreaKind,
  getCurrentMap,
  getCurrentMapW,
  getCurrentMapH,
  getGameState,
  setGameState,
  getPreviousWorldState,
  setPreviousWorldState,
  isDialogueActive,
  choiceState,
  showDialogue,
  openYesNoChoice,
  advanceDialogue,
  getInteractPressed,
  clearInteractPressed,
  spawnVisualEffect = () => {},
  handleFeatureNPCInteraction = () => false,
  handleFeatureStateInteraction = () => false
}) {
  function playerTilePosition() {
    return {
      x: Math.floor((player.x + tileSize / 2) / tileSize),
      y: Math.floor((player.y + tileSize / 2) / tileSize)
    };
  }

  function tryTrainingAction() {
    const gameState = getGameState();
    if (!isFreeExploreState(gameState)) return;
    if (isDialogueActive() || choiceState.active || doorSequence.active) return;
    if (getCurrentAreaKind() === AREA_KINDS.OVERWORLD) return;
    if (!gameFlags.acceptedTraining) return;

    const currentTownId = getCurrentTownId();
    const currentAreaId = getCurrentAreaId();
    const trainingTile = worldService.getTrainingTile(currentTownId, currentAreaId);
    if (!trainingTile) return;

    const tilePos = playerTilePosition();
    const onTrainingTile = tilePos.x === trainingTile.x && tilePos.y === trainingTile.y;
    if (!onTrainingTile) return;

    if (gameFlags.acceptedTraining && !gameFlags.completedTraining) {
      if (!isDialogueActive()) {
        showDialogue("", "Mr. Hanami's challenge is upstairs. Defeat three opponents.");
      }
      return;
    }

    if (gameFlags.completedTraining && !gameFlags.hanamiEnduranceUnlocked) {
      if (!isDialogueActive()) {
        showDialogue("", trainingContent.enduranceLockedPrompt);
      }
      return;
    }

    if (playerStats.disciplineLevel >= 2) {
      if (!isDialogueActive()) {
        showDialogue("", trainingContent.completedPrompt);
      }
      return;
    }

    if (trainingPopup.active) return;

    const startXP = playerStats.disciplineXP;
    const xpEarned = training.XP_PER_SESSION;
    trainingPopup.xpNeededSnapshot = playerStats.disciplineXPNeeded;

    playerStats.disciplineXP += xpEarned;
    trainingPopup.startXP = startXP;
    trainingPopup.targetXP = playerStats.disciplineXP;
    trainingPopup.xpGained = xpEarned;
    trainingPopup.levelUp = false;
    trainingPopup.pendingLevelUpDialogueAt = null;
    trainingPopup.active = true;
    trainingPopup.startedAt = performance.now();

    player.isTraining = true;
    player.handstandAnimTimer = 0;
    player.handstandFrame = 0;
    player.walking = false;
    spawnVisualEffect("trainingBurst", {
      x: player.x + tileSize / 2,
      y: player.y + tileSize * 0.35,
      size: 38
    });

    if (playerStats.disciplineXP >= playerStats.disciplineXPNeeded) {
      trainingPopup.levelUp = true;
      trainingPopup.pendingLevelUpDialogueAt = trainingPopup.startedAt + trainingPopup.animDurationMs;
      playerStats.disciplineLevel += 1;
      if (!gameFlags.completedTraining && playerStats.disciplineLevel >= 2) {
        gameFlags.completedTraining = true;
      }
      playerStats.disciplineXP = 0;
      playerStats.disciplineXPNeeded += training.XP_INCREMENT;
    }
  }

  function toggleInventory() {
    const gameState = getGameState();
    if (gameState === GAME_STATES.INVENTORY) {
      const previousState = getPreviousWorldState();
      setGameState(previousState);
      if (isFreeExploreState(previousState) && musicManager && typeof musicManager.resumeFromPauseMenu === "function") {
        musicManager.resumeFromPauseMenu();
      }
      clearInteractPressed();
      return;
    }

    if (!isFreeExploreState(gameState)) return;
    if (isDialogueActive() || choiceState.active || doorSequence.active) return;

    setPreviousWorldState(gameState);
    setGameState(GAME_STATES.INVENTORY);
    clearInteractPressed();
  }

  function handleNPCInteraction(npc) {
    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;
    spawnVisualEffect("interactionPulse", {
      x: playerCenterX,
      y: playerCenterY - tileSize * 0.2,
      size: 22
    });

    if (handleFeatureNPCInteraction(npc)) {
      return;
    }

    if (!npc.hasTrainingChoice) {
      showDialogue(npc.name, npc.dialogue);
      return;
    }

    if (gameFlags.completedTraining) {
      const enduranceChallengeComplete = gameFlags.hanamiEnduranceUnlocked && playerStats.disciplineLevel >= 2;
      if (enduranceChallengeComplete) {
        if (!gameFlags.hanamiMembershipAwarded) {
          showDialogue(npc.name, [
            trainingContent.enduranceCompleteDialogue,
            trainingContent.membershipCardGiveDialogue
          ], () => {
            gameFlags.hanamiMembershipAwarded = true;
            if (!playerInventory[trainingContent.membershipCardItemName]) {
              playerInventory[trainingContent.membershipCardItemName] = 1;
            }

            itemAlert.active = true;
            itemAlert.text = trainingContent.membershipCardUnlockMessage;
            itemAlert.startedAt = performance.now();
            inventoryHint.active = true;
            inventoryHint.startedAt = performance.now();
            spawnVisualEffect("pickupGlow", {
              x: player.x + tileSize / 2,
              y: player.y + tileSize * 0.4,
              size: 32
            });
            try {
              musicManager.playSfx("itemUnlock");
            } catch (_) {}
          });
          return;
        }

        showDialogue(npc.name, trainingContent.enduranceCompleteDialogue);
        return;
      }

      if (gameFlags.hanamiEnduranceUnlocked) {
        showDialogue(npc.name, trainingContent.enduranceInProgressDialogue);
        return;
      }

      showDialogue(npc.name, trainingContent.postCompleteDialogue, () => {
        showDialogue(npc.name, trainingContent.nextChallengeQuestion, () => {
          openYesNoChoice((selectedOption) => {
            if (selectedOption === "Yes") {
              gameFlags.hanamiEnduranceUnlocked = true;
              showDialogue(npc.name, trainingContent.enduranceAcceptedDialogue);
            } else {
              showDialogue(npc.name, trainingContent.declineDialogue);
            }
          });
        });
      });
      return;
    }

    if (gameFlags.acceptedTraining) {
      const kills = Number.isFinite(gameFlags.hanamiChallengeKills) ? gameFlags.hanamiChallengeKills : 0;
      const target = Number.isFinite(gameFlags.hanamiChallengeTarget) ? gameFlags.hanamiChallengeTarget : 3;
      showDialogue(npc.name, [
        trainingContent.acceptedDialogue,
        `Challenge progress: ${kills}/${target}.`
      ]);
      return;
    }

    showDialogue(npc.name, npc.dialogue, () => {
      openYesNoChoice((selectedOption) => {
        if (selectedOption === "Yes") {
          gameFlags.acceptedTraining = true;
          gameFlags.hanamiChallengeKills = 0;
          gameFlags.hanamiChallengeTarget = 3;
          gameFlags.hanamiChallengeCompleteAnnounced = false;
          gameFlags.hanamiChallengePrepared = false;

          if (!playerInventory[trainingContent.itemName]) {
            playerInventory[trainingContent.itemName] = 1;
            itemAlert.active = true;
            itemAlert.text = trainingContent.itemUnlockMessage;
            itemAlert.startedAt = performance.now();
            inventoryHint.active = true;
            inventoryHint.startedAt = performance.now();
            spawnVisualEffect("pickupGlow", {
              x: player.x + tileSize / 2,
              y: player.y + tileSize * 0.4,
              size: 32
            });
            try {
              musicManager.playSfx("itemUnlock");
            } catch (_) {}
          }

          showDialogue(npc.name, trainingContent.itemReceivedMessage);
        } else {
          showDialogue(npc.name, trainingContent.declineDialogue);
        }
      });
    });
  }

  function beginDoorSequence(doorTile) {
    const gameState = getGameState();
    if (gameState === GAME_STATES.ENTERING_DOOR || gameState === GAME_STATES.TRANSITION) return;

    const destination = worldService.resolveDoorDestination(
      getCurrentTownId(),
      getCurrentAreaId(),
      doorTile.tx,
      doorTile.ty
    );
    if (!destination) return;

    musicManager.playSfx("enterDoor");

    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;
    const doorCenterX = doorTile.tx * tileSize + tileSize / 2;
    const doorCenterY = doorTile.ty * tileSize + tileSize / 2;

    let vx = doorCenterX - playerCenterX;
    let vy = doorCenterY - playerCenterY;
    const len = Math.hypot(vx, vy) || 1;
    vx /= len;
    vy /= len;

    doorSequence.active = true;
    doorSequence.tx = doorTile.tx;
    doorSequence.ty = doorTile.ty;
    doorSequence.stepDx = vx * 1.5;
    doorSequence.stepDy = vy * 1.5;
    doorSequence.stepFrames = 20;
    doorSequence.frame = 0;
    doorSequence.targetTownId = destination.townId;
    doorSequence.targetAreaId = destination.areaId;
    doorSequence.targetX = destination.x;
    doorSequence.targetY = destination.y;
    doorSequence.targetDir = destination.dir || "down";
    doorSequence.maxFadeRadius = Math.hypot(canvas.width, canvas.height);
    doorSequence.fadeRadius = 0;
    doorSequence.transitionPhase = "out";
    spawnVisualEffect("doorSwirl", {
      x: doorCenterX,
      y: doorCenterY,
      size: 34
    });

    setGameState(GAME_STATES.ENTERING_DOOR);
    clearInteractPressed();
  }

  function handleInteraction() {
    const gameState = getGameState();

    if (handleFeatureStateInteraction(gameState)) {
      return;
    }

    if (
      gameState === GAME_STATES.TITLE_SCREEN ||
      gameState === GAME_STATES.INVENTORY ||
      gameState === GAME_STATES.PAUSE_MENU ||
      gameState === GAME_STATES.SETTINGS ||
      gameState === GAME_STATES.ATTRIBUTES
    ) {
      clearInteractPressed();
      return;
    }

    if (!getInteractPressed()) return;

    if (isDialogueActive()) {
      advanceDialogue();
      clearInteractPressed();
      return;
    }

    if (gameState === GAME_STATES.ENTERING_DOOR || gameState === GAME_STATES.TRANSITION) {
      clearInteractPressed();
      return;
    }

    const currentAreaId = getCurrentAreaId();
    const currentMap = getCurrentMap();
    const currentMapW = getCurrentMapW();
    const currentMapH = getCurrentMapH();

    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;

    let closestNpc = null;
    let closestNpcDistance = Number.POSITIVE_INFINITY;

    for (const npc of npcs) {
      if (npc.world !== currentAreaId) continue;

      const npcCenterX = npc.x + npc.width / 2;
      const npcCenterY = npc.y + npc.height / 2;
      const dx = Math.abs(playerCenterX - npcCenterX);
      const dy = Math.abs(playerCenterY - npcCenterY);
      const bartenderReachBonus = npc.id === "mikaBartender" ? ui.INTERACT_REACH : 0;
      const reachX = ui.INTERACT_REACH;
      const reachY = ui.INTERACT_REACH + bartenderReachBonus;

      if (dx <= reachX && dy <= reachY) {
        const distance = Math.hypot(playerCenterX - npcCenterX, playerCenterY - npcCenterY);
        if (distance < closestNpcDistance) {
          closestNpc = npc;
          closestNpcDistance = distance;
        }
      }
    }

    if (closestNpc) {
      const npcCenterX = closestNpc.x + closestNpc.width / 2;
      const npcCenterY = closestNpc.y + closestNpc.height / 2;
      const relativeX = playerCenterX - npcCenterX;
      const relativeY = playerCenterY - npcCenterY;

      if (Math.abs(relativeX) >= Math.abs(relativeY)) {
        closestNpc.dir = relativeX < 0 ? "left" : "right";
      } else {
        closestNpc.dir = relativeY < 0 ? "up" : "down";
      }

      handleNPCInteraction(closestNpc);
      clearInteractPressed();
      return;
    }

    const inset = 5;
    const left = Math.floor((player.x + inset) / tileSize) - 1;
    const right = Math.floor((player.x + tileSize - inset) / tileSize) + 1;
    const top = Math.floor((player.y + inset) / tileSize) - 1;
    const bottom = Math.floor((player.y + tileSize - inset) / tileSize) + 1;
    const currentTownId = getCurrentTownId();

    for (let ty = top; ty <= bottom; ty++) {
      if (ty < 0 || ty >= currentMapH) continue;
      for (let tx = left; tx <= right; tx++) {
        if (tx < 0 || tx >= currentMapW) continue;
        if (!currentMap[ty]) continue;

        const signpostText = worldService.getSignpostText(currentTownId, currentAreaId, tx, ty);
        if (signpostText) {
          spawnVisualEffect("interactionPulse", {
            x: tx * tileSize + tileSize / 2,
            y: ty * tileSize + tileSize / 2,
            size: 18
          });
          showDialogue("", signpostText);
          clearInteractPressed();
          return;
        }
      }
    }

    if (getCurrentAreaKind() !== AREA_KINDS.OVERWORLD && gameFlags.acceptedTraining) {
      const trainingTile = worldService.getTrainingTile(currentTownId, currentAreaId);
      if (trainingTile) {
        const tilePos = playerTilePosition();
        const onTrainingTile = tilePos.x === trainingTile.x && tilePos.y === trainingTile.y;
        if (onTrainingTile) {
          tryTrainingAction();
          clearInteractPressed();
          return;
        }
      }
    }

    clearInteractPressed();
  }

  return {
    playerTilePosition,
    tryTrainingAction,
    toggleInventory,
    handleNPCInteraction,
    beginDoorSequence,
    handleInteraction
  };
}
