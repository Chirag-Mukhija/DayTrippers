import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, StatusBar, StyleSheet, Text, Vibration, View } from "react-native";
import * as Location from "expo-location";
import { Camera, CameraView } from "expo-camera";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const socketRef = useRef(null);
  const locationSubscriptionRef = useRef(null);
  const flashTimeoutRef = useRef(null);
  const flashStrobeIntervalRef = useRef(null);
  const beepIntervalRef = useRef(null);
  const sirenSoundRef = useRef(null);
  const pushTokenRef = useRef(null);
  const meRef = useRef(null);
  const [screen, setScreen] = useState("login");
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [chatLinks, setChatLinks] = useState([]);
  const [beacons, setBeacons] = useState([]);
  const [evacuation, setEvacuation] = useState(null);
  const [activeFlashTargets, setActiveFlashTargets] = useState([]);
  const [disasterAlert, setDisasterAlert] = useState(null);
  const [safeZone, setSafeZone] = useState(null);
  const [isFlashSignalActive, setIsFlashSignalActive] = useState(false);
  const [isFlashStrobeOn, setIsFlashStrobeOn] = useState(false);
  const [useScreenFlashFallback, setUseScreenFlashFallback] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [isInteractionLocked, setIsInteractionLocked] = useState(false);

  useEffect(() => {
    async function setupNotifications() {
      try {
        const existing = await Notifications.getPermissionsAsync();
        if (existing.status !== "granted") {
          await Notifications.requestPermissionsAsync();
        }

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("disaster-alerts", {
            name: "Disaster Alerts",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            sound: "default",
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }

        let pushToken = null;
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;

        try {
          const tokenResponse = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
          );
          pushToken = tokenResponse?.data || null;
        } catch {
          pushToken = null;
        }

        if (pushToken) {
          pushTokenRef.current = pushToken;
          if (meRef.current?.user_id && socketRef.current) {
            socketRef.current.emit("update_push_token", {
              user_id: meRef.current.user_id,
              expo_push_token: pushToken,
            });
          }
        }
      } catch {
        // Notification setup failures should not block app usage.
      }
    }

    setupNotifications();
  }, []);

  useEffect(() => {
    let id;
    if (useScreenFlashFallback && isFlashSignalActive) {
      id = setInterval(() => setIsFlashStrobeOn((prev) => !prev), 120);
    } else {
      setIsFlashStrobeOn(false);
    }
    return () => clearInterval(id);
  }, [isFlashSignalActive, useScreenFlashFallback]);

  async function ensureCameraPermission() {
    try {
      const permission = await Camera.requestCameraPermissionsAsync();
      const granted = permission?.status === "granted";
      setCameraPermissionGranted(granted);
      return granted;
    } catch {
      setCameraPermissionGranted(false);
      return false;
    }
  }

  async function startSirenTone() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      if (!sirenSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          require("./assets/audio/siren.wav"),
          {
            shouldPlay: true,
            isLooping: true,
            volume: 1.0,
          }
        );
        sirenSoundRef.current = sound;
      } else {
        await sirenSoundRef.current.setIsLoopingAsync(true);
        await sirenSoundRef.current.setVolumeAsync(1.0);
        await sirenSoundRef.current.playAsync();
      }
    } catch {
      // Keep flash mode active even if siren playback fails.
    }
  }

  async function stopSirenTone() {
    if (!sirenSoundRef.current) return;
    try {
      await sirenSoundRef.current.stopAsync();
    } catch {
      // ignore
    }
  }

  function stopFlashSignals() {
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    if (flashStrobeIntervalRef.current) {
      clearInterval(flashStrobeIntervalRef.current);
      flashStrobeIntervalRef.current = null;
    }
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
    stopSirenTone();
    setIsFlashSignalActive(false);
    setIsInteractionLocked(false);
    setIsTorchOn(false);
    setIsFlashStrobeOn(false);
  }

  async function startFlashSignal() {
    stopFlashSignals();
    const canUseTorch = await ensureCameraPermission();
    setIsFlashSignalActive(true);
    setIsInteractionLocked(true);

    if (canUseTorch) {
      setUseScreenFlashFallback(false);
      let torchOn = true;
      setIsTorchOn(true);
      flashStrobeIntervalRef.current = setInterval(() => {
        torchOn = !torchOn;
        setIsTorchOn(torchOn);
      }, 140);
    } else {
      setUseScreenFlashFallback(true);
    }

    startSirenTone();

    beepIntervalRef.current = setInterval(() => {
      Vibration.vibrate(250);
    }, 750);
  }

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
      stopFlashSignals();
      if (sirenSoundRef.current) {
        sirenSoundRef.current.unloadAsync();
        sirenSoundRef.current = null;
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
      setActiveFlashTargets(payload.active_flash_targets || []);
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

    socket.on("disaster_alert", async (payload) => {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Disaster Alert",
            body: `${payload?.type || "Emergency"} alert. ${payload?.countdown_s || 20}s countdown started.`,
            sound: "default",
            data: payload || {},
          },
          trigger: null,
        });
      } catch {
        // Keep in-app behavior even if notification scheduling fails.
      }

      if (meRef.current?.role === "rescuer") {
        return;
      }
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

    socket.on("flashlight_status", (payload) => {
      setActiveFlashTargets(payload.active_target_user_ids || []);
    });

    socket.on("flashlight_command", async (payload) => {
      const command = payload?.command || "start";
      if (command === "stop") {
        stopFlashSignals();
        Alert.alert("Flashlight Ping", "Rescuer has stopped the alert.");
        return;
      }

      await startFlashSignal();
      Alert.alert("Flashlight Ping", "Emergency alert active. Stay visible until rescuer stops it.");
    });

    socket.on("chat_message", (payload) => {
      const fromSelf = payload.from_user_id === meRef.current?.user_id;
      if (!fromSelf) {
        const senderName = payload.from_user_name || payload.from_user_id?.slice(0, 6) || "Unknown";
        Alert.alert("New Message", `${senderName}: ${payload.text}`);
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
      expo_push_token: pushTokenRef.current,
    };

    // Set user refs early to avoid role-based event races right after socket connection.
    meRef.current = user;
    setMe(user);

    try {
      const socket = connectSocket();
      socketRef.current = socket;

      socket.removeAllListeners();
      attachSocketHandlers(socket);
      socket.emit("register_user", user);
    } catch {
      Alert.alert("Offline mode", "Could not reach server. Joined local session mode.");
    }
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
    if (!me || !targetUserId || targetUserId === me.user_id) return;
    socketRef.current?.emit("flashlight_ping", {
      rescuer_id: me.user_id,
      target_user_id: targetUserId,
    });
  }

  function stopFlashlight(targetUserId) {
    if (!me || !targetUserId || targetUserId === me.user_id) return;
    socketRef.current?.emit("flashlight_ping_stop", {
      rescuer_id: me.user_id,
      target_user_id: targetUserId,
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
        activeFlashTargets={activeFlashTargets}
        onSendChat={sendChat}
        onDropBeacon={dropBeacon}
        onFlashlightPing={pingFlashlight}
        onStopFlashlight={stopFlashlight}
        onBroadcastEvacuation={broadcastEvacuation}
        onOpenOfflineGuides={() => setScreen("guides")}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      {content}
      {isFlashSignalActive && cameraPermissionGranted ? (
        <CameraView
          style={styles.hiddenTorchCamera}
          facing="back"
          active
          enableTorch={isTorchOn}
        />
      ) : null}
      {isFlashStrobeOn && (
        <View pointerEvents="none" style={styles.flashOverlay}>
          <Text style={styles.flashText}>TORCH UNAVAILABLE - SCREEN FLASH MODE</Text>
        </View>
      )}
      {isInteractionLocked ? (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockTitle}>Emergency Flash Alert</Text>
          <Text style={styles.lockText}>Do not use the app. Stay visible for the rescuer.</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hiddenTorchCamera: {
    position: "absolute",
    width: 1,
    height: 1,
    top: -100,
    left: -100,
    opacity: 0,
  },
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
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  lockTitle: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  lockText: {
    color: "#f3f4f6",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});
