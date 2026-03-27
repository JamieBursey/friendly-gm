import { supabase } from "@/lib/supabase";
import type { Card, CardCollection } from "@/types/database";

type RosterPlayer = {
  id: string | number;
  firstName?: { default?: string } | string | null;
  lastName?: { default?: string } | string | null;
  position?: string | null;
  headshot?: string | null;
  seasonTotals?: Array<Record<string, any>>;
};

type CardTemplate = {
  type: "player" | "special" | "legendary";
  rarity: "common" | "rare" | "epic" | "legendary";
  attack: number;
  defense: number;
  special_ability: string;
};

type GeneratedCardPayload = {
  name: string;
  type: "player" | "special" | "legendary";
  rarity: "common" | "rare" | "epic" | "legendary";
  attack: number;
  defense: number;
  special_ability: string | null;
  player_id: string;
  image_url: string | null | undefined;
};

const assertCardsRelationsExist = (error: any) => {
  if (!error) return;
  if (error.code === "PGRST205") {
    throw new Error(
      "Supabase table is missing. Create 'public.cards' and 'public.card_collections' in SQL Editor.",
    );
  }
  if (
    error.code === "42501" ||
    String(error.message || "")
      .toLowerCase()
      .includes("row-level security")
  ) {
    throw new Error(
      "Cards table RLS is blocking writes. Add INSERT/UPDATE policies for authenticated users on public.cards.",
    );
  }
  throw error;
};

const assertCardCollectionsWriteAllowed = (error: any) => {
  if (!error) return;
  if (error.code === "PGRST205") {
    throw new Error(
      "Supabase table is missing. Create 'public.card_collections' in SQL Editor.",
    );
  }
  if (
    error.code === "42501" ||
    String(error.message || "")
      .toLowerCase()
      .includes("row-level security")
  ) {
    throw new Error(
      "card_collections RLS is blocking writes. Add INSERT/SELECT policies that map auth.uid() to users.public_user_id.",
    );
  }
  throw error;
};

const getPlayerNamePart = (value?: { default?: string } | string | null) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.default ?? "";
};

const getFullPlayerName = (player: RosterPlayer) =>
  `${getPlayerNamePart(player.firstName)} ${getPlayerNamePart(player.lastName)}`
    .trim()
    .toLowerCase();

const getRole = (position?: string | null): "F" | "D" | "G" | "?" => {
  if (!position) return "?";

  const normalized = position.toUpperCase().trim();
  const tokens = normalized.split(/[\s/,-]+/).filter(Boolean);

  if (
    tokens.includes("G") ||
    tokens.includes("GK") ||
    tokens.includes("GOALIE")
  ) {
    return "G";
  }
  if (tokens.includes("D") || tokens.includes("LD") || tokens.includes("RD")) {
    return "D";
  }
  if (
    tokens.includes("F") ||
    tokens.includes("C") ||
    tokens.includes("LW") ||
    tokens.includes("RW") ||
    tokens.includes("W") ||
    tokens.includes("L") ||
    tokens.includes("R")
  ) {
    return "F";
  }
  if (
    normalized.includes("CENTER") ||
    normalized.includes("WING") ||
    normalized.includes("FORWARD")
  ) {
    return "F";
  }
  if (normalized.includes("DEFENSE")) return "D";
  if (normalized.includes("GOAL")) return "G";
  return "?";
};

