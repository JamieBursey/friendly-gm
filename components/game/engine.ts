import { getCoach } from "./coaches";
import type {
    GameCard,
    GamePhase,
    MatchFlags,
    MatchState,
    PeriodResult,
    PlayResult,
    PlaySide,
} from "./types";
import { DEFAULT_FLAGS } from "./types";

// ─── Constants ───────────────────────────────────────────────────────────────

export const PLAYS_PER_PERIOD = 5;
export const TOTAL_PERIODS = 3;
export const BASE_HAND_SIZE = 4;

// ─── Card ability resolver ────────────────────────────────────────────────────

interface CardEffect {
  selfATKBonus: number;
  selfDEFBonus: number;
  opponentATKMalus: number;
  opponentDEFMalus: number;
  narrative: string;
}

export function getCardEffect(card: GameCard): CardEffect {
  if (card.type === "player") {
    return {
      selfATKBonus: 0,
      selfDEFBonus: 0,
      opponentATKMalus: 0,
      opponentDEFMalus: 0,
      narrative: "",
    };
  }

  const raw = (card.special_ability ?? "").toLowerCase();

  // Surge / offensive effects
  if (
    raw.includes("burst") ||
    raw.includes("surge") ||
    raw.includes("power") ||
    raw.includes("shot") ||
    raw.includes("rush") ||
    raw.includes("drive")
  ) {
    const bonus = card.type === "legendary" ? 14 : 8;
    return {
      selfATKBonus: bonus,
      selfDEFBonus: 0,
      opponentATKMalus: 0,
      opponentDEFMalus: 0,
      narrative: `⚡ ${card.name} surges with power!`,
    };
  }

  // Shield / defensive effects
  if (
    raw.includes("aura") ||
    raw.includes("shield") ||
    raw.includes("wall") ||
    raw.includes("block") ||
    raw.includes("anchor") ||
    raw.includes("stonewall")
  ) {
    const bonus = card.type === "legendary" ? 12 : 7;
    return {
      selfATKBonus: 0,
      selfDEFBonus: bonus,
      opponentATKMalus: 0,
      opponentDEFMalus: bonus - 2,
      narrative: `🛡️ ${card.name} summons a defensive aura!`,
    };
  }

  // Drain / pressure effects
  if (
    raw.includes("drain") ||
    raw.includes("steal") ||
    raw.includes("pressure") ||
    raw.includes("agitator") ||
    raw.includes("mark")
  ) {
    return {
      selfATKBonus: 5,
      selfDEFBonus: 0,
      opponentATKMalus: 7,
      opponentDEFMalus: 0,
      narrative: `🔥 ${card.name} drains the opponent's momentum!`,
    };
  }

  // Combo / playmaker effects
  if (
    raw.includes("combo") ||
    raw.includes("playmaker") ||
    raw.includes("thread") ||
    raw.includes("command") ||
    raw.includes("control")
  ) {
    const bonus = card.type === "legendary" ? 10 : 6;
    return {
      selfATKBonus: bonus,
      selfDEFBonus: bonus - 2,
      opponentATKMalus: 0,
      opponentDEFMalus: 0,
      narrative: `🎯 ${card.name} orchestrates the play!`,
    };
  }

  // Default balanced boost
  const bonus = card.type === "legendary" ? 10 : 5;
  return {
    selfATKBonus: bonus,
    selfDEFBonus: Math.floor(bonus / 2),
    opponentATKMalus: 0,
    opponentDEFMalus: 0,
    narrative: `✨ ${card.name}'s special ability triggers!`,
  };
}

// ─── Play resolution ─────────────────────────────────────────────────────────

