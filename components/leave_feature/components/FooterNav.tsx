import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { type Href, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarDays,
  Fingerprint,
  History as HistoryIcon,
  MessageSquare,
  PartyPopper,
  ReceiptText,
  UserRoundCheck,
} from "lucide-react-native";

type TabKey = "attendance" | "chat" | "leave" | "history" | "holidays" | "payslip" | "onboarding";

type FooterNavProps = {
  activeTab: TabKey;
};

type FooterTab = {
  key: TabKey;
  label: string;
  route: Href;
  Icon: typeof Fingerprint;
};

export const FOOTER_NAV_BASE_HEIGHT = 74;

export const getFooterNavClearance = (bottomInset: number) =>
  FOOTER_NAV_BASE_HEIGHT + Math.max(bottomInset, 10) + 12;

const TABS: FooterTab[] = [
  {
    key: "attendance" as const,
    label: "Mark Attendance",
    route: "/attendance",
    Icon: Fingerprint,
  },
  {
    key: "chat" as const,
    label: "Chat",
    route: "/chat",
    Icon: MessageSquare,
  },
  {
    key: "leave" as const,
    label: "Leaves",
    route: "/leave",
    Icon: CalendarDays,
  },
  {
    key: "history" as const,
    label: "History",
    route: "/att-history",
    Icon: HistoryIcon,
  },
  {
    key: "holidays" as const,
    label: "Holidays",
    route: "/holidays",
    Icon: PartyPopper,
  },
  {
    key: "payslip" as const,
    label: "Payslip",
    route: "/payslip",
    Icon: ReceiptText,
  },
  {
    key: "onboarding" as const,
    label: "Onboarding",
    route: "/onboarding",
    Icon: UserRoundCheck,
  },
];

const FooterNav = ({ activeTab }: FooterNavProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        localStyles.footer,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          minHeight: FOOTER_NAV_BASE_HEIGHT + insets.bottom,
        },
      ]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={localStyles.footerScrollContent}
        keyboardShouldPersistTaps="handled">
        {TABS.map(({ key, label, route, Icon }) => {
          const isActive = key === activeTab;

          return (
            <TouchableOpacity
              key={key}
              style={[localStyles.footerButton, isActive && localStyles.footerButtonActive]}
              onPress={() => router.push(route)}
              activeOpacity={0.8}>
              <View style={[localStyles.iconWrap, isActive && localStyles.iconWrapActive]}>
                <Icon size={18} color={isActive ? "#059669" : "#64748b"} />
              </View>
              <View style={localStyles.labelWrap}>
                <Text
                  numberOfLines={2}
                  style={[localStyles.footerLabel, isActive && localStyles.footerLabelActive]}>
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const localStyles = StyleSheet.create({
  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  footerScrollContent: {
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  footerButton: {
    width: 88,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 18,
  },
  footerButtonActive: {
    backgroundColor: "#ecfdf5",
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  iconWrapActive: {
    backgroundColor: "#d1fae5",
  },
  labelWrap: {
    minHeight: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    width: "100%",
  },
  footerLabel: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 13,
    fontWeight: "600",
  },
  footerLabelActive: {
    color: "#059669",
    fontWeight: "700",
  },
});

export default FooterNav;
