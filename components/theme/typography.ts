import { colors } from "./colors";

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },
  h2: {
    fontSize: 22,
    fontWeight: "600" as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: colors.textMuted,
  },
};