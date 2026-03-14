import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function DisasterAlertScreen({ alert, onContinue }) {
  const [countdown, setCountdown] = useState(alert?.countdown_s || 10);

  useEffect(() => {
    setCountdown(alert?.countdown_s || 10);
  }, [alert]);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    return () => clearInterval(t);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.blink}>DISASTER ALERT</Text>
      <Text style={styles.type}>{alert?.type || "Emergency"}</Text>
      <Text style={styles.count}>T - {countdown}s</Text>
      <Text style={styles.info}>GPS tracking enabled. Follow safe-zone instructions.</Text>

      <Pressable style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>Continue To Safe Zone</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  blink: {
    color: "#FEF2F2",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
    opacity: 0.9,
  },
  type: {
    marginTop: 12,
    color: "white",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },
  count: {
    marginTop: 24,
    color: "#FEF2F2",
    fontSize: 72,
    fontWeight: "900",
  },
  info: {
    marginTop: 24,
    color: "#FCA5A5",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  button: {
    marginTop: 48,
    backgroundColor: "white",
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    color: "#DC2626",
    fontWeight: "900",
    fontSize: 18,
  },
});
