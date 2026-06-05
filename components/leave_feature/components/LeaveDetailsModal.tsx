import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { X } from "lucide-react-native";
import { RequestItem } from "../types";
import { styles } from "../styles";
import { formatDate, getStatusBadgeStyle, getStatusText } from "../utils";

interface LeaveDetailsModalProps {
  visible: boolean;
  request: RequestItem | null;
  onClose: () => void;
}

const LeaveDetailsModal: React.FC<LeaveDetailsModalProps> = ({ visible, request, onClose }) => (
  <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
    <View style={styles.detailsModalContainer}>
      <View style={styles.detailsModalContent}>
        <View style={styles.detailsModalHeader}>
          <Text style={styles.detailsModalTitle}>Request Details</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        {request && (
          <ScrollView style={styles.detailsModalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.detailsGrid}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Request Type</Text>
                <Text style={styles.detailValue}>
                  {request.leaveType ? `Leave - ${request.leaveType}` : `Permission - ${request.permissionType}`}
                </Text>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[styles.detailValue, { color: getStatusBadgeStyle(request.status).color }]}>
                  {getStatusText(request.status)}
                </Text>
              </View>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Date Range</Text>
              <Text style={styles.detailValue}>
                {request.startDate ? (
                  <>
                    {formatDate(request.startDate)}
                    {request.endDate && request.endDate !== request.startDate && ` - ${formatDate(request.endDate)}`}
                  </>
                ) : request.date ? (
                  formatDate(request.date)
                ) : (
                  "N/A"
                )}
              </Text>
              {request.startTime && request.endTime && (
                <Text style={styles.detailSubText}>
                  {request.startTime} - {request.endTime}
                </Text>
              )}
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={[styles.detailValue, styles.durationValue]}>
                {request.days
                  ? `${request.days} Day${request.days > 1 ? "s" : ""}`
                  : request.duration
                    ? `${request.duration} Hour${parseFloat(request.duration as string) > 1 ? "s" : ""}`
                    : request.forgotType === "in"
                      ? "Missed Check-in"
                      : "Missed Check-out"}
              </Text>
            </View>

            {request.description && (
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Reason</Text>
                <Text style={styles.detailText}>{request.description}</Text>
              </View>
            )}

            {request.reason && (
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Additional Reason</Text>
                <Text style={styles.detailText}>{request.reason}</Text>
              </View>
            )}

            {request.forgotReason && (
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Forgot Reason</Text>
                <Text style={styles.detailText}>{request.forgotReason}</Text>
              </View>
            )}

            {(request.approverName || request.approverRole || request.approvedAt) && (
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Approval Details</Text>
                <Text style={styles.detailValue}>
                  {request.approverName || "N/A"}{request.approverRole ? ` (${request.approverRole})` : ""}
                </Text>
                {request.approvedAt ? <Text style={styles.detailSubText}>{formatDate(request.approvedAt)}</Text> : null}
              </View>
            )}

            {request.approvalRemarks && (
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Approver Remarks</Text>
                <Text style={styles.detailText}>{request.approvalRemarks}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.closeDetailsButton} onPress={onClose}>
              <Text style={styles.closeDetailsButtonText}>Close Details</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </View>
  </Modal>
);

export default LeaveDetailsModal;
