import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { GradientButton } from "@/src/components/UI";
import { api } from "@/src/api/client";

export default function Verify() {
  const router = useRouter();
  const [spotify, setSpotify] = useState("");
  const [soundcloud, setSoundcloud] = useState("");
  const [youtube, setYoutube] = useState("");
  const [video, setVideo] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api("/verifications", { method: "POST", body: {
        performance_video_url: video, spotify_url: spotify, soundcloud_url: soundcloud, youtube_url: youtube, identity_note: note
      }});
      Alert.alert("Submitted", "We'll review your verification soon.");
      router.back();
    } catch (e: any) { Alert.alert("Error", e?.message); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.text} /></TouchableOpacity>
        <Text style={[text.h2, { marginLeft: 12 }]}>Get verified</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14, paddingBottom: 120 }}>
          <Text style={{ color: colors.textDim }}>Verified musicians get a badge, more visibility, and higher trust scores. Share at least one proof.</Text>
          <TextInput placeholder="Spotify artist URL" placeholderTextColor={colors.textMuted} value={spotify} onChangeText={setSpotify} style={styles.input} />
          <TextInput placeholder="SoundCloud URL" placeholderTextColor={colors.textMuted} value={soundcloud} onChangeText={setSoundcloud} style={styles.input} />
          <TextInput placeholder="YouTube channel/video" placeholderTextColor={colors.textMuted} value={youtube} onChangeText={setYoutube} style={styles.input} />
          <TextInput placeholder="Performance video URL" placeholderTextColor={colors.textMuted} value={video} onChangeText={setVideo} style={styles.input} />
          <TextInput placeholder="A short note about who you are" placeholderTextColor={colors.textMuted} value={note} onChangeText={setNote} multiline style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} />
          <GradientButton label={saving ? "Submitting..." : "Submit for review"} icon="award" loading={saving} onPress={submit} testID="verify-submit" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  input: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
});
