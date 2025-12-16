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
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, NavigationProp } from '@react-navigation/native';
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
  XCircle,
  AlertCircle,
  ChevronLeft,
  AlertTriangle,
  Clock3,
  Power,
} from 'lucide-react-native';

type RootStackParamList = {
  index: undefined;
  AttendanceScreen: undefined;
};

type AttendanceScreenNavigationProp = NavigationProp<
  RootStackParamList,
  'AttendanceScreen'
>;

type PunchType = 'IN' | 'OUT';

type AttendanceMode =
  | 'IN_OFFICE'
  | 'WORK_FROM_HOME'
  | 'ON_DUTY'
  | 'REGULARIZATION';

interface AttendanceRecord {
  punchInTime?: string;
  punchOutTime?: string;
  punchInMode?: AttendanceMode;
  punchOutMode?: AttendanceMode;
  mode?: AttendanceMode;
}

type CameraRef = React.ComponentRef<typeof CameraView>;

const API_BASE_URL = 'https://check-seven-steel.vercel.app';

const AttendanceScreen: React.FC = () => {
  const navigation = useNavigation<AttendanceScreenNavigationProp>();
  const router = useRouter();

  const [, setScreenWidth] = useState(
    Dimensions.get('window').width
  );

  useEffect(() => {
    const updateDimensions = () => {
      setScreenWidth(Dimensions.get('window').width);
    };

    const subscription = Dimensions.addEventListener(
      'change',
      updateDimensions
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraRef | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const [hasLocationPermission, setHasLocationPermission] = useState<
    boolean | null
  >(null);

  const [location, setLocation] = useState<{
    lat: number | null;
    lng: number | null;
  }>({
    lat: null,
    lng: null,
  });

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const [punchType, setPunchType] = useState<PunchType | null>(null);
  const [mode, setMode] = useState<AttendanceMode>('IN_OFFICE');

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const [isLogoutConfirming, setIsLogoutConfirming] = useState(false);

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const modeOptions: AttendanceMode[] = [
    'IN_OFFICE',
    'WORK_FROM_HOME',
    'ON_DUTY',
    'REGULARIZATION',
  ];

  const formatTime = (val?: string) => {
    if (!val) return '—';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getModeLabel = (m: AttendanceMode) => {
    switch (m) {
      case 'IN_OFFICE':
        return 'In Office';
      case 'WORK_FROM_HOME':
        return 'Work From Home';
      case 'ON_DUTY':
        return 'On Duty';
      case 'REGULARIZATION':
        return 'Regularization';
      default:
        return m;
    }
  };

  const getModeIcon = (m: AttendanceMode) => {
    switch (m) {
      case 'IN_OFFICE':
        return Wifi;
      case 'WORK_FROM_HOME':
        return HomeIcon;
      case 'ON_DUTY':
        return Briefcase;
      case 'REGULARIZATION':
        return FileText;
      default:
        return HomeIcon;
    }
  };

  const getModeDescription = (m: AttendanceMode) => {
    switch (m) {
      case 'IN_OFFICE':
        return 'Working from office premises';
      case 'WORK_FROM_HOME':
        return 'Working remotely from home';
      case 'ON_DUTY':
        return 'On field duty or client visit';
      case 'REGULARIZATION':
        return 'Regularize attendance records';
      default:
        return '';
    }
  };

  const getStatusLabel = (rec: AttendanceRecord | null): string => {
    if (!rec) return 'No attendance yet';

    const { punchInTime, punchOutTime } = rec;

    if (!punchInTime && !punchOutTime) return 'No punch-in';

    let isLate = false;
    let isGrace = false;
    let isEarlyLogout = false;

    if (punchInTime) {
      const d = new Date(punchInTime);
      const h = d.getHours();
      const m = d.getMinutes();

      const after930 = h > 9 || (h === 9 && m >= 30);
      const after935 = h > 9 || (h === 9 && m > 35);

      if (after935) {
        isLate = true;
      } else if (after930) {
        isGrace = true;
      }
    }

    if (punchOutTime) {
      const d = new Date(punchOutTime);
      const h = d.getHours();
      const m = d.getMinutes();

      const before630 = h < 18 || (h === 18 && m < 30);
      if (before630) {
        isEarlyLogout = true;
      }
    }

    const parts: string[] = [];

    if (!punchInTime && punchOutTime) {
      parts.push('No Login');
    } else if (punchInTime) {
      if (isLate) parts.push('Late Login');
      else if (isGrace) parts.push('Grace Login');
      else parts.push('On Time Login');
    }

    if (!punchOutTime && punchInTime) {
      parts.push('No Logout');
    } else if (punchOutTime) {
      if (isEarlyLogout) parts.push('Early Logout');
      else parts.push('On Time Logout');
    }
    
    if (punchInTime && punchOutTime) {
        return 'Complete | ' + parts.join(' | ');
    } else if (punchInTime && !punchOutTime) {
        return 'In Progress | ' + parts.join(' | ');
    }


    return parts.join(' | ');
  };


  const getStatusColor = (rec: AttendanceRecord | null) => {
    const status = getStatusLabel(rec);
    if (status.includes('Late') || status.includes('Early') || status.includes('No Login') || status.includes('No Logout')) {
        return '#f59e0b';
    }
    if (status.includes('On Time') || status.includes('Complete')) {
        return '#16a34a';
    }
    return '#64748b';
  };
  
  const getModeColors = (m: AttendanceMode) => {
    const ALL_MODE_COLORS = { 
        borderColor: '#06b6d4', 
        backgroundColor: '#06b6d4', 
        iconBg: '#e0f7fa', 
        iconColor: '#0e7490' 
    };

    switch (m) {
      case 'IN_OFFICE':
      case 'WORK_FROM_HOME':
      case 'ON_DUTY':
      case 'REGULARIZATION':
        return ALL_MODE_COLORS;
      default:
        return { 
          borderColor: '#e5e7eb', 
          backgroundColor: '#fff', 
          iconBg: '#f3f4f6', 
          iconColor: '#64748b' 
        };
    }
  };


  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const loadTodayAttendance = useCallback(
    async (empId: string, currentMode: AttendanceMode) => {
      try {
        setLoadingRecord(true);
        const res = await fetch(`${API_BASE_URL}/api/attendance/today`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: empId, mode: currentMode }),
        });
        const json = await res.json();
        setRecord(json.record || null);
      } catch (e) {
        console.log('Error loading today attendance:', e);
      } finally {
        setLoadingRecord(false);
      }
    },
    []
  );

  useEffect(() => {
    const loadUser = async () => {
      try {
        const id = await AsyncStorage.getItem('userEmpId');
        const storedName = await AsyncStorage.getItem('userName');
        setEmployeeId(id);
        setName(storedName);
      } catch (e) {
        console.log('Error reading AsyncStorage:', e);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const requestPermissions = async () => {
      if (!cameraPermission || !cameraPermission.granted) {
        await requestCameraPermission();
      }

      const { status: locStatus } =
        await Location.requestForegroundPermissionsAsync();

      setHasLocationPermission(locStatus === 'granted');

      if (locStatus === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({});
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        } catch (e) {
          console.log('Location error:', e);
        }
      }
    };

    requestPermissions();
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    if (!employeeId || !mode) return;
    loadTodayAttendance(employeeId, mode);
  }, [employeeId, mode, loadTodayAttendance]);

  const handleModeAndPunchSelect = (selectedMode: AttendanceMode, type: PunchType) => {
    setMode(selectedMode);
    setPunchType(type);
    setCurrentStep(2);
  };

  const handleGoBack = useCallback(() => {
    router.replace('/(tabs)/attendance');
  }, [router]);
  
  const showLogoutConfirmation = () => {
    setIsLogoutConfirming(true);
  };

  const confirmLogout = async () => {
    setIsLogoutConfirming(false); 
    try {
      await AsyncStorage.multiRemove([
        "userRole",
        "userEmpId",
        "userName",
        "userTeam",
      ]);

      Toast.show({
        type: "info",
        text1: "Logged out successfully.",
      });

      router.replace('/'); 
      
    } catch (e) {
      console.error("Logout error:", e);
      Toast.show({
        type: "error",
        text1: "Failed to log out.",
      });
    }
  };

  const handleCancelLogout = () => {
    setIsLogoutConfirming(false);
  };

  const handleStepBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setPunchType(null);
      setSubmitStatus(null);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) {
      setSubmitStatus('Camera is not ready.');
      return;
    }
    if (!employeeId) {
      setSubmitStatus('User info missing. Please log in again.');
      return;
    }
    if (!punchType || !mode) {
      setSubmitStatus('Please select Punch Type and Mode.');
      return;
    }

    try {
      setSubmitLoading(true);
      setSubmitStatus(null);
      setPreviewImage(null);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (!photo.base64) {
        setSubmitStatus('Unable to capture image. Try again.');
        setSubmitLoading(false);
        return;
      }

      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      setPreviewImage(dataUrl);
      setIsConfirming(true);
    } catch (e) {
      console.log('Capture error:', e);
      setSubmitStatus('Something went wrong while capturing image.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!previewImage || !employeeId || !punchType || !mode) {
      setSubmitStatus('Missing data for submission. Please capture again.');
      setIsConfirming(false);
      setPreviewImage(null);
      return;
    }

    try {
      setSubmitLoading(true);
      setSubmitStatus(null);

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
        const errMsg = json.error || 'Failed to submit attendance.';
        setSubmitStatus(errMsg);
      } else {
        const msg =
          punchType === 'IN'
            ? 'Punch In recorded successfully'
            : 'Punch Out recorded successfully';
        setSubmitStatus(msg);
        await loadTodayAttendance(employeeId, mode);

        setTimeout(() => {
          setCurrentStep(1);
          setPunchType(null);
          setSubmitStatus(null);
        }, 2000);
      }
    } catch (e) {
      console.log('Submit error:', e);
      setSubmitStatus('Something went wrong while submitting attendance.');
    } finally {
      setSubmitLoading(false);
      setIsConfirming(false);
      setPreviewImage(null);
    }
  };

  const handleCancelCapture = () => {
    setPreviewImage(null);
    setIsConfirming(false);
    setSubmitStatus(null);
  };

  if (!cameraPermission || hasLocationPermission === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.loadingContainer}>
        <AlertCircle size={48} color="#dc2626" />
        <Text style={styles.errorTitle}>Camera Permission Required</Text>
        <Text style={styles.errorText}>
          Please enable camera access in your device settings to use this
          feature.
        </Text>
      </View>
    );
  }

  const AttendanceStatusCard: React.FC<{ record: AttendanceRecord | null; loading: boolean }> = ({ record, loading }) => {
    const statusColor = getStatusColor(record);
    const statusLabel = getStatusLabel(record);
    const inTime = formatTime(record?.punchInTime);
    const outTime = formatTime(record?.punchOutTime);

    if (loading) {
      return (
        <View style={[styles.card, styles.loadingCard]}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingCardText}>Loading Todays Status...</Text>
        </View>
      );
    }

    if (!record || (!record.punchInTime && !record.punchOutTime)) {
      return (
        <View style={[styles.card, styles.noRecordCard]}>
          <AlertTriangle size={24} color="#f59e0b" />
          <Text style={styles.noRecordText}>No punch records yet</Text>
          <Text style={styles.noRecordSubText}>Select mode and Punch In to start your day.</Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, styles.statusCard]}>
        <View style={styles.statusHeader}>
            <Clock3 size={20} color="#111827" />
            <Text style={styles.statusTitle}>Todays Attendance</Text>
        </View>
        <View style={styles.statusRow}>
            <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Punch In</Text>
                <View style={[styles.punchStatusPill, record.punchInTime ? styles.punchInPill : styles.punchPendingPill]}>
                    <LogIn size={14} color={record.punchInTime ? '#fff' : '#64748b'}/>
                    <Text style={[styles.punchStatusText, { color: record.punchInTime ? '#fff' : '#64748b' }]}>{inTime}</Text>
                </View>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Punch Out</Text>
                <View style={[styles.punchStatusPill, record.punchOutTime ? styles.punchOutPill : styles.punchPendingPill]}>
                    <LogOut size={14} color={record.punchOutTime ? '#fff' : '#64748b'}/>
                    <Text style={[styles.punchStatusText, { color: record.punchOutTime ? '#fff' : '#64748b' }]}>{outTime}</Text>
                </View>
            </View>
        </View>

        <View style={styles.statusFooter}>
            <Text style={styles.statusFooterLabel}>Overall Status:</Text>
            <Text style={[styles.statusFooterValue, { color: statusColor }]}>
                {statusLabel}
            </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={currentStep === 1 ? handleGoBack : handleStepBack}
            style={styles.backButton}
          >
            <ChevronLeft size={24} color="#000000ff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Mark Attendance</Text>
            <Text style={styles.headerDate}>{currentDate}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={showLogoutConfirmation}>
            <Power size={22} color="#dc2626" />
          </TouchableOpacity>
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

      {currentStep === 1 && (
        <ScrollView style={styles.contentWhite} contentContainerStyle={styles.contentInnerWhite}>
          <View style={styles.userSectionWhite}>
            <Text style={styles.welcomeTextBlack}>Welcome back,</Text>
            <Text style={styles.userNameLargeBlack}>{name || 'Guest User'}</Text>
            <Text style={styles.userIdTextBlack}>ID: {employeeId || 'Not Set'}</Text>
          </View>

          <AttendanceStatusCard record={record} loading={loadingRecord} />

          {location.lat && location.lng && (
            <View style={styles.locationCardWhite}>
              <MapPin size={18} color="#16a34a" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationTitleBlack}>Current Location</Text>
                <Text style={styles.locationCoordsBlack}>
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </Text>
              </View>
              <View style={styles.locationBadge}>
                <View style={styles.locationDot} />
                <Text style={styles.locationBadgeText}>Active</Text>
              </View>
            </View>
          )}

          <View style={[styles.sectionHeader, { marginTop: 10 }]}>
            <Calendar size={20} color="#111827" />
            <Text style={styles.sectionTitleBlack}>Select Work Mode</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            <View style={styles.modeGridHorizontal}>
              {modeOptions.map((m) => {
                const Icon = getModeIcon(m);
                const colors = getModeColors(m);
                const isSelected = m === mode;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.modeCardHorizontal, 
                      { borderColor: isSelected ? colors.borderColor : '#e5e7eb' }, 
                      isSelected && { backgroundColor: colors.backgroundColor }
                    ]}
                    onPress={() => setMode(m)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.modeIconContainer, 
                      { backgroundColor: isSelected ? '#fff' : colors.iconBg }
                    ]}>
                      <Icon size={24} color={isSelected ? colors.backgroundColor : colors.iconColor} />
                    </View>
                    <Text style={[
                      styles.modeTitleBlack, 
                      isSelected && styles.modeTitleSelected,
                      isSelected && { color: '#fff' }
                    ]}>
                      {getModeLabel(m)}
                    </Text>
                    <Text style={[
                      styles.modeDescriptionBlack, 
                      isSelected && styles.modeDescriptionSelected,
                      isSelected && { color: '#e5e7eb' }
                    ]}>
                      {getModeDescription(m)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {mode && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 30 }]}>
                <Clock size={20} color="#111827" />
                <Text style={styles.sectionTitleBlack}>Select Punch Type</Text>
              </View>

              <View style={styles.punchTypeGridHorizontal}>
                <TouchableOpacity
                  style={[styles.punchCardHorizontal, punchType === 'IN' && styles.punchInSelected]}
                  onPress={() => handleModeAndPunchSelect(mode, 'IN')}
                  activeOpacity={0.7}
                  disabled={!!record?.punchInTime && mode !== 'REGULARIZATION'}
                >
                  <View style={[styles.punchIconContainerSmall, styles.punchInContainer]}>
                    <LogIn size={28} color="#16a34a" />
                  </View>
                  <Text style={[styles.punchTitleBlack, punchType === 'IN' && styles.punchTitleSelected]}>
                    Punch In
                  </Text>
                  <Text style={[styles.punchDescriptionBlack, punchType === 'IN' && styles.punchDescriptionSelected]}>
                    Start your work day
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.punchCardHorizontal, punchType === 'OUT' && styles.punchOutSelected]}
                  onPress={() => handleModeAndPunchSelect(mode, 'OUT')}
                  activeOpacity={0.7}
                  disabled={!record?.punchInTime && mode !== 'REGULARIZATION'}
                >
                  <View style={[styles.punchIconContainerSmall, styles.punchOutContainer]}>
                    <LogOut size={28} color="#dc2626" />
                  </View>
                  <Text style={[styles.punchTitleBlack, punchType === 'OUT' && styles.punchTitleSelected]}>
                    Punch Out
                  </Text>
                  <Text style={[styles.punchDescriptionBlack, punchType === 'OUT' && styles.punchDescriptionSelected]}>
                    End your work day
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </ScrollView>
      )}

      {currentStep === 2 && mode && punchType && (
        <View style={styles.cameraFullScreenLight}>
          <View style={styles.cameraTopBarLight}>
            <View style={styles.selectionChips}>
              <View style={styles.chip}>
                {React.createElement(getModeIcon(mode), { size: 14, color: '#fff' })}
                <Text style={styles.chipText}>
                  {getModeLabel(mode)}
                </Text>
              </View>
              <View style={[styles.chip, punchType === 'IN' ? styles.chipIn : styles.chipOut]}>
                {punchType === 'IN' ? (
                  <LogIn size={14} color="#fff" />
                ) : (
                  <LogOut size={14} color="#fff" />
                )}
                <Text style={styles.chipText}>
                  Punch {punchType === 'IN' ? 'In' : 'Out'}
                </Text>
              </View>
            </View>
            <View style={[styles.cameraStatusBadgeLight, cameraReady && styles.cameraStatusReadyLight]}>
              <View style={styles.cameraStatusDotLight} />
              <Text style={styles.cameraStatusTextLight}>
                {cameraReady ? 'Ready' : 'Loading'}
              </Text>
            </View>
          </View>

          <View style={styles.cameraWrapper}>
            <CameraView
              ref={cameraRef}
              style={styles.cameraFull}
              facing="front"
              onCameraReady={() => setCameraReady(true)}
            />
            {!cameraReady && (
              <View style={styles.cameraOverlayLight}>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.cameraLoadingTextLight}>Initializing camera...</Text>
              </View>
            )}

          </View>

          <View style={styles.cameraBottomBarLight}>
            <Text style={styles.cameraInstructionLight}>
              Tap the button to capture your photo
            </Text>
            <TouchableOpacity
              onPress={handleCapture}
              disabled={submitLoading || !cameraReady}
              style={[
                styles.captureButtonLarge,
                (submitLoading || !cameraReady) && styles.captureButtonDisabled,
              ]}
            >
              <View style={styles.captureButtonInner}>
                {submitLoading ? (
                  <ActivityIndicator color="#2563eb" size="large" />
                ) : (
                  <Camera size={32} color="#2563eb" />
                )}
              </View>
            </TouchableOpacity>
            {submitStatus && !submitStatus.includes('successfully') && (
              <View style={styles.errorBannerLight}>
                <XCircle size={16} color="#dc2626" />
                <Text style={styles.errorBannerTextLight}>{submitStatus}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <Modal visible={isConfirming} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AlertCircle size={24} color="#f59e0b" />
              <Text style={styles.modalTitle}>Confirm Attendance</Text>
            </View>
            <Text style={styles.modalDescription}>
              Please verify the captured image and details before submitting
              your{' '}
              <Text style={styles.modalBold}>
                {punchType === 'IN' ? 'PUNCH IN' : 'PUNCH OUT'}
              </Text>{' '}
              for{' '}
              <Text style={styles.modalBold}>{mode && getModeLabel(mode)}</Text>.
            </Text>

            <View style={styles.modalInfoCard}>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Type</Text>
                <View style={styles.modalInfoBadge}>
                  <Text style={styles.modalInfoValue}>{punchType}</Text>
                </View>
              </View>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Mode</Text>
                <View style={styles.modalInfoBadge}>
                  <Text style={styles.modalInfoValue}>
                    {mode && getModeLabel(mode)}
                  </Text>
                </View>
              </View>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Location</Text>
                <Text style={styles.modalInfoCoords}>
                  {location.lat && location.lng
                    ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                    : 'N/A'}
                </Text>
              </View>
            </View>

            {previewImage && (
              <View style={styles.previewImageContainer}>
                <Image
                  source={{ uri: previewImage }}
                  style={[styles.previewImage, styles.mirroredImage]}
                  resizeMode="cover"
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButtonPrimary,
                  submitLoading && styles.modalButtonDisabled,
                ]}
                onPress={handleConfirmSubmit}
                disabled={submitLoading}
              >
                {submitLoading ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.modalButtonPrimaryText}>
                      Submitting...
                    </Text>
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} color="#fff" />
                    <Text style={styles.modalButtonPrimaryText}>
                      Confirm & Submit
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={handleCancelCapture}
                disabled={submitLoading}
              >
                <XCircle size={18} color="#fff" />
                <Text style={styles.modalButtonSecondaryText}>Retake</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isLogoutConfirming} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.logoutModal]}>
            <View style={styles.modalHeader}>
              <Power size={24} color="#dc2626" />
              <Text style={styles.modalTitle}>Confirm Logout</Text>
            </View>
            <Text style={styles.modalDescription}>
              Are you sure you want to log out? You will need to enter your credentials to access the app again.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButtonSecondary, styles.modalButtonFullWidth]}
                onPress={handleCancelLogout}
              >
                <XCircle size={18} color="#fff" />
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButtonPrimary, styles.modalButtonLogout, styles.modalButtonFullWidth]}
                onPress={confirmLogout}
              >
                <LogOut size={18} color="#fff" />
                <Text style={styles.modalButtonPrimaryText}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {submitStatus && submitStatus.includes('successfully') && (
        <View style={styles.successOverlay}>
          <View style={styles.successContent}>
            <CheckCircle size={64} color="#16a34a" />
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successMessage}>{submitStatus}</Text>
          </View>
        </View>
      )}
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 300,
  },
  header: {
    backgroundColor: '#ffffffff',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 12,
  },
  logoutButton: {
    padding: 8,
    marginRight: 8, 
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000ff',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    gap: 8,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#9ca3af',
  },
  stepCircleActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  stepLabelActive: {
    color: '#000000ff',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#9ca3af',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#2563eb',
  },
  contentWhite: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentInnerWhite: {
    padding: 20,
  },
  userSectionWhite: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  welcomeTextBlack: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  userNameLargeBlack: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  userIdTextBlack: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
  },
  locationCardWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  locationInfo: {
    flex: 1,
  },
  locationTitleBlack: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  locationCoordsBlack: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  locationDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  locationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitleBlack: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  horizontalScroll: {
    paddingBottom: 10,
    marginBottom: 10,
  },
  modeGridHorizontal: {
    flexDirection: 'row',
    gap: 12,
  },
  modeCardHorizontal: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    height: 140,
    justifyContent: 'space-between',
  },
  modeCardSelected: {
    
  },
  modeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 24,
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 8,
  },
  modeIconContainerSelected: {
    borderRadius: 24,
  },
  modeTitleBlack: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modeTitleSelected: {
    
  },
  modeDescriptionBlack: {
    fontSize: 10,
    color: '#6b7280',
    lineHeight: 14,
  },
  modeDescriptionSelected: {
    
  },
  punchTypeGridHorizontal: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  punchCardHorizontal: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    height: 150,
    justifyContent: 'space-between',
  },
  punchInSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#16a34a',
  },
  punchOutSelected: {
    borderColor: '#dc2626',
    backgroundColor: '#dc2626',
  },
  punchIconContainerSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchInContainer: {
    backgroundColor: '#dcfce7',
  },
  punchOutContainer: {
    backgroundColor: '#fee2e2',
  },
  punchTitleBlack: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  punchTitleSelected: {
    color: '#fff',
  },
  punchDescriptionBlack: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  punchDescriptionSelected: {
    color: '#f3f4f6',
  },
  cameraFullScreenLight: {
    flex: 1,
    backgroundColor: '#fff',
  },
  cameraTopBarLight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  selectionChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipIn: {
    backgroundColor: '#16a34a',
  },
  chipOut: {
    backgroundColor: '#dc2626',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  cameraStatusBadgeLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  cameraStatusReadyLight: {
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
  },
  cameraStatusDotLight: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  cameraStatusTextLight: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f2937',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  cameraFull: {
    flex: 1,
  },
  cameraOverlayLight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  cameraLoadingTextLight: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  cameraBottomBarLight: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cameraInstructionLight: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  captureButtonLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#2563eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBannerLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorBannerTextLight: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutModal: {
    maxWidth: 340,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  modalDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBold: {
    fontWeight: '700',
    color: '#fff',
  },
  modalInfoCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  modalInfoBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  modalInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  modalInfoCoords: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  previewImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewImage: {
    width: '100%',
    height: 240,
  },
  mirroredImage: {
    transform: [{ scaleX: -1 }],
  },
  modalActions: {
    gap: 12,
  },
  modalButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
  },
  modalButtonLogout: {
    backgroundColor: '#dc2626', 
  },
  modalButtonDisabled: {
    backgroundColor: '#64748b',
    opacity: 0.6,
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    paddingVertical: 14,
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalButtonFullWidth: {
    width: '100%',
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successContent: {
    alignItems: 'center',
    gap: 16,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  successMessage: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    height: 100,
  },
  loadingCardText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
  noRecordCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    alignItems: 'center',
  },
  noRecordText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f59e0b',
    marginTop: 8,
  },
  noRecordSubText: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 10,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  punchStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 8,
  },
  punchInPill: {
    backgroundColor: '#16a34a',
  },
  punchOutPill: {
    backgroundColor: '#dc2626',
  },
  punchPendingPill: {
    backgroundColor: '#e5e7eb',
  },
  punchStatusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  statusDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#d1d5db',
    marginHorizontal: 10,
  },
  statusFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  statusFooterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  statusFooterValue: {
    fontSize: 14,
    fontWeight: '800',
  },
});

export default AttendanceScreen;