import React from "react";
import { Text, View } from "react-native";
import { ShieldCheck, Target, Thermometer, TrendingUp, UserCheck, Plane, HomeIcon, BriefcaseBusiness, Clock3 } from "lucide-react-native";
import { styles } from "../styles";
import { SummaryType } from "../types";
import StatBox from "./StatBox";
import StatBoxSkeleton from "./StatBoxSkeleton";
import PermissionStatBox from "./PermissionStatBox";
import { TOTAL_LIMIT, TOTAL_WORK_DAYS } from "../constants";

interface AnnualStats {
  totalTaken: number;
  presentCount: number;
  sickTaken: number;
  casualTaken: number;
  attendanceProgress: number;
  leaveImpact: number;
  sickUsagePercentage: number;
  casualUsagePercentage: number;
}

interface StatsSectionProps {
  isLoading: boolean;
  summary: SummaryType;
  annualStats: AnnualStats;
}

const StatsSection: React.FC<StatsSectionProps> = ({ isLoading, summary, annualStats }) => (
  <View style={styles.statsSection}>
    <Text style={styles.sectionTitle}>Leave Balance & Stats</Text>
    <View style={styles.statsGrid}>
      {isLoading ? (
        Array.from({ length: 5 }).map((_, index) => <StatBoxSkeleton key={index} />)
      ) : (
        <>
          <View style={styles.statBoxWrapper}>
            <StatBox
              icon={<UserCheck size={20} color="#2563eb" />}
              label="Presence"
              value={annualStats.presentCount}
              sub={`/ ${TOTAL_WORK_DAYS} Days`}
              progress={annualStats.attendanceProgress}
              color="#2563eb"
              progressBg="#dbeafe"
            />
          </View>
          <View style={styles.statBoxWrapper}>
            <StatBox
              icon={<Thermometer size={20} color="#dc2626" />}
              label="Sick Leave"
              value={summary.sick}
              sub={`Taken: ${annualStats.sickTaken}`}
              progress={annualStats.sickUsagePercentage}
              color="#dc2626"
              progressBg="#fee2e2"
              isBalance={true}
              totalLimit={TOTAL_LIMIT}
            />
          </View>
          <View style={styles.statBoxWrapper}>
            <StatBox
              icon={<Plane size={20} color="#059669" />}
              label="Casual Leave"
              value={summary.casual}
              sub={`Taken: ${annualStats.casualTaken}`}
              progress={annualStats.casualUsagePercentage}
              color="#059669"
              progressBg="#d1fae5"
              isBalance={true}
              totalLimit={TOTAL_LIMIT}
            />
          </View>
          <View style={styles.statBoxWrapper}>
            <StatBox
              icon={<TrendingUp size={20} color="#f59e0b" />}
              label="Total Taken"
              value={annualStats.totalTaken}
              sub="Leaves (All)"
              progress={annualStats.leaveImpact}
              color="#f59e0b"
              progressBg="#fef3c7"
            />
          </View>
          <View style={styles.statBoxWrapper}>
            <StatBox
              icon={<Target size={20} color="#8b5cf6" />}
              label="Impact"
              value={annualStats.totalTaken}
              sub={`/ ${TOTAL_WORK_DAYS} Days`}
              progress={annualStats.leaveImpact}
              color="#8b5cf6"
              progressBg="#ede9fe"
            />
          </View>
        </>
      )}
    </View>

    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Permission Summary</Text>
    <View style={styles.statsGrid}>
      {!isLoading && (
        <>
          <View style={styles.statBoxWrapper}>
            <PermissionStatBox
              type="permission"
              label="Permission"
              used={summary.permissionSummary.permission.usedHours}
              remaining={summary.permissionSummary.permission.remainingHours}
              limit={summary.permissionSummary.permission.limit}
              unit="hours"
              pending={summary.permissionSummary.permission.pendingRequests}
              color="#2563eb"
              icon={<ShieldCheck size={20} color="#2563eb" />}
            />
          </View>
          <View style={styles.statBoxWrapper}>
            <PermissionStatBox
              type="on-duty"
              label="On Duty"
              used={summary.permissionSummary.onDuty.usedHours}
              remaining={summary.permissionSummary.onDuty.remainingHours}
              limit={summary.permissionSummary.onDuty.limit}
              unit="hours"
              pending={summary.permissionSummary.onDuty.pendingRequests}
              color="#10b981"
              icon={<BriefcaseBusiness size={20} color="#10b981" />}
            />
          </View>
          <View style={styles.statBoxWrapper}>
            <PermissionStatBox
              type="wfh"
              label="WFH"
              used={summary.permissionSummary.wfh.usedDays}
              remaining={summary.permissionSummary.wfh.remainingDays}
              limit={summary.permissionSummary.wfh.limit}
              unit="days"
              pending={summary.permissionSummary.wfh.pendingRequests}
              color="#8b5cf6"
              icon={<HomeIcon size={20} color="#8b5cf6" />}
            />
          </View>
          <View style={styles.statBoxWrapper}>
            <PermissionStatBox
              type="forgot-check"
              label="Forgot Check"
              pending={summary.permissionSummary.forgotCheck.pendingRequests}
              color="#f59e0b"
              icon={<Clock3 size={20} color="#f59e0b" />}
            />
          </View>
        </>
      )}
    </View>
  </View>
);

export default StatsSection;
