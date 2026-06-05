import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, TOTAL_LIMIT, TOTAL_WORK_DAYS } from "../constants";
import { AttendanceRecord, Recipient, RequestItem, SummaryType } from "../types";
import { calculateDays } from "../utils";
import { buildApplyModalProps } from "./buildApplyModalProps";
import { createHandleSubmitRequest, createResetForm } from "./leaveActions";
import { DEFAULT_EMAIL_RECIPIENTS, getMobileUserSession } from "../../../utils/mobileSession";

const leaveTypes = [
  { value: "sick", label: "Sick Leave" },
  { value: "casual", label: "Casual Leave" },
  { value: "planned", label: "Planned Leave" },
  { value: "unplanned", label: "Unplanned Leave" },
];

export const useLeaveDashboard = () => {
  const [isLoading, setIsLoading] = useState({ summary: true, history: true, attendance: true });
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLeaveHistoryModalOpen, setIsLeaveHistoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeaveDetails, setSelectedLeaveDetails] = useState<RequestItem | null>(null);
  const [isStartDatePickerVisible, setStartDatePickerVisibility] = useState(false);
  const [isEndDatePickerVisible, setEndDatePickerVisibility] = useState(false);
  const [isPermissionDatePickerVisible, setPermissionDatePickerVisibility] = useState(false);
  const [isForgotDatePickerVisible, setForgotDatePickerVisibility] = useState(false);
  const [isStartTimePickerVisible, setStartTimePickerVisibility] = useState(false);
  const [isEndTimePickerVisible, setEndTimePickerVisibility] = useState(false);
  const [isForgotTimePickerVisible, setForgotTimePickerVisibility] = useState(false);
  const [empIdOrEmail, setEmpIdOrEmail] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [extraRecipientEmails, setExtraRecipientEmails] = useState("");
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  const [isCcDropdownOpen, setIsCcDropdownOpen] = useState(false);
  const [allRecipients] = useState<Recipient[]>([...DEFAULT_EMAIL_RECIPIENTS]);
  useEffect(() => {
    const lockedCc = allRecipients.filter((r) => r.lockedInCc).map((r) => r.id);
    setCcRecipients(lockedCc);
  }, [allRecipients]);
  const toggleRecipient = (id: string, type: "to" | "cc") => {
    if (type === "to") {
      setToRecipients((prev) => (prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]));
      return;
    }
    const recipient = allRecipients.find((r) => r.id === id);
    if (recipient?.lockedInCc) return;
    setCcRecipients((prev) => (prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]));
  };
  const getSelectedToRecipients = () => allRecipients.filter((r) => toRecipients.includes(r.id));
  const getSelectedCcRecipients = () => allRecipients.filter((r) => ccRecipients.includes(r.id));

  const [summary, setSummary] = useState<SummaryType>({
    sick: TOTAL_LIMIT,
    casual: TOTAL_LIMIT,
    plannedRequests: 0,
    unplannedRequests: 0,
    permissionSummary: {
      permission: { usedHours: 0, remainingHours: 8, limit: 8, pendingRequests: 0 },
      onDuty: { usedHours: 0, remainingHours: 8, limit: 8, pendingRequests: 0 },
      wfh: { usedDays: 0, remainingDays: 4, limit: 4, pendingRequests: 0 },
      forgotCheck: { pendingRequests: 0 },
    },
  });
  const [userRequests, setUserRequests] = useState<RequestItem[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [requestType, setRequestType] = useState<"leave" | "permission">("leave");
  const [leaveType, setLeaveType] = useState("sick");
  const [permissionType, setPermissionType] = useState<"permission" | "wfh" | "on-duty" | "forgot-check">(
    "permission"
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [permissionDate, setPermissionDate] = useState("");
  const [permissionStartTime, setPermissionStartTime] = useState("");
  const [permissionEndTime, setPermissionEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [durationOption, setDurationOption] = useState<"hours" | "first-half" | "second-half" | "minutes">(
    "hours"
  );
  const [hoursDuration, setHoursDuration] = useState("1");
  const [minutesDuration, setMinutesDuration] = useState("30");
  const [forgotCheckType, setForgotCheckType] = useState<"in" | "out">("in");
  const [forgotDate, setForgotDate] = useState("");
  const [forgotTime, setForgotTime] = useState("");
  const [forgotReason, setForgotReason] = useState("");
  const [editableDays, setEditableDays] = useState("1");
  const [isCalculatingFromDates, setIsCalculatingFromDates] = useState(true);
  const getCurrentEmployeeId = useCallback(async (): Promise<string> => {
    const id = await AsyncStorage.getItem("userEmpId");
    return id || "";
  }, []);

  const calculateSummaryFromRequests = useCallback((requests: RequestItem[]) => {
    let sickUsed = 0;
    let casualUsed = 0;
    let plannedCount = 0;
    let unplannedCount = 0;
    let permissionUsed = 0;
    let onDutyUsed = 0;
    let wfhUsed = 0;
    let permissionPending = 0;
    let onDutyPending = 0;
    let wfhPending = 0;
    let forgotCheckPending = 0;

    requests.forEach((req) => {
      if (req.leaveType) {
        if (req.status === "approved" || req.status === "auto-approved") {
          const days = req.days || 0;
          if (req.leaveType === "sick") sickUsed += days;
          else if (req.leaveType === "casual") casualUsed += days;
        }
        if (req.leaveType === "planned") plannedCount++;
        else if (req.leaveType === "unplanned") unplannedCount++;
      }

      if (req.permissionType) {
        const duration = parseFloat(req.duration as string) || 0;
        const days = req.days || 0;

        if (req.status === "approved" || req.status === "auto-approved") {
          switch (req.permissionType) {
            case "permission":
              permissionUsed += duration;
              break;
            case "on-duty":
              onDutyUsed += duration;
              break;
            case "wfh":
              wfhUsed += days;
              break;
          }
        }

        if (req.status === "pending" || req.status === "manager-pending") {
          switch (req.permissionType) {
            case "permission":
              permissionPending++;
              break;
            case "on-duty":
              onDutyPending++;
              break;
            case "wfh":
              wfhPending++;
              break;
            case "forgot-check":
              forgotCheckPending++;
              break;
          }
        }
      }
    });

    setSummary({
      sick: Math.max(0, TOTAL_LIMIT - sickUsed),
      casual: Math.max(0, TOTAL_LIMIT - casualUsed),
      plannedRequests: plannedCount,
      unplannedRequests: unplannedCount,
      permissionSummary: {
        permission: {
          usedHours: permissionUsed,
          remainingHours: Math.max(0, 8 - permissionUsed),
          limit: 8,
          pendingRequests: permissionPending,
        },
        onDuty: {
          usedHours: onDutyUsed,
          remainingHours: Math.max(0, 8 - onDutyUsed),
          limit: 8,
          pendingRequests: onDutyPending,
        },
        wfh: {
          usedDays: wfhUsed,
          remainingDays: Math.max(0, 4 - wfhUsed),
          limit: 4,
          pendingRequests: wfhPending,
        },
        forgotCheck: { pendingRequests: forgotCheckPending },
      },
    });
  }, []);

  const refreshData = useCallback(async () => {
    const id = await getCurrentEmployeeId();
    if (!id) {
      setIsLoading({ summary: false, history: false, attendance: false });
      return;
    }

    setIsLoading({ summary: true, history: true, attendance: true });

    try {
      const leavesResponse = await fetch(
        `${API_BASE_URL}/api/leaves?empIdOrEmail=${encodeURIComponent(id)}&mode=list`
      );
      let leavesData: RequestItem[] = [];

      if (leavesResponse.ok) {
        const contentType = leavesResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await leavesResponse.json();
          leavesData = Array.isArray(data) ? data : [];
        } else {
          const text = await leavesResponse.text();
          console.error("Leaves API Error (Non-JSON):", text);
        }
      } else {
        const text = await leavesResponse.text();
        console.log("Leaves API error:", leavesResponse.status, text);
      }

      const permissionsResponse = await fetch(
        `${API_BASE_URL}/api/permissions?empIdOrEmail=${encodeURIComponent(id)}&mode=list`
      );
      let permissionsData: RequestItem[] = [];

      if (permissionsResponse.ok) {
        const contentType = permissionsResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await permissionsResponse.json();
          permissionsData = Array.isArray(data) ? data : [];
        } else {
          const text = await permissionsResponse.text();
          console.error("Permissions API Error (Non-JSON):", text);
        }
      } else {
        const text = await permissionsResponse.text();
        console.log("Permissions API error:", permissionsResponse.status, text);
      }

      const allRequests = [
        ...leavesData.map((item) => ({
          ...item,
          id: item.id || item._id || `${item.employeeId || item.empIdOrEmail}-${item.startDate || item.date}`,
          requestType: "leave",
        })),
        ...permissionsData.map((item) => ({
          ...item,
          id: item.id || item._id || `${item.employeeId || item.empIdOrEmail}-${item.startDate || item.date}`,
          requestType: "permission",
        })),
      ].filter((req) => req.empIdOrEmail === id || req.employeeId === id || (req as any).empId === id);

      calculateSummaryFromRequests(allRequests);
      setUserRequests(allRequests);

      const attendanceResponse = await fetch(`${API_BASE_URL}/api/attendance?empId=${encodeURIComponent(id)}`);
      let attendanceData: AttendanceRecord[] = [];

      if (attendanceResponse.ok) {
        const contentType = attendanceResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await attendanceResponse.json();
          attendanceData = data.attendances || data || [];
        } else {
          const text = await attendanceResponse.text();
          console.error("Attendance API Error (Non-JSON):", text);
        }
      }

      setAttendanceList(
        attendanceData.filter((att: any) => (att as any).empId === id || (att as any).employeeId === id)
      );
      setIsLoading({ summary: false, history: false, attendance: false });
    } catch (error) {
      console.error("Error fetching data:", error);
      setIsLoading({ summary: false, history: false, attendance: false });
    }
  }, [getCurrentEmployeeId, calculateSummaryFromRequests]);

  useEffect(() => {
    const init = async () => {
      const session = await getMobileUserSession();
      const id = session.userEmpId;
      const name = session.userName;
      if (id) {
        setEmpIdOrEmail(id);
        setEmployeeName(name || "Employee");
        setEmployeeEmail(session.userEmail || "");
        await refreshData();
      }
    };
    init();
  }, [refreshData]);

  useEffect(() => {
    if (!empIdOrEmail) return;
    const intervalId = setInterval(() => {
      void refreshData();
    }, 20000);

    return () => clearInterval(intervalId);
  }, [empIdOrEmail, refreshData]);

  useEffect(() => {
    if (startDate && endDate && isCalculatingFromDates) {
      const days = calculateDays(startDate, endDate);
      setEditableDays(days.toString());
    }
  }, [startDate, endDate, isCalculatingFromDates]);

  const resetForm = createResetForm({
    setLeaveType,
    setStartDate,
    setEndDate,
    setDescription,
    setRequestType,
    setPermissionType,
    setPermissionDate,
    setPermissionStartTime,
    setPermissionEndTime,
    setDurationOption,
    setHoursDuration,
    setMinutesDuration,
    setForgotCheckType,
    setForgotDate,
    setForgotTime,
    setForgotReason,
    setEditableDays,
    setIsCalculatingFromDates,
  });

  const handleSubmitRequest = createHandleSubmitRequest({
    getCurrentEmployeeId,
    requestType,
    leaveType,
    startDate,
    endDate,
    editableDays,
    description,
    permissionType,
    permissionDate,
    permissionStartTime,
    permissionEndTime,
    durationOption,
    hoursDuration,
    minutesDuration,
    forgotCheckType,
    forgotDate,
    forgotTime,
    forgotReason,
    employeeName,
    employeeEmail,
    allRecipients,
    toRecipients,
    ccRecipients,
    extraRecipientEmails,
    setIsModalOpen,
    resetForm,
    refreshData,
  });

  const filteredRequests = useMemo(() => {
    return userRequests.filter((req) => {
      const searchLower = searchQuery.toLowerCase();
      const type = (req.leaveType || req.permissionType || "").toLowerCase();
      const status = req.status.toLowerCase();
      const descriptionText = (req.description || "").toLowerCase();
      const reason = (req.reason || "").toLowerCase();

      return (
        type.includes(searchLower) ||
        status.includes(searchLower) ||
        descriptionText.includes(searchLower) ||
        reason.includes(searchLower)
      );
    });
  }, [userRequests, searchQuery]);

  const annualStats = useMemo(() => {
    if (isLoading.summary || isLoading.history || isLoading.attendance) {
      return {
        totalTaken: 0,
        presentCount: 0,
        sickTaken: 0,
        casualTaken: 0,
        attendanceProgress: 0,
        leaveImpact: 0,
        sickUsagePercentage: 0,
        casualUsagePercentage: 0,
      };
    }

    const sickTaken = TOTAL_LIMIT - summary.sick;
    const casualTaken = TOTAL_LIMIT - summary.casual;
    const totalTaken = sickTaken + casualTaken;

    const presentCount = attendanceList.filter((a) => a.present).length;

    const attendanceProgress = (presentCount / TOTAL_WORK_DAYS) * 100;
    const leaveImpact = (totalTaken / TOTAL_WORK_DAYS) * 100;
    const sickUsagePercentage = (sickTaken / TOTAL_LIMIT) * 100;
    const casualUsagePercentage = (casualTaken / TOTAL_LIMIT) * 100;

    return {
      totalTaken,
      presentCount,
      sickTaken,
      casualTaken,
      attendanceProgress,
      leaveImpact,
      sickUsagePercentage,
      casualUsagePercentage,
    };
  }, [summary, attendanceList, isLoading]);

  const handleViewLeaveDetails = (req: RequestItem) => {
    setSelectedLeaveDetails(req);
    setIsLeaveHistoryModalOpen(true);
  };

  const isFullyLoading = isLoading.summary && isLoading.history && isLoading.attendance;

  const applyModalProps = buildApplyModalProps(
    {
      isModalOpen,
      isSubmitting: false,
      requestType,
      employeeName,
      empIdOrEmail,
      allRecipients,
      toRecipients,
      ccRecipients,
      extraRecipientEmails,
      isToDropdownOpen,
      isCcDropdownOpen,
      leaveType,
      leaveTypes,
      startDate,
      endDate,
      editableDays,
      description,
      permissionType,
      permissionDate,
      permissionStartTime,
      permissionEndTime,
      durationOption,
      hoursDuration,
      minutesDuration,
      forgotCheckType,
      forgotDate,
      forgotTime,
      forgotReason,
      isStartDatePickerVisible,
      isEndDatePickerVisible,
      isPermissionDatePickerVisible,
      isForgotDatePickerVisible,
      isStartTimePickerVisible,
      isEndTimePickerVisible,
      isForgotTimePickerVisible,
    },
    {
      resetForm,
      onSubmit: handleSubmitRequest,
      onToggleRecipient: toggleRecipient,
      getSelectedToRecipients,
      getSelectedCcRecipients,
      setIsModalOpen,
      setIsToDropdownOpen,
      setIsCcDropdownOpen,
      setLeaveType,
      setRequestType,
      setStartDatePickerVisibility,
      setEndDatePickerVisibility,
      setEditableDays,
      setDescription,
      setIsCalculatingFromDates,
      setPermissionType,
      setPermissionDatePickerVisibility,
      setStartTimePickerVisibility,
      setEndTimePickerVisibility,
      setDurationOption,
      setHoursDuration,
      setMinutesDuration,
      setForgotCheckType,
      setForgotDatePickerVisibility,
      setForgotTimePickerVisibility,
      setForgotReason,
      setExtraRecipientEmails,
      setPermissionDate,
      setPermissionStartTime,
      setPermissionEndTime,
      setStartDate,
      setEndDate,
      setForgotDate,
      setForgotTime,
    }
  );

  const leaveDetailsProps = {
    visible: isLeaveHistoryModalOpen,
    request: selectedLeaveDetails,
    onClose: () => setIsLeaveHistoryModalOpen(false),
  };

  return {
    annualStats,
    applyModalProps,
    employeeName,
    filteredRequests,
    isFullyLoading,
    isLoading,
    leaveDetailsProps,
    leaveTypes,
    refreshing,
    searchQuery,
    setIsModalOpen,
    setRefreshing,
    setSearchQuery,
    summary,
    handleViewLeaveDetails,
    refreshData,
  };
};
