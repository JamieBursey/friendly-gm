import { aiSelectCard, buildAIDeck } from "@/components/game/ai";
import { getCoach } from "@/components/game/coaches";
import {
    advanceCoachCharge,
    BASE_HAND_SIZE,
    buildPeriodResult,
    buildPlayFlags,
    createInitialMatchState,
    dealHand,
    PLAYS_PER_PERIOD,
    resolvePlay,
    TOTAL_PERIODS,
} from "@/components/game/engine";
import type {
    Difficulty,
    GameCard,
    GamePhase,
    MatchState,
    PlaySide,
} from "@/components/game/types";
import { colors } from "@/components/theme/colors";
import { spacing } from "@/components/theme/spacing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

// ─── Constants ────────────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common: "#6E7C99",
  rare: "#4DA3FF",
  epic: "#FFB454",
  legendary: "#FF5C7A",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardThumbnail({
  card,
  selected,
  onPress,
  disabled,
}: {
  card: GameCard;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.handCard,
        { borderColor: RARITY_COLOR[card.rarity] },
        selected && styles.handCardSelected,
        disabled && styles.handCardDisabled,
      ]}
    >
      {card.image_url ? (
        <Image source={{ uri: card.image_url }} style={styles.handCardImg} />
      ) : (
        <View style={styles.handCardNoImg}>
          <Text style={styles.handCardInitial}>
            {card.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <Text style={styles.handCardName} numberOfLines={1}>
        {card.name}
      </Text>
      <Text
        style={[styles.handCardRarity, { color: RARITY_COLOR[card.rarity] }]}
      >
        {card.rarity.toUpperCase()}
      </Text>
      <Text style={styles.handCardStats}>
        ⚔{card.attack} 🛡{card.defense}
      </Text>
    </Pressable>
  );
}

function FaceDownCard({ label }: { label: string }) {
  return (
    <View style={styles.faceDown}>
      <Text style={styles.faceDownLabel}>{label}</Text>
      <Text style={styles.faceDownIcon}>🃏</Text>
    </View>
  );
}

function MomentumBar({
  playerMom,
  aiMom,
}: {
  playerMom: number;
  aiMom: number;
}) {
  const total = Math.max(playerMom + aiMom, 1);
  const playerPct = (playerMom / total) * 100;
  return (
    <View style={styles.momBarWrap}>
      <Text style={styles.momLabel}>🔵 {playerMom}</Text>
      <View style={styles.momTrack}>
        <View
          style={[styles.momFillPlayer, { width: `${playerPct}%` as any }]}
        />
        <View
          style={[styles.momFillAI, { width: `${100 - playerPct}%` as any }]}
        />
      </View>
      <Text style={styles.momLabel}>{aiMom} 🔴</Text>
    </View>
  );
}

function PeriodPips({ results }: { results: MatchState["periodResults"] }) {
  return (
    <View style={styles.periodPips}>
      {Array.from({ length: TOTAL_PERIODS }).map((_, i) => {
        const r = results[i];
        const color = !r
          ? colors.border
          : r.winner === "player"
            ? colors.primary
            : r.winner === "ai"
              ? colors.danger
              : colors.textMuted;
        return (
          <View key={i} style={[styles.pip, { backgroundColor: color }]} />
        );
      })}
    </View>
  );
}

// ─── Main MatchScreen ─────────────────────────────────────────────────────────

interface Props {
  playerDeck: GameCard[];
  playerCoachId: string;
  difficulty: Difficulty;
  onMatchEnd: (winner: PlaySide | null, goals: [number, number]) => void;
}

export default function MatchScreen({
  playerDeck,
  playerCoachId,
  difficulty,
  onMatchEnd,
}: Props) {
  const aiCoachId = "defensive"; // AI always uses The Wall
  const aiDeckRef = useRef<GameCard[]>(buildAIDeck(difficulty));

  const [state, setState] = useState<MatchState>(() =>
    createInitialMatchState(
      playerDeck,
      aiDeckRef.current,
      playerCoachId,
      aiCoachId,
      difficulty,
    ),
  );

  const [selectedCard, setSelectedCard] = useState<GameCard | null>(null);
  const [abilityToggled, setAbilityToggled] = useState(false);

  // Reveal animation
  const revealAnim = useRef(new Animated.Value(0)).current;

  const animateReveal = useCallback(() => {
    revealAnim.setValue(0);
    Animated.spring(revealAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [revealAnim]);

  // ── Phase helpers ──────────────────────────────────────────────────────────

  const confirmSet = useCallback(() => {
    if (!selectedCard) return;

    // Build flags (apply ability if toggled)
    const flags = buildPlayFlags(state, abilityToggled);

    // AI picks
    const aiCard = aiSelectCard(
      state.aiHand,
      state.period,
      state.playIndex,
      state.playerMomentum,
      state.aiMomentum,
      difficulty,
    );

    // Resolve
    const result = resolvePlay(selectedCard, aiCard, flags, playerCoachId);

    // Remove played cards from hands
    const newPlayerHand = state.playerHand.filter(
      (c) => c.id !== selectedCard.id,
    );
    const newAiHand = state.aiHand.filter((c) => c.id !== aiCard.id);

    // Draw one replacement card each (if available) so hands don't dead-end.
    const playerDraw = state.playerDeckRemaining[0] ?? null;
    const aiDraw = state.aiDeckRemaining[0] ?? null;
    const nextPlayerHand = playerDraw
      ? [...newPlayerHand, playerDraw]
      : newPlayerHand;
    const nextAiHand = aiDraw ? [...newAiHand, aiDraw] : newAiHand;
    const nextPlayerDeckRemaining = playerDraw
      ? state.playerDeckRemaining.slice(1)
      : state.playerDeckRemaining;
    const nextAiDeckRemaining = aiDraw
      ? state.aiDeckRemaining.slice(1)
      : state.aiDeckRemaining;

    // Advance coach charge (only if ability was NOT used this play)
    let nextState: MatchState = {
      ...state,
      phase: "reveal" as GamePhase,
      playerHand: nextPlayerHand,
      aiHand: nextAiHand,
      playerDeckRemaining: nextPlayerDeckRemaining,
      aiDeckRemaining: nextAiDeckRemaining,
      playerSetCard: selectedCard,
      aiSetCard: aiCard,
      lastPlayResult: result,
      playerMomentum: state.playerMomentum + result.playerMomGain,
      aiMomentum: state.aiMomentum + result.aiMomGain,
      flags,
    };

    if (abilityToggled) {
      nextState = {
        ...nextState,
        playerAbilityReady: false,
        playerAbilityActive: false,
        playerCoachCharge: 0,
      };
    } else {
      nextState = advanceCoachCharge(nextState);
    }

    setSelectedCard(null);
    setAbilityToggled(false);
    setState(nextState);
    animateReveal();
  }, [
    selectedCard,
    state,
    abilityToggled,
    difficulty,
    playerCoachId,
    animateReveal,
  ]);

  const advanceAfterReveal = useCallback(() => {
    const nextPlayIndex = state.playIndex + 1;

    if (nextPlayIndex >= PLAYS_PER_PERIOD) {
      // Period ends
      const periodResult = buildPeriodResult(state);
      const newPeriodResults = [...state.periodResults, periodResult];

      const playerGoals =
        state.playerGoals + (periodResult.winner === "player" ? 1 : 0);
      const aiGoals = state.aiGoals + (periodResult.winner === "ai" ? 1 : 0);

      const nextPeriod = state.period + 1;

      if (nextPeriod > TOTAL_PERIODS) {
        // Match over
        const matchWinner: PlaySide | null =
          playerGoals > aiGoals
            ? "player"
            : aiGoals > playerGoals
              ? "ai"
              : null;
        setState((s) => ({
          ...s,
          phase: "match_end",
          periodResults: newPeriodResults,
          playerGoals,
          aiGoals,
          matchWinner,
        }));
        return;
      }

      // Start next period — redeal hands from remaining deck
      const coach = getCoach(playerCoachId);
      const handSize = coach.passiveExtraCard
        ? BASE_HAND_SIZE + 1
        : BASE_HAND_SIZE;

      // Reset each period from the full deck so 3 periods are always playable.
      const { hand: newPlayerHand, remaining: newPlayerRem } = dealHand(
        playerDeck,
        handSize,
      );
      const { hand: newAiHand, remaining: newAiRem } = dealHand(
        aiDeckRef.current,
        BASE_HAND_SIZE,
      );

      setState((s) => ({
        ...s,
        phase: "period_end",
        period: nextPeriod,
        playIndex: 0,
        playerHand: newPlayerHand,
        aiHand: newAiHand,
        playerDeckRemaining: newPlayerRem,
        aiDeckRemaining: newAiRem,
        playerMomentum: 0,
        aiMomentum: 0,
        periodResults: newPeriodResults,
        playerGoals,
        aiGoals,
        playerSetCard: null,
        aiSetCard: null,
      }));
    } else {
      setState((s) => ({
        ...s,
        phase: "set",
        playIndex: nextPlayIndex,
        playerSetCard: null,
        aiSetCard: null,
      }));
    }
  }, [state, playerCoachId, playerDeck]);

  const startNextPeriod = useCallback(() => {
    setState((s) => ({ ...s, phase: "set" }));
  }, []);

  // ── Match end trigger ──────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase === "match_end") {
      // Small delay then call parent
      const t = setTimeout(() => {
        onMatchEnd(state.matchWinner, [state.playerGoals, state.aiGoals]);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [
    state.phase,
    state.matchWinner,
    state.playerGoals,
    state.aiGoals,
    onMatchEnd,
  ]);

  // ── Reveal animation style ────────────────────────────────────────────────

  const revealStyle = {
    opacity: revealAnim,
    transform: [
      {
        scale: revealAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.88, 1],
        }),
      },
    ],
  };

  const coach = getCoach(playerCoachId);

  // ── Render: Period End ─────────────────────────────────────────────────────

  if (state.phase === "period_end") {
    const latest = state.periodResults[state.periodResults.length - 1];
    const periodWon = latest?.winner === "player";
    return (
      <View style={styles.centeredOverlay}>
        <Text style={styles.overlayTitle}>
          {periodWon
            ? "🏒 Period Won!"
            : latest?.winner === "ai"
              ? "😤 Period Lost"
              : "⚡ Period Draw!"}
        </Text>
        <Text style={styles.overlayBody}>
          Momentum: {latest?.playerMomentum} vs {latest?.aiMomentum}
        </Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>YOU</Text>
          <Text style={styles.scoreBig}>
            {state.playerGoals} – {state.aiGoals}
          </Text>
          <Text style={styles.scoreText}>CPU</Text>
        </View>
        <PeriodPips results={state.periodResults} />
        {state.period <= TOTAL_PERIODS && (
          <Pressable style={styles.primaryBtn} onPress={startNextPeriod}>
            <Text style={styles.primaryBtnText}>
              Start Period {state.period} →
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── Render: Match End ───────────────────────────────────────────────────────

  if (state.phase === "match_end") {
    const won = state.matchWinner === "player";
    return (
      <View style={styles.centeredOverlay}>
        <Text style={styles.overlayTitle}>
          {won
            ? "🏆 Victory!"
            : state.matchWinner === "ai"
              ? "💀 Defeat"
              : "🤝 Draw!"}
        </Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>YOU</Text>
          <Text style={styles.scoreBig}>
            {state.playerGoals} – {state.aiGoals}
          </Text>
          <Text style={styles.scoreText}>CPU</Text>
        </View>
        <Text style={styles.overlayBody}>Returning to hub…</Text>
      </View>
    );
  }

  // ── Render: Main board ─────────────────────────────────────────────────────

  const phase = state.phase;
  const isReveal = phase === "reveal";
  const noCardsAvailable = phase === "set" && state.playerHand.length === 0;

  return (
    <View style={styles.board}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerPeriod}>
            Period {state.period}/{TOTAL_PERIODS} Play {state.playIndex + 1}/
            {PLAYS_PER_PERIOD}
          </Text>
          <PeriodPips results={state.periodResults} />
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>YOU</Text>
          <Text style={styles.scoreMini}>
            {state.playerGoals}–{state.aiGoals}
          </Text>
          <Text style={styles.scoreText}>CPU</Text>
        </View>
      </View>

      {/* ── Momentum bar ── */}
      <MomentumBar playerMom={state.playerMomentum} aiMom={state.aiMomentum} />

      {/* ── Play area ── */}
      <View style={styles.playArea}>
        {/* AI side */}
        <View style={styles.sideZone}>
          <Text style={styles.sideLabel}>OPPONENT</Text>
          {isReveal && state.aiSetCard ? (
            <Animated.View style={[styles.playedCardWrap, revealStyle]}>
              <View
                style={[
                  styles.playedCard,
                  { borderColor: RARITY_COLOR[state.aiSetCard.rarity] },
                  styles.aiCard,
                ]}
              >
                {state.aiSetCard.image_url ? (
                  <Image
                    source={{ uri: state.aiSetCard.image_url }}
                    style={styles.playedCardImg}
                  />
                ) : (
                  <Text style={styles.playedCardInitial}>
                    {state.aiSetCard.name.charAt(0)}
                  </Text>
                )}
                <Text style={styles.playedCardName} numberOfLines={1}>
                  {state.aiSetCard.name}
                </Text>
                <Text style={styles.playedCardStats}>
                  ⚔{state.lastPlayResult?.aiEffATK ?? state.aiSetCard.attack} 🛡
                  {state.lastPlayResult?.aiEffDEF ?? state.aiSetCard.defense}
                </Text>
              </View>
            </Animated.View>
          ) : phase === "set" && state.aiSetCard ? (
            <FaceDownCard label="Ready" />
          ) : (
            <FaceDownCard label="Waiting…" />
          )}
        </View>

        {/* Center divider */}
        <View style={styles.vsDivider}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Player side */}
        <View style={styles.sideZone}>
          <Text style={styles.sideLabel}>YOU</Text>
          {isReveal && state.playerSetCard ? (
            <Animated.View style={[styles.playedCardWrap, revealStyle]}>
              <View
                style={[
                  styles.playedCard,
                  { borderColor: RARITY_COLOR[state.playerSetCard.rarity] },
                  styles.playerCard,
                ]}
              >
                {state.playerSetCard.image_url ? (
                  <Image
                    source={{ uri: state.playerSetCard.image_url }}
                    style={styles.playedCardImg}
                  />
                ) : (
                  <Text style={styles.playedCardInitial}>
                    {state.playerSetCard.name.charAt(0)}
                  </Text>
                )}
                <Text style={styles.playedCardName} numberOfLines={1}>
                  {state.playerSetCard.name}
                </Text>
                <Text style={styles.playedCardStats}>
                  ⚔
                  {state.lastPlayResult?.playerEffATK ??
                    state.playerSetCard.attack}{" "}
                  🛡
                  {state.lastPlayResult?.playerEffDEF ??
                    state.playerSetCard.defense}
                </Text>
              </View>
            </Animated.View>
          ) : selectedCard ? (
            <View
              style={[
                styles.playedCard,
                { borderColor: RARITY_COLOR[selectedCard.rarity] },
                styles.playerCard,
              ]}
            >
              <Text style={styles.playedCardInitial}>
                {selectedCard.name.charAt(0)}
              </Text>
              <Text style={styles.playedCardName} numberOfLines={1}>
                {selectedCard.name} ✓
              </Text>
            </View>
          ) : (
            <FaceDownCard label="Pick below" />
          )}
        </View>
      </View>

      {/* ── Narrative / result ── */}
      {isReveal && state.lastPlayResult && (
        <Animated.View style={[styles.narrativeBox, revealStyle]}>
          <Text style={styles.narrativeText}>
            {state.lastPlayResult.narrative}
          </Text>
          {state.lastPlayResult.abilityFired && (
            <Text style={styles.abilityFiredText}>
              🌟 {state.lastPlayResult.abilityFired}
            </Text>
          )}
        </Animated.View>
      )}

      {/* ── Hand / controls ── */}
      {phase === "set" && (
        <>
          {/* Coach ability button */}
          {state.playerAbilityReady && (
            <Pressable
              style={[
                styles.abilityBtn,
                abilityToggled && styles.abilityBtnActive,
              ]}
              onPress={() => setAbilityToggled((v) => !v)}
            >
              <Text style={styles.abilityBtnIcon}>⚡</Text>
              <Text style={styles.abilityBtnLabel}>
                {abilityToggled ? "Ability ON" : "Use Ability"}
              </Text>
              <Text style={styles.abilityBtnSub} numberOfLines={2}>
                {coach.abilityText}
              </Text>
            </Pressable>
          )}

          {/* Hand */}
          <Text style={styles.handTitle}>Your Hand</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.handRow}
          >
            {state.playerHand.map((card) => (
              <CardThumbnail
                key={card.id}
                card={card}
                selected={selectedCard?.id === card.id}
                onPress={() =>
                  setSelectedCard((prev) =>
                    prev?.id === card.id ? null : card,
                  )
                }
              />
            ))}
          </ScrollView>

          <Pressable
            style={[
              styles.primaryBtn,
              !noCardsAvailable && !selectedCard && styles.primaryBtnDisabled,
            ]}
            onPress={noCardsAvailable ? advanceAfterReveal : confirmSet}
            disabled={!noCardsAvailable && !selectedCard}
          >
            <Text style={styles.primaryBtnText}>
              {noCardsAvailable
                ? state.playIndex + 1 >= PLAYS_PER_PERIOD
                  ? "End Period →"
                  : "Skip Play →"
                : selectedCard
                  ? `Play ${selectedCard.name}`
                  : "Select a Card"}
            </Text>
          </Pressable>
        </>
      )}

      {/* ── Reveal controls ── */}
      {isReveal && (
        <Pressable style={styles.primaryBtn} onPress={advanceAfterReveal}>
          <Text style={styles.primaryBtnText}>
            {state.playIndex + 1 >= PLAYS_PER_PERIOD
              ? "End Period →"
              : "Next Play →"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  board: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  headerPeriod: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Period pips
  periodPips: { flexDirection: "row", gap: 6, marginTop: 4 },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },

  // Score
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  scoreText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  scoreMini: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
  },
  scoreBig: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 2,
  },

  // Momentum
  momBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  momTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    flexDirection: "row",
    overflow: "hidden",
  },
  momFillPlayer: { backgroundColor: colors.primary, height: "100%" },
  momFillAI: { backgroundColor: colors.danger, height: "100%" },
  momLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "800" },

  // Play area
  playArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  sideZone: { flex: 1, alignItems: "center", gap: 4 },
  sideLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Face-down card placeholder
  faceDown: {
    width: 90,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.card,
  },
  faceDownLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  faceDownIcon: { fontSize: 28, marginTop: 4 },

  // Played / revealed card
  playedCardWrap: { alignItems: "center" },
  playedCard: {
    width: 90,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: colors.cardElevated,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  playerCard: {
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  aiCard: {
    shadowColor: colors.danger,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  playedCardImg: {
    width: 60,
    height: 60,
    borderRadius: 8,
    resizeMode: "cover",
  },
  playedCardInitial: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  playedCardName: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 2,
  },
  playedCardStats: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 2,
  },

  // VS divider
  vsDivider: { alignItems: "center" },
  vsText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },

  // Narrative
  narrativeBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  narrativeText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },
  abilityFiredText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },

  // Coach ability button
  abilityBtn: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.warning,
    backgroundColor: "rgba(255,180,84,0.08)",
    padding: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  abilityBtnActive: {
    backgroundColor: "rgba(255,180,84,0.22)",
    borderColor: colors.warning,
  },
  abilityBtnIcon: { fontSize: 22 },
  abilityBtnLabel: {
    color: colors.warning,
    fontWeight: "800",
    fontSize: 14,
  },
  abilityBtnSub: {
    color: colors.textMuted,
    fontSize: 10,
    flex: 1,
  },

  // Hand
  handTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  handRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  handCard: {
    width: 80,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: colors.card,
    padding: 6,
    alignItems: "center",
    gap: 2,
  },
  handCardSelected: {
    backgroundColor: colors.cardElevated,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
    transform: [{ translateY: -4 }],
  },
  handCardDisabled: { opacity: 0.4 },
  handCardImg: {
    width: 52,
    height: 52,
    borderRadius: 8,
    resizeMode: "cover",
  },
  handCardNoImg: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  handCardInitial: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  handCardName: {
    color: colors.textPrimary,
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
  },
  handCardRarity: {
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  handCardStats: {
    color: colors.textSecondary,
    fontSize: 8,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryBtnDisabled: {
    backgroundColor: colors.border,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },

  // Overlay screens (period end / match end)
  centeredOverlay: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  overlayTitle: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
  },
  overlayBody: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
