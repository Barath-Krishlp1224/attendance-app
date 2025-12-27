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
  Alert
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import {
  History as HistoryIcon,
  CalendarDays,
  Plus,
  X,
  Activity,
  TrendingUp,
  ChevronDown,
  Search,
  PieChart
} from "lucide-react-native";

const { width } = Dimensions.get("window");
const API_BASE_URL = 'https://check-seven-steel.vercel.app';
const ANNUAL_TOTAL = 24;

const LeaveDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isStartDatePickerVisible, setStartDatePickerVisibility] = useState(false);
  const [isEndDatePickerVisible, setEndDatePickerVisibility] = useState(false);
  const [isLeaveTypePickerVisible, setLeaveTypePickerVisibility] = useState(false);

  const [empIdOrEmail, setEmpIdOrEmail] = useState("");
  const [userName, setUserName] = useState(""); 

  const [summary, setSummary] = useState({ sick: 0, casual: 0, plannedRequests: 0, unplannedRequests: 0 });
  const [userRequests, setUserRequests] = useState<any[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);

  const [leaveType, setLeaveType] = useState("sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  const leaveTypes = [
    { value: "sick", label: "Sick Leave" },
    { value: "casual", label: "Casual Leave" },
    { value: "planned", label: "Planned Leave" }
  ];

  const refreshData = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const [balanceRes, historyRes, attendanceRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/leaves?empIdOrEmail=${encodeURIComponent(id)}`),
        fetch(`${API_BASE_URL}/api/leaves?empIdOrEmail=${encodeURIComponent(id)}&mode=list`),
        fetch(`${API_BASE_URL}/api/attendance?empId=${encodeURIComponent(id)}`)
      ]);

      if (balanceRes.ok) setSummary(await balanceRes.json());
      const historyData = await historyRes.json();
      if (Array.isArray(historyData)) {
        setUserRequests(historyData.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      }
      if (attendanceRes.ok) {
        const attData = await attendanceRes.json();
        setAttendanceList(attData.attendances || []);
      }
    } catch (error) { 
      console.error(error); 
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const id = await AsyncStorage.getItem("userEmpId");
      const name = await AsyncStorage.getItem("userName");
      if (id) {
        setEmpIdOrEmail(id);
        setUserName(name || "Employee");
        refreshData(id);
      } else { 
        setIsLoading(false); 
      }
    };
    init();
  }, [refreshData]);

  const stats = useMemo(() => {
    const totalApproved = userRequests
      .filter(req => req.status === 'approved' || req.status === 'auto-approved')
      .reduce((acc, req) => acc + (req.days || 0), 0);
    
    return {
      totalUsed: totalApproved,
      remaining: ANNUAL_TOTAL - totalApproved,
      sickBalance: summary.sick,
      casualBalance: summary.casual,
    };
  }, [summary, userRequests]);

  const filteredRequests = useMemo(() => {
    return userRequests.filter(req => 
      req.leaveType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [userRequests, searchQuery]);

  const calculateDays = (start: string, end: string) => {
    const startD = new Date(start);
    const endD = new Date(end);
    const diffTime = Math.abs(endD.getTime() - startD.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate || !description) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    const days = calculateDays(startDate, endDate);

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          empIdOrEmail, 
          userName, 
          leaveType, 
          startDate, 
          endDate, 
          description, 
          status: 'pending',
          days 
        }),
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        Alert.alert("Success", "Leave request submitted successfully!");
        setIsModalOpen(false);
        setStartDate(""); 
        setEndDate(""); 
        setDescription("");
        setLeaveType("sick");
        refreshData(empIdOrEmail);
      } else { 
        Alert.alert("Failed", responseData.message || "Submission failed"); 
      }
    } catch (e) { 
      console.error("Submit error:", e);
      Alert.alert("Error", "Network error occurred."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const selectLeaveType = (type: string) => {
    setLeaveType(type);
    setLeaveTypePickerVisibility(false);
  };

  if (isLoading) return <View style={styles.centeredFull}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Leave Management</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.userEmpId}>ID: {empIdOrEmail}</Text>
            </View>
            <View style={styles.avatar}><Text style={styles.avatarText}>{userName[0]}</Text></View>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); refreshData(empIdOrEmail);}} />}
      >
        {/* UPDATED STATS BOX: Total, Sick, Casual, & Progress */}
        <View style={styles.unifiedStatsBox}>
          <View style={styles.statsGrid}>
            {/* BOX 1: TOTAL USAGE (Used / 24) */}
            <View style={styles.gridItem}>
              <PieChart color="#2563eb" size={18} />
              <Text style={styles.gridVal}>
                {stats.totalUsed}<Text style={styles.gridTotalLabel}>/{ANNUAL_TOTAL}</Text>
              </Text>
              <Text style={[styles.gridLabel, {color: '#2563eb'}]}>{stats.remaining} Remaining</Text>
            </View>

            {/* BOX 2: SICK BALANCE */}
            <View style={[styles.gridItem, styles.borderLeft]}>
              <Activity color="#ef4444" size={18} />
              <Text style={styles.gridVal}>{stats.sickBalance}</Text>
              <Text style={styles.gridLabel}>Sick Balance</Text>
            </View>
          </View>

          <View style={[styles.statsGrid, styles.borderTop]}>
            {/* BOX 3: CASUAL BALANCE */}
            <View style={styles.gridItem}>
              <CalendarDays color="#8b5cf6" size={18} />
              <Text style={styles.gridVal}>{stats.casualBalance}</Text>
              <Text style={styles.gridLabel}>Casual Balance</Text>
            </View>

            {/* BOX 4: TRENDING / TOTAL TAKEN */}
            <View style={[styles.gridItem, styles.borderLeft]}>
              <TrendingUp color="#10b981" size={18} />
              <Text style={styles.gridVal}>{stats.totalUsed}</Text>
              <Text style={styles.gridLabel}>Total Approved</Text>
            </View>
          </View>
        </View>

        {/* SEARCH & HISTORY SECTION */}
        <View style={styles.section}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Leave History</Text>
            <View style={styles.searchBar}>
              <Search size={14} color="#64748b" />
              <TextInput 
                placeholder="Search..." 
                style={styles.searchInput} 
                value={searchQuery} 
                onChangeText={setSearchQuery} 
              />
            </View>
          </View>

          {filteredRequests.length === 0 ? (
            <Text style={styles.emptyText}>No records found.</Text>
          ) : (
            filteredRequests.map((req, i) => (
              <View key={i} style={styles.historyCard}>
                <View>
                  <Text style={styles.historyType}>{req.leaveType.toUpperCase()}</Text>
                  <Text style={styles.historyDate}>{new Date(req.startDate).toLocaleDateString()}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyDays}>{req.days} Days</Text>
                  <View style={[styles.statusPill, {backgroundColor: req.status.includes('app') ? '#ecfdf5' : '#fff7ed'}]}>
                    <Text style={[styles.historyStatus, {color: req.status.includes('app') ? '#059669' : '#d97706'}]}>{req.status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setIsModalOpen(true)}>
        <Plus color="white" size={30} />
      </TouchableOpacity>

      {/* MODAL */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply Leave</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}><X color="black" size={24} /></TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.input} onPress={() => setLeaveTypePickerVisibility(true)}>
              <Text style={styles.inputText}>
                {leaveTypes.find(lt => lt.value === leaveType)?.label || "Select Leave Type"}
              </Text>
              <ChevronDown color="#64748b" size={20} />
            </TouchableOpacity>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.input, {flex: 1, marginRight: 5}]} onPress={() => setStartDatePickerVisibility(true)}>
                <Text style={styles.inputText}>{startDate || "Start Date"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.input, {flex: 1, marginLeft: 5}]} onPress={() => setEndDatePickerVisibility(true)}>
                <Text style={styles.inputText}>{endDate || "End Date"}</Text>
              </TouchableOpacity>
            </View>

            <TextInput 
              placeholder="Reason..." 
              multiline 
              style={[styles.input, {height: 80, textAlignVertical: 'top'}]} 
              value={description} 
              onChangeText={setDescription} 
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Leave Type Picker Modal */}
        <Modal visible={isLeaveTypePickerVisible} animationType="fade" transparent>
          <TouchableOpacity 
            style={styles.pickerOverlay} 
            activeOpacity={1} 
            onPress={() => setLeaveTypePickerVisibility(false)}
          >
            <View style={styles.pickerContent}>
              <Text style={styles.pickerTitle}>Select Leave Type</Text>
              {leaveTypes.map((type) => (
                <TouchableOpacity 
                  key={type.value} 
                  style={styles.pickerOption}
                  onPress={() => selectLeaveType(type.value)}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    leaveType === type.value && styles.pickerOptionTextSelected
                  ]}>
                    {type.label}
                  </Text>
                  {leaveType === type.value && (
                    <View style={styles.selectedIndicator} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <DateTimePickerModal 
          isVisible={isStartDatePickerVisible} 
          mode="date" 
          onConfirm={(d) => {setStartDate(d.toISOString().split('T')[0]); setStartDatePickerVisibility(false);}} 
          onCancel={() => setStartDatePickerVisibility(false)} 
        />
        <DateTimePickerModal 
          isVisible={isEndDatePickerVisible} 
          mode="date" 
          onConfirm={(d) => {setEndDate(d.toISOString().split('T')[0]); setEndDatePickerVisibility(false);}} 
          onCancel={() => setEndDatePickerVisibility(false)} 
          minimumDate={new Date(startDate || Date.now())} 
        />
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centeredFull: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, marginTop:30, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topicLabel: { fontSize: 10, fontWeight: '900', color: '#2563eb', letterSpacing: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userInfo: { alignItems: 'flex-end' },
  userName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  userEmpId: { fontSize: 11, color: '#64748b' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  avatarText: { color: '#2563eb', fontSize: 16, fontWeight: 'bold' },
  
  unifiedStatsBox: { backgroundColor: 'white', margin: 20, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 2 },
  statsGrid: { flexDirection: 'row' },
  gridItem: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  borderLeft: { borderLeftWidth: 1, borderLeftColor: '#f1f5f9' },
  borderTop: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  gridVal: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginTop: 8 },
  gridTotalLabel: { fontSize: 14, color: '#94a3b8', fontWeight: 'normal' },
  gridLabel: { fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 2 },
  
  scrollContent: { paddingBottom: 100 },
  section: { paddingHorizontal: 20 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 10, width: '45%', height: 32 },
  searchInput: { flex: 1, fontSize: 11, marginLeft: 5 },
  historyCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 10 },
  historyType: { fontWeight: 'bold', fontSize: 13 },
  historyDate: { fontSize: 11, color: '#64748b' },
  historyRight: { alignItems: 'flex-end' },
  historyDays: { fontWeight: 'bold', color: '#2563eb' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  historyStatus: { fontSize: 9, fontWeight: '900' },
  
  fab: { position: 'absolute', bottom: 30, right: 25, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputText: { color: '#0f172a', fontWeight: 'bold' },
  row: { flexDirection: 'row' },
  submitBtn: { backgroundColor: '#2563eb', padding: 18, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: 'white', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20 },
  
  // Leave Type Picker Styles
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerContent: { backgroundColor: 'white', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  pickerTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#0f172a' },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 8, backgroundColor: '#f8fafc' },
  pickerOptionText: { fontSize: 16, color: '#64748b' },
  pickerOptionTextSelected: { color: '#2563eb', fontWeight: 'bold' },
  selectedIndicator: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#2563eb' }
});

export default LeaveDashboard;