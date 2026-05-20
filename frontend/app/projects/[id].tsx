import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Alert, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Avatar, GradientButton } from "@/src/components/UI";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"overview" | "tasks" | "files">("overview");
  const [taskModal, setTaskModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [tt, setTt] = useState("");
  const [td, setTd] = useState("");
  const [noteName, setNoteName] = useState("");
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api<any>(`/projects/${id}`);
      setData(r);
    } catch (e: any) { Alert.alert("Error", e?.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <SafeAreaView style={styles.safe}><Text style={{ color: colors.textDim, padding: spacing.lg }}>Loading…</Text></SafeAreaView>;
  const project = data.project;
  const isMember = project.member_ids?.includes(user?.user_id);

  const join = async () => {
    try { await api(`/projects/${id}/join`, { method: "POST" }); await load(); } catch (e: any) { Alert.alert("Error", e?.message); }
  };

  const addTask = async () => {
    if (!tt.trim()) return;
    await api(`/projects/${id}/tasks`, { method: "POST", body: { title: tt, description: td, status: "todo" } });
    setTt(""); setTd(""); setTaskModal(false); load();
  };

  const updateTaskStatus = async (task: any, status: string) => {
    await api(`/projects/${id}/tasks/${task.task_id}`, { method: "PUT", body: { title: task.title, description: task.description, assignee_id: task.assignee_id, status } });
    load();
  };

  const addNote = async () => {
    if (!noteName.trim()) return;
    await api(`/projects/${id}/files`, { method: "POST", body: { name: noteName, file_type: "note", notes: noteText } });
    setNoteName(""); setNoteText(""); setNoteModal(false); load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <Image source={{ uri: project.cover_image }} style={StyleSheet.absoluteFill as any} />
          <LinearGradient colors={["rgba(15,15,15,0.2)", "rgba(15,15,15,0.95)"]} style={StyleSheet.absoluteFill} />
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="proj-back">
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(project.genre || []).map((g: string) => (<View key={g} style={styles.tag}><Text style={styles.tagText}>{g}</Text></View>))}
            </View>
            <Text style={[text.h1, { marginTop: 6 }]}>{project.title}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={styles.tabs}>
            {(["overview", "tasks", "files"] as const).map((t) => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]} testID={`proj-tab-${t}`}>
                <Text style={[styles.tabText, tab === t && { color: colors.text }]}>{t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === "overview" && (
            <View>
              <Text style={text.body}>{project.description}</Text>
              <View style={{ marginTop: spacing.lg }}>
                <Text style={text.label}>NEEDED</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {(project.needed_roles || []).map((r: string) => (
                    <View key={r} style={[styles.tag, { backgroundColor: "rgba(74,222,128,0.1)", borderColor: colors.green }]}>
                      <Text style={[styles.tagText, { color: colors.green }]}>{r}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={{ marginTop: spacing.lg }}>
                <Text style={text.label}>MEMBERS ({data.members.length})</Text>
                {data.members.map((m: any) => (
                  <View key={m.user_id} style={styles.memberRow}>
                    <Avatar uri={m.profile_photo} name={m.name} size={40} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[text.body, { fontWeight: "700" }]}>{m.name}</Text>
                      <Text style={{ color: colors.textDim, fontSize: 12 }}>{m.role}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {!isMember ? (
                <View style={{ marginTop: spacing.xl }}>
                  <GradientButton label="Join project" icon="user-plus" onPress={join} testID="proj-join" />
                </View>
              ) : null}
            </View>
          )}

          {tab === "tasks" && (
            <View>
              {(project.tasks || []).length === 0 ? (
                <Text style={{ color: colors.textDim, marginTop: 12 }}>No tasks yet. Create one.</Text>
              ) : (
                (project.tasks || []).map((tk: any) => (
                  <View key={tk.task_id} style={styles.taskRow}>
                    <TouchableOpacity onPress={() => updateTaskStatus(tk, tk.status === "done" ? "todo" : "done")}>
                      <Feather name={tk.status === "done" ? "check-circle" : "circle"} size={20} color={tk.status === "done" ? colors.green : colors.textDim} />
                    </TouchableOpacity>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={[text.body, { fontWeight: "700", textDecorationLine: tk.status === "done" ? "line-through" : "none" }]}>{tk.title}</Text>
                      {tk.description ? <Text style={{ color: colors.textDim, fontSize: 12 }}>{tk.description}</Text> : null}
                    </View>
                  </View>
                ))
              )}
              {isMember ? (
                <View style={{ marginTop: spacing.md }}>
                  <GradientButton label="New task" icon="plus" onPress={() => setTaskModal(true)} testID="proj-new-task" />
                </View>
              ) : null}
            </View>
          )}

          {tab === "files" && (
            <View>
              {(project.files || []).length === 0 ? (
                <Text style={{ color: colors.textDim, marginTop: 12 }}>No files yet.</Text>
              ) : (
                (project.files || []).map((f: any) => (
                  <View key={f.file_id} style={styles.taskRow}>
                    <Feather name={f.file_type === "audio" ? "music" : "file-text"} size={20} color={colors.purple} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={[text.body, { fontWeight: "700" }]}>{f.name}</Text>
                      {f.notes ? <Text style={{ color: colors.textDim, fontSize: 12 }}>{f.notes}</Text> : null}
                    </View>
                  </View>
                ))
              )}
              {isMember ? (
                <View style={{ marginTop: spacing.md }}>
                  <GradientButton label="Add note" icon="plus" onPress={() => setNoteModal(true)} testID="proj-new-note" />
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={taskModal} transparent animationType="slide" onRequestClose={() => setTaskModal(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard}>
            <Text style={text.h3}>New task</Text>
            <TextInput placeholder="Title" placeholderTextColor={colors.textMuted} value={tt} onChangeText={setTt} style={styles.input} testID="task-title" />
            <TextInput placeholder="Description (optional)" placeholderTextColor={colors.textMuted} value={td} onChangeText={setTd} multiline style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <GradientButton variant="ghost" label="Cancel" onPress={() => setTaskModal(false)} style={{ flex: 1 }} />
              <GradientButton label="Add" onPress={addTask} style={{ flex: 1 }} testID="task-add" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={noteModal} transparent animationType="slide" onRequestClose={() => setNoteModal(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard}>
            <Text style={text.h3}>New note</Text>
            <TextInput placeholder="Note title" placeholderTextColor={colors.textMuted} value={noteName} onChangeText={setNoteName} style={styles.input} />
            <TextInput placeholder="Content" placeholderTextColor={colors.textMuted} value={noteText} onChangeText={setNoteText} multiline style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <GradientButton variant="ghost" label="Cancel" onPress={() => setNoteModal(false)} style={{ flex: 1 }} />
              <GradientButton label="Save" onPress={addNote} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 240, justifyContent: "flex-end" },
  backBtn: { position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  tag: { backgroundColor: "rgba(139,92,246,0.2)", borderColor: colors.purple, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { color: colors.purple, fontSize: 11, fontWeight: "700" },
  tabs: { flexDirection: "row", marginTop: spacing.md, marginBottom: spacing.md, backgroundColor: colors.bg2, padding: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.bg3 },
  tabText: { color: colors.textDim, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  memberRow: { flexDirection: "row", alignItems: "center", padding: 10, marginTop: 8, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  taskRow: { flexDirection: "row", alignItems: "center", padding: 14, marginTop: 8, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.bg, padding: spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 10, borderTopWidth: 1, borderColor: colors.border },
  input: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, color: colors.text },
});
