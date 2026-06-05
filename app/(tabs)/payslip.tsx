import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Switch,
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
  canManagePayroll,
  getMobileAuthHeaders,
  getMobileUserSession,
  type MobileUserSession,
} from "../../utils/mobileSession";
import {
  buildPayrollBreakdown,
  formatCurrency,
  normalizePayrollNumberInput,
} from "../../utils/payroll";

type SalaryHistoryEntry = {
  monthKey?: string;
  creditedDate?: string;
  paymentDate?: string;
  payslipDate?: string;
  s3Url?: string;
  fileName?: string;
  canceled?: boolean;
  canceledAt?: string;
};

type EmployeeRecord = {
  _id?: string;
  empId: string;
  name: string;
  displayName?: string;
  team?: string;
  department?: string;
  designation?: string;
  role?: string;
  joiningDate?: string;
  bankName?: string;
  ifscCode?: string;
  accountNumber?: string;
  workLocation?: string;
  pfNumber?: string;
  payslipVisible?: boolean;
  deductionsEnabled?: boolean;
  salary?: number;
  netSalary?: number;
  basic?: number;
  hra?: number;
  specialAllowance?: number;
  bonus?: number;
  overtime?: number;
  pf?: number;
  esi?: number;
  incomeTax?: number;
  professionalTax?: number;
  healthInsurance?: number;
  loanRecovery?: number;
  lop?: number;
  employerPfContribution?: number;
  salaryHistory?: SalaryHistoryEntry[];
};

type PayrollFormState = {
  bankName: string;
  ifscCode: string;
  accountNumber: string;
  workLocation: string;
  pfNumber: string;
  basic: string;
  hra: string;
  specialAllowance: string;
  bonus: string;
  overtime: string;
  pf: string;
  esi: string;
  incomeTax: string;
  professionalTax: string;
  healthInsurance: string;
  loanRecovery: string;
  lop: string;
  employerPfContribution: string;
  deductionsEnabled: boolean;
  payslipVisible: boolean;
};

const defaultFormState: PayrollFormState = {
  bankName: "",
  ifscCode: "",
  accountNumber: "",
  workLocation: "",
  pfNumber: "",
  basic: "",
  hra: "",
  specialAllowance: "",
  bonus: "",
  overtime: "",
  pf: "",
  esi: "",
  incomeTax: "",
  professionalTax: "",
  healthInsurance: "",
  loanRecovery: "",
  lop: "",
  employerPfContribution: "",
  deductionsEnabled: false,
  payslipVisible: false,
};

const editableFields: { key: keyof PayrollFormState; label: string; keyboardType?: "default" | "numeric" }[] = [
  { key: "bankName", label: "Bank Name" },
  { key: "ifscCode", label: "IFSC Code" },
  { key: "accountNumber", label: "Account Number" },
  { key: "workLocation", label: "Work Location" },
  { key: "pfNumber", label: "PF Number" },
  { key: "basic", label: "Basic", keyboardType: "numeric" },
  { key: "hra", label: "HRA", keyboardType: "numeric" },
  { key: "specialAllowance", label: "Special Allowance", keyboardType: "numeric" },
  { key: "bonus", label: "Bonus", keyboardType: "numeric" },
  { key: "overtime", label: "Overtime", keyboardType: "numeric" },
  { key: "pf", label: "Provident Fund", keyboardType: "numeric" },
  { key: "esi", label: "ESI", keyboardType: "numeric" },
  { key: "incomeTax", label: "Income Tax", keyboardType: "numeric" },
  { key: "professionalTax", label: "Professional Tax", keyboardType: "numeric" },
  { key: "healthInsurance", label: "Health Insurance", keyboardType: "numeric" },
  { key: "loanRecovery", label: "Loan Recovery", keyboardType: "numeric" },
  { key: "lop", label: "LOP", keyboardType: "numeric" },
  { key: "employerPfContribution", label: "Employer PF Contribution", keyboardType: "numeric" },
];

