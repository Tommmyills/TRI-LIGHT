import React, { useState } from "react";
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
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { authClient } from "@/lib/auth/auth-client";
import { useInvalidateSession } from "@/lib/auth/use-session";

export default function SignUpScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const invalidateSession = useInvalidateSession();

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Missing Info", "Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak Password", "Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.error) {
        Alert.alert("Sign Up Failed", result.error.message || "Could not create account.");
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={{ marginBottom: 48, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 48,
                fontWeight: "900",
                letterSpacing: 14,
                color: "#1a1a1a",
                marginBottom: 4,
              }}
            >
              REACH
            </Text>
            <View style={{ width: 40, height: 2, backgroundColor: "#cc0000", borderRadius: 1 }} />
            <Text style={{ color: "#444", fontSize: 15, marginTop: 16, fontWeight: "500" }}>
              Create your account
            </Text>
          </View>

          {/* Name */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#444", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#333"
              autoCapitalize="words"
              testID="name-input"
              style={{ backgroundColor: "#111", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, fontSize: 16, color: "#fff", borderWidth: 1, borderColor: "#1e1e1e" }}
            />
          </View>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#444", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#333"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              testID="email-input"
              style={{ backgroundColor: "#111", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, fontSize: 16, color: "#fff", borderWidth: 1, borderColor: "#1e1e1e" }}
            />
          </View>

          {/* Password */}
          <View style={{ marginBottom: 36 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#444", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#333"
              secureTextEntry
              testID="password-input"
              style={{ backgroundColor: "#111", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, fontSize: 16, color: "#fff", borderWidth: 1, borderColor: "#1e1e1e" }}
            />
          </View>

          {/* Sign Up Button */}
          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            testID="sign-up-button"
            style={({ pressed }) => ({ opacity: pressed || loading ? 0.7 : 1 })}
          >
            <LinearGradient
              colors={["#ee1111", "#cc0000", "#aa0000"]}
              style={{ borderRadius: 16, paddingVertical: 18, alignItems: "center" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>
                {loading ? "Creating Account..." : "Create Account"}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Sign In link */}
          <Pressable onPress={() => router.back()} style={{ marginTop: 24, alignItems: "center" }} testID="sign-in-link">
            <Text style={{ color: "#555", fontSize: 15 }}>
              Already have an account?{" "}
              <Text style={{ color: "#cc0000", fontWeight: "700" }}>Sign In</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
