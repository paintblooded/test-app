import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Image, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Avatar, Chip, EmptyState, GradientButton } from "@/src/components/UI";
import { api } from "@/src/api/client";

type Tab = "musicians" | "bands" | "projects" | "events";

export default function Discover() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("musicians");
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [musicians, setMusicians] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<any>("/meta/options").then((o) => setGenres(o.genres)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "musicians" || tab === "bands") {
        const r = await api<any>(`/discover/musicians?${q ? `q=${encodeURIComponent(q)}&` : ""}${genre ? `genre=${encodeURIComponent(genre)}` : ""}`);
        setMusicians(r.musicians || []);
      } else if (tab === "events") {
        const r = await api<any>(`/events?${q ? `q=${encodeURIComponent(q)}&` : ""}${genre ? `genre=${encodeURIComponent(genre)}` : ""}`);
        setEvents(r.events || []);
      } else if (tab === "projects") {
        const r = await api<any>(`/projects?${q ? `q=${encodeURIComponent(q)}` : ""}`);
        setProjects(r.projects || []);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, q, genre]);

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} testID="discover-screen">
      <View style={styles.header}>
        <Text style={text.h1}>Discover</Text>
        <TouchableOpacity onPress={() => router.push("/swipe")} style={styles.swipeBtn} testID="discover-swipe-btn">
          <Feather name="zap" size={16} color={colors.green} />
          <Text style={{ color: colors.green, fontWeight: "700", marginLeft: 6 }}>Swipe</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Feather name="search" size={18} color={colors.textDim} />
        <TextInput
          placeholder="Search musicians, events, projects..."
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={setQ}
          style={styles.search}
          testID="discover-search"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}>
        {(["musicians", "bands", "projects", "events"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            testID={`discover-tab-${t}`}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === t && { color: colors.text }]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: 8 }}>
        <Chip label="All" selected={!genre} onPress={() => setGenre(null)} />
        {genres.map((g) => (
          <Chip key={g} label={g} selected={genre === g} onPress={() => setGenre(g === genre ? null : g)} testID={`discover-genre-${g}`} />
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ padding: spacing.xl, alignItems: "center" }}><ActivityIndicator color={colors.purple} /></View>
      ) : (
        <FlatList
          data={tab === "musicians" || tab === "bands" ? musicians : tab === "events" ? events : projects}
          keyExtractor={(item: any) => item.user_id || item.event_id || item.project_id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: 12 }}
          ListEmptyComponent={<EmptyState icon="search" title="Nothing found" subtitle="Try a different filter or search." />}
          renderItem={({ item }) => {
            if (tab === "musicians" || tab === "bands") {
              return (
                <TouchableOpacity testID={`discover-musician-${item.user_id}`} activeOpacity={0.9} onPress={() => router.push(`/profile-view/${item.user_id}` as any)} style={styles.musCard}>
                  <Avatar uri={item.profile_photo} name={item.name} size={56} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[text.body, { fontWeight: "700" }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.dim} numberOfLines={1}>{item.role} · {item.skill_level} · {item.city || "—"}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4, gap: 4 }}>
                      {(item.genres || []).slice(0, 3).map((g: string) => (
                        <View key={g} style={styles.tagSm}><Text style={styles.tagSmText}>{g}</Text></View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.compatBox}>
                    <Text style={{ color: colors.green, fontWeight: "800", fontSize: 16 }}>{item.compatibility ?? "—"}%</Text>
                    <Text style={styles.dim}>match</Text>
                  </View>
                </TouchableOpacity>
              );
            }
            if (tab === "events") {
              return (
                <TouchableOpacity testID={`discover-event-${item.event_id}`} activeOpacity={0.9} onPress={() => router.push(`/events/${item.event_id}` as any)} style={styles.eventBig}>
                  <Image source={{ uri: item.cover_image }} style={styles.eventImgBig} />
                  <View style={{ padding: 14 }}>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {(item.genre || []).slice(0, 3).map((g: string) => (
                        <View key={g} style={styles.tagSm}><Text style={styles.tagSmText}>{g}</Text></View>
                      ))}
                    </View>
                    <Text style={[text.h3, { fontSize: 18, marginTop: 6 }]}>{item.title}</Text>
                    <Text style={styles.dim} numberOfLines={2}>{item.description}</Text>
                    <View style={{ flexDirection: "row", marginTop: 8, gap: 12 }}>
                      <Meta icon="map-pin" text={item.is_online ? "Online" : item.city || ""} />
                      <Meta icon="users" text={`${item.participant_ids?.length || 0}/${item.participant_limit || 0}`} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity testID={`discover-project-${item.project_id}`} activeOpacity={0.9} onPress={() => router.push(`/projects/${item.project_id}` as any)} style={styles.eventBig}>
                <Image source={{ uri: item.cover_image }} style={styles.eventImgBig} />
                <View style={{ padding: 14 }}>
                  <Text style={[text.h3, { fontSize: 18 }]}>{item.title}</Text>
                  <Text style={styles.dim} numberOfLines={2}>{item.description}</Text>
                  {(item.needed_roles?.length) ? (
                    <Text style={{ color: colors.green, fontSize: 12, marginTop: 6, fontWeight: "700" }}>Need: {item.needed_roles.join(", ")}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Meta({ icon, text: t }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Feather name={icon} size={12} color={colors.textDim} />
      <Text style={{ color: colors.textDim, fontSize: 12 }}>{t}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  swipeBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: "rgba(74,222,128,0.12)", borderWidth: 1, borderColor: "rgba(74,222,128,0.3)" },
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.lg, marginTop: spacing.md, paddingHorizontal: 14, height: 44, backgroundColor: colors.bg2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, gap: 8 },
  search: { flex: 1, color: colors.text, fontSize: 14 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, marginTop: 12 },
  tabBtnActive: { backgroundColor: "rgba(139,92,246,0.18)", borderColor: colors.purple },
  tabText: { color: colors.textDim, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  musCard: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  dim: { color: colors.textDim, fontSize: 12 },
  tagSm: { backgroundColor: colors.bg3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginRight: 4 },
  tagSmText: { color: colors.textDim, fontSize: 10, fontWeight: "600" },
  compatBox: { alignItems: "center", marginLeft: 10 },
  eventBig: { backgroundColor: colors.bg2, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  eventImgBig: { width: "100%", height: 160 },
});
