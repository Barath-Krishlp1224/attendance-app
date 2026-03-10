import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { CalendarDays, ChevronLeft, Copy, Fingerprint, History as HistoryIcon, MessageSquare, Paperclip, PartyPopper, Plus, Search, X } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View } from "react-native";
import { io, Socket } from "socket.io-client";

interface Employee {
    _id?: string;
    empId?: string;
    name: string;
    displayName?: string;
    photo?: string;
    mailId?: string;
    email?: string;
    phoneNumber?: string;
    department?: string;
    role?: string;
}

interface Attachment {
    fileName: string;
    url: string;
    fileType?: string;
    size?: number;
    s3Key?: string;
}

interface Message {
    _id?: string;
    roomId?: string;
    chatType?: "direct" | "group";
    groupId?: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    content?: string;
    attachments?: Attachment[];
    replyTo?: {
        messageId?: string;
        senderName?: string;
        content?: string;
    };
    deliveredTo?: string[];
    seenBy?: string[];
    editedAt?: string;
    createdAt?: string;
}

interface CurrentUser {
    empId: string;
    name: string;
}

interface DirectConversation {
    kind: "direct";
    id: string;
    partnerId: string;
    unreadCount: number;
    lastMessage?: Message;
}

interface GroupConversation {
    kind: "group";
    id: string;
    groupId: string;
    groupName: string;
    groupPhoto?: string;
    memberIds: string[];
    adminIds?: string[];
    adminOnlyMessaging?: boolean;
    unreadCount: number;
    lastMessage?: Message;
}

type Conversation = DirectConversation | GroupConversation;

interface LinkPreview {
    url: string;
    senderName: string;
    createdAt?: string;
}

let socket: Socket | null = null;
const API_BASE_URL = "https://unity-uat.lemonpay.in";

const makeRoomId = (userA: string, userB: string) => {
    return [userA.trim().toLowerCase(), userB.trim().toLowerCase()].sort().join("__");
};

const getConversationKey = (conversation: Conversation | null) => {
    if (!conversation) return "";
    return conversation.kind === "group"
        ? `group:${conversation.groupId}`
        : `direct:${conversation.partnerId}`;
};

const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const normalizeId = (value?: string) => String(value || "").trim().toLowerCase();

