export function createFeatureCoordinator({ features = [] } = {}) {
  const activeFeatures = features.filter(Boolean);

  function getFeaturesForState(gameState) {
    return activeFeatures.filter((feature) => {
      if (typeof feature.isInGameState !== "function") return false;
      return feature.isInGameState(gameState);
    });
  }

  function getPrimaryFeatureForState(gameState) {
    const handlers = getFeaturesForState(gameState);
    return handlers.length > 0 ? handlers[0] : null;
  }

  function tryHandleNPCInteraction(npc) {
    for (const feature of activeFeatures) {
      if (typeof feature.tryHandleNPCInteraction !== "function") continue;
      if (feature.tryHandleNPCInteraction(npc)) {
        return true;
      }
    }
    return false;
  }

  function handlesGameState(gameState) {
    return Boolean(getPrimaryFeatureForState(gameState));
  }

  function handleStateInteract(gameState) {
    const feature = getPrimaryFeatureForState(gameState);
    if (!feature) return false;

    if (typeof feature.handleInteract === "function") {
      feature.handleInteract();
    }
    return true;
  }

  function updateForState(gameState) {
    const feature = getPrimaryFeatureForState(gameState);
    if (!feature) return false;

    if (typeof feature.update === "function") {
      feature.update();
    }
    return true;
  }

  function renderOverlays({ ctx, canvas, colors, ui, state }) {
    const feature = getPrimaryFeatureForState(state.gameState);
    if (!feature) return;

    if (typeof feature.renderOverlay === "function") {
      feature.renderOverlay({
        ctx,
        canvas,
        colors,
        ui,
        state,
        gameState: state.gameState
      });
    }
  }

  return {
    tryHandleNPCInteraction,
    handlesGameState,
    handleStateInteract,
    updateForState,
    renderOverlays
  };
}
