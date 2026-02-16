# Project Structure

## Entry
- `town2.html`: Browser entry page.
- `main.js`: Thin root module that loads the app entry module.

## Source
- `src/app/main.js`: Game composition and startup wiring.
- `src/audio/AudioManager.js`: Music/SFX playback and fade logic.
- `src/core/`: Core shared modules.
  - `constants.js`
  - `InputManager.js`
  - `CollisionSystem.js`
  - `AssetManager.js`
- `src/game/`: Runtime gameplay systems.
  - `bootstrap.js`
  - `BarMinigameSystem.js`
  - `DialogueSystem.js`
  - `GameController.js`
  - `InteractionSystem.js`
  - `controller/`
    - `roamingNpcController.js`
    - `transientUiController.js`
  - `interaction/`
    - `contextUtils.js`
    - `doorSequence.js`
    - `interactionSearch.js`
    - `npcInteractions.js`
    - `trainingActions.js`
  - `MovementSystem.js`
  - `RenderSystem.js`
  - `features/`
    - `FeatureCoordinator.js`
    - `HousePourFeature.js`
    - `index.js`
    - `README.md`
- `src/rendering/TileSystem.js`: Tile drawing strategies.
- `src/world/`: World content and world graph services.
  - `content.js`
  - `WorldService.js`
  - `validateContent.js`
  - `buildingRenderers.js`
  - `buildings/`
    - `barRenderer.js`
    - `churchRenderer.js`
    - `dojoRenderer.js`
    - `fountainRenderer.js`
    - `penRenderer.js`
    - `rendererRegistry.js`
    - `simpleRenderers.js`
  - `runtime/`
    - `actorFactories.js`
    - `townBuilder.js`
  - `validation/`
    - `utils.js`
    - `validateAreas.js`
    - `validateDoors.js`
    - `validateEnemies.js`
    - `validateNpcs.js`
    - `validateSpawns.js`
  - `index.js`
- `src/WorldManager.js`: Compatibility export facade.

## Assets
- `assets/audio/`: `.wav` audio files.
- `assets/sprites/`: character and NPC sprites.

## Tests
- `tests/content-validation.test.mjs`: Content validation tests.
- `tests/feature-coordinator.test.mjs`: Feature plugin coordinator tests.
- `tests/world-service-npc-fields.test.mjs`: NPC custom-field passthrough tests.

## Backups
- `backups/main.js.bak`
