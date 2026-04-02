import React from "react";
import { View } from "react-native";
import { styles } from "../styles";

const StatBoxSkeleton = () => (
  <View style={[styles.statBox, styles.shadowSm]}>
    <View style={styles.statHeader}>
      <View style={[styles.statIconContainer, styles.skeletonBg]}>
        <View style={[styles.skeleton, { width: 20, height: 20 }]} />
      </View>
      <View style={styles.statTextContainer}>
        <View style={[styles.skeleton, { width: 60, height: 14, marginBottom: 4 }]} />
        <View style={[styles.skeleton, { width: 50, height: 12 }]} />
      </View>
    </View>
    <View style={styles.statContent}>
      <View style={[styles.skeleton, { width: 40, height: 28, marginBottom: 12 }]} />
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, styles.skeletonBg]}>
          <View style={[styles.skeleton, { width: "50%", height: "100%" }]} />
        </View>
        <View style={[styles.skeleton, { width: 30, height: 12 }]} />
      </View>
    </View>
  </View>
);

export default StatBoxSkeleton;
