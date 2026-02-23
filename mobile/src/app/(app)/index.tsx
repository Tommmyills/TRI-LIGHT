import React, { useEffect, useState, useCallback } from "react";
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
  FlatList,
  ActivityIndicator,
  Linking,
} from "react-native";
import * as Contacts from "expo-contacts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import * as Crypto from "expo-crypto";
import { api } from "@/lib/api/api";
import useReachStore from "@/lib/state/reach-store";
import { Check, Settings } from "lucide-react-native";
import { authClient } from "@/lib/auth/auth-client";
import { useSession, useInvalidateSession } from "@/lib/auth/use-session";

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
  const setPerson = useReachStore((s) => s.setPerson);
  const setDeviceId = useReachStore((s) => s.setDeviceId);

  const { data: session } = useSession();
  const invalidateSession = useInvalidateSession();
  const insets = useSafeAreaInsets();

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSentConfirmation, setShowSentConfirmation] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [reaching, setReaching] = useState(false);

  // Contact picker states
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Animations
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);
  const buttonPressed = useSharedValue(0);
  const modalSlide = useSharedValue(0);
  const settingsModalSlide = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const confirmTextOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const outerPulseScale = useSharedValue(1);
  const outerPulseOpacity = useSharedValue(0);
  const sentOpacity = useSharedValue(0);

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

  // Load person for logged-in user (syncs server state into local store)
  useEffect(() => {
    async function loadPersonForUser() {
      if (session?.user) {
        try {
          const savedPerson = await api.get<Person | null>("/api/person/for-user");
          if (savedPerson) {
            setPerson(savedPerson);
          }
        } catch {
          // ignore
        }
      }
    }
    loadPersonForUser();
  }, [session?.user?.id]);

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
  }, []);

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
    transform: [{ translateY: interpolate(modalSlide.value, [0, 1], [600, 0]) }],
    opacity: modalSlide.value,
  }));

  const settingsModalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(settingsModalSlide.value, [0, 1], [600, 0]) }],
    opacity: settingsModalSlide.value,
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const confirmTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: confirmTextOpacity.value,
  }));

  const sentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sentOpacity.value,
    transform: [{ translateY: interpolate(sentOpacity.value, [0, 1], [10, 0]) }],
  }));

  // Settings modal
  const handleOpenSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSettingsModal(true);
    settingsModalSlide.value = withSpring(1, { damping: 22, stiffness: 200 });
  }, []);

  const handleCloseSettings = useCallback(() => {
    settingsModalSlide.value = withTiming(0, { duration: 250 });
    setTimeout(() => setShowSettingsModal(false), 260);
  }, []);

  const handleChangeMyPerson = useCallback(() => {
    handleCloseSettings();
    setTimeout(() => {
      setName(person?.name ?? "");
      setPhone(person?.phone ?? "");
      setShowModal(true);
      modalSlide.value = withSpring(1, { damping: 20, stiffness: 200 });
    }, 300);
  }, [person, handleCloseSettings]);

  const handleSignOut = useCallback(() => {
    handleCloseSettings();
    setTimeout(() => {
      Alert.alert("Sign Out", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await authClient.signOut();
            await invalidateSession();
            useReachStore.getState().reset();
          },
        },
      ]);
    }, 300);
  }, [invalidateSession, handleCloseSettings]);

  // REACH button press
  const handleButtonPress = useCallback(async () => {
    if (reaching) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    buttonPressed.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 200 })
    );

    if (!person) {
      // No person saved — open registration modal
      setTimeout(() => {
        setName("");
        setPhone("");
        setShowModal(true);
        modalSlide.value = withSpring(1, { damping: 20, stiffness: 200 });
      }, 300);
    } else {
      // Person saved — fire the reach
      setReaching(true);
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 1000 })
      );

      try {
        const result = await api.post<{ smsSent: boolean; videoRoomUrl: string; person: Person }>("/api/reach", {});
        if (result?.videoRoomUrl) {
          Linking.openURL(result.videoRoomUrl);
        }
        // Show sent confirmation with fade in
        setShowSentConfirmation(true);
        sentOpacity.value = withTiming(1, { duration: 300 });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Fade out after 3 seconds
        setTimeout(() => {
          sentOpacity.value = withTiming(0, { duration: 400 });
          setTimeout(() => setShowSentConfirmation(false), 420);
        }, 3000);
      } catch {
        Alert.alert("Error", "Could not reach. Please try again.");
      } finally {
        setReaching(false);
      }
    }
  }, [person, reaching, buttonPressed, modalSlide, glowOpacity, sentOpacity]);

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

      modalSlide.value = withTiming(0, { duration: 300 });
      setTimeout(() => {
        setShowModal(false);
        setShowConfirmation(true);

        checkScale.value = withSequence(
          withTiming(0, { duration: 0 }),
          withSpring(1.2, { damping: 8, stiffness: 200 }),
          withSpring(1, { damping: 12 })
        );
        checkOpacity.value = withTiming(1, { duration: 300 });
        confirmTextOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setTimeout(() => {
          confirmTextOpacity.value = withTiming(0, { duration: 300 });
          checkOpacity.value = withTiming(0, { duration: 300 });
          setTimeout(() => setShowConfirmation(false), 400);
        }, 4000);
      }, 350);
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [name, phone, setPerson, modalSlide, checkScale, checkOpacity, confirmTextOpacity]);

  const handleCloseModal = useCallback(() => {
    modalSlide.value = withTiming(0, { duration: 300 });
    setTimeout(() => setShowModal(false), 300);
  }, [modalSlide]);

  const handleChooseFromContacts = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Needed",
        "Please allow access to your contacts in Settings to use this feature."
      );
      return;
    }
    setLoadingContacts(true);
    setContactSearch("");
    setShowContactPicker(true);
    try {
      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      setContacts(result.data);
    } catch {
      Alert.alert("Error", "Could not load contacts. Please try again.");
      setShowContactPicker(false);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const handleSelectContact = useCallback((contact: Contacts.Contact) => {
    const contactName = contact.name ?? [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    const contactPhone = contact.phoneNumbers?.[0]?.number ?? "";
    setName(contactName);
    setPhone(contactPhone);
    setShowContactPicker(false);
    setContactSearch("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: "#0a0a0a" }}>

      {/* Settings icon — top right */}
      <View style={{ position: "absolute", top: insets.top + 12, right: 20, zIndex: 10 }}>
        <Pressable
          onPress={handleOpenSettings}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: "#cc0000",
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Settings size={15} color="#cc0000" />
        </Pressable>
      </View>

      {/* Main content */}
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

        {/* Ambient glow */}
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
        <Pressable onPress={handleButtonPress} disabled={reaching}>
          <Animated.View
            style={[
              buttonAnimatedStyle,
              {
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                borderRadius: BUTTON_SIZE / 2,
                opacity: reaching ? 0.75 : 1,
              },
            ]}
          >
            {/* Shadow layer */}
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

            {/* Button face */}
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

        {/* REACH text */}
        <Text
          style={{
            marginTop: 40,
            fontSize: 42,
            fontWeight: "900",
            letterSpacing: 12,
            color: "#1a1a1a",
          }}
        >
          R.E.A.C.H.
        </Text>
      </View>

      {/* Registration / Edit Person Modal */}
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
            <View className="items-center mb-6">
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#333" }} />
            </View>

            <Text style={{ fontSize: 28, fontWeight: "800", color: "#ffffff", marginBottom: 8 }}>
              {person ? "Change my person" : "Who's your person?"}
            </Text>
            <Text style={{ fontSize: 16, color: "#666666", marginBottom: 20, lineHeight: 22 }}>
              {person ? "Update the name or number." : "The one who picks up."}
            </Text>

            {/* Choose from Contacts */}
            <Pressable
              onPress={handleChooseFromContacts}
              testID="choose-from-contacts-button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? "#1e1e1e" : "#161616",
                borderRadius: 12,
                paddingVertical: 13,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: "#2a2a2a",
                gap: 8,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#cc0000", letterSpacing: 0.3 }}>
                Choose from Contacts
              </Text>
            </Pressable>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Their name"
                placeholderTextColor="#444"
                autoCapitalize="words"
                style={{ backgroundColor: "#1a1a1a", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, fontSize: 17, color: "#fff", borderWidth: 1, borderColor: "#222" }}
              />
            </View>

            <View style={{ marginBottom: 32 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Phone Number
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 000-0000"
                placeholderTextColor="#444"
                keyboardType="phone-pad"
                style={{ backgroundColor: "#1a1a1a", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, fontSize: 17, color: "#fff", borderWidth: 1, borderColor: "#222" }}
              />
            </View>

            <Pressable
              onPress={handleSavePerson}
              disabled={saving}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : saving ? 0.5 : 1 })}
            >
              <LinearGradient
                colors={["#ee1111", "#cc0000", "#aa0000"]}
                style={{ borderRadius: 16, paddingVertical: 18, alignItems: "center" }}
              >
                <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: 0.5 }}>
                  {saving ? "SAVING..." : "SAVE MY PERSON"}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="none"
        onRequestClose={handleCloseSettings}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)" }}
          onPress={handleCloseSettings}
        />
        <Animated.View
          style={[
            settingsModalAnimatedStyle,
            {
              backgroundColor: "#111111",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 24,
              paddingTop: 28,
              paddingBottom: Platform.OS === "ios" ? 48 : 28,
            },
          ]}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#282828" }} />
          </View>

          {/* Change My Person */}
          <Pressable
            onPress={handleChangeMyPerson}
            style={({ pressed }) => ({
              paddingVertical: 18,
              paddingHorizontal: 4,
              borderBottomWidth: 1,
              borderBottomColor: "#1a1a1a",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#ffffff" }}>
              Change My Person
            </Text>
            {person ? (
              <Text style={{ fontSize: 14, color: "#444", marginTop: 3 }}>
                Currently: {person.name}
              </Text>
            ) : null}
          </Pressable>

          {/* Sign Out */}
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              paddingVertical: 18,
              paddingHorizontal: 4,
              borderBottomWidth: 1,
              borderBottomColor: "#1a1a1a",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#cc0000" }}>
              Sign Out
            </Text>
          </Pressable>

          {/* Close */}
          <Pressable
            onPress={handleCloseSettings}
            style={({ pressed }) => ({
              paddingVertical: 18,
              paddingHorizontal: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#555" }}>
              Close
            </Text>
          </Pressable>
        </Animated.View>
      </Modal>

      {/* Person-saved Confirmation Overlay */}
      {showConfirmation ? (
        <View
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "#0a0a0a",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 36,
          }}
        >
          <Animated.View
            style={[
              checkAnimatedStyle,
              {
                width: 90, height: 90, borderRadius: 45,
                borderWidth: 3, borderColor: "#cc0000",
                alignItems: "center", justifyContent: "center",
                marginBottom: 36,
              },
            ]}
          >
            <Check size={44} color="#cc0000" strokeWidth={3} />
          </Animated.View>

          <Animated.View style={confirmTextAnimatedStyle}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#ffffff", textAlign: "center", lineHeight: 32 }}>
              When you{" "}
              <Text style={{ color: "#cc0000", fontWeight: "900" }}>REACH</Text>
              ,{"\n"}
              {person?.name ?? name} gets a text{"\n"}and video request.
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#cc0000", textAlign: "center", marginTop: 16 }}>
              Instantly.
            </Text>
          </Animated.View>
        </View>
      ) : null}

      {/* Sent Confirmation — fades in, auto-fades out after 3s */}
      {showSentConfirmation ? (
        <Animated.View
          style={[
            sentAnimatedStyle,
            {
              position: "absolute",
              bottom: 56,
              left: 24,
              right: 24,
              backgroundColor: "#111",
              borderRadius: 18,
              padding: 22,
              borderWidth: 1,
              borderColor: "#cc0000",
              alignItems: "center",
            },
          ]}
        >
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
            Reaching <Text style={{ color: "#cc0000" }}>{person?.name}</Text>
          </Text>
          <Text style={{ color: "#444", fontSize: 13, marginTop: 5 }}>
            SMS + video call sent
          </Text>
        </Animated.View>
      ) : null}

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowContactPicker(false);
          setContactSearch("");
        }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)" }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              setShowContactPicker(false);
              setContactSearch("");
            }}
          />
          <View
            style={{
              backgroundColor: "#111111",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 20,
              paddingBottom: Platform.OS === "ios" ? 50 : 28,
              maxHeight: "80%",
            }}
          >
            {/* Handle */}
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#333" }} />
            </View>

            <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", paddingHorizontal: 24, marginBottom: 16 }}>
              Choose a Contact
            </Text>

            {/* Search input */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <TextInput
                value={contactSearch}
                onChangeText={setContactSearch}
                placeholder="Search contacts..."
                placeholderTextColor="#444"
                autoFocus
                autoCapitalize="none"
                testID="contact-search-input"
                style={{
                  backgroundColor: "#1a1a1a",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 16,
                  color: "#fff",
                  borderWidth: 1,
                  borderColor: "#222",
                }}
              />
            </View>

            {loadingContacts ? (
              <View style={{ paddingVertical: 48, alignItems: "center" }}>
                <ActivityIndicator color="#cc0000" size="large" />
                <Text style={{ color: "#555", marginTop: 12, fontSize: 14 }}>Loading contacts...</Text>
              </View>
            ) : (
              <FlatList
                data={contacts.filter((c) => {
                  const query = contactSearch.toLowerCase();
                  if (!query) return true;
                  const fullName = (c.name ?? "").toLowerCase();
                  return fullName.includes(query);
                })}
                keyExtractor={(item) => item.id ?? item.name ?? Math.random().toString()}
                keyboardShouldPersistTaps="handled"
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ paddingHorizontal: 20 }}
                ItemSeparatorComponent={() => (
                  <View style={{ height: 1, backgroundColor: "#1a1a1a" }} />
                )}
                ListEmptyComponent={() => (
                  <View style={{ paddingVertical: 32, alignItems: "center" }}>
                    <Text style={{ color: "#444", fontSize: 15 }}>No contacts found</Text>
                  </View>
                )}
                renderItem={({ item }) => {
                  const phoneNum = item.phoneNumbers?.[0]?.number ?? null;
                  if (!phoneNum) return null;
                  return (
                    <Pressable
                      onPress={() => handleSelectContact(item)}
                      testID={`contact-item-${item.id}`}
                      style={({ pressed }) => ({
                        paddingVertical: 14,
                        paddingHorizontal: 4,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#ffffff" }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#555", marginTop: 2 }}>
                        {phoneNum}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
