import { normalizeGlobalStoryFlags, normalizeTownProgress } from "../progression/progressDefaults.js";

const FALLBACK_RUMOR_CLUE_GROUPS = Object.freeze([
  {
    key: "rumorCluePiazza",
    npcIds: ["cloudWatcherMina", "cloudWatcherJun", "piazzaKeiko", "piazzaDaichi"],
    lines: [
      "Piazza witnesses confirm the northern sky changed abruptly.",
      "This was a sudden shift, not a slow weather pattern."
    ]
  },
  {
    key: "rumorClueChapel",
    npcIds: ["priestMiki", "chapelSisterAgnes", "kyokaiAcolyteMara"],
    lines: [
      "Chapel witnesses confirm unusual bell timing that same night.",
      "The disturbance followed a clear sequence, not random panic."
    ]
  },
  {
    key: "rumorClueBar",
    npcIds: ["barGuestTomo", "mikaBartender", "barPatronRiku", "barPatronAya", "barPatronKenji"],
    lines: [
      "Bar regulars report the same north-road courier timeline.",
      "Independent witnesses now align on the order of events."
    ]
  }
]);

function getRumorCluesFound(tp) {
  return Number(tp.rumorCluePiazza) + Number(tp.rumorClueChapel) + Number(tp.rumorClueBar);
}

function getBogQuestTarget(tp, trainingContent) {
  if (Number.isFinite(tp?.bogQuestTarget) && tp.bogQuestTarget > 0) {
    return Math.max(1, Math.round(tp.bogQuestTarget));
  }
  if (Number.isFinite(trainingContent?.bogQuest?.targetKills)) {
    return Math.max(1, Math.round(trainingContent.bogQuest.targetKills));
  }
  return 3;
}

function formatBogProgressText(tp, trainingContent) {
  const target = getBogQuestTarget(tp, trainingContent);
  const kills = Number.isFinite(tp?.bogQuestKills) ? tp.bogQuestKills : 0;
  const template = typeof trainingContent?.bogQuest?.progressTemplate === "string"
    ? trainingContent.bogQuest.progressTemplate
    : "Bog trial progress: {kills}/{target}.";
  return template
    .replace("{kills}", String(Math.max(0, Math.min(target, kills))))
    .replace("{target}", String(target));
}

function resolveRumorClueGroups(trainingContent) {
  const groups = Array.isArray(trainingContent?.rumorQuest?.clueGroups)
    ? trainingContent.rumorQuest.clueGroups
    : FALLBACK_RUMOR_CLUE_GROUPS;
  return groups.filter((group) =>
    group &&
    typeof group.key === "string" &&
    Array.isArray(group.npcIds) &&
    Array.isArray(group.lines)
  );
}

function getNextRequiredRumorClueGroup(tp, clueGroups) {
  return clueGroups.find((group) => !tp[group.key]) || null;
}

