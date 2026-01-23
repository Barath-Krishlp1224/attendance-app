import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import {
  History as HistoryIcon,
  CalendarDays,
  Plus,
  X,
  Activity,
  Target,
  UserCheck,
  TrendingUp,
  Filter,
  ChevronRight,
  Home,
  Briefcase,
  Clock,
  AlertCircle,
  Shield,
  Edit2,
  Clock4,
  CheckSquare,
  Thermometer,
  Plane,
  Calendar,
  Zap,
  ShieldCheck,
  HomeIcon,
  BriefcaseBusiness,
  Clock3,
  CheckCircle,
  Power,
  User,
  Navigation,
  ChevronDown,
  Search
} from "lucide-react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const API_BASE_URL = 'https://lemonpay-portal.vercel.app/';
const ANNUAL_TOTAL = 24;
const TOTAL_WORK_DAYS = 320;
const TOTAL_LIMIT = 12;

interface PermissionSummary {
  permission: { usedHours: number; remainingHours: number; limit: number; pendingRequests: number };
  onDuty: { usedHours: number; remainingHours: number; limit: number; pendingRequests: number };
  wfh: { usedDays: number; remainingDays: number; limit: number; pendingRequests: number };
  forgotCheck: { pendingRequests: number };
}

interface SummaryType {
  sick: number;
  casual: number;
  plannedRequests: number;
  unplannedRequests: number;
  permissionSummary: PermissionSummary;
}

interface AttendanceRecord {
  date?: string;
  present?: boolean;
  punchInTime?: string;
  punchOutTime?: string;
}

interface RequestItem {
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
  forgotType?: 'in' | 'out';
  createdAt?: string;
  empIdOrEmail?: string;
  employeeId?: string;
  employeeName?: string;
}

