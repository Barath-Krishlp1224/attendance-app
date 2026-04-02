export const formatTime = (timeStr?: string) => {
  if (!timeStr) return "--:--";
  const date = new Date(timeStr);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const calculateDays = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

export const calculateTimeDuration = (startTime: string, endTime: string) => {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  let durationMinutes = endTotalMinutes - startTotalMinutes;
  if (durationMinutes < 0) {
    durationMinutes += 24 * 60;
  }

  return (durationMinutes / 60).toFixed(1);
};

export const getFinalDuration = (
  durationOption: "hours" | "first-half" | "second-half" | "minutes",
  hoursDuration: string,
  minutesDuration: string
) => {
  switch (durationOption) {
    case "hours":
      return parseFloat(hoursDuration).toFixed(1);
    case "first-half":
      return "4.0";
    case "second-half":
      return "4.0";
    case "minutes":
      return (parseFloat(minutesDuration) / 60).toFixed(1);
    default:
      return "1.0";
  }
};

export const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case "approved":
    case "auto-approved":
      return { backgroundColor: "#dcfce7", borderColor: "#86efac", color: "#166534" };
    case "rejected":
      return { backgroundColor: "#fee2e2", borderColor: "#fca5a5", color: "#991b1b" };
    case "pending":
      return { backgroundColor: "#fef9c3", borderColor: "#fde047", color: "#854d0e" };
    case "manager-pending":
      return { backgroundColor: "#dbeafe", borderColor: "#93c5fd", color: "#1e40af" };
    default:
      return { backgroundColor: "#f3f4f6", borderColor: "#d1d5db", color: "#374151" };
  }
};

export const getStatusText = (status: string) => {
  switch (status) {
    case "approved":
      return "Approved";
    case "auto-approved":
      return "Auto Approved";
    case "rejected":
      return "Rejected";
    case "pending":
      return "Pending TL Review";
    case "manager-pending":
      return "Pending Manager Review";
    default:
      return status;
  }
};
