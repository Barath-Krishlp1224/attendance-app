import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CalendarDays,
  Fingerprint,
  History as HistoryIcon,
  MessageSquare,
  PartyPopper,
} from "lucide-react-native";
import { styles } from "../styles";

const FooterNav = () => {
  const router = useRouter();

  return (
    <View style={styles.footer}>
      <TouchableOpacity style={styles.footerButton} onPress={() => router.push("/attendance")}>
        <Fingerprint size={22} color="#64748b" />
        <Text style={styles.footerLabel}>Mark Attendance</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.footerButton} onPress={() => router.push("/chat")}>
        <MessageSquare size={22} color="#64748b" />
        <Text style={styles.footerLabel}>Chat</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.footerButton} onPress={() => router.push("/leave")}>
        <CalendarDays size={22} color="#059669" />
        <Text style={[styles.footerLabel, { color: "#059669", fontWeight: "bold" }]}>Leaves</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.footerButton} onPress={() => router.push("/att-history")}>
        <HistoryIcon size={22} color="#64748b" />
        <Text style={styles.footerLabel}>History</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.footerButton} onPress={() => router.push("/holidays")}>
        <PartyPopper size={22} color="#64748b" />
        <Text style={styles.footerLabel}>Holidays</Text>
      </TouchableOpacity>
    </View>
  );
};

export default FooterNav;
