import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ApplyModal from "../../components/leave_feature/components/ApplyModal";
import FooterNav, {
  getFooterNavClearance,
} from "../../components/leave_feature/components/FooterNav";
import HistorySection from "../../components/leave_feature/components/HistorySection";
import LeaveApprovalPanel from "../../components/leave_feature/components/LeaveApprovalPanel";
import LeaveDetailsModal from "../../components/leave_feature/components/LeaveDetailsModal";
import LeaveHeader from "../../components/leave_feature/components/LeaveHeader";
import StatsSection from "../../components/leave_feature/components/StatsSection";
import KeyboardAwareScrollView from "../../components/ui/keyboard-aware-scroll-view";
import { styles } from "../../components/leave_feature/styles";
import { useLeaveDashboard } from "../../components/leave_feature/hooks/useLeaveDashboard";
import { isLeaveApprover } from "../../utils/mobileSession";

const LeaveDashboard = () => {
  const insets = useSafeAreaInsets();
  const [showApprovals, setShowApprovals] = React.useState(false);
  const [canApprove, setCanApprove] = React.useState(false);
  const {
    annualStats,
    applyModalProps,
    employeeName,
    filteredRequests,
    isFullyLoading,
    isLoading,
    leaveDetailsProps,
    handleViewLeaveDetails,
    refreshing,
    searchQuery,
    setIsModalOpen,
    setRefreshing,
    setSearchQuery,
    summary,
    refreshData,
  } = useLeaveDashboard();

  React.useEffect(() => {
    const loadRole = async () => {
      const values = await AsyncStorage.multiGet(["userRole", "userTeam", "userDesignation"]);
      const map = Object.fromEntries(values);
      setCanApprove(isLeaveApprover(map.userRole || "", map.userTeam || "", map.userDesignation || ""));
    };

    void loadRole();
  }, []);

  if (isFullyLoading) {
    return (
      <View style={styles.centeredFull}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 16, color: "#64748b" }}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <LeaveHeader employeeName={employeeName} />

      <KeyboardAwareScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refreshData().finally(() => setRefreshing(false));
            }}
          />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: getFooterNavClearance(insets.bottom) }]}
        extraScrollHeight={110}
      >
        {canApprove ? (
          <View style={localStyles.toggleRow}>
            <TouchableOpacity
              style={[localStyles.toggleChip, !showApprovals && localStyles.toggleChipActive]}
              onPress={() => setShowApprovals(false)}
            >
              <Text style={[localStyles.toggleText, !showApprovals && localStyles.toggleTextActive]}>My Requests</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[localStyles.toggleChip, showApprovals && localStyles.toggleChipActive]}
              onPress={() => setShowApprovals(true)}
            >
              <Text style={[localStyles.toggleText, showApprovals && localStyles.toggleTextActive]}>Approval Queue</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showApprovals ? (
          <LeaveApprovalPanel visible={showApprovals} />
        ) : (
          <>
            <StatsSection isLoading={isLoading.summary} summary={summary} annualStats={annualStats} />

            <HistorySection
              isLoading={isLoading.history}
              filteredRequests={filteredRequests}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectRequest={handleViewLeaveDetails}
            />
          </>
        )}
      </KeyboardAwareScrollView>

      {!showApprovals ? (
        <TouchableOpacity
          style={[styles.fab, { bottom: getFooterNavClearance(insets.bottom) + 8 }]}
          onPress={() => setIsModalOpen(true)}>
          <Plus size={24} color="#fff" />
          <Text style={styles.fabText}>Apply</Text>
        </TouchableOpacity>
      ) : null}

      <ApplyModal {...applyModalProps} />
      <LeaveDetailsModal {...leaveDetailsProps} />

      <FooterNav activeTab="leave" />
    </SafeAreaView>
  );
};

export default LeaveDashboard;

const localStyles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  toggleChip: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  toggleChipActive: {
    backgroundColor: "#0f172a",
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
  },
  toggleTextActive: {
    color: "#fff",
  },
});
