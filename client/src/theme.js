// ── RescueMesh Tactical Dark Theme ──────────────────────────────────────────
// Shared design tokens for the dark-mode "Tactical Dashboard" aesthetic.

export const COLORS = {
  // Backgrounds
  DARK_BG: "#0A0A0F",
  SURFACE: "#12121A",
  CARD: "#1A1A24",
  CARD_BORDER: "#2A2A3A",

  // Accents
  NEON_RED: "#FF4B4B",
  NEON_RED_DIM: "rgba(255, 75, 75, 0.15)",
  NEON_RED_GLOW: "rgba(255, 75, 75, 0.4)",
  NEON_GREEN: "#00FF88",
  NEON_GREEN_DIM: "rgba(0, 255, 136, 0.15)",
  NEON_GREEN_GLOW: "rgba(0, 255, 136, 0.35)",
  AMBER: "#FFB800",
  AMBER_DIM: "rgba(255, 184, 0, 0.15)",
  CYAN: "#00D4FF",
  CYAN_DIM: "rgba(0, 212, 255, 0.15)",

  // Text
  TEXT_PRIMARY: "#F0F0F5",
  TEXT_SECONDARY: "#8B8B9E",
  TEXT_MUTED: "#555568",

  // UI
  BORDER: "#2A2A3A",
  OVERLAY: "rgba(0, 0, 0, 0.75)",
  INPUT_BG: "#16161F",
  BADGE_BG: "rgba(255, 75, 75, 0.12)",

  // Map markers
  MARKER_SELF: "#3B82F6",
  MARKER_SELF_GLOW: "rgba(59, 130, 246, 0.35)",
  MARKER_RESCUER: "#FFB800",
  MARKER_BEACON: "#00D4FF",
};

export const FONTS = {
  MONO: "Courier",
  SYSTEM: undefined, // Platform default (San Francisco / Roboto)
};

export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 20,
  XXL: 24,
  XXXL: 32,
};

export const RADIUS = {
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 20,
  PILL: 999,
};

// Dark map style for react-native-maps (Google Maps)
export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0d0d14" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d0d14" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#555568" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8B8B9E" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#555568" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#111118" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3a6642" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1a1a24" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#22222e" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#22222e" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#2a2a3a" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#16161f" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#080810" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3a3a4a" }],
  },
];
