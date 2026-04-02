import React from "react";
import { Text, View } from "react-native";
import { styles } from "../styles";
import { StatBoxProps } from "../types";

const StatBox: React.FC<StatBoxProps> = ({
  icon,
  label,
  value,
  sub,
  progress,
  color,
  isBalance = false,
  totalLimit = 0,
}) => (
  <View style={[styles.statBox, styles.shadowSm]}>
    <View style={styles.statHeader}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
        {icon}
      </View>
      <View style={styles.statTextContainer}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statSub}>{sub}</Text>
      </View>
    </View>
    <View style={styles.statContent}>
      <Text style={styles.statValue}>{isBalance ? `${value} / ${totalLimit}` : value}</Text>
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: color, width: `${Math.min(progress, 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{progress.toFixed(1)}%</Text>
      </View>
    </View>
  </View>
);

export default StatBox;
