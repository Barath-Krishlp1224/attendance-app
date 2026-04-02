import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";

import ApplyModal from "../../components/leave_feature/components/ApplyModal";
import FooterNav from "../../components/leave_feature/components/FooterNav";
import HistorySection from "../../components/leave_feature/components/HistorySection";
import LeaveDetailsModal from "../../components/leave_feature/components/LeaveDetailsModal";
import LeaveHeader from "../../components/leave_feature/components/LeaveHeader";
import StatsSection from "../../components/leave_feature/components/StatsSection";
import { styles } from "../../components/leave_feature/styles";
import { useLeaveDashboard } from "../../components/leave_feature/hooks/useLeaveDashboard";

const LeaveDashboard = () => {
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

  if (isFullyLoading) {
    return (
      <View style={styles.centeredFull}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 16, color: "#64748b" }}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LeaveHeader employeeName={employeeName} />

      <ScrollView
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
        contentContainerStyle={styles.scrollContent}
      >
        <StatsSection isLoading={isLoading.summary} summary={summary} annualStats={annualStats} />

        <HistorySection
          isLoading={isLoading.history}
          filteredRequests={filteredRequests}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectRequest={handleViewLeaveDetails}
        />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setIsModalOpen(true)}>
        <Plus size={24} color="#fff" />
        <Text style={styles.fabText}>Apply</Text>
      </TouchableOpacity>

      <ApplyModal {...applyModalProps} />
      <LeaveDetailsModal {...leaveDetailsProps} />

      <FooterNav />
    </SafeAreaView>
  );
};

export default LeaveDashboard;
