import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, FONTS, RADIUS, SPACING } from "../theme";

export default function DisasterAlertScreen({ alert, onContinue }) {
  const [countdown, setCountdown] = useState(alert?.countdown_s || 10);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setCountdown(alert?.countdown_s || 10);
  }, [alert]);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Pulsing glow animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Border flash animation
  useEffect(() => {
    const flash = Animated.loop(
      Animated.sequence([
        Animated.timing(borderAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(borderAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ])
    );
    flash.start();
    return () => flash.stop();
  }, []);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255, 75, 75, 0.1)", "rgba(255, 75, 75, 0.6)"],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.borderOverlay, { borderColor }]} />

      {/* Warning icon */}
      <Animated.Text style={[styles.warningIcon, { opacity: pulseAnim }]}>
        ⚠
      </Animated.Text>

      {/* Header */}
      <View style={styles.alertBadge}>
        <Text style={styles.alertBadgeText}>⚠ DISASTER ALERT</Text>
      </View>

      <Text style={styles.subHeader}>IMMEDIATE ACTION REQUIRED</Text>

      {/* Disaster Type */}
      <Text style={styles.type}>{alert?.type || "EMERGENCY"}</Text>

      {/* Countdown */}
      <View style={styles.countdownContainer}>
        <Text style={styles.countdownLabel}>TIME TO IMPACT</Text>
        <Text style={styles.count}>T-{String(countdown).padStart(2, "0")}s</Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <View style={styles.instructionCard}>
          <Text style={styles.instructionIcon}>🎒</Text>
          <View style={styles.instructionContent}>
            <Text style={styles.instructionTitle}>PACK ESSENTIALS</Text>
            <Text style={styles.instructionText}>
              Water, documents, medication
            </Text>
          </View>
        </View>
        <View style={styles.instructionCard}>
          <Text style={styles.instructionIcon}>🧭</Text>
          <View style={styles.instructionContent}>
            <Text style={styles.instructionTitle}>
              FOLLOW EVACUATION ROUTE
            </Text>
            <Text style={styles.instructionText}>
              GPS tracking enabled. Safe-zone routing active.
            </Text>
          </View>
        </View>
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={onContinue}
      >
        <Text style={styles.buttonText}>I AM MOVING TO SAFETY</Text>
        <Text style={styles.buttonArrow}>→</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.XXL,
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: 0,
  },
  warningIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  alertBadge: {
    backgroundColor: COLORS.NEON_RED_DIM,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.PILL,
    borderWidth: 1,
    borderColor: "rgba(255, 75, 75, 0.3)",
    marginBottom: 12,
  },
  alertBadgeText: {
    color: COLORS.NEON_RED,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: FONTS.MONO,
  },
  subHeader: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: FONTS.MONO,
    marginBottom: 16,
  },
  type: {
    color: COLORS.NEON_RED,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
    textShadowColor: COLORS.NEON_RED_GLOW,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 24,
  },
  countdownContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  countdownLabel: {
    color: COLORS.TEXT_MUTED,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: FONTS.MONO,
    marginBottom: 8,
  },
  count: {
    color: COLORS.NEON_RED,
    fontSize: 64,
    fontWeight: "900",
    fontFamily: FONTS.MONO,
    textShadowColor: COLORS.NEON_RED_GLOW,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  instructionsContainer: {
    width: "100%",
    gap: 10,
    marginBottom: 32,
  },
  instructionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    borderRadius: RADIUS.MD,
    padding: 14,
  },
  instructionIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  instructionContent: {
    flex: 1,
  },
  instructionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  instructionText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "500",
  },
  button: {
    backgroundColor: COLORS.NEON_RED,
    borderRadius: RADIUS.MD,
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: COLORS.NEON_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 1.5,
  },
  buttonArrow: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 20,
    marginLeft: 10,
  },
});
