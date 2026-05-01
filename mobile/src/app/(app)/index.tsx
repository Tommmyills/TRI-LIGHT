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
  ScrollView,
} from "react-native";
import { router } from "expo-router";
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
import * as Crypto from "expo-crypto";
import { api } from "@/lib/api/api";
import useReachStore from "@/lib/state/reach-store";
import { Check, Settings, Plus } from "lucide-react-native";
import { authClient } from "@/lib/auth/auth-client";
import { useSession, useInvalidateSession } from "@/lib/auth/use-session";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.55, 240);

interface PersonWithConsent {
  id: string;
  name: string;
  phone: string;
  deviceId: string;
  slot: number;
  consentStatus?: 'confirmed' | 'pending' | 'declined' | 'none';
}

export default function ReachScreen() {
  const persons = useReachStore((s) => s.persons);
  const deviceIds = useReachStore((s) => s.deviceIds);
  const setPerson = useReachStore((s) => s.setPerson);
  const removePerson = useReachStore((s) => s.removePerson);
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
  const [consentStatus, setConsentStatus] = useState<'confirmed' | 'pending' | 'declined' | 'none' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3>(1);
  const [resendingSlot, setResendingSlot] = useState<number | null>(null);

  // Contact picker states
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<Contacts.ExistingContact[]>([]);
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

  // Generate device IDs on mount
  useEffect(() => {
    async function init() {
      const currentIds = useReachStore.getState().deviceIds;
      const updates: Array<{ id: string; slot: 1 | 2 | 3 }> = [];
      currentIds.forEach((id, i) => {
        if (!id) updates.push({ id: Crypto.randomUUID(), slot: (i + 1) as 1 | 2 | 3 });
      });
      updates.forEach(({ id, slot }) => setDeviceId(id, slot));
    }
    init();
  }, []);

  // Load persons for logged-in user (syncs server state into local store)
  useEffect(() => {
    async function loadPersonsForUser() {
      if (session?.user) {
        try {
          const savedPersons = await api.get<PersonWithConsent[]>("/api/person/for-user");
          if (savedPersons && savedPersons.length > 0) {
            savedPersons.forEach((p) => {
              setPerson(p, p.slot as 1 | 2 | 3);
            });
            // Update consent status for slot 1
            const slot1 = savedPersons.find(p => p.slot === 1);
            if (slot1) setConsentStatus(slot1.consentStatus ?? 'none');
          }
        } catch {
          // ignore
        }
      }
    }
    loadPersonsForUser();
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

  const handleOpenSlotModal = useCallback((slot: 1 | 2 | 3, prefillName?: string, prefillPhone?: string) => {
    setActiveSlot(slot);
    setName(prefillName ?? "");
    setPhone(prefillPhone ?? "");
    setShowModal(true);
    modalSlide.value = withSpring(1, { damping: 20, stiffness: 200 });
  }, [modalSlide]);

  const handleEditFromSettings = useCallback((slot: 1 | 2 | 3) => {
    const p = persons[slot - 1];
    handleCloseSettings();
    setTimeout(() => {
      handleOpenSlotModal(slot, p?.name ?? "", p?.phone ?? "");
    }, 300);
  }, [persons, handleCloseSettings, handleOpenSlotModal]);

  const handleRemoveFromSettings = useCallback((slot: 1 | 2 | 3) => {
    const p = persons[slot - 1];
    if (!p) return;
    Alert.alert(
      "Remove Contact",
      `Remove ${p.name} from slot ${slot}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/person/slot/${slot}`);
            } catch {
              // ignore — remove locally regardless
            }
            removePerson(slot);
            if (slot === 1) setConsentStatus(null);
          },
        },
      ]
    );
  }, [persons, removePerson]);

  const handleResend = useCallback(async (slot: 1 | 2 | 3) => {
    setResendingSlot(slot);
    try {
      await api.post(`/api/person/resend/${slot}`, {});
      const p = persons[slot - 1];
      setStatusMessage(`Invitation resent to ${p?.name ?? 'your contact'}.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      Alert.alert("Error", "Could not resend invitation. Please try again.");
    } finally {
      setResendingSlot(null);
    }
  }, [persons]);

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

    const hasAnyPerson = persons.some(p => p !== null);

    if (!hasAnyPerson) {
      // No contacts at all — open modal for slot 1
      setTimeout(() => {
        setActiveSlot(1);
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
        const result = await api.post<{ videoRoomUrl: string; sessionId: string }>("/api/reach", {});
        if (result?.videoRoomUrl) {
          router.push({
            pathname: "/(app)/call",
            params: {
              sessionId: result.sessionId ?? "",
              callerName: session?.user?.name ?? "Me",
              roomUrl: result.videoRoomUrl,
              isCaller: "true",
            },
          });
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
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'CONSENT_PENDING') {
          const primaryPerson = persons[0];
          setStatusMessage(
            primaryPerson
              ? `Invitation resent to ${primaryPerson.name}. Ask them to check their messages.`
              : 'Invitations resent. Ask your contacts to check their messages.'
          );
          setTimeout(() => setStatusMessage(null), 4000);
        } else {
          Alert.alert("Error", "Could not reach. Please try again.");
        }
      } finally {
        setReaching(false);
      }
    }
  }, [persons, reaching, buttonPressed, modalSlide, glowOpacity, sentOpacity]);

  const handleSavePerson = useCallback(async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Missing Info", "Please enter both name and email address.");
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const savedPerson = await api.post<PersonWithConsent>("/api/person", {
        name: name.trim(),
        phone: phone.trim(),
        deviceId: useReachStore.getState().deviceIds[activeSlot - 1],
        slot: activeSlot,
      });

      if (savedPerson) {
        setPerson(savedPerson, activeSlot);
        if (activeSlot === 1) setConsentStatus(savedPerson.consentStatus ?? 'pending');
      }

      const savedName = name.trim();
      modalSlide.value = withTiming(0, { duration: 300 });
      setTimeout(() => {
        setShowModal(false);
        setStatusMessage(`Invitation sent to ${savedName}!`);
        setTimeout(() => setStatusMessage(null), 3000);
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
  }, [name, phone, activeSlot, setPerson, modalSlide, checkScale, checkOpacity, confirmTextOpacity]);

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
        fields: [Contacts.Fields.Name, Contacts.Fields.Emails],
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
    const contactEmail = contact.emails?.[0]?.email ?? "";
    setName(contactName);
    setPhone(contactEmail);
    setShowContactPicker(false);
    setContactSearch("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Helper for consent status badge
  const renderConsentBadge = (status: string | undefined) => {
    if (status === 'confirmed') {
      return <Text style={{ fontSize: 11, color: "#00b450", fontWeight: "700" }}>Confirmed</Text>;
    }
    if (status === 'pending') {
      return <Text style={{ fontSize: 11, color: "#ffc800", fontWeight: "700" }}>Pending</Text>;
    }
    if (status === 'declined') {
      return <Text style={{ fontSize: 11, color: "#b45309", fontWeight: "700" }}>Declined</Text>;
    }
    return null;
  };

  const slotLabels: Record<1 | 2 | 3, string> = { 1: "Primary", 2: "Backup 2", 3: "Backup 3" };

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
            {/* === OUTER RED GLOW - wide soft halo === */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                borderRadius: BUTTON_SIZE / 2,
                backgroundColor: "rgba(200,0,0,0.01)",
                shadowColor: "#ff1111",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.55,
                shadowRadius: 52,
                elevation: 0,
              }}
            />
            {/* === OUTER RED GLOW - tight inner halo === */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                borderRadius: BUTTON_SIZE / 2,
                backgroundColor: "rgba(180,0,0,0.01)",
                shadowColor: "#cc0000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.9,
                shadowRadius: 18,
                elevation: 0,
              }}
            />

            {/* === BOTTOM DROP SHADOW (pressable depth illusion) === */}
            <View
              style={{
                position: "absolute",
                top: 13,
                left: 8,
                width: BUTTON_SIZE - 16,
                height: BUTTON_SIZE - 16,
                borderRadius: (BUTTON_SIZE - 16) / 2,
                backgroundColor: "#1a0000",
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 22 },
                shadowOpacity: 0.8,
                shadowRadius: 26,
                elevation: 20,
              }}
            />

            {/* === METALLIC OUTER RING - dark graphite/gunmetal === */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                borderRadius: BUTTON_SIZE / 2,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={["#4d4d4d", "#252525", "#0e0e0e", "#1c1c1c", "#3d3d3d"]}
                locations={[0, 0.2, 0.5, 0.75, 1]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={{ width: "100%", height: "100%" }}
              />
              {/* Soft metallic reflection - top-left */}
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0.16)",
                  "rgba(255,255,255,0.04)",
                  "transparent",
                ]}
                locations={[0, 0.35, 1]}
                start={{ x: 0.05, y: 0 }}
                end={{ x: 0.65, y: 0.65 }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              />
            </View>

            {/* === RING INNER BEVEL SHADOW === */}
            <View
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                width: BUTTON_SIZE - 24,
                height: BUTTON_SIZE - 24,
                borderRadius: (BUTTON_SIZE - 24) / 2,
                backgroundColor: "#080808",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.95,
                shadowRadius: 6,
                elevation: 8,
              }}
            />

            {/* === CONVEX BUTTON FACE === */}
            <View
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                width: BUTTON_SIZE - 28,
                height: BUTTON_SIZE - 28,
                borderRadius: (BUTTON_SIZE - 28) / 2,
                overflow: "hidden",
              }}
            >
              {/* Base gradient: bright red top → deep crimson bottom */}
              <LinearGradient
                colors={["#ff4444", "#ee1515", "#cc0000", "#880000", "#4d0000"]}
                locations={[0, 0.15, 0.45, 0.78, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              />

              {/* Side curvature darkening (left + right edge falloff) */}
              <LinearGradient
                colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.45)"]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              />

              {/* Bottom curvature darkening */}
              <LinearGradient
                colors={["transparent", "transparent", "rgba(0,0,0,0.55)"]}
                locations={[0, 0.4, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              />

              {/* Main glossy highlight (large oval, glass/plastic surface) */}
              <View
                style={{
                  position: "absolute",
                  top: 5,
                  left: (BUTTON_SIZE - 28) * 0.08,
                  width: (BUTTON_SIZE - 28) * 0.84,
                  height: (BUTTON_SIZE - 28) * 0.46,
                  borderRadius: (BUTTON_SIZE - 28) * 0.4,
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0.68)",
                    "rgba(255,255,255,0.28)",
                    "rgba(255,255,255,0.06)",
                    "transparent",
                  ]}
                  locations={[0, 0.22, 0.6, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>

              {/* Small bright specular hotspot */}
              <View
                style={{
                  position: "absolute",
                  top: 9,
                  left: (BUTTON_SIZE - 28) * 0.28,
                  width: (BUTTON_SIZE - 28) * 0.44,
                  height: (BUTTON_SIZE - 28) * 0.19,
                  borderRadius: (BUTTON_SIZE - 28) * 0.12,
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0.95)",
                    "rgba(255,255,255,0.45)",
                    "transparent",
                  ]}
                  locations={[0, 0.3, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>

              {/* Bottom rim warm bounce light */}
              <View
                style={{
                  position: "absolute",
                  bottom: 11,
                  left: (BUTTON_SIZE - 28) * 0.28,
                  width: (BUTTON_SIZE - 28) * 0.44,
                  height: 10,
                  borderRadius: 5,
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(255,110,70,0.3)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>

              {/* Inner edge shadow ring (convex rim depth) */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: (BUTTON_SIZE - 28) / 2,
                  borderWidth: 4,
                  borderColor: "rgba(0,0,0,0.28)",
                }}
              />
            </View>
          </Animated.View>
        </Pressable>

        {/* TRI-LIGHT text */}
        <Text
          style={{
            marginTop: 40,
            fontSize: 42,
            fontWeight: "900",
            letterSpacing: 12,
            color: "#1a1a1a",
          }}
        >
          TRI-LIGHT
        </Text>

        {/* 3 Contact Slots */}
        <View style={{ flexDirection: "row", marginTop: 24, gap: 8, paddingHorizontal: 16 }}>
          {([1, 2, 3] as const).map((slot) => {
            const p = persons[slot - 1];
            const isPrimary = slot === 1;
            const isEmpty = p === null;

            if (isEmpty) {
              return (
                <Pressable
                  key={slot}
                  onPress={() => handleOpenSlotModal(slot)}
                  testID={`contact-slot-${slot}-empty`}
                  style={({ pressed }) => ({
                    width: 100,
                    height: 72,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: isPrimary ? "#333" : "#2a2a2a",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Plus size={16} color={isPrimary ? "#444" : "#333"} />
                  <Text style={{ fontSize: 11, color: isPrimary ? "#444" : "#333", fontWeight: "500" }}>
                    {isPrimary ? "Add person" : "Add backup"}
                  </Text>
                </Pressable>
              );
            }

            const statusColor =
              p.consentStatus === 'confirmed' ? "#00b450" :
              p.consentStatus === 'pending' ? "#ffc800" :
              p.consentStatus === 'declined' ? "#b45309" : "#555";

            return (
              <Pressable
                key={slot}
                onPress={() => handleOpenSlotModal(slot, p.name, p.phone)}
                testID={`contact-slot-${slot}-filled`}
                style={({ pressed }) => ({
                  width: 100,
                  height: 72,
                  borderRadius: 14,
                  backgroundColor: "#111",
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  justifyContent: "space-between",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 13, color: "#ffffff", fontWeight: "700" }}
                >
                  {p.name}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
                  <Text style={{ fontSize: 10, color: statusColor, fontWeight: "600" }}>
                    {p.consentStatus === 'confirmed' ? "Active" :
                     p.consentStatus === 'pending' ? "Pending" :
                     p.consentStatus === 'declined' ? "Declined" : "Unknown"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Transient status message (invitation sent / consent pending resend) */}
        {statusMessage ? (
          <Text
            style={{
              marginTop: 16,
              fontSize: 13,
              color: "#cc0000",
              textAlign: "center",
              paddingHorizontal: 32,
            }}
          >
            {statusMessage}
          </Text>
        ) : null}
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
              {persons[activeSlot - 1]
                ? (activeSlot === 1 ? "Change my person" : "Edit backup contact")
                : (activeSlot === 1 ? "Who's your person?" : "Add a backup person")}
            </Text>
            <Text style={{ fontSize: 16, color: "#666666", marginBottom: 20, lineHeight: 22 }}>
              {activeSlot === 1
                ? (persons[0] ? "Update the name or email." : "The one who picks up.")
                : "A backup who can also receive your REACH."}
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
                Email Address
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="their@email.com"
                placeholderTextColor="#444"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
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
                  {saving ? "SAVING..." : activeSlot === 1 ? "SAVE MY PERSON" : "SAVE BACKUP"}
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
              maxHeight: "80%",
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Handle */}
            <View style={{ alignItems: "center", marginBottom: 28 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#282828" }} />
            </View>

            {/* MY PEOPLE section */}
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#444", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
              My People
            </Text>

            {([1, 2, 3] as const).map((slot) => {
              const p = persons[slot - 1];
              const isPrimary = slot === 1;

              if (!p) {
                return (
                  <Pressable
                    key={slot}
                    onPress={() => handleEditFromSettings(slot)}
                    testID={`settings-slot-${slot}-empty`}
                    style={({ pressed }) => ({
                      paddingVertical: 14,
                      paddingHorizontal: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: "#1a1a1a",
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "600", color: isPrimary ? "#cc0000" : "#555" }}>
                      {isPrimary ? "Set primary contact" : "+ Add backup person"}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#333", marginTop: 2 }}>
                      {isPrimary ? "Required to use REACH" : `Slot ${slot} — backup contact`}
                    </Text>
                  </Pressable>
                );
              }

              return (
                <View
                  key={slot}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: "#1a1a1a",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <Text style={{ fontSize: 11, color: "#444" }}>{slotLabels[slot]}</Text>
                        {renderConsentBadge(p.consentStatus)}
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {p.consentStatus === 'pending' ? (
                        <Pressable
                          onPress={() => handleResend(slot)}
                          disabled={resendingSlot === slot}
                          testID={`settings-resend-slot-${slot}`}
                          style={({ pressed }) => ({
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: "#1a1400",
                            borderWidth: 1,
                            borderColor: "#3a3000",
                            opacity: pressed || resendingSlot === slot ? 0.5 : 1,
                          })}
                        >
                          <Text style={{ fontSize: 12, color: "#ffc800", fontWeight: "600" }}>
                            {resendingSlot === slot ? "..." : "Resend"}
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => handleEditFromSettings(slot)}
                        testID={`settings-edit-slot-${slot}`}
                        style={({ pressed }) => ({
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: "#1a0000",
                          borderWidth: 1,
                          borderColor: "#330000",
                          opacity: pressed ? 0.5 : 1,
                        })}
                      >
                        <Text style={{ fontSize: 12, color: "#cc0000", fontWeight: "600" }}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRemoveFromSettings(slot)}
                        testID={`settings-remove-slot-${slot}`}
                        style={({ pressed }) => ({
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: "#161616",
                          borderWidth: 1,
                          borderColor: "#282828",
                          opacity: pressed ? 0.5 : 1,
                        })}
                      >
                        <Text style={{ fontSize: 12, color: "#666", fontWeight: "600" }}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: "#1a1a1a", marginVertical: 8 }} />

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
          </ScrollView>
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
              {persons[activeSlot - 1]?.name ?? name} gets a video{"\n"}call request.
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
            Reaching <Text style={{ color: "#cc0000" }}>{persons[0]?.name ?? "your person"}</Text>
          </Text>
          <Text style={{ color: "#444", fontSize: 13, marginTop: 5 }}>
            Video call started
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
                  const phoneNum = item.emails?.[0]?.email ?? null;
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
