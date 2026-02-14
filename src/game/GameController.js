export function createGameController({
  world,
  movementSystem,
  collision,
  musicManager,
  state,
  dialogue,
  actions
}) {
  function syncMusicForCurrentArea() {
    if (state.getCurrentAreaType() === "overworld") {
      musicManager.stopCurrentMusic();
      return;
    }
    musicManager.playMusicForArea(state.getCurrentAreaType());
  }

  function setArea(areaType) {
    state.setCurrentAreaType(areaType);

    if (areaType === "overworld") {
      state.setCurrentMapContext({
        map: state.getCurrentTown().overworldMap,
        width: world.overworldW,
        height: world.overworldH
      });
    } else {
      const interior = state.getCurrentTown().interiorMaps[areaType];
      if (interior) {
        state.setCurrentMapContext({
          map: interior.map,
          width: world.interiorW,
          height: world.interiorH
        });
      }
    }

    syncMusicForCurrentArea();
  }

  function updatePlayerMovement() {
    movementSystem.updatePlayerMovement(
      {
        player: state.player,
        currentMap: state.getCurrentMap(),
        currentMapW: state.getCurrentMapW(),
        currentMapH: state.getCurrentMapH(),
        npcs: state.npcs,
        currentAreaType: state.getCurrentAreaType()
      },
      {
        collides: collision.collidesAt,
        collidesWithNPC: collision.collidesWithNPCAt,
        doorFromCollision: collision.detectDoorCollision,
        beginDoorSequence: actions.beginDoorSequence
      }
    );
  }

  function updateDoorEntry() {
    movementSystem.updateDoorEntry(
      { player: state.player, doorSequence: state.doorSequence },
      (nextState) => {
        state.setGameState(nextState);
      }
    );
  }

  function updateTransition() {
    movementSystem.updateTransition(
      { player: state.player, doorSequence: state.doorSequence },
      {
        setArea,
        setGameState: (nextState) => {
          state.setGameState(nextState);
        },
        getCurrentAreaType: state.getCurrentAreaType
      }
    );
  }

  function update() {
    const now = performance.now();

    if (
      state.trainingPopup.pendingLevelUpDialogueAt !== null &&
      now >= state.trainingPopup.pendingLevelUpDialogueAt &&
      !dialogue.isDialogueActive() &&
      !dialogue.isChoiceActive()
    ) {
      state.trainingPopup.pendingLevelUpDialogueAt = null;
      dialogue.showDialogue("", "Your discipline has grown! Level increased!");
    }

    if (state.trainingPopup.active) {
      const elapsed = now - state.trainingPopup.startedAt;
      if (elapsed >= state.trainingPopup.durationMs) {
        state.trainingPopup.active = false;
        state.trainingPopup.levelUp = false;
        state.player.isTraining = false;
      }
    }

    if (state.itemAlert.active && now - state.itemAlert.startedAt >= state.itemAlert.durationMs) {
      state.itemAlert.active = false;
    }

    if (state.inventoryHint.active && now - state.inventoryHint.startedAt >= state.inventoryHint.durationMs) {
      state.inventoryHint.active = false;
    }

    const gameState = state.getGameState();
    const freeState = gameState === "overworld" || gameState === "interior";

    if (freeState && !dialogue.isDialogueActive()) {
      if (!state.player.isTraining) {
        updatePlayerMovement();
      }
    } else if (dialogue.isDialogueActive()) {
      state.player.walking = false;
    } else if (gameState === "enteringDoor") {
      updateDoorEntry();
    } else if (gameState === "transition") {
      updateTransition();
    }

    if (state.getGameState() !== "transition") {
      actions.handleInteraction();
    }

    movementSystem.updatePlayerAnimation(state.player);
    movementSystem.updateCamera({
      cam: state.cam,
      player: state.player,
      currentMapW: state.getCurrentMapW(),
      currentMapH: state.getCurrentMapH(),
      canvas: state.canvas
    });
  }

  return {
    setArea,
    syncMusicForCurrentArea,
    update
  };
}
