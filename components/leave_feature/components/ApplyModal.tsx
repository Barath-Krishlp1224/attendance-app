import React from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Text, TouchableOpacity, View } from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { X } from "lucide-react-native";
import { Recipient } from "../types";
import { styles } from "../styles";
import KeyboardAwareScrollView from "../../ui/keyboard-aware-scroll-view";
import EmailNotificationsSection from "./EmailNotificationsSection";
import EmployeeInfoCard from "./EmployeeInfoCard";
import LeaveForm from "./LeaveForm";
import PermissionForm from "./PermissionForm";
import RequestTypeToggle from "./RequestTypeToggle";

interface LeaveTypeOption {
  value: string;
  label: string;
}

export interface ApplyModalProps {
  visible: boolean;
  isSubmitting: boolean;
  requestType: "leave" | "permission";
  employeeName: string;
  empIdOrEmail: string;
  allRecipients: Recipient[];
  toRecipients: string[];
  ccRecipients: string[];
  extraRecipientEmails: string;
  isToDropdownOpen: boolean;
  isCcDropdownOpen: boolean;
  leaveType: string;
  leaveTypes: LeaveTypeOption[];
  startDate: string;
  endDate: string;
  editableDays: string;
  description: string;
  permissionType: "permission" | "wfh" | "on-duty" | "forgot-check";
  permissionDate: string;
  permissionStartTime: string;
  permissionEndTime: string;
  durationOption: "hours" | "first-half" | "second-half" | "minutes";
  hoursDuration: string;
  minutesDuration: string;
  forgotCheckType: "in" | "out";
  forgotDate: string;
  forgotTime: string;
  forgotReason: string;
  isStartDatePickerVisible: boolean;
  isEndDatePickerVisible: boolean;
  isPermissionDatePickerVisible: boolean;
  isForgotDatePickerVisible: boolean;
  isStartTimePickerVisible: boolean;
  isEndTimePickerVisible: boolean;
  isForgotTimePickerVisible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onRequestTypeChange: (value: "leave" | "permission") => void;
  onToggleToDropdown: () => void;
  onToggleCcDropdown: () => void;
  onToggleRecipient: (id: string, type: "to" | "cc") => void;
  onChangeExtraEmails: (value: string) => void;
  getSelectedToRecipients: () => Recipient[];
  getSelectedCcRecipients: () => Recipient[];
  onLeaveTypeChange: (value: string) => void;
  onStartDatePress: () => void;
  onEndDatePress: () => void;
  onEditableDaysChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDisableAutoDays: () => void;
  onPermissionTypeChange: (value: "permission" | "wfh" | "on-duty" | "forgot-check") => void;
  onPermissionDatePress: () => void;
  onStartTimePress: () => void;
  onEndTimePress: () => void;
  onDurationOptionChange: (value: "hours" | "first-half" | "second-half" | "minutes") => void;
  onHoursDurationChange: (value: string) => void;
  onMinutesDurationChange: (value: string) => void;
  onForgotTypeChange: (value: "in" | "out") => void;
  onForgotDatePress: () => void;
  onForgotTimePress: () => void;
  onForgotReasonChange: (value: string) => void;
  onConfirmStartDate: (date: Date) => void;
  onCancelStartDate: () => void;
  onConfirmEndDate: (date: Date) => void;
  onCancelEndDate: () => void;
  onConfirmPermissionDate: (date: Date) => void;
  onCancelPermissionDate: () => void;
  onConfirmForgotDate: (date: Date) => void;
  onCancelForgotDate: () => void;
  onConfirmStartTime: (date: Date) => void;
  onCancelStartTime: () => void;
  onConfirmEndTime: (date: Date) => void;
  onCancelEndTime: () => void;
  onConfirmForgotTime: (date: Date) => void;
  onCancelForgotTime: () => void;
}

