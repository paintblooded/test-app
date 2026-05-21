import React from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { colors } from "@/src/theme";

type TabIconProps = { focused: boolean; iconName: keyof typeof Feather.glyphMap; label: string };

function TabIcon({ focused, iconName, label }: TabIconProps) {
  const tint = focused ? colors.green : colors.textDim;
  return (
    <View style={styles.tabItem}>
      <Feather name={iconName} size={20} color={tint} />
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[styles.tabLabel, { color: tint }]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarBackground: () =>
          Platform.OS !== "web" ? (
            <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,15,15,0.78)" }]} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,15,15,0.78)" }]} />
          ),
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="home" label="Home" /> }} />
      <Tabs.Screen name="discover" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="compass" label="Discover" /> }} />
      <Tabs.Screen name="create" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="plus-circle" label="Create" /> }} />
      <Tabs.Screen name="chat" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="message-circle" label="Chat" /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="user" label="Profile" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    height: 64,
    borderRadius: 999,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    elevation: 0,
    shadowOpacity: 0,
    paddingHorizontal: 4,
  },
  tabBarItem: {
    flex: 1,
    height: 64,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  tabItem: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: 3,
    textAlign: "center",
    includeFontPadding: false,
  },
});
