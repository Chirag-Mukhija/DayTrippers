import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";

export default function LoginScreen({ onSubmit }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("survivor");

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>RescueMesh</Text>
          <Text style={styles.subtitle}>Offline Disaster Coordination</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Jane Doe"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            autoCorrect={false}
          />

          <Text style={styles.label}>Select Role</Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => setRole("survivor")}
              style={[styles.role, role === "survivor" && styles.roleActive]}
            >
              <Text style={[styles.roleText, role === "survivor" && styles.roleTextActive]}>Survivor</Text>
            </Pressable>
            <Pressable
              onPress={() => setRole("rescuer")}
              style={[styles.role, role === "rescuer" && styles.roleActive]}
            >
              <Text style={[styles.roleText, role === "rescuer" && styles.roleTextActive]}>Rescuer</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => {
              if (!name.trim()) {
                Alert.alert("Name required", "Please enter your name to join the session.");
                return;
              }
              onSubmit({ name: name.trim(), role });
            }}
          >
            <Text style={styles.buttonText}>Join Secure Session</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  card: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: "#111827",
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  role: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  roleActive: {
    backgroundColor: "#EF4444",
    borderColor: "#DC2626",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  roleText: {
    color: "#4B5563",
    fontWeight: "700",
    fontSize: 15,
  },
  roleTextActive: {
    color: "white",
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
  },
});