const ELITE_ROSTER_CARDS: Record<string, CardTemplate> = {
  "connor mcdavid": {
    type: "legendary",
    rarity: "legendary",
    attack: 97,
    defense: 90,
    special_ability:
      "Blazing Rush: Attacks first each round and strikes twice if your opponent controls the strongest board.",
  },
  "nathan mackinnon": {
    type: "legendary",
    rarity: "legendary",
    attack: 94,
    defense: 89,
    special_ability:
      "Avalanche Drive: Gains +18 attack after any ally card is played in the same turn.",
  },
  "dawson mercer": {
    type: "legendary",
    rarity: "legendary",
    attack: 99,
    defense: 99,
    special_ability:
      "Mercer Mastery: Once per match, copies the strongest allied ability and makes your full front line untargetable for one turn.",
  },
  "riley mercer": {
    type: "legendary",
    rarity: "legendary",
    attack: 96,
    defense: 100,
    special_ability:
      "Mercer Last Stand: Negates the next enemy finisher, fully restores defense, and counterattacks for the prevented damage.",
  },
  "jack hughes": {
    type: "legendary",
    rarity: "legendary",
    attack: 93,
    defense: 84,
    special_ability:
      "Edge Control: Draw a card when summoned and gain +10 attack for each combo card played this round.",
  },
  "leon draisaitl": {
    type: "legendary",
    rarity: "legendary",
    attack: 95,
    defense: 88,
    special_ability:
      "Royal Finish: If an ally already attacked this turn, this card deals piercing bonus damage.",
  },
  "mitch marner": {
    type: "legendary",
    rarity: "legendary",
    attack: 92,
    defense: 86,
    special_ability:
      "Playmaker Thread: Grants another allied attacker an immediate follow-up strike.",
  },
  "sidney crosby": {
    type: "legendary",
    rarity: "legendary",
    attack: 95,
    defense: 94,
    special_ability:
      "Captain's Command: All allied forwards gain +12 attack and you draw one extra card at the start of combat.",
  },
  "brad marchand": {
    type: "legendary",
    rarity: "legendary",
    attack: 91,
    defense: 83,
    special_ability:
      "Agitator's Mark: Reduces the enemy ace card's defense every time this card survives combat.",
  },
  "macklin celebrini": {
    type: "legendary",
    rarity: "legendary",
    attack: 90,
    defense: 85,
    special_ability:
      "Future Star: Levels up mid-match and permanently gains +8/+8 after its first successful attack.",
  },
  "artturi lehkonen": {
    type: "player",
    rarity: "epic",
    attack: 88,
    defense: 87,
    special_ability:
      "Clutch Finish: Deals bonus damage when your opponent is below half total defense.",
  },
  "quinn hughes": {
    type: "legendary",
    rarity: "legendary",
    attack: 90,
    defense: 94,
    special_ability:
      "Blue Line Maestro: Converts 30% of defense into attack for your whole back line this round.",
  },
  "cale makar": {
    type: "legendary",
    rarity: "legendary",
    attack: 96,
    defense: 95,
    special_ability:
      "Orbit Breaker: Ignores defensive buffs and deals splash damage to adjacent enemy cards.",
  },
  "devon toews": {
    type: "player",
    rarity: "epic",
    attack: 87,
    defense: 93,
    special_ability:
      "Shutdown Pairing: Grants your strongest defense card a shield at the start of battle.",
  },
  "nico hischier": {
    type: "legendary",
    rarity: "legendary",
    attack: 89,
    defense: 91,
    special_ability:
      "Two-Way Pulse: Restores allied defense equal to half the damage this card deals.",
  },
  "alex newhook": {
    type: "legendary",
    rarity: "legendary",
    attack: 94,
    defense: 92,
    special_ability:
      "Breakaway Engine: Enters play ready to attack and gains unstoppable damage if summoned after a combo card.",
  },
  "samuel girard": {
    type: "player",
    rarity: "epic",
    attack: 86,
    defense: 90,
    special_ability: "Spin Escape: Dodges the first direct attack each round.",
  },
  "bowen byram": {
    type: "player",
    rarity: "epic",
    attack: 89,
    defense: 88,
    special_ability:
      "Transition Surge: Gains +14 attack whenever an allied defense card leaves play.",
  },
  "morgan rielly": {
    type: "legendary",
    rarity: "legendary",
    attack: 91,
    defense: 89,
    special_ability:
      "Blue Line Flow: Gives every card in your hand a small permanent stat boost when this card attacks.",
  },
};

const NON_ELITE_ABILITY_POOL: Record<
  "common" | "rare" | "epic",
  Record<"F" | "D" | "G" | "?", string[]>
> = {
  common: {
    F: [
      "Quick Release: Gain +8 attack for this round.",
      "Support Shift: Give the next allied card +6 defense.",
      "Forecheck Pressure: Reduce enemy defense by 6.",
    ],
    D: [
      "Box Out: Gain +10 defense for one combat.",
      "Clean Exit: Your next allied card gains +7 attack.",
      "Stick Check: Lower opposing attack by 6 this turn.",
    ],
    G: [
      "Routine Save: Block 12 incoming damage.",
      "Rebound Control: Heal 8 defense after combat.",
      "Calm Crease: Reduce all enemy damage by 4 this round.",
    ],
    "?": [
      "Balanced Shift: Gain +6 attack and +6 defense.",
      "Energy Burst: Draw 1 card at end of turn.",
    ],
  },
  rare: {
    F: [
      "Breakaway Threat: Attack twice if this card starts the turn at full defense.",
      "Cycle Control: Gain +12 attack when another ally has already attacked.",
      "Clutch Finish: Deal 10 bonus damage if enemy is below half defense.",
    ],
    D: [
      "Blue Line Wall: Grant your front row +10 defense this turn.",
      "Pinch Read: Convert 30% of defense into attack this round.",
      "Gap Denial: Cancel the first enemy stat buff each turn.",
    ],
    G: [
      "Hot Glove: Negate the first enemy strike each round.",
      "Post-to-Post: Heal all allies for 6 defense.",
      "Steady Presence: Gain +14 defense and taunt for one turn.",
    ],
    "?": [
      "Adaptive Tempo: Randomly gain +12 attack or +12 defense.",
      "Momentum Swing: After taking damage, retaliate for half.",
    ],
  },
  epic: {
    F: [
      "Elite Edge: First attack each round ignores enemy defense buffs.",
      "Combo Accelerator: Gain +16 attack after any allied ability triggers.",
      "Finisher Protocol: If this attack KOs a card, attack again at 75% power.",
    ],
    D: [
      "Anchor Pairing: Allies take 20% less damage while this card survives.",
      "Counter Pinch: On being attacked, strike back before damage resolves.",
      "Shutdown Net: Disable one enemy ability for this turn.",
    ],
    G: [
      "Stonewall Sequence: Negate a full enemy action once per match.",
      "Last Line Heroics: Restore to full defense the first time this card drops below 25%.",
      "Reflex Chain: Block 60% of incoming damage for the team this round.",
    ],
    "?": [
      "Tactical Override: Copy a random allied ability at reduced power.",
      "Peak Shift: Gain +18 attack and +18 defense for one round.",
    ],
  },
};

