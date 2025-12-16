import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";

import logoImage from "../../assets/logo-hd.png";

type Role = "Admin" | "Manager" | "TeamLead" | "Employee";
type Team =
  | "Founders"
  | "Manager"
  | "TL-Reporting Manager"
  | "IT Admin"
  | "Tech"
  | "Accounts"
  | "HR"
  | "Admin & Operations"
  | "TL Accountant";

const API_BASE_URL = "https://check-seven-steel.vercel.app";

export default function LoginScreen() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const showValidationError = (message: string) => {
    Toast.show({
      type: "error",
      text1: message,
    });
  };

  const handleLogin = async () => {
    if (!empId.trim()) return showValidationError("Employee ID or Email is required.");
    if (!password) return showValidationError("Password is required.");

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empIdOrEmail: empId,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage =
          data.error || "Login failed. Please check your credentials.";
        Toast.show({ type: "error", text1: errorMessage });
        setLoading(false);
        return;
      }

      if (!data.user?.role || !data.user?.empId) {
        Toast.show({
          type: "error",
          text1: "Login successful but required user data is missing.",
        });
        setLoading(false);
        return;
      }

      const userRole = data.user.role as Role;
      const userTeam = data.user.team as Team | undefined;

      await AsyncStorage.multiSet([
        ["userRole", userRole],
        ["userEmpId", data.user.empId],
        ["userName", data.user.name || ""],
        ["userTeam", userTeam || ""],
      ]);

      Toast.show({
        type: "success",
        text1: data.message || "Login successful!",
      });

      setTimeout(() => {
        router.replace("/(tabs)/attendance");
      }, 800);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Network error. Try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.backgroundLayer}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
      </View>

      <Image source={logoImage} style={styles.logo} />

      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back...</Text>
          <Text style={styles.subtitle}>Sign in to get started with attendance</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Enter Employee ID / Email</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Enter EMP ID or email@lemonpay.tech"
              placeholderTextColor="#9ca3af"
              value={empId}
              onChangeText={setEmpId}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Enter Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Enter your 8-digit password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={[styles.button, loading && { opacity: 0.7 }]}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing In..." : "Sign In"}
          </Text>
        </TouchableOpacity>
      </View>

      <Toast />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  backgroundLayer: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  circle1: {
    position: "absolute",
    top: -160,
    right: -120,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "#fff200",
    opacity: 1,
  },
  circle2: {
    position: "absolute",
    bottom: -160,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "#3fa87d",
    opacity: 1,
  },

  logo: {
    width: 200,
    height: 80,
    resizeMode: "contain",
    position: "absolute",
    top: "10%",
    alignSelf: "center",
  },

  card: {
    width: "100%",
    maxWidth: 380,
    marginTop: 40,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    padding: 24,
    paddingTop: 60,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  header: { alignItems: "center", marginBottom: 22 },
  title: { fontSize: 28, fontWeight: "800", color: "#2c3e50", textAlign: "center" },
  subtitle: { marginTop: 10, fontSize: 14, color: "#2c3e50", textAlign: "center" },

  fieldGroup: { width: "100%", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  inputWrapper: {
    borderRadius: 14, borderWidth: 2, borderColor: "#2c3e50",
    backgroundColor: "#f9fafb", paddingHorizontal: 10,
  },
  input: { height: 46, color: "#111827", fontSize: 14 },

  button: {
    marginTop: 10,
    backgroundColor: "#2c3e50",
    borderRadius: 16,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
  },

  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});