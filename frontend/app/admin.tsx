import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Avatar, GradientButton, EmptyState } from "@/src/components/UI";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type Tab = "overview" | "users" | "reports" | "verifications" | "events";

export default function Admin() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [verifs, setVerifs] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const a = await api<any>("/admin/analytics");
      setAnalytics(a);
      const u = await api<any>("/admin/users");
      setUsers(u.users || []);
      const r = await api<any>("/admin/reports");
      setReports(r.reports || []);
      const v = await api<any>("/admin/verifications");
      setVerifs(v.verifications || []);
    } catch (e: any) {
      Alert.alert("Access denied", e?.message || "Admin only");
      router.back();
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="lock" title="Admin only" subtitle="You need admin access." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="admin-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.text} /></TouchableOpacity>
        <Text style={[text.h2, { marginLeft: 12 }]}>Admin Console</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 8 }}>
        {(["overview", "users", "reports", "verifications"] as Tab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]} testID={`admin-tab-${t}`}>
            <Text style={[styles.tabText, tab === t && { color: colors.text }]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {tab === "overview" && analytics && (
          <View style={{ gap: 12 }}>
            <View style={styles.gridRow}>
              <StatCard label="Users" value={analytics.users} icon="users" />
              <StatCard label="Events" value={analytics.events} icon="calendar" />
            </View>
            <View style={styles.gridRow}>
              <StatCard label="Projects" value={analytics.projects} icon="folder" />
              <StatCard label="Matches" value={analytics.matches} icon="heart" />
            </View>
            <View style={styles.gridRow}>
              <StatCard label="Messages" value={analytics.messages} icon="message-circle" />
              <StatCard label="Reports" value={analytics.reports_open} icon="alert-octagon" accent={colors.red} />
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <Text style={text.label}>POPULAR GENRES</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {(analytics.genres || []).slice(0, 8).map((g: any) => (
                  <View key={g.genre} style={styles.metricChip}>
                    <Text style={{ color: colors.purple, fontWeight: "700" }}>{g.genre}</Text>
                    <Text style={{ color: colors.textDim, marginLeft: 6 }}>{g.count}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <Text style={text.label}>TOP CITIES</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {(analytics.cities || []).map((c: any) => (
                  <View key={c.city || "?"} style={styles.metricChip}>
                    <Text style={{ color: colors.blue, fontWeight: "700" }}>{c.city || "—"}</Text>
                    <Text style={{ color: colors.textDim, marginLeft: 6 }}>{c.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {tab === "users" && (
          <View>
            {users.map((u) => (
              <View key={u.user_id} style={styles.row}>
                <Avatar uri={u.profile_photo} name={u.name} size={40} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[text.body, { fontWeight: "700" }]}>{u.name}</Text>
                  <Text style={{ color: colors.textDim, fontSize: 12 }}>{u.email} · {u.role || "—"}</Text>
                </View>
                {u.banned ? (
                  <TouchableOpacity onPress={async () => { await api(`/admin/users/${u.user_id}/unban`, { method: "POST" }); load(); }} style={styles.actBtn}>
                    <Text style={{ color: colors.green, fontWeight: "700" }}>Unban</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={async () => { await api(`/admin/users/${u.user_id}/ban`, { method: "POST" }); load(); }} style={styles.actBtn}>
                    <Text style={{ color: colors.red, fontWeight: "700" }}>Ban</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {tab === "reports" && (
          reports.length === 0 ? <EmptyState icon="alert-octagon" title="No reports" /> :
          reports.map((r) => (
            <View key={r.report_id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[text.body, { fontWeight: "700" }]}>{r.target_type} · {r.target_id}</Text>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>{r.reason}</Text>
                {r.details ? <Text style={{ color: colors.textDim, fontSize: 12 }}>{r.details}</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: r.status === "open" ? colors.red : colors.green, fontWeight: "700", fontSize: 11 }}>{r.status.toUpperCase()}</Text>
                {r.status === "open" ? (
                  <TouchableOpacity onPress={async () => { await api(`/admin/reports/${r.report_id}/resolve`, { method: "POST" }); load(); }} style={[styles.actBtn, { marginTop: 6 }]}>
                    <Text style={{ color: colors.green, fontWeight: "700" }}>Resolve</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}

        {tab === "verifications" && (
          verifs.length === 0 ? <EmptyState icon="award" title="Nothing pending" /> :
          verifs.map((v) => (
            <View key={v.verification_id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[text.body, { fontWeight: "700" }]}>{v.user_id}</Text>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>{v.spotify_url || v.soundcloud_url || v.youtube_url || v.performance_video_url || "—"}</Text>
                <Text style={{ color: v.status === "pending" ? colors.blue : colors.green, fontSize: 11, fontWeight: "700" }}>{v.status.toUpperCase()}</Text>
              </View>
              {v.status === "pending" ? (
                <View style={{ gap: 6 }}>
                  <TouchableOpacity onPress={async () => { await api(`/admin/verifications/${v.verification_id}/approve`, { method: "POST" }); load(); }} style={styles.actBtn}>
                    <Text style={{ color: colors.green, fontWeight: "700" }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => { await api(`/admin/verifications/${v.verification_id}/reject`, { method: "POST" }); load(); }} style={styles.actBtn}>
                    <Text style={{ color: colors.red, fontWeight: "700" }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: any; accent?: string }) {
  return (
    <View style={styles.statCard}>
      <Feather name={icon} size={18} color={accent || colors.purple} />
      <Text style={{ color: accent || colors.text, fontSize: 24, fontWeight: "800", marginTop: 6 }}>{value}</Text>
      <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: "rgba(139,92,246,0.18)", borderColor: colors.purple },
  tabText: { color: colors.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  gridRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, padding: 16, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  metricChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  actBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border },
});
