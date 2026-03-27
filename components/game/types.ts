// ─── Core card / deck types ────────────────────────────────────────────────

export type CardRarity = "common" | "rare" | "epic" | "legendary";
export type CardType = "player" | "special" | "legendary";
export type Difficulty = "easy" | "normal" | "hard";
export type PlaySide = "player" | "ai";

/** A card as used inside the game engine (maps from DB card_collections row). */
export interface GameCard {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  attack: number;
  defense: number;
  special_ability: string | null;
  image_url: string | null;
}

/** Max 10 cards per match, min 4 players, max 3 legendaries. */
export interface Deck {
  name: string;
  cards: GameCard[];
}

export interface SavedDeck {
  name: string;
  /** card ids in order */
  cardIds: string[];
}

// ─── Match phases ───────────────────────────────────────────────────────────

export type GamePhase =
  | "set" // player choosing a card
  | "ai_thinking" // brief pause while AI picks
  | "reveal" // both cards shown, waiting for "Next"
  | "period_end" // period summary shown
  | "match_end"; // game over

// ─── Per-play modifier flags ────────────────────────────────────────────────

/**
 * Ability / passive flags that shape how a single play resolves.
 * Reset to defaults before each new play.
 */
export interface MatchFlags {
  // Flat ATK / DEF bonuses (from coach passives & abilities)
  playerATKBonus: number;
  playerDEFBonus: number;
  aiATKBonus: number;
  aiDEFBonus: number;

  // Ability flags (true = this play only)
  playerWinTies: boolean; // Enforcer: player wins tie clashes 2-1
  playerImmune: boolean; // Physical Play: opponent special effects ignored
  trapPending: boolean; // Trap Line: if player loses, AI earns 0 not 2
  playerDoubleATK: boolean; // Precision Strike: multiply player effective ATK × 2
  penaltyShot: boolean; // Penalty Shot: +8 effective ATK
  scoutReady: boolean; // Line Change: AI card is visible during set phase
}

export const DEFAULT_FLAGS: MatchFlags = {
  playerATKBonus: 0,
  playerDEFBonus: 0,
  aiATKBonus: 0,
  aiDEFBonus: 0,
  playerWinTies: false,
  playerImmune: false,
  trapPending: false,
  playerDoubleATK: false,
  penaltyShot: false,
  scoutReady: false,
};

// ─── Result types ────────────────────────────────────────────────────────────

export interface PlayResult {
  playerCard: GameCard;
  aiCard: GameCard;
  winner: PlaySide | "tie";
  playerMomGain: number;
  aiMomGain: number;
  playerEffATK: number;
  aiEffATK: number;
  playerEffDEF: number;
  aiEffDEF: number;
  narrative: string;
  abilityFired: string | null;
}

export interface PeriodResult {
  periodNum: number;
  playerMomentum: number;
  aiMomentum: number;
  winner: PlaySide | "tie";
}

// ─── Full match state ────────────────────────────────────────────────────────

export interface MatchState {
  phase: GamePhase;
  period: number; // 1–3
  playIndex: number; // 0–4  (5 plays per period)
  difficulty: Difficulty;

  // Hands & remaining deck (reshuffled each period)
  playerHand: GameCard[];
  aiHand: GameCard[];
  playerDeckRemaining: GameCard[];
  aiDeckRemaining: GameCard[];

  // Momentum accumulated this period
  playerMomentum: number;
  aiMomentum: number;

  // History
  periodResults: PeriodResult[];
  playerGoals: number;
  aiGoals: number;

  // Current play selections
  playerSetCard: GameCard | null;
  aiSetCard: GameCard | null;
  lastPlayResult: PlayResult | null;

  // Coach
  playerCoachId: string;
  aiCoachId: string;
  playerCoachCharge: number; // plays accumulated toward ability
  playerAbilityReady: boolean;
  playerAbilityActive: boolean; // player toggled it on for this play

  // Per-play flags
  flags: MatchFlags;

  matchWinner: PlaySide | null;
}

// ─── Deck validation ────────────────────────────────────────────────────────

export const DECK_SIZE = 10;
export const MIN_PLAYER_CARDS = 4;
export const MAX_LEGENDARY_CARDS = 3;

export type DeckError =
  | "too_few_cards"
  | "too_many_cards"
  | "too_few_player_cards"
  | "too_many_legendary_cards";

export function validateDeck(cards: GameCard[]): DeckError[] {
  const errors: DeckError[] = [];
  if (cards.length < DECK_SIZE) errors.push("too_few_cards");
  if (cards.length > DECK_SIZE) errors.push("too_many_cards");
  const playerCount = cards.filter((c) => c.type === "player").length;
  if (playerCount < MIN_PLAYER_CARDS) errors.push("too_few_player_cards");
  const legendaryCount = cards.filter((c) => c.rarity === "legendary").length;
  if (legendaryCount > MAX_LEGENDARY_CARDS)
    errors.push("too_many_legendary_cards");
  return errors;
}

export function deckErrorMessage(e: DeckError): string {
  switch (e) {
    case "too_few_cards":
      return `Need exactly ${DECK_SIZE} cards (add more)`;
    case "too_many_cards":
      return `Too many cards — remove some (max ${DECK_SIZE})`;
    case "too_few_player_cards":
      return `At least ${MIN_PLAYER_CARDS} Player cards required`;
    case "too_many_legendary_cards":
      return `Max ${MAX_LEGENDARY_CARDS} Legendary cards allowed`;
  }
}