const ApplyModal: React.FC<ApplyModalProps> = ({
  visible,
  isSubmitting,
  requestType,
  employeeName,
  empIdOrEmail,
  allRecipients,
  toRecipients,
  ccRecipients,
  extraRecipientEmails,
  isToDropdownOpen,
  isCcDropdownOpen,
  leaveType,
  leaveTypes,
  startDate,
  endDate,
  editableDays,
  description,
  permissionType,
  permissionDate,
  permissionStartTime,
  permissionEndTime,
  durationOption,
  hoursDuration,
  minutesDuration,
  forgotCheckType,
  forgotDate,
  forgotTime,
  forgotReason,
  isStartDatePickerVisible,
  isEndDatePickerVisible,
  isPermissionDatePickerVisible,
  isForgotDatePickerVisible,
  isStartTimePickerVisible,
  isEndTimePickerVisible,
  isForgotTimePickerVisible,
  onClose,
  onSubmit,
  onRequestTypeChange,
  onToggleToDropdown,
  onToggleCcDropdown,
  onToggleRecipient,
  onChangeExtraEmails,
  getSelectedToRecipients,
  getSelectedCcRecipients,
  onLeaveTypeChange,
  onStartDatePress,
  onEndDatePress,
  onEditableDaysChange,
  onDescriptionChange,
  onDisableAutoDays,
  onPermissionTypeChange,
  onPermissionDatePress,
  onStartTimePress,
  onEndTimePress,
  onDurationOptionChange,
  onHoursDurationChange,
  onMinutesDurationChange,
  onForgotTypeChange,
  onForgotDatePress,
  onForgotTimePress,
  onForgotReasonChange,
  onConfirmStartDate,
  onCancelStartDate,
  onConfirmEndDate,
  onCancelEndDate,
  onConfirmPermissionDate,
  onCancelPermissionDate,
  onConfirmForgotDate,
  onCancelForgotDate,
  onConfirmStartTime,
  onCancelStartTime,
  onConfirmEndTime,
  onCancelEndTime,
  onConfirmForgotTime,
  onCancelForgotTime,
}) => (
  <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Apply Leave/Permission</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView
          style={styles.modalBody}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          extraScrollHeight={120}
          avoidKeyboard={false}
        >
          <EmployeeInfoCard employeeName={employeeName} empIdOrEmail={empIdOrEmail} />

          <EmailNotificationsSection
            allRecipients={allRecipients}
            toRecipients={toRecipients}
            ccRecipients={ccRecipients}
            extraRecipientEmails={extraRecipientEmails}
            isToDropdownOpen={isToDropdownOpen}
            isCcDropdownOpen={isCcDropdownOpen}
            onToggleToDropdown={onToggleToDropdown}
            onToggleCcDropdown={onToggleCcDropdown}
            onToggleRecipient={onToggleRecipient}
            onChangeExtraEmails={onChangeExtraEmails}
            getSelectedToRecipients={getSelectedToRecipients}
            getSelectedCcRecipients={getSelectedCcRecipients}
          />

          <RequestTypeToggle requestType={requestType} onChange={onRequestTypeChange} />

          {requestType === "leave" ? (
            <LeaveForm
              leaveType={leaveType}
              leaveTypes={leaveTypes}
              startDate={startDate}
              endDate={endDate}
              editableDays={editableDays}
              description={description}
              onLeaveTypeChange={onLeaveTypeChange}
              onStartDatePress={onStartDatePress}
              onEndDatePress={onEndDatePress}
              onEditableDaysChange={onEditableDaysChange}
              onDescriptionChange={onDescriptionChange}
              onDisableAutoDays={onDisableAutoDays}
              calculateDays={(start, end) => {
                const startDateValue = new Date(start);
                const endDateValue = new Date(end);
                const diffTime = Math.abs(endDateValue.getTime() - startDateValue.getTime());
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
              }}
            />
          ) : (
            <PermissionForm
              permissionType={permissionType}
              permissionDate={permissionDate}
              permissionStartTime={permissionStartTime}
              permissionEndTime={permissionEndTime}
              startDate={startDate}
              endDate={endDate}
              durationOption={durationOption}
              hoursDuration={hoursDuration}
              minutesDuration={minutesDuration}
              forgotCheckType={forgotCheckType}
              forgotDate={forgotDate}
              forgotTime={forgotTime}
              forgotReason={forgotReason}
              description={description}
              editableDays={editableDays}
              onPermissionTypeChange={onPermissionTypeChange}
              onPermissionDatePress={onPermissionDatePress}
              onStartTimePress={onStartTimePress}
              onEndTimePress={onEndTimePress}
              onStartDatePress={onStartDatePress}
              onEndDatePress={onEndDatePress}
              onDurationOptionChange={onDurationOptionChange}
              onHoursDurationChange={onHoursDurationChange}
              onMinutesDurationChange={onMinutesDurationChange}
              onForgotTypeChange={onForgotTypeChange}
              onForgotDatePress={onForgotDatePress}
              onForgotTimePress={onForgotTimePress}
              onForgotReasonChange={onForgotReasonChange}
              onDescriptionChange={onDescriptionChange}
              onEditableDaysChange={onEditableDaysChange}
              onDisableAutoDays={onDisableAutoDays}
            />
          )}

          <TouchableOpacity
            style={[styles.submitButton, toRecipients.length === 0 && styles.submitButtonDisabled]}
            onPress={onSubmit}
            disabled={isSubmitting || toRecipients.length === 0}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.submitButtonText}>
                  {requestType === "leave" ? "Submit Leave Request" : "Submit Permission Request"}
                </Text>
                <Text style={styles.submitButtonSubText}>
                  ({toRecipients.length} recipient{toRecipients.length !== 1 ? "s" : ""})
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </View>
    </KeyboardAvoidingView>

    <DateTimePickerModal
      isVisible={isStartDatePickerVisible}
      mode="date"
      onConfirm={onConfirmStartDate}
      onCancel={onCancelStartDate}
      minimumDate={new Date()}
    />

    <DateTimePickerModal
      isVisible={isEndDatePickerVisible}
      mode="date"
      onConfirm={onConfirmEndDate}
      onCancel={onCancelEndDate}
      minimumDate={startDate ? new Date(startDate) : new Date()}
    />

    <DateTimePickerModal
      isVisible={isPermissionDatePickerVisible}
      mode="date"
      onConfirm={onConfirmPermissionDate}
      onCancel={onCancelPermissionDate}
      minimumDate={new Date()}
    />

    <DateTimePickerModal
      isVisible={isForgotDatePickerVisible}
      mode="date"
      onConfirm={onConfirmForgotDate}
      onCancel={onCancelForgotDate}
      maximumDate={new Date()}
    />

    <DateTimePickerModal
      isVisible={isStartTimePickerVisible}
      mode="time"
      onConfirm={onConfirmStartTime}
      onCancel={onCancelStartTime}
    />

    <DateTimePickerModal
      isVisible={isEndTimePickerVisible}
      mode="time"
      onConfirm={onConfirmEndTime}
      onCancel={onCancelEndTime}
    />

    <DateTimePickerModal
      isVisible={isForgotTimePickerVisible}
      mode="time"
      onConfirm={onConfirmForgotTime}
      onCancel={onCancelForgotTime}
    />
  </Modal>
);

export default ApplyModal;
