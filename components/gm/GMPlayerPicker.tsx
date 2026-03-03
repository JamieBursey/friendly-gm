import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useDebounce } from "@/components/hooks/useDebounce"; // wherever you put it
import { colors } from "@/components/theme/colors";
import { spacing } from "@/components/theme/spacing";
import { typography } from "@/components/theme/typography";

type SearchResult = {
  playerId: string;
  name: string;
  currentTeamAbbrev?: string;
};

type PlayerProfile = {
  id: number | string;
  firstName: any;
  lastName: any;
  sweaterNumber?: number;
  position?:string
  teamAbbrev?: string;
  headshot?: string;
  seasonTotals?: any[];
};
type RosterCounts = { F: number; D: number; G: number; total: number };

const API_BASE = "https://newmerc-backend.vercel.app";

export default function GMPlayerPicker() {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 350);

  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<PlayerProfile | null>(null);
  const [gmRoster, setGmRoster] = useState<PlayerProfile[]>([]);

const getRole = (pos?: string): "F" | "D" | "G" | "?" => {
  if (!pos) return "?";
  const p = pos.toUpperCase();
  if (p === "D") return "D";
  if (p === "G") return "G";
  if (p === "C" || p === "LW" || p === "RW" || p === "F") return "F";
  return "?";
};

const counts = useMemo<RosterCounts>(() => {
  let F = 0, D = 0, G = 0;
  for (const p of gmRoster) {
    const role = getRole(p.position);
    if (role === "F") F++;
    else if (role === "D") D++;
    else if (role === "G") G++;
  }
  return { F, D, G, total: gmRoster.length };
}, [gmRoster]);

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
    if (gmRoster.some((p) => p.id === selected.id)) return;
  
    const role = getRole(selected.position);
  
    // Block unknown positions
    if (role === "?") return;
  
    // Enforce role limits
    if (role === "F" && counts.F >= ROSTER_RULES.F) return;
    if (role === "D" && counts.D >= ROSTER_RULES.D) return;
    if (role === "G" && counts.G >= ROSTER_RULES.G) return;
  
    // Enforce total limit
    if (counts.total >= ROSTER_RULES.TOTAL) return;
  
    setGmRoster((prev) => [...prev, selected]);
  
    setSelected(null);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };
  const removeFromRoster = (id: number | string) => {
    setGmRoster((prev) => prev.filter((p) => p.id !== id));
  };
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.lg,
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
  });
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>GM Home</Text>
      
      <Text style={[typography.body, { marginTop: spacing.md }]}>
  Roster: {counts.total}/{ROSTER_RULES.TOTAL} — F {counts.F}/{ROSTER_RULES.F} • D {counts.D}/{ROSTER_RULES.D} • G {counts.G}/{ROSTER_RULES.G}
</Text>
      <Text style={[typography.body, { marginTop: spacing.sm }]}>
        Search any NHL player and add them to your team.
      </Text>

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
          <Text style={[typography.body, { color: colors.danger, marginTop: spacing.md }]}>
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
              {selected.firstName?.default ?? ""} {selected.lastName?.default ?? ""}
            </Text>
            <Text style={styles.playerMeta}>
              #{selected.sweaterNumber ?? "--"} • {selected.position ?? "?"} •{" "}
              {selected.teamAbbrev ?? ""}
            </Text>

            {/* Next step: Add button to save to user's GM roster */}
<Pressable style={styles.primaryButton} onPress={addSelectedToRoster}>
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
        <Text style={{ color: colors.textSecondary, flex: 1, marginRight: spacing.md }}>
          #{player.sweaterNumber ?? "--"} {player.firstName?.default} {player.lastName?.default} •{" "}
          {player.position ?? "?"}
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
          <Text style={{ color: colors.danger, fontWeight: "700" }}>Remove</Text>
        </Pressable>
      </View>
    ))}
  </View>
)}
  </View>
)}
    </View>
  );
}

