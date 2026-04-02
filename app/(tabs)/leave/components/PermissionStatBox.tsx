import React from "react";
import { Text, View } from "react-native";
import { styles } from "../styles";
import { PermissionStatBoxProps } from "../types";

const PermissionStatBox: React.FC<PermissionStatBoxProps> = ({
  type,
  label,
  used = 0,
  remaining = 0,
  limit = 0,
  unit = "hours",
  pending = 0,
  color,
  icon,
}) => {
  const progress = limit > 0 ? (used / limit) * 100 : 0;

  return (
    <View style={[styles.statBox, styles.shadowSm]}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
          {icon}
        </View>
        <View style={styles.statTextContainer}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statSub}>{limit > 0 ? `${unit} remaining` : `${pending} pending`}</Text>
        </View>
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{limit > 0 ? `${remaining} / ${limit}` : pending}</Text>
        {limit > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: color, width: `${Math.min(progress, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{progress.toFixed(1)}% used</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default PermissionStatBox;
