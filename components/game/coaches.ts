import type { MatchFlags } from "./types";

// ─── Coach interface ─────────────────────────────────────────────────────────

export interface Coach {
  id: string;
  name: string;
  style: string;
  /** One-line flavour description */
  desc: string;
  passiveText: string;
  abilityText: string;
  /** How many plays must accumulate before ability is ready */
  chargeAfter: number;
  /** Wins required to unlock (0 = always free) */
  requiredWins: number;

  // Passive stat boosts applied every play
  passiveATKBonus: number;
  passiveDEFBonus: number;
  passiveWinTies: boolean;
  passiveExtraCard: boolean; // draw 5 instead of 4
  passivePrecision: boolean; // +1 mom when win margin ≥ 10

  // Flags set on MatchFlags when ability is activated
  abilityFlags: Partial<MatchFlags>;
}

// ─── Roster (2 free, 4 earned) ───────────────────────────────────────────────

export const COACHES: Coach[] = [
  // ── FREE ────────────────────────────────────────────────────────────────────
  {
    id: "aggressive",
    name: 'Mike "The Hammer" Kovacs',
    style: "Aggressive",
    desc: "Punch first, ask questions later.",
    passiveText: "+4 ATK on all your player cards every play",
    abilityText:
      "Penalty Shot — your card gets +8 extra ATK this play (charges after 3 plays)",
    chargeAfter: 3,
    requiredWins: 0,
    passiveATKBonus: 4,
    passiveDEFBonus: 0,
    passiveWinTies: false,
    passiveExtraCard: false,
    passivePrecision: false,
    abilityFlags: { penaltyShot: true },
  },
  {
    id: "defensive",
    name: 'Jana "The Wall" Norrström',
    style: "Defensive",
    desc: "A fortress in skates.",
    passiveText: "+4 DEF on all your cards every play",
    abilityText:
      "Trap Line — if you lose this play, opponent earns 0 Momentum instead of 2 (charges after 4 plays)",
    chargeAfter: 4,
    requiredWins: 0,
    passiveATKBonus: 0,
    passiveDEFBonus: 4,
    passiveWinTies: false,
    passiveExtraCard: false,
    passivePrecision: false,
    abilityFlags: { trapPending: true },
  },

  // ── EARN AT 3 WINS ──────────────────────────────────────────────────────────
  {
    id: "analytics",
    name: 'Dr. Sarah "The Analyst" Chen',
    style: "Analytics",
    desc: "The game is just numbers she already solved.",
    passiveText: "Draw 5 cards per period instead of 4",
    abilityText:
      "Line Change — see opponent's face-down card before you commit yours (charges after 2 plays)",
    chargeAfter: 2,
    requiredWins: 3,
    passiveATKBonus: 0,
    passiveDEFBonus: 0,
    passiveWinTies: false,
    passiveExtraCard: true,
    passivePrecision: false,
    abilityFlags: { scoutReady: true },
  },

  // ── EARN AT 5 WINS ──────────────────────────────────────────────────────────
  {
    id: "enforcer",
    name: "Iron Mike Petrova",
    style: "Enforcer",
    desc: "Ties don't exist when he's behind the bench.",
    passiveText: "Win all tie clashes — you get 2 Momentum, opponent gets 1",
    abilityText:
      "Physical Play — your card ignores all opponent Special / Legendary effect debuffs this play (charges after 3 plays)",
    chargeAfter: 3,
    requiredWins: 5,
    passiveATKBonus: 0,
    passiveDEFBonus: 0,
    passiveWinTies: true,
    passiveExtraCard: false,
    passivePrecision: false,
    abilityFlags: { playerImmune: true },
  },

  // ── EARN AT 8 WINS ──────────────────────────────────────────────────────────
  {
    id: "precision",
    name: 'Coach "The Surgeon" Walsh',
    style: "Precision",
    desc: "Every play is a scalpel, not a sledgehammer.",
    passiveText: "Win a play by 10+ net ATK margin → earn +1 bonus Momentum",
    abilityText:
      "Precision Strike — double your effective ATK this play (charges after 3 plays)",
    chargeAfter: 3,
    requiredWins: 8,
    passiveATKBonus: 0,
    passiveDEFBonus: 0,
    passiveWinTies: false,
    passiveExtraCard: false,
    passivePrecision: true,
    abilityFlags: { playerDoubleATK: true },
  },

  // ── EARN AT 12 WINS ─────────────────────────────────────────────────────────
  {
    id: "ghost",
    name: 'Kenji "The Ghost" Yamamoto',
    style: "Trickster",
    desc: "You never know what's coming until it's too late.",
    passiveText: "+3 ATK and +3 DEF on every card you play",
    abilityText:
      "Phantom Rush — apply −6 ATK and −6 DEF to opponent's card this play (charges after 4 plays)",
    chargeAfter: 4,
    requiredWins: 12,
    passiveATKBonus: 3,
    passiveDEFBonus: 3,
    passiveWinTies: false,
    passiveExtraCard: false,
    passivePrecision: false,
    abilityFlags: { aiATKBonus: -6, aiDEFBonus: -6 },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getCoach(id: string): Coach {
  return COACHES.find((c) => c.id === id) ?? COACHES[0];
}

export function isCoachUnlocked(id: string, totalWins: number): boolean {
  return totalWins >= getCoach(id).requiredWins;
}

/** Return the two always-free coaches first, then unlocked ones, then locked. */
export function sortedCoachesForDisplay(
  totalWins: number,
): { coach: Coach; unlocked: boolean }[] {
  return COACHES.map((coach) => ({
    coach,
    unlocked: isCoachUnlocked(coach.id, totalWins),
  }));
}
