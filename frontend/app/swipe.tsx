import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { EmptyState, GradientButton } from "@/src/components/UI";
import { api } from "@/src/api/client";

export default function Swipe() {
  const router = useRouter();
  const [deck, setDeck] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<any>("/discover/swipe-deck");
      setDeck(r.deck || []);
      setIdx(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const action = async (direction: "like" | "pass") => {
    const card = deck[idx];
    if (!card || busy) return;
    setBusy(true);
    try {
      const r = await api<any>("/match/swipe", { method: "POST", body: { target_id: card.user_id, target_type: "user", direction } });
      if (r.matched && r.chat_id) {
        Alert.alert("It's a match! 🎶", `You and ${card.name} can collaborate.`, [
          { text: "Later", style: "cancel" },
          { text: "Open chat", onPress: () => router.replace(`/chat/${r.chat_id}` as any) },
        ]);
      }
      setIdx((i) => i + 1);
    } catch (e: any) {
      console.warn(e);
      setIdx((i) => i + 1);
    } finally {
      setBusy(false);
    }
  };

  const card = deck[idx];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="swipe-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="swipe-back"><Feather name="arrow-left" size={22} color={colors.text} /></TouchableOpacity>
        <Text style={[text.h2, { marginLeft: 12 }]}>Match</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.purple} /></View>
      ) : !card ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState icon="users" title="Nothing more for now" subtitle="Come back later or refine your genres." />
          <View style={{ paddingHorizontal: spacing.lg }}>
            <GradientButton label="Refresh" icon="refresh-cw" onPress={load} testID="swipe-refresh" />
          </View>
        </View>
      ) : (
        <View style={styles.cardArea}>
          <View style={styles.card}>
            <Image source={{ uri: card.profile_photo }} style={StyleSheet.absoluteFill as any} />
            <LinearGradient colors={["transparent", "rgba(15,15,15,0.95)"]} style={StyleSheet.absoluteFill} />
            <View style={{ position: "absolute", top: 16, right: 16, backgroundColor: "rgba(74,222,128,0.18)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.green }}>
              <Text style={{ color: colors.green, fontWeight: "800" }}>{card.compatibility}% match</Text>
            </View>
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg }}>
              <Text style={text.h1}>{card.name}</Text>
              <Text style={{ color: colors.textDim, marginTop: 4 }}>{card.role} · {card.skill_level} · {card.city || "—"}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {(card.genres || []).map((g: string) => (
                  <View key={g} style={styles.tag}><Text style={styles.tagText}>{g}</Text></View>
                ))}
              </View>
              {card.bio ? <Text style={{ color: colors.text, marginTop: 8 }} numberOfLines={3}>{card.bio}</Text> : null}
              {card.goals?.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {card.goals.slice(0, 3).map((g: string) => (
                    <View key={g} style={[styles.tag, { backgroundColor: "rgba(56,189,248,0.16)", borderColor: colors.blue }]}>
                      <Text style={[styles.tagText, { color: colors.blue }]}>{g}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => action("pass")} disabled={busy} style={[styles.actionBtn, { borderColor: colors.red }]} testID="swipe-pass">
              <Feather name="x" size={28} color={colors.red} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => action("like")} disabled={busy} style={[styles.actionBtn, { backgroundColor: colors.green, borderColor: colors.green }]} testID="swipe-like">
              <Feather name="heart" size={28} color="#0F0F0F" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  cardArea: { flex: 1, padding: spacing.lg, paddingBottom: 32 },
  card: { flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  tag: { backgroundColor: "rgba(139,92,246,0.2)", borderColor: colors.purple, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { color: colors.purple, fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", justifyContent: "center", gap: 24, marginTop: spacing.lg },
  actionBtn: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, backgroundColor: colors.bg2, alignItems: "center", justifyContent: "center" },
});
