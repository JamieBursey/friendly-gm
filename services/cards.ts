import { supabase } from "@/lib/supabase";
import type { Card, CardCollection } from "@/types/database";

export const cardService = {
  /**
   * Get all cards
   */
  async getAllCards() {
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .order("rarity", { ascending: false });

    if (error) throw error;
    return data as Card[];
  },

  /**
   * Get user's card collection
   */
  async getUserCards(userId: string) {
    const { data, error } = await supabase
      .from("card_collections")
      .select("*, card:cards(*)")
      .eq("user_id", userId);

    if (error) throw error;
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
    const cards = players.map((player) => {
      // Calculate card stats based on player position and season totals
      const position = player.position;
      const seasonData = player.seasonTotals?.[0] || {};

      let attack = 50;
      let defense = 50;
      let rarity: "common" | "rare" | "epic" | "legendary" = "common";

      // Calculate attack based on offensive stats
      if (
        position === "F" ||
        position === "C" ||
        position === "LW" ||
        position === "RW"
      ) {
        attack = Math.min(
          100,
          40 + (seasonData.goals || 0) + (seasonData.assists || 0) / 2,
        );
        defense = Math.min(100, 30 + (seasonData.plusMinus || 0) * 2);
      } else if (position === "D") {
        attack = Math.min(
          100,
          35 + (seasonData.goals || 0) * 2 + (seasonData.assists || 0),
        );
        defense = Math.min(100, 50 + (seasonData.plusMinus || 0) * 3);
      } else if (position === "G") {
        attack = Math.min(100, 20);
        defense = Math.min(100, 60 + (seasonData.wins || 0) * 2);
      }

      // Determine rarity based on overall performance
      const totalStats = attack + defense;
      if (totalStats >= 180) rarity = "legendary";
      else if (totalStats >= 150) rarity = "epic";
      else if (totalStats >= 120) rarity = "rare";

      return {
        name: `${player.firstName?.default || ""} ${player.lastName?.default || ""}`,
        type: "player" as const,
        rarity,
        attack: Math.round(attack),
        defense: Math.round(defense),
        special_ability: null,
        player_id: player.id,
        image_url: player.headshot,
      };
    });

    const { data, error } = await supabase.from("cards").insert(cards).select();

    if (error) throw error;
    return data as Card[];
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