function getRumorLeadLabel(clueKey) {
  if (clueKey === "rumorCluePiazza") return "piazza";
  if (clueKey === "rumorClueChapel") return "chapel";
  if (clueKey === "rumorClueBar") return "bar";
  return "next witness";
}

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
  handleFeatureNPCInteraction,
  syncObjectiveState = () => { }
}) {
  function normalizeProgressState(tp) {
    normalizeGlobalStoryFlags(gameFlags);
    const normalized = normalizeTownProgress(tp);
    if (tp && typeof tp === "object") {
      Object.assign(tp, normalized);
      tp.bogQuestTarget = getBogQuestTarget(tp, trainingContent);
      tp.bogQuestKills = Math.max(0, Math.min(tp.bogQuestTarget, tp.bogQuestKills));
      const rumorClues = getRumorCluesFound(tp);
      if (rumorClues >= 3) tp.rumorQuestCompleted = true;
      if (tp.rumorQuestReported) {
        tp.rumorQuestCompleted = true;
        tp.rumorQuestActive = false;
        tp.enduranceUnlocked = true;
      }
      if (gameFlags.completedTraining && tp.rumorQuestOffered && !tp.rumorQuestCompleted && !tp.rumorQuestActive) {
        tp.rumorQuestActive = true;
      }
      return tp;
    }
    normalized.bogQuestTarget = getBogQuestTarget(normalized, trainingContent);
    normalized.bogQuestKills = Math.max(0, Math.min(normalized.bogQuestTarget, normalized.bogQuestKills));
    const rumorClues = getRumorCluesFound(normalized);
    if (rumorClues >= 3) normalized.rumorQuestCompleted = true;
    if (normalized.rumorQuestReported) {
      normalized.rumorQuestCompleted = true;
      normalized.rumorQuestActive = false;
      normalized.enduranceUnlocked = true;
    }
    if (gameFlags.completedTraining && normalized.rumorQuestOffered && !normalized.rumorQuestCompleted && !normalized.rumorQuestActive) {
      normalized.rumorQuestActive = true;
    }
    return normalized;
  }

  function getContextualDialogue(npc, tp) {
    switch (npc.id) {
      case "cloudWatcherMina":
        if (gameFlags.townRumorResolved) {
          return [
            "The town finally sounds calmer tonight.",
            "Thanks for helping us sort facts from panic."
          ];
        }
        if (tp.rumorQuestActive && !tp.rumorQuestCompleted) {
          return [
            "I saw the ridge darken before sunset, then the lantern line flickered.",
            "Tell Mr. Hanami the change was sudden, not gradual."
          ];
        }
        return [
          "The northern ridge changed all at once.",
          "People panic when nobody compares notes."
        ];

      case "priestMiki":
        if (gameFlags.townRumorResolved) {
          return [
            "You did good work gathering witnesses.",
            "Discipline means checking truth before fear."
          ];
        }
        if (tp.rumorQuestActive && !tp.rumorQuestCompleted) {
          return [
            "Our bells rang off rhythm the same night Taiko vanished.",
            "Write that down. Timing matters."
          ];
        }
        return [
          "The stained glass still catches light, even under a dim sky.",
          "That is enough reason to keep faith."
        ];

      case "barGuestTomo":
        if (gameFlags.townRumorResolved) {
          return [
            "Funny, the room is quieter now that everyone compared stories.",
            "Rumors shrink when people speak plainly."
          ];
        }
        if (tp.rumorQuestActive && !tp.rumorQuestCompleted) {
          return [
            "Storm chatter started after a courier came from the north road.",
            "Mika heard the same timing from two travelers."
          ];
        }
        return [
          "Fear spreads faster than weather in a crowded room.",
          "That's why we talk details, not guesses."
        ];

      case "northGuardCaptainSora":
        if (gameFlags.townRumorResolved) {
          return [
            "Your report helped us reset watch rotations.",
            "The gate stays shut, but we're not blind anymore."
          ];
        }
        return npc.dialogue;

      case "northGuardGoofTama":
        if (gameFlags.townRumorResolved) {
          return [
            "Captain says things are finally organized again.",
            "Still no mountain trips, though."
          ];
        }
        return npc.dialogue;

      default:
        return npc.dialogue;
    }
  }

  function tryCollectRumorClue(npc, tp) {
    if (!tp.rumorQuestActive || tp.rumorQuestCompleted) return null;
    const clueGroups = resolveRumorClueGroups(trainingContent);
    const clue = clueGroups.find((group) => group.npcIds.includes(npc.id));
    if (!clue) return null;
    if (tp[clue.key]) return null;

    const nextRequiredClue = getNextRequiredRumorClueGroup(tp, clueGroups);
    if (nextRequiredClue && clue.key !== nextRequiredClue.key) {
      const nextLead = getRumorLeadLabel(nextRequiredClue.key);
      return [
        `Mr. Hanami wants this in order. Check the ${nextLead} lead first.`,
        "Route order: piazza, then chapel, then bar."
      ];
    }

    tp[clue.key] = true;
    const found = getRumorCluesFound(tp);
    if (found >= 3) {
      tp.rumorQuestCompleted = true;
    }

    itemAlert.active = true;
    itemAlert.text = found >= 3
      ? "All rumor leads gathered. Report back to Mr. Hanami."
      : `Rumor lead gathered (${found}/3).`;
    itemAlert.startedAt = performance.now();

    spawnVisualEffect("interactionPulse", {
      x: player.x + tileSize / 2,
      y: player.y + tileSize * 0.25,
      size: 24
    });

    if (found >= 3) {
      return [
        ...clue.lines,
        "That completes your witness report. Mr. Hanami should see this."
      ];
    }
    return clue.lines;
  }

  function maybeAwardMembershipCard(tp, npcName) {
    const nextTp = normalizeProgressState(getTownProgress());
    nextTp.membershipAwarded = true;
    syncObjectiveState();

    showDialogue(npcName, [
      trainingContent.enduranceCompleteDialogue,
      trainingContent.membershipCardGiveDialogue
    ], () => {
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

      // Story beat: after awarding the dojo card, Hanami departs the dojo.
      gameFlags.hanamiDojoExitPending = true;
      gameFlags.hanamiLeftDojo = false;
    });
  }

  function startInvestigationRoute(npcName) {
    const nextTp = normalizeProgressState(getTownProgress());
    nextTp.rumorQuestOffered = true;
    nextTp.rumorQuestActive = true;
    nextTp.rumorQuestCompleted = false;
    nextTp.rumorQuestReported = false;
    gameFlags.taikoHouseUnlocked = true;
    itemAlert.active = true;
    itemAlert.text = "Investigation started. Follow leads: piazza -> chapel -> bar.";
    itemAlert.startedAt = performance.now();

    showDialogue(npcName, [
      "Before your next lesson, gather three witness accounts for me.",
      "You will do this in order: piazza, then chapel, then bar.",
      "Return only after all three reports are confirmed."
    ]);
    syncObjectiveState();
  }

  function handleBoglandHanamiInteraction(npc, tp) {
    if (!tp.membershipAwarded) {
      showDialogue(npc.name, [
        "You are early.",
        "Earn your membership card in the dojo, then meet me again in this swamp."
      ]);
      return;
    }

    if (!tp.bogQuestOffered) {
      tp.bogQuestOffered = true;
      tp.bogQuestActive = false;
      tp.bogQuestCompleted = false;
      tp.bogQuestReported = false;
      tp.bogQuestTarget = getBogQuestTarget(tp, trainingContent);
      tp.bogQuestKills = 0;

      const promptLines = Array.isArray(trainingContent?.bogQuest?.startPromptLines)
        ? trainingContent.bogQuest.startPromptLines
        : [
          "Welcome to Bogland. Here, discipline rots unless you hold your center.",
          "Will you clear three corrupted bog stalkers?"
        ];

      showDialogue(npc.name, promptLines, () => {
        openYesNoChoice((selectedOption) => {
          if (selectedOption === "Yes") {
            tp.bogQuestActive = true;
            const acceptedLines = Array.isArray(trainingContent?.bogQuest?.acceptedLines)
              ? trainingContent.bogQuest.acceptedLines
              : ["Good. Clear the bog stalkers, then return to me."];
            showDialogue(npc.name, acceptedLines);
            syncObjectiveState();
          } else {
            const declinedLines = Array.isArray(trainingContent?.bogQuest?.declinedLines)
              ? trainingContent.bogQuest.declinedLines
              : [trainingContent.declineDialogue || "Come speak to me when you are ready."];
            showDialogue(npc.name, declinedLines);
          }
        });
      });
      return;
    }

    if (tp.bogQuestCompleted && !tp.bogQuestReported) {
      tp.bogQuestReported = true;
      tp.bogQuestActive = false;
      itemAlert.active = true;
      itemAlert.text = trainingContent?.bogQuest?.completeNotice || "Bog trial complete. Report accepted.";
      itemAlert.startedAt = performance.now();
      const reportLines = Array.isArray(trainingContent?.bogQuest?.reportLines)
        ? trainingContent.bogQuest.reportLines
        : [
          "Well done. You held your discipline in Bogland.",
          "Return to town and keep preparing."
        ];
      showDialogue(npc.name, reportLines);
      return;
    }

    if (tp.bogQuestActive && !tp.bogQuestCompleted) {
      showDialogue(npc.name, [formatBogProgressText(tp, trainingContent)]);
      return;
    }

    if (!tp.bogQuestActive && !tp.bogQuestCompleted) {
      showDialogue(npc.name, ["Are you ready to begin the Bogland trial now?"], () => {
        openYesNoChoice((selectedOption) => {
          if (selectedOption === "Yes") {
            tp.bogQuestActive = true;
            showDialogue(
              npc.name,
              Array.isArray(trainingContent?.bogQuest?.acceptedLines)
                ? trainingContent.bogQuest.acceptedLines
                : ["Good. Clear the bog stalkers, then return to me."]
            );
            syncObjectiveState();
          } else {
            showDialogue(
              npc.name,
              Array.isArray(trainingContent?.bogQuest?.declinedLines)
                ? trainingContent.bogQuest.declinedLines
                : ["Observe the swamp, then return when ready."]
            );
          }
        });
      });
      return;
    }

    showDialogue(
      npc.name,
      Array.isArray(trainingContent?.bogQuest?.repeatLines)
        ? trainingContent.bogQuest.repeatLines
        : ["Your Bogland trial is complete. Continue your training."]
    );
  }

  return function handleNPCInteraction(npc) {
    const playerCenterX = player.x + tileSize / 2;
    const playerCenterY = player.y + tileSize / 2;
    spawnVisualEffect("interactionPulse", {
      x: playerCenterX,
      y: playerCenterY - tileSize * 0.2,
      size: 22
    });

    if (handleFeatureNPCInteraction(npc)) return;

    const tp = normalizeProgressState(getTownProgress());

    if (npc.id === "mrHanamiBogland") {
      handleBoglandHanamiInteraction(npc, tp);
      return;
    }

    if (!npc.hasTrainingChoice) {
      const clueDialogue = tryCollectRumorClue(npc, tp);
      if (clueDialogue) {
        showDialogue(npc.name, clueDialogue);
        return;
      }
      showDialogue(npc.name, getContextualDialogue(npc, tp));
      return;
    }

    if (gameFlags.completedTraining) {
      if (!tp.rumorQuestOffered && !tp.rumorQuestActive && !tp.rumorQuestCompleted && !tp.rumorQuestReported) {
        showDialogue(npc.name, trainingContent.postCompleteDialogue, () => {
          showDialogue(npc.name, trainingContent.nextChallengeQuestion, () => {
            openYesNoChoice((selectedOption) => {
              if (selectedOption === "Yes") {
                startInvestigationRoute(npc.name);
              } else {
                showDialogue(npc.name, trainingContent.declineDialogue);
              }
            });
          });
        });
        return;
      }

      if (!tp.rumorQuestActive && !tp.rumorQuestCompleted) {
        startInvestigationRoute(npc.name);
        return;
      }

      if (tp.rumorQuestActive && !tp.rumorQuestCompleted) {
        const clues = getRumorCluesFound(tp);
        const clueGroups = resolveRumorClueGroups(trainingContent);
        const nextLead = getNextRequiredRumorClueGroup(tp, clueGroups);
        const nextLeadLabel = getRumorLeadLabel(nextLead?.key);
        showDialogue(npc.name, [
          `Rumor leads gathered: ${clues}/3.`,
          `Next lead: ${nextLeadLabel}.`,
          "Complete the full route before endurance training."
        ]);
        return;
      }

      if (tp.rumorQuestCompleted && !tp.rumorQuestReported) {
        tp.rumorQuestReported = true;
        tp.rumorQuestActive = false;
        gameFlags.townRumorResolved = true;
        tp.enduranceUnlocked = true;
        itemAlert.active = true;
        itemAlert.text = "Rumor report complete. Town watch updated.";
        itemAlert.startedAt = performance.now();
        showDialogue(npc.name, [
          "Your report is clear and disciplined.",
          "You confirmed timing, witnesses, and pattern without panic.",
          "Excellent. That kind of judgment protects a town.",
          "Now begin endurance drills on the mat."
        ]);
        syncObjectiveState();
        return;
      }

      if (tp.enduranceUnlocked && playerStats.disciplineLevel >= 2) {
        if (!tp.membershipAwarded) {
          maybeAwardMembershipCard(tp, npc.name);
          return;
        }
        showDialogue(npc.name, trainingContent.enduranceCompleteDialogue);
        return;
      }

      if (tp.enduranceUnlocked) {
        showDialogue(npc.name, trainingContent.enduranceInProgressDialogue);
        return;
      }

      tp.enduranceUnlocked = true;
      showDialogue(npc.name, trainingContent.enduranceAcceptedDialogue);
      syncObjectiveState();
      return;
    }

    if (gameFlags.acceptedTraining) {
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
          syncObjectiveState();
        } else {
          showDialogue(npc.name, trainingContent.declineDialogue);
        }
      });
    });
  };
}
