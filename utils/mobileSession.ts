import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE_URL = "https://unity-uat.lemonpay.in";

export type MobileUserSession = {
  userId: string;
  userEmpId: string;
  userName: string;
  userRole: string;
  userTeam: string;
  userDesignation: string;
  userEmail: string;
};

export const DEFAULT_EMAIL_RECIPIENTS = [
  { id: "hr", name: "HR Team", email: "hr@lemonpay.tech", role: "HR", lockedInCc: true },
  { id: "bala", name: "Bala", email: "bala@lemonpay.tech", role: "Manager" },
  { id: "ramesh", name: "Ramesh", email: "ramesh@lemonpay.tech", role: "Manager" },
  { id: "founders", name: "Founders", email: "founders@lemonpay.tech", role: "Leadership" },
] as const;

export async function getMobileUserSession(): Promise<MobileUserSession> {
  const entries = await AsyncStorage.multiGet([
    "userId",
    "userEmpId",
    "userName",
    "userRole",
    "userTeam",
    "userDesignation",
    "userEmail",
  ]);

  const map = Object.fromEntries(entries);

  return {
    userId: map.userId || map.userEmpId || "",
    userEmpId: map.userEmpId || "",
    userName: map.userName || "",
    userRole: map.userRole || "",
    userTeam: map.userTeam || "",
    userDesignation: map.userDesignation || "",
    userEmail: map.userEmail || "",
  };
}

export async function getMobileAuthHeaders(): Promise<Record<string, string>> {
  const session = await getMobileUserSession();

  return {
    "x-user-id": session.userId || session.userEmpId,
    "x-user-emp-id": session.userEmpId,
    "x-user-name": session.userName,
    "x-user-role": session.userRole,
    "x-user-team": session.userTeam,
    "x-user-designation": session.userDesignation,
    "x-user-email": session.userEmail,
  };
}

export function isLeaveApprover(role: string, team: string, designation: string) {
  const normalizedRole = role.toLowerCase();
  const normalizedTeam = team.toLowerCase();
  const normalizedDesignation = designation.toLowerCase();

  return (
    normalizedRole === "admin" ||
    normalizedRole === "manager" ||
    normalizedRole === "teamlead" ||
    normalizedTeam.includes("hr") ||
    normalizedTeam.includes("manager") ||
    normalizedDesignation.includes("manager") ||
    normalizedDesignation.includes("general manager")
  );
}

export function canManageHolidays(role: string, team: string, designation: string) {
  const normalizedRole = role.toLowerCase();
  const normalizedTeam = team.toLowerCase();
  const normalizedDesignation = designation.toLowerCase();

  return (
    normalizedRole === "admin" ||
    normalizedRole === "manager" ||
    normalizedTeam.includes("hr") ||
    normalizedDesignation.includes("manager")
  );
}

export function canManagePayroll(role: string, team: string, designation: string) {
  const normalizedRole = role.toLowerCase();
  const normalizedTeam = team.toLowerCase();
  const normalizedDesignation = designation.toLowerCase();

  return (
    normalizedRole === "admin" ||
    normalizedTeam.includes("hr") ||
    normalizedDesignation.includes("hr") ||
    normalizedDesignation.includes("human resources")
  );
}

export function canReviewOnboarding(role: string, team: string, designation: string) {
  const normalizedRole = role.toLowerCase();
  const normalizedTeam = team.toLowerCase();
  const normalizedDesignation = designation.toLowerCase();

  return (
    normalizedRole === "admin" ||
    normalizedRole === "manager" ||
    normalizedRole === "teamlead" ||
    normalizedTeam.includes("hr") ||
    normalizedTeam.includes("it") ||
    normalizedDesignation.includes("manager") ||
    normalizedDesignation.includes("lead")
  );
}

export function getApproverRoleLabel(role: string, team: string, designation: string) {
  const normalizedTeam = team.toLowerCase();
  const normalizedDesignation = designation.toLowerCase();
  const normalizedRole = role.toLowerCase();

  if (normalizedTeam.includes("hr")) return "HR";
  if (normalizedDesignation.includes("general manager")) return "Admin-Manager";
  if (normalizedRole === "manager") return "Admin-Manager";
  if (normalizedRole === "teamlead") return "TL";
  return role || "Admin-Manager";
}
