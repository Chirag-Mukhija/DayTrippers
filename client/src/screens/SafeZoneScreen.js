import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

export default function SafeZoneScreen({ zone, currentLocation, onArrive }) {
  const hasCurrent = typeof currentLocation?.lat === "number" && typeof currentLocation?.lon === "number";
  const hasZone = typeof zone?.lat === "number" && typeof zone?.lon === "number";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearest Safe Zone</Text>

      {hasCurrent ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: currentLocation.lat,
            longitude: currentLocation.lon,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={{ latitude: currentLocation.lat, longitude: currentLocation.lon }}
            title="You"
            pinColor="#dc2626"
          />

          {hasZone ? (
            <Marker
              coordinate={{ latitude: zone.lat, longitude: zone.lon }}
              title={zone.name}
              pinColor="#16a34a"
            />
          ) : null}

          {hasCurrent && hasZone ? (
            <Polyline
              coordinates={[
                { latitude: currentLocation.lat, longitude: currentLocation.lon },
                { latitude: zone.lat, longitude: zone.lon },
              ]}
              strokeWidth={3}
              strokeColor="#ea580c"
            />
          ) : null}
        </MapView>
      ) : null}

      {zone ? (
        <>
          <Text style={styles.cardTitle}>{zone.name}</Text>
          <Text style={styles.cardText}>Lat: {zone.lat}</Text>
          <Text style={styles.cardText}>Lon: {zone.lon}</Text>
          <Text style={styles.cardText}>Distance: {zone.distance_m}m</Text>
        </>
      ) : (
        <Text style={styles.cardText}>Requesting nearest safe zone...</Text>
      )}

      <Pressable style={styles.button} onPress={onArrive}>
        <Text style={styles.buttonText}>Simulate Arrival</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 24,
    paddingHorizontal: 24,
    letterSpacing: -0.5,
    marginTop: 40,
  },
  map: {
    height: 300,
    width: "100%",
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  cardText: {
    fontSize: 16,
    color: "#4B5563",
    marginBottom: 8,
    fontWeight: "500",
    paddingHorizontal: 24,
  },
  button: {
    marginTop: 24,
    marginHorizontal: 24,
    backgroundColor: "#16A34A",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonText: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
});
