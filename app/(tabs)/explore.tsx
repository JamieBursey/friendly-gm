import AuthScreen from "@/components/auth/AuthScreen";
import { sortedCoachesForDisplay } from "@/components/game/coaches";
import {
  getRecord,
  getSavedDeck,
  recordLoss,
  recordWin,
  saveDeck,
} from "@/components/game/storage";
import type {
  Difficulty,
  GameCard,
  PlaySide,
  SavedDeck,
} from "@/components/game/types";
import {
  DECK_SIZE,
  MAX_LEGENDARY_CARDS,
  MIN_PLAYER_CARDS,
  deckErrorMessage,
  validateDeck,
} from "@/components/game/types";
import MatchScreen from "@/components/screens/MatchScreen";
import { colors } from "@/components/theme/colors";
import { spacing } from "@/components/theme/spacing";
import { useAuth } from "@/contexts/AuthContext";
import { cardService } from "@/services/cards";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "hub"
  | "difficulty"
  | "coach"
  | "deck-builder"
  | "match"
  | "result";

type CollectionRow = {
  id: string;
  quantity: number;
  card: GameCard | null;
};

const RARITY_COLOR: Record<string, string> = {
  common: "#6E7C99",
  rare: "#4DA3FF",
  epic: "#FFB454",
  legendary: "#FF5C7A",
};

const DIFFICULTY_INFO: Record<
  Difficulty,
  { label: string; desc: string; aiDesc: string; color: string }
