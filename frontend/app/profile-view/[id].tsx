import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Avatar, GradientButton } from "@/src/components/UI";
import { api } from "@/src/api/client";

export default function ProfileView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try { const r = await api<any>(`/profile/${id}`); setData(r); } catch (e: any) { Alert.alert("Error", e?.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <SafeAreaView style={styles.safe}><Text style={{ color: colors.textDim, padding: spacing.lg }}>Loading…</Text></SafeAreaView>;
  const u = data.user;

  const message = async () => {
    try {
      const r = await api<any>("/chats", { method: "POST", body: { participant_ids: [u.user_id] } });
      router.push(`/chat/${r.chat.chat_id}` as any);
    } catch (e: any) { Alert.alert("Error", e?.message); }
  };

  const report = async () => {
    Alert.prompt?.("Report user", "Tell us what's wrong", async (reason?: string) => {
      if (!reason) return;
      await api("/reports", { method: "POST", body: { target_type: "user", target_id: u.user_id, reason } });
      Alert.alert("Thanks", "Report submitted.");
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="profile-view">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.banner}>
          <Image source={{ uri: u.banner }} style={StyleSheet.absoluteFill as any} />
          <LinearGradient colors={["transparent", "rgba(15,15,15,0.9)"]} style={StyleSheet.absoluteFill} />
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="profile-view-back"><Feather name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -40 }}>
          <Avatar uri={u.profile_photo} name={u.name} size={92} />
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={text.h2}>{u.name}</Text>
              {u.verified ? <Feather name="check-circle" size={18} color={colors.blue} /> : null}
            </View>
            <Text style={{ color: colors.textDim, fontSize: 13 }}>@{u.username} · {u.role} · {u.skill_level}</Text>
            {u.bio ? <Text style={[text.body, { marginTop: 8 }]}>{u.bio}</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {(u.genres || []).map((g: string) => (<View key={g} style={styles.tag}><Text style={styles.tagText}>{g}</Text></View>))}
            </View>
          </View>

          <View style={styles.statRow}>
            <Stat label="Reliability" value={`${u.reliability_score ?? 100}`} accent={colors.green} icon="shield" />
            <Stat label="Events" value={`${data.stats?.events_joined ?? 0}`} icon="calendar" />
            <Stat label="Hosted" value={`${data.stats?.events_hosted ?? 0}`} icon="mic" />
            <Stat label="Rating" value={data.stats?.avg_rating ? `${data.stats.avg_rating}★` : "—"} icon="star" accent={colors.blue} />
          </View>

          <View style={{ marginTop: spacing.xl, gap: 10 }}>
            <GradientButton label="Message" icon="message-circle" onPress={message} testID="profile-msg" />
            <GradientButton variant="ghost" label="Report" icon="flag" onPress={report} testID="profile-report" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon: any }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Feather name={icon} size={16} color={accent || colors.textDim} />
      <Text style={{ color: accent || colors.text, fontSize: 17, fontWeight: "800", marginTop: 4 }}>{value}</Text>
      <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  banner: { height: 170, backgroundColor: colors.bg2 },
  backBtn: { position: "absolute", top: 16, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  tag: { backgroundColor: "rgba(139,92,246,0.15)", borderColor: colors.purple, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { color: colors.purple, fontSize: 11, fontWeight: "700" },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg, padding: 14, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
});
