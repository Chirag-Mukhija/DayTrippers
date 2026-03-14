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
    backgroundColor: "#991b1b",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  blink: {
    color: "#fecaca",
    fontSize: 28,
    fontWeight: "900",
  },
  type: {
    marginTop: 8,
    color: "white",
    fontSize: 24,
    fontWeight: "800",
  },
  count: {
    marginTop: 14,
    color: "#fee2e2",
    fontSize: 40,
    fontWeight: "900",
  },
  info: {
    marginTop: 16,
    color: "#fee2e2",
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: "#7f1d1d",
    fontWeight: "800",
  },
});
