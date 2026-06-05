import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
  Building2,
  Camera,
  CheckCircle,
  ChevronLeft,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  Navigation,
  User
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import FooterNav, {
  getFooterNavClearance,
} from '../../components/leave_feature/components/FooterNav';
import TopBar from '../../components/common/TopBar';
import KeyboardAwareScrollView from '../../components/ui/keyboard-aware-scroll-view';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Constants & Helpers ---
const BRANCHES = [
  { id: 1, name: "Lp Saaram Office", lat: 11.939198361614558, lon: 79.81654494108358, radius: 500 },
  { id: 2, name: "Lp Tidel Office", lat: 11.995967441546023, lon: 79.76744798792814, radius: 1000 },
];
const API_BASE_URL = 'https://unity-uat.lemonpay.in';

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
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (type === 'OUT') {
    const earlyLogoutLimit = 18 * 60;

    if (totalMinutes < earlyLogoutLimit) {
      return {
        label: 'Early Logout',
        color: '#dc2626',
        requiresComment: true,
        commentLabel: 'Reason for early logout',
      };
    }

    return {
      label: 'Punch Out',
      color: '#64748b',
      requiresComment: false,
      commentLabel: '',
    };
  }

  const onTimeLimit = 9 * 60;
  const graceLimit = 9 * 60 + 15;

  if (totalMinutes <= onTimeLimit) {
    return {
      label: 'On Time',
      color: '#16a34a',
      requiresComment: false,
      commentLabel: '',
    };
  }

  if (totalMinutes <= graceLimit) {
    return {
      label: 'Grace Period',
      color: '#f59e0b',
      requiresComment: false,
      commentLabel: '',
    };
  }

  return {
    label: 'Late Entry',
    color: '#dc2626',
    requiresComment: true,
    commentLabel: 'Reason for late punch in',
  };
};

