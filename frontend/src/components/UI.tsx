import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  Image,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { colors, radius, spacing, text } from "@/src/theme";
import { Feather } from "@expo/vector-icons";

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
}

export function GlassCard({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[s.glass, style]}>
      {Platform.OS !== "web" ? (
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={{ position: "relative" }}>{children}</View>
    </View>
  );
}

export function GradientButton({
  label,
  onPress,
  loading,
  disabled,
  testID,
  icon,
  style,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled || loading}
      onPress={onPress}
      testID={testID}
      style={[s.btnWrap, (disabled || loading) && { opacity: 0.5 }, style]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[colors.purple, colors.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.btnInner}
        >
          <BtnContent label={label} loading={loading} icon={icon} />
        </LinearGradient>
      ) : isDanger ? (
        <View style={[s.btnInner, { backgroundColor: colors.red }]}>
          <BtnContent label={label} loading={loading} icon={icon} />
        </View>
      ) : variant === "ghost" ? (
        <View style={[s.btnInner, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border }]}>
          <BtnContent label={label} loading={loading} icon={icon} />
        </View>
      ) : (
        <View style={[s.btnInner, { backgroundColor: colors.bg3 }]}>
          <BtnContent label={label} loading={loading} icon={icon} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function BtnContent({ label, loading, icon }: { label: string; loading?: boolean; icon?: keyof typeof Feather.glyphMap }) {
  if (loading) return <ActivityIndicator color="#fff" />;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {icon ? <Feather name={icon} size={18} color="#fff" /> : null}
      <Text style={s.btnLabel}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  color?: string;
}) {
  const accent = color || colors.purple;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      testID={testID}
      style={[
        s.chip,
        selected && { backgroundColor: accent + "22", borderColor: accent },
      ]}
    >
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[s.chipText, selected && { color: accent, fontWeight: "700" }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function Avatar({ uri, size = 44, name }: { uri?: string; size?: number; name?: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bg3,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: size / 2.5 }}>{initial}</Text>
      )}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
      <Text style={text.h3}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ color: colors.purple, fontWeight: "600" }}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon = "inbox", title, subtitle }: { icon?: keyof typeof Feather.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: "center", padding: spacing.xl, gap: spacing.sm }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.bg2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
        <Feather name={icon} size={24} color={colors.textDim} />
      </View>
      <Text style={[text.h3, { textAlign: "center" }]}>{title}</Text>
      {subtitle ? <Text style={[text.bodyDim, { textAlign: "center" }]}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  glass: {
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  btnWrap: { borderRadius: radius.pill, overflow: "hidden" },
  btnInner: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  btnLabel: { color: "#fff", fontWeight: "700", fontSize: 15 },
  chip: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 0,
    marginBottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600", includeFontPadding: false },
});
