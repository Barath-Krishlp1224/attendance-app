import React from "react";
import TopBar from "../../common/TopBar";

interface LeaveHeaderProps {
  employeeName?: string;
}

const LeaveHeader: React.FC<LeaveHeaderProps> = () => (
  <TopBar subtitle="Leave & Permission Dashboard" />
);

export default LeaveHeader;
