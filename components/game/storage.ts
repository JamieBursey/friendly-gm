import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SavedDeck } from "./types";

const KEYS = {
  savedDeck: "fgm_saved_deck",
  wins: "fgm_match_wins",
  losses: "fgm_match_losses",
} as const;

// ─── Saved Deck ───────────────────────────────────────────────────────────────

export async function getSavedDeck(): Promise<SavedDeck | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.savedDeck);
    return raw ? (JSON.parse(raw) as SavedDeck) : null;
  } catch {
    return null;
  }
}

export async function saveDeck(deck: SavedDeck): Promise<void> {
  await AsyncStorage.setItem(KEYS.savedDeck, JSON.stringify(deck));
}

export async function clearSavedDeck(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.savedDeck);
}

// ─── Win / loss tracking ─────────────────────────────────────────────────────

export async function getRecord(): Promise<{ wins: number; losses: number }> {
  try {
    const [w, l] = await Promise.all([
      AsyncStorage.getItem(KEYS.wins),
      AsyncStorage.getItem(KEYS.losses),
    ]);
    return {
      wins: w ? parseInt(w, 10) : 0,
      losses: l ? parseInt(l, 10) : 0,
    };
  } catch {
    return { wins: 0, losses: 0 };
  }
}

/** Increment win counter and return the new total wins. */
export async function recordWin(): Promise<number> {
  const { wins } = await getRecord();
  const next = wins + 1;
  await AsyncStorage.setItem(KEYS.wins, String(next));
  return next;
}

/** Increment loss counter. */
export async function recordLoss(): Promise<void> {
  const { losses } = await getRecord();
  await AsyncStorage.setItem(KEYS.losses, String(losses + 1));
}
