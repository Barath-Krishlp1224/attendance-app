import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";

import TopBar from "../../components/common/TopBar";
import FooterNav from "../../components/leave_feature/components/FooterNav";
import KeyboardAwareScrollView from "../../components/ui/keyboard-aware-scroll-view";
import {
  API_BASE_URL,
  canReviewOnboarding,
  getMobileAuthHeaders,
  getMobileUserSession,
  type MobileUserSession,
} from "../../utils/mobileSession";

type EmployeeSummary = {
  empId: string;
  name: string;
  team?: string;
  department?: string;
  designation?: string;
  mailId?: string;
  phoneNumber?: string;
  joiningDate?: string;
  photo?: string;
  employmentStatus?: string;
};

type EmployeeDetail = EmployeeSummary & {
  fatherName?: string;
  dateOfBirth?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  workLocation?: string;
  aadharDoc?: string;
  panDoc?: string;
  tenthMarksheet?: string;
  twelfthMarksheet?: string;
  provisionalCertificate?: string;
  experienceCertificate?: string;
  confirmationCertificate?: string;
  signedHrInduction?: string;
  signedLaptopPolicy?: string;
};

const documentFields: { key: keyof EmployeeDetail; label: string; required: boolean }[] = [
  { key: "photo", label: "Profile Photo", required: true },
  { key: "aadharDoc", label: "Aadhaar", required: true },
  { key: "panDoc", label: "PAN", required: true },
  { key: "tenthMarksheet", label: "10th Marksheet", required: true },
  { key: "twelfthMarksheet", label: "12th Marksheet", required: true },
  { key: "provisionalCertificate", label: "Provisional Certificate", required: true },
  { key: "experienceCertificate", label: "Experience Certificate", required: false },
  { key: "confirmationCertificate", label: "Confirmation Certificate", required: false },
  { key: "signedHrInduction", label: "Signed HR Induction", required: true },
  { key: "signedLaptopPolicy", label: "Signed Laptop Policy", required: true },
];