const pickRandom = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

const getRandomAbility = (
  name: string,
  role: "F" | "D" | "G" | "?",
  rarity: "common" | "rare" | "epic",
) => {
  const pool = NON_ELITE_ABILITY_POOL[rarity][role];
  const base = pickRandom(
    pool.length > 0 ? pool : NON_ELITE_ABILITY_POOL[rarity]["?"],
  );
  return `${name}: ${base}`;
};

const resolveOwnerId = async (userId: string) => {
  const { data: existingUser } = await supabase
    .from("users")
    .select("public_user_id")
    .eq("id", userId)
    .maybeSingle();

  return existingUser?.public_user_id ?? userId;
};

const buildCardPayloadFromPlayer = (
  player: RosterPlayer,
): GeneratedCardPayload => {
  const fullName = getFullPlayerName(player);
  const displayName =
    `${getPlayerNamePart(player.firstName)} ${getPlayerNamePart(player.lastName)}`.trim();
  const eliteCard = ELITE_ROSTER_CARDS[fullName];

  if (eliteCard) {
    return {
      name: displayName,
      type: eliteCard.type,
      rarity: eliteCard.rarity,
      attack: eliteCard.attack,
      defense: eliteCard.defense,
      special_ability: eliteCard.special_ability,
      player_id: String(player.id),
      image_url: player.headshot,
    };
  }

  const seasonData = player.seasonTotals?.[0] || {};
  const role = getRole(player.position);

  let attack = 50;
  let defense = 50;
  let rarity: "common" | "rare" | "epic" = "common";

  if (role === "F") {
    attack = Math.min(
      93,
      40 + (seasonData.goals || 0) + (seasonData.assists || 0) / 2,
    );
    defense = Math.min(90, 30 + (seasonData.plusMinus || 0) * 2);
  } else if (role === "D") {
    attack = Math.min(
      91,
      35 + (seasonData.goals || 0) * 2 + (seasonData.assists || 0),
    );
    defense = Math.min(93, 50 + (seasonData.plusMinus || 0) * 3);
  } else if (role === "G") {
    attack = Math.min(72, 20 + (seasonData.wins || 0));
    defense = Math.min(94, 60 + (seasonData.wins || 0) * 2);
  }

  const totalStats = attack + defense;
  if (totalStats >= 150) rarity = "epic";
  else if (totalStats >= 120) rarity = "rare";

  return {
    name: displayName,
    type: rarity === "epic" ? "special" : "player",
    rarity,
    attack: Math.round(attack),
    defense: Math.round(defense),
    special_ability: getRandomAbility(displayName, role, rarity),
    player_id: String(player.id),
    image_url: player.headshot,
  };
};

