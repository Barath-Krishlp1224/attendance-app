import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Calendar, CalendarDays, CheckCircle2, Clock, Pencil, Plus, Trash2, X } from "lucide-react-native";

import FooterNav, { getFooterNavClearance } from "../../components/leave_feature/components/FooterNav";
import TopBar from "../../components/common/TopBar";
import KeyboardAwareScrollView from "../../components/ui/keyboard-aware-scroll-view";
import { API_BASE_URL, canManageHolidays } from "../../utils/mobileSession";

type HolidayTab = "upcoming" | "recent" | "finished";

type ApiHoliday = {
  _id?: string;
  name?: string;
  description?: string;
  holidayType?: string;
  dateISO?: string;
};

type Holiday = {
  id: string;
  name: string;
  description: string;
  holidayType: string;
  dateLabel: string;
  actualDate: Date;
  dateInputValue: string;
};

const EMPTY_FORM = {
  id: "",
  name: "",
  dateISO: "",
  description: "",
  holidayType: "Local Holiday",
};

const HOLIDAY_TYPES = ["Local Holiday", "National Holiday", "Festival Holiday", "Company Holiday"];

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const toInputDate = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const normalizeHoliday = (holiday: ApiHoliday): Holiday | null => {
  if (!holiday._id || !holiday.dateISO) return null;
  const parsed = new Date(holiday.dateISO);
  if (Number.isNaN(parsed.getTime())) return null;
  const actualDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return {
    id: holiday._id,
    name: String(holiday.name || "Holiday"),
    description: String(holiday.description || "").trim(),
    holidayType: String(holiday.holidayType || "Local Holiday"),
    dateLabel: formatDateLabel(actualDate),
    actualDate,
    dateInputValue: toInputDate(actualDate),
  };
};