const formatDate = (value?: string) => {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusTone = (completionRate: number) => {
  if (completionRate >= 100) {
    return { label: "Complete", bg: "#dcfce7", text: "#166534" };
  }
  if (completionRate > 0) {
    return { label: "In Progress", bg: "#fef3c7", text: "#92400e" };
  }
  return { label: "Pending", bg: "#fee2e2", text: "#991b1b" };
};

export default function OnboardingScreen() {
  const [session, setSession] = useState<MobileUserSession | null>(null);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canReview = useMemo(
    () =>
      session
        ? canReviewOnboarding(session.userRole, session.userTeam, session.userDesignation)
        : false,
    [session]
  );

  const loadEmployeeDetail = useCallback(async (empId: string, headers: Record<string, string>) => {
    const response = await fetch(`${API_BASE_URL}/api/employees/get/${encodeURIComponent(empId)}`, {
      headers,
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok || !json?.success) {
      throw new Error(json?.message || "Unable to load onboarding details.");
    }
    return json.employee as EmployeeDetail;
  }, []);

  const loadDirectory = useCallback(async (headers: Record<string, string>) => {
    const response = await fetch(`${API_BASE_URL}/api/employees/list?scope=active`, {
      headers,
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok || !json?.success) {
      throw new Error(json?.message || "Unable to load employee onboarding list.");
    }
    return (Array.isArray(json.employees) ? json.employees : []) as EmployeeSummary[];
  }, []);

  const loadScreen = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const currentSession = await getMobileUserSession();
        const headers = await getMobileAuthHeaders();
        setSession(currentSession);

        const reviewer = canReviewOnboarding(
          currentSession.userRole,
          currentSession.userTeam,
          currentSession.userDesignation
        );

        if (reviewer) {
          const directory = await loadDirectory(headers);
          setEmployees(directory);
          const nextEmpId =
            selectedEmpId ||
            currentSession.userEmpId ||
            directory.find((employee) => employee.empId)?.empId ||
            "";
          if (nextEmpId) {
            const employee = await loadEmployeeDetail(nextEmpId, headers);
            setSelectedEmpId(nextEmpId);
            setSelectedEmployee(employee);
          } else {
            setSelectedEmployee(null);
          }
        } else if (currentSession.userEmpId) {
          const employee = await loadEmployeeDetail(currentSession.userEmpId, headers);
          setEmployees([employee]);
          setSelectedEmpId(currentSession.userEmpId);
          setSelectedEmployee(employee);
        } else {
          setEmployees([]);
          setSelectedEmployee(null);
        }
      } catch (error) {
        console.error("Onboarding load failed:", error);
        Alert.alert("Unable to load onboarding", error instanceof Error ? error.message : "Please try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadDirectory, loadEmployeeDetail, selectedEmpId]
  );

  useEffect(() => {
    loadScreen();
  }, [loadScreen]);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => {
      const text = `${employee.name} ${employee.empId} ${employee.designation || ""} ${employee.department || ""}`.toLowerCase();
      return text.includes(query);
    });
  }, [employees, searchQuery]);

  const documentSummary = useMemo(() => {
    const uploaded = documentFields.filter((item) => Boolean(selectedEmployee?.[item.key])).length;
    const required = documentFields.filter((item) => item.required).length;
    const uploadedRequired = documentFields.filter((item) => item.required && Boolean(selectedEmployee?.[item.key])).length;
    const completionRate = required ? Math.round((uploadedRequired / required) * 100) : 0;

    return {
      uploaded,
      total: documentFields.length,
      completionRate,
      tone: getStatusTone(completionRate),
    };
  }, [selectedEmployee]);

  const handleOpenDocument = async (url?: string) => {
    if (!url) {
      Alert.alert("Document missing", "This document has not been uploaded yet.");
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.error("Unable to open document:", error);
      Alert.alert("Unable to open document", "Please try again in a moment.");
    }
  };

  const handleSelectEmployee = async (empId: string) => {
    try {
      setSelectedEmpId(empId);
      const headers = await getMobileAuthHeaders();
      const employee = await loadEmployeeDetail(empId, headers);
      setSelectedEmployee(employee);
    } catch (error) {
      console.error("Failed to load employee onboarding:", error);
      Alert.alert("Unable to open employee", error instanceof Error ? error.message : "Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading onboarding details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        extraScrollHeight={120}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadScreen(true)} />}>
        <TopBar subtitle="Employee Onboarding" />

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>
            {canReview ? "Review employee onboarding records, uploaded documents, and completion status." : "Track your onboarding documents and completion status in one place."}
          </Text>
          <Text style={styles.heroSubtitle}>
            The onboarding view stays responsive on mobile and shows the same core employee documentation used in the web app.
          </Text>
        </View>

        {canReview ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Employee Directory</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by employee name, ID, or department"
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
            />
            <View style={styles.employeeGrid}>
              {filteredEmployees.map((employee) => {
                const active = employee.empId === selectedEmpId;
                return (
                  <TouchableOpacity
                    key={employee.empId}
                    onPress={() => handleSelectEmployee(employee.empId)}
                    style={[styles.employeeCard, active && styles.employeeCardActive]}
                    activeOpacity={0.85}>
                    <Text style={styles.employeeName}>{employee.name}</Text>
                    <Text style={styles.employeeMeta}>
                      {employee.empId} • {employee.designation || employee.department || "Employee"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {selectedEmployee ? (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.headerRow}>
                <View style={styles.headerTextBlock}>
                  <Text style={styles.sectionTitle}>{selectedEmployee.name}</Text>
                  <Text style={styles.employeeMeta}>
                    {selectedEmployee.empId} • {selectedEmployee.designation || selectedEmployee.team || "Employee"}
                  </Text>
                  <Text style={styles.employeeMeta}>
                    {selectedEmployee.department || "Department not set"} • Joined {formatDate(selectedEmployee.joiningDate)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: documentSummary.tone.bg }]}>
                  <Text style={[styles.statusText, { color: documentSummary.tone.text }]}>{documentSummary.tone.label}</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Required Completion</Text>
                  <Text style={styles.statValue}>{documentSummary.completionRate}%</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Uploaded Docs</Text>
                  <Text style={styles.statValue}>
                    {documentSummary.uploaded}/{documentSummary.total}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Employee Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Father Name</Text>
                <Text style={styles.infoValue}>{selectedEmployee.fatherName || "Not available"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date of Birth</Text>
                <Text style={styles.infoValue}>{formatDate(selectedEmployee.dateOfBirth)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{selectedEmployee.mailId || "Not available"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>{selectedEmployee.phoneNumber || "Not available"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bank</Text>
                <Text style={styles.infoValue}>{selectedEmployee.bankName || "Not available"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account / IFSC</Text>
                <Text style={styles.infoValue}>
                  {selectedEmployee.accountNumber || "Not available"} / {selectedEmployee.ifscCode || "Not available"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Work Location</Text>
                <Text style={styles.infoValue}>{selectedEmployee.workLocation || "Not available"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Employment Status</Text>
                <Text style={styles.infoValue}>{selectedEmployee.employmentStatus || "active"}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Uploaded Documents</Text>
              <View style={styles.documentsList}>
                {documentFields.map((doc) => {
                  const url = selectedEmployee[doc.key];
                  const available = Boolean(url);
                  return (
                    <View key={doc.key} style={styles.documentCard}>
                      <View style={styles.documentCopy}>
                        <Text style={styles.documentTitle}>{doc.label}</Text>
                        <Text style={[styles.documentStatus, available ? styles.documentStatusReady : styles.documentStatusMissing]}>
                          {available ? "Uploaded" : "Missing"}
                          {doc.required ? " • Required" : " • Optional"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleOpenDocument(typeof url === "string" ? url : undefined)}
                        style={[styles.documentButton, !available && styles.documentButtonDisabled]}
                        activeOpacity={0.85}>
                        <Text style={[styles.documentButtonText, !available && styles.documentButtonTextDisabled]}>
                          {available ? "Open" : "Pending"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.emptyText}>No onboarding information is available for this account yet.</Text>
          </View>
        )}
      </KeyboardAwareScrollView>

      <FooterNav activeTab="onboarding" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 126,
    gap: 16,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: "#132238",
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  heroTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#f8fafc",
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#cbd5e1",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
  },
  employeeGrid: {
    gap: 10,
  },
  employeeCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  employeeCardActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#93c5fd",
  },
  employeeName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  employeeMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "#eff6ff",
    gap: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 14,
    lineHeight: 20,
    color: "#0f172a",
    fontWeight: "600",
  },
  documentsList: {
    gap: 10,
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 14,
  },
  documentCopy: {
    flex: 1,
    gap: 4,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  documentStatus: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  documentStatusReady: {
    color: "#166534",
  },
  documentStatusMissing: {
    color: "#b45309",
  },
  documentButton: {
    borderRadius: 14,
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  documentButtonDisabled: {
    backgroundColor: "#e2e8f0",
  },
  documentButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
  },
  documentButtonTextDisabled: {
    color: "#64748b",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 21,
  },
});
