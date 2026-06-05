import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { RequestItem } from "../types";
import KeyboardAwareScrollView from "../../ui/keyboard-aware-scroll-view";
import { API_BASE_URL, getApproverRoleLabel, getMobileUserSession } from "../../../utils/mobileSession";

type LeaveApprovalPanelProps = {
  visible: boolean;
};

const OPEN_STATUSES = ["pending", "manager-pending", "hr-pending"];

const formatDate = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusTone = (status: string) => {
  if (status === "approved" || status === "auto-approved") {
    return { bg: "#dcfce7", text: "#166534" };
  }
  if (status === "rejected") {
    return { bg: "#fee2e2", text: "#b91c1c" };
  }
  return { bg: "#fef3c7", text: "#b45309" };
};

const LeaveApprovalPanel: React.FC<LeaveApprovalPanelProps> = ({ visible }) => {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [pendingAction, setPendingAction] = useState<"approved" | "rejected" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [approverName, setApproverName] = useState("Approval System");
  const [approverRole, setApproverRole] = useState("Admin-Manager");
  const [employeeId, setEmployeeId] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      const session = await getMobileUserSession();
      setApproverName(session.userName || "Approval System");
      setApproverRole(getApproverRoleLabel(session.userRole, session.userTeam, session.userDesignation));
      setEmployeeId(session.userEmpId);

      const response = await fetch(`${API_BASE_URL}/api/leaves`);
      const data = await response.json();
      const normalized = Array.isArray(data)
        ? data.map((item: any) => ({
            ...item,
            id: item._id || item.id,
          }))
        : [];
      setRequests(normalized);
    } catch (error) {
      console.error("Failed to load leave approval queue:", error);
      Alert.alert("Error", "Failed to load leave requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadRequests();
    const intervalId = setInterval(loadRequests, 15000);
    return () => clearInterval(intervalId);
  }, [loadRequests, visible]);

  const pendingRequests = useMemo(
    () => requests.filter((request) => OPEN_STATUSES.includes(request.status)),
    [requests]
  );

  const recentRequests = useMemo(
    () =>
      requests
        .filter((request) => !OPEN_STATUSES.includes(request.status))
        .sort((a, b) => new Date(b.approvedAt || b.createdAt || 0).getTime() - new Date(a.approvedAt || a.createdAt || 0).getTime())
        .slice(0, 8),
    [requests]
  );

  const submitAction = async () => {
    if (!selectedRequest?._id || !pendingAction) return;

    try {
      setUpdatingId(selectedRequest._id);
      const response = await fetch(`${API_BASE_URL}/api/leaves/${selectedRequest._id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: pendingAction,
          remarks: remarks.trim(),
          approverName,
          approverRole,
          employeeId: selectedRequest.employeeId || employeeId,
          sendEmail: true,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Error", data?.error || "Failed to update leave request.");
        return;
      }

      setSelectedRequest(null);
      setPendingAction(null);
      setRemarks("");
      await loadRequests();
      Alert.alert("Success", `Leave request ${pendingAction === "approved" ? "approved" : "rejected"} successfully.`);
    } catch (error) {
      console.error("Failed to update leave request:", error);
      Alert.alert("Error", "Failed to update leave request.");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadRequests(); }} />}
      extraScrollHeight={110}
    >
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#fef3c7" }]}>
          <Text style={styles.statValue}>{pendingRequests.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={styles.statValue}>
            {requests.filter((request) => request.status === "approved" || request.status === "auto-approved").length}
          </Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fee2e2" }]}>
          <Text style={styles.statValue}>{requests.filter((request) => request.status === "rejected").length}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Open Leave Requests</Text>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.emptyText}>Loading requests...</Text>
          </View>
        ) : pendingRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No pending leave requests.</Text>
          </View>
        ) : (
          pendingRequests.map((request) => {
            const tone = getStatusTone(request.status);
            return (
              <View key={request._id || request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestName}>{request.employeeName || "Unknown Employee"}</Text>
                    <Text style={styles.requestMeta}>
                      {request.employeeId || "N/A"} • {(request.leaveType || "leave").toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusText, { color: tone.text }]}>{request.status}</Text>
                  </View>
                </View>
                <Text style={styles.requestMeta}>
                  {formatDate(request.startDate)}{request.endDate && request.endDate !== request.startDate ? ` - ${formatDate(request.endDate)}` : ""}
                </Text>
                <Text style={styles.requestMeta}>Duration: {request.days || 0} day(s)</Text>
                <Text style={styles.requestDescription}>{request.description || "No reason provided."}</Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    disabled={updatingId === request._id}
                    onPress={() => {
                      setSelectedRequest(request);
                      setPendingAction("approved");
                    }}
                  >
                    <Text style={styles.actionButtonText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    disabled={updatingId === request._id}
                    onPress={() => {
                      setSelectedRequest(request);
                      setPendingAction("rejected");
                    }}
                  >
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Decisions</Text>
        {recentRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recent approvals yet.</Text>
          </View>
        ) : (
          recentRequests.map((request) => {
            const tone = getStatusTone(request.status);
            return (
              <View key={request._id || request.id} style={styles.historyCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestName}>{request.employeeName || "Unknown Employee"}</Text>
                  <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusText, { color: tone.text }]}>{request.status}</Text>
                  </View>
                </View>
                <Text style={styles.requestMeta}>
                  {(request.leaveType || "leave").toUpperCase()} • {formatDate(request.startDate)}
                </Text>
                <Text style={styles.requestMeta}>
                  {request.approverName || "N/A"} ({request.approverRole || "N/A"}) • {formatDateTime(request.approvedAt)}
                </Text>
                {request.approvalRemarks ? <Text style={styles.requestDescription}>{request.approvalRemarks}</Text> : null}
              </View>
            );
          })
        )}
      </View>

      <Modal visible={Boolean(selectedRequest && pendingAction)} transparent animationType="slide" onRequestClose={() => setSelectedRequest(null)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <KeyboardAwareScrollView
            contentContainerStyle={styles.modalScrollContent}
            avoidKeyboard={false}
            extraScrollHeight={120}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {pendingAction === "approved" ? "Approve Request" : "Reject Request"}
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedRequest?.employeeName || "Employee"} • {(selectedRequest?.leaveType || "leave").toUpperCase()}
              </Text>
              <TextInput
                style={styles.remarksInput}
                multiline
                placeholder="Add remarks"
                value={remarks}
                onChangeText={setRemarks}
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => { setSelectedRequest(null); setPendingAction(null); setRemarks(""); }}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, pendingAction === "approved" ? styles.approveButton : styles.rejectButton]} onPress={() => void submitAction()}>
                  <Text style={styles.actionButtonText}>{pendingAction === "approved" ? "Approve" : "Reject"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 140, gap: 16 },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, borderRadius: 20, padding: 16 },
  statValue: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  statLabel: { marginTop: 4, fontSize: 12, fontWeight: "600", color: "#475569" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 10 },
  emptyText: { color: "#64748b", fontSize: 14, fontWeight: "600" },
  requestCard: { borderRadius: 20, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", padding: 14, gap: 8 },
  historyCard: { borderRadius: 20, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", padding: 14, gap: 6 },
  requestHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  requestName: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  requestMeta: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  requestDescription: { fontSize: 13, color: "#334155", lineHeight: 19 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionButton: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  approveButton: { backgroundColor: "#059669" },
  rejectButton: { backgroundColor: "#dc2626" },
  actionButtonText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.55)", justifyContent: "flex-end", padding: 16 },
  modalScrollContent: { flexGrow: 1, justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderRadius: 24, padding: 18, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  modalSubtitle: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  remarksInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0f172a",
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalButton: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  cancelButton: { backgroundColor: "#e2e8f0" },
  cancelButtonText: { color: "#334155", fontWeight: "800", fontSize: 13 },
});

export default LeaveApprovalPanel;
