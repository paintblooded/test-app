import React from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, text, radius } from "@/src/theme";
import { GradientButton } from "@/src/components/UI";

export default function Index() {
  const { signInWithGoogle, loading, user } = useAuth();
  const [busy, setBusy] = React.useState(false);

  const handleSignIn = async () => {
    try {
      setBusy(true);
      await signInWithGoogle();
    } catch (e: any) {
      console.warn("signIn err", e?.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading || user) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.purple} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: "https://static.prod-images.emergentagent.com/jobs/0116f9a6-8637-42d9-b6c1-b4685b0a070f/images/a72f39cdb04bdb83b6c394a0333a8e0e1c81a0040c55534bddfc5dc52c7af51e.png" }}
        style={styles.bg}
      />
      <LinearGradient
        colors={["rgba(15,15,15,0.3)", "rgba(15,15,15,0.95)", colors.bg]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <Feather name="radio" size={26} color={colors.purple} />
            </View>
            <Text style={styles.brand}>SONARA</Text>
          </View>

          <View style={{ flex: 1 }} />

          <View style={styles.heroBlock}>
            <Text style={styles.hero}>Find your next{"\n"}collaboration.</Text>
            <Text style={styles.sub}>
              Jam sessions, gigs, producer meetups, and band auditions — built for musicians.
            </Text>
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
            <GradientButton
              testID="google-signin-button"
              label={busy ? "Signing in..." : "Continue with Google"}
              icon="user-check"
              loading={busy}
              onPress={handleSignIn}
            />
            <Text style={styles.legal}>
              By continuing, you agree to SONARA&apos;s Terms & Privacy.
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Feature icon="calendar" label="Events" />
            <Feature icon="users" label="Match" />
            <Feature icon="music" label="Projects" />
            <Feature icon="message-circle" label="Chat" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Feature({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.feat}>
      <Feather name={icon} size={18} color={colors.green} />
      <Text style={styles.featLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bg: { ...StyleSheet.absoluteFillObject, opacity: 0.55, resizeMode: "cover" },
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.md },
  logoMark: {
    width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.bg2,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  brand: { color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: 3 },
  heroBlock: { gap: spacing.sm },
  hero: { ...text.h1, fontSize: 40, lineHeight: 46 },
  sub: { ...text.bodyDim, fontSize: 16, lineHeight: 24 },
  legal: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 8 },
  featureRow: {
    flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xl,
    paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  feat: { alignItems: "center", gap: 6 },
  featLabel: { color: colors.textDim, fontSize: 12, fontWeight: "600" },
});
