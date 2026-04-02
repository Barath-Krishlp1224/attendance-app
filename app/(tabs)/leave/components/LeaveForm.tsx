import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { styles } from "../styles";

interface LeaveTypeOption {
  value: string;
  label: string;
}

interface LeaveFormProps {
  leaveType: string;
  leaveTypes: LeaveTypeOption[];
  startDate: string;
  endDate: string;
  editableDays: string;
  description: string;
  onLeaveTypeChange: (value: string) => void;
  onStartDatePress: () => void;
  onEndDatePress: () => void;
  onEditableDaysChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDisableAutoDays: () => void;
  calculateDays: (start: string, end: string) => number;
}

const LeaveForm: React.FC<LeaveFormProps> = ({
  leaveType,
  leaveTypes,
  startDate,
  endDate,
  editableDays,
  description,
  onLeaveTypeChange,
  onStartDatePress,
  onEndDatePress,
  onEditableDaysChange,
  onDescriptionChange,
  onDisableAutoDays,
  calculateDays,
}) => (
  <View style={styles.formSection}>
    <Text style={styles.formLabel}>Leave Type</Text>
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerText}>
        {leaveTypes.find((lt) => lt.value === leaveType)?.label || "Select Leave Type"}
      </Text>
      <ChevronDown size={20} color="#64748b" />
    </View>
    <View style={styles.leaveTypeOptions}>
      {leaveTypes.map((type) => (
        <TouchableOpacity
          key={type.value}
          style={[styles.leaveTypeOption, leaveType === type.value && styles.leaveTypeOptionActive]}
          onPress={() => onLeaveTypeChange(type.value)}
        >
          <Text style={[styles.leaveTypeOptionText, leaveType === type.value && styles.leaveTypeOptionTextActive]}>
            {type.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    <View style={styles.dateRow}>
      <View style={styles.dateInputContainer}>
        <Text style={styles.formLabel}>From Date</Text>
        <TouchableOpacity style={styles.dateInput} onPress={onStartDatePress}>
          <Text style={styles.dateInputText}>{startDate || "Select Date"}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.dateInputContainer}>
        <Text style={styles.formLabel}>To Date</Text>
        <TouchableOpacity style={styles.dateInput} onPress={onEndDatePress}>
          <Text style={styles.dateInputText}>{endDate || "Select Date"}</Text>
        </TouchableOpacity>
      </View>
    </View>

    <Text style={styles.formLabel}>Duration (Days)</Text>
    <TextInput
      style={styles.textInput}
      value={editableDays}
      onChangeText={(text) => {
        onEditableDaysChange(text);
        onDisableAutoDays();
      }}
      keyboardType="decimal-pad"
      placeholder="Enter days"
      placeholderTextColor="#94a3b8"
    />
    {startDate && endDate && <Text style={styles.durationHint}>Calculated: {calculateDays(startDate, endDate)} days</Text>}

    <Text style={styles.formLabel}>Reason</Text>
    <TextInput
      style={[styles.textInput, styles.textArea]}
      value={description}
      onChangeText={onDescriptionChange}
      placeholder="Reason for leave..."
      placeholderTextColor="#94a3b8"
      multiline
      numberOfLines={4}
      textAlignVertical="top"
    />
  </View>
);

export default LeaveForm;
