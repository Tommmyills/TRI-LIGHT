import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Phone, PhoneOff } from "lucide-react-native";
import { WebView } from "react-native-webview";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AVATAR_SIZE = Math.min(SCREEN_WIDTH * 0.38, 160);

type CallStatus = "incoming" | "active" | "ended";

export default function CallScreen() {
  const { sessionId, callerName, roomUrl, isCaller } = useLocalSearchParams<{
    sessionId: string;
    callerName: string;
    roomUrl: string;
    isCaller?: string;
  }>();
  const insets = useSafeAreaInsets();

  const [callStatus, setCallStatus] = useState<CallStatus>(
    isCaller === "true" ? "active" : "incoming"
  );
  const [loading, setLoading] = useState(false);

  // Pulse rings for incoming call
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.6);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.4);
  const ring3Scale = useSharedValue(1);
  const ring3Opacity = useSharedValue(0.2);

  // Screen entrance animation
  const screenOpacity = useSharedValue(0);
  const screenScale = useSharedValue(0.95);

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) });
    screenScale.value = withSpring(1, { damping: 20, stiffness: 200 });
  }, []);

  useEffect(() => {
    if (callStatus !== "incoming") return;

    ring1Scale.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 0 }),
        withTiming(1.7, { duration: 1800, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 0 })
      ),
      -1,
      false
    );
    ring1Opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 0 }),
        withTiming(0, { duration: 1800, easing: Easing.out(Easing.ease) }),
        withTiming(0.6, { duration: 0 })
      ),
      -1,
      false
    );

    ring2Scale.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 600 }),
        withTiming(1.7, { duration: 1800, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 0 })
      ),
      -1,
      false
    );
    ring2Opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 600 }),
        withTiming(0, { duration: 1800, easing: Easing.out(Easing.ease) }),
        withTiming(0.4, { duration: 0 })
      ),
      -1,
      false
    );

    ring3Scale.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 1200 }),
        withTiming(1.7, { duration: 1800, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 0 })
      ),
      -1,
      false
    );
    ring3Opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 1200 }),
        withTiming(0, { duration: 1800, easing: Easing.out(Easing.ease) }),
        withTiming(0.2, { duration: 0 })
      ),
      -1,
      false
    );
  }, [callStatus]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));
  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring3Scale.value }],
    opacity: ring3Opacity.value,
  }));
  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ scale: screenScale.value }],
  }));

  const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

  async function updateSessionStatus(status: "accepted" | "declined" | "ended") {
    try {
      await fetch(`${baseUrl}/api/reach/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      // silent — don't block navigation on network failure
    }
  }

  async function handleAccept() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    await updateSessionStatus("accepted");
    setLoading(false);
    setCallStatus("active");
  }

  async function handleDecline() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateSessionStatus("declined");
    router.back();
  }

  async function handleEndCall() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await updateSessionStatus("ended");
    router.back();
  }

  if (callStatus === "active") {
    return (
      <View style={styles.fullScreen} testID="video-call-screen">
        <WebView
          source={{ uri: roomUrl }}
          style={StyleSheet.absoluteFill}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          testID="video-webview"
        />

        {/* Floating End Call button */}
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + 32,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={handleEndCall}
            testID="end-call-button"
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
              shadowColor: "#cc0000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 12,
            })}
          >
            <LinearGradient
              colors={["#ee1111", "#cc0000", "#990000"]}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 28,
                paddingVertical: 16,
                borderRadius: 50,
              }}
            >
              <PhoneOff size={20} color="#ffffff" strokeWidth={2.5} />
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 16,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                }}
              >
                End Call
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  // Incoming call UI
  return (
    <Animated.View style={[styles.fullScreen, screenStyle]} testID="incoming-call-screen">
      <LinearGradient
        colors={["#0a0a0a", "#0f0a0a", "#0a0a0a"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Pulse rings */}
      <View style={styles.avatarContainer}>
        <Animated.View
          style={[styles.ring, { width: AVATAR_SIZE + 80, height: AVATAR_SIZE + 80, borderRadius: (AVATAR_SIZE + 80) / 2 }, ring3Style]}
        />
        <Animated.View
          style={[styles.ring, { width: AVATAR_SIZE + 48, height: AVATAR_SIZE + 48, borderRadius: (AVATAR_SIZE + 48) / 2 }, ring2Style]}
        />
        <Animated.View
          style={[styles.ring, { width: AVATAR_SIZE + 20, height: AVATAR_SIZE + 20, borderRadius: (AVATAR_SIZE + 20) / 2 }, ring1Style]}
        />

        {/* Avatar circle */}
        <View
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "rgba(204,0,0,0.4)",
          }}
        >
          <LinearGradient
            colors={["#1a0a0a", "#2a0a0a", "#1a0505"]}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text
              style={{
                fontSize: AVATAR_SIZE * 0.42,
                fontWeight: "800",
                color: "#cc0000",
              }}
            >
              {(callerName ?? "?").charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        </View>
      </View>

      {/* Caller info */}
      <Animated.View
        entering={FadeIn.delay(200).duration(500)}
        style={{ alignItems: "center", marginTop: 36 }}
      >
        <Text
          style={{
            fontSize: 36,
            fontWeight: "900",
            color: "#ffffff",
            letterSpacing: 0.5,
            textAlign: "center",
            paddingHorizontal: 32,
          }}
          testID="caller-name"
        >
          {callerName ?? "Unknown"}
        </Text>
        <Text
          style={{
            fontSize: 17,
            fontWeight: "400",
            color: "#666666",
            marginTop: 8,
            letterSpacing: 0.3,
          }}
        >
          is reaching out...
        </Text>
      </Animated.View>

      {/* Action buttons */}
      <Animated.View
        entering={FadeIn.delay(400).duration(500)}
        style={{
          position: "absolute",
          bottom: insets.bottom + 60,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 64,
        }}
      >
        {/* Decline */}
        <View style={{ alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={handleDecline}
            testID="decline-button"
            style={({ pressed }) => ({
              width: 72,
              height: 72,
              borderRadius: 36,
              overflow: "hidden",
              opacity: pressed ? 0.75 : 1,
              shadowColor: "#cc0000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 14,
              elevation: 8,
            })}
          >
            <LinearGradient
              colors={["#2a0a0a", "#cc0000", "#990000"]}
              locations={[0, 0.5, 1]}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <PhoneOff size={28} color="#ffffff" strokeWidth={2.5} />
            </LinearGradient>
          </Pressable>
          <Text style={{ color: "#555555", fontSize: 13, fontWeight: "600" }}>Decline</Text>
        </View>

        {/* Accept */}
        <View style={{ alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={handleAccept}
            disabled={loading}
            testID="accept-button"
            style={({ pressed }) => ({
              width: 72,
              height: 72,
              borderRadius: 36,
              overflow: "hidden",
              opacity: pressed || loading ? 0.75 : 1,
              shadowColor: "#00cc44",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 14,
              elevation: 8,
            })}
          >
            <LinearGradient
              colors={["#0a2a14", "#00aa44", "#007a30"]}
              locations={[0, 0.5, 1]}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Phone size={28} color="#ffffff" strokeWidth={2.5} />
            </LinearGradient>
          </Pressable>
          <Text style={{ color: "#555555", fontSize: 13, fontWeight: "600" }}>Accept</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  avatarContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "#cc0000",
  },
});
