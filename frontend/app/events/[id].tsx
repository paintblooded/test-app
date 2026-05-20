import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Avatar, GradientButton, EmptyState } from "@/src/components/UI";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api<any>(`/events/${id}`);
      setData(r);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Couldn't load event");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const join = async () => {
    setBusy(true);
    try {
      const r = await api<any>(`/events/${id}/join`, { method: "POST" });
      Alert.alert("Status", r.status.replace("_", " "));
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.message);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await api(`/events/${id}/leave`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const messageHost = async () => {
    if (!data?.host) return;
    try {
      const r = await api<any>("/chats", { method: "POST", body: { participant_ids: [data.host.user_id], event_id: id } });
      router.push(`/chat/${r.chat.chat_id}` as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message);
    }
  };

  if (!data) {
    return <SafeAreaView style={styles.safe}><Text style={{ color: colors.textDim, padding: spacing.lg }}>Loading…</Text></SafeAreaView>;
  }
  const event = data.event;
  const isParticipant = event.participant_ids?.includes(user?.user_id);
  const isHost = event.host_id === user?.user_id;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <Image source={{ uri: event.cover_image }} style={StyleSheet.absoluteFill as any} />
          <LinearGradient colors={["rgba(15,15,15,0.2)", "rgba(15,15,15,0.95)"]} style={StyleSheet.absoluteFill} />
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="event-back">
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(event.genre || []).map((g: string) => (
                <View key={g} style={styles.tag}><Text style={styles.tagText}>{g}</Text></View>
              ))}
            </View>
            <Text style={[text.h1, { marginTop: 8 }]} numberOfLines={3}>{event.title}</Text>
            <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
              <Meta icon="map-pin" text={event.is_online ? "Online" : event.location} />
              <Meta icon="users" text={`${event.participant_ids?.length || 0}/${event.participant_limit || 0}`} />
              <Meta icon="calendar" text={new Date(event.date_time).toLocaleDateString()} />
            </View>
          </View>
        </View>

        <View style={{ padding: spacing.lg }}>
          <Text style={text.body}>{event.description}</Text>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={text.label}>HOST</Text>
            {data.host ? (
              <TouchableOpacity testID="event-host" onPress={() => router.push(`/profile-view/${data.host.user_id}` as any)} style={styles.hostRow}>
                <Avatar uri={data.host.profile_photo} name={data.host.name} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[text.body, { fontWeight: "700" }]}>{data.host.name}</Text>
                  <Text style={{ color: colors.textDim, fontSize: 12 }}>{data.host.role} · Reliability {data.host.reliability_score ?? 100}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textDim} />
              </TouchableOpacity>
            ) : null}
          </View>

          {event.needed_roles?.length ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={text.label}>LOOKING FOR</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {event.needed_roles.map((r: string) => (
                  <View key={r} style={[styles.tag, { backgroundColor: "rgba(74,222,128,0.12)", borderColor: colors.green }]}>
                    <Text style={[styles.tagText, { color: colors.green }]}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.lg }}>
            <Text style={text.label}>PARTICIPANTS ({data.participants?.length || 0})</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(data.participants || []).map((p: any) => (
                <TouchableOpacity key={p.user_id} onPress={() => router.push(`/profile-view/${p.user_id}` as any)} style={styles.partChip}>
                  <Avatar uri={p.profile_photo} name={p.name} size={28} />
                  <Text style={{ color: colors.text, marginLeft: 6, fontSize: 13 }}>{p.name?.split(" ")[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ marginTop: spacing.xl, gap: 10 }}>
            {isHost ? (
              <Text style={{ color: colors.textDim, textAlign: "center" }}>You&apos;re the host.</Text>
            ) : isParticipant ? (
              <GradientButton variant="secondary" label="Leave event" icon="x" onPress={leave} loading={busy} testID="event-leave" />
            ) : (
              <GradientButton label="Join event" icon="check" onPress={join} loading={busy} testID="event-join" />
            )}
            <GradientButton variant="ghost" label="Message host" icon="message-circle" onPress={messageHost} testID="event-msg-host" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ icon, text: t }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Feather name={icon} size={14} color={colors.textDim} />
      <Text style={{ color: colors.textDim, fontSize: 13 }}>{t}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 320, justifyContent: "flex-end" },
  backBtn: { position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  tag: { backgroundColor: "rgba(139,92,246,0.2)", borderColor: colors.purple, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { color: colors.purple, fontSize: 11, fontWeight: "700" },
  hostRow: { flexDirection: "row", alignItems: "center", marginTop: 8, padding: 12, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  partChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.bg2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, marginTop: 4 },
});
