import AuthScreen from "@/components/auth/AuthScreen";
import GMPlayerPicker from "@/components/gm/GMPlayerPicker";
import { colors } from "@/components/theme/colors";
import { useAuth } from "@/contexts/AuthContext";
import { ActivityIndicator, View } from "react-native";

export default function GMHome() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <GMPlayerPicker />;
}
