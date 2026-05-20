import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Chip, GradientButton } from "@/src/components/UI";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type Options = {
  roles: string[];
  skill_levels: string[];
  genres: string[];
  goals: string[];
};

export default function Onboarding() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [spotify, setSpotify] = useState("");
  const [soundcloud, setSoundcloud] = useState("");
  const [youtube, setYoutube] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const { refresh } = useAuth();
  const router = useRouter();

  useEffect(() => {
    api<Options>("/meta/options").then(setOpts).catch(() => {});
  }, []);

  const toggle = (list: string[], setList: (l: string[]) => void, v: string) => {
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    try {
      setSaving(true);
      await api("/profile/me", {
        method: "PUT",
        body: {
          role,
          skill_level: skill,
          genres,
          goals,
          city,
          location: city,
          bio,
          portfolio: { spotify, soundcloud, youtube },
          onboarded: true,
        },
      });
      await refresh();
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || "Try again");
    } finally {
      setSaving(false);
    }
  };

  const canContinue = () => {
    if (step === 0) return !!role;
    if (step === 1) return !!skill;
    if (step === 2) return genres.length > 0;
    if (step === 3) return true;
    if (step === 4) return goals.length > 0;
    return false;
  };

  if (!opts) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: colors.textDim, padding: spacing.lg }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={back} disabled={step === 0} testID="onb-back" style={{ opacity: step === 0 ? 0 : 1 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / 5) * 100}%` }]} />
        </View>
        <Text style={{ color: colors.textDim, fontWeight: "700" }}>{step + 1}/5</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 0 && (
          <>
            <Text style={text.h1}>What&apos;s your role?</Text>
            <Text style={[text.bodyDim, { marginTop: 8 }]}>Pick your main musical role.</Text>
            <View style={styles.chips}>
              {opts.roles.map((r) => (
                <Chip key={r} label={r} selected={role === r} onPress={() => setRole(r)} testID={`role-${r}`} />
              ))}
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={text.h1}>Your skill level</Text>
            <Text style={[text.bodyDim, { marginTop: 8 }]}>Helps us match you with the right collabs.</Text>
            <View style={styles.chips}>
              {opts.skill_levels.map((s) => (
                <Chip key={s} label={s} selected={skill === s} onPress={() => setSkill(s)} color={colors.green} testID={`skill-${s}`} />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={text.h1}>Pick your genres</Text>
            <Text style={[text.bodyDim, { marginTop: 8 }]}>Select all that vibe.</Text>
            <View style={styles.chips}>
              {opts.genres.map((g) => (
                <Chip key={g} label={g} selected={genres.includes(g)} onPress={() => toggle(genres, setGenres, g)} testID={`genre-${g}`} />
              ))}
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={text.h1}>Your portfolio</Text>
            <Text style={[text.bodyDim, { marginTop: 8 }]}>Add some links (optional).</Text>
            <View style={{ gap: 12, marginTop: spacing.lg }}>
              <Input label="City" value={city} onChangeText={setCity} placeholder="Brooklyn, NY" testID="onb-city" />
              <Input label="Short bio" value={bio} onChangeText={setBio} placeholder="Producer, indie/pop, love jam sessions..." multiline testID="onb-bio" />
              <Input label="Spotify" value={spotify} onChangeText={setSpotify} placeholder="spotify.com/artist/..." testID="onb-spotify" />
              <Input label="SoundCloud" value={soundcloud} onChangeText={setSoundcloud} placeholder="soundcloud.com/..." testID="onb-soundcloud" />
              <Input label="YouTube" value={youtube} onChangeText={setYoutube} placeholder="youtube.com/@..." testID="onb-youtube" />
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={text.h1}>Collab goals</Text>
            <Text style={[text.bodyDim, { marginTop: 8 }]}>What are you looking for?</Text>
            <View style={styles.chips}>
              {opts.goals.map((g) => (
                <Chip key={g} label={g} selected={goals.includes(g)} onPress={() => toggle(goals, setGoals, g)} color={colors.blue} testID={`goal-${g}`} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <GradientButton
          testID="onb-continue"
          label={step === 4 ? (saving ? "Saving..." : "Finish") : "Continue"}
          onPress={step === 4 ? submit : next}
          disabled={!canContinue()}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
}

function Input({
  label, value, onChangeText, placeholder, multiline, testID,
}: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean; testID?: string;
}) {
  return (
    <View>
      <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 6, fontWeight: "600", letterSpacing: 0.5 }}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: "top" }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: colors.purple, borderRadius: 3 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.lg, gap: 4 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    backgroundColor: colors.bg2, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
});
