import { ApplyModalProps } from "../components/ApplyModal";
import { Recipient } from "../types";

interface ApplyModalState {
  isModalOpen: boolean;
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
  leaveTypes: { value: string; label: string }[];
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
}

interface ApplyModalHandlers {
  resetForm: () => void;
  onSubmit: () => void;
  onToggleRecipient: (id: string, type: "to" | "cc") => void;
  getSelectedToRecipients: () => Recipient[];
  getSelectedCcRecipients: () => Recipient[];
  setIsModalOpen: (value: boolean) => void;
  setIsToDropdownOpen: (value: boolean) => void;
  setIsCcDropdownOpen: (value: boolean) => void;
  setLeaveType: (value: string) => void;
  setRequestType: (value: "leave" | "permission") => void;
  setStartDatePickerVisibility: (value: boolean) => void;
  setEndDatePickerVisibility: (value: boolean) => void;
  setEditableDays: (value: string) => void;
  setDescription: (value: string) => void;
  setIsCalculatingFromDates: (value: boolean) => void;
  setPermissionType: (value: "permission" | "wfh" | "on-duty" | "forgot-check") => void;
  setPermissionDatePickerVisibility: (value: boolean) => void;
  setStartTimePickerVisibility: (value: boolean) => void;
  setEndTimePickerVisibility: (value: boolean) => void;
  setDurationOption: (value: "hours" | "first-half" | "second-half" | "minutes") => void;
  setHoursDuration: (value: string) => void;
  setMinutesDuration: (value: string) => void;
  setForgotCheckType: (value: "in" | "out") => void;
  setForgotDatePickerVisibility: (value: boolean) => void;
  setForgotTimePickerVisibility: (value: boolean) => void;
  setForgotReason: (value: string) => void;
  setExtraRecipientEmails: (value: string) => void;
  setPermissionDate: (value: string) => void;
  setPermissionStartTime: (value: string) => void;
  setPermissionEndTime: (value: string) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  setForgotDate: (value: string) => void;
  setForgotTime: (value: string) => void;
}

