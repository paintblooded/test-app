import "react-native-gesture-handler";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

function Router() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0];
    const isAuthRoute = first === "auth" || first === undefined || first === "index";
    if (!user && !isAuthRoute) {
      router.replace("/");
    } else if (user) {
      if (!user.onboarded) {
        if (first !== "onboarding") router.replace("/onboarding");
      } else if (isAuthRoute || first === "onboarding") {
        router.replace("/(tabs)/home");
      }
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.purple} size="large" />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="projects/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="swipe" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <Router />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
