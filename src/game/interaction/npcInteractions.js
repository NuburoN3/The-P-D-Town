export function createNPCInteractionHandler({
  tileSize,
  gameFlags,
  playerInventory,
  playerStats,
  itemAlert,
  inventoryHint,
  player,
  trainingContent,
  musicManager,
  showDialogue,
  openYesNoChoice,
  spawnVisualEffect,
  getTownProgress,
  handleFeatureNPCInteraction
}) {
  return function handleNPCInteraction(npc) {
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
      const tp = getTownProgress();
      const enduranceChallengeComplete = tp.enduranceUnlocked && playerStats.disciplineLevel >= 2;
      if (enduranceChallengeComplete) {
        if (!tp.membershipAwarded) {
          showDialogue(npc.name, [
            trainingContent.enduranceCompleteDialogue,
            trainingContent.membershipCardGiveDialogue
          ], () => {
            tp.membershipAwarded = true;
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
            } catch (_) { }
          });
          return;
        }

        showDialogue(npc.name, trainingContent.enduranceCompleteDialogue);
        return;
      }

      if (tp.enduranceUnlocked) {
        showDialogue(npc.name, trainingContent.enduranceInProgressDialogue);
        return;
      }

      showDialogue(npc.name, trainingContent.postCompleteDialogue, () => {
        showDialogue(npc.name, trainingContent.nextChallengeQuestion, () => {
          openYesNoChoice((selectedOption) => {
            if (selectedOption === "Yes") {
              tp.enduranceUnlocked = true;
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
      const tp = getTownProgress();
      const kills = Number.isFinite(tp.challengeKills) ? tp.challengeKills : 0;
      const target = Number.isFinite(tp.challengeTarget) ? tp.challengeTarget : 3;
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
          const tp = getTownProgress();
          tp.challengeKills = 0;
          tp.challengeTarget = 3;
          tp.challengeCompleteAnnounced = false;
          tp.challengePrepared = false;

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
            } catch (_) { }
          }

          showDialogue(npc.name, trainingContent.itemReceivedMessage);
        } else {
          showDialogue(npc.name, trainingContent.declineDialogue);
        }
      });
    });
  };
}
