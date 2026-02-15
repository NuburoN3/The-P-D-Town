import { createHousePourFeature } from "./HousePourFeature.js";

export function createGameFeatures({
  getCurrentAreaKind,
  setGameState,
  showDialogue,
  openYesNoChoice,
  closeDialogue
}) {
  return [
    createHousePourFeature({
      getCurrentAreaKind,
      setGameState,
      showDialogue,
      openYesNoChoice,
      closeDialogue
    })
  ];
}
