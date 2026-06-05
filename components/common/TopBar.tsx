import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Power } from "lucide-react-native";
import React from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type TopBarProps = {
  subtitle?: string;
  children?: React.ReactNode;
};

const TopBar: React.FC<TopBarProps> = ({ subtitle, children }) => {
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "userId",
            "userRole",
            "userEmpId",
            "userName",
            "userTeam",
            "userDesignation",
            "userEmail",
          ]);
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <View style={styles.shell}>
      <View style={styles.topRow}>
        <View style={styles.leftBlock}>
          <Image source={require("../../assets/logo-hd.png")} style={styles.logo} resizeMode="contain" />
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity style={styles.powerButton} onPress={handleLogout} activeOpacity={0.8}>
          <Power size={20} color="#dc2626" />
        </TouchableOpacity>
      </View>
      {children ? <View style={styles.childrenWrap}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  leftBlock: {
    flex: 1,
  },
  logo: {
    width: 120,
    height: 36,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  powerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  childrenWrap: {
    marginTop: 14,
  },
});

export default TopBar;
