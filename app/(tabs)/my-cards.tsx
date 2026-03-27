import AuthScreen from "@/components/auth/AuthScreen";
import { colors } from "@/components/theme/colors";
import { spacing } from "@/components/theme/spacing";
import { typography } from "@/components/theme/typography";
import { useAuth } from "@/contexts/AuthContext";
import { cardService } from "@/services/cards";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

type CollectionRow = {
  id: string;
  quantity: number;
  card: {
    id: string;
    name: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    attack: number;
    defense: number;
    special_ability: string | null;
    image_url: string | null;
  } | null;
};

const rarityColor: Record<"common" | "rare" | "epic" | "legendary", string> = {
  common: "#6E7C99",
  rare: "#4DA3FF",
  epic: "#FFB454",
  legendary: "#FF5C7A",
};

export default function MyCardsScreen() {
  const { loading, user } = useAuth();
  const [cards, setCards] = useState<CollectionRow[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingCards(true);
      setError(null);

      const data = await cardService.getUserCards(user.id);
      const normalized = (data ?? [])
        .map((row: any) => {
          const rawCard = Array.isArray(row.card) ? row.card[0] : row.card;
          if (!rawCard) return null;

          return {
            id: row.id,
            quantity: row.quantity ?? 1,
            card: {
              id: rawCard.id,
              name: rawCard.name,
              rarity: rawCard.rarity,
              attack: rawCard.attack,
              defense: rawCard.defense,
              special_ability: rawCard.special_ability,
              image_url: rawCard.image_url,
            },
          } as CollectionRow;
        })
        .filter(Boolean) as CollectionRow[];

      setCards(normalized);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load cards.");
    } finally {
      setLoadingCards(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const summary = useMemo(() => {
    const totals = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (const row of cards) {
      const rarity = row.card?.rarity;
      if (rarity) totals[rarity] += row.quantity;
    }
    return totals;
  }, [cards]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>My Cards</Text>
      <Text style={[typography.caption, { marginTop: spacing.xs }]}>
        {user.email}
      </Text>

      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: rarityColor.common }]}>
          C {summary.common}
        </Text>
        <Text style={[styles.summaryText, { color: rarityColor.rare }]}>
          R {summary.rare}
        </Text>
        <Text style={[styles.summaryText, { color: rarityColor.epic }]}>
          E {summary.epic}
        </Text>
        <Text style={[styles.summaryText, { color: rarityColor.legendary }]}>
          L {summary.legendary}
        </Text>
        <Pressable style={styles.refreshButton} onPress={loadCards}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>

      {loadingCards && (
        <View style={{ marginTop: spacing.md }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {!loadingCards && cards.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={typography.body}>No cards yet.</Text>
          <Text style={[typography.caption, { marginTop: spacing.sm }]}>
            Save your roster in GM mode to generate and sync cards.
          </Text>
        </View>
      )}

      <FlatList
        contentContainerStyle={{
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
        }}
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (!item.card) return null;

          return (
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardName}>{item.card.name}</Text>
                  <View
                    style={[
                      styles.rarityPill,
                      { borderColor: rarityColor[item.card.rarity] },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rarityText,
                        { color: rarityColor[item.card.rarity] },
                      ]}
                    >
                      {item.card.rarity.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.statsText}>
                  ATK {item.card.attack} | DEF {item.card.defense} | Qty{" "}
                  {item.quantity}
                </Text>

                <Text style={styles.abilityText}>
                  {item.card.special_ability ?? "No special ability."}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  summaryRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryText: {
    fontWeight: "700",
  },
  refreshButton: {
    marginLeft: "auto",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  refreshButtonText: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  error: {
    marginTop: spacing.md,
    color: colors.danger,
  },
  emptyState: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
  },
  cardRow: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardName: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 16,
    flexShrink: 1,
  },
  rarityPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statsText: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontWeight: "600",
  },
  abilityText: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
