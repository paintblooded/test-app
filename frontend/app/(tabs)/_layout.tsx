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
      <Feather name={iconName} size={20} color={focused ? colors.green : colors.textDim} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        allowFontScaling={false}
        style={{
          color: focused ? colors.green : colors.textDim,
          fontSize: 10,
          fontWeight: "700",
          marginTop: 3,
          textAlign: "center",
        }}
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
    paddingHorizontal: 8,
  },
  tabBarItem: {
    flex: 1,
    height: 70,
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  tabItem: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
});
