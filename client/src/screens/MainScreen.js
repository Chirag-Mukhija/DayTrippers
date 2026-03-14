import React, { useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Polyline, Callout } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, DARK_MAP_STYLE, FONTS, RADIUS, SPACING } from "../theme";

export default function MainScreen({
  me,
  users,
  chatLinks,
  beacons,
  evacuation,
  activeFlashTargets,
  onSendChat,
  onDropBeacon,
  onRemoveBeacon,
  onUpdateMySupplies,
  onFlashlightPing,
  onStopFlashlight,
  onBroadcastEvacuation,
  onBroadcastMessage,
  onLogout,
  onOpenOfflineGuides,
  onOpenBroadcasts,
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
  const [evacMessageDraft, setEvacMessageDraft] = useState(
    "Proceed calmly to the marked evacuation point."
  );
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");

  const mySupplies = useMemo(() => {
    const meFromUsers = users.find((u) => u.user_id === me.user_id);
    return Array.isArray(meFromUsers?.supplies) ? meFromUsers.supplies : [];
  }, [users, me.user_id]);

  function isValidCoord(lat, lon) {
    return typeof lat === "number" && typeof lon === "number";
  }

  function formatLastUpdated(timestamp) {
    if (!timestamp) return "UNKNOWN";
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    return `${mins}m ago`;
  }

  function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  }

  const selectedUserObj = useMemo(
    () => users.find((u) => u.user_id === selectedUserId),
    [users, selectedUserId]
  );
  const selectedUserIsActivelyPinged = useMemo(
    () =>
      !!selectedUserId &&
      (activeFlashTargets || []).includes(selectedUserId),
    [activeFlashTargets, selectedUserId]
  );

  const others = useMemo(
    () => users.filter((u) => u.user_id !== me.user_id),
    [users, me.user_id]
  );
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
    mapRef.current.animateToRegion(
      {
        latitude: me.lat,
        longitude: me.lon,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      1000
    );
  };

  const isRescuer = me?.role === "rescuer";

  return (
    <SafeAreaView style={styles.container}>
      {/* ───── MAP ───── */}
      <MapView
        onPress={() => {
          setSelectedUserId("");
          Keyboard.dismiss();
        }}
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        customMapStyle={DARK_MAP_STYLE}
        userInterfaceStyle="dark"
        onLongPress={({ nativeEvent }) => {
          if (me.role !== "rescuer") return;
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
        {/* User markers */}
        {users
          .filter((u) => isValidCoord(u.lat, u.lon))
          .map((u) => {
            const displayUser = displayUsersById[u.user_id] || u;
            const isMe = me && u.user_id === me.user_id;
            const isResc = u.role === "rescuer";
            const size = isMe ? 36 : 30;

            let bgColor, borderCol;
            if (isMe) {
              bgColor = COLORS.MARKER_SELF_GLOW;
              borderCol = COLORS.MARKER_SELF;
            } else if (isResc) {
              bgColor = COLORS.AMBER_DIM;
              borderCol = COLORS.AMBER;
            } else {
              bgColor = "rgba(255, 75, 75, 0.2)";
              borderCol = COLORS.NEON_RED;
            }

            return (
              <Marker
                key={u.user_id}
                coordinate={{
                  latitude: displayUser.lat,
                  longitude: displayUser.lon,
                }}
                title={isMe ? `${u.name} (You)` : u.name}
                description={`${u.role}${u.arrived ? " • safe" : ""}${
                  u.supplies?.length ? ` • supplies: ${u.supplies.length}` : ""
                }`}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedUserId(u.user_id);
                }}
                zIndex={isMe ? 999 : 1}
                tracksViewChanges={Platform.OS === "ios" ? false : true}
              >
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: bgColor,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 2,
                    borderColor: borderCol,
                  }}
                >
                  {isMe ? (
                    <View style={styles.myLocationDotInner} />
                  ) : (
                    <Text
                      style={{
                        color: borderCol,
                        fontWeight: "bold",
                        fontSize: 12,
                        fontFamily: FONTS.MONO,
                      }}
                    >
                      {u.name ? u.name.charAt(0).toUpperCase() : "?"}
                    </Text>
                  )}
                </View>
              </Marker>
            );
          })}

        {/* Chat link polylines */}
        {chatLinks
          .map((link) => {
            const a = displayUsersById[link.a] || usersById[link.a];
            const b = displayUsersById[link.b] || usersById[link.b];
            if (
              !a ||
              !b ||
              !isValidCoord(a.lat, a.lon) ||
              !isValidCoord(b.lat, b.lon)
            ) {
              return null;
            }
            return (
              <Polyline
                key={`${link.a}-${link.b}`}
                coordinates={[
                  { latitude: a.lat, longitude: a.lon },
                  { latitude: b.lat, longitude: b.lon },
                ]}
                strokeColor="rgba(255,75,75,0.4)"
                strokeWidth={2}
                lineDashPattern={[6, 4]}
              />
            );
          })
          .filter(Boolean)}

        {/* Beacons */}
        {beacons
          .filter((b) => isValidCoord(b.lat, b.lon))
          .map((b) => (
            <Marker
              key={b.beacon_id}
              coordinate={{ latitude: b.lat, longitude: b.lon }}
              title={`Supply Beacon: ${b.supply_type || "Mixed Supplies"}`}
              description={`${b.quantity ? `Qty ${b.quantity} • ` : ""}${
                b.note || "Supplies dropped here"
              }`}
            >
              <View style={styles.supplyMarkerOuter}>
                <Text style={styles.supplyMarkerEmoji}>📦</Text>
              </View>
              {isRescuer ? (
                <Callout
                  tooltip={true}
                  onPress={() => {
                    if (!b.beacon_id) return;
                    onRemoveBeacon?.(b.beacon_id);
                  }}
                >
                  <View style={styles.customCallout}>
                    <Text style={styles.calloutTitle}>Supply Beacon</Text>
                    <Text style={styles.calloutDesc}>
                      {b.quantity ? `Qty ${b.quantity} • ` : ""}
                      {b.note || "Supplies dropped here"}
                    </Text>
                    <Text style={styles.calloutAction}>Tap to remove</Text>
                  </View>
                </Callout>
              ) : null}
            </Marker>
          ))}

        {/* Evacuation marker */}
        {evacuation && isValidCoord(evacuation.lat, evacuation.lon) ? (
          <Marker
            coordinate={{
              latitude: evacuation.lat,
              longitude: evacuation.lon,
            }}
          >
            <View style={styles.evacMarker}>
              <Text style={{ fontSize: 16 }}>🟢</Text>
            </View>
            <Callout 
              tooltip={true} 
              onPress={() => {
                if (isRescuer) {
                  onBroadcastEvacuation(null, null);
                }
              }}
            >
              <View style={styles.customCallout}>
                <Text style={styles.calloutTitle}>Evacuation Point</Text>
                <Text style={styles.calloutDesc}>
                  {evacuation.message || "Evacuate now"}
                </Text>
                {isRescuer && (
                  <Text style={styles.calloutAction}>Tap to clear</Text>
                )}
              </View>
            </Callout>
          </Marker>
        ) : null}
      </MapView>

      {/* ───── TOP HUD ───── */}
      <View style={styles.topStrip}>
        <View style={styles.topRow}>
          <View style={styles.roleBadge}>
            <View
              style={[
                styles.roleDot,
                { backgroundColor: isRescuer ? COLORS.AMBER : COLORS.NEON_RED },
              ]}
            />
            <Text
              style={[
                styles.roleLabel,
                { color: isRescuer ? COLORS.AMBER : COLORS.NEON_RED },
              ]}
            >
              {isRescuer ? "RESCUER" : "SURVIVOR"} MODE
            </Text>
          </View>
          <View style={styles.meshBadge}>
            <View style={styles.meshDot} />
            <Text style={styles.meshText}>MESH ACTIVE</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          NODES: {users.length} •{" "}
          LINKS: {chatLinks.length} •{" "}
          BEACONS: {beacons.length}
        </Text>
        <Pressable style={styles.btnLocateTop} onPress={centerOnMe}>
          <Text style={styles.btnLocateTopIcon}>📍</Text>
          <Text style={styles.btnLocateTopText}>ZOOM TO MY LOCATION</Text>
        </Pressable>
      </View>

      {/* ───── BOTTOM PANEL ───── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.bottomPanelWrapper}
        pointerEvents="box-none"
      >
        <View style={styles.bottomPanel}>
        <ScrollView
          style={{ maxHeight: 340 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {/* Selected user header */}
          {selectedUserId ? (
            <View style={styles.panelHeader}>
              <View style={styles.selectedUserRow}>
                <View style={styles.selectedDot} />
                <Text style={styles.panelTitle}>
                  {selectedUserObj
                    ? selectedUserObj.name.toUpperCase()
                    : "UNKNOWN"}
                </Text>
                <View>
                  <Text style={styles.selectedRole}>
                    {selectedUserObj?.role === "rescuer"
                      ? "RESCUER"
                      : "SURVIVOR"}
                  </Text>
                  {selectedUserObj?.last_updated && (
                    <Text style={styles.lastUpdatedText}>
                      UPDATED: {formatLastUpdated(selectedUserObj.last_updated)}
                    </Text>
                  )}
                </View>
              </View>
              <Pressable
                onPress={() => setSelectedUserId("")}
                style={styles.btnDeselect}
              >
                <Text style={styles.btnDeselectText}>✕</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Selected user supplies */}
          {selectedUserId && selectedUserObj?.supplies?.length ? (
            <View style={styles.suppliesCard}>
              <Text style={styles.suppliesTitle}>
                SUPPLIES • {selectedUserObj.name}
              </Text>
              <View style={styles.supplyChipWrap}>
                {selectedUserObj.supplies.map((s) => (
                  <View
                    key={`sel-${selectedUserObj.user_id}-${s}`}
                    style={styles.supplyChip}
                  >
                    <Text style={styles.supplyChipText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Chat input */}
          {selectedUserId ? (
            <>
              <View style={styles.chatRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="SEND TACTICAL MESSAGE..."
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  value={chatText}
                  onChangeText={setChatText}
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
                <Pressable
                  style={styles.btnSend}
                  onPress={() => {
                    Keyboard.dismiss();
                    if (!chatText.trim()) return;
                    onSendChat(selectedUserId, chatText.trim());
                    setChatText("");
                  }}
                >
                  <Text style={styles.btnSendText}>SEND</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {/* ── Rescuer: Flash/Siren for selected user ── */}
          {isRescuer &&
          selectedUserId &&
          selectedUserId !== me?.user_id &&
          selectedUserObj?.role === "survivor" ? (
            <View style={styles.rescuerActions}>
              <Pressable
                style={styles.btnSiren}
                onPress={() => {
                  if (!selectedUserId) return;
                  onFlashlightPing(selectedUserId);
                }}
              >
                <Text style={styles.btnSirenIcon}>🔊</Text>
                <Text style={styles.btnSirenText}>
                  TRIGGER REMOTE SIREN
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.btnStopSiren,
                  !selectedUserIsActivelyPinged && styles.btnDisabled,
                ]}
                disabled={!selectedUserIsActivelyPinged}
                onPress={() => {
                  if (!selectedUserId) return;
                  onStopFlashlight(selectedUserId);
                }}
              >
                <Text style={styles.btnStopSirenText}>STOP ALERT</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── Survivor: My Supplies ── */}
          {me.role === "survivor" ? (
            <View style={styles.suppliesCard}>
              <Text style={styles.suppliesTitle}>MY SUPPLIES</Text>
              {mySupplies.length ? (
                <View style={styles.supplyChipWrap}>
                  {mySupplies.map((s) => (
                    <Pressable
                      key={`my-${s}`}
                      style={[styles.supplyChip, styles.supplyChipOwn]}
                      onPress={() =>
                        onUpdateMySupplies(
                          mySupplies.filter((item) => item !== s)
                        )
                      }
                    >
                      <Text style={styles.supplyChipOwnText}>{s} ✕</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.smallInfo}>
                  No supplies shared yet.
                </Text>
              )}

              <View style={styles.inlineRow}>
                <TextInput
                  style={[styles.chatInput, styles.inlineInput]}
                  placeholder="Add item (e.g. Water)"
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  value={mySupplyInput}
                  onChangeText={setMySupplyInput}
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    const value = mySupplyInput.trim();
                    if (!value) return;
                    const next = mySupplies.includes(value)
                      ? mySupplies
                      : [...mySupplies, value];
                    onUpdateMySupplies(next);
                    setMySupplyInput("");
                  }}
                  blurOnSubmit={true}
                />
                <Pressable
                  style={styles.btnMini}
                  onPress={() => {
                    Keyboard.dismiss();
                    const value = mySupplyInput.trim();
                    if (!value) return;
                    const next = mySupplies.includes(value)
                      ? mySupplies
                      : [...mySupplies, value];
                    onUpdateMySupplies(next);
                    setMySupplyInput("");
                  }}
                >
                  <Text style={styles.btnMiniText}>ADD</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* ── Rescuer tools ── */}
          {isRescuer ? (
            <>
              <Text style={styles.smallInfo}>
                LONG-PRESS MAP TO DROP SUPPLY BEACON
              </Text>
              <Pressable
                style={[
                  styles.btnTactical,
                  isPickEvacMode && styles.btnTacticalActive,
                ]}
                onPress={() => setIsPickEvacMode((v) => !v)}
              >
                <Text style={styles.btnTacticalText}>
                  {isPickEvacMode
                    ? "✕ CANCEL PICKING"
                    : "📍 PICK EVAC POINT ON MAP"}
                </Text>
              </Pressable>

              {evacuation ? (
                <Pressable
                  style={[styles.btnTactical, { marginTop: 10, borderColor: "#FF4B4B" }]}
                  onPress={() => onBroadcastEvacuation(null, null)}
                >
                  <Text style={[styles.btnTacticalText, { color: "#FF4B4B" }]}>
                    ✕ CLEAR ACTIVE EVACUATION
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {/* ── Rescuer: Broadcast to all ── */}
          {isRescuer ? (
            <Pressable
              style={styles.btnBroadcast}
              onPress={() => setShowBroadcastModal(true)}
            >
              <Text style={styles.btnBroadcastIcon}>📡</Text>
              <Text style={styles.btnBroadcastText}>
                BROADCAST TO ALL NODES
              </Text>
            </Pressable>
          ) : null}

          {/* Offline guides */}
          {!isRescuer ? (
            <Pressable style={styles.btnGuides} onPress={onOpenOfflineGuides}>
              <Text style={styles.btnGuidesIcon}>📖</Text>
              <Text style={styles.btnGuidesText}>
                OFFLINE SURVIVAL GUIDES
              </Text>
            </Pressable>
          ) : null}

          {/* Broadcast history */}
          <Pressable style={styles.btnGuides} onPress={onOpenBroadcasts}>
            <Text style={styles.btnGuidesIcon}>🗄️</Text>
            <Text style={styles.btnGuidesText}>
              BROADCAST HISTORY
            </Text>
          </Pressable>

          {/* Logout */}
          <Pressable style={styles.btnLogout} onPress={onLogout}>
            <Text style={styles.btnLogoutText}>⏻ DISCONNECT SESSION</Text>
          </Pressable>
        </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* ───── EVACUATION MODAL ───── */}
      <Modal visible={!!evacPointDraft} transparent animationType="slide">
        <Pressable style={styles.modalRoot} onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>BROADCAST EVACUATION</Text>
            <Text style={styles.modalMeta}>
              TARGET: {evacPointDraft?.lat?.toFixed(5)},{" "}
              {evacPointDraft?.lon?.toFixed(5)}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={evacMessageDraft}
              onChangeText={setEvacMessageDraft}
              placeholder="Evacuation message"
              placeholderTextColor={COLORS.TEXT_MUTED}
              multiline
            />
            <Pressable
              style={styles.btnModalPrimary}
              onPress={() => {
                if (!evacPointDraft) return;
                onBroadcastEvacuation(evacPointDraft, evacMessageDraft);
                setEvacPointDraft(null);
                setIsPickEvacMode(false);
              }}
            >
              <Text style={styles.btnModalPrimaryText}>
                SEND BROADCAST
              </Text>
            </Pressable>
            <Pressable
              style={styles.btnModalCancel}
              onPress={() => setEvacPointDraft(null)}
            >
              <Text style={styles.btnModalCancelText}>CANCEL</Text>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ───── BEACON DROP MODAL ───── */}
      <Modal visible={!!beaconPointDraft} transparent animationType="slide">
        <Pressable style={styles.modalRoot} onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>DROP SUPPLY BEACON</Text>
            <Text style={styles.modalMeta}>
              POINT: {beaconPointDraft?.lat?.toFixed(5)},{" "}
              {beaconPointDraft?.lon?.toFixed(5)}
            </Text>

            <Text style={styles.fieldLabel}>SUPPLY TYPE</Text>
            <View style={styles.supplyTypeRow}>
              {["Food", "Water", "Medicine", "Mixed Supplies"].map(
                (type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.supplyTypePill,
                      beaconSupplyTypeDraft === type &&
                        styles.supplyTypePillActive,
                    ]}
                    onPress={() => setBeaconSupplyTypeDraft(type)}
                  >
                    <Text
                      style={[
                        styles.supplyTypePillText,
                        beaconSupplyTypeDraft === type &&
                          styles.supplyTypePillTextActive,
                      ]}
                    >
                      {type.toUpperCase()}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Quantity (e.g. 20 kits)"
              placeholderTextColor={COLORS.TEXT_MUTED}
              value={beaconQuantityDraft}
              onChangeText={setBeaconQuantityDraft}
              onSubmitEditing={() => Keyboard.dismiss()}
              blurOnSubmit={true}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Note"
              placeholderTextColor={COLORS.TEXT_MUTED}
              value={beaconNoteDraft}
              onChangeText={setBeaconNoteDraft}
              onSubmitEditing={() => Keyboard.dismiss()}
              blurOnSubmit={true}
            />
            <Pressable
              style={styles.btnModalPrimary}
              onPress={() => {
                Keyboard.dismiss();
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
              <Text style={styles.btnModalPrimaryText}>
                PUBLISH BEACON
              </Text>
            </Pressable>
            <Pressable
              style={styles.btnModalCancel}
              onPress={() => setBeaconPointDraft(null)}
            >
              <Text style={styles.btnModalCancelText}>CANCEL</Text>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ───── BROADCAST MESSAGE MODAL ───── */}
      <Modal visible={showBroadcastModal} transparent animationType="slide">
        <Pressable style={styles.modalRoot} onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>📡 BROADCAST TO ALL</Text>
            <Text style={styles.modalMeta}>
              MESSAGE WILL BE SENT TO ALL {users.length - 1} ACTIVE NODES
            </Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 80 }]}
              value={broadcastText}
              onChangeText={setBroadcastText}
              placeholder="Type broadcast message..."
              placeholderTextColor={COLORS.TEXT_MUTED}
              multiline
            />
            <Pressable
              style={styles.btnModalPrimary}
              onPress={() => {
                if (!broadcastText.trim()) return;
                onBroadcastMessage(broadcastText.trim());
                setBroadcastText("");
                setShowBroadcastModal(false);
              }}
            >
              <Text style={styles.btnModalPrimaryText}>
                SEND BROADCAST
              </Text>
            </Pressable>
            <Pressable
              style={styles.btnModalCancel}
              onPress={() => {
                setBroadcastText("");
                setShowBroadcastModal(false);
              }}
            >
              <Text style={styles.btnModalCancelText}>CANCEL</Text>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  map: {
    flex: 1,
  },

  // ── TOP HUD ──
  topStrip: {
    position: "absolute",
    top: 54,
    left: 12,
    right: 12,
    borderRadius: RADIUS.LG,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(10, 10, 15, 0.92)",
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    fontFamily: FONTS.MONO,
  },
  meshBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.NEON_GREEN_DIM,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.PILL,
  },
  meshDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.NEON_GREEN,
    marginRight: 5,
  },
  meshText: {
    color: COLORS.NEON_GREEN,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: FONTS.MONO,
  },
  meta: {
    color: COLORS.TEXT_MUTED,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    fontFamily: FONTS.MONO,
  },

  // ── LOCATE ──
  btnLocateTop: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: RADIUS.MD,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  btnLocateTopIcon: {
    fontSize: 16,
  },
  btnLocateTopText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    fontFamily: FONTS.MONO,
  },

  // ── BOTTOM PANEL ──
  bottomPanelWrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    paddingBottom: 24,
  },
  bottomPanel: {
    backgroundColor: "rgba(18, 18, 26, 0.96)",
    borderRadius: RADIUS.XL,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },

  // ── SELECTED USER ──
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  selectedUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.NEON_RED,
  },
  panelTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  selectedRole: {
    color: COLORS.TEXT_MUTED,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: FONTS.MONO,
    backgroundColor: COLORS.CARD,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
    letterSpacing: 0.5,
  },
  lastUpdatedText: {
    color: COLORS.NEON_GREEN,
    fontSize: 9,
    fontWeight: "700",
    fontFamily: FONTS.MONO,
    letterSpacing: 0.5,
    marginTop: 2,
    marginLeft: 2,
  },
  btnDeselect: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.CARD,
    borderRadius: RADIUS.SM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  btnDeselectText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },

  // ── CHAT ──
  chatRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 4,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.SM,
    padding: 12,
    backgroundColor: COLORS.INPUT_BG,
    fontSize: 13,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONTS.MONO,
  },
  btnSend: {
    backgroundColor: COLORS.NEON_RED,
    borderRadius: RADIUS.SM,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  btnSendText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },

  // ── RESCUER ACTIONS ──
  rescuerActions: {
    gap: 8,
    marginVertical: 4,
  },
  btnSiren: {
    backgroundColor: COLORS.NEON_RED,
    borderRadius: RADIUS.SM,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: COLORS.NEON_RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  btnSirenIcon: {
    fontSize: 16,
  },
  btnSirenText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1,
  },
  btnStopSiren: {
    backgroundColor: "rgba(255,75,75,0.15)",
    borderWidth: 1,
    borderColor: COLORS.NEON_RED,
    borderRadius: RADIUS.SM,
    padding: 12,
    alignItems: "center",
  },
  btnStopSirenText: {
    color: COLORS.NEON_RED,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1,
  },
  btnDisabled: {
    opacity: 0.3,
    borderColor: COLORS.TEXT_MUTED,
  },

  // ── SUPPLIES ──
  suppliesCard: {
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.MD,
    padding: 12,
    gap: 8,
    marginVertical: 4,
  },
  suppliesTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.TEXT_SECONDARY,
    letterSpacing: 1.5,
    fontFamily: FONTS.MONO,
  },
  supplyChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  supplyChip: {
    backgroundColor: COLORS.CYAN_DIM,
    borderRadius: RADIUS.PILL,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.2)",
  },
  supplyChipText: {
    color: COLORS.CYAN,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: FONTS.MONO,
  },
  supplyChipOwn: {
    backgroundColor: COLORS.NEON_GREEN_DIM,
    borderColor: "rgba(0,255,136,0.2)",
  },
  supplyChipOwnText: {
    color: COLORS.NEON_GREEN,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: FONTS.MONO,
  },
  smallInfo: {
    color: COLORS.TEXT_MUTED,
    fontSize: 11,
    fontWeight: "600",
    fontFamily: FONTS.MONO,
    letterSpacing: 0.5,
    marginVertical: 4,
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
    backgroundColor: COLORS.NEON_GREEN,
    borderRadius: RADIUS.SM,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnMiniText: {
    color: COLORS.DARK_BG,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },

  // ── RESCUER TOOLS ──
  btnTactical: {
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.SM,
    padding: 14,
    alignItems: "center",
    marginVertical: 2,
  },
  btnTacticalActive: {
    backgroundColor: COLORS.NEON_RED_DIM,
    borderColor: COLORS.NEON_RED,
  },
  btnTacticalText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: FONTS.MONO,
  },

  // ── GUIDES BUTTON ──
  btnGuides: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS.SM,
    padding: 12,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginTop: 2,
  },
  btnGuidesIcon: {
    fontSize: 14,
  },
  btnGuidesText: {
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: FONTS.MONO,
  },

  // ── BROADCAST ──
  btnBroadcast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.AMBER_DIM,
    borderWidth: 1,
    borderColor: COLORS.AMBER,
    borderRadius: RADIUS.SM,
    padding: 14,
    marginVertical: 2,
  },
  btnBroadcastIcon: {
    fontSize: 14,
  },
  btnBroadcastText: {
    color: COLORS.AMBER,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: FONTS.MONO,
  },

  // ── LOGOUT ──
  btnLogout: {
    borderRadius: RADIUS.SM,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,75,75,0.2)",
    backgroundColor: "transparent",
    marginTop: 4,
  },
  btnLogoutText: {
    color: COLORS.NEON_RED,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: FONTS.MONO,
    opacity: 0.7,
  },
  myLocationDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.MARKER_SELF,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: COLORS.MARKER_SELF,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  supplyMarkerOuter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.CYAN_DIM,
    borderWidth: 2,
    borderColor: COLORS.CYAN,
    justifyContent: "center",
    alignItems: "center",
  },
  supplyMarkerEmoji: {
    fontSize: 16,
  },
  evacMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.NEON_GREEN_DIM,
    borderWidth: 2,
    borderColor: COLORS.NEON_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── MODALS ──
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: COLORS.OVERLAY,
  },
  modalCard: {
    backgroundColor: COLORS.SURFACE,
    padding: SPACING.XXL,
    borderTopLeftRadius: RADIUS.XL,
    borderTopRightRadius: RADIUS.XL,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    borderBottomWidth: 0,
  },
  modalTitle: {
    fontSize: 18,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "900",
    letterSpacing: 1,
  },
  modalMeta: {
    marginTop: 6,
    marginBottom: 16,
    color: COLORS.TEXT_MUTED,
    fontSize: 11,
    fontFamily: FONTS.MONO,
    letterSpacing: 0.5,
  },
  modalInput: {
    minHeight: 48,
    backgroundColor: COLORS.INPUT_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.SM,
    padding: 14,
    marginBottom: 12,
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
  },
  fieldLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 11,
    fontFamily: FONTS.MONO,
    letterSpacing: 1,
    marginBottom: 8,
  },
  supplyTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  supplyTypePill: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.CARD,
    borderRadius: RADIUS.PILL,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  supplyTypePillActive: {
    backgroundColor: COLORS.CYAN_DIM,
    borderColor: COLORS.CYAN,
  },
  supplyTypePillText: {
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: FONTS.MONO,
  },
  supplyTypePillTextActive: {
    color: COLORS.CYAN,
  },
  btnModalPrimary: {
    backgroundColor: COLORS.NEON_RED,
    borderRadius: RADIUS.SM,
    padding: 16,
    alignItems: "center",
    shadowColor: COLORS.NEON_RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  btnModalPrimaryText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1,
  },
  btnModalCancel: {
    marginTop: 10,
    borderRadius: RADIUS.SM,
    padding: 14,
    alignItems: "center",
  },
  btnModalCancelText: {
    color: COLORS.TEXT_MUTED,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  
  // ── CALLOUT ──
  customCallout: {
    backgroundColor: "rgba(18, 18, 26, 0.95)",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    alignItems: "center",
    minWidth: 140,
  },
  calloutTitle: {
    color: "#66FF66",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  calloutDesc: {
    color: COLORS.TEXT,
    fontSize: 12,
    textAlign: "center",
  },
  calloutAction: {
    color: "#FF4B4B",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 6,
    textTransform: "uppercase",
  },
});
