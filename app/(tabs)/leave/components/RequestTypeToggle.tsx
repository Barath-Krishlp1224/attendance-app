import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

interface RequestTypeToggleProps {
  requestType: "leave" | "permission";
  onChange: (type: "leave" | "permission") => void;
}

const RequestTypeToggle: React.FC<RequestTypeToggleProps> = ({ requestType, onChange }) => (
  <View style={styles.requestTypeSelector}>
    <TouchableOpacity
      style={[styles.requestTypeButton, requestType === "leave" && styles.requestTypeButtonActive]}
      onPress={() => onChange("leave")}
    >
      <Text
        style={[
          styles.requestTypeButtonText,
          requestType === "leave" && styles.requestTypeButtonTextActive,
        ]}
      >
        Leave Request
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.requestTypeButton, requestType === "permission" && styles.requestTypeButtonActive]}
      onPress={() => onChange("permission")}
    >
      <Text
        style={[
          styles.requestTypeButtonText,
          requestType === "permission" && styles.requestTypeButtonTextActive,
        ]}
      >
        Permission
      </Text>
    </TouchableOpacity>
  </View>
);

export default RequestTypeToggle;
