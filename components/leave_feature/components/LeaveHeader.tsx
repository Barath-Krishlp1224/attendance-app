import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { UserCheck } from "lucide-react-native";
import { styles } from "../styles";

interface LeaveHeaderProps {
  employeeName?: string;
}

const LeaveHeader: React.FC<LeaveHeaderProps> = ({ employeeName }) => (
  <View style={styles.header}>
    <View style={styles.headerTopRow}>
      <View>
        <Image source={require("../../../assets/logo-hd.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.headerSubtitle}>Leave & Permission Dashboard</Text>
      </View>
      <View style={styles.headerRight}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{employeeName || "User"}</Text>
        </View>
        <TouchableOpacity style={styles.avatar}>
          <UserCheck size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

export default LeaveHeader;
