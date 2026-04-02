import React from "react";

export interface Recipient {
  id: string;
  name: string;
  email: string;
  role: string;
  lockedInCc?: boolean;
}

export interface PermissionSummary {
  permission: { usedHours: number; remainingHours: number; limit: number; pendingRequests: number };
  onDuty: { usedHours: number; remainingHours: number; limit: number; pendingRequests: number };
  wfh: { usedDays: number; remainingDays: number; limit: number; pendingRequests: number };
  forgotCheck: { pendingRequests: number };
}

export interface SummaryType {
  sick: number;
  casual: number;
  plannedRequests: number;
  unplannedRequests: number;
  permissionSummary: PermissionSummary;
}

export interface AttendanceRecord {
  date?: string;
  present?: boolean;
  punchInTime?: string;
  punchOutTime?: string;
}

export interface RequestItem {
  id: string;
  leaveType?: string;
  permissionType?: string;
  requestType?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  days?: number;
  duration?: number | string;
  status: string;
  description?: string;
  reason?: string;
  forgotReason?: string;
  startTime?: string;
  endTime?: string;
  forgotType?: "in" | "out";
  createdAt?: string;
  empIdOrEmail?: string;
  employeeId?: string;
  employeeName?: string;
}

export interface StatBoxProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  progress: number;
  color: string;
  progressBg: string;
  isBalance?: boolean;
  totalLimit?: number;
}

export interface PermissionStatBoxProps {
  type: string;
  label: string;
  used?: number;
  remaining?: number;
  limit?: number;
  unit?: string;
  pending?: number;
  color: string;
  icon: React.ReactNode;
}