> = {
  easy: {
    label: "Easy",
    desc: "Learn the ropes",
    aiDesc: "AI: common & rare cards only",
    color: colors.success,
  },
  normal: {
    label: "Normal",
    desc: "A real challenge",
    aiDesc: "AI: 1 legendary + mix of rare/epic",
    color: colors.warning,
  },
  hard: {
    label: "Hard",
    desc: "Bring everything you have",
    aiDesc: "AI: 3 legendaries + all high-stat cards",
    color: colors.danger,
  },
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CardGameScreen() {
  const { loading, user } = useAuth();
  const coachUnlockContext = {
    email: user?.email ?? null,
    publicUserId: user?.id ?? null,
    username:
      (user?.user_metadata as { username?: string } | undefined)?.username ??
      null,
  };

  const [screen, setScreen] = useState<Screen>("hub");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [selectedCoachId, setSelectedCoachId] = useState<string>("aggressive");
  const [activeDeck, setActiveDeck] = useState<GameCard[]>([]);
  const [matchResult, setMatchResult] = useState<{
    winner: PlaySide | null;
    goals: [number, number];
  } | null>(null);

  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [savedDeck, setSavedDeck] = useState<SavedDeck | null>(null);

  const [collection, setCollection] = useState<CollectionRow[]>([]);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());

  // Load record & saved deck
  useEffect(() => {
    if (!user) return;
    getRecord().then(({ wins: w, losses: l }) => {
      setWins(w);
      setLosses(l);
    });
    getSavedDeck().then((d) => setSavedDeck(d));
  }, [user]);

  // Load collection when entering deck builder
  useEffect(() => {
    if (screen !== "deck-builder" || !user) return;
    setLoadingCollection(true);
    cardService
      .getUserCards(user.id)
      .then((rows) => {
        const mapped = ((rows ?? []) as any[])
          .filter((r: any) => r.card)
          .map((r: any) => ({
            id: r.id,
            quantity: r.quantity ?? 1,
            card: r.card as GameCard,
          }));
        setCollection(mapped);
        if (savedDeck) {
          setPickedIds(new Set(savedDeck.cardIds));
        }
      })
      .finally(() => setLoadingCollection(false));
  }, [screen, user, savedDeck]);

  const pickedCards = useMemo(
    () =>
      collection
        .filter((row) => row.card && pickedIds.has(row.card.id))
        .map((row) => row.card as GameCard),
    [collection, pickedIds],
  );

  const deckErrors = useMemo(() => validateDeck(pickedCards), [pickedCards]);

  const toggleCardPick = useCallback((card: GameCard) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(card.id)) {
        next.delete(card.id);
      } else {
        if (next.size >= DECK_SIZE) return prev;
        next.add(card.id);
      }
      return next;
    });
  }, []);

  const handleSaveDeck = useCallback(async () => {
    const deck: SavedDeck = {
      name: "My Deck",
      cardIds: pickedCards.map((c) => c.id),
    };
    await saveDeck(deck);
    setSavedDeck(deck);
  }, [pickedCards]);

  const handleStartMatch = useCallback(() => {
    if (deckErrors.length > 0) return;
    setActiveDeck(pickedCards);
    setScreen("match");
  }, [deckErrors, pickedCards]);

  const handleMatchEnd = useCallback(
    async (winner: PlaySide | null, goals: [number, number]) => {
      setMatchResult({ winner, goals });
      if (winner === "player") {
        const newWins = await recordWin();
        setWins(newWins);
      } else if (winner === "ai") {
        await recordLoss();
        setLosses((l) => l + 1);
      }
      setScreen("result");
    },
    [],
  );

  const resetToHub = useCallback(() => {
    setScreen("hub");
    setMatchResult(null);
    setPickedIds(new Set());
  }, []);

  // ── Auth guard ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!user) return <AuthScreen />;

  // ── Match screen ─────────────────────────────────────────────────────────────

  if (screen === "match") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <MatchScreen
          playerDeck={activeDeck}
          playerCoachId={selectedCoachId}
          difficulty={difficulty}
          onMatchEnd={handleMatchEnd}
        />
      </SafeAreaView>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────────

  if (screen === "result" && matchResult) {
    const { winner, goals } = matchResult;
    const won = winner === "player";
    const draw = winner === null;
    const unlocksThisWin = won
      ? sortedCoachesForDisplay(wins, coachUnlockContext).filter(
          (c) => !c.unlocked && c.coach.requiredWins <= wins,
        )
      : [];

    return (
      <SafeAreaView style={styles.centered}>
        <ScrollView contentContainerStyle={styles.centeredContent}>
          <Text style={styles.resultEmoji}>
            {won ? "🏆" : draw ? "🤝" : "💀"}
          </Text>
          <Text style={styles.resultTitle}>
            {won ? "Victory!" : draw ? "Draw!" : "Defeat"}
          </Text>
          <View style={styles.resultScoreRow}>
            <Text style={styles.resultScoreLabel}>YOU</Text>
            <Text style={styles.resultScore}>
              {goals[0]} – {goals[1]}
            </Text>
            <Text style={styles.resultScoreLabel}>CPU</Text>
          </View>
          <Text style={styles.recordText}>
            Record: {wins}W – {losses}L
          </Text>
          {unlocksThisWin.length > 0 && (
            <View style={styles.unlockBox}>
              <Text style={styles.unlockTitle}>🔓 Coach Unlocked!</Text>
              {unlocksThisWin.map(({ coach }) => (
                <Text key={coach.id} style={styles.unlockName}>
                  {coach.name}
                </Text>
              ))}
            </View>
          )}
          <Pressable style={styles.primaryBtn} onPress={resetToHub}>
            <Text style={styles.primaryBtnText}>Back to Hub</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Deck builder ─────────────────────────────────────────────────────────────

  if (screen === "deck-builder") {
    const legendaryCount = pickedCards.filter(
      (c) => c.rarity === "legendary",
    ).length;
    const playerCount = pickedCards.filter((c) => c.type === "player").length;

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.subHeader}>
          <Pressable onPress={() => setScreen("coach")}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.subTitle}>Build Your Deck</Text>
          <Pressable onPress={handleSaveDeck} disabled={deckErrors.length > 0}>
            <Text
              style={[
                styles.saveText,
                deckErrors.length > 0 && { opacity: 0.4 },
              ]}
            >
              Save ★
            </Text>
          </Pressable>
        </View>

        <View style={styles.deckMeter}>
          <Text style={styles.deckMeterCount}>
            {pickedCards.length}/{DECK_SIZE} cards selected
          </Text>
          <View style={styles.deckMeterRow}>
            <Text style={styles.deckMeterStat}>
              👤 {playerCount}/{MIN_PLAYER_CARDS} min players
            </Text>
            <Text style={styles.deckMeterStat}>
              🌟 {legendaryCount}/{MAX_LEGENDARY_CARDS} max legendaries
            </Text>
          </View>
          {deckErrors.length > 0 && (
            <View style={styles.deckErrors}>
              {deckErrors.map((e) => (
                <Text key={e} style={styles.deckErrorText}>
                  ⚠ {deckErrorMessage(e)}
                </Text>
              ))}
            </View>
          )}
        </View>

        {loadingCollection ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ flex: 1 }}
          />
        ) : (
          <FlatList
            data={collection}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.collectionList}
            renderItem={({ item }) => {
              if (!item.card) return null;
              const card = item.card;
              const picked = pickedIds.has(card.id);
              const atLegendaryLimit =
                card.rarity === "legendary" &&
                legendaryCount >= MAX_LEGENDARY_CARDS;
              const atDeckLimit = pickedCards.length >= DECK_SIZE;
              const canAdd = !picked && !atLegendaryLimit && !atDeckLimit;
              return (
                <Pressable
                  onPress={() =>
                    canAdd || picked ? toggleCardPick(card) : undefined
                  }
                  style={[
                    styles.collectionRow,
                    picked && styles.collectionRowPicked,
                    !canAdd && !picked && styles.collectionRowLocked,
                  ]}
                >
                  {card.image_url ? (
                    <Image
                      source={{ uri: card.image_url }}
                      style={styles.collectionImg}
                    />
                  ) : (
                    <View
                      style={[
                        styles.collectionImgPlaceholder,
                        { borderColor: RARITY_COLOR[card.rarity] },
                      ]}
                    >
                      <Text style={styles.collectionImgInitial}>
                        {card.name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.collectionInfo}>
                    <Text style={styles.collectionName} numberOfLines={1}>
                      {card.name}
                    </Text>
                    <Text
                      style={[
                        styles.collectionRarity,
                        { color: RARITY_COLOR[card.rarity] },
                      ]}
                    >
                      {card.rarity.toUpperCase()} · {card.type}
                    </Text>
                    <Text style={styles.collectionStats}>
                      ⚔ {card.attack} 🛡 {card.defense}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.collectionPick,
                      picked && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={styles.collectionPickText}>
                      {picked ? "✓" : "+"}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        <View style={styles.deckFooter}>
          <Pressable
            style={[
              styles.primaryBtn,
              deckErrors.length > 0 && styles.primaryBtnDisabled,
            ]}
            onPress={handleStartMatch}
            disabled={deckErrors.length > 0}
          >
            <Text style={styles.primaryBtnText}>
              {deckErrors.length === 0
                ? "Start Match! 🏒"
                : "Fix Deck to Continue"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Coach select ─────────────────────────────────────────────────────────────

  if (screen === "coach") {
    const coaches = sortedCoachesForDisplay(wins, coachUnlockContext);
    const activeCoach = coaches.find((c) => c.coach.id === selectedCoachId);

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.subHeader}>
          <Pressable onPress={() => setScreen("difficulty")}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.subTitle}>Pick Your Coach</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.coachList}>
          {coaches.map(({ coach, unlocked }) => {
            const selected = selectedCoachId === coach.id;
            return (
              <Pressable
                key={coach.id}
                onPress={() => unlocked && setSelectedCoachId(coach.id)}
                style={[
                  styles.coachCard,
                  selected && styles.coachCardSelected,
                  !unlocked && styles.coachCardLocked,
                ]}
              >
                <View style={styles.coachCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coachStyle}>{coach.style}</Text>
                    <Text style={styles.coachName}>{coach.name}</Text>
                    <Text style={styles.coachDesc}>{coach.desc}</Text>
                  </View>
                  {!unlocked ? (
                    <View style={styles.lockBadge}>
                      <Text style={styles.lockBadgeText}>
                        🔒 {coach.requiredWins}W
                      </Text>
                    </View>
                  ) : selected ? (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>✓</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.coachAbilities}>
                  <View style={styles.coachAbilityRow}>
                    <Text style={styles.coachAbilityLabel}>PASSIVE</Text>
                    <Text style={styles.coachAbilityText}>
                      {coach.passiveText}
                    </Text>
                  </View>
                  <View style={styles.coachAbilityRow}>
                    <Text style={styles.coachAbilityLabel}>ABILITY</Text>
                    <Text style={styles.coachAbilityText}>
                      {coach.abilityText}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.deckFooter}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setScreen("deck-builder")}
          >
            <Text style={styles.primaryBtnText}>
              Build Deck with {activeCoach?.coach.name ?? "Coach"} →
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Difficulty select ────────────────────────────────────────────────────────

  if (screen === "difficulty") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.subHeader}>
          <Pressable onPress={() => setScreen("hub")}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.subTitle}>Choose Difficulty</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.difficultyList}>
          {(["easy", "normal", "hard"] as Difficulty[]).map((d) => {
            const info = DIFFICULTY_INFO[d];
            return (
              <Pressable
                key={d}
                style={[
                  styles.difficultyCard,
                  difficulty === d && {
                    borderColor: info.color,
                    backgroundColor: `${info.color}14`,
                  },
                ]}
                onPress={() => setDifficulty(d)}
              >
                <View style={styles.difficultyRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.difficultyLabel, { color: info.color }]}
                    >
                      {info.label}
                    </Text>
                    <Text style={styles.difficultyDesc}>{info.desc}</Text>
                    <Text style={styles.difficultyAI}>{info.aiDesc}</Text>
                  </View>
                  {difficulty === d && (
                    <Text
                      style={[styles.difficultyCheck, { color: info.color }]}
                    >
                      ✓
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.deckFooter}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setScreen("coach")}
          >
            <Text style={styles.primaryBtnText}>Pick Coach →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Hub ──────────────────────────────────────────────────────────────────────

  const nextCoachUnlock = sortedCoachesForDisplay(
    wins,
    coachUnlockContext,
  ).find((c) => !c.unlocked);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.hubContent}>
        <Text style={styles.hubTitle}>⚡ Power Play</Text>
        <Text style={styles.hubSub}>Hockey Card Battle</Text>

        <View style={styles.recordCard}>
          <View style={styles.recordItem}>
            <Text style={styles.recordNum}>{wins}</Text>
            <Text style={styles.recordItemLabel}>WINS</Text>
          </View>
          <View style={styles.recordDivider} />
          <View style={styles.recordItem}>
            <Text style={styles.recordNum}>{losses}</Text>
            <Text style={styles.recordItemLabel}>LOSSES</Text>
          </View>
          <View style={styles.recordDivider} />
          <View style={styles.recordItem}>
            <Text style={styles.recordNum}>
              {wins + losses > 0
                ? Math.round((wins / (wins + losses)) * 100)
                : 0}
              %
            </Text>
            <Text style={styles.recordItemLabel}>WIN RATE</Text>
          </View>
        </View>

        <Pressable
          style={styles.playBtn}
          onPress={() => setScreen("difficulty")}
        >
          <Text style={styles.playBtnText}>🏒 Play vs CPU</Text>
        </Pressable>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Saved Deck</Text>
          {savedDeck ? (
            <Text style={styles.infoCardBody}>
              {savedDeck.name} · {savedDeck.cardIds.length} cards
            </Text>
          ) : (
            <Text style={styles.infoCardBody}>No deck saved yet.</Text>
          )}
          <Text style={styles.infoCardSub}>
            Pick your 10 cards in &quot;Build Deck&quot;
          </Text>
        </View>

        {nextCoachUnlock && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Next Coach Unlock</Text>
            <Text style={styles.infoCardBody}>
              {nextCoachUnlock.coach.name}
            </Text>
            <Text style={styles.infoCardSub}>
              Win {nextCoachUnlock.coach.requiredWins - wins} more
              {nextCoachUnlock.coach.requiredWins - wins !== 1
                ? " matches"
                : " match"}{" "}
              to unlock
            </Text>
          </View>
        )}

        <View style={styles.howToCard}>
          <Text style={styles.howToTitle}>How to Play</Text>
          <Text style={styles.howToBody}>
            {"• 3 periods · 5 plays each\n"}
            {"• Both sides secretly pick a card — then both reveal\n"}
            {"• ATK vs DEF determines the winner of each play\n"}
            {"• Win a play → 2 Momentum · Lose → 1 Momentum\n"}
            {"• Most Momentum when the period ends = Goal scored\n"}
            {"• Win 2 of 3 periods to win the match\n"}
            {"• Special & Legendary cards trigger bonus effects\n"}
            {"• Build up Coach charges → unleash a game-changing ability"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },

  // Hub
  hubContent: { padding: spacing.lg, gap: spacing.md },
  hubTitle: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1,
  },
  hubSub: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  recordCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    padding: spacing.md,
    justifyContent: "space-around",
    alignItems: "center",
  },
  recordItem: { alignItems: "center" },
  recordNum: { color: colors.textPrimary, fontSize: 28, fontWeight: "900" },
  recordItemLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  recordDivider: { width: 1, height: 40, backgroundColor: colors.border },
  playBtn: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: spacing.lg,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  playBtnText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  infoCardTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  infoCardBody: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  infoCardSub: { color: colors.textMuted, fontSize: 12, fontWeight: "500" },
  howToCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  howToTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  howToBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 22,
  },

  // Sub-screen header
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 15,
    width: 70,
  },
  subTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "800" },
  saveText: {
    color: colors.warning,
    fontWeight: "700",
    fontSize: 15,
    width: 60,
    textAlign: "right",
  },

  // Difficulty
  difficultyList: { flex: 1, padding: spacing.md, gap: spacing.md },
  difficultyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
  },
  difficultyRow: { flexDirection: "row", alignItems: "center" },
  difficultyLabel: { fontSize: 22, fontWeight: "900", marginBottom: 2 },
  difficultyDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  difficultyAI: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  difficultyCheck: { fontSize: 28, fontWeight: "900" },

  // Coach
  coachList: { padding: spacing.md, gap: spacing.md },
  coachCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  coachCardSelected: {
    borderColor: colors.primary,
    backgroundColor: "rgba(77,163,255,0.08)",
  },
  coachCardLocked: { opacity: 0.5 },
  coachCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  coachStyle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  coachName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  coachDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  lockBadge: {
    backgroundColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lockBadgeText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedBadgeText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  coachAbilities: { gap: 6 },
  coachAbilityRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  coachAbilityLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    width: 48,
    marginTop: 2,
  },
  coachAbilityText: {
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },

  // Deck builder
  deckMeter: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  deckMeterCount: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
  },
  deckMeterRow: { flexDirection: "row", gap: spacing.lg },
  deckMeterStat: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  deckErrors: { gap: 2 },
  deckErrorText: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  collectionList: { padding: spacing.md, gap: spacing.sm },
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  collectionRowPicked: {
    borderColor: colors.primary,
    backgroundColor: "rgba(77,163,255,0.06)",
  },
  collectionRowLocked: { opacity: 0.45 },
  collectionImg: {
    width: 48,
    height: 48,
    borderRadius: 8,
    resizeMode: "cover",
  },
  collectionImgPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: colors.cardElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  collectionImgInitial: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
  },
  collectionInfo: { flex: 1, gap: 2 },
  collectionName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  collectionRarity: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  collectionStats: { color: colors.textSecondary, fontSize: 12 },
  collectionPick: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  collectionPickText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  deckFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: "center",
  },
  primaryBtnDisabled: { backgroundColor: colors.border },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  // Result
  resultEmoji: { fontSize: 72, textAlign: "center" },
  resultTitle: {
    color: colors.textPrimary,
    fontSize: 40,
    fontWeight: "900",
    textAlign: "center",
  },
  resultScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  resultScoreLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  resultScore: {
    color: colors.textPrimary,
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: 3,
  },
  recordText: { color: colors.textSecondary, fontSize: 16, fontWeight: "600" },
  unlockBox: {
    backgroundColor: "rgba(255,180,84,0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    alignItems: "center",
    gap: 4,
  },
  unlockTitle: { color: colors.warning, fontWeight: "800", fontSize: 16 },
  unlockName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
});
