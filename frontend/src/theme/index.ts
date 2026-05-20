export const colors = {
  bg: "#0F0F0F",
  bg2: "#1A1A1A",
  bg3: "#262626",
  text: "#FFFFFF",
  textDim: "#A1A1AA",
  textMuted: "#71717A",
  purple: "#8B5CF6",
  green: "#4ADE80",
  blue: "#38BDF8",
  red: "#EF4444",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  glass: "rgba(26,26,26,0.7)",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const radius = { sm: 8, md: 16, lg: 24, pill: 9999 };

export const fonts = {
  heading: "System",
  body: "System",
};

export const text = {
  h1: { fontSize: 32, lineHeight: 38, fontWeight: "800" as const, color: colors.text, letterSpacing: -1 },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: "700" as const, color: colors.text, letterSpacing: -0.7 },
  h3: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const, color: colors.text, letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const, color: colors.text },
  bodyDim: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const, color: colors.textDim },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "700" as const, color: colors.textDim, letterSpacing: 1, textTransform: "uppercase" as const },
};
