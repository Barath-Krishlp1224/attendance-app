import React from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ChevronDown, ChevronUp, Lock, Mail, X } from "lucide-react-native";
import { Recipient } from "../types";
import { styles } from "../styles";

interface EmailNotificationsSectionProps {
  allRecipients: Recipient[];
  toRecipients: string[];
  ccRecipients: string[];
  extraRecipientEmails: string;
  isToDropdownOpen: boolean;
  isCcDropdownOpen: boolean;
  onToggleToDropdown: () => void;
  onToggleCcDropdown: () => void;
  onToggleRecipient: (id: string, type: "to" | "cc") => void;
  onChangeExtraEmails: (value: string) => void;
  getSelectedToRecipients: () => Recipient[];
  getSelectedCcRecipients: () => Recipient[];
}

const EmailNotificationsSection: React.FC<EmailNotificationsSectionProps> = ({
  allRecipients,
  toRecipients,
  ccRecipients,
  extraRecipientEmails,
  isToDropdownOpen,
  isCcDropdownOpen,
  onToggleToDropdown,
  onToggleCcDropdown,
  onToggleRecipient,
  onChangeExtraEmails,
  getSelectedToRecipients,
  getSelectedCcRecipients,
}) => (
  <View style={[styles.formSection, { marginBottom: 20 }]}>
    <View style={styles.sectionHeaderRow}>
      <Mail size={18} color="#475569" />
      <Text style={styles.sectionHeaderText}>Email Notifications</Text>
    </View>

    <View>
      <Text style={styles.formLabel}>To (Required)</Text>
      <TouchableOpacity style={styles.pickerContainer} onPress={onToggleToDropdown}>
        <Text style={styles.pickerText}>
          {toRecipients.length > 0
            ? `${toRecipients.length} recipient${toRecipients.length !== 1 ? "s" : ""} selected`
            : "Select recipients"}
        </Text>
        {isToDropdownOpen ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
      </TouchableOpacity>

      {isToDropdownOpen && (
        <View style={styles.recipientDropdownMenu}>
          <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
            {allRecipients.map((recipient) => (
              <TouchableOpacity
                key={recipient.id}
                style={[styles.recipientDropdownItem, recipient.lockedInCc && { opacity: 0.5 }]}
                onPress={() => !recipient.lockedInCc && onToggleRecipient(recipient.id, "to")}
              >
                <View style={[styles.checkboxContainer, toRecipients.includes(recipient.id) && styles.checkboxActive]}>
                  {toRecipients.includes(recipient.id) && <View style={styles.checkboxInner} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.recipientNameText}>
                    {recipient.name}
                    {recipient.lockedInCc && <Text style={styles.lockedCcText}> (Always in CC)</Text>}
                  </Text>
                  <Text style={styles.recipientEmailText}>{recipient.email}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{recipient.role}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {toRecipients.length === 0 && <Text style={styles.errorText}>Please select at least one recipient</Text>}

      {toRecipients.length > 0 && (
        <View style={styles.selectedPillsContainer}>
          {getSelectedToRecipients().map((recipient) => (
            <View key={recipient.id} style={styles.selectedPillTo}>
              <Text style={styles.selectedPillTextTo}>{recipient.name}</Text>
              <TouchableOpacity onPress={() => onToggleRecipient(recipient.id, "to")}>
                <X size={14} color="#1d4ed8" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>

    <View>
      <Text style={styles.formLabel}>Additional Emails (Optional)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Type additional emails here..."
        placeholderTextColor="#94a3b8"
        value={extraRecipientEmails}
        onChangeText={onChangeExtraEmails}
      />
    </View>

    <View>
      <Text style={styles.formLabel}>CC (Required - HR is always included)</Text>
      <TouchableOpacity style={styles.pickerContainer} onPress={onToggleCcDropdown}>
        <Text style={styles.pickerText}>
          {ccRecipients.length > 0
            ? `${ccRecipients.length} recipient${ccRecipients.length !== 1 ? "s" : ""} selected`
            : "Select CC recipients"}
        </Text>
        {isCcDropdownOpen ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
      </TouchableOpacity>

      {isCcDropdownOpen && (
        <View style={styles.recipientDropdownMenu}>
          <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
            {allRecipients.map((recipient) => (
              <TouchableOpacity
                key={recipient.id}
                style={styles.recipientDropdownItem}
                onPress={() => onToggleRecipient(recipient.id, "cc")}
              >
                <View style={{ position: "relative" }}>
                  <View
                    style={[
                      styles.checkboxContainer,
                      ccRecipients.includes(recipient.id) &&
                        (recipient.lockedInCc ? styles.checkboxActiveLocked : styles.checkboxActive),
                    ]}
                  >
                    {ccRecipients.includes(recipient.id) && <View style={styles.checkboxInner} />}
                  </View>
                  {recipient.lockedInCc && (
                    <View style={styles.lockedIconContainer}>
                      <Lock size={10} color="#64748b" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.recipientNameText}>
                    {recipient.name}
                    {recipient.lockedInCc && <Text style={styles.lockedCcTextBlue}> (Required)</Text>}
                  </Text>
                  <Text style={styles.recipientEmailText}>{recipient.email}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{recipient.role}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {ccRecipients.length > 0 && (
        <View style={styles.selectedPillsContainer}>
          {getSelectedCcRecipients().map((recipient) => (
            <View key={recipient.id} style={styles.selectedPillCc}>
              <Text style={styles.selectedPillTextCc}>{recipient.name}</Text>
              {!recipient.lockedInCc && (
                <TouchableOpacity onPress={() => onToggleRecipient(recipient.id, "cc")}>
                  <X size={14} color="#374151" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  </View>
);

export default EmailNotificationsSection;
