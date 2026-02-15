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
  - `DialogueSystem.js`
  - `GameController.js`
  - `InteractionSystem.js`
  - `MovementSystem.js`
  - `RenderSystem.js`
- `src/rendering/TileSystem.js`: Tile drawing strategies.
- `src/world/`: World content and world graph services.
  - `content.js`
  - `WorldService.js`
  - `validateContent.js`
  - `buildingRenderers.js`
  - `index.js`
- `src/WorldManager.js`: Compatibility export facade.

## Assets
- `assets/audio/`: `.wav` audio files.
- `assets/sprites/`: character and NPC sprites.

## Tests
- `tests/content-validation.test.mjs`: Content validation tests.

## Backups
- `backups/main.js.bak`
