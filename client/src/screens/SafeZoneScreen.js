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
    backgroundColor: "#fff7ed",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#9a3412",
    marginBottom: 20,
  },
  map: {
    height: 250,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#7c2d12",
    marginBottom: 10,
  },
  cardText: {
    fontSize: 16,
    color: "#7c2d12",
    marginBottom: 8,
  },
  button: {
    marginTop: 18,
    backgroundColor: "#ea580c",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "800",
  },
});
