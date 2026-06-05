import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

import TopBar from "../../components/common/TopBar";
import FooterNav, { getFooterNavClearance } from "../../components/leave_feature/components/FooterNav";
import KeyboardAwareScrollView from "../../components/ui/keyboard-aware-scroll-view";
import {
  API_BASE_URL,
  canManageHolidays,
  getMobileAuthHeaders,
  getMobileUserSession,
} from "../../utils/mobileSession";

type RegularizationRequest = {
  _id: string;
  employeeId: string;
  date: string;
  requestedInTime?: string;
  requestedOutTime?: string;
  reason: string;
  status: string;
  approvedAt?: string;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const RegularizationScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [requests, setRequests] = useState<RegularizationRequest[]>([]);
  const [allRequests, setAllRequests] = useState<RegularizationRequest[]>([]);
  const [form, setForm] = useState({
    date: "",
    requestedInTime: "",
    requestedOutTime: "",
    reason: "",
  });

  const loadRequests = useCallback(async () => {
    try {
      const session = await getMobileUserSession();
      const headers = await getMobileAuthHeaders();
      setEmployeeId(session.userEmpId);
      setCanManage(canManageHolidays(session.userRole, session.userTeam, session.userDesignation));

      const ownResponse = await fetch(
        `${API_BASE_URL}/api/regularizations?employeeId=${encodeURIComponent(session.userEmpId)}`,
        { headers }
      );
      const ownData = await ownResponse.json();
      setRequests(Array.isArray(ownData?.requests) ? ownData.requests : []);

      if (canManageHolidays(session.userRole, session.userTeam, session.userDesignation)) {
        const approvalResponse = await fetch(`${API_BASE_URL}/api/regularizations?status=pending`, { headers });
        const approvalData = await approvalResponse.json();
        setAllRequests(Array.isArray(approvalData?.requests) ? approvalData.requests : []);
      } else {
        setAllRequests([]);
      }
    } catch (error) {
      console.error("Failed to load regularizations:", error);
      Alert.alert("Error", "Failed to load regularization requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void loadRequests();
    }, 20000);

    return () => clearInterval(intervalId);
  }, [loadRequests]);

  const pendingApprovals = useMemo(
    () => allRequests.filter((request) => request.status === "pending" && request.employeeId !== employeeId),
    [allRequests, employeeId]
  );

  const submitRequest = async () => {
    if (!employeeId || !form.date.trim() || !form.reason.trim()) {
      Alert.alert("Error", "Date and reason are required.");
      return;
    }

    try {
      const headers = await getMobileAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/regularizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          employeeId,
          ...form,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        Alert.alert("Error", data?.message || "Failed to submit regularization.");
        return;
      }
      setForm({ date: "", requestedInTime: "", requestedOutTime: "", reason: "" });
      await loadRequests();
      Alert.alert("Success", "Attendance regularization submitted.");
    } catch (error) {
      console.error("Failed to submit regularization:", error);
      Alert.alert("Error", "Failed to submit regularization.");
    }
  };

  const updateRequestStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const headers = await getMobileAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/regularizations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ id, status }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        Alert.alert("Error", data?.message || "Failed to update regularization.");
        return;
      }
      await loadRequests();
      Alert.alert("Success", `Request ${status}.`);
    } catch (error) {
      console.error("Failed to update regularization:", error);
      Alert.alert("Error", "Failed to update regularization.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAwareScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadRequests(); }} />}
        contentContainerStyle={[styles.content, { paddingBottom: getFooterNavClearance(insets.bottom) }]}
        extraScrollHeight={120}
      >
        <TopBar subtitle="Attendance Regularization" />

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={18} color="#0f172a" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <Text style={styles.heroSubtitle}>Submit missed or incorrect punches with the same status flow used in web HRMS.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>New Request</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={form.date}
            onChangeText={(value) => setForm((current) => ({ ...current, date: value }))}
            placeholderTextColor="#94a3b8"
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.flexInput]}
              placeholder="Punch-in time"
              value={form.requestedInTime}
              onChangeText={(value) => setForm((current) => ({ ...current, requestedInTime: value }))}
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              style={[styles.input, styles.flexInput]}
              placeholder="Punch-out time"
              value={form.requestedOutTime}
              onChangeText={(value) => setForm((current) => ({ ...current, requestedOutTime: value }))}
              placeholderTextColor="#94a3b8"
            />
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Reason"
            value={form.reason}
            onChangeText={(value) => setForm((current) => ({ ...current, reason: value }))}
            placeholderTextColor="#94a3b8"
            multiline
          />
          <TouchableOpacity style={styles.submitButton} onPress={() => void submitRequest()}>
            <Text style={styles.submitButtonText}>Submit Regularization</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>My Requests</Text>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No regularization requests yet.</Text>
            </View>
          ) : (
            requests.map((request) => (
              <View key={request._id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestDate}>{formatDate(request.date)}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      request.status === "approved"
                        ? styles.approvedPill
                        : request.status === "rejected"
                          ? styles.rejectedPill
                          : styles.pendingPill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        request.status === "approved"
                          ? styles.approvedText
                          : request.status === "rejected"
                            ? styles.rejectedText
                            : styles.pendingText,
                      ]}
                    >
                      {request.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.requestMeta}>
                  In: {request.requestedInTime || "--"} • Out: {request.requestedOutTime || "--"}
                </Text>
                <Text style={styles.requestReason}>{request.reason}</Text>
              </View>
            ))
          )}
        </View>

        {canManage ? (
          <View style={styles.listCard}>
            <Text style={styles.sectionTitle}>Pending Approvals</Text>
            {pendingApprovals.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No pending regularization approvals.</Text>
              </View>
            ) : (
              pendingApprovals.map((request) => (
                <View key={request._id} style={styles.requestCard}>
                  <Text style={styles.requestDate}>
                    {request.employeeId} • {formatDate(request.date)}
                  </Text>
                  <Text style={styles.requestMeta}>
                    In: {request.requestedInTime || "--"} • Out: {request.requestedOutTime || "--"}
                  </Text>
                  <Text style={styles.requestReason}>{request.reason}</Text>
                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => void updateRequestStatus(request._id, "approved")}>
                      <Text style={styles.actionText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => void updateRequestStatus(request._id, "rejected")}>
                      <Text style={styles.actionText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      <FooterNav activeTab="attendance" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 16 },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  heroCard: { backgroundColor: "#0f172a", borderRadius: 28, padding: 18 },
  heroSubtitle: { color: "#cbd5e1", lineHeight: 20 },
  formCard: { backgroundColor: "#fff", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 12 },
  listCard: { backgroundColor: "#fff", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  textArea: { minHeight: 96, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  flexInput: { flex: 1 },
  submitButton: { backgroundColor: "#2563eb", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  submitButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  emptyText: { color: "#64748b", fontWeight: "600" },
  requestCard: { borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", borderRadius: 18, padding: 14, gap: 8 },
  requestHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  requestDate: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  requestMeta: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  requestReason: { fontSize: 13, color: "#334155", lineHeight: 18 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pendingPill: { backgroundColor: "#fef3c7" },
  approvedPill: { backgroundColor: "#dcfce7" },
  rejectedPill: { backgroundColor: "#fee2e2" },
  statusText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  pendingText: { color: "#b45309" },
  approvedText: { color: "#166534" },
  rejectedText: { color: "#b91c1c" },
  actionButton: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  approveButton: { backgroundColor: "#059669" },
  rejectButton: { backgroundColor: "#dc2626" },
  actionText: { color: "#fff", fontWeight: "800" },
});

export default RegularizationScreen;
