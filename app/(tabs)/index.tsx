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
import { Ionicons } from "@expo/vector-icons";

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

const API_BASE_URL = "https://lemonpay-portal.vercel.app/";

export default function LoginScreen() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    } catch (_err) {
      void _err;
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
      <View style={styles.backgroundPattern}>
        <View style={styles.yellowAccent} />
        <View style={styles.greenAccent} />
      </View>

      <View style={styles.logoContainer}>
        <Image source={logoImage} style={styles.logo} />
        <Text style={styles.brandTagline}>Attendance Management System</Text>
      </View>

      <View style={styles.loginCard}>
        <View style={styles.cardHeader}>
          
          <Text style={styles.welcomeText}>Welcome Back</Text>
          <Text style={styles.signInText}>Please sign in to continue</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Employee ID / Email</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your ID or email"
                placeholderTextColor="#94a3b8"
                value={empId}
                onChangeText={setEmpId}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInputWithIcon}
                placeholder="Enter your password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>
              {loading ? "Signing In..." : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Toast />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundPattern: {
    position: "absolute",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  yellowAccent: {
    position: "absolute",
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#fff200",
    opacity: 0.15,
  },
  greenAccent: {
    position: "absolute",
    bottom: -80,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#3fa87d",
    opacity: 0.15,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 180,
    height: 70,
    resizeMode: "contain",
    marginBottom: 8,
  },
  brandTagline: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  loginCard: {
    width: "90%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 32,
    position: "relative",
  },
  headerAccent: {
    width: 60,
    height: 4,
    backgroundColor: "#fff200",
    borderRadius: 2,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 6,
  },
  signInText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
  },
  formContainer: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    height: 52,
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "400",
    flex: 1,
  },
  textInputWithIcon: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "400",
    flex: 1,
    paddingRight: 40,
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    padding: 4,
  },
  loginButton: {
    backgroundColor: "#3fa87d",
    borderRadius: 12,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: "#3fa87d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },
});