const toFormState = (employee: EmployeeRecord | null): PayrollFormState => {
  if (!employee) return defaultFormState;

  return {
    bankName: employee.bankName || "",
    ifscCode: employee.ifscCode || "",
    accountNumber: employee.accountNumber || "",
    workLocation: employee.workLocation || "",
    pfNumber: employee.pfNumber || "",
    basic: employee.basic?.toString() || "",
    hra: employee.hra?.toString() || "",
    specialAllowance: employee.specialAllowance?.toString() || "",
    bonus: employee.bonus?.toString() || "",
    overtime: employee.overtime?.toString() || "",
    pf: employee.pf?.toString() || "",
    esi: employee.esi?.toString() || "",
    incomeTax: employee.incomeTax?.toString() || "",
    professionalTax: employee.professionalTax?.toString() || "",
    healthInsurance: employee.healthInsurance?.toString() || "",
    loanRecovery: employee.loanRecovery?.toString() || "",
    lop: employee.lop?.toString() || "",
    employerPfContribution: employee.employerPfContribution?.toString() || "",
    deductionsEnabled: Boolean(employee.deductionsEnabled),
    payslipVisible: Boolean(employee.payslipVisible),
  };
};

const formatMonthLabel = (entry: SalaryHistoryEntry) => {
  const raw = entry.monthKey || entry.creditedDate || entry.paymentDate || entry.payslipDate;
  if (!raw) return "Unknown period";

  if (/^\d{4}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}-01T00:00:00`);
    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

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

const getBottomClearance = () => 124;

const StatCard = ({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warn" }) => (
  <View
    style={[
      styles.statCard,
      tone === "success" && styles.statCardSuccess,
      tone === "warn" && styles.statCardWarn,
    ]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const PayrollInput = ({
  label,
  value,
  keyboardType,
  onChangeText,
}: {
  label: string;
  value: string;
  keyboardType?: "default" | "numeric";
  onChangeText: (value: string) => void;
}) => (
  <View style={styles.inputField}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      style={styles.input}
      placeholder={label}
      placeholderTextColor="#94a3b8"
    />
  </View>
);

export default function PayslipScreen() {
  const [session, setSession] = useState<MobileUserSession | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [form, setForm] = useState<PayrollFormState>(defaultFormState);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const managePayroll = useMemo(
    () =>
      session
        ? canManagePayroll(session.userRole, session.userTeam, session.userDesignation)
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
      throw new Error(json?.message || "Unable to load payslip details.");
    }

    return json.employee as EmployeeRecord;
  }, []);

  const loadDirectory = useCallback(async (headers: Record<string, string>) => {
    const response = await fetch(`${API_BASE_URL}/api/employees?limit=500`, {
      headers,
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok || !json?.success) {
      throw new Error(json?.error || "Unable to load employees.");
    }
    return (Array.isArray(json.employees) ? json.employees : []) as EmployeeRecord[];
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

        const canEditPayroll = canManagePayroll(
          currentSession.userRole,
          currentSession.userTeam,
          currentSession.userDesignation
        );

        if (canEditPayroll) {
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
            setForm(toFormState(employee));
          } else {
            setSelectedEmployee(null);
            setForm(defaultFormState);
          }
        } else if (currentSession.userEmpId) {
          const employee = await loadEmployeeDetail(currentSession.userEmpId, headers);
          setSelectedEmpId(currentSession.userEmpId);
          setSelectedEmployee(employee);
          setForm(toFormState(employee));
          setEmployees([employee]);
        } else {
          setSelectedEmployee(null);
          setEmployees([]);
          setForm(defaultFormState);
        }
      } catch (error) {
        console.error("Payslip load failed:", error);
        Alert.alert("Unable to load payslip", error instanceof Error ? error.message : "Please try again.");
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
    const search = searchQuery.trim().toLowerCase();
    if (!search) return employees;
    return employees.filter((employee) => {
      const text = `${employee.name} ${employee.empId} ${employee.designation || ""} ${employee.department || ""}`.toLowerCase();
      return text.includes(search);
    });
  }, [employees, searchQuery]);

  const salaryHistory = useMemo(() => {
    return [...(selectedEmployee?.salaryHistory || [])].sort((a, b) => {
      const aKey = a.monthKey || a.creditedDate || a.paymentDate || a.payslipDate || "";
      const bKey = b.monthKey || b.creditedDate || b.paymentDate || b.payslipDate || "";
      return bKey.localeCompare(aKey);
    });
  }, [selectedEmployee]);

  const draftPayroll = useMemo(
    () =>
      buildPayrollBreakdown({
        basic: Number(form.basic) || 0,
        hra: Number(form.hra) || 0,
        specialAllowance: Number(form.specialAllowance) || 0,
        bonus: Number(form.bonus) || 0,
        overtime: Number(form.overtime) || 0,
        pf: Number(form.pf) || 0,
        esi: Number(form.esi) || 0,
        incomeTax: Number(form.incomeTax) || 0,
        professionalTax: Number(form.professionalTax) || 0,
        healthInsurance: Number(form.healthInsurance) || 0,
        loanRecovery: Number(form.loanRecovery) || 0,
        lop: Number(form.lop) || 0,
        employerPfContribution: Number(form.employerPfContribution) || 0,
        deductionsEnabled: form.deductionsEnabled,
      }),
    [form]
  );

  const activePayroll = useMemo(
    () => buildPayrollBreakdown(selectedEmployee || {}),
    [selectedEmployee]
  );

  const handleSelectEmployee = useCallback(async (empId: string) => {
    try {
      setSelectedEmpId(empId);
      const headers = await getMobileAuthHeaders();
      const employee = await loadEmployeeDetail(empId, headers);
      setSelectedEmployee(employee);
      setForm(toFormState(employee));
    } catch (error) {
      console.error("Failed to switch employee:", error);
      Alert.alert("Unable to open employee", error instanceof Error ? error.message : "Please try again.");
    }
  }, [loadEmployeeDetail]);

  const handleFieldChange = (key: keyof PayrollFormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]:
        typeof value === "string" && editableFields.find((field) => field.key === key)?.keyboardType === "numeric"
          ? normalizePayrollNumberInput(value)
          : value,
    }));
  };

  const handleSavePayroll = async () => {
    if (!selectedEmployee?.empId) return;

    try {
      setSaving(true);
      const headers = await getMobileAuthHeaders();
      const payload = {
        bankName: form.bankName.trim(),
        ifscCode: form.ifscCode.trim(),
        accountNumber: form.accountNumber.trim(),
        workLocation: form.workLocation.trim(),
        pfNumber: form.pfNumber.trim(),
        basic: Number(form.basic) || 0,
        hra: Number(form.hra) || 0,
        specialAllowance: Number(form.specialAllowance) || 0,
        bonus: Number(form.bonus) || 0,
        overtime: Number(form.overtime) || 0,
        pf: Number(form.pf) || 0,
        esi: Number(form.esi) || 0,
        incomeTax: Number(form.incomeTax) || 0,
        professionalTax: Number(form.professionalTax) || 0,
        healthInsurance: Number(form.healthInsurance) || 0,
        loanRecovery: Number(form.loanRecovery) || 0,
        lop: Number(form.lop) || 0,
        employerPfContribution: Number(form.employerPfContribution) || 0,
        salary: draftPayroll.grossSalary,
        netSalary: draftPayroll.netSalary,
        deductionsEnabled: form.deductionsEnabled,
        payslipVisible: form.payslipVisible,
      };

      const response = await fetch(`${API_BASE_URL}/api/employees/get/${encodeURIComponent(selectedEmployee.empId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(json?.message || "Unable to save salary details.");
      }

      const updatedEmployee = json.employee as EmployeeRecord;
      setSelectedEmployee(updatedEmployee);
      setForm(toFormState(updatedEmployee));
      setEmployees((prev) =>
        prev.map((employee) => (employee.empId === updatedEmployee.empId ? { ...employee, ...updatedEmployee } : employee))
      );
      Alert.alert("Saved", "Salary and payslip visibility details were updated.");
    } catch (error) {
      console.error("Payslip save failed:", error);
      Alert.alert("Save failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPayslip = async (entry: SalaryHistoryEntry) => {
    if (!entry.s3Url) {
      Alert.alert("Payslip unavailable", "This payslip PDF is not linked yet.");
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(entry.s3Url);
    } catch (error) {
      console.error("Unable to open payslip:", error);
      Alert.alert("Unable to open", "The payslip could not be opened right now.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading payslip details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: getBottomClearance() }]}
        extraScrollHeight={150}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadScreen(true)} />}>
        <TopBar subtitle="Payslip & Payroll" />

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>
            {managePayroll ? "Manage employee salary structures and payslip access." : "View your complete payroll breakdown and payslip history."}
          </Text>
          <Text style={styles.heroSubtitle}>
            Earnings, deductions, LOP, allowances, net salary, and payslip history stay aligned with the web payroll records.
          </Text>
        </View>

        {managePayroll ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Employee Payroll Access</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, ID, or department"
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
              <View style={styles.employeeHeader}>
                <View style={styles.employeeHeaderText}>
                  <Text style={styles.sectionTitle}>{selectedEmployee.name}</Text>
                  <Text style={styles.employeeMeta}>
                    {selectedEmployee.empId} • {selectedEmployee.designation || selectedEmployee.role || "Employee"}
                  </Text>
                  <Text style={styles.employeeMeta}>
                    {selectedEmployee.department || "Department not set"} • Joined {formatDate(selectedEmployee.joiningDate)}
                  </Text>
                </View>
                <View style={[styles.visibilityPill, selectedEmployee.payslipVisible ? styles.visibilityPillOn : styles.visibilityPillOff]}>
                  <Text style={[styles.visibilityText, selectedEmployee.payslipVisible ? styles.visibilityTextOn : styles.visibilityTextOff]}>
                    {selectedEmployee.payslipVisible ? "Visible" : "Hidden"}
                  </Text>
                </View>
              </View>

              <View style={styles.statGrid}>
                <StatCard label="Gross Salary" value={formatCurrency(activePayroll.grossSalary)} />
                <StatCard label="Net Salary" value={formatCurrency(activePayroll.netSalary)} tone="success" />
                <StatCard label="Deductions" value={formatCurrency(activePayroll.deductionTotal)} tone="warn" />
                <StatCard label="LOP" value={formatCurrency(selectedEmployee.lop || 0)} />
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Current Salary Breakdown</Text>
              <View style={styles.breakdownColumns}>
                <View style={styles.breakdownColumn}>
                  <Text style={styles.breakdownHeading}>Earnings</Text>
                  {activePayroll.earnings.map((item) => (
                    <View key={item.key} style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>{item.label}</Text>
                      <Text style={styles.breakdownValue}>{formatCurrency(item.value)}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.breakdownColumn}>
                  <Text style={styles.breakdownHeading}>Deductions</Text>
                  {activePayroll.deductions.map((item) => (
                    <View key={item.key} style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>{item.label}</Text>
                      <Text style={styles.breakdownValue}>{formatCurrency(item.value)}</Text>
                    </View>
                  ))}
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Employer PF Contribution</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(activePayroll.employerPfContribution)}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Payslip History</Text>
              {salaryHistory.length ? (
                salaryHistory.map((entry, index) => (
                  <View key={`${entry.monthKey || entry.creditedDate || index}`} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <View>
                        <Text style={styles.historyTitle}>{formatMonthLabel(entry)}</Text>
                        <Text style={styles.historyMeta}>
                          Credited {formatDate(entry.creditedDate || entry.paymentDate || entry.payslipDate)}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleOpenPayslip(entry)} style={styles.historyButton} activeOpacity={0.85}>
                        <Text style={styles.historyButtonText}>Open PDF</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.historyMeta}>{entry.fileName || "Payslip file"}</Text>
                    {entry.canceled ? <Text style={styles.historyAlert}>Canceled on {formatDate(entry.canceledAt)}</Text> : null}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No payslip PDFs have been recorded for this account yet.</Text>
              )}
            </View>

            {managePayroll ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>HR Salary Management</Text>
                <Text style={styles.sectionHint}>
                  Update salary structure, deductions, and payslip visibility here. Changes reflect directly on the employee payslip page.
                </Text>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleTextWrap}>
                    <Text style={styles.toggleTitle}>Enable deductions</Text>
                    <Text style={styles.toggleHint}>Apply PF, ESI, tax, insurance, loan, and LOP deductions.</Text>
                  </View>
                  <Switch
                    value={form.deductionsEnabled}
                    onValueChange={(value) => handleFieldChange("deductionsEnabled", value)}
                    trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleTextWrap}>
                    <Text style={styles.toggleTitle}>Payslip visibility</Text>
                    <Text style={styles.toggleHint}>Allow this employee to view and open their payslips.</Text>
                  </View>
                  <Switch
                    value={form.payslipVisible}
                    onValueChange={(value) => handleFieldChange("payslipVisible", value)}
                    trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={styles.formGrid}>
                  {editableFields.map((field) => (
                    <PayrollInput
                      key={field.key}
                      label={field.label}
                      value={String(form[field.key] ?? "")}
                      keyboardType={field.keyboardType}
                      onChangeText={(value) => handleFieldChange(field.key, value)}
                    />
                  ))}
                </View>

                <View style={styles.statGrid}>
                  <StatCard label="Draft Gross" value={formatCurrency(draftPayroll.grossSalary)} />
                  <StatCard label="Draft Net" value={formatCurrency(draftPayroll.netSalary)} tone="success" />
                  <StatCard label="Draft Deductions" value={formatCurrency(draftPayroll.deductionTotal)} tone="warn" />
                  <StatCard label="Employer PF" value={formatCurrency(draftPayroll.employerPfContribution)} />
                </View>

                <TouchableOpacity
                  onPress={handleSavePayroll}
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  activeOpacity={0.85}
                  disabled={saving}>
                  <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Payroll Details"}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.emptyText}>No payslip record is available for this account yet.</Text>
          </View>
        )}
      </KeyboardAwareScrollView>

      <FooterNav activeTab="payslip" />
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
    gap: 16,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  heroTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  heroSubtitle: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 20,
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
  sectionHint: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b",
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
    backgroundColor: "#ecfdf5",
    borderColor: "#86efac",
  },
  employeeName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  employeeMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    lineHeight: 18,
  },
  employeeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  employeeHeaderText: {
    flex: 1,
  },
  visibilityPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  visibilityPillOn: {
    backgroundColor: "#dcfce7",
  },
  visibilityPillOff: {
    backgroundColor: "#fee2e2",
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: "800",
  },
  visibilityTextOn: {
    color: "#166534",
  },
  visibilityTextOff: {
    color: "#991b1b",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "#eff6ff",
    gap: 6,
  },
  statCardSuccess: {
    backgroundColor: "#ecfdf5",
  },
  statCardWarn: {
    backgroundColor: "#fff7ed",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  breakdownColumns: {
    gap: 14,
  },
  breakdownColumn: {
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
  },
  breakdownHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  historyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    backgroundColor: "#f8fafc",
    gap: 8,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  historyMeta: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  historyAlert: {
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "700",
  },
  historyButton: {
    borderRadius: 14,
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  historyButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  toggleTextWrap: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  toggleHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b",
  },
  formGrid: {
    gap: 12,
  },
  inputField: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
  },
  saveButton: {
    backgroundColor: "#059669",
    borderRadius: 18,
    alignItems: "center",
    paddingVertical: 14,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 21,
  },
});
