import React, { useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SPACING } from "../theme";

export default function LoginScreen({ onSubmit }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("survivor");

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>SECURE MESH READY</Text>
          </View>
          <Text style={styles.title}>RESCUEMESH</Text>
          <Text style={styles.subtitle}>OFFLINE DISASTER COORDINATION</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.label}>CALLSIGN / NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={COLORS.TEXT_MUTED}
            value={name}
            onChangeText={setName}
            autoCorrect={false}
          />

          <Text style={styles.label}>SELECT ROLE</Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => setRole("survivor")}
              style={[
                styles.role,
                role === "survivor" && styles.roleSurvivorActive,
              ]}
            >
              <Text style={styles.roleIcon}>🛡</Text>
              <Text
                style={[
                  styles.roleText,
                  role === "survivor" && styles.roleTextActive,
                ]}
              >
                SURVIVOR
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setRole("rescuer")}
              style={[
                styles.role,
                role === "rescuer" && styles.roleRescuerActive,
              ]}
            >
              <Text style={styles.roleIcon}>⚡</Text>
              <Text
                style={[
                  styles.roleText,
                  role === "rescuer" && styles.roleTextRescuerActive,
                ]}
              >
                RESCUER
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              if (!name.trim()) {
                Alert.alert(
                  "Name required",
                  "Please enter your name to join the session."
                );
                return;
              }
              onSubmit({ name: name.trim(), role });
            }}
          >
            <Text style={styles.buttonText}>JOIN SECURE SESSION</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            COORDINATES: 12.9716°N, 77.5946°E
          </Text>
          <Text style={styles.footerText}>ENCRYPTION: AES-256 • MESH v2.1</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.XXL,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.NEON_GREEN_DIM,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.PILL,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 136, 0.25)",
    marginBottom: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.NEON_GREEN,
    marginRight: 8,
  },
  statusText: {
    color: COLORS.NEON_GREEN,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: FONTS.MONO,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 38,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: 3,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "600",
    fontFamily: FONTS.MONO,
    letterSpacing: 2,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    padding: SPACING.XXL,
    borderRadius: RADIUS.XL,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.SM,
    letterSpacing: 1.5,
    fontFamily: FONTS.MONO,
  },
  input: {
    backgroundColor: COLORS.INPUT_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.MD,
    padding: 16,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XXL,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: SPACING.XXXL,
  },
  role: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.MD,
    padding: 16,
    alignItems: "center",
    backgroundColor: COLORS.CARD,
  },
  roleIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  roleSurvivorActive: {
    backgroundColor: COLORS.NEON_RED_DIM,
    borderColor: COLORS.NEON_RED,
    shadowColor: COLORS.NEON_RED,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  roleRescuerActive: {
    backgroundColor: COLORS.AMBER_DIM,
    borderColor: COLORS.AMBER,
    shadowColor: COLORS.AMBER,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  roleText: {
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 1,
    fontFamily: FONTS.MONO,
  },
  roleTextActive: {
    color: COLORS.NEON_RED,
  },
  roleTextRescuerActive: {
    color: COLORS.AMBER,
  },
  button: {
    backgroundColor: COLORS.NEON_RED,
    borderRadius: RADIUS.MD,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.NEON_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
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
    fontSize: 18,
    marginLeft: 10,
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
    gap: 4,
  },
  footerText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 10,
    fontFamily: FONTS.MONO,
    letterSpacing: 1,
  },
});
