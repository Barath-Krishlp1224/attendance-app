import { Dimensions, StyleSheet } from "react-native";
import { layoutStyles } from "./layout";
import { formStyles } from "./forms";
import { modalStyles } from "./modals";

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const styles = StyleSheet.create({
  ...layoutStyles(SCREEN_WIDTH),
  ...formStyles(SCREEN_WIDTH),
  ...modalStyles(SCREEN_HEIGHT),
} as any);