export default function ChatContent() {
    const router = useRouter();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedKey, setSelectedKey] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [text, setText] = useState("");
    const [pendingFiles, setPendingFiles] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
    const [isGroupPanelOpen, setIsGroupPanelOpen] = useState(false);
    const [selectedGroupMemberProfile, setSelectedGroupMemberProfile] = useState<Employee | null>(null);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);
    const [newGroupAdminOnlyMessaging, setNewGroupAdminOnlyMessaging] = useState(false);

    const [addMemberEmpId, setAddMemberEmpId] = useState("");
    const [groupActionBusy, setGroupActionBusy] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);
    const [editingMessageId, setEditingMessageId] = useState("");
    const [editingText, setEditingText] = useState("");
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
    const [forwardSearch, setForwardSearch] = useState("");
    const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
    const [clearedAtByConversation, setClearedAtByConversation] = useState<Record<string, number>>({});

    const employeeById = useMemo(() => {
        const map: Record<string, Employee> = {};
        employees.forEach((employee) => {
            const id = String(employee.empId || "").trim();
            if (id) map[id] = employee;
        });
        return map;
    }, [employees]);

    const clearedStorageKey = useMemo(
        () => `chatClearedAt:${currentUser?.empId || "guest"}`,
        [currentUser?.empId]
    );

    const sortedConversationList = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const knownDirectIds = new Set<string>();
        const list: Conversation[] = [...conversations];

        conversations.forEach((conversation) => {
            if (conversation.kind === "direct") {
                knownDirectIds.add(conversation.partnerId);
            }
        });

        if (query) {
            employees.forEach((employee) => {
                const empId = String(employee.empId || "").trim();
                if (!empId || knownDirectIds.has(empId)) return;
                list.push({
                    kind: "direct",
                    id: empId,
                    partnerId: empId,
                    unreadCount: 0,
                });
            });
        }

        const filtered = list.filter((conversation) => {
            if (!query) return true;
            if (conversation.kind === "group") {
                return conversation.groupName.toLowerCase().includes(query);
            }
            const employee = employeeById[conversation.partnerId];
            const label = String(employee?.displayName || employee?.name || conversation.partnerId).toLowerCase();
            return label.includes(query);
        });

        return filtered.sort((a, b) => {
            const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bt - at;
        });
    }, [conversations, employees, employeeById, searchTerm]);

    const conversationByKey = useMemo(() => {
        const map: Record<string, Conversation> = {};
        sortedConversationList.forEach((conversation) => {
            map[getConversationKey(conversation)] = conversation;
        });
        return map;
    }, [sortedConversationList]);

    const selectedConversation = useMemo(
        () => conversationByKey[selectedKey] || null,
        [conversationByKey, selectedKey]
    );

    const selectedEmployee = useMemo(() => {
        if (!selectedConversation || selectedConversation.kind !== "direct") return null;
        return employeeById[selectedConversation.partnerId] || null;
    }, [selectedConversation, employeeById]);

    const selectedGroup = useMemo(() => {
        if (!selectedConversation || selectedConversation.kind !== "group") return null;
        return selectedConversation;
    }, [selectedConversation]);

    const isSelectedGroupAdmin = useMemo(() => {
        if (!selectedGroup || !currentUser?.empId) return false;
        return (selectedGroup.adminIds || []).includes(currentUser.empId);
    }, [selectedGroup, currentUser?.empId]);

    const groupMembers = useMemo(() => {
        if (!selectedGroup) return [];
        return selectedGroup.memberIds
            .map((id) => ({
                empId: id,
                employee: employeeById[id] || null,
                isAdmin: (selectedGroup.adminIds || []).includes(id),
            }))
            .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin));
    }, [selectedGroup, employeeById]);

    const addableEmployees = useMemo(() => {
        if (!selectedGroup) return [];
        const memberSet = new Set(selectedGroup.memberIds || []);
        return employees.filter((employee) => {
            const empId = String(employee.empId || "").trim();
            return empId && !memberSet.has(empId);
        });
    }, [selectedGroup, employees]);

    const activeRoomId = useMemo(() => {
        if (!selectedConversation || !currentUser?.empId) return "";
        if (selectedConversation.kind === "group") {
            return `group_${selectedConversation.groupId.toLowerCase()}`;
        }
        return makeRoomId(currentUser.empId, selectedConversation.partnerId);
    }, [selectedConversation, currentUser?.empId]);

    const visibleMessages = useMemo(() => {
        if (!selectedConversation) return [];
        const clearTs = clearedAtByConversation[getConversationKey(selectedConversation)] || 0;
        return messages.filter((message) => {
            const ts = message.createdAt ? new Date(message.createdAt).getTime() : 0;
            return ts >= clearTs;
        });
    }, [messages, selectedConversation, clearedAtByConversation]);

    const canCurrentUserSend = useMemo(() => {
        if (!selectedConversation || !currentUser?.empId) return false;
        if (selectedConversation.kind !== "group") return true;
        if (!selectedConversation.adminOnlyMessaging) return true;
        return (selectedConversation.adminIds || []).includes(currentUser.empId);
    }, [selectedConversation, currentUser?.empId]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const empId = await AsyncStorage.getItem("userEmpId") || "";
                const name = await AsyncStorage.getItem("userName") || "You";
                if (empId) {
                    setCurrentUser({ empId, name });
                }
            } catch (e) {
                console.error("Failed to load user info from AsyncStorage", e);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (!currentUser?.empId) return;

        const loadEmployees = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/employees?limit=500`, { cache: "no-store" });
                const data = await response.json();
                const list: Employee[] = Array.isArray(data?.employees) ? data.employees : [];
                setEmployees(list.filter((employee) => String(employee.empId || "").trim() !== currentUser.empId));
            } catch (error) {
                console.error("Failed to fetch employees", error);
            }
        };

        loadEmployees();
    }, [currentUser?.empId]);

    useEffect(() => {
        if (!currentUser?.empId) return;

        const loadConversations = async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/chat/conversations?userId=${encodeURIComponent(currentUser.empId)}&t=${Date.now()}`,
                    { cache: "no-store" }
                );
                const data = await response.json();
                const list = Array.isArray(data?.conversations) ? data.conversations : [];
                setConversations(list as Conversation[]);
            } catch (error) {
                console.error("Failed to fetch conversations", error);
            }
        };

        loadConversations();
        const interval = setInterval(loadConversations, 10000);
        return () => clearInterval(interval);
    }, [currentUser?.empId, refreshTick]);

    useEffect(() => {
        const loadClearedChats = async () => {
            if (!currentUser?.empId) return;
            try {
                const raw = await AsyncStorage.getItem(clearedStorageKey);
                if (!raw) {
                    setClearedAtByConversation({});
                    return;
                }
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") {
                    setClearedAtByConversation(parsed as Record<string, number>);
                }
            } catch {
                setClearedAtByConversation({});
            }
        };
        loadClearedChats();
    }, [currentUser?.empId, clearedStorageKey]);

    useEffect(() => {
        if (!currentUser?.empId) return;
        AsyncStorage.setItem(clearedStorageKey, JSON.stringify(clearedAtByConversation)).catch(console.error);
    }, [clearedAtByConversation, currentUser?.empId, clearedStorageKey]);

    useEffect(() => {
        if (!currentUser?.empId) return;

        fetch(`${API_BASE_URL}/api/socket`)
            .then(() => {
                socket = io(API_BASE_URL, { path: "/api/socket" });
                socket.emit("join-user", currentUser.empId);

                socket.on("receive-message", (incoming: Message) => {
                    if (!incoming) return;

                    const incomingRoomId = String(incoming.roomId || "");
                    const matchesActive = !!activeRoomId && incomingRoomId === activeRoomId;

                    if (matchesActive) {
                        setMessages((prev) => {
                            if (incoming._id && prev.some((msg) => msg._id === incoming._id)) return prev;
                            return [...prev, incoming];
                        });

                        if (incoming.senderId !== currentUser.empId && incoming._id) {
                            markDelivered([incoming._id]);
                            markSeen([incoming._id]);
                        }
                    }

                    setRefreshTick((prev) => prev + 1);
                });

                socket.on("message-status", (payload: any) => {
                    const type = String(payload?.type || "").trim();
                    if (!type) return;

                    if (type === "delivered") {
                        const messageId = String(payload?.messageId || "").trim();
                        const deliveredTo = Array.isArray(payload?.deliveredTo)
                            ? payload.deliveredTo.map((id: any) => String(id || "").trim()).filter(Boolean)
                            : [];
                        if (!messageId) return;
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg._id === messageId
                                    ? {
                                        ...msg,
                                        deliveredTo: Array.from(new Set([...(msg.deliveredTo || []), ...deliveredTo])),
                                    }
                                    : msg
                            )
                        );
                    }

                    if (type === "seen") {
                        const ids = Array.isArray(payload?.messageIds)
                            ? payload.messageIds.map((id: any) => String(id || "").trim()).filter(Boolean)
                            : [];
                        const seenByUserId = String(payload?.seenByUserId || "").trim();
                        if (!seenByUserId || ids.length === 0) return;
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg._id && ids.includes(msg._id)
                                    ? {
                                        ...msg,
                                        seenBy: Array.from(new Set([...(msg.seenBy || []), seenByUserId])),
                                    }
                                    : msg
                            )
                        );
                    }

                    setRefreshTick((prev) => prev + 1);
                });

                socket.on("message-edited", (payload: any) => {
                    const messageId = String(payload?.messageId || "").trim();
                    const content = String(payload?.content || "");
                    const editedAt = String(payload?.editedAt || new Date().toISOString());
                    if (!messageId) return;
                    setMessages((prev) =>
                        prev.map((msg) => (msg._id === messageId ? { ...msg, content, editedAt } : msg))
                    );
                });

                socket.on("message-deleted", (payload: any) => {
                    const messageId = String(payload?.messageId || "").trim();
                    if (!messageId) return;
                    setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
                    setRefreshTick((prev) => prev + 1);
                });
            })
            .catch((error) => {
                console.error("Socket setup failed", error);
            });

        return () => {
            if (socket) {
                socket.disconnect();
                socket = null;
            }
        };
    }, [currentUser?.empId, activeRoomId]);

    useEffect(() => {
        if (!socket || !activeRoomId) return;
        socket.emit("join-room", activeRoomId);
    }, [activeRoomId]);

    useEffect(() => {
        if (!selectedConversation || !currentUser?.empId) {
            setMessages([]);
            return;
        }

        const loadMessages = async () => {
            try {
                const url =
                    selectedConversation.kind === "group"
                        ? `${API_BASE_URL}/api/chat/messages?groupId=${encodeURIComponent(
                            selectedConversation.groupId
                        )}&userId=${encodeURIComponent(currentUser.empId)}&t=${Date.now()}`
                        : `${API_BASE_URL}/api/chat/messages?roomId=${encodeURIComponent(activeRoomId)}&senderId=${encodeURIComponent(
                            currentUser.empId
                        )}&receiverId=${encodeURIComponent(selectedConversation.partnerId)}&t=${Date.now()}`;

                const response = await fetch(url, { cache: "no-store" });
                const data = await response.json();
                const loadedMessages = Array.isArray(data) ? (data as Message[]) : [];
                setMessages(loadedMessages);

                const idsToDeliver = loadedMessages
                    .filter((msg) => msg._id && msg.senderId !== currentUser.empId && !(msg.deliveredTo || []).includes(currentUser.empId))
                    .map((msg) => String(msg._id));

                const idsToSee = loadedMessages
                    .filter((msg) => msg._id && msg.senderId !== currentUser.empId && !(msg.seenBy || []).includes(currentUser.empId))
                    .map((msg) => String(msg._id));

                if (idsToDeliver.length > 0) await markDelivered(idsToDeliver);
                if (idsToSee.length > 0) await markSeen(idsToSee);
            } catch (error) {
                console.error("Failed to load messages", error);
            }
        };

        loadMessages();
    }, [selectedConversation, activeRoomId, currentUser?.empId]);

    const markDelivered = async (messageIds: string[]) => {
        if (!currentUser?.empId || messageIds.length === 0) return;
        try {
            await fetch(`${API_BASE_URL}/api/chat/messages`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "mark-delivered",
                    messageIds,
                    userId: currentUser.empId,
                }),
            });
        } catch {
            // Ignore delivery marking failures.
        }
    };

    const markSeen = async (messageIds: string[]) => {
        if (!currentUser?.empId || messageIds.length === 0) return;
        try {
            await fetch(`${API_BASE_URL}/api/chat/messages`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "mark-seen",
                    messageIds,
                    userId: currentUser.empId,
                }),
            });
            socket?.emit("message-seen", {
                messageIds,
                userId: currentUser.empId,
                roomId: activeRoomId,
            });
            setRefreshTick((prev) => prev + 1);
        } catch {
            // Ignore seen marking failures.
        }
    };

    const handleSelectConversation = (conversation: Conversation) => {
        setSelectedKey(getConversationKey(conversation));
        setIsProfilePopupOpen(false);
        setIsGroupPanelOpen(false);
        setSelectedGroupMemberProfile(null);
    };

    const handleSelectFiles = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                multiple: true,
                type: "*/*",
            });
            if (!result.canceled && result.assets) {
                setPendingFiles((prev) => [...prev, ...result.assets]);
            }
        } catch (error) {
            console.error("Error picking documents:", error);
        }
    };

    const removePendingFile = (index: number) => {
        setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const sendMessage = async () => {
        if ((!text.trim() && pendingFiles.length === 0) || !currentUser?.empId || !selectedConversation) return;

        setIsSending(true);
        try {
            const roomId =
                selectedConversation.kind === "group"
                    ? `group_${selectedConversation.groupId.toLowerCase()}`
                    : makeRoomId(currentUser.empId, selectedConversation.partnerId);

            const content = text.trim();

            // Simulating attachment upload for demonstration (would normally upload to S3/Server here)
            const uploadedAttachments = pendingFiles.map(f => ({
                fileName: f.name,
                url: f.uri,
                size: f.size,
                fileType: f.mimeType || "application/octet-stream"
            }));

            const messagePayload = {
                roomId,
                chatType: selectedConversation.kind,
                groupId: selectedConversation.kind === "group" ? selectedConversation.groupId : undefined,
                senderId: currentUser.empId,
                senderName: currentUser.name,
                receiverId: selectedConversation.kind === "group" ? undefined : selectedConversation.partnerId,
                content,
                attachments: uploadedAttachments,
            };

            const persistRes = await fetch(`${API_BASE_URL}/api/chat/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(messagePayload),
            });

            const persistData = await persistRes.json();
            if (!persistRes.ok || !persistData?.success || !persistData?.message) {
                throw new Error(persistData?.error || "Failed to persist message");
            }

            const savedMessage: Message = persistData.message;
            socket?.emit("send-message", {
                ...savedMessage,
                roomId,
                recipientIds:
                    selectedConversation.kind === "group"
                        ? selectedConversation.memberIds.filter((id) => id !== currentUser.empId)
                        : [selectedConversation.partnerId],
            });

            setText("");
            setPendingFiles([]);
            setRefreshTick((prev) => prev + 1);
        } catch (error) {
            console.error("Sending failed", error);
        } finally {
            setIsSending(false);
        }
    };

    const mediaItems = useMemo(() => {
        if (!selectedConversation) return [];
        return messages
            .filter(
                (m) =>
                    (m.roomId === activeRoomId || (selectedConversation.kind === "group" && m.groupId === selectedConversation.groupId)) &&
                    Array.isArray(m.attachments) &&
                    m.attachments.length > 0
            )
            .flatMap((m) =>
                (m.attachments || []).map((att, idx) => ({
                    messageId: m._id,
                    attachment: att,
                    key: `${m._id}-${idx}`,
                }))
            )
            .filter((item) => {
                const url = (item.attachment.url || "").toLowerCase();
                return (
                    url.endsWith(".jpg") ||
                    url.endsWith(".jpeg") ||
                    url.endsWith(".png") ||
                    url.endsWith(".gif") ||
                    url.endsWith(".webp")
                );
            });
    }, [messages, selectedConversation, activeRoomId]);

    const handleCopy = async (text: string, label: string = "Text") => {
        if (!text || text === "-") return;
        try {
            await Clipboard.setStringAsync(text);
            if (Platform.OS === "android") {
                ToastAndroid.show(`${label} copied to clipboard!`, ToastAndroid.SHORT);
            }
        } catch (error) {
            console.error("Failed to copy", error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <View style={styles.chatContainer}>
                    {!selectedConversation ? (
                        <View style={styles.sidebar}>
                            <View style={styles.header}>
                                <View style={styles.headerLeft}>
                                    <Image source={require("../../assets/logo-hd.png")} style={styles.logo} resizeMode="contain" />
                                    <Text style={styles.headerTitle}>Chats</Text>
                                </View>
                                <TouchableOpacity onPress={() => setIsCreateGroupOpen(true)} style={styles.createGroupBtn}>
                                    <Plus size={16} color="#334155" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.searchContainer}>
                                <Search size={16} color="#94a3b8" style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search employees..."
                                    value={searchTerm}
                                    onChangeText={setSearchTerm}
                                />
                            </View>
                            <FlatList
                                data={sortedConversationList}
                                keyExtractor={(item) => getConversationKey(item)}
                                style={styles.conversationList}
                                renderItem={({ item: conversation }) => {
                                    const key = getConversationKey(conversation);
                                    const isActive = selectedKey === key;
                                    const unreadCount = Number(conversation.unreadCount || 0);

                                    const label =
                                        conversation.kind === "group"
                                            ? conversation.groupName
                                            : employeeById[conversation.partnerId]?.displayName ||
                                            employeeById[conversation.partnerId]?.name ||
                                            conversation.partnerId;

                                    return (
                                        <TouchableOpacity
                                            onPress={() => handleSelectConversation(conversation)}
                                            style={[styles.conversationItem, isActive && styles.conversationItemActive]}
                                        >
                                            <View style={styles.conversationAvatar}>
                                                <Text style={styles.conversationAvatarText}>
                                                    {conversation.kind === "group" ? "G" : label.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={styles.conversationInfo}>
                                                <View style={styles.conversationHeader}>
                                                    <Text style={styles.conversationName} numberOfLines={1}>{label}</Text>
                                                    {unreadCount > 0 && (
                                                        <View style={styles.unreadBadge}>
                                                            <Text style={styles.unreadText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.conversationPreview} numberOfLines={1}>
                                                    {conversation.lastMessage?.content || "Message"}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    ) : (
                        <View style={styles.mainChat}>
                            <View style={styles.chatHeader}>
                                <TouchableOpacity onPress={() => setSelectedKey("")} style={styles.backButton}>
                                    <ChevronLeft size={24} color="#0f172a" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setIsProfilePopupOpen(prev => !prev)}
                                    style={styles.chatHeaderInfo}
                                >
                                    <Text style={styles.headerTitle}>
                                        {selectedConversation.kind === "group"
                                            ? selectedConversation.groupName
                                            : employeeById[selectedConversation.partnerId]?.displayName || selectedEmployee?.name || selectedConversation.partnerId}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <FlatList
                                data={visibleMessages}
                                inverted={false}
                                keyExtractor={(item, index) => item._id || `${item.senderId}-${index}`}
                                style={styles.messagesList}
                                contentContainerStyle={{ padding: 16, gap: 12 }}
                                renderItem={({ item: message }) => {
                                    const isMyMessage = normalizeId(message.senderId) === normalizeId(currentUser?.empId);

                                    return (
                                        <View style={[styles.messageWrapper, isMyMessage ? styles.messageWrapperRight : styles.messageWrapperLeft]}>
                                            <View style={[styles.messageBubble, isMyMessage ? styles.messageBubbleRight : styles.messageBubbleLeft]}>
                                                {!isMyMessage && (
                                                    <Text style={styles.senderName}>{message.senderName}</Text>
                                                )}
                                                <Text style={[styles.messageContent, isMyMessage && { color: "#064e3b" }]}>{message.content}</Text>
                                            </View>
                                        </View>
                                    );
                                }}
                            />

                            {pendingFiles.length > 0 && (
                                <View style={styles.pendingFilesContainer}>
                                    <FlatList
                                        data={pendingFiles}
                                        horizontal
                                        keyExtractor={(_, index) => `pending-${index}`}
                                        renderItem={({ item, index }) => (
                                            <View style={styles.pendingFileBadge}>
                                                <Text style={styles.pendingFileText} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                <TouchableOpacity onPress={() => removePendingFile(index)}>
                                                    <X size={14} color="#dc2626" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
                                    />
                                </View>
                            )}

                            <View style={styles.inputContainer}>
                                <TouchableOpacity style={styles.attachButton} onPress={handleSelectFiles} disabled={isSending}>
                                    <Paperclip size={20} color="#64748b" />
                                </TouchableOpacity>
                                <TextInput
                                    style={styles.messageInput}
                                    placeholder="Type a message..."
                                    value={text}
                                    onChangeText={setText}
                                    multiline
                                />
                                <TouchableOpacity
                                    style={[styles.sendButton, (!text.trim() && pendingFiles.length === 0 || isSending) && styles.sendButtonDisabled]}
                                    onPress={sendMessage}
                                    disabled={(!text.trim() && pendingFiles.length === 0) || isSending}
                                >
                                    <Text style={styles.sendButtonText}>{isSending ? "..." : "Send"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Profile Modal */}
                <Modal transparent visible={isProfilePopupOpen} animationType="slide">
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Profile Info</Text>
                                <TouchableOpacity onPress={() => setIsProfilePopupOpen(false)}>
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            {selectedEmployee && (
                                <ScrollView style={styles.modalScroll}>
                                    <View style={styles.profileHeader}>
                                        {selectedEmployee.photo ? (
                                            <Image source={{ uri: selectedEmployee.photo }} style={styles.profileAvatar} />
                                        ) : (
                                            <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
                                                <Text style={styles.profileAvatarText}>
                                                    {(selectedEmployee.displayName || selectedEmployee.name || "U").charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={styles.profileName}>{selectedEmployee.displayName || selectedEmployee.name}</Text>
                                        <Text style={styles.profileDept}>{selectedEmployee.department || "No Department"}</Text>
                                    </View>

                                    <View style={styles.profileSection}>
                                        <View style={styles.profileRow}>
                                            <Text style={styles.profileLabel}>Name</Text>
                                            <View style={styles.profileValueRow}>
                                                <Text style={styles.profileValue}>{selectedEmployee.displayName || selectedEmployee.name || "-"}</Text>
                                                <TouchableOpacity
                                                    onPress={() => handleCopy(selectedEmployee.displayName || selectedEmployee.name || "-", "Name")}
                                                    style={styles.copyButton}
                                                >
                                                    <Copy size={16} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <View style={styles.profileRow}>
                                            <Text style={styles.profileLabel}>Email</Text>
                                            <View style={styles.profileValueRow}>
                                                <Text style={styles.profileValue}>{selectedEmployee.mailId || selectedEmployee.email || "-"}</Text>
                                                <TouchableOpacity
                                                    onPress={() => handleCopy(selectedEmployee.mailId || selectedEmployee.email || "-", "Email")}
                                                    style={styles.copyButton}
                                                >
                                                    <Copy size={16} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <View style={styles.profileRow}>
                                            <Text style={styles.profileLabel}>Phone</Text>
                                            <View style={styles.profileValueRow}>
                                                <Text style={styles.profileValue}>{selectedEmployee.phoneNumber || "-"}</Text>
                                                <TouchableOpacity
                                                    onPress={() => handleCopy(selectedEmployee.phoneNumber || "-", "Phone")}
                                                    style={styles.copyButton}
                                                >
                                                    <Copy size={16} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.profileSection}>
                                        <Text style={styles.profileSectionTitle}>Media</Text>
                                        {mediaItems.length > 0 ? (
                                            <View style={styles.mediaGrid}>
                                                {mediaItems.slice(0, 9).map((item) => (
                                                    <TouchableOpacity
                                                        key={item.key}
                                                        onPress={() => Linking.openURL(item.attachment.url)}
                                                        style={styles.mediaItem}
                                                    >
                                                        <Image source={{ uri: item.attachment.url }} style={styles.mediaImage} />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        ) : (
                                            <Text style={styles.profileEmptyText}>No shared media.</Text>
                                        )}
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>
                {!selectedKey && (
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.footerButton}>
                            <MessageSquare size={22} color="#059669" />
                            <Text style={[styles.footerLabel, { color: '#059669', fontWeight: 'bold' }]}>Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/attendance')}>
                            <Fingerprint size={22} color="#64748b" />
                            <Text style={styles.footerLabel}>Mark Attendance</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/leave')}>
                            <CalendarDays size={22} color="#64748b" />
                            <Text style={styles.footerLabel}>Leaves</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/att-history')}>
                            <HistoryIcon size={22} color="#64748b" />
                            <Text style={styles.footerLabel}>History</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/holidays')}>
                            <PartyPopper size={22} color="#64748b" />
                            <Text style={styles.footerLabel}>Holidays</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    footer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingVertical: 12,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    footerButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8
    },
    footerLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        textAlign: 'center'
    },
    container: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    chatContainer: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    sidebar: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    mainChat: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyStateText: {
        color: "#64748b",
        fontSize: 16,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        paddingTop: Platform.OS === 'android' ? 40 : 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    logo: {
        width: 80,
        height: 24,
    },
    chatHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        paddingTop: Platform.OS === 'android' ? 40 : 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
        backgroundColor: "#ffffff",
        gap: 12,
    },
    chatHeaderInfo: {
        flex: 1,
        justifyContent: "center",
    },
    backButton: {
        marginRight: 4,
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#0f172a",
    },
    createGroupBtn: {
        padding: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#cbd5e1",
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        position: "relative",
    },
    searchIcon: {
        position: "absolute",
        left: 28,
        top: 22,
        zIndex: 1,
    },
    searchInput: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 8,
        paddingLeft: 36,
        paddingRight: 12,
        paddingVertical: 8,
        fontSize: 14,
        color: "#0f172a",
    },
    conversationList: {
        flex: 1,
    },
    conversationItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
    },
    conversationItemActive: {
        backgroundColor: "#f0fdf4",
    },
    conversationAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#e2e8f0",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    conversationAvatarText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#475569",
    },
    conversationInfo: {
        flex: 1,
    },
    conversationHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 2,
    },
    conversationName: {
        fontSize: 14,
        fontWeight: "500",
        color: "#0f172a",
        flex: 1,
    },
    unreadBadge: {
        backgroundColor: "#ef4444",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
    },
    unreadText: {
        color: "#ffffff",
        fontSize: 10,
        fontWeight: "bold",
    },
    conversationPreview: {
        fontSize: 12,
        color: "#64748b",
    },
    messagesList: {
        flex: 1,
    },
    messageWrapper: {
        flexDirection: "row",
        width: "100%",
    },
    messageWrapperLeft: {
        justifyContent: "flex-start",
    },
    messageWrapperRight: {
        justifyContent: "flex-end",
    },
    messageBubble: {
        maxWidth: "80%",
        borderRadius: 12,
        padding: 12,
    },
    messageBubbleLeft: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    messageBubbleRight: {
        backgroundColor: "#d1fae5",
    },
    senderName: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748b",
        marginBottom: 4,
    },
    messageContent: {
        fontSize: 14,
        color: "#0f172a",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 12,
        backgroundColor: "#ffffff",
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
    },
    attachButton: {
        padding: 10,
        marginRight: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    pendingFilesContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: "#f8fafc",
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
    },
    pendingFileBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#e2e8f0",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        maxWidth: 200,
    },
    pendingFileText: {
        fontSize: 12,
        color: "#334155",
        marginRight: 6,
        flexShrink: 1,
    },
    messageInput: {
        flex: 1,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        maxHeight: 100,
        minHeight: 40,
        fontSize: 14,
        color: "#0f172a",
    },
    copyButton: {
        marginLeft: 8,
        padding: 4,
    },
    sendButton: {
        backgroundColor: "#059669",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginLeft: 12,
        justifyContent: "center",
    },
    sendButtonDisabled: {
        opacity: 0.6,
    },
    sendButtonText: {
        color: "#ffffff",
        fontWeight: "600",
        fontSize: 14,
    },

    // Modal Styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#ffffff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: "80%",
        padding: 20,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#0f172a",
    },
    modalScroll: {
        // padding bottom added if necessary
    },
    profileHeader: {
        alignItems: "center",
        marginBottom: 20,
    },
    profileAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 12,
        backgroundColor: "#e2e8f0",
    },
    profileAvatarFallback: {
        alignItems: "center",
        justifyContent: "center",
    },
    profileAvatarText: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#475569",
    },
    profileName: {
        fontSize: 18,
        fontWeight: "600",
        color: "#0f172a",
    },
    profileDept: {
        fontSize: 14,
        color: "#64748b",
        marginTop: 4,
    },
    profileSection: {
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
        paddingVertical: 16,
    },
    profileRow: {
        marginBottom: 12,
    },
    profileLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748b",
        marginBottom: 4,
    },
    profileValueRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    profileValue: {
        fontSize: 14,
        color: "#0f172a",
    },
    profileSectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748b",
        marginBottom: 12,
    },
    mediaGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    mediaItem: {
        width: "31%",
        aspectRatio: 1,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#f1f5f9",
    },
    mediaImage: {
        width: "100%",
        height: "100%",
    },
    profileEmptyText: {
        fontSize: 12,
        color: "#64748b",
    },
});
