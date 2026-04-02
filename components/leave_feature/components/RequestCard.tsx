import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import {
  BriefcaseBusiness,
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  Clock3,
  HomeIcon,
  Plane,
  ShieldCheck,
  Thermometer,
  Zap,
} from "lucide-react-native";
import { styles } from "../styles";
import { RequestItem } from "../types";
import { formatDate, getStatusBadgeStyle, getStatusText } from "../utils";

interface RequestCardProps {
  item: RequestItem;
  onPress: (item: RequestItem) => void;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "sick":
      return <Thermometer size={20} color="#dc2626" />;
    case "casual":
      return <Plane size={20} color="#059669" />;
    case "planned":
      return <Calendar size={20} color="#2563eb" />;
    case "unplanned":
      return <Zap size={20} color="#d97706" />;
    case "permission":
      return <ShieldCheck size={20} color="#2563eb" />;
    case "wfh":
      return <HomeIcon size={20} color="#8b5cf6" />;
    case "on-duty":
      return <BriefcaseBusiness size={20} color="#10b981" />;
    case "forgot-check":
      return <Clock3 size={20} color="#f59e0b" />;
    default:
      return <CalendarDays size={20} color="#64748b" />;
  }
};

const RequestCard: React.FC<RequestCardProps> = ({ item, onPress }) => {
  const statusStyle = getStatusBadgeStyle(item.status);
  const type = item.leaveType || item.permissionType || "default";

  return (
    <TouchableOpacity style={styles.requestCard} onPress={() => onPress(item)}>
      <View style={styles.requestHeader}>
        <View
          style={[
            styles.requestTypeIcon,
            item.leaveType === "sick"
              ? { backgroundColor: "#fee2e2" }
              : item.leaveType === "casual"
                ? { backgroundColor: "#d1fae5" }
                : item.permissionType === "wfh"
                  ? { backgroundColor: "#ede9fe" }
                  : item.permissionType === "on-duty"
                    ? { backgroundColor: "#d1fae5" }
                    : { backgroundColor: "#f3f4f6" },
          ]}
        >
          {getTypeIcon(type)}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.requestTypeText}>
            {(item.leaveType || item.permissionType || "Unknown")?.toUpperCase()}
          </Text>
          <Text style={styles.requestTypeSub}>
            {item.requestType || (item.leaveType ? "Leave" : "Permission")}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusStyle.backgroundColor, borderColor: statusStyle.borderColor },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.requestDateContainer}>
          <Calendar size={14} color="#64748b" />
          <Text style={styles.requestDateText}>
            {item.startDate ? (
              <>
                {formatDate(item.startDate)}
                {item.endDate && item.endDate !== item.startDate && ` - ${formatDate(item.endDate)}`}
              </>
            ) : item.date ? (
              formatDate(item.date)
            ) : (
              "N/A"
            )}
          </Text>
        </View>

        <View style={styles.requestDurationContainer}>
          <Clock size={14} color="#2563eb" />
          <Text style={styles.requestDuration}>
            {item.days
              ? `${item.days} Days`
              : item.duration
                ? `${item.duration} Hours`
                : item.forgotType === "in"
                  ? "Check-in"
                  : "Check-out"}
          </Text>
        </View>
      </View>

      {item.description && (
        <Text style={styles.requestDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.requestFooter}>
        <Text style={styles.viewDetailsText}>View Details</Text>
        <ChevronRight size={16} color="#2563eb" />
      </View>
    </TouchableOpacity>
  );
};

export default RequestCard;
