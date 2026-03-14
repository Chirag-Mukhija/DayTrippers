import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, StatusBar, StyleSheet, Text, Vibration, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Camera, CameraView } from "expo-camera";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import { SafeAreaView } from "react-native-safe-area-context";
import LoginScreen from "./src/screens/LoginScreen";
import DisasterAlertScreen from "./src/screens/DisasterAlertScreen";
import SafeZoneScreen from "./src/screens/SafeZoneScreen";
import MainScreen from "./src/screens/MainScreen";
import OfflineGuidesScreen from "./src/screens/OfflineGuidesScreen";
import BroadcastsScreen from "./src/screens/BroadcastsScreen";
import { connectSocket, disconnectSocket } from "./src/services/socket";
import { LOCATION_PUSH_INTERVAL_MS, START_COORDS } from "./src/config";

const USER_SESSION_KEY = "@rescuemesh/last_user";

function randomId() {
  return `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeUserCoords(u) {
  if (!u) return u;
  return {
    ...u,
    lat: toNumberOrNull(u.lat),
    lon: toNumberOrNull(u.lon),
    last_updated: Date.now(),
    supplies: Array.isArray(u.supplies)
      ? u.supplies.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
      : [],
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
  const toastTimeoutRef = useRef(null);
  const meRef = useRef(null);
  const [screen, setScreen] = useState("login");
  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [toastText, setToastText] = useState("");
  const [broadcastAlert, setBroadcastAlert] = useState(null);
  const [broadcastHistory, setBroadcastHistory] = useState([]);
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

        // Expo Go no longer supports remote push tokens for Android (SDK 53+).
        // Local notifications still work; remote push requires a development build.
        const isExpoGoRuntime =
          isRunningInExpoGo ||
          Constants?.executionEnvironment === "storeClient" ||
          Constants?.appOwnership === "expo";
        if (isExpoGoRuntime && Platform.OS === "android") {
          return;
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
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (sirenSoundRef.current) {
        sirenSoundRef.current.unloadAsync();
        sirenSoundRef.current = null;
      }
    };
  }, []);

  function showToast(message) {
    if (!message) return;
    setToastText(message);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastText("");
    }, 3500);
  }

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
                last_updated: Date.now(),
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

    socket.on("beacon_removed", (payload) => {
      setBeacons((current) => current.filter((b) => b.beacon_id !== payload.beacon_id));
    });

    socket.on("evacuation_broadcast", (payload) => {
      if (!payload.lat && !payload.lon) {
        setEvacuation(null);
        Alert.alert("EVACUATION CANCELLED", "The previous evacuation order has been lifted.", [{ text: "COPY THAT" }]);
        return;
      }
      
      setEvacuation(payload);
      let alertMessage = payload.message || "Evacuate now";

      const currentMe = meRef.current;
      if (currentMe && currentMe.lat && currentMe.lon && payload.lat && payload.lon) {
        const R = 6371000; // Earth's radius in meters
        const dLat = ((payload.lat - currentMe.lat) * Math.PI) / 180;
        const dLon = ((payload.lon - currentMe.lon) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((currentMe.lat * Math.PI) / 180) *
            Math.cos((payload.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = Math.round(R * c);

        const distStr =
          distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance}m`;
        alertMessage += `\n\nDistance to point: ${distStr} away`;
      }

      Alert.alert("EVACUATION ALERT", alertMessage, [{ text: "COPY THAT" }]);
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
        if (payload.is_broadcast) {
          setBroadcastAlert(payload);
          setBroadcastHistory((prev) => [{ ...payload, timestamp: Date.now() }, ...prev]);
        } else {
          Alert.alert("New Message", `${senderName}: ${payload.text}`);
        }
      }
    });

    socket.on("supplies_update_broadcast", (payload) => {
      const name = payload?.user_name || "A survivor";
      const items = Array.isArray(payload?.added_supplies) ? payload.added_supplies : [];
      if (!items.length) return;
      showToast(`${name} has got: ${items.join(", ")}`);
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

  async function saveSessionUser(user) {
    try {
      await AsyncStorage.setItem(
        USER_SESSION_KEY,
        JSON.stringify({
          user_id: user.user_id,
          name: user.name,
          role: user.role,
        })
      );
    } catch {
      // Session persistence failure should not block login.
    }
  }

  function connectAndRegisterUser(user) {
    const socket = connectSocket();
    socketRef.current = socket;
    socket.removeAllListeners();
    attachSocketHandlers(socket);
    socket.emit("register_user", user);
  }

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const raw = await AsyncStorage.getItem(USER_SESSION_KEY);
        if (!raw) {
          if (active) {
            setScreen("login");
            setIsSessionChecked(true);
          }
          return;
        }

        const parsed = JSON.parse(raw);
        if (!parsed?.user_id || !parsed?.name || !parsed?.role) {
          await AsyncStorage.removeItem(USER_SESSION_KEY);
          if (active) {
            setScreen("login");
            setIsSessionChecked(true);
          }
          return;
        }

        let initialLocation = {
          lat: START_COORDS.lat,
          lon: START_COORDS.lon,
        };
        try {
          initialLocation = await initLiveLocation();
        } catch {
          // Keep fallback if live location is unavailable.
        }

        const user = {
          user_id: parsed.user_id,
          name: parsed.name,
          role: parsed.role,
          lat: toNumberOrNull(initialLocation.lat),
          lon: toNumberOrNull(initialLocation.lon),
          arrived: false,
          expo_push_token: pushTokenRef.current,
        };

        if (!active) return;

        meRef.current = user;
        setMe(user);

        try {
          connectAndRegisterUser(user);
        } catch {
          Alert.alert("Offline mode", "Could not reach server. Restored local session mode.");
        }
        setScreen("main");
      } catch {
        if (active) {
          setScreen("login");
        }
      } finally {
        if (active) {
          setIsSessionChecked(true);
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

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
    saveSessionUser(user);

    try {
      connectAndRegisterUser(user);
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

  function dropBeacon(point, type, quantity, note) {
    if (!meInUsers || !point) return;
    socketRef.current?.emit("drop_beacon", {
      rescuer_id: meInUsers.user_id,
      lat: Number(point.lat.toFixed(6)),
      lon: Number(point.lon.toFixed(6)),
      supply_type: type,
      quantity,
      note,
    });
  }

  function removeBeacon(beaconId) {
    if (!meInUsers) return;
    socketRef.current?.emit("remove_beacon", { beacon_id: beaconId });
  }

  function updateMySupplies(supplies) {
    if (!meInUsers) return;
    socketRef.current?.emit("update_supplies", {
      user_id: meInUsers.user_id,
      supplies,
    });
  }

  function pingFlashlight(targetUserId) {
    if (!me || !targetUserId || targetUserId === me.user_id) return;
    const targetUser = users.find((u) => u.user_id === targetUserId);
    if (me.role !== "rescuer" || targetUser?.role !== "survivor") {
      return;
    }
    socketRef.current?.emit("flashlight_ping", {
      rescuer_id: me.user_id,
      target_user_id: targetUserId,
    });
  }

  function stopFlashlight(targetUserId) {
    if (!me || !targetUserId || targetUserId === me.user_id) return;
    const targetUser = users.find((u) => u.user_id === targetUserId);
    if (me.role !== "rescuer" || targetUser?.role !== "survivor") {
      return;
    }
    socketRef.current?.emit("flashlight_ping_stop", {
      rescuer_id: me.user_id,
      target_user_id: targetUserId,
    });
  }

  function broadcastEvacuation(point, message) {
    if (!meInUsers) return;
    socketRef.current?.emit("broadcast_evacuation", {
      rescuer_id: meInUsers.user_id,
      lat: point ? Number(point.lat.toFixed(6)) : null,
      lon: point ? Number(point.lon.toFixed(6)) : null,
      message: message || "Proceed calmly to the marked evacuation point.",
    });
  }

  function broadcastMessage(text) {
    if (!me || !text) return;
    
    // Add to own history
    const sentPayload = {
      from_user_id: me.user_id,
      from_user_name: me.name,
      text,
      is_broadcast: true,
      timestamp: Date.now(),
    };
    setBroadcastHistory((prev) => [sentPayload, ...prev]);

    const otherUsers = users.filter((u) => u.user_id !== me.user_id);
    otherUsers.forEach((u) => {
      socketRef.current?.emit("send_chat", {
        from_user_id: me.user_id,
        to_user_id: u.user_id,
        text,
        is_broadcast: true,
      });
    });
  }

  async function handleLogout() {
    try {
      await AsyncStorage.removeItem(USER_SESSION_KEY);
    } catch {}
    disconnectSocket();
    socketRef.current = null;
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    stopFlashSignals();
    setMe(null);
    meRef.current = null;
    setUsers([]);
    setChatLinks([]);
    setBeacons([]);
    setEvacuation(null);
    setActiveFlashTargets([]);
    setDisasterAlert(null);
    setSafeZone(null);
    setScreen("login");
  }

  let content = null;
  if (!isSessionChecked) {
    content = (
      <View style={styles.bootSplash}>
        <Text style={styles.bootTitle}>RescueMesh</Text>
        <Text style={styles.bootSubtitle}>Restoring session...</Text>
      </View>
    );
  } else if (screen === "login") {
    content = <LoginScreen onSubmit={handleJoin} />;
  } else if (screen === "alert") {
    content = <DisasterAlertScreen alert={disasterAlert} onContinue={requestSafeZone} />;
  } else if (screen === "safezone") {
    content = <SafeZoneScreen zone={safeZone} currentLocation={meInUsers || me} onArrive={simulateArrival} />;
  } else if (screen === "guides") {
    content = <OfflineGuidesScreen onBack={() => setScreen("main")} />;
  } else if (screen === "broadcasts") {
    content = (
      <BroadcastsScreen
        broadcasts={broadcastHistory}
        onBack={() => setScreen("main")}
      />
    );
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
        onRemoveBeacon={removeBeacon}
        onUpdateMySupplies={updateMySupplies}
        onFlashlightPing={pingFlashlight}
        onStopFlashlight={stopFlashlight}
        onBroadcastEvacuation={broadcastEvacuation}
        onBroadcastMessage={broadcastMessage}
        onLogout={handleLogout}
        onOpenOfflineGuides={() => setScreen("guides")}
        onOpenBroadcasts={() => setScreen("broadcasts")}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A0F" }}>
      <StatusBar barStyle="light-content" />
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

      <Modal visible={!!broadcastAlert} transparent animationType="fade">
        <View style={styles.broadcastOverlay}>
          <View style={styles.broadcastCard}>
            <Text style={styles.broadcastTitle}>📢 RESCUER BROADCAST</Text>
            <Text style={styles.broadcastSender}>
              FROM: {broadcastAlert?.from_user_name || broadcastAlert?.from_user_id?.slice(0, 6)}
            </Text>
            <View style={styles.broadcastDivider} />
            <Text style={styles.broadcastMessage}>{broadcastAlert?.text}</Text>
            <Pressable
              style={styles.broadcastBtn}
              onPress={() => setBroadcastAlert(null)}
            >
              <Text style={styles.broadcastBtnText}>ACKNOWLEDGE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {toastText ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={styles.toastCard}>
            <Text style={styles.toastText}>{toastText}</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bootSplash: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A0A0F",
  },
  bootTitle: {
    color: "#FF4B4B",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 3,
  },
  bootSubtitle: {
    marginTop: 10,
    color: "#8B8B9E",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: "Courier",
  },
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
    backgroundColor: "rgba(255, 75, 75, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  flashText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 15, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  lockTitle: {
    color: "#FF4B4B",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 1,
  },
  lockText: {
    color: "#F0F0F5",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 24,
  },
  toastWrap: {
    position: "absolute",
    top: 58,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  broadcastOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,15,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  broadcastCard: {
    backgroundColor: "#1A1A24",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFB020",
    padding: 24,
    width: "100%",
    shadowColor: "#FFB020",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  broadcastTitle: {
    color: "#FFB020",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 4,
  },
  broadcastSender: {
    color: "#8B8B9E",
    fontSize: 12,
    fontFamily: "Courier",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 16,
  },
  broadcastDivider: {
    height: 1,
    backgroundColor: "rgba(255,176,32,0.2)",
    marginBottom: 16,
  },
  broadcastMessage: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    marginBottom: 24,
  },
  broadcastBtn: {
    backgroundColor: "rgba(255,176,32,0.15)",
    borderWidth: 1,
    borderColor: "#FFB020",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  broadcastBtnText: {
    color: "#FFB020",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  toastCard: {
    maxWidth: "92%",
    backgroundColor: "rgba(18, 18, 26, 0.96)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#2A2A3A",
  },
  toastText: {
    color: "#F0F0F5",
    fontWeight: "700",
    fontSize: 13,
    fontFamily: "Courier",
  },
});