interface StatBoxProps {
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

interface PermissionStatBoxProps {
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

const formatTime = (timeStr?: string) => {
  if (!timeStr) return "--:--";
  const date = new Date(timeStr);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
};

const StatBox: React.FC<StatBoxProps> = ({ icon, label, value, sub, progress, color, isBalance = false, totalLimit = 0 }) => (
  <View style={[styles.statBox, styles.shadowSm]}>
    <View style={styles.statHeader}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
        {icon}
      </View>
      <View style={styles.statTextContainer}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statSub}>{sub}</Text>
      </View>
    </View>
    <View style={styles.statContent}>
      <Text style={styles.statValue}>
        {isBalance ? `${value} / ${totalLimit}` : value}
      </Text>
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { backgroundColor: color, width: `${Math.min(progress, 100)}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{progress.toFixed(1)}%</Text>
      </View>
    </View>
  </View>
);

const PermissionStatBox: React.FC<PermissionStatBoxProps> = ({ 
  type, 
  label, 
  used = 0, 
  remaining = 0, 
  limit = 0, 
  unit = "hours", 
  pending = 0, 
  color, 
  icon 
}) => {
  const progress = limit > 0 ? (used / limit) * 100 : 0;
  
  return (
    <View style={[styles.statBox, styles.shadowSm]}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
          {icon}
        </View>
        <View style={styles.statTextContainer}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statSub}>
            {limit > 0 ? `${unit} remaining` : `${pending} pending`}
          </Text>
        </View>
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>
          {limit > 0 ? `${remaining} / ${limit}` : pending}
        </Text>
        {limit > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { backgroundColor: color, width: `${Math.min(progress, 100)}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>{progress.toFixed(1)}% used</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const StatBoxSkeleton = () => (
  <View style={[styles.statBox, styles.shadowSm]}>
    <View style={styles.statHeader}>
      <View style={[styles.statIconContainer, styles.skeletonBg]}>
        <View style={[styles.skeleton, { width: 20, height: 20 }]} />
      </View>
      <View style={styles.statTextContainer}>
        <View style={[styles.skeleton, { width: 60, height: 14, marginBottom: 4 }]} />
        <View style={[styles.skeleton, { width: 50, height: 12 }]} />
      </View>
    </View>
    <View style={styles.statContent}>
      <View style={[styles.skeleton, { width: 40, height: 28, marginBottom: 12 }]} />
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, styles.skeletonBg]}>
          <View style={[styles.skeleton, { width: '50%', height: '100%' }]} />
        </View>
        <View style={[styles.skeleton, { width: 30, height: 12 }]} />
      </View>
    </View>
  </View>
);

const LeaveDashboard = () => {
  const [isLoading, setIsLoading] = useState({
    summary: true,
    history: true,
    attendance: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const [summary, setSummary] = useState<SummaryType>({ 
    sick: TOTAL_LIMIT, 
    casual: TOTAL_LIMIT, 
    plannedRequests: 0, 
    unplannedRequests: 0,
    permissionSummary: {
      permission: { usedHours: 0, remainingHours: 8, limit: 8, pendingRequests: 0 },
      onDuty: { usedHours: 0, remainingHours: 8, limit: 8, pendingRequests: 0 },
      wfh: { usedDays: 0, remainingDays: 4, limit: 4, pendingRequests: 0 },
      forgotCheck: { pendingRequests: 0 }
    }
  });
  const [userRequests, setUserRequests] = useState<RequestItem[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const [requestType, setRequestType] = useState<"leave" | "permission">("leave");
  const [leaveType, setLeaveType] = useState("sick");
  const [permissionType, setPermissionType] = useState("permission");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [permissionDate, setPermissionDate] = useState("");
  const [permissionStartTime, setPermissionStartTime] = useState("");
  const [permissionEndTime, setPermissionEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [durationOption, setDurationOption] = useState<"hours" | "first-half" | "second-half" | "minutes">("hours");
  const [hoursDuration, setHoursDuration] = useState("1");
  const [minutesDuration, setMinutesDuration] = useState("30");
  const [forgotCheckType, setForgotCheckType] = useState<"in" | "out">("in");
  const [forgotDate, setForgotDate] = useState("");
  const [forgotTime, setForgotTime] = useState("");
  const [forgotReason, setForgotReason] = useState("");
  const [editableDays, setEditableDays] = useState("1");
  const [isCalculatingFromDates, setIsCalculatingFromDates] = useState(true);

  const leaveTypes = [
    { value: "sick", label: "Sick Leave" },
    { value: "casual", label: "Casual Leave" },
    { value: "planned", label: "Planned Leave" },
    { value: "unplanned", label: "Unplanned Leave" }
  ];

  const permissionTypes = [
    { value: "permission", label: "Permission", icon: <ShieldCheck size={20} color="#2563eb" /> },
    { value: "wfh", label: "Work From Home", icon: <HomeIcon size={20} color="#8b5cf6" /> },
    { value: "on-duty", label: "On Duty", icon: <BriefcaseBusiness size={20} color="#10b981" /> },
    { value: "forgot-check", label: "Forgot Check", icon: <Clock3 size={20} color="#f59e0b" /> }
  ];

  const getCurrentEmployeeId = useCallback(async (): Promise<string> => {
    const id = await AsyncStorage.getItem("userEmpId");
    return id || "";
  }, []);

  const calculateSummaryFromRequests = useCallback((requests: RequestItem[]) => {
    const newSummary: SummaryType = {
      sick: TOTAL_LIMIT,
      casual: TOTAL_LIMIT,
      plannedRequests: 0,
      unplannedRequests: 0,
      permissionSummary: {
        permission: { usedHours: 0, remainingHours: 8, limit: 8, pendingRequests: 0 },
        onDuty: { usedHours: 0, remainingHours: 8, limit: 8, pendingRequests: 0 },
        wfh: { usedDays: 0, remainingDays: 4, limit: 4, pendingRequests: 0 },
        forgotCheck: { pendingRequests: 0 }
      }
    };

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

    requests.forEach(req => {
      if (req.leaveType) {
        if (req.status === 'approved' || req.status === 'auto-approved') {
          const days = req.days || 0;
          if (req.leaveType === 'sick') {
            sickUsed += days;
          } else if (req.leaveType === 'casual') {
            casualUsed += days;
          }
        }
        if (req.leaveType === 'planned') {
          plannedCount++;
        } else if (req.leaveType === 'unplanned') {
          unplannedCount++;
        }
      }

      if (req.permissionType) {
        const duration = parseFloat(req.duration as string) || 0;
        const days = req.days || 0;
        
        if (req.status === 'approved' || req.status === 'auto-approved') {
          switch(req.permissionType) {
            case 'permission':
              permissionUsed += duration;
              break;
            case 'on-duty':
              onDutyUsed += duration;
              break;
            case 'wfh':
              wfhUsed += days;
              break;
          }
        }
        
        if (req.status === 'pending' || req.status === 'manager-pending') {
          switch(req.permissionType) {
            case 'permission':
              permissionPending++;
              break;
            case 'on-duty':
              onDutyPending++;
              break;
            case 'wfh':
              wfhPending++;
              break;
            case 'forgot-check':
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
          pendingRequests: permissionPending 
        },
        onDuty: { 
          usedHours: onDutyUsed, 
          remainingHours: Math.max(0, 8 - onDutyUsed), 
          limit: 8, 
          pendingRequests: onDutyPending 
        },
        wfh: { 
          usedDays: wfhUsed, 
          remainingDays: Math.max(0, 4 - wfhUsed), 
          limit: 4, 
          pendingRequests: wfhPending 
        },
        forgotCheck: { pendingRequests: forgotCheckPending }
      }
    });
  }, []);

  const refreshData = useCallback(async () => {
    const id = await getCurrentEmployeeId();
    if (!id) {
      setIsLoading({
        summary: false,
        history: false,
        attendance: false
      });
      return;
    }
    
    setIsLoading({
      summary: true,
      history: true,
      attendance: true
    });

    try {
      // Fetch leaves data
      const leavesResponse = await fetch(`${API_BASE_URL}/api/leaves?empIdOrEmail=${encodeURIComponent(id)}&mode=list`);
      let leavesData: RequestItem[] = [];
      
      if (leavesResponse.ok) {
        const data = await leavesResponse.json();
        leavesData = Array.isArray(data) ? data : [];
      } else {
        console.log("Leaves API error:", leavesResponse.status);
      }

      // Fetch permissions data
      const permissionsResponse = await fetch(`${API_BASE_URL}/api/permissions?empIdOrEmail=${encodeURIComponent(id)}&mode=list`);
      let permissionsData: RequestItem[] = [];
      
      if (permissionsResponse.ok) {
        const data = await permissionsResponse.json();
        permissionsData = Array.isArray(data) ? data : [];
      } else {
        console.log("Permissions API error:", permissionsResponse.status);
      }

      // Combine both leave and permission requests
      const allRequests = [
        ...leavesData.map(item => ({ ...item, requestType: 'leave' })),
        ...permissionsData.map(item => ({ ...item, requestType: 'permission' }))
      ].filter(req => 
        req.empIdOrEmail === id || 
        req.employeeId === id ||
        (req as any).empId === id
      );

      console.log("Fetched requests:", allRequests.length, "leaves:", leavesData.length, "permissions:", permissionsData.length);

      // Calculate summary from all requests
      calculateSummaryFromRequests(allRequests);
      setUserRequests(allRequests);
      
      // Fetch attendance data
      const attendanceResponse = await fetch(`${API_BASE_URL}/api/attendance?empId=${encodeURIComponent(id)}`);
      let attendanceData: AttendanceRecord[] = [];

      if (attendanceResponse.ok) {
        const data = await attendanceResponse.json();
        attendanceData = data.attendances || data || [];
      }

      setAttendanceList(attendanceData.filter((att: any) => 
        (att as any).empId === id || (att as any).employeeId === id
      ));

      setIsLoading({
        summary: false,
        history: false,
        attendance: false
      });
    } catch (error) { 
      console.error("Error fetching data:", error);
      setIsLoading({
        summary: false,
        history: false,
        attendance: false
      });
    }
  }, [getCurrentEmployeeId, calculateSummaryFromRequests]);

  useEffect(() => {
    const init = async () => {
      const id = await AsyncStorage.getItem("userEmpId");
      const name = await AsyncStorage.getItem("userName");
      if (id) {
        setEmpIdOrEmail(id);
        setEmployeeName(name || "Employee");
        await refreshData();
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (startDate && endDate && isCalculatingFromDates) {
      const days = calculateDays(startDate, endDate);
      setEditableDays(days.toString());
    }
  }, [startDate, endDate, isCalculatingFromDates]);

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const calculateTimeDuration = (startTime: string, endTime: string) => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    let durationMinutes = endTotalMinutes - startTotalMinutes;
    if (durationMinutes < 0) {
      durationMinutes += 24 * 60;
    }
    
    return (durationMinutes / 60).toFixed(1);
  };

  const getFinalDuration = () => {
    switch (durationOption) {
      case "hours":
        return parseFloat(hoursDuration).toFixed(1);
      case "first-half":
        return "4.0";
      case "second-half":
        return "4.0";
      case "minutes":
        return (parseFloat(minutesDuration) / 60).toFixed(1);
      default:
        return "1.0";
    }
  };

  const handleSubmitRequest = async () => {
    const employeeId = await getCurrentEmployeeId();
    if (!employeeId) {
      Alert.alert("Error", "Please log in to submit requests");
      return;
    }

    if (requestType === "leave") {
      if (!startDate) {
        Alert.alert("Error", "Please select a start date");
        return;
      }
      
      const days = editableDays && parseFloat(editableDays) > 0 ? parseFloat(editableDays) : calculateDays(startDate, endDate || startDate);
      
      const leaveData = {
        empIdOrEmail: employeeId,
        leaveType,
        startDate,
        endDate: endDate || startDate,
        days: days,
        description,
        status: "pending",
        employeeId: employeeId,
        employeeName: employeeName
      };

      try {
        const response = await fetch(`${API_BASE_URL}/api/leaves`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(leaveData)
        });

        if (response.ok) {
          Alert.alert("Success", "Leave request submitted successfully!");
          setIsModalOpen(false);
          resetForm();
          refreshData();
        } else {
          const error = await response.json();
          Alert.alert("Error", error.error || "Failed to submit leave request");
        }
      } catch (error) {
        console.error('Error submitting leave request:', error);
        Alert.alert("Error", "An error occurred. Please try again.");
      }
    } else {
      let permissionData: any = {
        empIdOrEmail: employeeId,
        requestType: "permission",
        permissionType,
        employeeId: employeeId,
        employeeName: employeeName,
        status: "pending"
      };

      const finalDuration = getFinalDuration();

      if (permissionType === "permission") {
        if (!permissionDate) {
          Alert.alert("Error", "Please select date for permission");
          return;
        }
        
        permissionData = {
          ...permissionData,
          date: permissionDate,
          startTime: permissionStartTime || "09:00",
          endTime: permissionEndTime || "10:00",
          duration: finalDuration,
          reason: description,
          description
        };
      } else if (permissionType === "wfh") {
        if (!startDate || !endDate) {
          Alert.alert("Error", "Please select date range for WFH");
          return;
        }
        
        permissionData = {
          ...permissionData,
          startDate,
          endDate,
          days: editableDays || calculateDays(startDate, endDate),
          reason: description,
          description
        };
      } else if (permissionType === "on-duty") {
        if (!permissionDate) {
          Alert.alert("Error", "Please select date for On Duty");
          return;
        }
        
        permissionData = {
          ...permissionData,
          date: permissionDate,
          time: permissionStartTime || "09:00",
          duration: finalDuration,
          reason: description,
          description
        };
      } else if (permissionType === "forgot-check") {
        if (!forgotDate || !forgotTime) {
          Alert.alert("Error", "Please select date and time for forgot check");
          return;
        }
        
        permissionData = {
          ...permissionData,
          date: forgotDate,
          time: forgotTime,
          forgotType: forgotCheckType,
          forgotReason: forgotReason || description,
          reason: description,
          description
        };
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/permissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(permissionData)
        });

        if (response.ok) {
          Alert.alert(
            "Success", 
            `${permissionType.charAt(0).toUpperCase() + permissionType.slice(1)} request submitted successfully!`
          );
          setIsModalOpen(false);
          resetForm();
          refreshData();
        } else {
          const error = await response.json();
          Alert.alert("Error", error.error || "Failed to submit permission request");
        }
      } catch (error) {
        console.error('Error submitting permission request:', error);
        Alert.alert("Error", "An error occurred. Please try again.");
      }
    }
  };

  const resetForm = () => {
    setLeaveType("sick");
    setStartDate("");
    setEndDate("");
    setDescription("");
    setRequestType("leave");
    setPermissionType("permission");
    setPermissionDate("");
    setPermissionStartTime("");
    setPermissionEndTime("");
    setDurationOption("hours");
    setHoursDuration("1");
    setMinutesDuration("30");
    setForgotCheckType("in");
    setForgotDate("");
    setForgotTime("");
    setForgotReason("");
    setEditableDays("1");
    setIsCalculatingFromDates(true);
  };

  const filteredRequests = useMemo(() => {
    return userRequests.filter(req => {
      const searchLower = searchQuery.toLowerCase();
      const type = (req.leaveType || req.permissionType || '').toLowerCase();
      const status = req.status.toLowerCase();
      const descriptionText = (req.description || '').toLowerCase();
      const reason = (req.reason || '').toLowerCase();
      
      return type.includes(searchLower) || 
             status.includes(searchLower) ||
             descriptionText.includes(searchLower) ||
             reason.includes(searchLower);
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
        casualUsagePercentage: 0
      };
    }
    
    const sickTaken = TOTAL_LIMIT - summary.sick;
    const casualTaken = TOTAL_LIMIT - summary.casual;
    const totalTaken = sickTaken + casualTaken;
    
    const presentCount = attendanceList.filter(a => a.present).length;
    
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
      casualUsagePercentage
    };
  }, [summary, attendanceList, isLoading]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sick': return <Thermometer size={20} color="#dc2626" />;
      case 'casual': return <Plane size={20} color="#059669" />;
      case 'planned': return <Calendar size={20} color="#2563eb" />;
      case 'unplanned': return <Zap size={20} color="#d97706" />;
      case 'permission': return <ShieldCheck size={20} color="#2563eb" />;
      case 'wfh': return <HomeIcon size={20} color="#8b5cf6" />;
      case 'on-duty': return <BriefcaseBusiness size={20} color="#10b981" />;
      case 'forgot-check': return <Clock3 size={20} color="#f59e0b" />;
      default: return <CalendarDays size={20} color="#64748b" />;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'approved':
      case 'auto-approved':
        return { backgroundColor: '#dcfce7', borderColor: '#86efac', color: '#166534' };
      case 'rejected':
        return { backgroundColor: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' };
      case 'pending':
        return { backgroundColor: '#fef9c3', borderColor: '#fde047', color: '#854d0e' };
      case 'manager-pending':
        return { backgroundColor: '#dbeafe', borderColor: '#93c5fd', color: '#1e40af' };
      default:
        return { backgroundColor: '#f3f4f6', borderColor: '#d1d5db', color: '#374151' };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'auto-approved':
        return 'Auto Approved';
      case 'rejected':
        return 'Rejected';
      case 'pending':
        return 'Pending TL Review';
      case 'manager-pending':
        return 'Pending Manager Review';
      default:
        return status;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const handleViewLeaveDetails = (req: RequestItem) => {
    setSelectedLeaveDetails(req);
    setIsLeaveHistoryModalOpen(true);
  };

  const renderRequestItem = ({ item, index }: { item: RequestItem; index: number }) => {
    const statusStyle = getStatusBadgeStyle(item.status);
    const type = item.leaveType || item.permissionType || 'default';
    
    return (
      <TouchableOpacity 
        key={index}
        style={styles.requestCard}
        onPress={() => handleViewLeaveDetails(item)}
      >
        <View style={styles.requestHeader}>
          <View style={[styles.requestTypeIcon, 
            item.leaveType === 'sick' ? { backgroundColor: '#fee2e2' } :
            item.leaveType === 'casual' ? { backgroundColor: '#d1fae5' } :
            item.permissionType === 'wfh' ? { backgroundColor: '#ede9fe' } :
            item.permissionType === 'on-duty' ? { backgroundColor: '#d1fae5' } :
            { backgroundColor: '#f3f4f6' }
          ]}>
            {getTypeIcon(type)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.requestTypeText}>
              {(item.leaveType || item.permissionType || 'Unknown')?.toUpperCase()}
            </Text>
            <Text style={styles.requestTypeSub}>
              {item.requestType || (item.leaveType ? 'Leave' : 'Permission')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.backgroundColor, borderColor: statusStyle.borderColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
        
        <View style={styles.requestDetails}>
          <View style={styles.requestDateContainer}>
            <Calendar size={14} color="#64748b" />
            <Text style={styles.requestDateText}>
              {item.startDate ? (
                <>
                  {formatDate(item.startDate)}
                  {item.endDate && item.endDate !== item.startDate && ` - ${formatDate(item.endDate)}`}
                </>
              ) : item.date ? (
                formatDate(item.date)
              ) : 'N/A'}
            </Text>
          </View>
          
          <View style={styles.requestDurationContainer}>
            <Clock size={14} color="#2563eb" />
            <Text style={styles.requestDuration}>
              {item.days ? `${item.days} Days` : 
               item.duration ? `${item.duration} Hours` : 
               item.forgotType === 'in' ? 'Check-in' : 'Check-out'}
            </Text>
          </View>
        </View>
        
        {item.description && (
          <Text style={styles.requestDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.requestFooter}>
          <Text style={styles.viewDetailsText}>
            View Details
          </Text>
          <ChevronRight size={16} color="#2563eb" />
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading.summary && isLoading.history && isLoading.attendance) {
    return (
      <View style={styles.centeredFull}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 16, color: '#64748b' }}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Leave & Permission Dashboard</Text>
            <Text style={styles.headerSubtitle}>Welcome back, {employeeName}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{employeeName}</Text>
              <Text style={styles.userEmpId}>ID: {empIdOrEmail}</Text>
            </View>
            <TouchableOpacity style={styles.avatar}>
              <User size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
        {/* Stats Cards Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Leave Balance & Stats</Text>
          <View style={styles.statsGrid}>
            {isLoading.summary ? (
              Array.from({ length: 5 }).map((_, index) => (
                <StatBoxSkeleton key={index} />
              ))
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
          
          {/* Permission Stats */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Permission Summary</Text>
          <View style={styles.statsGrid}>
            {!isLoading.summary && (
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

        {/* Leave & Permission History */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <View style={styles.historyTitleContainer}>
              <View style={styles.historyIcon}>
                <HistoryIcon size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.historyTitle}>Leave & Permission History</Text>
                <Text style={styles.historySubtitle}>Track all your requests</Text>
              </View>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={14} color="#64748b" />
              <TextInput 
                placeholder="Search..." 
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {isLoading.history ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : filteredRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <CalendarDays size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No requests found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search term' : 'Submit your first leave or permission request'}
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {filteredRequests
                .sort((a, b) => {
                  const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.startDate || a.date || 0);
                  const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.startDate || b.date || 0);
                  return dateB.getTime() - dateA.getTime();
                })
                .map((item, index) => renderRequestItem({ item, index }))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Apply Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setIsModalOpen(true)}
      >
        <Plus size={24} color="#fff" />
        <Text style={styles.fabText}>Apply</Text>
      </TouchableOpacity>

      {/* Apply Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply Leave/Permission</Text>
              <TouchableOpacity 
                onPress={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
              >
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Employee Info */}
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{employeeName}</Text>
                <Text style={styles.employeeId}>ID: {empIdOrEmail}</Text>
              </View>

              {/* Request Type Selection */}
              <View style={styles.requestTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.requestTypeButton,
                    requestType === "leave" && styles.requestTypeButtonActive
                  ]}
                  onPress={() => setRequestType("leave")}
                >
                  <Text style={[
                    styles.requestTypeButtonText,
                    requestType === "leave" && styles.requestTypeButtonTextActive
                  ]}>
                    Leave Request
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.requestTypeButton,
                    requestType === "permission" && styles.requestTypeButtonActive
                  ]}
                  onPress={() => setRequestType("permission")}
                >
                  <Text style={[
                    styles.requestTypeButtonText,
                    requestType === "permission" && styles.requestTypeButtonTextActive
                  ]}>
                    Permission
                  </Text>
                </TouchableOpacity>
              </View>

              {requestType === "leave" ? (
                // Leave Request Form
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Leave Type</Text>
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerText}>
                      {leaveTypes.find(lt => lt.value === leaveType)?.label || "Select Leave Type"}
                    </Text>
                    <ChevronDown size={20} color="#64748b" />
                  </View>
                  <View style={styles.leaveTypeOptions}>
                    {leaveTypes.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.leaveTypeOption,
                          leaveType === type.value && styles.leaveTypeOptionActive
                        ]}
                        onPress={() => setLeaveType(type.value)}
                      >
                        <Text style={[
                          styles.leaveTypeOptionText,
                          leaveType === type.value && styles.leaveTypeOptionTextActive
                        ]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.dateRow}>
                    <View style={styles.dateInputContainer}>
                      <Text style={styles.formLabel}>From Date</Text>
                      <TouchableOpacity 
                        style={styles.dateInput}
                        onPress={() => setStartDatePickerVisibility(true)}
                      >
                        <Text style={styles.dateInputText}>
                          {startDate || "Select Date"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.dateInputContainer}>
                      <Text style={styles.formLabel}>To Date</Text>
                      <TouchableOpacity 
                        style={styles.dateInput}
                        onPress={() => setEndDatePickerVisibility(true)}
                      >
                        <Text style={styles.dateInputText}>
                          {endDate || "Select Date"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.formLabel}>Duration (Days)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editableDays}
                    onChangeText={(text) => {
                      setEditableDays(text);
                      setIsCalculatingFromDates(false);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="Enter days"
                    placeholderTextColor="#94a3b8"
                  />
                  {startDate && endDate && (
                    <Text style={styles.durationHint}>
                      Calculated: {calculateDays(startDate, endDate)} days
                    </Text>
                  )}

                  <Text style={styles.formLabel}>Reason</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Reason for leave..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              ) : (
                // Permission Request Form
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Permission Type</Text>
                  <View style={styles.permissionTypeGrid}>
                    {permissionTypes.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.permissionTypeButton,
                          permissionType === type.value && styles.permissionTypeButtonActive
                        ]}
                        onPress={() => setPermissionType(type.value)}
                      >
                        <View style={[
                          styles.permissionTypeIcon,
                          permissionType === type.value && styles.permissionTypeIconActive
                        ]}>
                          {type.icon}
                        </View>
                        <Text style={[
                          styles.permissionTypeText,
                          permissionType === type.value && styles.permissionTypeTextActive
                        ]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {permissionType === "permission" && (
                    <>
                      <Text style={styles.formLabel}>Date</Text>
                      <TouchableOpacity 
                        style={styles.dateInput}
                        onPress={() => setPermissionDatePickerVisibility(true)}
                      >
                        <Text style={styles.dateInputText}>
                          {permissionDate || "Select Date"}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.dateRow}>
                        <View style={styles.timeInputContainer}>
                          <Text style={styles.formLabel}>From Time</Text>
                          <TouchableOpacity 
                            style={styles.timeInput}
                            onPress={() => setStartTimePickerVisibility(true)}
                          >
                            <Text style={styles.timeInputText}>
                              {permissionStartTime || "09:00"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.timeInputContainer}>
                          <Text style={styles.formLabel}>To Time</Text>
                          <TouchableOpacity 
                            style={styles.timeInput}
                            onPress={() => setEndTimePickerVisibility(true)}
                          >
                            <Text style={styles.timeInputText}>
                              {permissionEndTime || "10:00"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.formLabel}>Duration</Text>
                      <View style={styles.durationOptions}>
                        {["hours", "first-half", "second-half", "minutes"].map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.durationOption,
                              durationOption === option && styles.durationOptionActive
                            ]}
                            onPress={() => setDurationOption(option as any)}
                          >
                            <Text style={[
                              styles.durationOptionText,
                              durationOption === option && styles.durationOptionTextActive
                            ]}>
                              {option === "first-half" ? "First Half" :
                               option === "second-half" ? "Second Half" :
                               option === "minutes" ? "Minutes" : "Hours"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {durationOption === "hours" && (
                        <>
                          <TextInput
                            style={styles.textInput}
                            value={hoursDuration}
                            onChangeText={setHoursDuration}
                            keyboardType="decimal-pad"
                            placeholder="Enter hours"
                            placeholderTextColor="#94a3b8"
                          />
                          <View style={styles.quickHours}>
                            {["0.5", "1", "2", "3", "4"].map((hour) => (
                              <TouchableOpacity
                                key={hour}
                                style={styles.quickHourButton}
                                onPress={() => setHoursDuration(hour)}
                              >
                                <Text style={styles.quickHourText}>{hour}h</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      {durationOption === "minutes" && (
                        <>
                          <TextInput
                            style={styles.textInput}
                            value={minutesDuration}
                            onChangeText={setMinutesDuration}
                            keyboardType="numeric"
                            placeholder="Enter minutes"
                            placeholderTextColor="#94a3b8"
                          />
                          <View style={styles.quickMinutes}>
                            {["15", "30", "45", "60", "90", "120"].map((min) => (
                              <TouchableOpacity
                                key={min}
                                style={styles.quickMinuteButton}
                                onPress={() => setMinutesDuration(min)}
                              >
                                <Text style={styles.quickMinuteText}>{min}m</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                    </>
                  )}

                  {permissionType === "wfh" && (
                    <>
                      <View style={styles.dateRow}>
                        <View style={styles.dateInputContainer}>
                          <Text style={styles.formLabel}>From Date</Text>
                          <TouchableOpacity 
                            style={styles.dateInput}
                            onPress={() => setStartDatePickerVisibility(true)}
                          >
                            <Text style={styles.dateInputText}>
                              {startDate || "Select Date"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.dateInputContainer}>
                          <Text style={styles.formLabel}>To Date</Text>
                          <TouchableOpacity 
                            style={styles.dateInput}
                            onPress={() => setEndDatePickerVisibility(true)}
                          >
                            <Text style={styles.dateInputText}>
                              {endDate || "Select Date"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.formLabel}>Duration (Days)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editableDays}
                        onChangeText={(text) => {
                          setEditableDays(text);
                          setIsCalculatingFromDates(false);
                        }}
                        keyboardType="decimal-pad"
                        placeholder="Enter days"
                        placeholderTextColor="#94a3b8"
                      />
                    </>
                  )}

                  {permissionType === "on-duty" && (
                    <>
                      <Text style={styles.formLabel}>Date</Text>
                      <TouchableOpacity 
                        style={styles.dateInput}
                        onPress={() => setPermissionDatePickerVisibility(true)}
                      >
                        <Text style={styles.dateInputText}>
                          {permissionDate || "Select Date"}
                        </Text>
                      </TouchableOpacity>

                      <Text style={styles.formLabel}>Time</Text>
                      <TouchableOpacity 
                        style={styles.timeInput}
                        onPress={() => setStartTimePickerVisibility(true)}
                      >
                        <Text style={styles.timeInputText}>
                          {permissionStartTime || "09:00"}
                        </Text>
                      </TouchableOpacity>

                      <Text style={styles.formLabel}>Duration</Text>
                      <View style={styles.durationOptions}>
                        {["hours", "first-half", "second-half"].map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.durationOption,
                              durationOption === option && styles.durationOptionActive
                            ]}
                            onPress={() => setDurationOption(option as any)}
                          >
                            <Text style={[
                              styles.durationOptionText,
                              durationOption === option && styles.durationOptionTextActive
                            ]}>
                              {option === "first-half" ? "First Half" :
                               option === "second-half" ? "Second Half" : "Hours"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {permissionType === "forgot-check" && (
                    <>
                      <View style={styles.forgotTypeSelector}>
                        <TouchableOpacity
                          style={[
                            styles.forgotTypeButton,
                            forgotCheckType === "in" && styles.forgotTypeButtonActive
                          ]}
                          onPress={() => setForgotCheckType("in")}
                        >
                          <Text style={[
                            styles.forgotTypeButtonText,
                            forgotCheckType === "in" && styles.forgotTypeButtonTextActive
                          ]}>
                            Forgot Check-in
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.forgotTypeButton,
                            forgotCheckType === "out" && styles.forgotTypeButtonActive
                          ]}
                          onPress={() => setForgotCheckType("out")}
                        >
                          <Text style={[
                            styles.forgotTypeButtonText,
                            forgotCheckType === "out" && styles.forgotTypeButtonTextActive
                          ]}>
                            Forgot Check-out
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.dateRow}>
                        <View style={styles.dateInputContainer}>
                          <Text style={styles.formLabel}>Date</Text>
                          <TouchableOpacity 
                            style={styles.dateInput}
                            onPress={() => setForgotDatePickerVisibility(true)}
                          >
                            <Text style={styles.dateInputText}>
                              {forgotDate || "Select Date"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.dateInputContainer}>
                          <Text style={styles.formLabel}>Time</Text>
                          <TouchableOpacity 
                            style={styles.timeInput}
                            onPress={() => setForgotTimePickerVisibility(true)}
                          >
                            <Text style={styles.timeInputText}>
                              {forgotTime || "Select Time"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.formLabel}>Reason</Text>
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        value={forgotReason}
                        onChangeText={setForgotReason}
                        placeholder={`Reason for forgetting to check-${forgotCheckType}...`}
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    </>
                  )}

                  {(permissionType === "permission" || permissionType === "on-duty" || permissionType === "wfh") && (
                    <>
                      <Text style={styles.formLabel}>Reason</Text>
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder={`Reason for ${permissionType}...`}
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    </>
                  )}
                </View>
              )}

              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleSubmitRequest}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {requestType === "leave" ? "Submit Leave Request" : "Submit Permission Request"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Date Pickers */}
        <DateTimePickerModal
          isVisible={isStartDatePickerVisible}
          mode="date"
          onConfirm={(date) => {
            setStartDate(date.toISOString().split('T')[0]);
            setStartDatePickerVisibility(false);
          }}
          onCancel={() => setStartDatePickerVisibility(false)}
          minimumDate={new Date()}
        />

        <DateTimePickerModal
          isVisible={isEndDatePickerVisible}
          mode="date"
          onConfirm={(date) => {
            setEndDate(date.toISOString().split('T')[0]);
            setEndDatePickerVisibility(false);
          }}
          onCancel={() => setEndDatePickerVisibility(false)}
          minimumDate={startDate ? new Date(startDate) : new Date()}
        />

        <DateTimePickerModal
          isVisible={isPermissionDatePickerVisible}
          mode="date"
          onConfirm={(date) => {
            setPermissionDate(date.toISOString().split('T')[0]);
            setPermissionDatePickerVisibility(false);
          }}
          onCancel={() => setPermissionDatePickerVisibility(false)}
          minimumDate={new Date()}
        />

        <DateTimePickerModal
          isVisible={isForgotDatePickerVisible}
          mode="date"
          onConfirm={(date) => {
            setForgotDate(date.toISOString().split('T')[0]);
            setForgotDatePickerVisibility(false);
          }}
          onCancel={() => setForgotDatePickerVisibility(false)}
          maximumDate={new Date()}
        />

        <DateTimePickerModal
          isVisible={isStartTimePickerVisible}
          mode="time"
          onConfirm={(time) => {
            setPermissionStartTime(time.toTimeString().split(' ')[0].substring(0, 5));
            setStartTimePickerVisibility(false);
          }}
          onCancel={() => setStartTimePickerVisibility(false)}
        />

        <DateTimePickerModal
          isVisible={isEndTimePickerVisible}
          mode="time"
          onConfirm={(time) => {
            setPermissionEndTime(time.toTimeString().split(' ')[0].substring(0, 5));
            setEndTimePickerVisibility(false);
          }}
          onCancel={() => setEndTimePickerVisibility(false)}
        />

        <DateTimePickerModal
          isVisible={isForgotTimePickerVisible}
          mode="time"
          onConfirm={(time) => {
            setForgotTime(time.toTimeString().split(' ')[0].substring(0, 5));
            setForgotTimePickerVisibility(false);
          }}
          onCancel={() => setForgotTimePickerVisibility(false)}
        />
      </Modal>

      {/* Leave Details Modal */}
      <Modal
        visible={isLeaveHistoryModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLeaveHistoryModalOpen(false)}
      >
        <View style={styles.detailsModalContainer}>
          <View style={styles.detailsModalContent}>
            <View style={styles.detailsModalHeader}>
              <Text style={styles.detailsModalTitle}>Request Details</Text>
              <TouchableOpacity onPress={() => setIsLeaveHistoryModalOpen(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedLeaveDetails && (
              <ScrollView style={styles.detailsModalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Request Type</Text>
                    <Text style={styles.detailValue}>
                      {selectedLeaveDetails.leaveType ? 
                        `Leave - ${selectedLeaveDetails.leaveType}` : 
                        `Permission - ${selectedLeaveDetails.permissionType}`}
                    </Text>
                  </View>
                  
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={[
                      styles.detailValue,
                      { color: getStatusBadgeStyle(selectedLeaveDetails.status).color }
                    ]}>
                      {getStatusText(selectedLeaveDetails.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Date Range</Text>
                  <Text style={styles.detailValue}>
                    {selectedLeaveDetails.startDate ? (
                      <>
                        {formatDate(selectedLeaveDetails.startDate)}
                        {selectedLeaveDetails.endDate && selectedLeaveDetails.endDate !== selectedLeaveDetails.startDate && 
                          ` - ${formatDate(selectedLeaveDetails.endDate)}`}
                      </>
                    ) : selectedLeaveDetails.date ? (
                      formatDate(selectedLeaveDetails.date)
                    ) : 'N/A'}
                  </Text>
                  {selectedLeaveDetails.startTime && selectedLeaveDetails.endTime && (
                    <Text style={styles.detailSubText}>
                      {selectedLeaveDetails.startTime} - {selectedLeaveDetails.endTime}
                    </Text>
                  )}
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={[styles.detailValue, styles.durationValue]}>
                    {selectedLeaveDetails.days ? `${selectedLeaveDetails.days} Day${selectedLeaveDetails.days > 1 ? 's' : ''}` :
                     selectedLeaveDetails.duration ? `${selectedLeaveDetails.duration} Hour${parseFloat(selectedLeaveDetails.duration as string) > 1 ? 's' : ''}` :
                     selectedLeaveDetails.forgotType === 'in' ? 'Missed Check-in' : 'Missed Check-out'}
                  </Text>
                </View>

                {selectedLeaveDetails.description && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Reason</Text>
                    <Text style={styles.detailText}>{selectedLeaveDetails.description}</Text>
                  </View>
                )}

                {selectedLeaveDetails.reason && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Additional Reason</Text>
                    <Text style={styles.detailText}>{selectedLeaveDetails.reason}</Text>
                  </View>
                )}

                {selectedLeaveDetails.forgotReason && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Forgot Reason</Text>
                    <Text style={styles.detailText}>{selectedLeaveDetails.forgotReason}</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.closeDetailsButton}
                  onPress={() => setIsLeaveHistoryModalOpen(false)}
                >
                  <Text style={styles.closeDetailsButtonText}>Close Details</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  centeredFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  userInfo: {
    alignItems: 'flex-end'
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b'
  },
  userEmpId: {
    fontSize: 11,
    color: '#64748b'
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 100
  },
  statsSection: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12
  },
  statBoxWrapper: {
    width: (SCREEN_WIDTH - 52) / 2,
    marginBottom: 12
  },
  statBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flex: 1
  },
  shadowSm: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statTextContainer: {
    flex: 1
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  statSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  statContent: {
    flex: 1
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12
  },
  progressContainer: {
    gap: 4
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 3
  },
  progressText: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'right'
  },
  skeletonBg: {
    backgroundColor: '#e2e8f0'
  },
  skeleton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4
  },
  historySection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 100,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  historyTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center'
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a'
  },
  historySubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 36,
    flex: 0.5
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    marginLeft: 6,
    color: '#0f172a'
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b'
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b'
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center'
  },
  requestsList: {
    maxHeight: 400
  },
  requestCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  requestTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  requestTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  requestTypeSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700'
  },
  requestDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8
  },
  requestDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  requestDateText: {
    fontSize: 12,
    color: '#64748b'
  },
  requestDurationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  requestDuration: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb'
  },
  requestDescription: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 16
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb'
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    gap: 8
  },
  fabText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: SCREEN_HEIGHT * 0.9
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a'
  },
  modalBody: {
    padding: 20
  },
  employeeInfo: {
    backgroundColor: '#dbeafe',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af'
  },
  employeeId: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 2
  },
  requestTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20
  },
  requestTypeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  requestTypeButtonActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  requestTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b'
  },
  requestTypeButtonTextActive: {
    color: '#2563eb',
    fontWeight: '600'
  },
  formSection: {
    gap: 16
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16
  },
  pickerText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500'
  },
  leaveTypeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  leaveTypeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8
  },
  leaveTypeOptionActive: {
    backgroundColor: '#2563eb'
  },
  leaveTypeOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b'
  },
  leaveTypeOptionTextActive: {
    color: '#fff'
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12
  },
  dateInputContainer: {
    flex: 1
  },
  dateInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16
  },
  dateInputText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500'
  },
  timeInputContainer: {
    flex: 1
  },
  timeInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16
  },
  timeInputText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500'
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#0f172a'
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  durationHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4
  },
  permissionTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  permissionTypeButton: {
    width: (SCREEN_WIDTH - 80) / 2,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    gap: 8
  },
  permissionTypeButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb'
  },
  permissionTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  permissionTypeIconActive: {
    backgroundColor: '#2563eb15'
  },
  permissionTypeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center'
  },
  permissionTypeTextActive: {
    color: '#2563eb',
    fontWeight: '600'
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  durationOption: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center'
  },
  durationOptionActive: {
    backgroundColor: '#2563eb'
  },
  durationOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b'
  },
  durationOptionTextActive: {
    color: '#fff'
  },
  quickHours: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  quickHourButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    alignItems: 'center'
  },
  quickHourText: {
    fontSize: 12,
    color: '#64748b'
  },
  quickMinutes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  quickMinuteButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    alignItems: 'center'
  },
  quickMinuteText: {
    fontSize: 12,
    color: '#64748b'
  },
  forgotTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    gap: 4
  },
  forgotTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  forgotTypeButtonActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  forgotTypeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b'
  },
  forgotTypeButtonTextActive: {
    color: '#2563eb',
    fontWeight: '600'
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  detailsModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  detailsModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.8
  },
  detailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  detailsModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a'
  },
  detailsModalBody: {
    padding: 20
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  detailCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a'
  },
  durationValue: {
    color: '#2563eb'
  },
  detailSubText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4
  },
  detailText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20
  },
  closeDetailsButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20
  },
  closeDetailsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});

export default LeaveDashboard;