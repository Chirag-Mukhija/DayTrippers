import React from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { COLORS, FONTS, RADIUS, SPACING } from "../theme";

export default function BroadcastsScreen({ broadcasts, onBack }) {
  const formatTime = (ts) => {
    if (!ts) return "Unknown";
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.btnBack} onPress={onBack}>
          <Text style={styles.btnBackText}>⟨ BACK</Text>
        </Pressable>
        <Text style={styles.title}>BROADCAST HISTORY</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.container}>
        {broadcasts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📡</Text>
            <Text style={styles.emptyStateText}>No broadcasts received yet</Text>
            <Text style={styles.emptyStateSub}>
              All high-priority rescuer alerts will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={broadcasts}
            keyExtractor={(_, i) => String(i)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.broadcastCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>📢 RESCUER BROADCAST</Text>
                  <Text style={styles.cardTime}>
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
                <Text style={styles.cardSender}>
                  FROM: {item.from_user_name || item.from_user_id?.slice(0, 6)}
                </Text>
                <View style={styles.divider} />
                <Text style={styles.cardMessage}>{item.text}</Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.CARD_BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  btnBack: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  btnBackText: {
    color: COLORS.AMBER,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: FONTS.MONO,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: FONTS.MONO,
  },
  container: {
    flex: 1,
  },
  listContent: {
    padding: SPACING.MD,
    gap: SPACING.MD,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.LG,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: SPACING.MD,
    opacity: 0.5,
  },
  emptyStateText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: SPACING.SM,
  },
  emptyStateSub: {
    color: COLORS.TEXT_MUTED,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  broadcastCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.AMBER_DIM,
    padding: SPACING.MD,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    color: COLORS.AMBER,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    fontFamily: FONTS.MONO,
  },
  cardTime: {
    color: COLORS.TEXT_MUTED,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: FONTS.MONO,
  },
  cardSender: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontFamily: FONTS.MONO,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,176,32,0.1)",
    marginBottom: 12,
  },
  cardMessage: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
});
