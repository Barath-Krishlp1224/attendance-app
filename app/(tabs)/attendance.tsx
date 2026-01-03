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
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import {
  MapPin,
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
  Building2,
  Camera,
  ChevronLeft,
  User,
  Navigation,
} from 'lucide-react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Constants & Helpers ---
const BRANCHES = [
  { id: 1, name: "Lp Tidel Office", lat: 11.939198361614558, lon: 79.81654494108358, radius: 2000 },
  { id: 2, name: "Lp Saaram Office", lat: 11.995967441546023, lon: 79.76744798792814, radius: 500 },
];
const API_BASE_URL = 'https://lemonpay-portal.vercel.app/';

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const getTimeStatus = (type: PunchType) => {
  if (type === 'OUT') return { label: 'Punch Out', color: '#64748b' };
  
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const onTimeLimit = 9 * 60;
  const graceLimit = 9 * 60 + 15;

  if (totalMinutes <= onTimeLimit) return { label: 'On Time', color: '#16a34a' };
  if (totalMinutes <= graceLimit) return { label: 'Grace Period', color: '#f59e0b' };
  return { label: 'Late Entry', color: '#dc2626' };
};

// --- Types ---
type PunchType = 'IN' | 'OUT';
type AttendanceMode = 'IN_OFFICE' | 'WORK_FROM_HOME' | 'ON_DUTY' | 'REGULARIZATION';

interface AttendanceRecord {
  punchInTime?: string;
  punchOutTime?: string;
}

interface Branch {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
}

type CameraRef = React.ComponentRef<typeof CameraView>;

