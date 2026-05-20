import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Avatar } from "@/src/components/UI";
import { api, getToken, wsUrl } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [chat, setChat] = useState<any>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList<any>>(null);
  const typingTimerRef = useRef<any>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await api<any>(`/chats/${id}/messages`);
    setMessages(r.messages || []);
    setChat(r.chat);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const ws = new WebSocket(wsUrl(token));
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "message" && data.chat_id === id) {
            setMessages((m) => {
              if (m.some((x) => x.message_id === data.message.message_id)) return m;
              return [...m, data.message];
            });
          } else if (data.type === "typing" && data.chat_id === id) {
            setTyping(data.user_id);
            setTimeout(() => setTyping(null), 2500);
          }
        } catch {}
      };
    })();
    return () => { cancelled = true; wsRef.current?.close(); };
  }, [id]);

  const send = async () => {
    if (!input.trim()) return;
    const content = input;
    setInput("");
    try {
      const r = await api<any>(`/chats/${id}/messages`, { method: "POST", body: { chat_id: id, type: "text", content } });
      setMessages((m) => {
        if (m.some((x) => x.message_id === r.message.message_id)) return m;
        return [...m, r.message];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      console.warn(e);
    }
  };

  const sendTyping = () => {
    if (typingTimerRef.current) return;
    typingTimerRef.current = setTimeout(() => { typingTimerRef.current = null; }, 1500);
    try {
      wsRef.current?.send(JSON.stringify({ type: "typing", chat_id: id }));
    } catch {}
  };

  const otherName = chat?.participant_ids?.length === 2 ? "Direct chat" : "Group";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="chat-back">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={[text.body, { fontWeight: "700" }]} numberOfLines={1}>{chat?.name || otherName}</Text>
          {typing ? <Text style={{ color: colors.green, fontSize: 11 }}>typing…</Text> : null}
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.message_id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 20 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.user_id;
            return (
              <View style={[styles.msgRow, mine ? styles.mine : styles.theirs]}>
                {!mine ? <Avatar uri={item.sender_photo} name={item.sender_name} size={28} /> : null}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={{ color: mine ? "#fff" : colors.text }}>{item.content}</Text>
                </View>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={(t) => { setInput(t); sendTyping(); }}
            style={styles.composerInput}
            testID="chat-input"
          />
          <TouchableOpacity onPress={send} style={styles.sendBtn} testID="chat-send">
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 10 },
  mine: { justifyContent: "flex-end" },
  theirs: { justifyContent: "flex-start" },
  bubble: { padding: 12, borderRadius: 16, maxWidth: "75%" },
  bubbleMine: { backgroundColor: colors.purple, marginLeft: "auto", borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.bg2, marginLeft: 8, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  composer: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  composerInput: { flex: 1, backgroundColor: colors.bg2, color: colors.text, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
});
