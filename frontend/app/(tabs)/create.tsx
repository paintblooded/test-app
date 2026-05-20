import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Chip, GradientButton } from "@/src/components/UI";
import { api } from "@/src/api/client";

type Mode = "event" | "project";

export default function Create() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("event");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [evType, setEvType] = useState("Jam Session");
  const [genres, setGenres] = useState<string[]>([]);
  const [neededRoles, setNeededRoles] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [limit, setLimit] = useState("10");
  const [dateText, setDateText] = useState(""); // YYYY-MM-DD HH:mm
  const [opts, setOpts] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/meta/options").then(setOpts).catch(() => {});
  }, []);

  const toggle = (list: string[], v: string, setList: (l: string[]) => void) => {
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Give it a name.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "event") {
        let dt: string;
        if (dateText.trim()) {
          const parsed = new Date(dateText.replace(" ", "T"));
          dt = isNaN(parsed.getTime()) ? new Date(Date.now() + 86400000).toISOString() : parsed.toISOString();
        } else {
          dt = new Date(Date.now() + 86400000).toISOString();
        }
        const r = await api<any>("/events", {
          method: "POST",
          body: {
            title, description: desc, event_type: evType, genre: genres,
            location: location || (isOnline ? "Online" : "TBD"),
            is_online: isOnline,
            date_time: dt,
            participant_limit: parseInt(limit) || 10,
            needed_roles: neededRoles,
          },
        });
        router.replace(`/events/${r.event.event_id}` as any);
      } else {
        const r = await api<any>("/projects", {
          method: "POST",
          body: { title, description: desc, genre: genres, needed_roles: neededRoles },
        });
        router.replace(`/projects/${r.project.project_id}` as any);
      }
    } catch (e: any) {
      Alert.alert("Could not create", e?.message || "Try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="create-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={text.h1}>Create</Text>
        </View>

        <View style={styles.switcher}>
          {(["event", "project"] as Mode[]).map((m) => (
            <TouchableOpacity key={m} onPress={() => setMode(m)} testID={`create-mode-${m}`} style={[styles.switchBtn, mode === m && styles.switchBtnActive]}>
              <Feather name={m === "event" ? "calendar" : "folder"} size={16} color={mode === m ? colors.text : colors.textDim} />
              <Text style={[styles.switchText, mode === m && { color: colors.text }]}>{m === "event" ? "Event" : "Project"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}>
          <Field label="Title">
            <TextInput value={title} onChangeText={setTitle} placeholder={mode === "event" ? "Indie Jam Tonight" : "Neon Dreams EP"} placeholderTextColor={colors.textMuted} style={styles.input} testID="create-title" />
          </Field>

          <Field label="Description">
            <TextInput value={desc} onChangeText={setDesc} multiline placeholder="What's the vibe?" placeholderTextColor={colors.textMuted} style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]} testID="create-desc" />
          </Field>

          {mode === "event" && (
            <>
              <Field label="Event Type">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(opts?.event_types || []).map((t: string) => (
                    <Chip key={t} label={t} selected={evType === t} onPress={() => setEvType(t)} testID={`create-evtype-${t}`} />
                  ))}
                </ScrollView>
              </Field>
            </>
          )}

          <Field label="Genres">
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {(opts?.genres || []).map((g: string) => (
                <Chip key={g} label={g} selected={genres.includes(g)} onPress={() => toggle(genres, g, setGenres)} testID={`create-genre-${g}`} />
              ))}
            </View>
          </Field>

          <Field label="Needed Roles">
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {(opts?.roles || []).map((r: string) => (
                <Chip key={r} label={r} selected={neededRoles.includes(r)} onPress={() => toggle(neededRoles, r, setNeededRoles)} color={colors.green} testID={`create-role-${r}`} />
              ))}
            </View>
          </Field>

          {mode === "event" && (
            <>
              <Field label="Location">
                <TextInput value={location} onChangeText={setLocation} placeholder="Brooklyn Loft, NY" placeholderTextColor={colors.textMuted} style={styles.input} testID="create-location" />
              </Field>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={text.body}>Online event</Text>
                <Switch value={isOnline} onValueChange={setIsOnline} trackColor={{ true: colors.purple, false: colors.bg3 }} testID="create-online" />
              </View>
              <Field label="Date & time (YYYY-MM-DD HH:mm) — optional">
                <TextInput value={dateText} onChangeText={setDateText} placeholder="2026-06-15 19:00" placeholderTextColor={colors.textMuted} style={styles.input} testID="create-date" />
              </Field>
              <Field label="Participant limit">
                <TextInput value={limit} onChangeText={setLimit} keyboardType="number-pad" style={styles.input} testID="create-limit" />
              </Field>
            </>
          )}

          <GradientButton
            label={saving ? "Creating..." : mode === "event" ? "Publish Event" : "Create Project"}
            onPress={submit}
            loading={saving}
            testID="create-submit"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 6, fontWeight: "700", letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  switcher: { flexDirection: "row", marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  switchBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 6, borderRadius: radius.pill },
  switchBtnActive: { backgroundColor: colors.bg3 },
  switchText: { color: colors.textDim, fontWeight: "700", fontSize: 13 },
  input: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
});
