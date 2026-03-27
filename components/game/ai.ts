import type { Difficulty, GameCard } from "./types";

// ─── AI Fictional player name pools ──────────────────────────────────────────

const AI_PLAYER_NAMES = [
  "Viktor Petrov",
  "Lars Magnusson",
  "Antoine Gagnon",
  "Dmitri Volkov",
  "Conor MacAulay",
  "Sven Lindqvist",
  "Jānis Bērziņš",
  "Tomáš Novák",
  "Miguel Carvalho",
  "Elias Strömberg",
];

const AI_LEGENDARY_NAMES = [
  "The Iron Giant",
  "Phantom Striker",
  "The Thunderclap",
  "Blizzard King",
  "Steel Colossus",
];

const AI_SPECIAL_NAMES = [
  "Power Play",
  "Blitz Rush",
  "Breakout Pass",
  "Zone Control",
  "Pressure Line",
];

// ─── Card factory ─────────────────────────────────────────────────────────────

function roll(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeCard(
  id: string,
  name: string,
  type: GameCard["type"],
  rarity: GameCard["rarity"],
  atkRange: [number, number],
  defRange: [number, number],
  ability?: string,
): GameCard {
  return {
    id,
    name,
    type,
    rarity,
    attack: roll(...atkRange),
    defense: roll(...defRange),
    special_ability: ability ?? null,
    image_url: null,
  };
}

// ─── AI deck generator ────────────────────────────────────────────────────────

/**
 * Generates a 10-card AI deck whose power scales with difficulty.
 *
 * Easy:   Only common/rare player cards (no specials, no legendaries).
 * Normal: Balanced mix — 5 players (rare/epic) + 1 legendary + 4 specials.
 * Hard:   3 legendaries + 4 epic players + 3 epic specials.
 */
export function buildAIDeck(difficulty: Difficulty): GameCard[] {
  const deck: GameCard[] = [];

  if (difficulty === "easy") {
    // 7 common/rare players + 3 weak specials
    for (let i = 0; i < 7; i++) {
      const rarity: GameCard["rarity"] = i < 4 ? "common" : "rare";
      deck.push(
        makeCard(
          `ai_e_p${i}`,
          AI_PLAYER_NAMES[i % AI_PLAYER_NAMES.length],
          "player",
          rarity,
          [38, 60],
          [35, 58],
        ),
      );
    }
    for (let i = 0; i < 3; i++) {
      deck.push(
        makeCard(
          `ai_e_s${i}`,
          `${AI_SPECIAL_NAMES[i]} ${i + 1}`,
          "special",
          "common",
          [35, 52],
          [32, 50],
          "Power surge",
        ),
      );
    }
  } else if (difficulty === "normal") {
    // 5 rare/epic players
    for (let i = 0; i < 5; i++) {
      const rarity: GameCard["rarity"] = i < 2 ? "rare" : "epic";
      deck.push(
        makeCard(
          `ai_n_p${i}`,
          AI_PLAYER_NAMES[i],
          "player",
          rarity,
          [55, 78],
          [52, 75],
        ),
      );
    }
    // 1 legendary
    deck.push(
      makeCard(
        "ai_n_leg0",
        AI_LEGENDARY_NAMES[0],
        "legendary",
        "legendary",
        [80, 92],
        [75, 88],
        "Power burst surge",
      ),
    );
    // 4 rare specials
    for (let i = 0; i < 4; i++) {
      deck.push(
        makeCard(
          `ai_n_s${i}`,
          `${AI_SPECIAL_NAMES[i % AI_SPECIAL_NAMES.length]}`,
          "special",
          "rare",
          [58, 72],
          [55, 68],
          "Pressure surge",
        ),
      );
    }
  } else {
    // Hard: 4 epic players + 3 legendaries + 3 epic specials
    for (let i = 0; i < 4; i++) {
      deck.push(
        makeCard(
          `ai_h_p${i}`,
          AI_PLAYER_NAMES[i],
          "player",
          "epic",
          [72, 88],
          [68, 84],
        ),
      );
    }
    for (let i = 0; i < 3; i++) {
      deck.push(
        makeCard(
          `ai_h_leg${i}`,
          AI_LEGENDARY_NAMES[i],
          "legendary",
          "legendary",
          [88, 99],
          [82, 96],
          "Power burst aura",
        ),
      );
    }
    for (let i = 0; i < 3; i++) {
      deck.push(
        makeCard(
          `ai_h_s${i}`,
          `${AI_SPECIAL_NAMES[i]}`,
          "special",
          "epic",
          [70, 84],
          [65, 80],
          "Surge drain pressure",
        ),
      );
    }
  }

  // Shuffle before returning
  return deck.sort(() => Math.random() - 0.5);
}

// ─── AI card selection strategy ───────────────────────────────────────────────

const RARITY_WEIGHT: Record<GameCard["rarity"], number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

/**
 * Given the AI's current hand, pick a card.
 *
 * Easy:   Fully random.
 * Normal: Semi-smart — saves legendary for decisive moments.
 * Hard:   Plays best card when behind or in a decisive play;
 *         conserves top cards when well ahead.
 */
export function aiSelectCard(
  hand: GameCard[],
  period: number,
  playIndex: number,
  playerMomentum: number,
  aiMomentum: number,
  difficulty: Difficulty,
): GameCard {
  if (difficulty === "easy" || hand.length === 1) {
    return hand[Math.floor(Math.random() * hand.length)];
  }

  const momentumDiff = aiMomentum - playerMomentum;
  const isLastPlay = playIndex === 4;
  const isDecisive = Math.abs(momentumDiff) <= 3 || isLastPlay;

  // Sort descending by rarity weight, then by ATK
  const sorted = [...hand].sort((a, b) => {
    const rw = RARITY_WEIGHT[b.rarity] - RARITY_WEIGHT[a.rarity];
    return rw !== 0 ? rw : b.attack - a.attack;
  });

  if (difficulty === "hard") {
    if (isDecisive) return sorted[0]; // best card in clutch moments
    if (momentumDiff > 5) {
      // Comfortably ahead — use mid-tier cards
      return sorted[Math.min(1, sorted.length - 1)];
    }
    return sorted[0];
  }

  // Normal
  if (isDecisive) return sorted[0];
  // Otherwise pick randomly from top 2
  const pool = sorted.slice(0, Math.min(2, sorted.length));
  return pool[Math.floor(Math.random() * pool.length)];
}
