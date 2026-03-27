import AuthScreen from "@/components/auth/AuthScreen";
import { colors } from "@/components/theme/colors";
import { spacing } from "@/components/theme/spacing";
import { typography } from "@/components/theme/typography";
import { useAuth } from "@/contexts/AuthContext";
import { cardService } from "@/services/cards";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    FlatList,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

type CardRarity = "common" | "rare" | "epic" | "legendary";
type CardType = "player" | "special" | "legendary";
type FilterMode = "all" | CardRarity;
type SortMode = "rarity" | "attack" | "defense" | "name";

type CollectionRow = {
  id: string;
  quantity: number;
  card: {
    id: string;
    name: string;
    type: CardType;
    rarity: CardRarity;
    attack: number;
    defense: number;
    special_ability: string | null;
    image_url: string | null;
  } | null;
};

const rarityColor: Record<CardRarity, string> = {
  common: "#6E7C99",
  rare: "#4DA3FF",
  epic: "#FFB454",
  legendary: "#FF5C7A",
};

const rarityWeight: Record<CardRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const typeColor: Record<CardType, string> = {
  player: colors.textSecondary,
  special: colors.warning,
  legendary: colors.danger,
};

const getModalFlavorText = (card: NonNullable<CollectionRow["card"]>) => {
  if (card.type === "legendary") {
    return {
      eyebrow: "Legacy-tier pull",
      description:
        "A top-shelf signature card built to anchor a lineup. Legendary cards carry premium ceilings and the strongest table presence in the collection.",
      highlights: [
        { label: "Burst", value: Math.max(card.attack, card.defense) },
        { label: "Aura", value: card.attack + card.defense },
        { label: "Class", value: "Mythic" },
      ],
    };
  }

  if (card.type === "special") {
    return {
      eyebrow: "Featured impact card",
      description:
        "Special cards sit above the standard roster curve. They are tuned to swing momentum with stronger traits and sharper ability profiles.",
      highlights: [
        { label: "Pressure", value: card.attack },
        { label: "Control", value: card.defense },
        { label: "Trait", value: "Elite" },
      ],
    };
  }

  return {
    eyebrow: "Roster core card",
    description:
      "Standard player cards are generated from current roster production and form the reliable backbone of your collection.",
    highlights: [
      { label: "Attack", value: card.attack },
      { label: "Defense", value: card.defense },
      { label: "Tier", value: card.rarity.toUpperCase() },
    ],
  };
};

