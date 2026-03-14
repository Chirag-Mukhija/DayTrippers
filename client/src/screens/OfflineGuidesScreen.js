import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { WebView } from "react-native-webview";

const GUIDES = [
  {
    id: "cpr",
    title: "CPR Basics",
    keywords: "cpr breathing pulse chest compression",
    file: require("../../assets/offline-guides/cpr.html"),
  },
  {
    id: "burn",
    title: "Burn Care",
    keywords: "burn water sterile dressing",
    file: require("../../assets/offline-guides/burns.html"),
  },
  {
    id: "earthquake",
    title: "Earthquake Survival",
    keywords: "earthquake drop cover hold",
    file: require("../../assets/offline-guides/earthquake.html"),
  },
  {
    id: "water",
    title: "Find Safe Water",
    keywords: "water boil filter purify",
    file: require("../../assets/offline-guides/water.html"),
  },
  {
    id: "signal",
    title: "Signal Rescuers",
    keywords: "signal flashlight mirror whistle",
    file: require("../../assets/offline-guides/signaling.html"),
  },
];

export default function OfflineGuidesScreen({ onBack }) {
  const [query, setQuery] = useState("");
  const [selectedGuide, setSelectedGuide] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDES;
    return GUIDES.filter((g) => (`${g.title} ${g.keywords}`).toLowerCase().includes(q));
  }, [query]);

  if (selectedGuide) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{selectedGuide.title}</Text>
        <WebView 
          source={selectedGuide.file} 
          style={styles.webview} 
          originWhitelist={["*"]} 
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
        />
        <Pressable style={styles.backBtn} onPress={() => setSelectedGuide(null)}>
          <Text style={styles.backText}>Back To Library</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Offline Survival Library</Text>
      <TextInput
        style={styles.input}
        placeholder="Search guides"
        value={query}
        onChangeText={setQuery}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelectedGuide(item)}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>Open offline guide</Text>
          </Pressable>
        )}
      />

      <Pressable style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backText}>Back To Session</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#eff6ff",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e3a8a",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#dbeafe",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: {
    color: "#1e3a8a",
    fontWeight: "700",
    marginBottom: 4,
  },
  cardDesc: {
    color: "#1e40af",
  },
  backBtn: {
    marginTop: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  backText: {
    color: "white",
    fontWeight: "800",
  },
  webview: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "white",
  },
});
