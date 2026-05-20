import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { EmptyState } from "@/src/components/UI";
import { api } from "@/src/api/client";

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api<{ notifications: any[] }>("/notifications");
      setItems(r.notifications || []);
      await api("/notifications/read", { method: "POST" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const iconFor = (t: string): any => {
    if (t.startsWith("event")) return "calendar";
    if (t === "match") return "heart";
    if (t === "chat_message") return "message-circle";
    if (t === "project_joined") return "folder";
    if (t === "verification_approved") return "check-circle";
    return "bell";
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="notif-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="notif-back"><Feather name="arrow-left" size={22} color={colors.text} /></TouchableOpacity>
        <Text style={[text.h2, { marginLeft: 12 }]}>Notifications</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.notification_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.purple} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        ListEmptyComponent={<EmptyState icon="bell" title="No notifications" subtitle="Activity will show up here." />}
        renderItem={({ item }) => (
          <TouchableOpacity testID={`notif-${item.notification_id}`} style={styles.row} onPress={() => {
            const d = item.data || {};
            if (d.chat_id) router.push(`/chat/${d.chat_id}` as any);
            else if (d.event_id) router.push(`/events/${d.event_id}` as any);
            else if (d.project_id) router.push(`/projects/${d.project_id}` as any);
          }}>
            <View style={[styles.iconWrap, !item.read && { borderColor: colors.purple, backgroundColor: "rgba(139,92,246,0.15)" }]}>
              <Feather name={iconFor(item.type)} size={18} color={item.read ? colors.textDim : colors.purple} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[text.body, { fontWeight: "700" }]} numberOfLines={2}>{item.message}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
});
