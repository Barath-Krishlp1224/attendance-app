import React from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { CalendarDays, History as HistoryIcon, Search } from "lucide-react-native";
import { styles } from "../styles";
import { RequestItem } from "../types";
import RequestCard from "./RequestCard";

interface HistorySectionProps {
  isLoading: boolean;
  filteredRequests: RequestItem[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectRequest: (item: RequestItem) => void;
}

const HistorySection: React.FC<HistorySectionProps> = ({
  isLoading,
  filteredRequests,
  searchQuery,
  onSearchChange,
  onSelectRequest,
}) => (
  <View style={styles.historySection}>
    <View style={styles.historyHeader}>
      <View style={styles.historyTitleContainer}>
        <View style={styles.historyIcon}>
          <HistoryIcon size={20} color="#fff" />
        </View>
        <View>
          <Text style={styles.historyTitle}>Leave & Permission History</Text>
          <Text style={styles.historySubtitle}>Track all your requests</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={14} color="#64748b" />
        <TextInput
          placeholder="Search..."
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholderTextColor="#94a3b8"
        />
      </View>
    </View>

    {isLoading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    ) : filteredRequests.length === 0 ? (
      <View style={styles.emptyContainer}>
        <CalendarDays size={48} color="#d1d5db" />
        <Text style={styles.emptyText}>No requests found</Text>
        <Text style={styles.emptySubtext}>
          {searchQuery ? "Try a different search term" : "Submit your first leave or permission request"}
        </Text>
      </View>
    ) : (
      <View style={styles.requestsList}>
        {filteredRequests
          .sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.startDate || a.date || 0);
            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.startDate || b.date || 0);
            return dateB.getTime() - dateA.getTime();
          })
          .map((item) => (
            <RequestCard key={item.id} item={item} onPress={onSelectRequest} />
          ))}
      </View>
    )}
  </View>
);

export default HistorySection;