// --- Types ---
type PunchType = 'IN' | 'OUT';

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
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraRef | null>(null);
  const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [punchType, setPunchType] = useState<PunchType | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isOutOfRangeConfirming, setIsOutOfRangeConfirming] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [attendanceComment, setAttendanceComment] = useState('');
  const [outOfRangeReason, setOutOfRangeReason] = useState('');
  const [outOfRangeDistance, setOutOfRangeDistance] = useState<number | null>(null);
  const [locationOverrideAllowed, setLocationOverrideAllowed] = useState(false);
  const [pendingBranch, setPendingBranch] = useState<Branch | null>(null);

  const resolveCurrentLocation = useCallback(async () => {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      throw new Error("Location services disabled");
    }

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const nextLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setLocation(nextLocation);
    return nextLocation;
  }, []);

  const loadTodayAttendance = useCallback(async (empId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/today`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load attendance (status):", res.status, text);
        return;
      }

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const json = await res.json();
        setRecord(json.record || null);
      } else {
        const text = await res.text();
        console.error("Failed to load attendance (Non-JSON response):", text);
      }
    } catch (e) {
      console.error("Failed to load attendance (network/parse error):", e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const id = await AsyncStorage.getItem('userEmpId');
        const storedName = await AsyncStorage.getItem('userName');
        setEmployeeId(id);
        setName(storedName);

        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus === 'granted') {
          try {
            await resolveCurrentLocation();
          } catch (error) {
            console.warn("Initial location unavailable:", error);
            Toast.show({
              type: 'info',
              text1: 'Location unavailable',
              text2: 'Enable device location to check branch range.',
            });
          }
        }

        if (!cameraPermission?.granted) await requestCameraPermission();
      } catch (error) {
        console.error("Attendance initialization failed:", error);
      }
    };
    void init();
  }, [cameraPermission, requestCameraPermission, resolveCurrentLocation]);

  useEffect(() => {
    if (employeeId) loadTodayAttendance(employeeId);
  }, [employeeId, loadTodayAttendance]);

  const refreshCurrentLocation = useCallback(async () => resolveCurrentLocation(), [resolveCurrentLocation]);

  const checkBranchDistance = (branch: Branch) => {
    if (!location.lat || !location.lng) return { inRange: false, distance: 0 };
    const distance = getDistanceMeters(location.lat, location.lng, branch.lat, branch.lon);
    return { inRange: distance <= branch.radius, distance };
  };

  const continueWithOutOfRangeBranch = () => {
    const trimmedReason = outOfRangeReason.trim();

    if (!trimmedReason) {
      Toast.show({
        type: 'error',
        text1: 'Reason Required',
        text2: 'Please enter the reason to continue from this location.',
      });
      return;
    }

    if (!pendingBranch) return;

    setSelectedBranch(pendingBranch);
    setLocationOverrideAllowed(true);
    setIsOutOfRangeConfirming(false);
    setCurrentStep(2);
  };

  const handleBranchSelect = async (branch: Branch) => {
    let currentLocation = location;

    if (!currentLocation.lat || !currentLocation.lng) {
      try {
        currentLocation = await refreshCurrentLocation();
      } catch {
        Toast.show({
          type: 'error',
          text1: 'Location Unavailable',
          text2: 'Please enable location and try again.',
        });
        return;
      }
    }

    const distance = getDistanceMeters(currentLocation.lat!, currentLocation.lng!, branch.lat, branch.lon);
    const inRange = distance <= branch.radius;

    if (!inRange) {
      setPendingBranch(branch);
      setOutOfRangeDistance(distance);
      setOutOfRangeReason('');
      setIsOutOfRangeConfirming(true);
      return;
    }

    setSelectedBranch(branch);
    setPendingBranch(null);
    setOutOfRangeDistance(null);
    setOutOfRangeReason('');
    setLocationOverrideAllowed(false);
    setCurrentStep(2);
  };

  const handlePunchTypeSelect = (type: PunchType) => {
    setPunchType(type);
    setAttendanceComment('');
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
    } catch {
      Toast.show({ type: 'error', text1: 'Capture Failed' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!previewImage || !employeeId || !punchType || !selectedBranch) return;
    const trimmedComment = attendanceComment.trim();

    if (timeStatus?.requiresComment && !trimmedComment) {
      Toast.show({
        type: 'error',
        text1: 'Comment Required',
        text2: 'Please enter the reason before submitting attendance.',
      });
      return;
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
          branchId: selectedBranch?.id,
          branchName: selectedBranch?.name,
          comment: trimmedComment || undefined,
          remarks: trimmedComment || undefined,
          outOfRangeReason: locationOverrideAllowed ? outOfRangeReason.trim() : undefined,
          locationOverrideReason: locationOverrideAllowed ? outOfRangeReason.trim() : undefined,
          allowOutOfRangePunch: locationOverrideAllowed || undefined,
          outOfRangeDistance: locationOverrideAllowed ? outOfRangeDistance : undefined,
        }),
      });

      let json;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        json = await res.json();
      } else {
        const text = await res.text();
        console.error("Attendance submission error (Non-JSON):", text);
        Toast.show({ type: 'error', text1: 'Submission Failed', text2: 'Invalid response from server' });
        return;
      }

      if (!res.ok) {
        Toast.show({ type: 'error', text1: json.error || 'Failed' });
      } else {
        setSubmitStatus('successfully recorded');
        await loadTodayAttendance(employeeId);
        setTimeout(() => {
          setCurrentStep(1);
          setPunchType(null);
          setSelectedBranch(null);
          setSubmitStatus(null);
          setAttendanceComment('');
          setOutOfRangeReason('');
          setOutOfRangeDistance(null);
          setLocationOverrideAllowed(false);
          setPendingBranch(null);
        }, 2000);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Network Error' });
    } finally {
      setSubmitLoading(false);
      setIsConfirming(false);
      setPreviewImage(null);
      if (!submitStatus) {
        setAttendanceComment('');
      }
    }
  };

  const formatTime = (val?: string) => {
    if (!val) return '—';
    return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const timeStatus = punchType ? getTimeStatus(punchType) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Professional Header */}
      {currentStep !== 3 && (
        <TopBar>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(currentStep / 3) * 100}%` }]} />
            </View>
            <View style={styles.stepLabels}>
              <Text style={[styles.stepLabel, currentStep >= 1 && styles.stepLabelActive]}>Branch</Text>
              <Text style={[styles.stepLabel, currentStep >= 2 && styles.stepLabelActive]}>Action</Text>
              <Text style={[styles.stepLabel, currentStep >= 3 && styles.stepLabelActive]}>Verify</Text>
            </View>
          </View>
        </TopBar>
      )}

      {/* STEP 1: Branch Selection */}
      {currentStep === 1 && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: getFooterNavClearance(insets.bottom) }}
          showsVerticalScrollIndicator={false}>
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

          <TouchableOpacity style={styles.regularizationCard} onPress={() => router.push("/regularization")}>
            <View>
              <Text style={styles.regularizationTitle}>Attendance Regularization</Text>
              <Text style={styles.regularizationSubtitle}>Fix missed or incorrect punch records</Text>
            </View>
            <MessageSquare size={20} color="#2563eb" />
          </TouchableOpacity>

          {/* Conditional Content */}
          {record?.punchInTime && record?.punchOutTime ? (
            <View style={styles.completedContainer}>
              <View style={styles.completedIcon}>
                <CheckCircle size={48} color="#16a34a" />
              </View>
              <Text style={styles.completedTitle}>All Done!</Text>
              <Text style={styles.completedSubtitle}>Attendance completed for today</Text>
            </View>
          ) : (
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
              onPress={() => setCurrentStep(2)}
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
        <FooterNav activeTab="attendance" />
      )}

      {/* Confirmation Modal */}
      <Modal visible={isConfirming} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <KeyboardAwareScrollView
            contentContainerStyle={styles.modalScrollContent}
            avoidKeyboard={false}
            extraScrollHeight={130}>
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
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {timeStatus && (
                  <View style={[styles.timeBadge, { backgroundColor: timeStatus.color }]}>
                    <Text style={styles.timeBadgeText}>{timeStatus.label}</Text>
                  </View>
                )}
              </View>

              {timeStatus?.requiresComment && (
                <View style={styles.commentSection}>
                  <Text style={styles.commentLabel}>{timeStatus.commentLabel}</Text>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Type your comment here"
                    placeholderTextColor="#94a3b8"
                    value={attendanceComment}
                    onChangeText={setAttendanceComment}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              )}

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
                onPress={() => {
                  setIsConfirming(false);
                  setAttendanceComment('');
                }}
              >
                <Text style={styles.retakeButtonText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isOutOfRangeConfirming} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <KeyboardAwareScrollView
            contentContainerStyle={styles.modalScrollContent}
            avoidKeyboard={false}
            extraScrollHeight={130}>
            <View style={styles.modalCard}>
              <Text style={styles.modalHeader}>Out of Range</Text>
              <Text style={styles.modalSubtext}>
                Your current location is outside the selected branch radius. Enter a reason to continue.
              </Text>

              <View style={styles.overrideInfoCard}>
                <Text style={styles.overrideInfoLabel}>Selected Branch</Text>
                <Text style={styles.overrideInfoValue}>{pendingBranch?.name || '-'}</Text>

                <Text style={styles.overrideInfoLabel}>Current Location</Text>
                <Text style={styles.overrideInfoValue}>
                  {location.lat && location.lng
                    ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                    : 'Location unavailable'}
                </Text>

                <Text style={styles.overrideInfoLabel}>Distance</Text>
                <Text style={styles.overrideInfoValue}>
                  {outOfRangeDistance !== null && pendingBranch
                    ? `${outOfRangeDistance}m from branch`
                    : '-'}
                </Text>
              </View>

              <View style={styles.commentSection}>
                <Text style={styles.commentLabel}>Reason for punching from this location</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Type your reason here"
                  placeholderTextColor="#94a3b8"
                  value={outOfRangeReason}
                  onChangeText={setOutOfRangeReason}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={continueWithOutOfRangeBranch}>
                <Text style={styles.submitButtonText}>Continue Anyway</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.retakeButton}
                onPress={() => {
                  setIsOutOfRangeConfirming(false);
                  setPendingBranch(null);
                  setOutOfRangeReason('');
                  setOutOfRangeDistance(null);
                }}>
                <Text style={styles.retakeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
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
  regularizationCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  regularizationTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  regularizationSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#475569',
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
    textAlign: 'center',
    width: '100%',
    lineHeight: 14,
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
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
  commentSection: {
    marginBottom: 20,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  commentInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  overrideInfoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 6,
  },
  overrideInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  overrideInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
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
