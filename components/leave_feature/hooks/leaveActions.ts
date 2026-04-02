import { Alert } from "react-native";
import { API_BASE_URL } from "../constants";
import { calculateDays, getFinalDuration } from "../utils";

interface ResetFormParams {
  setLeaveType: (value: string) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  setDescription: (value: string) => void;
  setRequestType: (value: "leave" | "permission") => void;
  setPermissionType: (value: "permission" | "wfh" | "on-duty" | "forgot-check") => void;
  setPermissionDate: (value: string) => void;
  setPermissionStartTime: (value: string) => void;
  setPermissionEndTime: (value: string) => void;
  setDurationOption: (value: "hours" | "first-half" | "second-half" | "minutes") => void;
  setHoursDuration: (value: string) => void;
  setMinutesDuration: (value: string) => void;
  setForgotCheckType: (value: "in" | "out") => void;
  setForgotDate: (value: string) => void;
  setForgotTime: (value: string) => void;
  setForgotReason: (value: string) => void;
  setEditableDays: (value: string) => void;
  setIsCalculatingFromDates: (value: boolean) => void;
}

export const createResetForm = (params: ResetFormParams) => () => {
  params.setLeaveType("sick");
  params.setStartDate("");
  params.setEndDate("");
  params.setDescription("");
  params.setRequestType("leave");
  params.setPermissionType("permission");
  params.setPermissionDate("");
  params.setPermissionStartTime("");
  params.setPermissionEndTime("");
  params.setDurationOption("hours");
  params.setHoursDuration("1");
  params.setMinutesDuration("30");
  params.setForgotCheckType("in");
  params.setForgotDate("");
  params.setForgotTime("");
  params.setForgotReason("");
  params.setEditableDays("1");
  params.setIsCalculatingFromDates(true);
};

interface SubmitParams {
  getCurrentEmployeeId: () => Promise<string>;
  requestType: "leave" | "permission";
  leaveType: string;
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
  employeeName: string;
  toRecipients: string[];
  ccRecipients: string[];
  extraRecipientEmails: string;
  setIsModalOpen: (value: boolean) => void;
  resetForm: () => void;
  refreshData: () => Promise<void>;
}

export const createHandleSubmitRequest = (params: SubmitParams) => async () => {
  const employeeId = await params.getCurrentEmployeeId();
  if (!employeeId) {
    Alert.alert("Error", "Please log in to submit requests");
    return;
  }

  if (params.requestType === "leave") {
    if (!params.startDate) {
      Alert.alert("Error", "Please select a start date");
      return;
    }

    const days =
      params.editableDays && parseFloat(params.editableDays) > 0
        ? parseFloat(params.editableDays)
        : calculateDays(params.startDate, params.endDate || params.startDate);

    const leaveData = {
      empIdOrEmail: employeeId,
      leaveType: params.leaveType,
      startDate: params.startDate,
      endDate: params.endDate || params.startDate,
      days: days,
      description: params.description,
      status: "pending",
      employeeId: employeeId,
      employeeName: params.employeeName,
      toRecipients: params.toRecipients,
      ccRecipients: params.ccRecipients,
      extraRecipientEmails: params.extraRecipientEmails,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leaveData),
      });

      if (response.ok) {
        Alert.alert("Success", "Leave request submitted successfully!");
        params.setIsModalOpen(false);
        params.resetForm();
        await params.refreshData();
      } else {
        let errorMessage = "Failed to submit leave request";
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          errorMessage = await response.text();
        }
        Alert.alert("Error", errorMessage);
      }
    } catch (error) {
      console.error("Error submitting leave request:", error);
      Alert.alert("Error", "An error occurred. Please try again.");
    }
    return;
  }

  let permissionData: any = {
    empIdOrEmail: employeeId,
    requestType: "permission",
    permissionType: params.permissionType,
    employeeId: employeeId,
    employeeName: params.employeeName,
    status: "pending",
    toRecipients: params.toRecipients,
    ccRecipients: params.ccRecipients,
    extraRecipientEmails: params.extraRecipientEmails,
  };

  const finalDuration = getFinalDuration(params.durationOption, params.hoursDuration, params.minutesDuration);

  if (params.permissionType === "permission") {
    if (!params.permissionDate) {
      Alert.alert("Error", "Please select date for permission");
      return;
    }

    permissionData = {
      ...permissionData,
      date: params.permissionDate,
      startTime: params.permissionStartTime || "09:00",
      endTime: params.permissionEndTime || "10:00",
      duration: finalDuration,
      reason: params.description,
      description: params.description,
    };
  } else if (params.permissionType === "wfh") {
    if (!params.startDate || !params.endDate) {
      Alert.alert("Error", "Please select date range for WFH");
      return;
    }

    permissionData = {
      ...permissionData,
      startDate: params.startDate,
      endDate: params.endDate,
      days: params.editableDays || calculateDays(params.startDate, params.endDate),
      reason: params.description,
      description: params.description,
    };
  } else if (params.permissionType === "on-duty") {
    if (!params.permissionDate) {
      Alert.alert("Error", "Please select date for On Duty");
      return;
    }

    permissionData = {
      ...permissionData,
      date: params.permissionDate,
      time: params.permissionStartTime || "09:00",
      duration: finalDuration,
      reason: params.description,
      description: params.description,
    };
  } else if (params.permissionType === "forgot-check") {
    if (!params.forgotDate || !params.forgotTime) {
      Alert.alert("Error", "Please select date and time for forgot check");
      return;
    }

    permissionData = {
      ...permissionData,
      date: params.forgotDate,
      time: params.forgotTime,
      forgotType: params.forgotCheckType,
      forgotReason: params.forgotReason || params.description,
      reason: params.description,
      description: params.description,
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissionData),
    });

    if (response.ok) {
      Alert.alert(
        "Success",
        `${params.permissionType.charAt(0).toUpperCase() + params.permissionType.slice(1)} request submitted successfully!`
      );
      params.setIsModalOpen(false);
      params.resetForm();
      await params.refreshData();
    } else {
      let errorMessage = `Failed to submit ${params.permissionType} request`;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } else {
        errorMessage = await response.text();
      }
      Alert.alert("Error", errorMessage);
    }
  } catch (error) {
    console.error("Error submitting permission request:", error);
    Alert.alert("Error", "An error occurred. Please try again.");
  }
};
