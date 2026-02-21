import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import * as Crypto from "expo-crypto";
import { api } from "@/lib/api/api";
import useReachStore from "@/lib/state/reach-store";
import { Check } from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.55, 240);

interface Person {
  id: string;
  name: string;
  phone: string;
  deviceId: string;
}

export default function ReachScreen() {
  const person = useReachStore((s) => s.person);
  const deviceId = useReachStore((s) => s.deviceId);
  const hasRegistered = useReachStore((s) => s.hasRegistered);
  const setPerson = useReachStore((s) => s.setPerson);
  const setDeviceId = useReachStore((s) => s.setDeviceId);

  const [showModal, setShowModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Animations
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);
  const buttonPressed = useSharedValue(0);
  const modalSlide = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const confirmTextOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const outerPulseScale = useSharedValue(1);
  const outerPulseOpacity = useSharedValue(0);

  // Generate device ID on mount
  useEffect(() => {
    async function init() {
      if (!deviceId) {
        const id = Crypto.randomUUID();
        setDeviceId(id);
      }
      await SplashScreen.hideAsync();
    }
    init();
  }, [deviceId, setDeviceId]);

  // Heartbeat pulse animation
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 150, easing: Easing.in(Easing.ease) }),
        withTiming(1.03, { duration: 180, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 600, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 200 }),
        withTiming(0.3, { duration: 150 }),
        withTiming(0.6, { duration: 180 }),
        withTiming(0.3, { duration: 600 })
      ),
      -1,
      false
    );

    // Outer ring pulse
    outerPulseScale.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 0 }),
        withTiming(1.5, { duration: 1600, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 0 })
      ),
      -1,
      false
    );
    outerPulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 0 }),
        withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
  }, [pulseScale, pulseOpacity, outerPulseScale, outerPulseOpacity]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulseScale.value * (1 - buttonPressed.value * 0.06) },
      { translateY: buttonPressed.value * 4 },
    ],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseOpacity.value, [0.3, 0.7], [0.15, 0.5]),
  }));

  const outerPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerPulseScale.value }],
    opacity: outerPulseOpacity.value,
  }));

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(modalSlide.value, [0, 1], [600, 0]),
      },
    ],
    opacity: modalSlide.value,
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const confirmTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: confirmTextOpacity.value,
  }));

  const handleButtonPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    buttonPressed.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 200 })
    );

    if (!hasRegistered) {
      // First press - show registration
      setTimeout(() => {
        setShowModal(true);
        modalSlide.value = withSpring(1, { damping: 20, stiffness: 200 });
      }, 300);
    } else if (person) {
      // Already registered - show reaching animation
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 800 })
      );
      Alert.alert(
        "Reaching Out",
        `Connecting you to ${person.name}...`,
        [{ text: "OK" }]
      );
    }
  }, [hasRegistered, person, buttonPressed, modalSlide, glowOpacity]);

  const handleSavePerson = useCallback(async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Missing Info", "Please enter both name and phone number.");
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const currentDeviceId = useReachStore.getState().deviceId;
      const savedPerson = await api.post<Person>("/api/person", {
        name: name.trim(),
        phone: phone.trim(),
        deviceId: currentDeviceId,
      });

      if (savedPerson) {
        setPerson(savedPerson);
      }

      // Close modal
      modalSlide.value = withTiming(0, { duration: 300 });
      setTimeout(() => {
        setShowModal(false);
        setShowConfirmation(true);

        // Animate checkmark
        checkScale.value = withSequence(
          withTiming(0, { duration: 0 }),
          withSpring(1.2, { damping: 8, stiffness: 200 }),
          withSpring(1, { damping: 12 })
        );
        checkOpacity.value = withTiming(1, { duration: 300 });
        confirmTextOpacity.value = withDelay(
          400,
          withTiming(1, { duration: 500 })
        );

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
          confirmTextOpacity.value = withTiming(0, { duration: 300 });
          checkOpacity.value = withTiming(0, { duration: 300 });
          setTimeout(() => setShowConfirmation(false), 400);
        }, 4000);
      }, 350);
    } catch (err) {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [name, phone, setPerson, modalSlide, checkScale, checkOpacity, confirmTextOpacity]);

  const handleCloseModal = useCallback(() => {
    modalSlide.value = withTiming(0, { duration: 300 });
    setTimeout(() => setShowModal(false), 300);
  }, [modalSlide]);

  return (
    <View className="flex-1" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Main content - centered button */}
      <View className="flex-1 items-center justify-center">
        {/* Outer pulse ring */}
        <Animated.View
          style={[
            outerPulseStyle,
            {
              position: "absolute",
              width: BUTTON_SIZE + 60,
              height: BUTTON_SIZE + 60,
              borderRadius: (BUTTON_SIZE + 60) / 2,
              borderWidth: 2,
              borderColor: "#cc0000",
            },
          ]}
        />

        {/* Ambient glow behind button */}
        <Animated.View
          style={[
            glowAnimatedStyle,
            {
              position: "absolute",
              width: BUTTON_SIZE + 100,
              height: BUTTON_SIZE + 100,
              borderRadius: (BUTTON_SIZE + 100) / 2,
            },
          ]}
        >
          <LinearGradient
            colors={["transparent", "rgba(204,0,0,0.15)", "transparent"]}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: (BUTTON_SIZE + 100) / 2,
            }}
          />
        </Animated.View>

        {/* The 3D Button */}
        <Pressable onPress={handleButtonPress}>
          <Animated.View
            style={[
              buttonAnimatedStyle,
              {
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                borderRadius: BUTTON_SIZE / 2,
              },
            ]}
          >
            {/* Button shadow layer */}
            <View
              style={{
                position: "absolute",
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                borderRadius: BUTTON_SIZE / 2,
                backgroundColor: "#440000",
                top: 6,
                shadowColor: "#cc0000",
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.5,
                shadowRadius: 30,
                elevation: 20,
              }}
            />

            {/* Button base - dark red */}
            <View
              style={{
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                borderRadius: BUTTON_SIZE / 2,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={["#ee1111", "#cc0000", "#990000", "#660000"]}
                locations={[0, 0.3, 0.7, 1]}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: BUTTON_SIZE / 2,
                }}
              />

              {/* Glossy highlight */}
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  left: BUTTON_SIZE * 0.15,
                  width: BUTTON_SIZE * 0.7,
                  height: BUTTON_SIZE * 0.4,
                  borderRadius: BUTTON_SIZE * 0.35,
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0.35)",
                    "rgba(255,255,255,0.08)",
                    "transparent",
                  ]}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>

              {/* Inner edge ring */}
              <View
                style={{
                  position: "absolute",
                  top: 3,
                  left: 3,
                  right: 3,
                  bottom: 3,
                  borderRadius: BUTTON_SIZE / 2,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              />
            </View>
          </Animated.View>
        </Pressable>

        {/* REACH text below button */}
        <Text
          style={{
            marginTop: 40,
            fontSize: 42,
            fontWeight: "900",
            letterSpacing: 12,
            color: "#1a1a1a",
          }}
        >
          REACH
        </Text>
      </View>

      {/* Registration Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="none"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <Pressable
            className="flex-1"
            onPress={handleCloseModal}
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          />

          <Animated.View
            style={[
              modalAnimatedStyle,
              {
                backgroundColor: "#111111",
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: 28,
                paddingTop: 32,
                paddingBottom: Platform.OS === "ios" ? 50 : 32,
              },
            ]}
          >
            {/* Drag handle */}
            <View className="items-center mb-6">
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "#333",
                }}
              />
            </View>

            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#ffffff",
                marginBottom: 8,
              }}
            >
              Who's your person?
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: "#666666",
                marginBottom: 32,
                lineHeight: 22,
              }}
            >
              The one who picks up.
            </Text>

            {/* Name input */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: "#555",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Their name"
                placeholderTextColor="#444"
                autoCapitalize="words"
                style={{
                  backgroundColor: "#1a1a1a",
                  borderRadius: 14,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  fontSize: 17,
                  color: "#fff",
                  borderWidth: 1,
                  borderColor: "#222",
                }}
              />
            </View>

            {/* Phone input */}
            <View style={{ marginBottom: 32 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: "#555",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Phone Number
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 000-0000"
                placeholderTextColor="#444"
                keyboardType="phone-pad"
                style={{
                  backgroundColor: "#1a1a1a",
                  borderRadius: 14,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  fontSize: 17,
                  color: "#fff",
                  borderWidth: 1,
                  borderColor: "#222",
                }}
              />
            </View>

            {/* Save button */}
            <Pressable
              onPress={handleSavePerson}
              disabled={saving}
              style={({ pressed }) => ({
                opacity: pressed ? 0.85 : saving ? 0.5 : 1,
              })}
            >
              <LinearGradient
                colors={["#ee1111", "#cc0000", "#aa0000"]}
                style={{
                  borderRadius: 16,
                  paddingVertical: 18,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "800",
                    color: "#fff",
                    letterSpacing: 0.5,
                  }}
                >
                  {saving ? "SAVING..." : "SAVE MY PERSON"}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirmation Overlay */}
      {showConfirmation ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#0a0a0a",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 36,
          }}
        >
          {/* Checkmark circle */}
          <Animated.View
            style={[
              checkAnimatedStyle,
              {
                width: 90,
                height: 90,
                borderRadius: 45,
                borderWidth: 3,
                borderColor: "#cc0000",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 36,
              },
            ]}
          >
            <Check size={44} color="#cc0000" strokeWidth={3} />
          </Animated.View>

          {/* Confirmation text */}
          <Animated.View style={confirmTextAnimatedStyle}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: "#ffffff",
                textAlign: "center",
                lineHeight: 32,
              }}
            >
              When you{" "}
              <Text style={{ color: "#cc0000", fontWeight: "900" }}>REACH</Text>
              ,{"\n"}
              {person?.name ? person.name : name} gets a call,{"\n"}text, and video request.
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: "#cc0000",
                textAlign: "center",
                marginTop: 16,
              }}
            >
              Instantly.
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}
