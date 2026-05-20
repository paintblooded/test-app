import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, spacing, radius, text } from "@/src/theme";
import { Avatar, EmptyState } from "@/src/components/UI";
import { api } from "@/src/api/client";

type ChatRow = {
  chat_id: string;
  is_group?: boolean;
  name?: string;
  last_message?: { content: string; created_at?: string };
  others: { user_id: string; name?: string; profile_photo?: string }[];
};

export default function ChatList() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api<{ chats: ChatRow[] }>("/chats");
      setChats(r.chats || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} testID="chat-list">
      <View style={styles.header}>
        <Text style={text.h1}>Messages</Text>
        <Text style={{ color: colors.textDim, marginTop: 4 }}>Talk to matches, collabs, and events.</Text>
      </View>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.chat_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.purple} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        ListEmptyComponent={<EmptyState icon="message-circle" title="No messages yet" subtitle="Match with musicians or join an event to start chatting." />}
        renderItem={({ item }) => {
          const other = item.others[0];
          const title = item.name || other?.name || "Group";
          return (
            <TouchableOpacity testID={`chat-row-${item.chat_id}`} activeOpacity={0.85} onPress={() => router.push(`/chat/${item.chat_id}` as any)} style={styles.row}>
              <Avatar uri={other?.profile_photo} name={title} size={50} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[text.body, { fontWeight: "700" }]} numberOfLines={1}>{title}</Text>
                <Text style={{ color: colors.textDim, fontSize: 13 }} numberOfLines={1}>{item.last_message?.content || "Tap to start the conversation"}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
});
