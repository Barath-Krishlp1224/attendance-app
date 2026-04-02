import React from "react";
import { Text, View } from "react-native";
import { styles } from "../styles";

interface EmployeeInfoCardProps {
  employeeName: string;
  empIdOrEmail: string;
}

const EmployeeInfoCard: React.FC<EmployeeInfoCardProps> = ({ employeeName, empIdOrEmail }) => (
  <View style={styles.employeeInfo}>
    <Text style={styles.employeeName}>{employeeName}</Text>
    <Text style={styles.employeeId}>ID: {empIdOrEmail}</Text>
  </View>
);

export default EmployeeInfoCard;
