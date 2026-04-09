import { Redirect } from "expo-router";
import { useUser } from "@/context/UserContext";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { userId, isLoading } = useUser();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (userId) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/onboarding" />;
}
