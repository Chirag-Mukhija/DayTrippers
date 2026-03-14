import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MainScreen({
  me,
  users,
  chatLinks,
  beacons,
  evacuation,
  onSendChat,
  onDropBeacon,
  onFlashlightPing,
  onBroadcastEvacuation,
  onOpenOfflineGuides,
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [chatText, setChatText] = useState("");
  const [isPickEvacMode, setIsPickEvacMode] = useState(false);
  const [evacPointDraft, setEvacPointDraft] = useState(null);
  const [evacMessageDraft, setEvacMessageDraft] = useState("Proceed calmly to the marked evacuation point.");

  function isValidCoord(lat, lon) {
    return typeof lat === "number" && typeof lon === "number";
  }

  function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  }

  const selectedUserObj = useMemo(() => users.find((u) => u.user_id === selectedUserId), [users, selectedUserId]);

  const others = useMemo(() => users.filter((u) => u.user_id !== me.user_id), [users, me.user_id]);
  const usersById = useMemo(() => {
    const map = {};
    for (const u of users) {
      map[u.user_id] = u;
    }
    return map;
  }, [users]);

  const displayUsersById = useMemo(() => {
    const validUsers = users.filter((u) => isValidCoord(u.lat, u.lon));
    const groupedByCoord = validUsers.reduce((acc, user) => {
      const key = `${user.lat.toFixed(5)},${user.lon.toFixed(5)}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(user);
      return acc;
    }, {});

    const map = {};
    Object.values(groupedByCoord).forEach((group) => {
      // Sort by user_id to ensure stable indices. This prevents the "dancing" / spinning markers.
      group.sort((a, b) => a.user_id.localeCompare(b.user_id));

      if (group.length === 1) {
        const only = group[0];
        map[only.user_id] = only;
        return;
      }

      const radius = 0.00015;
      group.forEach((user, index) => {
        const angle = (2 * Math.PI * index) / group.length;
        map[user.user_id] = {
          ...user,
          lat: user.lat + radius * Math.cos(angle),
          lon: user.lon + radius * Math.sin(angle),
        };
      });
    });

    return map;
  }, [users]);

  const mapRegion = useMemo(
    () => ({
      latitude: me.lat || 12.9716,
      longitude: me.lon || 77.5946,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }),
    [me.lat, me.lon]
  );

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={mapRegion}
        onLongPress={({ nativeEvent }) => {
          if (me.role !== "rescuer") {
            return;
          }
          const point = {
            lat: nativeEvent.coordinate.latitude,
            lon: nativeEvent.coordinate.longitude,
          };
          if (isPickEvacMode) {
            setEvacPointDraft(point);
            return;
          }
          onDropBeacon(point);
        }}
      >
        {users
          .filter((u) => isValidCoord(u.lat, u.lon))
          .map((u) => {
            const displayUser = displayUsersById[u.user_id] || u;
            const isMe = me && u.user_id === me.user_id;

            const baseColor =
              u.role === "rescuer" ? "#ea580c" : stringToColor(u.user_id || u.name || "");
            const markerColor = isMe ? "rgba(37, 99, 235, 0.4)" : baseColor;
            const size = isMe ? 36 : 28;

            return (
              <Marker
                key={u.user_id}
                coordinate={{ latitude: displayUser.lat, longitude: displayUser.lon }}
                title={isMe ? `${u.name} (You)` : u.name}
                description={`${u.role}${u.arrived ? " • safe" : ""}`}
                onPress={() => setSelectedUserId(u.user_id)}
                zIndex={isMe ? 999 : 1}
                tracksViewChanges={false}
              >
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: markerColor,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 2,
                    borderColor: "white",
                  }}
                >
                  {isMe ? (
                    <View style={styles.myLocationDotInner} />
                  ) : (
                    <Text style={{ color: "white", fontWeight: "bold", fontSize: 12 }}>
                      {u.name ? u.name.charAt(0).toUpperCase() : "?"}
                    </Text>
                  )}
                </View>
              </Marker>
            );
          })}

        {chatLinks
          .map((link) => {
            const a = displayUsersById[link.a] || usersById[link.a];
            const b = displayUsersById[link.b] || usersById[link.b];
            if (!a || !b || !isValidCoord(a.lat, a.lon) || !isValidCoord(b.lat, b.lon)) {
              return null;
            }
            return (
              <Polyline
                key={`${link.a}-${link.b}`}
                coordinates={[
                  { latitude: a.lat, longitude: a.lon },
                  { latitude: b.lat, longitude: b.lon },
                ]}
                strokeColor="#dc2626"
                strokeWidth={3}
              />
            );
          })
          .filter(Boolean)}

        {beacons
          .filter((b) => isValidCoord(b.lat, b.lon))
          .map((b) => (
            <Marker
              key={b.beacon_id}
              coordinate={{ latitude: b.lat, longitude: b.lon }}
              title="Supply Beacon"
              description={b.note || "Supplies dropped here"}
              pinColor="#2563eb"
            />
          ))}

        {evacuation && isValidCoord(evacuation.lat, evacuation.lon) ? (
          <Marker
            coordinate={{ latitude: evacuation.lat, longitude: evacuation.lon }}
            title="Evacuation Point"
            description={evacuation.message || "Evacuate now"}
            pinColor="#16a34a"
          />
        ) : null}
      </MapView>

      <View style={styles.topStrip}>
        <Text style={styles.title}>{me?.role === "rescuer" ? "Rescuer Map" : "Survivor Map"}</Text>
        <Text style={styles.meta}>Users: {users.length} ({users.filter(u => isValidCoord(u.lat, u.lon)).length} on map) • Links: {chatLinks.length} • Beacons: {beacons.length}</Text>
      </View>

      <View style={styles.bottomPanel}>
        <Text style={styles.panelTitle}>
          Selected: {selectedUserObj ? selectedUserObj.name : "none"}
        </Text>

        {selectedUserId ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Message selected user"
              value={chatText}
              onChangeText={setChatText}
            />
            <Pressable
              style={styles.btnSecondary}
              onPress={() => {
                if (!chatText.trim()) return;
                onSendChat(selectedUserId, chatText.trim());
                setChatText("");
              }}
            >
              <Text style={styles.btnText}>Send Chat</Text>
            </Pressable>
          </>
        ) : null}

        {me.role === "rescuer" ? (
          <>
            <Text style={styles.smallInfo}>Long-press map to drop supply beacon.</Text>
            <Pressable
              style={[styles.btnPrimary, isPickEvacMode && styles.btnWarn]}
              onPress={() => setIsPickEvacMode((v) => !v)}
            >
              <Text style={styles.btnText}>
                {isPickEvacMode ? "Cancel Evac Point Picking" : "Pick Evac Point On Map"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                if (!selectedUserId) return;
                onFlashlightPing(selectedUserId);
              }}
            >
              <Text style={styles.btnText}>Flashlight Ping Selected User</Text>
            </Pressable>
          </>
        ) : null}

        <Pressable style={styles.btnGuides} onPress={onOpenOfflineGuides}>
          <Text style={styles.btnGuidesText}>Offline Survival Guides</Text>
        </Pressable>
      </View>

      <Modal visible={!!evacPointDraft} transparent animationType="slide">
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Broadcast Evacuation</Text>
            <Text style={styles.modalMeta}>
              Target: {evacPointDraft?.lat?.toFixed(5)}, {evacPointDraft?.lon?.toFixed(5)}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={evacMessageDraft}
              onChangeText={setEvacMessageDraft}
              placeholder="Evacuation message"
              multiline
            />
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                if (!evacPointDraft) return;
                onBroadcastEvacuation(evacPointDraft, evacMessageDraft);
                setEvacPointDraft(null);
                setIsPickEvacMode(false);
              }}
            >
              <Text style={styles.btnText}>Send Broadcast</Text>
            </Pressable>
            <Pressable style={styles.btnMuted} onPress={() => setEvacPointDraft(null)}>
              <Text style={styles.btnMutedText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffaf0",
  },
  map: {
    flex: 1,
  },
  topStrip: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: "#fdba74",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#9a3412",
  },
  meta: {
    marginTop: 2,
    color: "#7c2d12",
    fontSize: 12,
  },
  bottomPanel: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  panelTitle: {
    color: "#7c2d12",
    fontWeight: "700",
  },
  smallInfo: {
    color: "#92400e",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "white",
  },
  btnPrimary: {
    backgroundColor: "#dc2626",
    borderRadius: 10,
    padding: 11,
    alignItems: "center",
  },
  btnWarn: {
    backgroundColor: "#b91c1c",
  },
  btnSecondary: {
    backgroundColor: "#ea580c",
    borderRadius: 10,
    padding: 11,
    alignItems: "center",
  },
  btnText: {
    color: "white",
    fontWeight: "800",
  },
  btnGuides: {
    borderRadius: 10,
    padding: 11,
    alignItems: "center",
    backgroundColor: "#1d4ed8",
  },
  btnGuidesText: {
    color: "white",
    fontWeight: "800",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  modalCard: {
    backgroundColor: "#fff7ed",
    padding: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  modalTitle: {
    fontSize: 18,
    color: "#9a3412",
    fontWeight: "800",
  },
  modalMeta: {
    marginTop: 4,
    marginBottom: 8,
    color: "#7c2d12",
  },
  modalInput: {
    minHeight: 68,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  btnMuted: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fdba74",
    padding: 11,
    alignItems: "center",
    backgroundColor: "#ffedd5",
  },
  btnMutedText: {
    color: "#9a3412",
    fontWeight: "700",
  },
  myLocationDotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(37, 99, 235, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  myLocationDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#2563eb",
    borderWidth: 2,
    borderColor: "white",
  },
});
