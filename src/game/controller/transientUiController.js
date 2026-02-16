export function createTransientUiUpdater({ state, dialogue, levelUpMessage }) {
  function updateTransientUi(now) {
    if (
      state.trainingPopup.pendingLevelUpDialogueAt !== null &&
      now >= state.trainingPopup.pendingLevelUpDialogueAt &&
      !dialogue.isDialogueActive() &&
      !dialogue.isChoiceActive()
    ) {
      state.trainingPopup.pendingLevelUpDialogueAt = null;
      dialogue.showDialogue("", levelUpMessage);
    }

    if (state.trainingPopup.active && now - state.trainingPopup.startedAt >= state.trainingPopup.durationMs) {
      state.trainingPopup.active = false;
      state.trainingPopup.levelUp = false;
      state.player.isTraining = false;
    }

    if (state.itemAlert.active && now - state.itemAlert.startedAt >= state.itemAlert.durationMs) {
      state.itemAlert.active = false;
    }

    if (state.inventoryHint.active && now - state.inventoryHint.startedAt >= state.inventoryHint.durationMs) {
      state.inventoryHint.active = false;
    }
  }

  return { updateTransientUi };
}