export function resolvePlay(
  playerCard: GameCard,
  aiCard: GameCard,
  flags: MatchFlags,
  playerCoachId: string,
): PlayResult {
  const coach = getCoach(playerCoachId);
  const narrativeParts: string[] = [];
  let abilityFired: string | null = null;

  // Base stats + coach passive
  let playerATK =
    playerCard.attack + flags.playerATKBonus + coach.passiveATKBonus;
  let playerDEF =
    playerCard.defense + flags.playerDEFBonus + coach.passiveDEFBonus;
  let aiATK = aiCard.attack + flags.aiATKBonus;
  let aiDEF = aiCard.defense + flags.aiDEFBonus;

  // Player card ability
  const pEffect = getCardEffect(playerCard);
  if (pEffect.selfATKBonus || pEffect.selfDEFBonus) {
    playerATK += pEffect.selfATKBonus;
    playerDEF += pEffect.selfDEFBonus;
    narrativeParts.push(pEffect.narrative);
    abilityFired = pEffect.narrative;
  }

  // AI card ability (unless player is immune)
  const aEffect = getCardEffect(aiCard);
  if (!flags.playerImmune) {
    if (aEffect.opponentATKMalus || aEffect.opponentDEFMalus) {
      playerATK -= aEffect.opponentATKMalus;
      playerDEF -= aEffect.opponentDEFMalus;
      narrativeParts.push(`Opponent ${aiCard.name} counters!`);
    }
  } else {
    narrativeParts.push("Physical Play — opponent special effects negated.");
    abilityFired = "Physical Play";
  }
  if (aEffect.selfATKBonus || aEffect.selfDEFBonus) {
    aiATK += aEffect.selfATKBonus;
    aiDEF += aEffect.selfDEFBonus;
  }

  // Penalty Shot ability
  if (flags.penaltyShot) {
    playerATK += 8;
    narrativeParts.push("🚨 Penalty Shot! +8 ATK burst!");
    abilityFired = "Penalty Shot";
  }

  // Precision Strike ability
  if (flags.playerDoubleATK) {
    playerATK *= 2;
    narrativeParts.push("⚡ Precision Strike! ATK doubled!");
    abilityFired = "Precision Strike";
  }

  // Floor at 0
  playerATK = Math.max(0, playerATK);
  playerDEF = Math.max(0, playerDEF);
  aiATK = Math.max(0, aiATK);
  aiDEF = Math.max(0, aiDEF);

  // Resolution: net margin determines winner
  // Each side's ATK − opponent's DEF = net offensive margin
  const playerMargin = playerATK - aiDEF;
  const aiMargin = aiATK - playerDEF;

  let winner: PlaySide | "tie";
  let playerMomGain: number;
  let aiMomGain: number;

  if (playerMargin > aiMargin) {
    winner = "player";
    playerMomGain = 2;
    aiMomGain = 1;
  } else if (aiMargin > playerMargin) {
    winner = "ai";
    aiMomGain = 2;
    playerMomGain = 1;
    if (flags.trapPending) {
      aiMomGain = 0;
      narrativeParts.push("🪤 Trap Line sprung! Opponent gains nothing!");
      abilityFired = "Trap Line";
    }
  } else {
    // Tie
    if (flags.playerWinTies || coach.passiveWinTies) {
      winner = "player";
      playerMomGain = 2;
      aiMomGain = 1;
      narrativeParts.push("💪 Enforcer calls the tie for the player!");
    } else {
      winner = "tie";
      playerMomGain = 1;
      aiMomGain = 1;
    }
  }

  // Precision passive: +1 mom if net margin ≥ 10
  if (
    winner === "player" &&
    coach.passivePrecision &&
    playerMargin - aiMargin >= 10
  ) {
    playerMomGain += 1;
    narrativeParts.push("🎯 Surgical precision! +1 Momentum bonus!");
  }

  // Base narrative
  const baseNarrative =
    winner === "player"
      ? `${playerCard.name} breaks through! +${playerMomGain}🔵`
      : winner === "ai"
        ? `${aiCard.name} shuts it down! +${aiMomGain}🔴`
        : "Deadlock — both sides earn 1 Momentum.";

  return {
    playerCard,
    aiCard,
    winner,
    playerMomGain,
    aiMomGain,
    playerEffATK: playerATK,
    aiEffATK: aiATK,
    playerEffDEF: playerDEF,
    aiEffDEF: aiDEF,
    narrative: [baseNarrative, ...narrativeParts].join(" "),
    abilityFired,
  };
}

// ─── Period helpers ───────────────────────────────────────────────────────────

export function buildPeriodResult(state: MatchState): PeriodResult {
  const { playerMomentum, aiMomentum, period } = state;
  const winner: PlaySide | "tie" =
    playerMomentum > aiMomentum
      ? "player"
      : aiMomentum > playerMomentum
        ? "ai"
        : "tie";
  return { periodNum: period, playerMomentum, aiMomentum, winner };
}

// ─── Hand dealing ─────────────────────────────────────────────────────────────

export function dealHand(
  deck: GameCard[],
  handSize: number,
): { hand: GameCard[]; remaining: GameCard[] } {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  return {
    hand: shuffled.slice(0, handSize),
    remaining: shuffled.slice(handSize),
  };
}

// ─── Initial match state factory ─────────────────────────────────────────────

export function createInitialMatchState(
  playerDeck: GameCard[],
  aiDeck: GameCard[],
  playerCoachId: string,
  aiCoachId: string,
  difficulty: string,
): MatchState {
  const coach = getCoach(playerCoachId);
  const handSize = coach.passiveExtraCard ? BASE_HAND_SIZE + 1 : BASE_HAND_SIZE;

  const { hand: playerHand, remaining: playerRem } = dealHand(
    playerDeck,
    handSize,
  );
  const { hand: aiHand, remaining: aiRem } = dealHand(aiDeck, BASE_HAND_SIZE);

  return {
    phase: "set" as GamePhase,
    period: 1,
    playIndex: 0,
    difficulty: difficulty as any,
    playerHand,
    aiHand,
    playerDeckRemaining: playerRem,
    aiDeckRemaining: aiRem,
    playerMomentum: 0,
    aiMomentum: 0,
    periodResults: [],
    playerGoals: 0,
    aiGoals: 0,
    playerSetCard: null,
    aiSetCard: null,
    lastPlayResult: null,
    playerCoachId,
    aiCoachId,
    playerCoachCharge: 0,
    playerAbilityReady: false,
    playerAbilityActive: false,
    flags: { ...DEFAULT_FLAGS },
    matchWinner: null,
  };
}

// ─── Coach charge tracker ─────────────────────────────────────────────────────

export function advanceCoachCharge(state: MatchState): MatchState {
  const coach = getCoach(state.playerCoachId);
  const newCharge = state.playerCoachCharge + 1;
  const ready = newCharge >= coach.chargeAfter;
  return {
    ...state,
    playerCoachCharge: ready ? 0 : newCharge,
    playerAbilityReady: state.playerAbilityReady || ready,
  };
}

// ─── Build flags for a play ───────────────────────────────────────────────────

export function buildPlayFlags(
  state: MatchState,
  abilityActivated: boolean,
): MatchFlags {
  const coach = getCoach(state.playerCoachId);
  const base: MatchFlags = {
    ...DEFAULT_FLAGS,
    playerWinTies: coach.passiveWinTies,
  };
  if (abilityActivated) {
    Object.assign(base, coach.abilityFlags);
  }
  return base;
}