export const buildApplyModalProps = (state: ApplyModalState, handlers: ApplyModalHandlers): ApplyModalProps => ({
  visible: state.isModalOpen,
  isSubmitting: state.isSubmitting,
  requestType: state.requestType,
  employeeName: state.employeeName,
  empIdOrEmail: state.empIdOrEmail,
  allRecipients: state.allRecipients,
  toRecipients: state.toRecipients,
  ccRecipients: state.ccRecipients,
  extraRecipientEmails: state.extraRecipientEmails,
  isToDropdownOpen: state.isToDropdownOpen,
  isCcDropdownOpen: state.isCcDropdownOpen,
  leaveType: state.leaveType,
  leaveTypes: state.leaveTypes,
  startDate: state.startDate,
  endDate: state.endDate,
  editableDays: state.editableDays,
  description: state.description,
  permissionType: state.permissionType,
  permissionDate: state.permissionDate,
  permissionStartTime: state.permissionStartTime,
  permissionEndTime: state.permissionEndTime,
  durationOption: state.durationOption,
  hoursDuration: state.hoursDuration,
  minutesDuration: state.minutesDuration,
  forgotCheckType: state.forgotCheckType,
  forgotDate: state.forgotDate,
  forgotTime: state.forgotTime,
  forgotReason: state.forgotReason,
  isStartDatePickerVisible: state.isStartDatePickerVisible,
  isEndDatePickerVisible: state.isEndDatePickerVisible,
  isPermissionDatePickerVisible: state.isPermissionDatePickerVisible,
  isForgotDatePickerVisible: state.isForgotDatePickerVisible,
  isStartTimePickerVisible: state.isStartTimePickerVisible,
  isEndTimePickerVisible: state.isEndTimePickerVisible,
  isForgotTimePickerVisible: state.isForgotTimePickerVisible,
  onClose: () => {
    handlers.setIsModalOpen(false);
    handlers.resetForm();
  },
  onSubmit: handlers.onSubmit,
  onRequestTypeChange: handlers.setRequestType,
  onToggleToDropdown: () => {
    handlers.setIsToDropdownOpen(!state.isToDropdownOpen);
    handlers.setIsCcDropdownOpen(false);
  },
  onToggleCcDropdown: () => {
    handlers.setIsCcDropdownOpen(!state.isCcDropdownOpen);
    handlers.setIsToDropdownOpen(false);
  },
  onToggleRecipient: handlers.onToggleRecipient,
  onChangeExtraEmails: handlers.setExtraRecipientEmails,
  getSelectedToRecipients: handlers.getSelectedToRecipients,
  getSelectedCcRecipients: handlers.getSelectedCcRecipients,
  onLeaveTypeChange: handlers.setLeaveType,
  onStartDatePress: () => handlers.setStartDatePickerVisibility(true),
  onEndDatePress: () => handlers.setEndDatePickerVisibility(true),
  onEditableDaysChange: handlers.setEditableDays,
  onDescriptionChange: handlers.setDescription,
  onDisableAutoDays: () => handlers.setIsCalculatingFromDates(false),
  onPermissionTypeChange: handlers.setPermissionType,
  onPermissionDatePress: () => handlers.setPermissionDatePickerVisibility(true),
  onStartTimePress: () => handlers.setStartTimePickerVisibility(true),
  onEndTimePress: () => handlers.setEndTimePickerVisibility(true),
  onDurationOptionChange: handlers.setDurationOption,
  onHoursDurationChange: handlers.setHoursDuration,
  onMinutesDurationChange: handlers.setMinutesDuration,
  onForgotTypeChange: handlers.setForgotCheckType,
  onForgotDatePress: () => handlers.setForgotDatePickerVisibility(true),
  onForgotTimePress: () => handlers.setForgotTimePickerVisibility(true),
  onForgotReasonChange: handlers.setForgotReason,
  onConfirmStartDate: (date: Date) => {
    handlers.setStartDate(date.toISOString().split("T")[0]);
    handlers.setStartDatePickerVisibility(false);
  },
  onCancelStartDate: () => handlers.setStartDatePickerVisibility(false),
  onConfirmEndDate: (date: Date) => {
    handlers.setEndDate(date.toISOString().split("T")[0]);
    handlers.setEndDatePickerVisibility(false);
  },
  onCancelEndDate: () => handlers.setEndDatePickerVisibility(false),
  onConfirmPermissionDate: (date: Date) => {
    handlers.setPermissionDate(date.toISOString().split("T")[0]);
    handlers.setPermissionDatePickerVisibility(false);
  },
  onCancelPermissionDate: () => handlers.setPermissionDatePickerVisibility(false),
  onConfirmForgotDate: (date: Date) => {
    handlers.setForgotDate(date.toISOString().split("T")[0]);
    handlers.setForgotDatePickerVisibility(false);
  },
  onCancelForgotDate: () => handlers.setForgotDatePickerVisibility(false),
  onConfirmStartTime: (time: Date) => {
    handlers.setPermissionStartTime(time.toTimeString().split(" ")[0].substring(0, 5));
    handlers.setStartTimePickerVisibility(false);
  },
  onCancelStartTime: () => handlers.setStartTimePickerVisibility(false),
  onConfirmEndTime: (time: Date) => {
    handlers.setPermissionEndTime(time.toTimeString().split(" ")[0].substring(0, 5));
    handlers.setEndTimePickerVisibility(false);
  },
  onCancelEndTime: () => handlers.setEndTimePickerVisibility(false),
  onConfirmForgotTime: (time: Date) => {
    handlers.setForgotTime(time.toTimeString().split(" ")[0].substring(0, 5));
    handlers.setForgotTimePickerVisibility(false);
  },
  onCancelForgotTime: () => handlers.setForgotTimePickerVisibility(false),
});
