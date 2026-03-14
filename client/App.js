import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StatusBar, StyleSheet, Text, Vibration, View } from "react-native";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
import LoginScreen from "./src/screens/LoginScreen";
import DisasterAlertScreen from "./src/screens/DisasterAlertScreen";
import SafeZoneScreen from "./src/screens/SafeZoneScreen";
import MainScreen from "./src/screens/MainScreen";
import OfflineGuidesScreen from "./src/screens/OfflineGuidesScreen";
import { connectSocket, disconnectSocket } from "./src/services/socket";
import { LOCATION_PUSH_INTERVAL_MS, START_COORDS } from "./src/config";

function randomId() {
  return `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeUserCoords(user) {
  if (!user) return user;
  return {
    ...user,
    lat: toNumberOrNull(user.lat),
    lon: toNumberOrNull(user.lon),
  };
}

export default function App() {
  const socketRef = useRef(null);
  const locationSubscriptionRef = useRef(null);
  const flashTimeoutRef = useRef(null);
  const meRef = useRef(null);
  const [screen, setScreen] = useState("login");
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [chatLinks, setChatLinks] = useState([]);
  const [beacons, setBeacons] = useState([]);
  const [evacuation, setEvacuation] = useState(null);
  const [disasterAlert, setDisasterAlert] = useState(null);
  const [safeZone, setSafeZone] = useState(null);
  const [flashUntilTs, setFlashUntilTs] = useState(0);

  const meInUsers = useMemo(() => {
    if (!me) return null;
    return users.find((u) => u.user_id === me.user_id) || me;
  }, [users, me]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    return () => {
      disconnectSocket();
      locationSubscriptionRef.current?.remove();
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!me || screen === "login" || screen === "guides") return;
    const s = socketRef.current;
    if (!s) return;

    const id = setInterval(() => {
      const current = me;
      if (!current) return;
      s.emit("location_update", {
        user_id: current.user_id,
        lat: current.lat,
        lon: current.lon,
      });
    }, LOCATION_PUSH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [me, screen]);

  function attachSocketHandlers(socket) {
    socket.on("bootstrap_state", (payload) => {
      setUsers((payload.users || []).map(normalizeUserCoords));
      setChatLinks(payload.chat_links || []);
      setBeacons(payload.beacons || []);
      setEvacuation(payload.evacuation || null);
    });

    socket.on("presence_update", (payload) => {
      setUsers((payload.users || []).map(normalizeUserCoords));
    });

    socket.on("user_moved", ({ user_id, lat, lon }) => {
      setUsers((current) =>
        current.map((u) =>
          u.user_id === user_id
            ? {
                ...u,
                lat: toNumberOrNull(lat),
                lon: toNumberOrNull(lon),
              }
            : u
        )
      );
    });

    socket.on("disaster_alert", (payload) => {
      setDisasterAlert(payload);
      setScreen("alert");
    });

    socket.on("nearest_safe_zone", (payload) => {
      setSafeZone(payload);
    });

    socket.on("arrival_confirmed", () => {
      setScreen("main");
    });

    socket.on("chat_link_created", (payload) => {
      setChatLinks((current) => {
        const exists = current.some((l) => l.a === payload.a && l.b === payload.b);
        if (exists) return current;
        return [...current, payload];
      });
    });

    socket.on("beacon_dropped", (payload) => {
      setBeacons((current) => [payload, ...current]);
    });

    socket.on("evacuation_broadcast", (payload) => {
      setEvacuation(payload);
      Alert.alert("Evacuation Alert", payload.message || "Evacuate now");
    });

    socket.on("flashlight_command", (payload) => {
      const durationMs = Math.max(1000, (payload.duration_s || 3) * 1000);
      setFlashUntilTs(Date.now() + durationMs);
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
      flashTimeoutRef.current = setTimeout(() => setFlashUntilTs(0), durationMs + 100);
      Vibration.vibrate(durationMs);
      Alert.alert("Flashlight Ping", `Identify this phone now (${payload.duration_s || 3}s).`);
    });

    socket.on("chat_message", (payload) => {
      const fromSelf = payload.from_user_id === meRef.current?.user_id;
      if (!fromSelf) {
        Alert.alert("New Message", `${payload.from_user_id.slice(0, 6)}: ${payload.text}`);
      }
    });
  }

  async function initLiveLocation() {
    let permission;
    try {
      permission = await Location.requestForegroundPermissionsAsync();
    } catch {
      return {
        lat: START_COORDS.lat,
        lon: START_COORDS.lon,
      };
    }

    if (permission.status !== "granted") {
      return {
        lat: START_COORDS.lat,
        lon: START_COORDS.lon,
      };
    }

    let current;
    try {
      current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch {
      return {
        lat: START_COORDS.lat,
        lon: START_COORDS.lon,
      };
    }

    try {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LOCATION_PUSH_INTERVAL_MS,
          distanceInterval: 2,
        },
        (position) => {
          setMe((state) => {
            if (!state) return state;
            return {
              ...state,
              lat: Number(position.coords.latitude.toFixed(6)),
              lon: Number(position.coords.longitude.toFixed(6)),
            };
          });
        }
      );
    } catch {
      // Continue without live tracking if watch setup fails.
    }

    return {
      lat: Number(current.coords.latitude.toFixed(6)),
      lon: Number(current.coords.longitude.toFixed(6)),
    };
  }

  async function handleJoin({ name, role }) {
    let initialLocation = {
      lat: START_COORDS.lat,
      lon: START_COORDS.lon,
    };
    try {
      initialLocation = await initLiveLocation();
    } catch {
      Alert.alert("Location unavailable", "Continuing with fallback coordinates.");
    }

    const user = {
      user_id: randomId(),
      name,
      role,
      lat: toNumberOrNull(initialLocation.lat),
      lon: toNumberOrNull(initialLocation.lon),
      arrived: false,
    };

    try {
      const socket = connectSocket();
      socketRef.current = socket;

      socket.removeAllListeners();
      attachSocketHandlers(socket);
      socket.emit("register_user", user);
    } catch {
      Alert.alert("Offline mode", "Could not reach server. Joined local session mode.");
    }

    setMe(user);
    setScreen("main");
  }

  function requestSafeZone() {
    const socket = socketRef.current;
    if (!socket || !me) return;
    setScreen("safezone");
    socket.emit("request_nearest_safe_zone", { lat: me.lat, lon: me.lon });
  }

  function simulateArrival() {
    if (!safeZone || !me) return;
    socketRef.current?.emit("simulate_arrival", {
      user_id: me.user_id,
      safe_zone_id: safeZone.id,
    });
  }

  function sendChat(toUserId, text) {
    if (!me) return;
    socketRef.current?.emit("send_chat", {
      from_user_id: me.user_id,
      to_user_id: toUserId,
      text,
    });
  }

  function dropBeacon(point) {
    if (!meInUsers || !point) return;
    socketRef.current?.emit("drop_beacon", {
      rescuer_id: meInUsers.user_id,
      lat: point.lat,
      lon: point.lon,
      note: "Supplies dropped",
    });
  }

  function pingFlashlight(targetUserId) {
    if (!me) return;
    socketRef.current?.emit("flashlight_ping", {
      rescuer_id: me.user_id,
      target_user_id: targetUserId,
      duration_s: 3,
    });
  }

  function broadcastEvacuation(point, message) {
    if (!meInUsers || !point) return;
    socketRef.current?.emit("broadcast_evacuation", {
      rescuer_id: meInUsers.user_id,
      lat: Number(point.lat.toFixed(6)),
      lon: Number(point.lon.toFixed(6)),
      message: message || "Proceed calmly to the marked evacuation point.",
    });
  }

  let content = null;
  if (screen === "login") {
    content = <LoginScreen onSubmit={handleJoin} />;
  } else if (screen === "alert") {
    content = <DisasterAlertScreen alert={disasterAlert} onContinue={requestSafeZone} />;
  } else if (screen === "safezone") {
    content = <SafeZoneScreen zone={safeZone} currentLocation={meInUsers || me} onArrive={simulateArrival} />;
  } else if (screen === "guides") {
    content = <OfflineGuidesScreen onBack={() => setScreen("main")} />;
  } else {
    content = (
      <MainScreen
        me={meInUsers || me}
        users={users}
        chatLinks={chatLinks}
        beacons={beacons}
        evacuation={evacuation}
        onSendChat={sendChat}
        onDropBeacon={dropBeacon}
        onFlashlightPing={pingFlashlight}
        onBroadcastEvacuation={broadcastEvacuation}
        onOpenOfflineGuides={() => setScreen("guides")}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      {content}
      {Date.now() < flashUntilTs ? (
        <View pointerEvents="none" style={styles.flashOverlay}>
          <Text style={styles.flashText}>FLASHLIGHT PING ACTIVE</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  flashText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#b91c1c",
  },
});
