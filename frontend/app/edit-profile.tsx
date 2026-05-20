import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { GradientButton } from "@/src/components/UI";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

export default function EditProfile() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [city, setCity] = useState(user?.city || "");
  const [availability, setAvailability] = useState(user?.availability || "");
  const [spotify, setSpotify] = useState(user?.portfolio?.spotify || "");
  const [soundcloud, setSoundcloud] = useState(user?.portfolio?.soundcloud || "");
  const [youtube, setYoutube] = useState(user?.portfolio?.youtube || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/profile/me", { method: "PUT", body: {
        username, bio, city, location: city, availability,
        portfolio: { spotify, soundcloud, youtube },
      } });
      await refresh();
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message);
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="edit-profile">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.text} /></TouchableOpacity>
        <Text style={[text.h2, { marginLeft: 12 }]}>Edit profile</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14, paddingBottom: 120 }}>
          <Field label="Username"><TextInput value={username} onChangeText={setUsername} style={styles.input} testID="edit-username" /></Field>
          <Field label="Bio"><TextInput value={bio} onChangeText={setBio} multiline style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} testID="edit-bio" /></Field>
          <Field label="City"><TextInput value={city} onChangeText={setCity} style={styles.input} testID="edit-city" /></Field>
          <Field label="Availability"><TextInput value={availability} onChangeText={setAvailability} placeholder="Weekends, Evenings..." placeholderTextColor={colors.textMuted} style={styles.input} /></Field>
          <Field label="Spotify"><TextInput value={spotify} onChangeText={setSpotify} style={styles.input} placeholder="spotify.com/artist/..." placeholderTextColor={colors.textMuted} /></Field>
          <Field label="SoundCloud"><TextInput value={soundcloud} onChangeText={setSoundcloud} style={styles.input} placeholder="soundcloud.com/..." placeholderTextColor={colors.textMuted} /></Field>
          <Field label="YouTube"><TextInput value={youtube} onChangeText={setYoutube} style={styles.input} placeholder="youtube.com/@..." placeholderTextColor={colors.textMuted} /></Field>
          <GradientButton label={saving ? "Saving..." : "Save changes"} icon="save" onPress={save} loading={saving} testID="edit-save" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 6, fontWeight: "700", letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  input: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
});