export const cardService = {
  /**
   * Get all cards
   */
  async getAllCards() {
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .order("rarity", { ascending: false });

    assertCardsRelationsExist(error);
    return data as Card[];
  },

  /**
   * Get user's card collection
   */
  async getUserCards(userId: string) {
    const ownerId = await resolveOwnerId(userId);

    const { data, error } = await supabase
      .from("card_collections")
      .select("*, card:cards(*)")
      .eq("user_id", ownerId)
      .order("acquired_at", { ascending: false });

    assertCardCollectionsWriteAllowed(error);
    return data;
  },

  /**
   * Get cards available at user's level
   */
  async getCardsForLevel(level: number) {
    const rarityMap: Record<number, string[]> = {
      1: ["common"],
      5: ["common", "rare"],
      10: ["common", "rare", "epic"],
      20: ["common", "rare", "epic", "legendary"],
    };

    let availableRarities = ["common"];
    for (const [lvl, rarities] of Object.entries(rarityMap)) {
      if (level >= parseInt(lvl)) {
        availableRarities = rarities;
      }
    }

    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .in("rarity", availableRarities);

    if (error) throw error;
    return data as Card[];
  },

  /**
   * Create cards from GM roster players
   */
  async createPlayerCards(players: any[]) {
    const cards = players.map((player: RosterPlayer) =>
      buildCardPayloadFromPlayer(player),
    );

    const { data, error } = await supabase.from("cards").insert(cards).select();

    assertCardsRelationsExist(error);
    return data as Card[];
  },

  /**
   * Sync cards for all players in a user's saved roster.
   * Elite players keep their fixed cards, all other players get random non-legendary abilities.
   */
  async syncRosterCardsForUser(
    userId: string,
    players: RosterPlayer[],
    ownerIdOverride?: string,
  ) {
    const ownerId = ownerIdOverride ?? (await resolveOwnerId(userId));
    const generatedCards = players.map((player) =>
      buildCardPayloadFromPlayer(player),
    );
    const syncedCards: Card[] = [];

    for (const payload of generatedCards) {
      const { data: existingCard, error: lookupError } = await supabase
        .from("cards")
        .select("*")
        .eq("player_id", payload.player_id)
        .maybeSingle();

      assertCardsRelationsExist(lookupError);

      let card: Card;
      if (existingCard) {
        const { data: updatedCard, error: updateError } = await supabase
          .from("cards")
          .update({
            name: payload.name,
            type: payload.type,
            rarity: payload.rarity,
            attack: payload.attack,
            defense: payload.defense,
            special_ability: payload.special_ability,
            image_url: payload.image_url,
          })
          .eq("id", existingCard.id)
          .select()
          .single();

        assertCardsRelationsExist(updateError);
        card = updatedCard as Card;
      } else {
        const { data: insertedCard, error: insertError } = await supabase
          .from("cards")
          .insert(payload)
          .select()
          .single();

        assertCardsRelationsExist(insertError);
        card = insertedCard as Card;
      }

      syncedCards.push(card);

      // Ensure the user has at least one copy of each synced roster card.
      const { data: existingCollection, error: collectionLookupError } =
        await supabase
          .from("card_collections")
          .select("*")
          .eq("user_id", ownerId)
          .eq("card_id", card.id)
          .maybeSingle();

      assertCardCollectionsWriteAllowed(collectionLookupError);

      if (!existingCollection) {
        const { error: collectionInsertError } = await supabase
          .from("card_collections")
          .insert({
            user_id: ownerId,
            card_id: card.id,
            quantity: 1,
          });

        assertCardCollectionsWriteAllowed(collectionInsertError);
      }
    }

    return syncedCards;
  },

  /**
   * Add card to user's collection
   */
  async addCardToCollection(
    userId: string,
    cardId: string,
    quantity: number = 1,
  ) {
    // Check if user already has this card
    const { data: existing } = await supabase
      .from("card_collections")
      .select("*")
      .eq("user_id", userId)
      .eq("card_id", cardId)
      .single();

    if (existing) {
      // Update quantity
      const { data, error } = await supabase
        .from("card_collections")
        .update({ quantity: existing.quantity + quantity })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return data as CardCollection;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from("card_collections")
        .insert({
          user_id: userId,
          card_id: cardId,
          quantity,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CardCollection;
    }
  },

  /**
   * Open a card pack (reward for leveling up)
   */
  async openCardPack(
    userId: string,
    packType: "starter" | "bronze" | "silver" | "gold",
  ) {
    const packSizes = {
      starter: 5,
      bronze: 3,
      silver: 5,
      gold: 7,
    };

    const rarityWeights = {
      starter: { common: 90, rare: 10, epic: 0, legendary: 0 },
      bronze: { common: 70, rare: 25, epic: 5, legendary: 0 },
      silver: { common: 50, rare: 35, epic: 13, legendary: 2 },
      gold: { common: 30, rare: 40, epic: 25, legendary: 5 },
    };

    const packSize = packSizes[packType];
    const weights = rarityWeights[packType];

    // Get all available cards
    const { data: allCards } = await supabase.from("cards").select("*");
    if (!allCards) return [];

    // Randomly select cards based on rarity weights
    const pulledCards: Card[] = [];

    for (let i = 0; i < packSize; i++) {
      const rand = Math.random() * 100;
      let rarity: "common" | "rare" | "epic" | "legendary";

      if (rand < weights.common) rarity = "common";
      else if (rand < weights.common + weights.rare) rarity = "rare";
      else if (rand < weights.common + weights.rare + weights.epic)
        rarity = "epic";
      else rarity = "legendary";

      const cardsOfRarity = allCards.filter((c) => c.rarity === rarity);
      if (cardsOfRarity.length > 0) {
        const randomCard =
          cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
        pulledCards.push(randomCard);

        // Add to user's collection
        await this.addCardToCollection(userId, randomCard.id);
      }
    }

    return pulledCards;
  },
};
