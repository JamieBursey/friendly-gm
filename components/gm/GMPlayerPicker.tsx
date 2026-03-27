import { useDebounce } from "@/components/hooks/useDebounce"; // wherever you put it
import { colors } from "@/components/theme/colors";
import { spacing } from "@/components/theme/spacing";
import { typography } from "@/components/theme/typography";
import { useAuth } from "@/contexts/AuthContext";
import { cardService } from "@/services/cards";
import { rosterService } from "@/services/database";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type SearchResult = {
  playerId: string;
  name: string;
  currentTeamAbbrev?: string;
};
type ActivePlayer = {
  playerId: string;
  name: string;
  position: string; // "C" | "LW" | "RW" | "D" | "G"
  teamAbbrev?: string;
};

type PlayerProfile = {
  id: number | string;
  firstName: any;
  lastName: any;
  sweaterNumber?: number;
  position?: string;
  teamAbbrev?: string;
  headshot?: string;
  seasonTotals?: any[];
};
type RosterCounts = { F: number; D: number; G: number; total: number };

const API_BASE = "https://newmerc-backend.vercel.app";

export default function GMPlayerPicker() {
  const { signOut, user } = useAuth();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 350);

  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingSavedRoster, setLoadingSavedRoster] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [selected, setSelected] = useState<PlayerProfile | null>(null);
  const [gmRoster, setGmRoster] = useState<PlayerProfile[]>([]);

  const getRole = (pos?: string): "F" | "D" | "G" | "?" => {
    if (!pos) return "?";
    const p = pos.toUpperCase().trim();

    // Handle split or multi-position values like "C/RW" or "LW-RW".
    const tokens = p.split(/[\s/,-]+/).filter(Boolean);

    if (
      tokens.includes("G") ||
      tokens.includes("GK") ||
      tokens.includes("GOALIE")
    ) {
      return "G";
    }
    if (
      tokens.includes("D") ||
      tokens.includes("LD") ||
      tokens.includes("RD")
    ) {
      return "D";
    }
    if (
      tokens.includes("F") ||
      tokens.includes("C") ||
      tokens.includes("LW") ||
      tokens.includes("RW") ||
      tokens.includes("W") ||
      tokens.includes("L") ||
      tokens.includes("R") ||
      tokens.includes("LEFT WING") ||
      tokens.includes("RIGHT WING")
    ) {
      return "F";
    }

    // Fallback for verbose values such as "RIGHT WING" / "CENTER".
    if (p.includes("CENTER") || p.includes("WING") || p.includes("FORWARD")) {
      return "F";
    }
    if (p.includes("DEFENSE")) return "D";
    if (p.includes("GOAL")) return "G";

    return "?";
  };

  const getCounts = (roster: PlayerProfile[]): RosterCounts => {
    let F = 0,
      D = 0,
      G = 0;
    for (const p of roster) {
      const role = getRole(p.position);
      if (role === "F") F++;
      else if (role === "D") D++;
      else if (role === "G") G++;
    }
    return { F, D, G, total: roster.length };
  };

  const samePlayerId = (a: string | number, b: string | number) =>
    String(a) === String(b);

  const counts = useMemo<RosterCounts>(() => getCounts(gmRoster), [gmRoster]);

  const searchPlayers = async (name: string) => {
    const url = `${API_BASE}/api/search?q=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Search failed");
    return (await res.json()) as SearchResult[];
  };
  const ROSTER_RULES = { F: 15, D: 8, G: 2, TOTAL: 25 };
  const fetchPlayerProfile = async (playerId: string) => {
    const url = `${API_BASE}/api/player?id=${encodeURIComponent(playerId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Profile fetch failed");
    const data = await res.json();
    console.log("FULL PROFILE DATA:", JSON.stringify(data, null, 2));

    // normalize output
    const profile: PlayerProfile = {
      id: data.playerId ?? data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      sweaterNumber: data.sweaterNumber,
      position: data.position,
      teamAbbrev: data.currentTeamAbbrev,
      headshot: data.headshot,
      seasonTotals: data.seasonTotals,
    };

    return profile;
  };

  // Autocomplete
  useEffect(() => {
    let alive = true;

    (async () => {
      const q = debounced.trim();
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const results = await searchPlayers(q);
        if (!alive) return;
        setSuggestions(results.slice(0, 20));
        setShowSuggestions(true);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Search error");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [debounced]);

  const selectPlayer = async (p: SearchResult) => {
    try {
      setShowSuggestions(false);
      setQuery(p.name);
      setLoadingProfile(true);
      setError(null);

      const profile = await fetchPlayerProfile(p.playerId);
      setSelected(profile);
    } catch (e: any) {
      setError(e?.message ?? "Profile error");
    } finally {
      setLoadingProfile(false);
    }
  };

  const addSelectedToRoster = () => {
    if (!selected) return;

    let blockReason: string | null = null;

    setGmRoster((prev) => {
      if (prev.some((p) => samePlayerId(p.id, selected.id))) {
        blockReason = "That player is already on your roster.";
        return prev;
      }

      const role = getRole(selected.position);
      const nextCounts = getCounts(prev);

      if (role === "?") {
        blockReason =
          "This player cannot be added because the position is unknown.";
        return prev;
      }
      if (role === "F" && nextCounts.F >= ROSTER_RULES.F) {
        blockReason = `Forward slots are full (${ROSTER_RULES.F}/${ROSTER_RULES.F}). Remove a forward first.`;
        return prev;
      }
      if (role === "D" && nextCounts.D >= ROSTER_RULES.D) {
        blockReason = `Defense slots are full (${ROSTER_RULES.D}/${ROSTER_RULES.D}). Remove a defenseman first.`;
        return prev;
      }
      if (role === "G" && nextCounts.G >= ROSTER_RULES.G) {
        blockReason = `Goalie slots are full (${ROSTER_RULES.G}/${ROSTER_RULES.G}). Remove a goalie first.`;
        return prev;
      }
      if (nextCounts.total >= ROSTER_RULES.TOTAL) {
        blockReason = `Roster is full (${ROSTER_RULES.TOTAL}/${ROSTER_RULES.TOTAL}). Remove a player first.`;
        return prev;
      }

      return [...prev, selected];
    });

    if (blockReason) {
      setError(blockReason);
      return;
    }

    setError(null);
    setSelected(null);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };
  const removeFromRoster = (id: number | string) => {
    setError(null);
    setGmRoster((prev) => prev.filter((p) => !samePlayerId(p.id, id)));
  };

  const parseStoredPlayers = (raw: unknown): PlayerProfile[] => {
    if (Array.isArray(raw)) return raw as PlayerProfile[];
    if (typeof raw !== "string") return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PlayerProfile[]) : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadLatestRoster = async () => {
      if (!user?.id) return;

      try {
        setLoadingSavedRoster(true);
        const rosters = await rosterService.getUserRosters(user.id);
        if (!mounted || rosters.length === 0) return;

        const latest = rosters[0];
        const players = parseStoredPlayers((latest as any).players);
        if (players.length > 0) {
          setGmRoster(players);
          setSaveSuccess(`Loaded saved roster: ${latest.name}`);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Failed to load saved roster.");
      } finally {
        if (mounted) setLoadingSavedRoster(false);
      }
    };

    loadLatestRoster();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const fetchActivePool = async (): Promise<ActivePlayer[]> => {
    const res = await fetch(`${API_BASE}/api/active`);
    if (!res.ok) throw new Error("Failed to load active players");
    const data: ActivePlayer[] = await res.json();
    return data;
  };

  const autoFillRoster = async () => {
    setError(null);
    setSaveSuccess(null);
    setLoadingProfile(true); // or create a new autoFillLoading state

    try {
      // reset
      setGmRoster([]);
      setSelected(null);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);

      const pool = shuffle(await fetchActivePool());

      let needF = ROSTER_RULES.F;
      let needD = ROSTER_RULES.D;
      let needG = ROSTER_RULES.G;

      const picked: PlayerProfile[] = [];

      for (const p of pool) {
        if (picked.length >= ROSTER_RULES.TOTAL) break;

        const role = getRole(p.position);

        if (role === "F" && needF <= 0) continue;
        if (role === "D" && needD <= 0) continue;
        if (role === "G" && needG <= 0) continue;
        if (role === "?") continue;

        const profile = await fetchPlayerProfile(p.playerId);
        if (!profile) continue;

        if (picked.some((x) => x.id === profile.id)) continue;

        picked.push(profile);

        if (role === "F") needF--;
        if (role === "D") needD--;
        if (role === "G") needG--;
      }

      if (picked.length !== ROSTER_RULES.TOTAL) {
        setError("Auto-fill couldn’t complete the roster. Try again.");
      }

      setGmRoster(picked);
    } catch (e: any) {
      setError(e?.message ?? "Auto-fill failed");
    } finally {
      setLoadingProfile(false);
    }
  };

  const saveRosterToSupabase = async () => {
    if (!user?.id) {
      setError("You must be signed in to save rosters.");
      return;
    }
    if (gmRoster.length === 0) {
      setError("Add at least one player before saving.");
      return;
    }

    try {
      setSavingRoster(true);
      setError(null);
      setSaveSuccess(null);

      const rosterName = `Roster ${new Date().toLocaleString()}`;
      const savedRoster = await rosterService.saveRoster(
        user.id,
        rosterName,
        gmRoster,
      );
      await cardService.syncRosterCardsForUser(
        user.id,
        gmRoster,
        String((savedRoster as any).user_id),
      );

      setSaveSuccess("Roster saved and cards synced.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save roster.");
    } finally {
      setSavingRoster(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      setError(null);
      setSaveSuccess(null);
      await signOut();
    } catch (e: any) {
      setError(e?.message ?? "Failed to sign out.");
    } finally {
      setSigningOut(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.lg,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    headerMeta: {
      flex: 1,
    },
    accountText: {
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    input: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: colors.textPrimary,
    },
    suggestionsBox: {
      marginTop: spacing.sm,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      overflow: "hidden",
      maxHeight: 260,
    },
    suggestionRow: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    suggestionName: {
      color: colors.textPrimary,
      fontWeight: "600",
      flex: 1,
      marginRight: spacing.md,
    },
    suggestionMeta: {
      color: colors.textMuted,
    },
    playerCard: {
      marginTop: spacing.lg,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 20,
      padding: spacing.lg,
    },
    playerName: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    playerMeta: {
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    primaryButton: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 16,
      alignItems: "center",
    },
    primaryButtonText: {
      color: "#0B1220",
      fontWeight: "800",
    },
    secondaryButton: {
      marginTop: spacing.sm,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontWeight: "700",
    },
  });
  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerMeta}>
          <Text style={typography.h1}>GM Home</Text>
          <Text style={styles.accountText}>{user?.email ?? "Signed in"}</Text>
        </View>
        <Pressable
          style={[styles.secondaryButton, signingOut && { opacity: 0.7 }]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Text style={styles.secondaryButtonText}>
            {signingOut ? "Signing out..." : "Sign Out"}
          </Text>
        </Pressable>
      </View>

      <Text style={[typography.body, { marginTop: spacing.md }]}>
        Roster: {counts.total}/{ROSTER_RULES.TOTAL} — F {counts.F}/
        {ROSTER_RULES.F} • D {counts.D}/{ROSTER_RULES.D} • G {counts.G}/
        {ROSTER_RULES.G}
      </Text>
      <Pressable style={styles.primaryButton} onPress={autoFillRoster}>
        <Text style={styles.primaryButtonText}>Auto Fill Roster</Text>
      </Pressable>
      <Pressable
        style={[styles.primaryButton, savingRoster && { opacity: 0.7 }]}
        onPress={saveRosterToSupabase}
        disabled={savingRoster}
      >
        <Text style={styles.primaryButtonText}>
          {savingRoster ? "Saving..." : "Save Roster"}
        </Text>
      </Pressable>
      <Text style={[typography.body, { marginTop: spacing.sm }]}>
        Search any NHL player and add them to your team.
      </Text>

      {loadingSavedRoster && (
        <Text style={[typography.caption, { marginTop: spacing.sm }]}>
          Loading saved roster...
        </Text>
      )}

      {saveSuccess && (
        <Text
          style={[
            typography.body,
            { color: colors.primary, marginTop: spacing.sm },
          ]}
        >
          {saveSuccess}
        </Text>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setShowSuggestions(true);
          }}
          placeholder="Search players (e.g. McDavid)…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="words"
        />

        {loading && (
          <View style={{ marginTop: spacing.sm }}>
            <ActivityIndicator />
          </View>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={suggestions}
              keyExtractor={(item) => item.playerId}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => selectPlayer(item)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.suggestionName}>{item.name}</Text>
                  <Text style={styles.suggestionMeta}>
                    {item.currentTeamAbbrev ?? ""}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        )}

        {error && (
          <Text
            style={[
              typography.body,
              { color: colors.danger, marginTop: spacing.md },
            ]}
          >
            {error}
          </Text>
        )}

        {loadingProfile && (
          <Text style={[typography.caption, { marginTop: spacing.md }]}>
            Loading player profile…
          </Text>
        )}

        {selected && (
          <View style={styles.playerCard}>
            <Text style={styles.playerName}>
              {selected.firstName?.default ?? ""}{" "}
              {selected.lastName?.default ?? ""}
            </Text>
            <Text style={styles.playerMeta}>
              #{selected.sweaterNumber ?? "--"} • {selected.position ?? "?"} •{" "}
              {selected.teamAbbrev ?? ""}
            </Text>

            {/* Next step: Add button to save to user's GM roster */}
            <Pressable
              style={styles.primaryButton}
              onPress={addSelectedToRoster}
            >
              <Text style={styles.primaryButtonText}>Add to My Team</Text>
            </Pressable>
          </View>
        )}
      </View>
      {gmRoster.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={typography.h2}>My Roster</Text>
          {gmRoster.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              {gmRoster.map((player) => (
                <View
                  key={String(player.id)}
                  style={{
                    marginTop: spacing.sm,
                    padding: spacing.md,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      flex: 1,
                      marginRight: spacing.md,
                    }}
                  >
                    #{player.sweaterNumber ?? "--"} {player.firstName?.default}{" "}
                    {player.lastName?.default} • {player.position ?? "?"}
                  </Text>

                  <Pressable
                    onPress={() => removeFromRoster(player.id)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.danger,
                    }}
                  >
                    <Text style={{ color: colors.danger, fontWeight: "700" }}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