export default function MyCardsScreen() {
  const { loading, user } = useAuth();
  const [cards, setCards] = useState<CollectionRow[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("rarity");
  const [selectedCard, setSelectedCard] = useState<CollectionRow | null>(null);
  const modalEntrance = useState(() => new Animated.Value(0))[0];
  const modalShimmer = useState(() => new Animated.Value(0))[0];

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
              type: rawCard.type,
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
    return cards.reduce(
      (acc: Record<CardRarity, number>, item) => {
        if (item.card) {
          acc[item.card.rarity] += item.quantity;
        }
        return acc;
      },
      { common: 0, rare: 0, epic: 0, legendary: 0 },
    );
  }, [cards]);

  const visibleCards = useMemo(() => {
    const filtered = cards.filter((item) => {
      if (!item.card) return false;
      if (filterMode === "all") return true;
      return item.card.rarity === filterMode;
    });

    return [...filtered].sort((left, right) => {
      if (!left.card || !right.card) return 0;

      if (sortMode === "attack") {
        return right.card.attack - left.card.attack;
      }

      if (sortMode === "defense") {
        return right.card.defense - left.card.defense;
      }

      if (sortMode === "name") {
        return left.card.name.localeCompare(right.card.name);
      }

      const rarityDelta =
        rarityWeight[right.card.rarity] - rarityWeight[left.card.rarity];
      if (rarityDelta !== 0) return rarityDelta;
      return right.card.attack - left.card.attack;
    });
  }, [cards, filterMode, sortMode]);

  const modalFlavor = useMemo(() => {
    if (!selectedCard?.card) return null;
    return getModalFlavorText(selectedCard.card);
  }, [selectedCard]);

  const modalIsFeatured =
    selectedCard?.card?.type !== "player" ||
    selectedCard?.card?.rarity === "legendary";

  useEffect(() => {
    if (!selectedCard?.card) {
      modalEntrance.stopAnimation();
      modalShimmer.stopAnimation();
      modalEntrance.setValue(0);
      modalShimmer.setValue(0);
      return;
    }

    modalEntrance.setValue(0);
    Animated.spring(modalEntrance, {
      toValue: 1,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
      useNativeDriver: true,
    }).start();

    modalShimmer.stopAnimation();
    modalShimmer.setValue(0);

    if (modalIsFeatured) {
      Animated.loop(
        Animated.timing(modalShimmer, {
          toValue: 1,
          duration: selectedCard.card.rarity === "legendary" ? 1500 : 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ).start();
    }

    return () => {
      modalEntrance.stopAnimation();
      modalShimmer.stopAnimation();
    };
  }, [modalEntrance, modalIsFeatured, modalShimmer, selectedCard]);

  const modalCardAnimatedStyle = {
    opacity: modalEntrance,
    transform: [
      {
        translateY: modalEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [26, 0],
        }),
      },
      {
        scale: modalEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  const shimmerAnimatedStyle = {
    opacity: modalIsFeatured
      ? modalShimmer.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.12, 0.26, 0.12],
        })
      : 0,
    transform: [
      {
        translateX: modalShimmer.interpolate({
          inputRange: [0, 1],
          outputRange: [-220, 260],
        }),
      },
      { rotate: "18deg" },
    ],
  };

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Pressable
          style={[styles.chip, filterMode === "all" && styles.chipActive]}
          onPress={() => setFilterMode("all")}
        >
          <Text
            style={[
              styles.chipText,
              filterMode === "all" && styles.chipTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>
        {(["common", "rare", "epic", "legendary"] as CardRarity[]).map(
          (rarity) => (
            <Pressable
              key={rarity}
              style={[
                styles.chip,
                filterMode === rarity && styles.chipActive,
                filterMode === rarity && { borderColor: rarityColor[rarity] },
              ]}
              onPress={() => setFilterMode(rarity)}
            >
              <Text
                style={[
                  styles.chipText,
                  filterMode === rarity && { color: rarityColor[rarity] },
                ]}
              >
                {rarity.toUpperCase()}
              </Text>
            </Pressable>
          ),
        )}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowCompact}
      >
        <Pressable
          style={[styles.chip, sortMode === "rarity" && styles.chipActive]}
          onPress={() => setSortMode("rarity")}
        >
          <Text
            style={[
              styles.chipText,
              sortMode === "rarity" && styles.chipTextActive,
            ]}
          >
            Sort: Rarity
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, sortMode === "attack" && styles.chipActive]}
          onPress={() => setSortMode("attack")}
        >
          <Text
            style={[
              styles.chipText,
              sortMode === "attack" && styles.chipTextActive,
            ]}
          >
            Sort: ATK
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, sortMode === "defense" && styles.chipActive]}
          onPress={() => setSortMode("defense")}
        >
          <Text
            style={[
              styles.chipText,
              sortMode === "defense" && styles.chipTextActive,
            ]}
          >
            Sort: DEF
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, sortMode === "name" && styles.chipActive]}
          onPress={() => setSortMode("name")}
        >
          <Text
            style={[
              styles.chipText,
              sortMode === "name" && styles.chipTextActive,
            ]}
          >
            Sort: Name
          </Text>
        </Pressable>
      </ScrollView>

      {loadingCards && (
        <View style={{ marginTop: spacing.md }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {!loadingCards && visibleCards.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={typography.body}>
            {cards.length === 0
              ? "No cards yet."
              : "No cards match the current filter."}
          </Text>
          <Text style={[typography.caption, { marginTop: spacing.sm }]}>
            {cards.length === 0
              ? "Save your roster in GM mode to generate and sync cards."
              : "Try another rarity filter or sort mode."}
          </Text>
        </View>
      )}

      <FlatList
        contentContainerStyle={{
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
        }}
        data={visibleCards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (!item.card) return null;

          return (
            <Pressable
              style={styles.cardRow}
              onPress={() => setSelectedCard(item)}
            >
              <View style={styles.cardPreview}>
                {item.card.image_url ? (
                  <Image
                    source={{ uri: item.card.image_url }}
                    style={styles.cardArt}
                  />
                ) : (
                  <View style={styles.cardArtPlaceholder}>
                    <Text style={styles.cardArtPlaceholderText}>
                      {item.card.rarity.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardContent}>
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
                <Text style={styles.typeText}>Type: {item.card.type}</Text>
                <Text numberOfLines={2} style={styles.abilityText}>
                  {item.card.special_ability ?? "No special ability."}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal
        animationType="fade"
        transparent
        visible={!!selectedCard}
        onRequestClose={() => setSelectedCard(null)}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View
            style={[
              styles.modalCard,
              selectedCard?.card?.rarity === "legendary" &&
                styles.modalCardLegendary,
              selectedCard?.card &&
                (selectedCard.card.type !== "player" ||
                  selectedCard.card.rarity === "legendary") &&
                styles.modalCardElite,
              modalCardAnimatedStyle,
            ]}
          >
            {selectedCard?.card && (
              <>
                <View
                  style={[
                    styles.modalPreview,
                    { borderColor: rarityColor[selectedCard.card.rarity] },
                    selectedCard.card.rarity === "legendary" &&
                      styles.modalPreviewLegendary,
                  ]}
                >
                  <View
                    style={[
                      styles.modalAccentBar,
                      {
                        backgroundColor: rarityColor[selectedCard.card.rarity],
                      },
                    ]}
                  />
                  {selectedCard.card.image_url ? (
                    <Image
                      source={{ uri: selectedCard.card.image_url }}
                      style={styles.modalArt}
                    />
                  ) : (
                    <View style={styles.modalArtPlaceholder}>
                      <Text style={styles.modalArtPlaceholderText}>
                        {selectedCard.card.name}
                      </Text>
                    </View>
                  )}
                  {modalIsFeatured && (
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.modalShimmerBeam, shimmerAnimatedStyle]}
                    />
                  )}
                </View>

                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderContent}>
                    <Text style={styles.modalName}>
                      {selectedCard.card.name}
                    </Text>

                    <View style={styles.modalBadgeRow}>
                      <View
                        style={[
                          styles.modalBadge,
                          {
                            borderColor: rarityColor[selectedCard.card.rarity],
                          },
                          styles.modalBadgeStrong,
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalBadgeText,
                            { color: rarityColor[selectedCard.card.rarity] },
                          ]}
                        >
                          {selectedCard.card.rarity.toUpperCase()}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.modalBadge,
                          { borderColor: typeColor[selectedCard.card.type] },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalBadgeText,
                            { color: typeColor[selectedCard.card.type] },
                          ]}
                        >
                          {selectedCard.card.type.toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.modalBadge}>
                        <Text style={styles.modalBadgeText}>
                          QTY {selectedCard.quantity}
                        </Text>
                      </View>

                      {(selectedCard.card.type !== "player" ||
                        selectedCard.card.rarity === "legendary") && (
                        <View
                          style={[styles.modalBadge, styles.modalEliteBadge]}
                        >
                          <Text
                            style={[
                              styles.modalBadgeText,
                              styles.modalEliteBadgeText,
                            ]}
                          >
                            ELITE
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.modalBadgeOrb,
                      { borderColor: rarityColor[selectedCard.card.rarity] },
                      selectedCard.card.rarity === "legendary" &&
                        styles.modalBadgeOrbLegendary,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalBadgeOrbText,
                        { color: rarityColor[selectedCard.card.rarity] },
                      ]}
                    >
                      {selectedCard.card.attack + selectedCard.card.defense}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalMeta}>{modalFlavor?.eyebrow}</Text>
                <Text style={styles.modalDescription}>
                  {modalFlavor?.description}
                </Text>

                <View style={styles.modalCalloutRow}>
                  {modalFlavor?.highlights.map((highlight) => (
                    <View key={highlight.label} style={styles.modalCalloutCard}>
                      <Text style={styles.modalCalloutLabel}>
                        {highlight.label}
                      </Text>
                      <Text
                        style={styles.modalCalloutValue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        {highlight.value}
                      </Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.modalStats}>
                  ATK {selectedCard.card.attack} | DEF{" "}
                  {selectedCard.card.defense}
                </Text>
                <Text style={styles.modalAbility}>
                  {selectedCard.card.special_ability ?? "No special ability."}
                </Text>

                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setSelectedCard(null)}
                >
                  <Text style={styles.modalCloseButtonText}>Close</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
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
  chipRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  chipRowCompact: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.cardElevated,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: colors.textPrimary,
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
    flexDirection: "row",
    gap: spacing.md,
  },
  cardPreview: {
    width: 72,
    height: 96,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardElevated,
  },
  cardArt: {
    width: "100%",
    height: "100%",
  },
  cardArtPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  cardArtPlaceholderText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  typeText: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontWeight: "600",
    fontSize: 12,
  },
  abilityText: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: spacing.lg,
  },
  modalCardElite: {
    backgroundColor: "#16233D",
    shadowColor: colors.primaryGlow,
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  modalCardLegendary: {
    borderColor: colors.danger,
    backgroundColor: "#221623",
    shadowColor: colors.danger,
  },
  modalPreview: {
    height: 220,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.cardElevated,
    marginBottom: spacing.md,
    borderWidth: 1,
    position: "relative",
  },
  modalPreviewLegendary: {
    backgroundColor: "#2B1825",
  },
  modalAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    zIndex: 2,
  },
  modalShimmerBeam: {
    position: "absolute",
    top: -40,
    bottom: -40,
    width: 120,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    zIndex: 3,
  },
  modalArt: {
    width: "100%",
    height: "100%",
  },
  modalArtPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalArtPlaceholderText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  modalHeaderContent: {
    flex: 1,
    gap: spacing.sm,
  },
  modalName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    flex: 1,
  },
  modalBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  modalBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  modalBadgeStrong: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modalBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  modalEliteBadge: {
    borderColor: colors.warning,
    backgroundColor: "rgba(255, 180, 84, 0.12)",
  },
  modalEliteBadgeText: {
    color: colors.warning,
  },
  modalBadgeOrb: {
    minWidth: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  modalBadgeOrbLegendary: {
    backgroundColor: "rgba(255, 92, 122, 0.12)",
  },
  modalBadgeOrbText: {
    fontSize: 14,
    fontWeight: "900",
  },
  modalMeta: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontWeight: "600",
    lineHeight: 18,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  modalDescription: {
    color: colors.textPrimary,
    marginTop: spacing.sm,
    lineHeight: 21,
  },
  modalCalloutRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCalloutCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalCalloutLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalCalloutValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 6,
  },
  modalStats: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: "700",
  },
  modalAbility: {
    color: colors.textPrimary,
    marginTop: spacing.md,
    lineHeight: 22,
  },
  modalCloseButton: {
    alignSelf: "flex-end",
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  modalCloseButtonText: {
    color: colors.background,
    fontWeight: "800",
  },
});
