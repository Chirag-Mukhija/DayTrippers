import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function LoginScreen({ onSubmit }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("survivor");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RescueMesh</Text>
      <Text style={styles.subtitle}>Offline Disaster Coordination</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={name}
        onChangeText={setName}
      />

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
        style={styles.button}
        onPress={() => {
          if (!name.trim()) return;
          onSubmit({ name: name.trim(), role });
        }}
      >
        <Text style={styles.buttonText}>Join Session</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fef3c7",
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#9a3412",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    color: "#7c2d12",
  },
  input: {
    borderWidth: 1,
    borderColor: "#fb923c",
    borderRadius: 12,
    backgroundColor: "white",
    padding: 12,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  role: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#fff7ed",
  },
  roleActive: {
    backgroundColor: "#f97316",
    borderColor: "#ea580c",
  },
  roleText: {
    color: "#9a3412",
    fontWeight: "700",
  },
  roleTextActive: {
    color: "white",
  },
  button: {
    backgroundColor: "#dc2626",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
  },
});
