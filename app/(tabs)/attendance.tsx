import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import {
  MapPin,
  Camera,
  LogIn,
  LogOut,
  Clock,
  Calendar,
  Home as HomeIcon,
  Wifi,
  Briefcase,
  FileText,
  CheckCircle,
  Clock3,
  Power,
  CalendarDays,
  History,
} from 'lucide-react-native';

// --- Constants & Helpers ---
const BRANCHES = [
  { name: "Branch 1", lat: 11.939198361614558, lon: 79.81654494108358, radius: 100 },
  { name: "Branch 2", lat: 11.940000000000000, lon: 79.82000000000000, radius: 300 } 
];
const API_BASE_URL = 'https://check-seven-steel.vercel.app';

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const getNearestBranchData = (lat: number, lon: number) => {
  const distances = BRANCHES.map(branch => ({
    ...branch,
    distance: getDistanceMeters(lat, lon, branch.lat, branch.lon)
  }));
  return distances.sort((a, b) => a.distance - b.distance)[0];
};

// --- Types ---
type PunchType = 'IN' | 'OUT';
type AttendanceMode = 'IN_OFFICE' | 'WORK_FROM_HOME' | 'ON_DUTY' | 'REGULARIZATION';

interface AttendanceRecord {
  punchInTime?: string;
  punchOutTime?: string;
  punchInMode?: AttendanceMode;
  punchOutMode?: AttendanceMode;
  mode?: AttendanceMode;
}

type CameraRef = React.ComponentRef<typeof CameraView>;

