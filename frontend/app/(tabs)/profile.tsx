import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Avatar, GradientButton } from "@/src/components/UI";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

export default function Profile() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api<any>(`/profile/${user.user_id}`);
      setStats(r.stats);
    } catch {}
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.banner}>
          <Image source={{ uri: user.banner }} style={StyleSheet.absoluteFill as any} />
          <LinearGradient colors={["transparent", "rgba(15,15,15,0.9)"]} style={StyleSheet.absoluteFill} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -40 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <Avatar uri={user.profile_photo} name={user.name} size={92} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={() => router.push("/notifications")} style={styles.iconBtn} testID="profile-notif">
                <Feather name="bell" size={18} color={colors.text} />
              </TouchableOpacity>
              {user.is_admin ? (
                <TouchableOpacity onPress={() => router.push("/admin")} style={styles.iconBtn} testID="profile-admin">
                  <Feather name="shield" size={18} color={colors.purple} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => router.push("/edit-profile")} style={styles.iconBtn} testID="profile-edit">
                <Feather name="edit-2" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={text.h2}>{user.name}</Text>
              {user.verified ? <Feather name="check-circle" size={18} color={colors.blue} /> : null}
            </View>
            <Text style={{ color: colors.textDim, fontSize: 13 }}>@{user.username} · {user.role} · {user.skill_level}</Text>
            {user.bio ? <Text style={[text.body, { marginTop: 8 }]}>{user.bio}</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {(user.genres || []).map((g) => (
                <View key={g} style={styles.tagPill}><Text style={styles.tagText}>{g}</Text></View>
              ))}
            </View>
          </View>

          <View style={styles.statRow}>
            <Stat label="Reliability" value={`${user.reliability_score ?? 100}`} accent={colors.green} icon="shield" />
            <Stat label="Events" value={`${stats?.events_joined ?? 0}`} icon="calendar" />
            <Stat label="Hosted" value={`${stats?.events_hosted ?? 0}`} icon="mic" />
            <Stat label="Rating" value={stats?.avg_rating ? `${stats.avg_rating}★` : "—"} icon="star" accent={colors.blue} />
          </View>

          <Section title="Collaboration goals">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(user.goals || []).map((g) => (
                <View key={g} style={[styles.tagPill, { backgroundColor: "rgba(56,189,248,0.12)", borderColor: colors.blue }]}><Text style={[styles.tagText, { color: colors.blue }]}>{g}</Text></View>
              ))}
              {(!user.goals || user.goals.length === 0) ? <Text style={{ color: colors.textDim }}>No goals set yet.</Text> : null}
            </View>
          </Section>

          <Section title="Portfolio">
            {user.portfolio?.spotify ? <Link icon="music" label="Spotify" url={user.portfolio.spotify} /> : null}
            {user.portfolio?.soundcloud ? <Link icon="cloud" label="SoundCloud" url={user.portfolio.soundcloud} /> : null}
            {user.portfolio?.youtube ? <Link icon="youtube" label="YouTube" url={user.portfolio.youtube} /> : null}
            {!user.portfolio?.spotify && !user.portfolio?.soundcloud && !user.portfolio?.youtube ? (
              <Text style={{ color: colors.textDim }}>No links yet.</Text>
            ) : null}
          </Section>

          <Section title="Verification">
            {user.verified ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="check-circle" size={18} color={colors.green} />
                <Text style={{ color: colors.text }}>Verified Musician</Text>
              </View>
            ) : (
              <GradientButton label="Get verified" icon="award" onPress={() => router.push("/verify")} testID="profile-verify" />
            )}
          </Section>

          <View style={{ marginTop: spacing.xl, gap: 10 }}>
            <GradientButton variant="secondary" label="Sign out" icon="log-out" onPress={async () => {
              await signOut();
              router.replace("/");
            }} testID="profile-logout" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon: any }) {
  return (
    <View style={styles.stat}>
      <Feather name={icon} size={16} color={accent || colors.textDim} />
      <Text style={{ color: accent || colors.text, fontSize: 17, fontWeight: "800", marginTop: 4 }}>{value}</Text>
      <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={[text.label, { marginBottom: 10 }]}>{title}</Text>
      {children}
    </View>
  );
}

function Link({ icon, label, url }: { icon: any; label: string; url: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
      <Feather name={icon} size={18} color={colors.purple} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: colors.textDim, fontSize: 12 }} numberOfLines={1}>{url}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  banner: { height: 170, backgroundColor: colors.bg2 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  tagPill: { backgroundColor: "rgba(139,92,246,0.15)", borderColor: colors.purple, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { color: colors.purple, fontSize: 11, fontWeight: "700" },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg, padding: 14, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  stat: { alignItems: "center", flex: 1 },
});
