import AuthScreen from "@/components/auth/AuthScreen";
import { colors } from "@/components/theme/colors";
import { spacing } from "@/components/theme/spacing";
import { typography } from "@/components/theme/typography";
import { useAuth } from "@/contexts/AuthContext";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function CardGameScreen() {
  const { loading, signOut, user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
    } finally {
      setSigningOut(false);
    }
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
      <View style={styles.headerRow}>
        <View style={styles.headerMeta}>
          <Text style={typography.h1}>Card Game</Text>
          <Text style={styles.accountText}>{user.email ?? "Signed in"}</Text>
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

      <View style={styles.card}>
        <Text style={styles.title}>Deck builder and battles come next.</Text>
        <Text style={styles.body}>
          This tab is protected by auth. Signing out here returns you to the
          login screen so you can sign in as a different user.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
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
  card: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
