import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
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
  activeFlashTargets,
  onSendChat,
  onDropBeacon,
  onUpdateMySupplies,
  onFlashlightPing,
  onStopFlashlight,
  onBroadcastEvacuation,
  onOpenOfflineGuides,
}) {
  const mapRef = React.useRef(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [chatText, setChatText] = useState("");
  const [mySupplyInput, setMySupplyInput] = useState("");
  const [isPickEvacMode, setIsPickEvacMode] = useState(false);
  const [beaconPointDraft, setBeaconPointDraft] = useState(null);
  const [beaconSupplyTypeDraft, setBeaconSupplyTypeDraft] = useState("Mixed Supplies");
  const [beaconQuantityDraft, setBeaconQuantityDraft] = useState("");
  const [beaconNoteDraft, setBeaconNoteDraft] = useState("Supplies dropped here");
  const [evacPointDraft, setEvacPointDraft] = useState(null);
  const [evacMessageDraft, setEvacMessageDraft] = useState("Proceed calmly to the marked evacuation point.");

  const mySupplies = useMemo(() => {
    const meFromUsers = users.find((u) => u.user_id === me.user_id);
    return Array.isArray(meFromUsers?.supplies) ? meFromUsers.supplies : [];
  }, [users, me.user_id]);

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
  const selectedUserIsActivelyPinged = useMemo(
    () => !!selectedUserId && (activeFlashTargets || []).includes(selectedUserId),
    [activeFlashTargets, selectedUserId]
  );

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

  const centerOnMe = () => {
    if (!mapRef.current || !me || !isValidCoord(me.lat, me.lon)) return;
    mapRef.current.animateToRegion({
      latitude: me.lat,
      longitude: me.lon,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapView onPress={() => setSelectedUserId("")}
        ref={mapRef}
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
          setBeaconPointDraft(point);
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
                description={`${u.role}${u.arrived ? " • safe" : ""}${u.supplies?.length ? ` • supplies: ${u.supplies.length}` : ""}`}
                onPress={(e) => { e.stopPropagation(); setSelectedUserId(u.user_id); }}
                zIndex={isMe ? 999 : 1}
                tracksViewChanges={Platform.OS === "ios" ? false : true}
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
              title={`Supply Beacon: ${b.supply_type || "Mixed Supplies"}`}
              description={`${b.quantity ? `Qty ${b.quantity} • ` : ""}${b.note || "Supplies dropped here"}`}
            >
              <View style={styles.supplyMarkerOuter}>
                <Text style={styles.supplyMarkerEmoji}>📦</Text>
              </View>
            </Marker>
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

      <Pressable style={styles.btnLocate} onPress={centerOnMe}>
        <Text style={{ fontSize: 24 }}>📍</Text>
      </Pressable>

      <View style={styles.bottomPanel}>
        {selectedUserId ? (
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>
              Selected: {selectedUserObj ? selectedUserObj.name : "none"}
            </Text>
            <Pressable onPress={() => setSelectedUserId("")} style={styles.btnDeselect}>
              <Text style={styles.btnDeselectText}>Close</Text>
            </Pressable>
          </View>
        ) : null}

        {selectedUserId ? (
          <>
            {selectedUserObj?.supplies?.length ? (
              <View style={styles.suppliesCard}>
                <Text style={styles.suppliesTitle}>Supplies with {selectedUserObj.name}</Text>
                <View style={styles.supplyChipWrap}>
                  {selectedUserObj.supplies.map((s) => (
                    <View key={`sel-${selectedUserObj.user_id}-${s}`} style={styles.supplyChip}>
                      <Text style={styles.supplyChipText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

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

        {me.role === "survivor" ? (
          <View style={styles.suppliesCard}> 
            <Text style={styles.suppliesTitle}>My Supplies</Text>
            {mySupplies.length ? (
              <View style={styles.supplyChipWrap}>
                {mySupplies.map((s) => (
                  <Pressable
                    key={`my-${s}`}
                    style={[styles.supplyChip, styles.supplyChipOwn]}
                    onPress={() => onUpdateMySupplies(mySupplies.filter((item) => item !== s))}
                  >
                    <Text style={styles.supplyChipText}>{s} ×</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.smallInfo}>No supplies shared yet.</Text>
            )}

            <View style={styles.inlineRow}>
              <TextInput
                style={[styles.input, styles.inlineInput]}
                placeholder="Add item (e.g. Water, Bandages)"
                value={mySupplyInput}
                onChangeText={setMySupplyInput}
              />
              <Pressable
                style={styles.btnMini}
                onPress={() => {
                  const value = mySupplyInput.trim();
                  if (!value) return;
                  const next = mySupplies.includes(value) ? mySupplies : [...mySupplies, value];
                  onUpdateMySupplies(next);
                  setMySupplyInput("");
                }}
              >
                <Text style={styles.btnMiniText}>Add</Text>
              </Pressable>
            </View>
          </View>
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
{selectedUserId && selectedUserId !== me?.user_id ? (
                <Pressable
                  style={styles.btnPrimary}
                  onPress={() => {
                    if (!selectedUserId) return;
                    onFlashlightPing(selectedUserId);
                  }}
                >
                  <Text style={styles.btnText}>Start Flash + Beep Alert</Text>
                </Pressable>
              ) : null}
            {selectedUserId && selectedUserId !== me?.user_id ? (
              <Pressable
                style={[styles.btnStopFlash, !selectedUserIsActivelyPinged && styles.btnDisabled]}
                disabled={!selectedUserIsActivelyPinged}
                onPress={() => {
                  if (!selectedUserId) return;
                  onStopFlashlight(selectedUserId);
                }}
              >
                <Text style={styles.btnText}>Stop Flash Alert</Text>
              </Pressable>
            ) : null}
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

      <Modal visible={!!beaconPointDraft} transparent animationType="slide">
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Drop Supply Beacon</Text>
            <Text style={styles.modalMeta}>
              Point: {beaconPointDraft?.lat?.toFixed(5)}, {beaconPointDraft?.lon?.toFixed(5)}
            </Text>

            <Text style={styles.fieldLabel}>Supply Type</Text>
            <View style={styles.supplyTypeRow}>
              {["Food", "Water", "Medicine", "Mixed Supplies"].map((type) => (
                <Pressable
                  key={type}
                  style={[styles.supplyTypePill, beaconSupplyTypeDraft === type && styles.supplyTypePillActive]}
                  onPress={() => setBeaconSupplyTypeDraft(type)}
                >
                  <Text
                    style={[
                      styles.supplyTypePillText,
                      beaconSupplyTypeDraft === type && styles.supplyTypePillTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Quantity (e.g. 20 kits)"
              value={beaconQuantityDraft}
              onChangeText={setBeaconQuantityDraft}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Note"
              value={beaconNoteDraft}
              onChangeText={setBeaconNoteDraft}
            />

            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                if (!beaconPointDraft) return;
                onDropBeacon({
                  ...beaconPointDraft,
                  supplyType: beaconSupplyTypeDraft,
                  quantity: beaconQuantityDraft.trim(),
                  note: beaconNoteDraft.trim() || "Supplies dropped here",
                });
                setBeaconPointDraft(null);
                setBeaconSupplyTypeDraft("Mixed Supplies");
                setBeaconQuantityDraft("");
                setBeaconNoteDraft("Supplies dropped here");
              }}
            >
              <Text style={styles.btnText}>Publish Supply Beacon</Text>
            </Pressable>
            <Pressable style={styles.btnMuted} onPress={() => setBeaconPointDraft(null)}>
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
    backgroundColor: "#F3F4F6",
  },
  map: {
    flex: 1,
  },
  topStrip: {
    position: "absolute",
    top: 24,
    left: 16,
    right: 16,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: -0.5,
  },
  meta: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
  },
  bottomPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  btnDeselect: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
  },
  btnDeselectText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  panelTitle: {
    color: "#374151",
    fontWeight: "800",
    fontSize: 15,
  },
  smallInfo: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
  },
  suppliesCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  suppliesTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  supplyChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  supplyChip: {
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  supplyChipOwn: {
    backgroundColor: "#bfdbfe",
  },
  supplyChipText: {
    color: "#1e3a8a",
    fontSize: 12,
    fontWeight: "700",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineInput: {
    flex: 1,
    marginBottom: 0,
  },
  btnMini: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnMiniText: {
    color: "#fff",
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#F9FAFB",
    fontSize: 15,
  },
  btnPrimary: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  btnWarn: {
    backgroundColor: "#DC2626",
  },
  btnStopFlash: {
    backgroundColor: "#b91c1c",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  btnDisabled: {
    backgroundColor: "#9ca3af",
  },
  btnSecondary: {
    backgroundColor: "#3B82F6",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  btnText: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },
  btnGuides: {
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  btnGuidesText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 15,
  },
  btnLocate: {
    position: "absolute",
    right: 16,
    bottom: 240, 
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    backgroundColor: "white",
    padding: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  modalTitle: {
    fontSize: 20,
    color: "#111827",
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  modalMeta: {
    marginTop: 6,
    marginBottom: 16,
    color: "#6B7280",
    fontSize: 14,
  },
  modalInput: {
    minHeight: 52,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  fieldLabel: {
    color: "#334155",
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 13,
  },
  supplyTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  supplyTypePill: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  supplyTypePillActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  supplyTypePillText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  supplyTypePillTextActive: {
    color: "#fff",
  },
  supplyMarkerOuter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0ea5e9",
    borderWidth: 2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  supplyMarkerEmoji: {
    fontSize: 16,
  },
  btnMuted: {
    marginTop: 8,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  btnMutedText: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 15,
  },
  myLocationDotOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  myLocationDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3B82F6",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});
