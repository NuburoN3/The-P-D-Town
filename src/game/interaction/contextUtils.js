export function playerTilePosition(player, tileSize) {
  return {
    x: Math.floor((player.x + tileSize / 2) / tileSize),
    y: Math.floor((player.y + tileSize / 2) / tileSize)
  };
}

export function getTownProgress(gameFlags, townId) {
  if (!gameFlags.townProgress[townId]) {
    gameFlags.townProgress[townId] = {
      enduranceUnlocked: false,
      membershipAwarded: false,
      challengeKills: 0,
      challengeTarget: 3,
      challengeCompleteAnnounced: false,
      challengePrepared: false
    };
  }
  return gameFlags.townProgress[townId];
}
