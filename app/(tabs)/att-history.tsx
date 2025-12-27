import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  SafeAreaView, 
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable
} from 'react-native';
import { 
  UserCheck, 
  Clock, 
  AlertCircle, 
  Filter, 
  Activity, 
  Target, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Calendar
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://check-seven-steel.vercel.app';
const TOTAL_WORK_DAYS = 320;
const ITEMS_PER_PAGE = 5;

const AttendanceHistoryScreen = () => {
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const currentMonthShort = new Date().toLocaleDateString('en-US', { month: 'short' });

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthShort);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'year' | 'month'>('year');

  const fetchAttendance = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem("userEmpId");
      if (!id) return;
      const response = await fetch(`${API_BASE_URL}/api/attendance?empId=${encodeURIComponent(id)}`);
      const data = await response.json();
      setAttendanceList(data.attendances || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const yearOptions = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2];
  }, [currentYear]);

  const monthOptions = useMemo(() => ["All", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], []);

  const filteredList = useMemo(() => {
    let list = [...attendanceList];
    list = list.filter(item => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return false;
      const yearMatch = d.getFullYear() === selectedYear;
      const monthMatch = selectedMonth === "All" || d.toLocaleDateString('en-US', { month: 'short' }) === selectedMonth;
      return yearMatch && monthMatch;
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendanceList, selectedYear, selectedMonth]);

  const stats = useMemo(() => {
    const present = attendanceList.filter(a => a.present).length;
    const rate = attendanceList.length > 0 ? ((present / TOTAL_WORK_DAYS) * 100).toFixed(1) : "0.0";
    return { present, absent: attendanceList.length - present, rate, totalLogs: attendanceList.length };
  }, [attendanceList]);

  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredList, currentPage]);

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [selectedMonth, selectedYear]);

  const StatCard = ({ icon, label, val, color }: any) => (
    <View style={styles.statCard}>
      <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>{icon}</View>
      <Text style={styles.statVal}>{val}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const HeaderComponent = () => (
    <View style={styles.headerContent}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Attendance Logs</Text>
        <Text style={styles.subtitle}>Showing {selectedMonth === "All" ? "Full Year" : selectedMonth} {selectedYear}</Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
        {/* UPDATED: Displays Present Count out of 320 */}
        <StatCard 
          icon={<UserCheck size={20} color="#2563eb" />} 
          label="Present" 
          val={`${stats.present}/${TOTAL_WORK_DAYS}`} 
          color="#2563eb" 
        />
        <StatCard icon={<Activity size={20} color="#dc2626" />} label="Absent" val={stats.absent} color="#dc2626" />
        <StatCard icon={<Clock size={20} color="#7c3aed" />} label="Rate %" val={`${stats.rate}%`} color="#7c3aed" />
        <StatCard icon={<Target size={20} color="#0891b2" />} label="Logs" val={stats.totalLogs} color="#0891b2" />
      </ScrollView>

      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterChip} onPress={() => { setModalMode('year'); setModalVisible(true); }}>
          <Calendar size={14} color="#2563eb" />
          <Text style={styles.filterChipText}>Year: {selectedYear}</Text>
          <ChevronDown size={14} color="#64748b" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.filterChip} onPress={() => { setModalMode('month'); setModalVisible(true); }}>
          <Filter size={14} color="#2563eb" />
          <Text style={styles.filterChipText}>Month: {selectedMonth}</Text>
          <ChevronDown size={14} color="#64748b" />
        </TouchableOpacity>
      </View>

      <View style={styles.recordsHeader}>
        <Text style={styles.sectionLabel}>Records Found</Text>
        <View style={styles.recordsBadge}><Text style={styles.recordsBadgeText}>{filteredList.length} items</Text></View>
      </View>

      <Modal visible={isModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select {modalMode === 'year' ? 'Year' : 'Month'}</Text>
            <ScrollView style={{maxHeight: 400}}>
              {(modalMode === 'year' ? yearOptions : monthOptions).map((item) => (
                <TouchableOpacity 
                  key={item.toString()} 
                  style={[styles.modalOption, (modalMode === 'year' ? selectedYear === item : selectedMonth === item) && styles.modalOptionSelected]}
                  onPress={() => {
                    if (modalMode === 'year') {
                      setSelectedYear(Number(item));
                      setModalMode('month');
                    } else {
                      setSelectedMonth(item.toString());
                      setModalVisible(false);
                    }
                  }}
                >
                  <Text style={[styles.modalOptionText, (modalMode === 'year' ? selectedYear === item : selectedMonth === item) && styles.modalOptionTextSelected]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );

  const PaginationControls = () => (
    <View style={styles.paginationContainer}>
      <TouchableOpacity 
        style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
        onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        disabled={currentPage === 1}
      >
        <ChevronLeft size={20} color={currentPage === 1 ? '#cbd5e1' : '#2563eb'} />
      </TouchableOpacity>
      <Text style={styles.paginationText}>Page {currentPage} of {totalPages || 1}</Text>
      <TouchableOpacity 
        style={[styles.paginationButton, currentPage >= totalPages && styles.paginationButtonDisabled]}
        onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
        disabled={currentPage >= totalPages || totalPages === 0}
      >
        <ChevronRight size={20} color={currentPage >= totalPages ? '#cbd5e1' : '#2563eb'} />
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: any) => {
    const d = new Date(item.date);
    return (
      <View style={styles.attCard}>
        <View style={styles.dateCol}>
          <Text style={styles.dateDay}>{d.getDate()}</Text>
          <Text style={styles.dateMonth}>{d.toLocaleDateString('en-US', { month: 'short' })}</Text>
        </View>
        <View style={styles.infoCol}>
          <View style={styles.row}>
            <Text style={styles.modeText}>{item.mode || 'OFFICE'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: item.present ? '#d1fae5' : '#fee2e2' }]}>
              <Text style={[styles.statusText, { color: item.present ? '#065f46' : '#991b1b' }]}>{item.present ? 'PRESENT' : 'ABSENT'}</Text>
            </View>
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>In: <Text style={styles.timeValue}>{item.punchInTime ? new Date(item.punchInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</Text></Text>
            <Text style={styles.timeLabel}>Out: <Text style={styles.timeValue}>{item.punchOutTime ? new Date(item.punchOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</Text></Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={paginatedList}
        renderItem={renderItem}
        keyExtractor={(item, index) => item._id || index.toString()}
        ListHeaderComponent={HeaderComponent}
        ListFooterComponent={filteredList.length > 0 ? PaginationControls : null}
        contentContainerStyle={styles.listPadding}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAttendance(); }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AlertCircle size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptyText}>No data for {selectedMonth} {selectedYear}.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContent: { paddingTop: 40, paddingBottom: 10 },
  titleContainer: { paddingHorizontal: 20, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#1e293b' },
  subtitle: { fontSize: 14, color: '#64748b' },
  statsScroll: { paddingHorizontal: 20, gap: 10 },
  statCard: { 
    backgroundColor: '#fff', 
    minWidth: 120, // Increased minWidth to fit "XX/320"
    padding: 15, 
    borderRadius: 16, 
    alignItems: 'center', 
    elevation: 1 
  },
  iconCircle: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal: { fontSize: 16, fontWeight: '800', color: '#1e293b' }, // Slightly smaller font to ensure long text fits
  statLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' },
  filterRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20 },
  filterChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '80%', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 15, textAlign: 'center' },
  modalOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  modalOptionSelected: { backgroundColor: '#f0f7ff', borderRadius: 10 },
  modalOptionText: { fontSize: 16, color: '#475569' },
  modalOptionTextSelected: { color: '#2563eb', fontWeight: '700' },
  recordsHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 25, marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  recordsBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  recordsBadgeText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  listPadding: { paddingBottom: 40 },
  attCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 14, padding: 15, marginBottom: 10, flexDirection: 'row', elevation: 1 },
  dateCol: { alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f1f5f9', paddingRight: 15, minWidth: 50 },
  dateDay: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  dateMonth: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' },
  infoCol: { flex: 1, paddingLeft: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  modeText: { fontSize: 10, color: '#94a3b8', fontWeight: '700' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: '800' },
  timeRow: { flexDirection: 'row', gap: 15 },
  timeLabel: { fontSize: 12, color: '#64748b' },
  timeValue: { fontWeight: '700', color: '#1e293b' },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingVertical: 20 },
  paginationButton: { padding: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  paginationButtonDisabled: { opacity: 0.3 },
  paginationText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 10 },
  emptyText: { color: '#64748b', marginTop: 4 }
});

export default AttendanceHistoryScreen;