const AttendanceScreen: React.FC = () => {
  const router = useRouter();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraRef | null>(null);
  const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [punchType, setPunchType] = useState<PunchType | null>(null);
  const [mode, setMode] = useState<AttendanceMode>('IN_OFFICE');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLogoutConfirming, setIsLogoutConfirming] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

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

  const checkBranchDistance = (branch: Branch) => {
    if (!location.lat || !location.lng) return { inRange: false, distance: 0 };
    const distance = getDistanceMeters(location.lat, location.lng, branch.lat, branch.lon);
    return { inRange: distance <= branch.radius, distance };
  };

  const handleBranchSelect = (branch: Branch) => {
    const { inRange, distance } = checkBranchDistance(branch);
    if (!inRange) {
      Toast.show({
        type: 'error',
        text1: 'Out of Range',
        text2: `You are ${distance}m away. Must be within ${branch.radius}m.`,
      });
      return;
    }
    setSelectedBranch(branch);
    setCurrentStep(2);
  };

  const handlePunchTypeSelect = (type: PunchType) => {
    setPunchType(type);
    setCurrentStep(3);
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !employeeId) return;
    try {
      setSubmitLoading(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      if (photo?.base64) {
        setPreviewImage(`data:image/jpeg;base64,${photo.base64}`);
        setIsConfirming(true);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Capture Failed' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!previewImage || !employeeId || !punchType || !mode) return;

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
          branchId: selectedBranch?.id,
          branchName: selectedBranch?.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        Toast.show({ type: 'error', text1: json.error || 'Failed' });
      } else {
        setSubmitStatus('successfully recorded');
        await loadTodayAttendance(employeeId, mode);
        setTimeout(() => {
          setCurrentStep(1);
          setPunchType(null);
          setSelectedBranch(null);
          setSubmitStatus(null);
        }, 2000);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Network Error' });
    } finally {
      setSubmitLoading(false);
      setIsConfirming(false);
      setPreviewImage(null);
    }
  };

  const formatTime = (val?: string) => {
    if (!val) return '—';
    return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const timeStatus = punchType ? getTimeStatus(punchType) : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Professional Header */}
      {currentStep !== 3 && (
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Image source={require('../../assets/logo-hd.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <TouchableOpacity onPress={() => setIsLogoutConfirming(true)} style={styles.logoutBtn}>
              <Power size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>

          {/* Modern Step Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(currentStep / 3) * 100}%` }]} />
            </View>
            <View style={styles.stepLabels}>
              <Text style={[styles.stepLabel, currentStep >= 1 && styles.stepLabelActive]}>Setup</Text>
              <Text style={[styles.stepLabel, currentStep >= 2 && styles.stepLabelActive]}>Action</Text>
              <Text style={[styles.stepLabel, currentStep >= 3 && styles.stepLabelActive]}>Verify</Text>
            </View>
          </View>
        </View>
      )}

      {/* STEP 1: Setup */}
      {currentStep === 1 && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* User Info Card */}
          <View style={styles.userCard}>
            <View style={styles.userAvatarContainer}>
              <View style={styles.userAvatar}>
                <User size={32} color="#2563eb" />
              </View>
              <View style={styles.onlineIndicator} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.greeting}>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}</Text>
              <Text style={styles.userName}>{name || 'User'}</Text>
              <Text style={styles.userBadge}>ID: {employeeId}</Text>
            </View>
            <View style={styles.locationBadge}>
              <Navigation size={14} color="#16a34a" />
              <Text style={styles.locationText}>
                {location.lat && location.lng ? `${location.lat.toFixed(2)}, ${location.lng.toFixed(2)}` : 'Getting location...'}
              </Text>
            </View>
          </View>

          {/* Today's Status */}
          <View style={styles.statusContainer}>
            <Text style={styles.sectionTitle}>Today Status</Text>
            <View style={styles.timelineContainer}>
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, record?.punchInTime && styles.timelineDotActive]}>
                  <LogIn size={16} color={record?.punchInTime ? '#fff' : '#94a3b8'} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Check In</Text>
                  <Text style={[styles.timelineTime, record?.punchInTime && styles.timelineTimeActive]}>
                    {formatTime(record?.punchInTime)}
                  </Text>
                </View>
              </View>
              
              <View style={[styles.timelineConnector, record?.punchInTime && styles.timelineConnectorActive]} />
              
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, record?.punchOutTime && styles.timelineDotActive]}>
                  <LogOut size={16} color={record?.punchOutTime ? '#fff' : '#94a3b8'} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Check Out</Text>
                  <Text style={[styles.timelineTime, record?.punchOutTime && styles.timelineTimeActive]}>
                    {formatTime(record?.punchOutTime)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Work Mode Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Work Mode</Text>
            <View style={styles.modeGrid}>
              {modeOptions.map((m) => {
                const Icon = (m === 'IN_OFFICE' ? Building2 : m === 'WORK_FROM_HOME' ? HomeIcon : m === 'ON_DUTY' ? Briefcase : FileText);
                const isSelected = m === mode;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modeCard, isSelected && styles.modeCardActive]}
                    onPress={() => { setMode(m); setSelectedBranch(null); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modeIconBox, isSelected && styles.modeIconBoxActive]}>
                      <Icon size={24} color={isSelected ? "#2563eb" : "#64748b"} />
                    </View>
                    <Text style={[styles.modeTitle, isSelected && styles.modeTitleActive]}>
                      {m.replace(/_/g, ' ')}
                    </Text>
                    {isSelected && <View style={styles.selectedIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Conditional Content */}
          {record?.punchInTime && record?.punchOutTime ? (
            <View style={styles.completedContainer}>
              <View style={styles.completedIcon}>
                <CheckCircle size={48} color="#16a34a" />
              </View>
              <Text style={styles.completedTitle}>All Done!</Text>
              <Text style={styles.completedSubtitle}>Attendance completed for today</Text>
            </View>
          ) : mode === 'IN_OFFICE' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose Your Branch</Text>
              {BRANCHES.map((branch) => {
                const { inRange, distance } = checkBranchDistance(branch);
                return (
                  <TouchableOpacity
                    key={branch.id}
                    style={[styles.branchItem, !inRange && styles.branchItemDisabled]}
                    onPress={() => handleBranchSelect(branch)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.branchIcon, inRange && styles.branchIconActive]}>
                      <Building2 size={24} color={inRange ? '#2563eb' : '#94a3b8'} />
                    </View>
                    <View style={styles.branchDetails}>
                      <Text style={[styles.branchName, !inRange && styles.branchNameDisabled]}>{branch.name}</Text>
                      <View style={styles.branchMeta}>
                        <MapPin size={12} color="#64748b" />
                        <Text style={styles.branchDistance}>{distance}m away</Text>
                        {inRange && <Text style={styles.branchInRange}>• In Range</Text>}
                      </View>
                    </View>
                    {inRange && (
                      <View style={styles.branchCheck}>
                        <CheckCircle size={20} color="#16a34a" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Punch Attendance</Text>
              <TouchableOpacity
                style={styles.punchButton}
                onPress={() => handlePunchTypeSelect(record?.punchInTime ? 'OUT' : 'IN')}
                activeOpacity={0.8}
              >
                <View style={styles.punchButtonIcon}>
                  {record?.punchInTime ? <LogOut size={28} color="#fff" /> : <LogIn size={28} color="#fff" />}
                </View>
                <Text style={styles.punchButtonText}>
                  {record?.punchInTime ? 'Check Out' : 'Check In'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* STEP 2: Action Selection */}
      {currentStep === 2 && (
        <View style={styles.stepScreen}>
          <TouchableOpacity onPress={() => setCurrentStep(1)} style={styles.backLink}>
            <ChevronLeft size={20} color="#2563eb" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.selectionCard}>
            <Building2 size={28} color="#2563eb" />
            <Text style={styles.selectionLabel}>Selected Branch</Text>
            <Text style={styles.selectionValue}>{selectedBranch?.name}</Text>
          </View>

          <Text style={styles.stepInstruction}>Choose your action</Text>
          
          <TouchableOpacity
            style={styles.punchButton}
            onPress={() => handlePunchTypeSelect(record?.punchInTime ? 'OUT' : 'IN')}
            activeOpacity={0.8}
          >
            <View style={styles.punchButtonIcon}>
              {record?.punchInTime ? <LogOut size={28} color="#fff" /> : <LogIn size={28} color="#fff" />}
            </View>
            <Text style={styles.punchButtonText}>
              {record?.punchInTime ? 'Check Out' : 'Check In'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 3: Camera */}
      {currentStep === 3 && (
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
          
          <SafeAreaView style={styles.cameraOverlay}>
            <TouchableOpacity 
              onPress={() => setCurrentStep(mode === 'IN_OFFICE' ? 2 : 1)} 
              style={styles.cameraBack}
            >
              <ChevronLeft size={24} color="#fff" />
              <Text style={styles.cameraBackText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.cameraFrame}>
              <View style={[styles.frameCorner, styles.frameTopLeft]} />
              <View style={[styles.frameCorner, styles.frameTopRight]} />
              <View style={[styles.frameCorner, styles.frameBottomLeft]} />
              <View style={[styles.frameCorner, styles.frameBottomRight]} />
            </View>

            <View style={styles.cameraHint}>
              <Text style={styles.cameraHintText}>Position your face within the frame</Text>
            </View>

            <View style={styles.cameraControls}>
              <TouchableOpacity onPress={handleCapture} style={styles.captureButton} activeOpacity={0.8}>
                <View style={styles.captureRing}>
                  <View style={styles.captureCenter}>
                    <Camera size={28} color="#2563eb" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}

      {/* Footer Navigation */}
      {currentStep === 1 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/leave')}>
            <CalendarDays size={22} color="#64748b" />
            <Text style={styles.footerLabel}>Leaves</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/att-history')}>
            <History size={22} color="#64748b" />
            <Text style={styles.footerLabel}>History</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal visible={isConfirming} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>Confirm Attendance</Text>
            
            {previewImage && (
              <Image 
                source={{ uri: previewImage }} 
                style={[styles.previewPhoto, { transform: [{ scaleX: -1 }] }]} 
              />
            )}

            <View style={styles.confirmInfo}>
              <View style={styles.confirmRow}>
                <Clock size={16} color="#64748b" />
                <Text style={styles.confirmText}>
                  {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Text>
              </View>
              {timeStatus && (
                <View style={[styles.timeBadge, { backgroundColor: timeStatus.color }]}>
                  <Text style={styles.timeBadgeText}>{timeStatus.label}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleConfirmSubmit} 
              disabled={submitLoading}
            >
              {submitLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Attendance</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.retakeButton} 
              onPress={() => setIsConfirming(false)}
            >
              <Text style={styles.retakeButtonText}>Retake Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal visible={isLogoutConfirming} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>Confirm Logout</Text>
            <Text style={styles.modalSubtext}>Are you sure you want to sign out?</Text>
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: '#dc2626' }]} 
              onPress={async () => {
                await AsyncStorage.multiRemove(["userRole", "userEmpId", "userName", "userTeam"]);
                router.replace('/');
              }}
            >
              <Text style={styles.submitButtonText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.retakeButton} 
              onPress={() => setIsLogoutConfirming(false)}
            >
              <Text style={styles.retakeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Overlay */}
      {submitStatus && (
        <View style={styles.successScreen}>
          <View style={styles.successContent}>
            <CheckCircle size={80} color="#16a34a" />
            <Text style={styles.successText}>Successfully Recorded!</Text>
          </View>
        </View>
      )}

      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  
  // Header Styles
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
  headerContent: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: { 
    flex: 1 
  },
  logo: { 
    width: 120, 
    height: 36 
  },
  logoutBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#fee2e2', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  
  // Progress Bar
  progressContainer: { 
    gap: 12 
  },
  progressBar: { 
    height: 4, 
    backgroundColor: '#e2e8f0', 
    borderRadius: 2, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },
  stepLabels: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  stepLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#94a3b8' 
  },
  stepLabelActive: { 
    color: '#2563eb' 
  },

  // Content
  content: { 
    flex: 1, 
    paddingHorizontal: 20 
  },
  
  // User Card
  userCard: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 20, 
    marginTop: 20, 
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  userAvatarContainer: { 
    position: 'relative', 
    marginBottom: 12 
  },
  userAvatar: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: '#eff6ff', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  onlineIndicator: { 
    position: 'absolute', 
    right: 2, 
    bottom: 2, 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    backgroundColor: '#16a34a', 
    borderWidth: 3, 
    borderColor: '#fff' 
  },
  userInfo: { 
    marginBottom: 16 
  },
  greeting: { 
    fontSize: 13, 
    color: '#64748b', 
    marginBottom: 4 
  },
  userName: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#0f172a', 
    marginBottom: 6 
  },
  userBadge: { 
    fontSize: 12, 
    color: '#94a3b8', 
    fontWeight: '600' 
  },
  locationBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#f0fdf4', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20, 
    alignSelf: 'flex-start' 
  },
  locationText: { 
    fontSize: 11, 
    color: '#16a34a', 
    fontWeight: '600' 
  },

  // Status Timeline
  statusContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 24,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  timelineContainer: { 
    marginTop: 16 
  },
  timelineItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16 
  },
  timelineDot: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#f1f5f9', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  timelineDotActive: { 
    backgroundColor: '#2563eb' 
  },
  timelineContent: { 
    flex: 1 
  },
  timelineLabel: { 
    fontSize: 13, 
    color: '#64748b', 
    fontWeight: '600', 
    marginBottom: 4 
  },
  timelineTime: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#94a3b8' 
  },
  timelineTimeActive: { 
    color: '#0f172a' 
  },
  timelineConnector: { 
    width: 2, 
    height: 20, 
    backgroundColor: '#e2e8f0', 
    marginLeft: 21, 
    marginVertical: 4 
  },
  timelineConnectorActive: { 
    backgroundColor: '#2563eb' 
  },

  // Section
  section: { 
    marginBottom: 24 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a', 
    marginBottom: 16 
  },

  // Mode Grid
  modeGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  modeCard: { 
    width: (SCREEN_WIDTH - 52) / 2, 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 2, 
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  modeCardActive: { 
    borderColor: '#2563eb', 
    backgroundColor: '#eff6ff' 
  },
  modeIconBox: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    backgroundColor: '#f8fafc', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 12 
  },
  modeIconBoxActive: { 
    backgroundColor: '#fff' 
  },
  modeTitle: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#475569' 
  },
  modeTitleActive: { 
    color: '#2563eb' 
  },
  selectedIndicator: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#2563eb' 
  },

  // Branch Items
  branchItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 2, 
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  branchItemDisabled: { 
    opacity: 0.5 
  },
  branchIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    backgroundColor: '#f8fafc', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  branchIconActive: { 
    backgroundColor: '#eff6ff' 
  },
  branchDetails: { 
    flex: 1 
  },
  branchName: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#0f172a', 
    marginBottom: 6 
  },
  branchNameDisabled: { 
    color: '#94a3b8' 
  },
  branchMeta: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  branchDistance: { 
    fontSize: 12, 
    color: '#64748b', 
    fontWeight: '600' 
  },
  branchInRange: { 
    fontSize: 12, 
    color: '#16a34a', 
    fontWeight: '700' 
  },
  branchCheck: { 
    marginLeft: 8 
  },

  // Punch Button
  punchButton: { 
    backgroundColor: '#2563eb', 
    borderRadius: 20, 
    padding: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12,
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  punchButtonIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  punchButtonText: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#fff' 
  },

  // Completed State
  completedContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 40, 
    alignItems: 'center', 
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#bbf7d0',
  },
  completedIcon: { 
    marginBottom: 16 
  },
  completedTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#16a34a', 
    marginBottom: 8 
  },
  completedSubtitle: { 
    fontSize: 14, 
    color: '#64748b' 
  },

  // Step 2 Screen
  stepScreen: { 
    flex: 1, 
    padding: 20 
  },
  backLink: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    marginBottom: 24 
  },
  backText: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#2563eb' 
  },
  selectionCard: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 24, 
    alignItems: 'center', 
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#bfdbfe',
  },
  selectionLabel: { 
    fontSize: 13, 
    color: '#64748b', 
    marginTop: 12, 
    marginBottom: 4 
  },
  selectionValue: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#1e40af' 
  },
  stepInstruction: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a', 
    marginBottom: 20, 
    textAlign: 'center' 
  },

  // Camera Styles
  cameraContainer: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  cameraOverlay: { 
    flex: 1, 
    justifyContent: 'space-between' 
  },
  cameraBack: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 25, 
    margin: 20, 
    gap: 4 
  },
  cameraBackText: { 
    color: '#fff', 
    fontWeight: '600' 
  },
  cameraFrame: { 
    position: 'absolute', 
    top: SCREEN_HEIGHT * 0.25, 
    alignSelf: 'center', 
    width: SCREEN_WIDTH * 0.7, 
    height: SCREEN_WIDTH * 0.9 
  },
  frameCorner: { 
    position: 'absolute', 
    width: 40, 
    height: 40, 
    borderColor: '#2563eb', 
    borderWidth: 3 
  },
  frameTopLeft: { 
    top: 0, 
    left: 0, 
    borderRightWidth: 0, 
    borderBottomWidth: 0, 
    borderTopLeftRadius: 8 
  },
  frameTopRight: { 
    top: 0, 
    right: 0, 
    borderLeftWidth: 0, 
    borderBottomWidth: 0, 
    borderTopRightRadius: 8 
  },
  frameBottomLeft: { 
    bottom: 0, 
    left: 0, 
    borderRightWidth: 0, 
    borderTopWidth: 0, 
    borderBottomLeftRadius: 8 
  },
  frameBottomRight: { 
    bottom: 0, 
    right: 0, 
    borderLeftWidth: 0, 
    borderTopWidth: 0, 
    borderBottomRightRadius: 8 
  },
  cameraHint: { 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 25, 
    alignSelf: 'center', 
    marginBottom: 140 
  },
  cameraHintText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 14 
  },
  cameraControls: { 
    alignItems: 'center', 
    paddingBottom: 50 
  },
  captureButton: { 
    width: 80, 
    height: 80, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  captureRing: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    borderWidth: 4, 
    borderColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  captureCenter: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },

  // Footer Navigation
  footer: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderTopColor: '#e2e8f0', 
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  footerButton: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 8 
  },
  footerLabel: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#64748b', 
    marginTop: 4 
  },

  // Modal Styles
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'flex-end' 
  },
  modalCard: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    paddingBottom: 40 
  },
  modalHeader: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#0f172a', 
    textAlign: 'center', 
    marginBottom: 20 
  },
  modalSubtext: { 
    fontSize: 14, 
    color: '#64748b', 
    textAlign: 'center', 
    marginBottom: 24 
  },
  previewPhoto: { 
    width: '100%', 
    height: 380, 
    borderRadius: 20, 
    marginBottom: 20 
  },
  confirmInfo: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 20 
  },
  confirmRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  confirmText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#334155' 
  },
  timeBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20 
  },
  timeBadgeText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 12 
  },
  submitButton: { 
    backgroundColor: '#16a34a', 
    borderRadius: 16, 
    padding: 18, 
    alignItems: 'center', 
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  submitButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '800' 
  },
  retakeButton: { 
    padding: 12, 
    alignItems: 'center' 
  },
  retakeButtonText: { 
    color: '#64748b', 
    fontSize: 15, 
    fontWeight: '600' 
  },

  // Success Screen
  successScreen: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(255,255,255,0.98)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    zIndex: 1000 
  },
  successContent: { 
    alignItems: 'center' 
  },
  successText: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#16a34a', 
    marginTop: 20 
  },
});

export default AttendanceScreen;