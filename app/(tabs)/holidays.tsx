import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Calendar,
  ChevronLeft,
  Clock,
  CheckCircle2,
  CalendarDays,
  ArrowRight,
} from "lucide-react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Holiday {
  date: string;
  name: string;
  description: string;
  actualDate: Date;
}

const HolidaysPage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"upcoming" | "recent" | "finished">("upcoming");

  const staticHolidays: Holiday[] = [
    { date: "January 1", name: "New Year's Day", description: "A national holiday to mark the beginning of the new year.", actualDate: new Date(2026, 0, 1) },
    { date: "January 15", name: "Pongal", description: "Harvest festival holidays.", actualDate: new Date(2026, 0, 15) },
    { date: "January 26", name: "Republic Day", description: "Commemorating the adoption of the Constitution.", actualDate: new Date(2026, 0, 26) },
    { date: "February 15", name: "Shivaratri", description: "Lord Shiva's birthday celebration.", actualDate: new Date(2026, 1, 15) },
    { date: "March 19", name: "Ugadi", description: "Telugu New Year.", actualDate: new Date(2026, 2, 19) },
    { date: "April 3", name: "Good Friday", description: "Observed during the Holy Week.", actualDate: new Date(2026, 3, 3) },
    { date: "May 1", name: "Labor's Day", description: "Celebrating workers and laborers.", actualDate: new Date(2026, 4, 1) },
    { date: "August 15", name: "Independence Day", description: "Marking India's independence.", actualDate: new Date(2026, 7, 15) },
    { date: "October 2", name: "Gandhi Jayanti", description: "Birth anniversary of Mahatma Gandhi.", actualDate: new Date(2026, 9, 2) },
    { date: "November 8", name: "Diwali", description: "The festival of lights.", actualDate: new Date(2026, 10, 8) },
    { date: "December 25", name: "Christmas", description: "The birth of Jesus Christ.", actualDate: new Date(2026, 11, 25) },
  ];

  const today = new Date(); // Current date
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  // Update holidays to current year
  const updatedHolidays = useMemo(() => {
    return staticHolidays.map(holiday => ({
      ...holiday,
      actualDate: new Date(currentYear, holiday.actualDate.getMonth(), holiday.actualDate.getDate())
    }));
  }, [currentYear]);

  const categorizedHolidays = useMemo(() => {
    const todayDate = new Date(currentYear, currentMonth, currentDay);
    
    const finished = updatedHolidays.filter(h => h.actualDate < todayDate);
    const upcoming = updatedHolidays.filter(h => h.actualDate >= todayDate);
    const thirtyDaysAgo = new Date(todayDate);
    thirtyDaysAgo.setDate(todayDate.getDate() - 30);
    const recent = finished.filter(h => h.actualDate >= thirtyDaysAgo);

    return { finished, upcoming, recent };
  }, [updatedHolidays, currentYear, currentMonth, currentDay]);

  const tabs = [
    { 
      id: "upcoming" as const, 
      label: "Upcoming", 
      icon: CalendarDays, 
      count: categorizedHolidays.upcoming.length, 
      color: "#2563eb", 
      bg: "#dbeafe" 
    },
    { 
      id: "recent" as const, 
      label: "Recent", 
      icon: Clock, 
      count: categorizedHolidays.recent.length, 
      color: "#d97706", 
      bg: "#fef3c7" 
    },
    { 
      id: "finished" as const, 
      label: "Finished", 
      icon: CheckCircle2, 
      count: categorizedHolidays.finished.length, 
      color: "#059669", 
      bg: "#d1fae5" 
    },
  ];

  const currentDisplayList = activeTab === "upcoming"
    ? categorizedHolidays.upcoming
    : activeTab === "recent"
    ? categorizedHolidays.recent
    : categorizedHolidays.finished;

  const formatMonth = (dateStr: string) => {
    const month = dateStr.split(' ')[0];
    return month.substring(0, 3).toUpperCase();
  };

  const formatDay = (dateStr: string) => {
    return dateStr.split(' ')[1];
  };

  // Get current date in "Mon DD" format
  const getCurrentDate = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[currentMonth]} ${currentDay}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#4b5563" />
        </TouchableOpacity>
        <Text style={styles.title}>{currentYear} Holidays</Text>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{getCurrentDate()}</Text>
        </View>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={[styles.statBox, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
          <Text style={[styles.statCount, { color: '#1e40af' }]}>{categorizedHolidays.upcoming.length}</Text>
          <Text style={[styles.statLabel, { color: '#1e40af' }]}>Upcoming</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
          <Text style={[styles.statCount, { color: '#92400e' }]}>{categorizedHolidays.recent.length}</Text>
          <Text style={[styles.statLabel, { color: '#92400e' }]}>Recent</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#d1fae5', borderColor: '#86efac' }]}>
          <Text style={[styles.statCount, { color: '#065f46' }]}>{categorizedHolidays.finished.length}</Text>
          <Text style={[styles.statLabel, { color: '#065f46' }]}>Finished</Text>
        </View>
      </View>

      {/* Tabs - Centered with proper spacing */}
      <View style={styles.tabsWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.tabsContent}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabButton,
                  isActive && styles.tabButtonActive,
                ]}
              >
                <tab.icon size={16} color={isActive ? tab.color : "#6b7280"} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabCount, { backgroundColor: tab.bg }]}>
                  <Text style={[styles.tabCountText, { color: tab.color }]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Holidays List */}
      <View style={styles.listContainer}>
        <ScrollView 
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.listContent}
        >
          {currentDisplayList.length > 0 ? (
            currentDisplayList.map((holiday, index) => {
              // Calculate days until/days ago
              const daysDiff = Math.floor(
                (holiday.actualDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );
              const dayText = daysDiff > 0 
                ? `In ${daysDiff} day${daysDiff !== 1 ? 's' : ''}` 
                : daysDiff < 0 
                ? `${Math.abs(daysDiff)} day${Math.abs(daysDiff) !== 1 ? 's' : ''} ago` 
                : 'Today';

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.holidayCard}
                  activeOpacity={0.8}
                >
                  <View style={styles.holidayContent}>
                    <View style={styles.dateContainer}>
                      <Text style={styles.monthText}>{formatMonth(holiday.date)}</Text>
                      <Text style={styles.dayText}>{formatDay(holiday.date)}</Text>
                    </View>
                    <View style={styles.holidayInfo}>
                      <Text style={styles.holidayName}>{holiday.name}</Text>
                      <Text style={styles.holidayDescription} numberOfLines={1}>
                        {holiday.description}
                      </Text>
                      <Text style={[
                        styles.dayInfo,
                        daysDiff > 0 ? styles.dayInfoUpcoming :
                        daysDiff < 0 ? styles.dayInfoPast :
                        styles.dayInfoToday
                      ]}>
                        {dayText}
                      </Text>
                    </View>
                  </View>
                  <ArrowRight size={16} color="#d1d5db" />
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Calendar size={48} color="#e5e7eb" />
              <Text style={styles.emptyText}>No holidays to show here</Text>
              <Text style={styles.emptySubText}>
                {activeTab === "upcoming" 
                  ? "All holidays for this year have passed"
                  : "No holidays in this category"}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    flex: 1,
    marginHorizontal: 12,
  },
  dateBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563eb",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCount: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  tabsWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  tabsContent: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingRight: 20,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "transparent",
    minWidth: 120,
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: "#fff",
    borderColor: "#93c5fd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    transform: [{ scale: 1.05 }],
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  tabLabelActive: {
    color: "#111827",
    fontWeight: "700",
  },
  tabCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  tabCountText: {
    fontSize: 12,
    fontWeight: "800",
  },
  listContainer: {
    flex: 1,
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  holidayCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    padding: 20,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  holidayContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  dateContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563eb",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  dayText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 20,
  },
  holidayInfo: {
    flex: 1,
  },
  holidayName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  holidayDescription: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 14,
    marginBottom: 6,
  },
  dayInfo: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dayInfoUpcoming: {
    color: "#2563eb",
  },
  dayInfoPast: {
    color: "#6b7280",
  },
  dayInfoToday: {
    color: "#059669",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});

export default HolidaysPage;