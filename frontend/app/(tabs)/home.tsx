import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Avatar, Chip, EmptyState, SectionHeader } from "@/src/components/UI";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type Event = {
  event_id: string; title: string; cover_image?: string; genre: string[];
  city?: string; is_online?: boolean; date_time: string; participant_ids?: string[];
  participant_limit?: number; needed_roles?: string[]; event_type?: string;
};
type Musician = { user_id: string; name?: string; role?: string; profile_photo?: string; genres?: string[]; reliability_score?: number; city?: string };
type Project = { project_id: string; title: string; cover_image?: string; genre: string[]; needed_roles?: string[] };

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [feed, setFeed] = useState<{ nearby_events: Event[]; online_events: Event[]; trending_musicians: Musician[]; open_projects: Project[]; recommended_users: Musician[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const [f, n] = await Promise.all([
        api<any>("/feed/home"),
        api<{ notifications: any[] }>("/notifications"),
      ]);
      setFeed(f);
      setUnread((n.notifications || []).filter((x: any) => !x.read).length);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} testID="home-screen">
      <View style={styles.topBar}>
        <View>
          <Text style={styles.hello}>Hey {user?.name?.split(" ")[0] || "there"} 👋</Text>
          <Text style={styles.hint}>What are you creating today?</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => router.push("/swipe")} style={styles.iconBtn} testID="home-swipe-btn">
            <Feather name="zap" size={18} color={colors.green} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/notifications")} style={styles.iconBtn} testID="home-notif-btn">
            <Feather name="bell" size={18} color={colors.text} />
            {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View> : null}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.purple} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.purple} />}
        >
          {/* Featured event hero */}
          {feed?.nearby_events?.[0] ? (
            <FeaturedEvent event={feed.nearby_events[0]} onPress={() => router.push(`/events/${feed.nearby_events[0].event_id}` as any)} />
          ) : null}

          <View style={{ height: spacing.xl }} />

          <SectionHeader title="Nearby Events" action="See all" onAction={() => router.push("/(tabs)/discover")} />
          {(feed?.nearby_events || []).length === 0 ? (
            <EmptyState icon="map-pin" title="No nearby events yet" subtitle="Create one to start your scene." />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(feed?.nearby_events || []).map((e) => (
                <EventCard key={e.event_id} event={e} onPress={() => router.push(`/events/${e.event_id}` as any)} />
              ))}
            </ScrollView>
          )}

          <View style={{ height: spacing.xl }} />
          <SectionHeader title="Trending musicians" action="See all" onAction={() => router.push("/(tabs)/discover")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(feed?.trending_musicians || []).map((m) => (
              <MusicianMini key={m.user_id} m={m} onPress={() => router.push(`/profile-view/${m.user_id}` as any)} />
            ))}
          </ScrollView>

          <View style={{ height: spacing.xl }} />
          <SectionHeader title="Open projects" action="See all" onAction={() => router.push("/(tabs)/discover")} />
          {(feed?.open_projects || []).map((p) => (
            <ProjectCard key={p.project_id} p={p} onPress={() => router.push(`/projects/${p.project_id}` as any)} />
          ))}

          <View style={{ height: spacing.xl }} />
          <SectionHeader title="Online collaborations" />
          {(feed?.online_events || []).map((e) => (
            <CompactEvent key={e.event_id} event={e} onPress={() => router.push(`/events/${e.event_id}` as any)} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FeaturedEvent({ event, onPress }: { event: Event; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} testID={`featured-event-${event.event_id}`}>
      <View style={styles.featured}>
        <Image source={{ uri: event.cover_image }} style={StyleSheet.absoluteFill as any} />
        <LinearGradient colors={["rgba(15,15,15,0.1)", "rgba(15,15,15,0.95)"]} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, justifyContent: "flex-end", padding: spacing.lg }}>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            {(event.genre || []).slice(0, 3).map((g) => (
              <View key={g} style={styles.tagPill}><Text style={styles.tagText}>{g}</Text></View>
            ))}
          </View>
          <Text style={text.h2} numberOfLines={2}>{event.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="map-pin" size={12} color={colors.textDim} />
              <Text style={styles.metaText}>{event.is_online ? "Online" : event.city || event.event_type}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="users" size={12} color={colors.textDim} />
              <Text style={styles.metaText}>{event.participant_ids?.length || 0}/{event.participant_limit || 0}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.evCard} testID={`event-card-${event.event_id}`}>
      <Image source={{ uri: event.cover_image }} style={styles.evImg} />
      <LinearGradient colors={["transparent", "rgba(15,15,15,0.92)"]} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />
      <View style={styles.evContent}>
        <View style={{ flexDirection: "row", gap: 4, marginBottom: 6 }}>
          {(event.genre || []).slice(0, 2).map((g) => (
            <View key={g} style={styles.tagPillSm}><Text style={styles.tagTextSm}>{g}</Text></View>
          ))}
        </View>
        <Text style={[text.h3, { fontSize: 16 }]} numberOfLines={2}>{event.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Text style={styles.metaText} numberOfLines={1}>{event.is_online ? "🌐 Online" : `📍 ${event.city || ""}`}</Text>
        </View>
        {(event.needed_roles && event.needed_roles.length > 0) ? (
          <Text style={[styles.needed, { marginTop: 4 }]}>Need: {event.needed_roles.slice(0, 2).join(", ")}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function CompactEvent({ event, onPress }: { event: Event; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.row} testID={`compact-event-${event.event_id}`}>
      <Image source={{ uri: event.cover_image }} style={styles.rowImg} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[text.body, { fontWeight: "700" }]} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.metaText} numberOfLines={1}>
          {(event.genre || []).join(" • ")}{event.needed_roles?.length ? ` · Need ${event.needed_roles.join(", ")}` : ""}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textDim} />
    </TouchableOpacity>
  );
}

function MusicianMini({ m, onPress }: { m: Musician; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.miniMus} testID={`musician-mini-${m.user_id}`}>
      <Avatar uri={m.profile_photo} name={m.name} size={64} />
      <Text style={[text.body, { fontWeight: "700", marginTop: 8 }]} numberOfLines={1}>{m.name}</Text>
      <Text style={styles.metaText} numberOfLines={1}>{m.role} · {(m.genres || [])[0]}</Text>
      <View style={styles.relPill}>
        <Feather name="shield" size={10} color={colors.green} />
        <Text style={{ color: colors.green, fontSize: 11, fontWeight: "700", marginLeft: 4 }}>{m.reliability_score ?? 100}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ProjectCard({ p, onPress }: { p: Project; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.projCard} testID={`project-card-${p.project_id}`}>
      <Image source={{ uri: p.cover_image }} style={styles.projImg} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[text.body, { fontWeight: "700" }]} numberOfLines={1}>{p.title}</Text>
        <View style={{ flexDirection: "row", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {(p.genre || []).slice(0, 2).map((g) => (
            <View key={g} style={styles.tagPillSm}><Text style={styles.tagTextSm}>{g}</Text></View>
          ))}
        </View>
        {(p.needed_roles && p.needed_roles.length > 0) ? (
          <Text style={[styles.needed, { marginTop: 6 }]}>Need: {p.needed_roles.join(", ")}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  hello: { color: colors.text, fontSize: 22, fontWeight: "800" },
  hint: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  badge: { position: "absolute", top: -2, right: -2, backgroundColor: colors.red, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  featured: { height: 260, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.bg2 },
  tagPill: { backgroundColor: "rgba(139,92,246,0.2)", borderColor: colors.purple, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { color: colors.purple, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  tagPillSm: { backgroundColor: colors.bg3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  tagTextSm: { color: colors.textDim, fontSize: 10, fontWeight: "600" },
  metaText: { color: colors.textDim, fontSize: 12 },
  evCard: { width: 240, height: 220, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.bg2, marginRight: 12 },
  evImg: { ...StyleSheet.absoluteFillObject as any, width: 240, height: 220 },
  evContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 14 },
  needed: { color: colors.green, fontSize: 11, fontWeight: "600" },
  miniMus: { width: 120, alignItems: "center", marginRight: 12, padding: 12, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  relPill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(74,222,128,0.12)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginTop: 6 },
  projCard: { flexDirection: "row", padding: 14, backgroundColor: colors.bg2, borderRadius: radius.lg, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  projImg: { width: 64, height: 64, borderRadius: 12 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  rowImg: { width: 48, height: 48, borderRadius: 10 },
});
