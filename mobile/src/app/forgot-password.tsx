import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { authClient } from "@/lib/auth/auth-client";
import { ChevronLeft } from "lucide-react-native";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert("Missing Email", "Please enter your email address.");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: "/reset-password",
      });
      setSent(true);
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
        style={{ flex: 1, paddingHorizontal: 28 }}
      >
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 64, marginBottom: 40, flexDirection: "row", alignItems: "center" }}
          testID="back-button"
        >
          <ChevronLeft size={22} color="#555" />
          <Text style={{ color: "#555", fontSize: 16, marginLeft: 4 }}>Back</Text>
        </Pressable>

        <Text style={{ fontSize: 32, fontWeight: "800", color: "#fff", marginBottom: 8 }}>
          Reset Password
        </Text>
        <Text style={{ fontSize: 15, color: "#555", marginBottom: 40, lineHeight: 22 }}>
          Enter your email and we'll send a reset link.
        </Text>

        {sent ? (
          <View
            style={{
              backgroundColor: "#111",
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: "#cc0000",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              Check your email
            </Text>
            <Text style={{ color: "#666", fontSize: 14, marginTop: 8, textAlign: "center" }}>
              We've sent a password reset link to {email}
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#333"
              autoCapitalize="none"
              keyboardType="email-address"
              testID="email-input"
              style={{
                backgroundColor: "#111",
                borderRadius: 14,
                paddingHorizontal: 18,
                paddingVertical: 16,
                fontSize: 16,
                color: "#fff",
                borderWidth: 1,
                borderColor: "#1e1e1e",
                marginBottom: 28,
              }}
            />
            <Pressable
              onPress={handleReset}
              disabled={loading}
              testID="reset-button"
              style={({ pressed }) => ({ opacity: pressed || loading ? 0.7 : 1 })}
            >
              <LinearGradient
                colors={["#ee1111", "#cc0000", "#aa0000"]}
                style={{ borderRadius: 16, paddingVertical: 18, alignItems: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
