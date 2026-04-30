import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { authClient } from "@/lib/auth/auth-client";
import { useInvalidateSession } from "@/lib/auth/use-session";

// Animated background blob
function GlowOrb({
  color,
  size,
  initialX,
  initialY,
  duration,
  delay,
}: {
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  duration: number;
  delay: number;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(30, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(-20, { duration: duration * 0.8, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: duration * 0.6, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-25, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) }),
        withTiming(20, { duration: duration * 0.9, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: duration * 0.7, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: initialX,
          top: initialY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: 0.08,
        },
        animStyle,
      ]}
    />
  );
}

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const invalidateSession = useInvalidateSession();

  // Title letter fade-in
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(12);

  useEffect(() => {
    titleOpacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    titleTranslateY.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, []);

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Info", "Please enter email and password.");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.error) {
        Alert.alert("Sign In Failed", result.error.message || "Invalid credentials.");
      } else {
        await invalidateSession();
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
      {/* Animated background orbs */}
      <GlowOrb color="#cc0000" size={340} initialX={-80} initialY={60} duration={7000} delay={0} />
      <GlowOrb color="#ffc800" size={300} initialX={120} initialY={280} duration={9000} delay={1500} />
      <GlowOrb color="#00b450" size={320} initialX={-40} initialY={500} duration={8000} delay={800} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 28,
            paddingBottom: 120,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Animated.View style={[{ marginBottom: 56, alignItems: "center" }, titleAnimStyle]}>
            <Text
              style={{
                fontSize: 46,
                fontWeight: "900",
                letterSpacing: 16,
                color: "#ffffff",
                marginBottom: 10,
                textShadowColor: "rgba(204,0,0,0.5)",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 18,
              }}
            >
              TRI-LIGHT
            </Text>
            {/* Red accent line */}
            <View
              style={{
                width: 48,
                height: 2,
                backgroundColor: "#cc0000",
                borderRadius: 1,
                shadowColor: "#cc0000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 8,
              }}
            />
          </Animated.View>

          {/* EMAIL input */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: "#cc0000",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              EMAIL
            </Text>
            <View style={{ borderRadius: 16, overflow: "hidden" }}>
              <BlurView intensity={40} tint="dark" style={{ padding: 4 }}>
                <View
                  style={{
                    backgroundColor: "rgba(204, 0, 0, 0.12)",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "rgba(204, 0, 0, 0.35)",
                    padding: 2,
                  }}
                >
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(204,0,0,0.35)"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    testID="email-input"
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 16,
                      color: "#fff",
                      fontSize: 16,
                    }}
                  />
                </View>
              </BlurView>
            </View>
          </View>

          {/* PASSWORD input */}
          <View style={{ marginBottom: 12 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: "#ffc800",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              PASSWORD
            </Text>
            <View style={{ borderRadius: 16, overflow: "hidden" }}>
              <BlurView intensity={40} tint="dark" style={{ padding: 4 }}>
                <View
                  style={{
                    backgroundColor: "rgba(255, 200, 0, 0.12)",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "rgba(255, 200, 0, 0.35)",
                    padding: 2,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,200,0,0.35)"
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    testID="password-input"
                    style={{
                      flex: 1,
                      paddingHorizontal: 18,
                      paddingVertical: 16,
                      color: "#fff",
                      fontSize: 16,
                    }}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    style={{ paddingHorizontal: 14 }}
                    testID="toggle-password-visibility"
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="rgba(255,200,0,0.5)" />
                    ) : (
                      <Eye size={18} color="rgba(255,200,0,0.5)" />
                    )}
                  </Pressable>
                </View>
              </BlurView>
            </View>
          </View>

          {/* Forgot password */}
          <Pressable
            onPress={() => router.push("/forgot-password" as any)}
            style={{ alignSelf: "flex-end", marginBottom: 32 }}
            testID="forgot-password-link"
          >
            <Text style={{ color: "#cc0000", fontSize: 13, fontWeight: "600", letterSpacing: 0.3 }}>
              Forgot Password?
            </Text>
          </Pressable>

          {/* Sign In button */}
          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            testID="sign-in-button"
            style={({ pressed }) => ({ opacity: pressed || loading ? 0.65 : 1 })}
          >
            <View style={{ borderRadius: 16, overflow: "hidden" }}>
              <BlurView intensity={60} tint="dark">
                <View
                  style={{
                    backgroundColor: "rgba(0, 180, 80, 0.25)",
                    borderWidth: 1,
                    borderColor: "rgba(0, 200, 80, 0.5)",
                    borderRadius: 16,
                    paddingVertical: 18,
                    alignItems: "center",
                    shadowColor: "#00e060",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 16,
                  }}
                >
                  <Text
                    style={{
                      color: "#00e060",
                      fontWeight: "800",
                      fontSize: 16,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                    }}
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </Text>
                </View>
              </BlurView>
            </View>
          </Pressable>

          {/* Sign Up link */}
          <Pressable
            onPress={() => router.push("/sign-up" as any)}
            style={{ marginTop: 28, alignItems: "center" }}
            testID="sign-up-link"
          >
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 15 }}>
              Don't have an account?{" "}
              <Text style={{ color: "#cc0000", fontWeight: "700" }}>Sign Up</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* R.E.A.C.H. footer branding */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 38,
          paddingTop: 18,
          alignItems: "center",
        }}
      >
        <BlurView intensity={30} tint="dark" style={{ borderRadius: 0, width: "100%", alignItems: "center", paddingVertical: 16 }}>
          <View
            style={{
              width: 32,
              height: 1,
              backgroundColor: "#cc0000",
              marginBottom: 12,
              shadowColor: "#cc0000",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 6,
            }}
          />
          <Text
            style={{
              fontSize: 30,
              fontWeight: "900",
              letterSpacing: 12,
              color: "#ffffff",
              textShadowColor: "rgba(204,0,0,0.7)",
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 20,
            }}
          >
            R.E.A.C.H.
          </Text>
          <Text
            style={{
              fontSize: 8.5,
              fontWeight: "700",
              letterSpacing: 2,
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
              marginTop: 6,
              textAlign: "center",
              paddingHorizontal: 24,
            }}
          >
            REALTIME ENGAGEMENT & ACCOUNTABILITY COMPLIANCE HUB
          </Text>
        </BlurView>
      </View>
    </View>
  );
}