const HolidaysPage = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<HolidayTab>("upcoming");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [allowManagement, setAllowManagement] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formState, setFormState] = useState(EMPTY_FORM);

  const loadAccess = useCallback(async () => {
    const entries = await AsyncStorage.multiGet(["userRole", "userTeam", "userDesignation"]);
    const map = Object.fromEntries(entries);
    setAllowManagement(canManageHolidays(map.userRole || "", map.userTeam || "", map.userDesignation || ""));
  }, []);

  const loadHolidays = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/holidays`);
      const data = await response.json();
      const next: Holiday[] = Array.isArray(data?.holidays)
        ? data.holidays.map(normalizeHoliday).filter((item: Holiday | null): item is Holiday => Boolean(item))
        : [];
      next.sort((a: Holiday, b: Holiday) => a.actualDate.getTime() - b.actualDate.getTime());
      setHolidays(next);
    } catch (loadError) {
      console.error("Failed to load holidays:", loadError);
      setError("Failed to load holidays.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAccess();
    void loadHolidays();
  }, [loadAccess, loadHolidays]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void loadHolidays();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [loadHolidays]);

  const todayStart = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }, []);

  const categorizedHolidays = useMemo(() => {
    const finished = holidays.filter((holiday) => holiday.actualDate < todayStart);
    const upcoming = holidays.filter((holiday) => holiday.actualDate >= todayStart);
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(todayStart.getDate() - 30);
    const recent = finished.filter((holiday) => holiday.actualDate >= thirtyDaysAgo);
    return { finished, upcoming, recent };
  }, [holidays, todayStart]);

  const currentDisplayList =
    activeTab === "upcoming"
      ? categorizedHolidays.upcoming
      : activeTab === "recent"
        ? categorizedHolidays.recent
        : categorizedHolidays.finished;

  const tabs = [
    { id: "upcoming" as const, label: "Upcoming", icon: CalendarDays, count: categorizedHolidays.upcoming.length, color: "#2563eb", bg: "#dbeafe" },
    { id: "recent" as const, label: "Recent", icon: Clock, count: categorizedHolidays.recent.length, color: "#d97706", bg: "#fef3c7" },
    { id: "finished" as const, label: "Finished", icon: CheckCircle2, count: categorizedHolidays.finished.length, color: "#059669", bg: "#d1fae5" },
  ];

  const resetForm = () => {
    setFormState(EMPTY_FORM);
    setFormError("");
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    setFormState({ ...EMPTY_FORM, dateISO: toInputDate(new Date()) });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (holiday: Holiday) => {
    setFormState({
      id: holiday.id,
      name: holiday.name,
      dateISO: holiday.dateInputValue,
      description: holiday.description,
      holidayType: holiday.holidayType,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const saveHoliday = async () => {
    if (!formState.name.trim() || !formState.dateISO.trim() || !formState.holidayType.trim()) {
      setFormError("Holiday name, date, and type are required.");
      return;
    }

    try {
      setIsSaving(true);
      const endpoint = formState.id ? `${API_BASE_URL}/api/holidays/${formState.id}` : `${API_BASE_URL}/api/holidays`;
      const method = formState.id ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name.trim(),
          dateISO: formState.dateISO.trim(),
          description: formState.description.trim(),
          holidayType: formState.holidayType.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setFormError(data?.error || "Failed to save holiday.");
        return;
      }
      resetForm();
      await loadHolidays();
    } catch (saveError) {
      console.error("Failed to save holiday:", saveError);
      setFormError("Failed to save holiday.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteHoliday = async (holiday: Holiday) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/holidays/${holiday.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setError(data?.error || "Failed to delete holiday.");
        return;
      }
      await loadHolidays();
    } catch (deleteError) {
      console.error("Failed to delete holiday:", deleteError);
      setError("Failed to delete holiday.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TopBar subtitle="Holiday Calendar" />

      <View style={styles.headerActions}>
        <Text style={styles.subtitle}>Live company holidays shared across the whole HRMS</Text>
        {allowManagement ? (
          <TouchableOpacity style={styles.manageButton} onPress={openCreateModal}>
            <Plus size={16} color="#fff" />
            <Text style={styles.manageButtonText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.statsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.statBox, activeTab === tab.id && styles.statBoxActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} color={tab.color} />
            <Text style={styles.statCount}>{tab.count}</Text>
            <Text style={styles.statLabel}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <KeyboardAwareScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadHolidays(); }} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: getFooterNavClearance(insets.bottom) }]}
        extraScrollHeight={110}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.emptyText}>Loading holidays...</Text>
          </View>
        ) : currentDisplayList.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No holidays in this section</Text>
          </View>
        ) : (
          currentDisplayList.map((holiday) => {
            const daysDiff = Math.floor((holiday.actualDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
            const badgeText =
              daysDiff > 0 ? `In ${daysDiff} day${daysDiff === 1 ? "" : "s"}` : daysDiff < 0 ? `${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? "" : "s"} ago` : "Today";

            return (
              <View key={holiday.id} style={styles.card}>
                <View style={styles.cardMain}>
                  <View style={styles.dateBlock}>
                    <Text style={styles.monthText}>{holiday.actualDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</Text>
                    <Text style={styles.dayText}>{holiday.actualDate.getDate()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holidayName}>{holiday.name}</Text>
                    <Text style={styles.holidayType}>{holiday.holidayType}</Text>
                    <Text style={styles.holidayDescription}>{holiday.description || holiday.dateLabel}</Text>
                    <Text style={styles.dayInfo}>{badgeText}</Text>
                  </View>
                  <ArrowRight size={16} color="#cbd5e1" />
                </View>

                {allowManagement ? (
                  <View style={styles.managementRow}>
                    <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(holiday)}>
                      <Pencil size={14} color="#2563eb" />
                      <Text style={styles.editText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteButton} onPress={() => void deleteHoliday(holiday)}>
                      <Trash2 size={14} color="#dc2626" />
                      <Text style={styles.deleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </KeyboardAwareScrollView>

      <Modal visible={isModalOpen} transparent animationType="slide" onRequestClose={resetForm}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <KeyboardAwareScrollView
            contentContainerStyle={styles.modalScrollContent}
            extraScrollHeight={120}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{formState.id ? "Edit Holiday" : "Add Holiday"}</Text>
                <TouchableOpacity onPress={resetForm}>
                  <X size={20} color="#475569" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Holiday name"
                value={formState.name}
                onChangeText={(value) => setFormState((current) => ({ ...current, name: value }))}
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={formState.dateISO}
                onChangeText={(value) => setFormState((current) => ({ ...current, dateISO: value }))}
                placeholderTextColor="#94a3b8"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow} keyboardShouldPersistTaps="handled">
                {HOLIDAY_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, formState.holidayType === type && styles.typeChipActive]}
                    onPress={() => setFormState((current) => ({ ...current, holidayType: type }))}
                  >
                    <Text style={[styles.typeChipText, formState.holidayType === type && styles.typeChipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description"
                value={formState.description}
                onChangeText={(value) => setFormState((current) => ({ ...current, description: value }))}
                placeholderTextColor="#94a3b8"
                multiline
              />

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <TouchableOpacity style={styles.saveButton} disabled={isSaving} onPress={() => void saveHoliday()}>
                <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save Holiday"}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <FooterNav activeTab="holidays" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  headerActions: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  subtitle: { color: "#64748b", fontSize: 13, flex: 1 },
  manageButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0f172a", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  manageButtonText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  statsContainer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  statBox: { flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 12, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#e2e8f0" },
  statBoxActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  statCount: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  statLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  errorText: { color: "#b91c1c", paddingHorizontal: 18, paddingTop: 8, fontWeight: "600" },
  listContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 14 },
  cardMain: { flexDirection: "row", alignItems: "center", gap: 14 },
  dateBlock: { width: 64, height: 78, borderRadius: 18, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  monthText: { color: "#2563eb", fontWeight: "800", fontSize: 12 },
  dayText: { color: "#0f172a", fontWeight: "900", fontSize: 28 },
  holidayName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  holidayType: { fontSize: 12, color: "#2563eb", fontWeight: "700", marginTop: 3 },
  holidayDescription: { fontSize: 13, color: "#64748b", marginTop: 4 },
  dayInfo: { marginTop: 6, fontSize: 12, color: "#059669", fontWeight: "700" },
  managementRow: { flexDirection: "row", gap: 12 },
  editButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  deleteButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fef2f2", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  editText: { color: "#2563eb", fontWeight: "800", fontSize: 12 },
  deleteText: { color: "#dc2626", fontWeight: "800", fontSize: 12 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  emptyText: { color: "#64748b", fontSize: 14, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "flex-end", padding: 16 },
  modalScrollContent: { flexGrow: 1, justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderRadius: 28, padding: 18, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  textArea: { minHeight: 92, textAlignVertical: "top" },
  typeRow: { gap: 8 },
  typeChip: { borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1", paddingHorizontal: 12, paddingVertical: 9 },
  typeChipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  typeChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  typeChipTextActive: { color: "#fff" },
  saveButton: { marginTop: 4, backgroundColor: "#059669", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});

export default HolidaysPage;