const AttendanceScreen: React.FC = () => {
  const router = useRouter();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraRef | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [punchType, setPunchType] = useState<PunchType | null>(null);
  const [mode, setMode] = useState<AttendanceMode>('IN_OFFICE');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [captureTime, setCaptureTime] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLogoutConfirming, setIsLogoutConfirming] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const modeOptions: AttendanceMode[] = ['IN_OFFICE', 'WORK_FROM_HOME', 'ON_DUTY', 'REGULARIZATION'];

  const loadTodayAttendance = useCallback(async (empId: string, currentMode: AttendanceMode) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/today`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId, mode: currentMode }),
      });
      const json = await res.json();
      setRecord(json.record || null);
    } catch (e) { 
      console.error("Failed to load attendance:", e); 
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const id = await AsyncStorage.getItem('userEmpId');
      const storedName = await AsyncStorage.getItem('userName');
      setEmployeeId(id);
      setName(storedName);
      
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(locStatus === 'granted');
      if (locStatus === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
      if (!cameraPermission?.granted) await requestCameraPermission();
    };
    init();
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    if (employeeId) loadTodayAttendance(employeeId, mode);
  }, [employeeId, mode, loadTodayAttendance]);

  const handleCapture = async () => {
    if (!cameraRef.current || !employeeId) return;
    try {
      setSubmitLoading(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      if (photo && photo.base64) {
        setCaptureTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setPreviewImage(`data:image/jpeg;base64,${photo.base64}`);
        setIsConfirming(true);
      }
    } catch (e) { 
      Toast.show({ type: 'error', text1: 'Capture Failed' }); 
      console.error(e);
    } finally { 
      setSubmitLoading(false); 
    }
  };

  const handleConfirmSubmit = async () => {
    if (!previewImage || !employeeId || !punchType || !mode) return;

    if (mode === 'IN_OFFICE' && location.lat && location.lng) {
      const nearestBranch = getNearestBranchData(location.lat, location.lng);
      if (nearestBranch.distance > nearestBranch.radius) {
        Toast.show({ 
            type: 'error', 
            text1: 'Out of Range', 
            text2: `You are ${nearestBranch.distance}m from ${nearestBranch.name}. Limit is ${nearestBranch.radius}m.` 
        });
        setIsConfirming(false);
        return;
      }
    }

    try {
      setSubmitLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employeeId.trim(),
          imageData: previewImage,
          latitude: location.lat,
          longitude: location.lng,
          punchType,
          mode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitStatus(json.error || 'Submission Failed');
      } else {
        setSubmitStatus('successfully recorded');
        await loadTodayAttendance(employeeId, mode);
        setTimeout(() => {
          setCurrentStep(1);
          setPunchType(null);
          setSubmitStatus(null);
        }, 2000);
      }
    } catch (e) {
      setSubmitStatus('Network Error');
      console.error(e);
    } finally {
      setSubmitLoading(false);
      setIsConfirming(false);
      setPreviewImage(null);
    }
  };

  const confirmLogout = async () => {
    await AsyncStorage.multiRemove(["userRole", "userEmpId", "userName", "userTeam"]);
    router.replace('/');
  };

  const getModeLabel = (m: AttendanceMode) => m.replace(/_/g, ' ');
  const getModeIcon = (m: AttendanceMode) => {
    switch (m) {
      case 'IN_OFFICE': return Wifi;
      case 'WORK_FROM_HOME': return HomeIcon;
      case 'ON_DUTY': return Briefcase;
      default: return FileText;
    }
  };

  const formatTime = (val?: string) => {
    if (!val) return '—';
    return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!cameraPermission?.granted) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 10 }}>Checking Permissions...</Text>
      </View>
    );
  }

  const hasCheckedIn = !!record?.punchInTime;
  const hasCheckedOut = !!record?.punchOutTime;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* LOGO ON LEFT */}
          <Image 
            source={require('../../assets/logo-hd.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          
          {/* RIGHT SIDE CONTAINER: POWER BUTTON + TEXT */}
          <View style={styles.headerRightSide}>
          

            <View style={styles.headerTextContent}>
              <Text style={styles.headerTitle}>Mark Attendance</Text>
              <Text style={styles.headerDate}>{new Date().toDateString()}</Text>
            </View>
              <TouchableOpacity 
              style={styles.logoutButtonInline} 
              onPress={() => setIsLogoutConfirming(true)}
            >
              <Power size={22} color="#dc2626" />
            </TouchableOpacity>
          </View>
          
        </View>

        <View style={styles.stepIndicator}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, currentStep >= 1 && styles.stepCircleActive]}>
              <Text style={[styles.stepNumber, currentStep >= 1 && styles.stepNumberActive]}>1</Text>
            </View>
            <Text style={[styles.stepLabel, currentStep === 1 && styles.stepLabelActive]}>Mode & Type</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, currentStep >= 2 && styles.stepCircleActive]}>
              <Text style={[styles.stepNumber, currentStep >= 2 && styles.stepNumberActive]}>2</Text>
            </View>
            <Text style={[styles.stepLabel, currentStep === 2 && styles.stepLabelActive]}>Capture</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.contentWhite} contentContainerStyle={styles.centeredContentInner}>
        {currentStep === 1 ? (
          <View style={styles.centerWrapper}>
            <View style={styles.topRowContainer}>
              <View style={styles.userSectionCompact}>
                <Text style={styles.welcomeTextBlack}>Welcome back,</Text>
                <Text style={styles.userNameLargeBlack}>{name || 'User'}</Text>
                <Text style={styles.userIdTextBlack}>ID: {employeeId}</Text>
              </View>
              <View style={styles.locationCardCompact}>
                <MapPin size={18} color="#16a34a" />
                <View>
                    <Text style={styles.locationTitleBlack}>Location</Text>
                    <Text style={styles.locationCoordsBlack}>{location.lat?.toFixed(4)}, {location.lng?.toFixed(4)}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, styles.statusCard]}>
              <View style={styles.statusHeader}><Clock3 size={20} color="#111827" /><Text style={styles.statusTitle}>{"Today's Status"}</Text></View>
              <View style={styles.statusRow}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Check In</Text>
                  <View style={[styles.punchStatusPill, { backgroundColor: record?.punchInTime ? '#16a34a' : '#e5e7eb' }]}>
                    <LogIn size={14} color="#fff" /><Text style={styles.punchStatusText}>{formatTime(record?.punchInTime)}</Text>
                  </View>
                </View>
                <View style={styles.statusDivider} />
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Check Out</Text>
                  <View style={[styles.punchStatusPill, { backgroundColor: record?.punchOutTime ? '#16a34a' : '#fee2e2' }]}>
                    <LogOut size={14} color={record?.punchOutTime ? '#fff' : '#dc2626'} /><Text style={styles.punchStatusText}>{formatTime(record?.punchOutTime)}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}><Calendar size={20} color="#111827" /><Text style={styles.sectionTitleBlack}>Select Work Mode</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              <View style={styles.modeGridHorizontal}>
                {modeOptions.map((m) => {
                  const Icon = getModeIcon(m);
                  const isSelected = m === mode;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modeCardHorizontal, isSelected && { backgroundColor: '#06b6d4', borderColor: '#06b6d4' }]}
                      onPress={() => setMode(m)}
                    >
                      <View style={[styles.modeIconContainer, { backgroundColor: isSelected ? '#fff' : '#f3f4f6' }]}>
                        <Icon size={24} color={isSelected ? "#06b6d4" : "#64748b"} />
                      </View>
                      <Text style={[styles.modeTitleBlack, isSelected && { color: '#fff' }]}>{getModeLabel(m)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[styles.sectionHeader, { marginTop: 20 }]}><Clock size={20} color="#111827" /><Text style={styles.sectionTitleBlack}>Punch Action</Text></View>
            
            <View style={styles.punchTypeContainerCentered}>
              {!hasCheckedIn ? (
                <TouchableOpacity
                  style={[styles.punchCardSingle, { borderColor: '#16a34a' }]}
                  onPress={() => { setPunchType('IN'); setCurrentStep(2); }}
                >
                  <View style={[styles.punchIconContainerSmall, { backgroundColor: '#dcfce7' }]}><LogIn size={32} color="#16a34a" /></View>
                  <Text style={styles.punchTitleBlack}>{"Check In"}</Text>
                </TouchableOpacity>
              ) : !hasCheckedOut ? (
                <TouchableOpacity
                  style={[styles.punchCardSingle, { borderColor: '#dc2626' }]}
                  onPress={() => { setPunchType('OUT'); setCurrentStep(2); }}
                >
                  <View style={[styles.punchIconContainerSmall, { backgroundColor: '#fee2e2' }]}><LogOut size={32} color="#dc2626" /></View>
                  <Text style={styles.punchTitleBlack}>{"Check Out"}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.completedCard}>
                  <CheckCircle size={32} color="#16a34a" />
                  <Text style={styles.completedText}>Attendance completed for today</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
             <View style={styles.cameraTopBarLight}>
                <View style={styles.selectionChips}>
                    <View style={styles.chip}><Text style={styles.chipText}>{getModeLabel(mode)}</Text></View>
                    <View style={[styles.chip, punchType === 'IN' ? styles.chipIn : styles.chipOut]}><Text style={styles.chipText}>Punch {punchType}</Text></View>
                </View>
                <TouchableOpacity onPress={() => setCurrentStep(1)} style={{ marginLeft: 'auto' }}>
                    <Text style={{ color: '#2563eb', fontWeight: 'bold' }}>Cancel</Text>
                </TouchableOpacity>
             </View>
             <CameraView ref={cameraRef} style={styles.cameraFull} facing="front" />
             <View style={styles.cameraBottomBarLight}>
                <TouchableOpacity onPress={handleCapture} style={styles.captureButtonLarge}>
                    <View style={styles.captureButtonInner}><Camera size={32} color="#2563eb" /></View>
                </TouchableOpacity>
             </View>
          </View>
        )}
      </ScrollView>

      {currentStep === 1 && (
        <View style={styles.footerNav}>
          <TouchableOpacity style={styles.footerTab} onPress={() => router.push('/leave')}>
            <CalendarDays size={24} color="#64748b" />
            <Text style={styles.footerTabText}>Leaves</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerTab} onPress={() => router.push('/att-history')}>
            <History size={24} color="#64748b" />
            <Text style={styles.footerTabText}>History</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation Modals */}
      <Modal visible={isConfirming} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Submission</Text>
            {previewImage && <Image source={{ uri: previewImage }} style={[styles.previewImage, { transform: [{ scaleX: -1 }] }]} />}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleConfirmSubmit} disabled={submitLoading}>
                {submitLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonPrimaryText}>Submit</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setIsConfirming(false)}>
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isLogoutConfirming} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 300 }]}>
            <Text style={styles.modalTitle}>Logout?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButtonPrimary, { backgroundColor: '#dc2626' }]} onPress={confirmLogout}>
                <Text style={styles.modalButtonPrimaryText}>Logout</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setIsLogoutConfirming(false)}>
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {submitStatus?.includes('successfully') && (
        <View style={styles.successOverlay}>
          <CheckCircle size={64} color="#16a34a" />
          <Text style={styles.successTitle}>Done!</Text>
        </View>
      )}
      <Toast />
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 10 : 40, 
    paddingHorizontal: 20, 
    paddingBottom: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb',
  },
  headerTop: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 20 
  },
  logo: { width: 130, height: 60 },
  headerRightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutButtonInline: {
    padding: 4,
  },
  headerTextContent: { 
    alignItems: 'flex-end' 
  },
  headerTitle: { fontSize: 18, fontWeight: '800', textAlign: 'right' },
  headerDate: { fontSize: 13, color: '#64748b', textAlign: 'right' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#2563eb' },
  stepNumber: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  stepNumberActive: { color: '#fff' },
  stepLabel: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  stepLabelActive: { color: '#000' },
  stepLine: { width: 40, height: 2, backgroundColor: '#e5e7eb', marginHorizontal: 8 },
  stepLineActive: { backgroundColor: '#2563eb' },
  contentWhite: { flex: 1 },
  centeredContentInner: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  centerWrapper: { width: '100%' },
  topRowContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  userSectionCompact: { flex: 1 },
  welcomeTextBlack: { fontSize: 13, color: '#64748b' },
  userNameLargeBlack: { fontSize: 20, fontWeight: '800' },
  userIdTextBlack: { fontSize: 11, color: '#9ca3af' },
  locationCardCompact: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  locationTitleBlack: { fontSize: 10, color: '#64748b' },
  locationCoordsBlack: { fontSize: 10, fontWeight: '700' },
  card: { borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  statusCard: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8 },
  statusTitle: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statusItem: { alignItems: 'center' },
  statusLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  punchStatusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  punchStatusText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  statusDivider: { width: 1, backgroundColor: '#e2e8f0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitleBlack: { fontSize: 16, fontWeight: '700' },
  horizontalScroll: { marginBottom: 10 },
  modeGridHorizontal: { flexDirection: 'row', gap: 12 },
  modeCardHorizontal: { width: 110, borderRadius: 12, padding: 12, borderWidth: 2, borderColor: '#e5e7eb', height: 90, justifyContent: 'space-between' },
  modeIconContainer: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modeTitleBlack: { fontSize: 12, fontWeight: '700' },
  punchTypeContainerCentered: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  punchCardSingle: { width: '100%', maxWidth: 300, borderRadius: 16, padding: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  punchIconContainerSmall: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  punchTitleBlack: { fontSize: 18, fontWeight: '800' },
  completedCard: { alignItems: 'center', padding: 20, backgroundColor: '#f0fdf4', borderRadius: 12, width: '100%' },
  completedText: { marginTop: 8, color: '#166534', fontWeight: '600' },
  cameraWrapper: { height: 500, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  cameraFull: { flex: 1 },
  cameraTopBarLight: { padding: 15, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' },
  selectionChips: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  chipIn: { backgroundColor: '#16a34a' },
  chipOut: { backgroundColor: '#dc2626' },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cameraBottomBarLight: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  captureButtonLarge: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: '#2563eb', padding: 3 },
  captureButtonInner: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  footerNav: { flexDirection: 'row', height: 70, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff', paddingBottom: Platform.OS === 'ios' ? 20 : 5 },
  footerTab: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  footerTabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  modalInfoCard: { backgroundColor: '#f1f5f9', width: '100%', padding: 12, borderRadius: 10, marginBottom: 15 },
  modalInfoLabel: { textAlign: 'center', fontWeight: '600', color: '#475569' },
  previewImage: { width: '100%', height: 250, borderRadius: 12, marginBottom: 20 },
  modalActions: { width: '100%', gap: 10 },
  modalButtonPrimary: { backgroundColor: '#16a34a', padding: 14, borderRadius: 10, alignItems: 'center' },
  modalButtonPrimaryText: { color: '#fff', fontWeight: '700' },
  modalButtonSecondary: { backgroundColor: '#f1f5f9', padding: 14, borderRadius: 10, alignItems: 'center' },
  modalButtonSecondaryText: { fontWeight: '700' },
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  successTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 10 }
});

export default AttendanceScreen;