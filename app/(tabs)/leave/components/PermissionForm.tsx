import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { BriefcaseBusiness, Clock3, HomeIcon, ShieldCheck } from "lucide-react-native";
import { styles } from "../styles";

interface PermissionFormProps {
  permissionType: "permission" | "wfh" | "on-duty" | "forgot-check";
  permissionDate: string;
  permissionStartTime: string;
  permissionEndTime: string;
  startDate: string;
  endDate: string;
  durationOption: "hours" | "first-half" | "second-half" | "minutes";
  hoursDuration: string;
  minutesDuration: string;
  forgotCheckType: "in" | "out";
  forgotDate: string;
  forgotTime: string;
  forgotReason: string;
  description: string;
  editableDays: string;
  onPermissionTypeChange: (value: "permission" | "wfh" | "on-duty" | "forgot-check") => void;
  onPermissionDatePress: () => void;
  onStartTimePress: () => void;
  onEndTimePress: () => void;
  onStartDatePress: () => void;
  onEndDatePress: () => void;
  onDurationOptionChange: (value: "hours" | "first-half" | "second-half" | "minutes") => void;
  onHoursDurationChange: (value: string) => void;
  onMinutesDurationChange: (value: string) => void;
  onForgotTypeChange: (value: "in" | "out") => void;
  onForgotDatePress: () => void;
  onForgotTimePress: () => void;
  onForgotReasonChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onEditableDaysChange: (value: string) => void;
  onDisableAutoDays: () => void;
}

const permissionTypes = [
  { value: "permission", label: "Permission", icon: <ShieldCheck size={20} color="#2563eb" /> },
  { value: "wfh", label: "Work From Home", icon: <HomeIcon size={20} color="#8b5cf6" /> },
  { value: "on-duty", label: "On Duty", icon: <BriefcaseBusiness size={20} color="#10b981" /> },
  { value: "forgot-check", label: "Forgot Check", icon: <Clock3 size={20} color="#f59e0b" /> },
] as const;

