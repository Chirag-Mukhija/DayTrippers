import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { COLORS, DARK_MAP_STYLE, FONTS, RADIUS, SPACING } from "../theme";

export default function SafeZoneScreen({ zone, currentLocation, onArrive }) {
  const hasCurrent =
    typeof currentLocation?.lat === "number" &&
    typeof currentLocation?.lon === "number";
  const hasZone =
    typeof zone?.lat === "number" && typeof zone?.lon === "number";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>🧭 NAVIGATION</Text>
        </View>
        <Text style={styles.title}>NEAREST SAFE ZONE</Text>
      </View>

      {/* Map */}
      {hasCurrent ? (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            customMapStyle={DARK_MAP_STYLE}
            userInterfaceStyle="dark"
            initialRegion={{
              latitude: currentLocation.lat,
              longitude: currentLocation.lon,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
          >
            {/* User location marker */}
            <Marker
              coordinate={{
                latitude: currentLocation.lat,
                longitude: currentLocation.lon,
              }}
              title="You"
            >
              <View style={styles.userMarkerOuter}>
                <View style={styles.userMarkerInner} />
              </View>
            </Marker>

            {/* Safe zone marker */}
            {hasZone ? (
              <Marker
                coordinate={{
                  latitude: zone.lat,
                  longitude: zone.lon,
                }}
                title={zone.name}
              >
                <View style={styles.safeMarkerOuter}>
                  <Text style={styles.safeMarkerIcon}>🏕</Text>
                </View>
              </Marker>
            ) : null}

            {/* Route polyline */}
            {hasCurrent && hasZone ? (
              <Polyline
                coordinates={[
                  {
                    latitude: currentLocation.lat,
                    longitude: currentLocation.lon,
                  },
                  { latitude: zone.lat, longitude: zone.lon },
                ]}
                strokeWidth={3}
                strokeColor={COLORS.NEON_GREEN}
                lineDashPattern={[8, 6]}
              />
            ) : null}
          </MapView>
        </View>
      ) : null}

      {/* Info Card */}
      <View style={styles.infoCard}>
        {zone ? (
          <>
            <View style={styles.infoRow}>
              <View style={styles.zoneStatusDot} />
              <Text style={styles.zoneName}>{zone.name}</Text>
            </View>

            <View style={styles.coordsRow}>
              <View style={styles.coordBlock}>
                <Text style={styles.coordLabel}>LAT</Text>
                <Text style={styles.coordValue}>{zone.lat}</Text>
              </View>
              <View style={styles.coordDivider} />
              <View style={styles.coordBlock}>
                <Text style={styles.coordLabel}>LON</Text>
                <Text style={styles.coordValue}>{zone.lon}</Text>
              </View>
              <View style={styles.coordDivider} />
              <View style={styles.coordBlock}>
                <Text style={styles.coordLabel}>DIST</Text>
                <Text style={styles.coordValueHighlight}>
                  {zone.distance_m}m
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>
              REQUESTING NEAREST SAFE ZONE...
            </Text>
          </View>
        )}
      </View>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={onArrive}
        >
          <Text style={styles.buttonText}>SIMULATE ARRIVAL</Text>
          <Text style={styles.buttonArrow}>→</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    paddingHorizontal: SPACING.XXL,
    paddingTop: 56,
    paddingBottom: SPACING.LG,
  },
  headerBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.NEON_GREEN_DIM,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.PILL,
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.2)",
    marginBottom: 10,
  },
  headerBadgeText: {
    color: COLORS.NEON_GREEN,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    fontFamily: FONTS.MONO,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: 1,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: SPACING.LG,
    borderRadius: RADIUS.LG,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  map: {
    flex: 1,
  },
  userMarkerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.MARKER_SELF_GLOW,
    justifyContent: "center",
    alignItems: "center",
  },
  userMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.NEON_RED,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  safeMarkerOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.NEON_GREEN_DIM,
    borderWidth: 2,
    borderColor: COLORS.NEON_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  safeMarkerIcon: {
    fontSize: 16,
  },
  infoCard: {
    margin: SPACING.LG,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  zoneStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.NEON_GREEN,
    marginRight: 10,
  },
  zoneName: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: 0.5,
  },
  coordsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  coordBlock: {
    flex: 1,
    alignItems: "center",
  },
  coordDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.BORDER,
  },
  coordLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.TEXT_MUTED,
    letterSpacing: 1.5,
    fontFamily: FONTS.MONO,
    marginBottom: 4,
  },
  coordValue: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONTS.MONO,
  },
  coordValueHighlight: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.NEON_GREEN,
    fontFamily: FONTS.MONO,
  },
  loadingRow: {
    padding: SPACING.MD,
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: FONTS.MONO,
    letterSpacing: 1,
  },
  ctaContainer: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.XXXL,
  },
  button: {
    backgroundColor: COLORS.NEON_GREEN,
    borderRadius: RADIUS.MD,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.NEON_GREEN,
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
    color: COLORS.DARK_BG,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 1.5,
  },
  buttonArrow: {
    color: COLORS.DARK_BG,
    fontWeight: "900",
    fontSize: 20,
    marginLeft: 10,
  },
});
