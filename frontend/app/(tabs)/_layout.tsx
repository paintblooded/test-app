import React from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { colors } from "@/src/theme";

type TabIconProps = { focused: boolean; iconName: keyof typeof Feather.glyphMap; label: string };

function TabIcon({ focused, iconName, label }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <Feather name={iconName} size={22} color={focused ? colors.green : colors.textDim} />
      <Text style={{ color: focused ? colors.green : colors.textDim, fontSize: 10, fontWeight: "700", marginTop: 3 }}>{label}</Text>
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
        tabBarBackground: () =>
          Platform.OS !== "web" ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,15,15,0.92)" }]} />
          ),
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="home" label="Home" /> }}
      />
      <Tabs.Screen
        name="discover"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="compass" label="Discover" /> }}
      />
      <Tabs.Screen
        name="create"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="plus-circle" label="Create" /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="message-circle" label="Chat" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconName="user" label="Profile" /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    height: 70,
    borderRadius: 999,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: { alignItems: "center", justifyContent: "center", paddingTop: 8 },
});