const PermissionForm: React.FC<PermissionFormProps> = ({
  permissionType,
  permissionDate,
  permissionStartTime,
  permissionEndTime,
  startDate,
  endDate,
  durationOption,
  hoursDuration,
  minutesDuration,
  forgotCheckType,
  forgotDate,
  forgotTime,
  forgotReason,
  description,
  editableDays,
  onPermissionTypeChange,
  onPermissionDatePress,
  onStartTimePress,
  onEndTimePress,
  onStartDatePress,
  onEndDatePress,
  onDurationOptionChange,
  onHoursDurationChange,
  onMinutesDurationChange,
  onForgotTypeChange,
  onForgotDatePress,
  onForgotTimePress,
  onForgotReasonChange,
  onDescriptionChange,
  onEditableDaysChange,
  onDisableAutoDays,
}) => (
  <View style={styles.formSection}>
    <Text style={styles.formLabel}>Permission Type</Text>
    <View style={styles.permissionTypeGrid}>
      {permissionTypes.map((type) => (
        <TouchableOpacity
          key={type.value}
          style={[
            styles.permissionTypeButton,
            permissionType === type.value && styles.permissionTypeButtonActive,
          ]}
          onPress={() => onPermissionTypeChange(type.value)}
        >
          <View
            style={[
              styles.permissionTypeIcon,
              permissionType === type.value && styles.permissionTypeIconActive,
            ]}
          >
            {type.icon}
          </View>
          <Text
            style={[
              styles.permissionTypeText,
              permissionType === type.value && styles.permissionTypeTextActive,
            ]}
          >
            {type.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    {permissionType === "permission" && (
      <>
        <Text style={styles.formLabel}>Date</Text>
        <TouchableOpacity style={styles.dateInput} onPress={onPermissionDatePress}>
          <Text style={styles.dateInputText}>{permissionDate || "Select Date"}</Text>
        </TouchableOpacity>

        <View style={styles.dateRow}>
          <View style={styles.timeInputContainer}>
            <Text style={styles.formLabel}>From Time</Text>
            <TouchableOpacity style={styles.timeInput} onPress={onStartTimePress}>
              <Text style={styles.timeInputText}>{permissionStartTime || "09:00"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.timeInputContainer}>
            <Text style={styles.formLabel}>To Time</Text>
            <TouchableOpacity style={styles.timeInput} onPress={onEndTimePress}>
              <Text style={styles.timeInputText}>{permissionEndTime || "10:00"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.formLabel}>Duration</Text>
        <View style={styles.durationOptions}>
          {(["hours", "first-half", "second-half", "minutes"] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.durationOption, durationOption === option && styles.durationOptionActive]}
              onPress={() => onDurationOptionChange(option)}
            >
              <Text
                style={[
                  styles.durationOptionText,
                  durationOption === option && styles.durationOptionTextActive,
                ]}
              >
                {option === "first-half"
                  ? "First Half"
                  : option === "second-half"
                    ? "Second Half"
                    : option === "minutes"
                      ? "Minutes"
                      : "Hours"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {durationOption === "hours" && (
          <>
            <TextInput
              style={styles.textInput}
              value={hoursDuration}
              onChangeText={onHoursDurationChange}
              keyboardType="decimal-pad"
              placeholder="Enter hours"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.quickHours}>
              {(["0.5", "1", "2", "3", "4"] as const).map((hour) => (
                <TouchableOpacity
                  key={hour}
                  style={styles.quickHourButton}
                  onPress={() => onHoursDurationChange(hour)}
                >
                  <Text style={styles.quickHourText}>{hour}h</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {durationOption === "minutes" && (
          <>
            <TextInput
              style={styles.textInput}
              value={minutesDuration}
              onChangeText={onMinutesDurationChange}
              keyboardType="numeric"
              placeholder="Enter minutes"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.quickMinutes}>
              {(["15", "30", "45", "60", "90", "120"] as const).map((min) => (
                <TouchableOpacity
                  key={min}
                  style={styles.quickMinuteButton}
                  onPress={() => onMinutesDurationChange(min)}
                >
                  <Text style={styles.quickMinuteText}>{min}m</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </>
    )}

    {permissionType === "wfh" && (
      <>
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
      </>
    )}

    {permissionType === "on-duty" && (
      <>
        <Text style={styles.formLabel}>Date</Text>
        <TouchableOpacity style={styles.dateInput} onPress={onPermissionDatePress}>
          <Text style={styles.dateInputText}>{permissionDate || "Select Date"}</Text>
        </TouchableOpacity>

        <Text style={styles.formLabel}>Time</Text>
        <TouchableOpacity style={styles.timeInput} onPress={onStartTimePress}>
          <Text style={styles.timeInputText}>{permissionStartTime || "09:00"}</Text>
        </TouchableOpacity>

        <Text style={styles.formLabel}>Duration</Text>
        <View style={styles.durationOptions}>
          {(["hours", "first-half", "second-half"] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.durationOption, durationOption === option && styles.durationOptionActive]}
              onPress={() => onDurationOptionChange(option)}
            >
              <Text
                style={[
                  styles.durationOptionText,
                  durationOption === option && styles.durationOptionTextActive,
                ]}
              >
                {option === "first-half" ? "First Half" : option === "second-half" ? "Second Half" : "Hours"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    )}

    {permissionType === "forgot-check" && (
      <>
        <View style={styles.forgotTypeSelector}>
          <TouchableOpacity
            style={[styles.forgotTypeButton, forgotCheckType === "in" && styles.forgotTypeButtonActive]}
            onPress={() => onForgotTypeChange("in")}
          >
            <Text
              style={[
                styles.forgotTypeButtonText,
                forgotCheckType === "in" && styles.forgotTypeButtonTextActive,
              ]}
            >
              Forgot Check-in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.forgotTypeButton, forgotCheckType === "out" && styles.forgotTypeButtonActive]}
            onPress={() => onForgotTypeChange("out")}
          >
            <Text
              style={[
                styles.forgotTypeButtonText,
                forgotCheckType === "out" && styles.forgotTypeButtonTextActive,
              ]}
            >
              Forgot Check-out
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateRow}>
          <View style={styles.dateInputContainer}>
            <Text style={styles.formLabel}>Date</Text>
            <TouchableOpacity style={styles.dateInput} onPress={onForgotDatePress}>
              <Text style={styles.dateInputText}>{forgotDate || "Select Date"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dateInputContainer}>
            <Text style={styles.formLabel}>Time</Text>
            <TouchableOpacity style={styles.timeInput} onPress={onForgotTimePress}>
              <Text style={styles.timeInputText}>{forgotTime || "Select Time"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.formLabel}>Reason</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={forgotReason}
          onChangeText={onForgotReasonChange}
          placeholder={`Reason for forgetting to check-${forgotCheckType}...`}
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </>
    )}

    {(permissionType === "permission" || permissionType === "on-duty" || permissionType === "wfh") && (
      <>
        <Text style={styles.formLabel}>Reason</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={description}
          onChangeText={onDescriptionChange}
          placeholder={`Reason for ${permissionType}...`}
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </>
    )}
  </View>
);

export default PermissionForm;
