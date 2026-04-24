import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import {
    CalendarDays,
    ChevronLeft,
    Copy,
    Fingerprint,
    Forward,
    History as HistoryIcon,
    Link as LinkIcon,
    MessageSquare,
    Paperclip,
    PartyPopper,
    Phone,
    Pin,
    PinOff,
    Plus,
    Search,
    Shield,
    Trash2,
    Users,
    Video,
    X,
    Check,
    CheckCheck,
    Clock,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
    isOnline?: boolean;
    lastSeen?: string | Date | null;
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
    reactions?: { emoji: string; userIds: string[] }[];
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
type ChatSidebarFilter = "all" | "unread" | "read" | "groups" | "direct" | "pinned";

interface LinkPreview {
    url: string;
    senderName: string;
    createdAt?: string;
}

const CHAT_FILTER_TABS: { id: ChatSidebarFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "read", label: "Read" },
    { id: "groups", label: "Groups" },
    { id: "direct", label: "Direct" },
    { id: "pinned", label: "Pinned" },
];

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

const formatTime = (value?: string | Date) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const normalizeId = (value?: string) => String(value || "").trim().toLowerCase();

const showToast = (message: string) => {
    if (Platform.OS === "android") {
        ToastAndroid.show(message, ToastAndroid.SHORT);
        return;
    }
    Alert.alert("Chat", message);
};

export default function ChatContent() {
    const router = useRouter();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedKey, setSelectedKey] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sidebarFilter, setSidebarFilter] = useState<ChatSidebarFilter>("all");
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
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [mentionResults, setMentionResults] = useState<Employee[]>([]);
    const [mentionLoading, setMentionLoading] = useState(false);
    const [mentionError, setMentionError] = useState("");
    const [clearedAtByConversation, setClearedAtByConversation] = useState<Record<string, number>>({});
    const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, string[]>>({});
    const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
    const [forwardSearch, setForwardSearch] = useState("");
    const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
    const [profileTab, setProfileTab] = useState<"media" | "links" | "docs">("media");
    const [pinnedKeys, setPinnedKeys] = useState<string[]>([]);
    const [deletedKeys, setDeletedKeys] = useState<string[]>([]);
    const [contextMenu, setContextMenu] = useState<{ key: string, label: string, isPinned: boolean } | null>(null);
    const onlineUserIdsRef = React.useRef<Set<string>>(new Set());
    const messageInputRef = React.useRef<TextInput | null>(null);
    const mentionTriggerRef = React.useRef<{ index: number; query: string } | null>(null);

    useEffect(() => {
        if (!showMentions) return;

        if (!mentionSearch && employees.length > 0) {
            setMentionResults(employees);
            setMentionError("");
            return;
        }

        let active = true;
        const controller = new AbortController();
        const timeoutId = setTimeout(async () => {
            setMentionLoading(true);
            setMentionError("");
            try {
                const params = new URLSearchParams();
                if (mentionSearch) params.set("search", mentionSearch);
                params.set("limit", "20");

                const response = await fetch(`${API_BASE_URL}/api/employees?${params.toString()}`, {
                    cache: "no-store",
                    signal: controller.signal,
                    headers: { "Content-Type": "application/json" },
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || "Failed to fetch employees");
                }

                const data = await response.json();
                const list = Array.isArray(data?.employees) ? data.employees : [];
                if (active) setMentionResults(list);
            } catch (error: any) {
                if (controller.signal.aborted) return;
                if (active) {
                    setMentionError(error?.message || "Failed to load mentions");
                    setMentionResults([]);
                }
            } finally {
                if (active) setMentionLoading(false);
            }
        }, 200);

        return () => {
            active = false;
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [showMentions, mentionSearch, employees]);

    const employeeById = useMemo(() => {
        const map: Record<string, Employee> = {};
        employees.forEach((employee) => {
            const id = normalizeId(employee.empId);
            if (id) map[id] = employee;
        });
        return map;
    }, [employees]);

    const clearedStorageKey = useMemo(
        () => `chatClearedAt:${currentUser?.empId || "guest"}`,
        [currentUser?.empId]
    );

    const applyOnlineStatus = React.useCallback((list: Employee[]) => {
        const onlineSet = onlineUserIdsRef.current;
        return list.map((emp) => {
            const isOnline = onlineSet.has(normalizeId(emp.empId));
            return {
                ...emp,
                isOnline,
                lastSeen: isOnline ? null : emp.lastSeen ?? null,
            };
        });
    }, []);

    const sortedConversationList = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const knownDirectIds = new Set<string>();
        const list: Conversation[] = [...conversations];

        conversations.forEach((conversation) => {
            if (conversation.kind === "direct") {
                knownDirectIds.add(normalizeId(conversation.partnerId));
            }
        });

        if (query) {
            employees.forEach((employee) => {
                const empId = String(employee.empId || "").trim();
                const normalizedEmpId = normalizeId(empId);
                if (!empId || knownDirectIds.has(normalizedEmpId)) return;
                list.push({
                    kind: "direct",
                    id: empId,
                    partnerId: empId,
                    unreadCount: 0,
                });
            });
        }

        const filtered = list.filter((conversation) => {
            const key = getConversationKey(conversation);
            if (deletedKeys.includes(key)) return false;
            if (!query) return true;
            if (conversation.kind === "group") {
                return conversation.groupName.toLowerCase().includes(query);
            }
            const employee = employeeById[normalizeId(conversation.partnerId)];
            const label = String(employee?.displayName || employee?.name || conversation.partnerId).toLowerCase();
            return label.includes(query);
        });

        return filtered.sort((a, b) => {
            const aPinned = pinnedKeys.includes(getConversationKey(a));
            const bPinned = pinnedKeys.includes(getConversationKey(b));
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bt - at;
        });
    }, [conversations, deletedKeys, employees, employeeById, pinnedKeys, searchTerm]);

    const filteredConversationList = useMemo(() => {
        return sortedConversationList.filter((conversation) => {
            const unreadCount = Number(conversation.unreadCount || 0);
            const key = getConversationKey(conversation);

            switch (sidebarFilter) {
                case "unread":
                    return unreadCount > 0;
                case "read":
                    return unreadCount === 0;
                case "groups":
                    return conversation.kind === "group";
                case "direct":
                    return conversation.kind === "direct";
                case "pinned":
                    return pinnedKeys.includes(key);
                case "all":
                default:
                    return true;
            }
        });
    }, [pinnedKeys, sidebarFilter, sortedConversationList]);

    const sidebarFilterCounts = useMemo(() => {
        const counts: Record<ChatSidebarFilter, number> = {
            all: sortedConversationList.length,
            unread: 0,
            read: 0,
            groups: 0,
            direct: 0,
            pinned: 0,
        };

        sortedConversationList.forEach((conversation) => {
            const unreadCount = Number(conversation.unreadCount || 0);
            if (unreadCount > 0) counts.unread += 1;
            else counts.read += 1;
            if (conversation.kind === "group") counts.groups += 1;
            if (conversation.kind === "direct") counts.direct += 1;
            if (pinnedKeys.includes(getConversationKey(conversation))) counts.pinned += 1;
        });

        return counts;
    }, [pinnedKeys, sortedConversationList]);

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
        return employeeById[normalizeId(selectedConversation.partnerId)] || null;
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
                employee: employeeById[normalizeId(id)] || null,
                isAdmin: (selectedGroup.adminIds || []).includes(id),
            }))
            .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin));
    }, [selectedGroup, employeeById]);

    const addableEmployees = useMemo(() => {
        if (!selectedGroup) return [];
        const memberSet = new Set((selectedGroup.memberIds || []).map((id) => normalizeId(id)));
        return employees.filter((employee) => {
            const empId = normalizeId(employee.empId);
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

    const reversedMessages = useMemo(() => [...visibleMessages].reverse(), [visibleMessages]);

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
                setEmployees(applyOnlineStatus(list.filter((employee) => normalizeId(employee.empId) !== currentUser.empId)));
            } catch (error) {
                console.error("Failed to fetch employees", error);
            }
        };

        loadEmployees();
    }, [currentUser?.empId, applyOnlineStatus]);

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

        const loadConversationPrefs = async () => {
            try {
                const [pinnedRaw, deletedRaw] = await Promise.all([
                    AsyncStorage.getItem(`chat:pinned:${currentUser.empId}`),
                    AsyncStorage.getItem(`chat:deleted:${currentUser.empId}`),
                ]);

                setPinnedKeys(pinnedRaw ? JSON.parse(pinnedRaw) : []);
                setDeletedKeys(deletedRaw ? JSON.parse(deletedRaw) : []);
            } catch (error) {
                console.error("Failed to load chat preferences", error);
                setPinnedKeys([]);
                setDeletedKeys([]);
            }
        };

        loadConversationPrefs();
    }, [currentUser?.empId]);

    useEffect(() => {
        if (!currentUser?.empId) return;
        AsyncStorage.setItem(`chat:pinned:${currentUser.empId}`, JSON.stringify(pinnedKeys)).catch(console.error);
    }, [currentUser?.empId, pinnedKeys]);

    useEffect(() => {
        if (!currentUser?.empId) return;
        AsyncStorage.setItem(`chat:deleted:${currentUser.empId}`, JSON.stringify(deletedKeys)).catch(console.error);
    }, [currentUser?.empId, deletedKeys]);

    useEffect(() => {
        if (!currentUser?.empId) return;

        fetch(`${API_BASE_URL}/api/socket`)
            .then(() => {
                socket = io(API_BASE_URL, { path: "/api/socket" });
                socket.emit("join-user", currentUser.empId);

                socket.on("online-users", (onlineIds: string[]) => {
                    const onlineSet = new Set((onlineIds || []).map((id) => normalizeId(id)));
                    onlineUserIdsRef.current = onlineSet;
                    setEmployees((prev) => applyOnlineStatus(prev));
                });

                socket.on("user-status", (payload: any) => {
                    const userId = normalizeId(payload?.userId);
                    if (!userId) return;
                    if (payload?.isOnline) {
                        onlineUserIdsRef.current = new Set([...onlineUserIdsRef.current, userId]);
                    } else {
                        const next = new Set(onlineUserIdsRef.current);
                        next.delete(userId);
                        onlineUserIdsRef.current = next;
                    }
                    setEmployees((prev) =>
                        prev.map((emp) =>
                            normalizeId(emp.empId) === userId
                                ? { ...emp, isOnline: !!payload?.isOnline, lastSeen: payload?.lastSeen || emp.lastSeen }
                                : emp
                        )
                    );
                });

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

                socket.on("message-reaction", (payload: any) => {
                    const messageId = String(payload?.messageId || "").trim();
                    const reactions = Array.isArray(payload?.reactions) ? payload.reactions : [];
                    if (!messageId) return;
                    setReactionsByMessage((prev) => {
                        const emojis = reactions.map((r: any) => String(r?.emoji || "")).filter(Boolean);
                        return { ...prev, [messageId]: emojis };
                    });
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
        }
    };

    const togglePin = (key: string) => {
        setPinnedKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [key, ...prev]));
    };

    const clearConversationByKey = (key: string) => {
        Alert.alert("Clear chat?", "This only clears the chat history on this device.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Clear",
                style: "destructive",
                onPress: () => {
                    setClearedAtByConversation((prev) => ({ ...prev, [key]: Date.now() }));
                    showToast("Chat cleared");
                },
            },
        ]);
    };

    const clearCurrentChat = () => {
        if (!selectedConversation) return;
        clearConversationByKey(getConversationKey(selectedConversation));
    };

    const deleteConversation = (key: string) => {
        Alert.alert("Hide this chat?", "This removes it from your sidebar until a new message arrives.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Hide",
                style: "destructive",
                onPress: () => {
                    setDeletedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
                    if (selectedKey === key) {
                        setSelectedKey("");
                    }
                },
            },
        ]);
    };

    const handleCreateGroup = async () => {
        if (!currentUser?.empId) return;
        if (!newGroupName.trim()) {
            showToast("Enter a group name");
            return;
        }
        if (newGroupMemberIds.length < 1) {
            showToast("Select at least one member");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/groups`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newGroupName.trim(),
                    createdBy: currentUser.empId,
                    memberIds: newGroupMemberIds,
                    adminOnlyMessaging: newGroupAdminOnlyMessaging,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data?.success || !data?.group) {
                throw new Error(data?.error || "Failed to create group");
            }

            setIsCreateGroupOpen(false);
            setNewGroupName("");
            setNewGroupMemberIds([]);
            setNewGroupAdminOnlyMessaging(false);
            setRefreshTick((prev) => prev + 1);
            setSelectedKey(`group:${String(data.group._id)}`);
            showToast("Group created");
        } catch (error: any) {
            console.error("Group creation failed", error);
            showToast(error?.message || "Failed to create group");
        }
    };

    const runGroupAction = async (payload: Record<string, any>) => {
        if (!selectedGroup || !currentUser?.empId) return;

        try {
            setGroupActionBusy(true);
            const response = await fetch(`${API_BASE_URL}/api/chat/groups`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...payload,
                    groupId: selectedGroup.groupId,
                    requesterId: currentUser.empId,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data?.success || !data?.group) {
                throw new Error(data?.error || "Failed to update group");
            }

            const updatedGroup = data.group;
            setConversations((prev) =>
                prev.map((conversation) =>
                    conversation.kind === "group" && conversation.groupId === selectedGroup.groupId
                        ? {
                              ...conversation,
                              groupName: String(updatedGroup.name || conversation.groupName),
                              groupPhoto: String(updatedGroup.photo || conversation.groupPhoto || ""),
                              memberIds: Array.isArray(updatedGroup.memberIds) ? updatedGroup.memberIds : conversation.memberIds,
                              adminIds: Array.isArray(updatedGroup.adminIds) ? updatedGroup.adminIds : conversation.adminIds,
                              adminOnlyMessaging: Boolean(updatedGroup?.settings?.adminOnlyMessaging),
                          }
                        : conversation
                )
            );
            setRefreshTick((prev) => prev + 1);
        } catch (error: any) {
            console.error("Group action failed", error);
            showToast(error?.message || "Failed to update group");
        } finally {
            setGroupActionBusy(false);
        }
    };

    const handleSelectConversation = (conversation: Conversation) => {
        setSelectedKey(getConversationKey(conversation));
        setIsProfilePopupOpen(false);
        setIsGroupPanelOpen(false);
        setSelectedGroupMemberProfile(null);
        setProfileTab("media");
    };

    const handleChatTextChange = (value: string) => {
        setText(value);

        const textBeforeCursor = value; 
        const mentionMatch = /(^|\s)@([^\s@]*)$/.exec(textBeforeCursor);

        if (mentionMatch) {
            const lastAtIndex = textBeforeCursor.lastIndexOf("@");
            const query = mentionMatch[2] || "";
            setMentionSearch(query);
            setShowMentions(true);
            mentionTriggerRef.current = { index: lastAtIndex, query };
        } else {
            setShowMentions(false);
            setMentionSearch("");
        }
    };

    const handleMentionSelect = (employee: Employee) => {
        if (!mentionTriggerRef.current) return;

        const { index } = mentionTriggerRef.current;
        const beforeMention = text.substring(0, index);
        const afterMention = text.substring(index + mentionSearch.length + 1);
        const mention = `@${employee.name} `;
        const newText = beforeMention + mention + afterMention;

        setText(newText);
        setShowMentions(false);
        setMentionSearch("");
    };

    const handleEditMessage = (message: Message) => {
        if (!message._id) return;
        setEditingMessageId(message._id);
        setEditingText(String(message.content || ""));
    };

    const saveEditedMessage = async () => {
        if (!editingMessageId || !currentUser?.empId) return;
        if (!editingText.trim()) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/messages`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "edit",
                    messageId: editingMessageId,
                    userId: currentUser.empId,
                    content: editingText.trim(),
                }),
            });
            const data = await response.json();
            if (!response.ok || !data?.success || !data?.message) {
                throw new Error(data?.error || "Failed to edit message");
            }

            const updatedMessage: Message = data.message;
            setMessages((prev) =>
                prev.map((msg) => (msg._id === editingMessageId ? { ...msg, ...updatedMessage } : msg))
            );

            socket?.emit("message-edited", {
                messageId: editingMessageId,
                content: updatedMessage.content,
                editedAt: updatedMessage.editedAt || new Date().toISOString(),
            });

            setEditingMessageId("");
            setEditingText("");
            showToast("Message updated");
        } catch (error: any) {
            console.error("Edit failed", error);
            showToast(error?.message || "Failed to edit message");
        }
    };

    const deleteMessage = async (messageId: string) => {
        if (!currentUser?.empId) return;
        
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/chat/messages?messageId=${encodeURIComponent(messageId)}&userId=${encodeURIComponent(currentUser.empId)}`,
                { method: "DELETE" }
            );
            const data = await response.json();
            if (!response.ok || !data?.success) {
                throw new Error(data?.error || "Failed to delete message");
            }

            setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
            socket?.emit("message-deleted", { messageId, roomId: activeRoomId });
            setRefreshTick((prev) => prev + 1);
            showToast("Message deleted");
        } catch (error: any) {
            console.error("Delete failed", error);
            showToast(error?.message || "Failed to delete message");
        }
    };

    const toggleReaction = (messageId: string, emoji: string) => {
        if (!currentUser?.empId) return;
        setReactionsByMessage((prev) => {
            const existing = prev[messageId] || [];
            const next = existing.includes(emoji)
                ? existing.filter((item) => item !== emoji)
                : [...existing, emoji];
            return { ...prev, [messageId]: next };
        });
        socket?.emit("message-reaction", {
            messageId,
            emoji,
            userId: currentUser.empId,
        });
    };

    const handleForwardMessage = (message: Message) => {
        setForwardMessage(message);
        setForwardSearch("");
        setIsForwardModalOpen(true);
    };

    const forwardToEmployee = async (targetEmployee: Employee) => {
        if (!currentUser?.empId || !targetEmployee?.empId || !forwardMessage) return;
        if (normalizeId(targetEmployee.empId) === normalizeId(currentUser.empId)) {
            showToast("Cannot forward to yourself");
            return;
        }

        try {
            const roomId = makeRoomId(currentUser.empId, targetEmployee.empId);
            const content = String(forwardMessage.content || "").trim()
                ? `Forwarded: ${String(forwardMessage.content || "").trim()}`
                : "Forwarded message";

            const persistRes = await fetch(`${API_BASE_URL}/api/chat/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roomId,
                    chatType: "direct",
                    senderId: currentUser.empId,
                    senderName: currentUser.name,
                    receiverId: targetEmployee.empId,
                    content,
                    attachments: Array.isArray(forwardMessage.attachments) ? forwardMessage.attachments : [],
                    replyTo: {
                        messageId: forwardMessage._id || "",
                        senderName: forwardMessage.senderName || "",
                        content: forwardMessage.content || "",
                    },
                }),
            });
            const persistData = await persistRes.json();
            if (!persistRes.ok || !persistData?.success || !persistData?.message) {
                throw new Error(persistData?.error || "Failed to forward message");
            }

            const savedMessage: Message = persistData.message;
            socket?.emit("send-message", {
                ...savedMessage,
                roomId,
                recipientIds: [targetEmployee.empId],
            });
            setIsForwardModalOpen(false);
            setForwardMessage(null);
            setRefreshTick((prev) => prev + 1);
            showToast(`Forwarded to ${targetEmployee.displayName || targetEmployee.name}`);
        } catch (error: any) {
            console.error("Forward failed", error);
            showToast(error?.message || "Failed to forward message");
        }
    };

    const startDirectChat = (partnerId: string) => {
        const normalizedPartner = String(partnerId || "").trim();
        if (!normalizedPartner) return;

        const existing = conversations.find(
            (conversation) =>
                conversation.kind === "direct" && normalizeId(conversation.partnerId) === normalizeId(normalizedPartner)
        );

        if (existing) {
            handleSelectConversation(existing);
            return;
        }

        const draftConversation: DirectConversation = {
            kind: "direct",
            id: normalizedPartner,
            partnerId: normalizedPartner,
            unreadCount: 0,
        };

        setConversations((prev) => [draftConversation, ...prev]);
        handleSelectConversation(draftConversation);
    };

    const startCall = async (mode: "audio" | "video") => {
        if (!selectedConversation || !currentUser?.empId) return;
        
        const participantIds =
            selectedConversation.kind === "group"
                ? selectedConversation.memberIds
                : [currentUser.empId, selectedConversation.partnerId];
        const conversationId =
            selectedConversation.kind === "group" ? selectedConversation.groupId : selectedConversation.partnerId;

        try {
            const response = await fetch(`${API_BASE_URL}/api/calls`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    createdBy: currentUser.empId,
                    participantIds,
                    mode,
                    conversationType: selectedConversation.kind,
                    conversationId,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data?.success || !data?.url) {
                throw new Error(data?.error || "Failed to create call");
            }

            const callUrl = `${API_BASE_URL}${data.url}`;
            Linking.openURL(callUrl);
        } catch (error: any) {
            console.error("Call failed", error);
        }
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

    const uploadAttachments = async (roomId: string) => {
        if (pendingFiles.length === 0) return [];

        const formData = new FormData();
        formData.append("roomId", roomId);

        pendingFiles.forEach((file, index) => {
            formData.append("attachments", {
                uri: file.uri,
                name: file.name || `attachment-${index}`,
                type: file.mimeType || "application/octet-stream",
            } as any);
        });

        const response = await fetch(`${API_BASE_URL}/api/chat/attachments`, {
            method: "POST",
            body: formData,
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || "Attachment upload failed");
        }

        return Array.isArray(data.attachments) ? data.attachments : [];
    };

    const sendMessage = async () => {
        if ((!text.trim() && pendingFiles.length === 0) || !currentUser?.empId || !selectedConversation) return;
        if (
            selectedConversation.kind === "group" &&
            selectedConversation.adminOnlyMessaging &&
            !(selectedConversation.adminIds || []).includes(currentUser.empId)
        ) {
            showToast("Only admins can send messages here");
            return;
        }

        setIsSending(true);
        try {
            const roomId =
                selectedConversation.kind === "group"
                    ? `group_${selectedConversation.groupId.toLowerCase()}`
                    : makeRoomId(currentUser.empId, selectedConversation.partnerId);

            const content = text.trim();
            const uploadedAttachments = await uploadAttachments(roomId);

            const messagePayload = {
                roomId,
                chatType: selectedConversation.kind,
                groupId: selectedConversation.kind === "group" ? selectedConversation.groupId : undefined,
                senderId: currentUser.empId,
                senderName: currentUser.name,
                receiverId: selectedConversation.kind === "group" ? undefined : selectedConversation.partnerId,
                content,
                attachments: uploadedAttachments,
                replyTo: replyTo ? {
                    messageId: replyTo._id,
                    senderName: replyTo.senderName,
                    content: replyTo.content,
                } : undefined,
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
            setReplyTo(null);
            setShowMentions(false);
            setMentionSearch("");
            setRefreshTick((prev) => prev + 1);
        } catch (error) {
            console.error("Sending failed", error);
            showToast("Failed to send message");
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
                const type = String(item.attachment.fileType || "").toLowerCase();
                const url = (item.attachment.url || "").toLowerCase();
                return (
                    type.startsWith("image/") ||
                    url.endsWith(".jpg") ||
                    url.endsWith(".jpeg") ||
                    url.endsWith(".png") ||
                    url.endsWith(".gif") ||
                    url.endsWith(".webp")
                );
            });
    }, [messages, selectedConversation, activeRoomId]);

    const docItems = useMemo(() => {
        if (!selectedConversation) return [];
        return messages.flatMap((message) =>
            (message.attachments || [])
                .filter((attachment) => {
                    const type = String(attachment.fileType || "").toLowerCase();
                    return !type.startsWith("image/") && !type.startsWith("video/");
                })
                .map((attachment, index) => ({
                    key: `${attachment.url}-${index}`,
                    attachment,
                    senderName: message.senderName,
                    createdAt: message.createdAt,
                }))
        );
    }, [messages, selectedConversation]);

    const sharedLinks = useMemo<LinkPreview[]>(() => {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        return messages.flatMap((message) => {
            const found = String(message.content || "").match(urlRegex) || [];
            return found.map((url) => ({
                url,
                senderName: message.senderName,
                createdAt: message.createdAt,
            }));
        });
    }, [messages]);

    const handleCopy = async (text: string, label: string = "Text") => {
        if (!text || text === "-") return;
        try {
            await Clipboard.setStringAsync(text);
            showToast(`${label} copied`);
        } catch (error) {
            console.error("Failed to copy", error);
        }
    };

    const renderSharedTabContent = () => {
        if (profileTab === "media") {
            return mediaItems.length > 0 ? (
                <View style={styles.mediaGrid}>
                    {mediaItems.slice(0, 12).map((item) => (
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
            );
        }

        if (profileTab === "links") {
            return sharedLinks.length > 0 ? (
                <View style={styles.sharedList}>
                    {sharedLinks.slice(0, 15).map((entry, index) => (
                        <TouchableOpacity
                            key={`${entry.url}-${index}`}
                            onPress={() => Linking.openURL(entry.url)}
                            style={styles.sharedCard}
                        >
                            <LinkIcon size={16} color="#2563eb" />
                            <View style={styles.sharedCardBody}>
                                <Text style={styles.sharedPrimaryText} numberOfLines={2}>
                                    {entry.url}
                                </Text>
                                <Text style={styles.sharedSecondaryText}>
                                    {entry.senderName || "Unknown"} {entry.createdAt ? `• ${new Date(entry.createdAt).toLocaleDateString()}` : ""}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <Text style={styles.profileEmptyText}>No shared links.</Text>
            );
        }

        return docItems.length > 0 ? (
            <View style={styles.sharedList}>
                {docItems.slice(0, 15).map((item) => (
                    <TouchableOpacity
                        key={item.key}
                        onPress={() => Linking.openURL(item.attachment.url)}
                        style={styles.sharedCard}
                    >
                        <Paperclip size={16} color="#475569" />
                        <View style={styles.sharedCardBody}>
                            <Text style={styles.sharedPrimaryText} numberOfLines={1}>
                                {item.attachment.fileName}
                            </Text>
                            <Text style={styles.sharedSecondaryText}>
                                {formatFileSize(item.attachment.size)} {item.createdAt ? `• ${new Date(item.createdAt).toLocaleDateString()}` : ""}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        ) : (
            <Text style={styles.profileEmptyText}>No shared documents.</Text>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
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
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filterTabs}
                            >
                                {CHAT_FILTER_TABS.map((tab) => {
                                    const isActive = sidebarFilter === tab.id;
                                    return (
                                        <TouchableOpacity
                                            key={tab.id}
                                            onPress={() => setSidebarFilter(tab.id)}
                                            style={[styles.filterTab, isActive && styles.filterTabActive]}
                                        >
                                            <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                                                {tab.label}
                                            </Text>
                                            <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                                                <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                                                    {sidebarFilterCounts[tab.id]}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                            <FlatList
                                data={filteredConversationList}
                                keyExtractor={(item) => getConversationKey(item)}
                                style={styles.conversationList}
                                contentContainerStyle={{ flexGrow: 1 }}
                                renderItem={({ item: conversation }) => {
                                    const key = getConversationKey(conversation);
                                    const isActive = selectedKey === key;
                                    const unreadCount = Number(conversation.unreadCount || 0);
                                    const isPinned = pinnedKeys.includes(key);

                                    const label =
                                        conversation.kind === "group"
                                            ? conversation.groupName
                                            : employeeById[normalizeId(conversation.partnerId)]?.displayName ||
                                            employeeById[normalizeId(conversation.partnerId)]?.name ||
                                            conversation.partnerId;

                                    return (
                                        <TouchableOpacity
                                            onPress={() => handleSelectConversation(conversation)}
                                            onLongPress={() => setContextMenu({ key, label, isPinned })}
                                            style={[styles.conversationItem, isActive && styles.conversationItemActive]}
                                        >
                                            <View style={styles.conversationAvatar}>
                                                {conversation.kind === "group" ? (
                                                    <View style={styles.groupAvatarIcon}>
                                                        <Users size={20} color="#64748b" />
                                                    </View>
                                                ) : (
                                                    employeeById[normalizeId(conversation.partnerId)]?.photo ? (
                                                        <Image 
                                                            source={{ uri: employeeById[normalizeId(conversation.partnerId)]?.photo }} 
                                                            style={styles.avatarImage} 
                                                        />
                                                    ) : (
                                                        <Text style={styles.conversationAvatarText}>
                                                            {label.charAt(0).toUpperCase()}
                                                        </Text>
                                                    )
                                                )}
                                            </View>
                                            <View style={styles.conversationInfo}>
                                                <View style={styles.conversationHeader}>
                                                    <Text style={styles.conversationName} numberOfLines={1}>{label}</Text>
                                                    {conversation.lastMessage?.createdAt && (
                                                        <Text style={styles.conversationTime}>
                                                            {formatTime(conversation.lastMessage.createdAt)}
                                                        </Text>
                                                    )}
                                                </View>
                                                <View style={styles.conversationSubHeader}>
                                                    <Text style={styles.conversationPreview} numberOfLines={1}>
                                                        {conversation.lastMessage?.content || "No messages yet"}
                                                    </Text>
                                                    <View style={styles.conversationMeta}>
                                                        {isPinned && <Pin size={12} color="#059669" fill="#059669" />}
                                                        {unreadCount > 0 && (
                                                            <View style={styles.unreadBadge}>
                                                                <Text style={styles.unreadText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                                ListEmptyComponent={() => (
                                    <View style={styles.emptyConversationState}>
                                        <Text style={styles.emptyConversationTitle}>No chats in this view</Text>
                                        <Text style={styles.emptyConversationSubtitle}>Try another filter or search for a teammate.</Text>
                                    </View>
                                )}
                            />
                        </View>
                    ) : (
                        <View style={styles.mainChat}>
                            <View style={styles.chatHeader}>
                                <TouchableOpacity onPress={() => setSelectedKey("")} style={styles.backButton}>
                                    <ChevronLeft size={24} color="#0f172a" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (selectedConversation?.kind === "group") setIsGroupPanelOpen(true);
                                        else setIsProfilePopupOpen(true);
                                    }}
                                    style={styles.chatHeaderInfo}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={styles.headerAvatarContainer}>
                                            {selectedConversation.kind === "group" ? (
                                                <Users size={16} color="#64748b" />
                                            ) : (
                                                selectedEmployee?.photo ? (
                                                    <Image source={{ uri: selectedEmployee.photo }} style={styles.headerAvatarImage} />
                                                ) : (
                                                    <Text style={styles.headerAvatarText}>
                                                        {(selectedEmployee?.displayName || selectedEmployee?.name || "?").charAt(0).toUpperCase()}
                                                    </Text>
                                                )
                                            )}
                                        </View>
                                        <View>
                                            <Text style={styles.headerTitle}>
                                                {selectedConversation.kind === "group"
                                                    ? selectedConversation.groupName
                                                    : employeeById[normalizeId(selectedConversation.partnerId)]?.displayName || selectedEmployee?.name || selectedConversation.partnerId}
                                            </Text>
                                            <Text style={styles.headerSubtitle}>
                                                {selectedConversation.kind === "group"
                                                    ? `${groupMembers.length} members`
                                                    : selectedEmployee?.isOnline
                                                    ? "Online"
                                                    : selectedEmployee?.department || "Direct message"}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                                <View style={styles.callButtons}>
                                    <TouchableOpacity onPress={() => togglePin(selectedKey)} style={styles.callButton}>
                                        {pinnedKeys.includes(selectedKey) ? (
                                            <PinOff size={18} color="#64748b" />
                                        ) : (
                                            <Pin size={18} color="#64748b" />
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={clearCurrentChat} style={styles.callButton}>
                                        <Trash2 size={18} color="#64748b" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => startCall('audio')} style={styles.callButton}>
                                        <Phone size={20} color="#64748b" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => startCall('video')} style={styles.callButton}>
                                        <Video size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <FlatList
                                data={reversedMessages}
                                inverted={true}
                                keyExtractor={(item, index) => item._id || `${item.senderId}-${index}`}
                                style={styles.messagesList}
                                contentContainerStyle={{ padding: 16, gap: 12 }}
                                renderItem={({ item: message }) => {
                                    const isMyMessage = normalizeId(message.senderId) === normalizeId(currentUser?.empId);
                                    const reactions = reactionsByMessage[message._id || ""] || [];

                                    return (
                                        <View style={[styles.messageWrapper, isMyMessage ? styles.messageWrapperRight : styles.messageWrapperLeft]}>
                                            {!isMyMessage && (
                                                <View style={styles.messageBubbleAvatar}>
                                                    {employeeById[message.senderId]?.photo ? (
                                                        <Image source={{ uri: employeeById[message.senderId].photo }} style={styles.messageBubbleAvatarImage} />
                                                    ) : (
                                                        <Text style={styles.messageBubbleAvatarText}>
                                                            {(message.senderName || "?").charAt(0).toUpperCase()}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                onLongPress={() => {
                                                    if (isMyMessage) {
                                                        handleEditMessage(message);
                                                    } else {
                                                        setReplyTo(message);
                                                    }
                                                }}
                                                style={[styles.messageBubble, isMyMessage ? styles.messageBubbleRight : styles.messageBubbleLeft]}
                                            >
                                                {!isMyMessage && (
                                                    <Text style={styles.senderName}>{message.senderName}</Text>
                                                )}
                                                {message.replyTo && (
                                                    <View style={[styles.replyPreview, { marginHorizontal: 0, marginTop: 0, marginBottom: 8 }]}>
                                                        <View style={styles.replyPreviewContent}>
                                                            <Text style={styles.replyPreviewName}>{message.replyTo.senderName}</Text>
                                                            <Text style={styles.replyPreviewText} numberOfLines={1}>{message.replyTo.content}</Text>
                                                        </View>
                                                    </View>
                                                )}
                                                {editingMessageId === message._id ? (
                                                    <View>
                                                        <TextInput
                                                            style={styles.messageInput}
                                                            value={editingText}
                                                            onChangeText={setEditingText}
                                                            autoFocus
                                                        />
                                                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
                                                            <TouchableOpacity onPress={() => setEditingMessageId("")}>
                                                                <Text style={{ color: '#ef4444' }}>Cancel</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={saveEditedMessage}>
                                                                <Text style={{ color: '#059669', fontWeight: 'bold' }}>Save</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                ) : (
                                                    <View>
                                                        {message.attachments && message.attachments.length > 0 && (
                                                            <View style={styles.attachmentsContainer}>
                                                                {message.attachments.map((att, idx) => (
                                                                    <TouchableOpacity 
                                                                        key={`${message._id}-att-${idx}`} 
                                                                        onPress={() => Linking.openURL(att.url)}
                                                                        style={styles.attachmentItem}
                                                                    >
                                                                        {att.fileType?.startsWith('image') || att.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                                            <Image source={{ uri: att.url }} style={styles.attachmentImage} />
                                                                        ) : (
                                                                            <View style={styles.fileAttachment}>
                                                                                <Paperclip size={16} color="#64748b" />
                                                                                <Text style={styles.fileName} numberOfLines={1}>{att.fileName}</Text>
                                                                            </View>
                                                                        )}
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </View>
                                                        )}
                                                        <Text style={[styles.messageContent, isMyMessage && { color: "#064e3b" }]} selectable>{message.content}</Text>
                                                    </View>
                                                )}
                                                
                                                {reactions.length > 0 && (
                                                    <View style={styles.reactionsContainer}>
                                                        {Array.from(new Set(reactions)).map((emoji, idx) => (
                                                            <TouchableOpacity
                                                                key={`${message._id}-reaction-${idx}`}
                                                                style={styles.reactionBadge}
                                                                onPress={() => toggleReaction(message._id || "", emoji)}
                                                            >
                                                                <Text style={styles.reactionText}>{emoji}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                )}

                                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 8 }}>
                                                    <Text style={{ fontSize: 10, color: '#64748b' }}>
                                                        {formatTime(message.createdAt)}
                                                        {message.editedAt && " (edited)"}
                                                    </Text>
                                                    {isMyMessage && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            {(() => {
                                                                const isDirect = selectedConversation?.kind === 'direct';
                                                                const partnerId = selectedConversation?.kind === 'direct' ? selectedConversation.partnerId : null;
                                                                
                                                                if (isDirect && partnerId) {
                                                                    if ((message.seenBy || []).includes(partnerId)) {
                                                                        return <CheckCheck size={14} color="#3b82f6" />;
                                                                    }
                                                                    if ((message.deliveredTo || []).includes(partnerId)) {
                                                                        return <CheckCheck size={14} color="#94a3b8" />;
                                                                    }
                                                                    return <Check size={14} color="#94a3b8" />;
                                                                } else if (selectedConversation?.kind === 'group') {
                                                                    const recipientIds = selectedConversation.memberIds.filter(id => normalizeId(id) !== normalizeId(currentUser?.empId));
                                                                    if (recipientIds.length === 0) return <Check size={14} color="#94a3b8" />;
                                                                    
                                                                    const seenCount = recipientIds.filter(id => (message.seenBy || []).includes(id)).length;
                                                                    if (seenCount === recipientIds.length) return <CheckCheck size={14} color="#3b82f6" />;
                                                                    
                                                                    const deliveredCount = recipientIds.filter(id => (message.deliveredTo || []).includes(id)).length;
                                                                    if (deliveredCount > 0) return <CheckCheck size={14} color="#94a3b8" />;
                                                                    
                                                                    return <Check size={14} color="#94a3b8" />;
                                                                }
                                                                return <Clock size={14} color="#94a3b8" />;
                                                            })()}
                                                        </View>
                                                    )}
                                                    {isMyMessage && (
                                                        <TouchableOpacity onPress={() => deleteMessage(message._id || "")}>
                                                            <Trash2 size={12} color="#94a3b8" />
                                                        </TouchableOpacity>
                                                    )}
                                                    <TouchableOpacity onPress={() => handleForwardMessage(message)}>
                                                        <Forward size={12} color="#94a3b8" />
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                }}
                            />

                            {showMentions && (
                                <View style={styles.mentionPopup}>
                                    <FlatList
                                        data={mentionResults}
                                        keyExtractor={(item) => item.empId || ""}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={styles.mentionItem}
                                                onPress={() => handleMentionSelect(item)}
                                            >
                                                <View style={styles.mentionAvatar}>
                                                    {item.photo ? (
                                                        <Image source={{ uri: item.photo }} style={styles.avatarImage} />
                                                    ) : (
                                                        <Text style={styles.mentionAvatarText}>
                                                            {(item.displayName || item.name || "U").charAt(0).toUpperCase()}
                                                        </Text>
                                                    )}
                                                </View>
                                                <Text style={styles.mentionName}>{item.displayName || item.name}</Text>
                                            </TouchableOpacity>
                                        )}
                                        ListEmptyComponent={() => (
                                            <View style={styles.mentionEmpty}>
                                                <Text style={styles.mentionEmptyText}>
                                                    {mentionLoading ? "Searching..." : mentionError || "No results found"}
                                                </Text>
                                            </View>
                                        )}
                                    />
                                </View>
                            )}

                            {replyTo && (
                                <View style={styles.replyPreview}>
                                    <View style={styles.replyPreviewContent}>
                                        <Text style={styles.replyPreviewName}>{replyTo.senderName}</Text>
                                        <Text style={styles.replyPreviewText} numberOfLines={1}>
                                            {replyTo.content || "Attachment"}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setReplyTo(null)}>
                                        <X size={16} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            )}

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
                                <TouchableOpacity style={styles.attachButton} onPress={handleSelectFiles} disabled={isSending || !canCurrentUserSend}>
                                    <Paperclip size={20} color="#64748b" />
                                </TouchableOpacity>
                                <TextInput
                                    ref={messageInputRef}
                                    style={styles.messageInput}
                                    placeholder={
                                        selectedConversation?.kind === "group" &&
                                        selectedConversation.adminOnlyMessaging &&
                                        !canCurrentUserSend
                                            ? "Only admins can send messages"
                                            : "Type a message..."
                                    }
                                    value={text}
                                    onChangeText={handleChatTextChange}
                                    multiline
                                    editable={canCurrentUserSend && !isSending}
                                />
                                <TouchableOpacity
                                    style={[styles.sendButton, (!text.trim() && pendingFiles.length === 0 || isSending) && styles.sendButtonDisabled]}
                                    onPress={sendMessage}
                                    disabled={(!text.trim() && pendingFiles.length === 0) || isSending || !canCurrentUserSend}
                                >
                                    <Text style={styles.sendButtonText}>{isSending ? "..." : "Send"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                <Modal transparent visible={!!contextMenu} animationType="fade" onRequestClose={() => setContextMenu(null)}>
                    <TouchableOpacity style={[styles.modalBackdrop, { justifyContent: 'center' }]} activeOpacity={1} onPress={() => setContextMenu(null)}>
                        <TouchableOpacity style={[styles.modalContent, { marginHorizontal: 24, paddingBottom: 24 }]} activeOpacity={1}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{contextMenu?.label}</Text>
                                <TouchableOpacity onPress={() => setContextMenu(null)} style={{ padding: 4 }}>
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity 
                                style={[styles.primaryModalButton, { backgroundColor: '#f1f5f9', marginTop: 0 }]}
                                onPress={() => {
                                    if (contextMenu) togglePin(contextMenu.key);
                                    setContextMenu(null);
                                }}
                            >
                                <Text style={[styles.primaryModalButtonText, { color: '#0f172a' }]}>{contextMenu?.isPinned ? "Unpin Chat" : "Pin Chat"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.primaryModalButton, { backgroundColor: '#f1f5f9' }]}
                                onPress={() => {
                                    if (contextMenu) clearConversationByKey(contextMenu.key);
                                    setContextMenu(null);
                                }}
                            >
                                <Text style={[styles.primaryModalButtonText, { color: '#0f172a' }]}>Clear Chat</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.primaryModalButton, { backgroundColor: '#fee2e2', marginBottom: 0 }]}
                                onPress={() => {
                                    if (contextMenu) deleteConversation(contextMenu.key);
                                    setContextMenu(null);
                                }}
                            >
                                <Text style={[styles.primaryModalButtonText, { color: '#dc2626' }]}>Hide Chat</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>

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
                                        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 12 }}>
                                            {["media", "links", "docs"].map((tab) => (
                                                <TouchableOpacity
                                                    key={tab}
                                                    onPress={() => setProfileTab(tab as any)}
                                                    style={{
                                                        paddingVertical: 10,
                                                        paddingHorizontal: 16,
                                                        borderBottomWidth: profileTab === tab ? 2 : 0,
                                                        borderBottomColor: '#059669'
                                                    }}
                                                >
                                                    <Text style={{
                                                        fontSize: 14,
                                                        fontWeight: '600',
                                                        color: profileTab === tab ? '#059669' : '#64748b',
                                                        textTransform: 'capitalize'
                                                    }}>{tab}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {profileTab === "media" && (
                                            renderSharedTabContent()
                                        )}

                                        {profileTab === "links" && renderSharedTabContent()}

                                        {profileTab === "docs" && renderSharedTabContent()}
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>

                <Modal transparent visible={isGroupPanelOpen} animationType="slide">
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Group Info</Text>
                                <TouchableOpacity onPress={() => setIsGroupPanelOpen(false)}>
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            {selectedGroup && (
                                <ScrollView style={styles.modalScroll}>
                                    <View style={styles.profileHeader}>
                                        <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
                                            <Users size={40} color="#475569" />
                                        </View>
                                        <Text style={styles.profileName}>{selectedGroup.groupName}</Text>
                                        <Text style={styles.profileDept}>{groupMembers.length} Members</Text>
                                    </View>

                                    <View style={styles.profileSection}>
                                        <Text style={styles.profileSectionTitle}>Members</Text>
                                        {groupMembers.map((m) => (
                                            <View key={m.empId} style={styles.groupMemberRow}>
                                                <TouchableOpacity
                                                    style={styles.groupMemberIdentity}
                                                    onPress={() => setSelectedGroupMemberProfile(m.employee)}
                                                >
                                                    <View style={styles.conversationAvatar}>
                                                        {m.employee?.photo ? (
                                                            <Image source={{ uri: m.employee.photo }} style={styles.avatarImage} />
                                                        ) : (
                                                            <Text style={styles.conversationAvatarText}>
                                                                {(m.employee?.displayName || m.employee?.name || m.empId).charAt(0).toUpperCase()}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <View style={styles.conversationInfo}>
                                                        <Text style={styles.conversationName}>{m.employee?.displayName || m.employee?.name || m.empId}</Text>
                                                        <Text style={styles.groupMemberMeta}>
                                                            {m.empId} {m.isAdmin ? "• Admin" : ""}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                                <View style={styles.groupMemberActions}>
                                                    <TouchableOpacity
                                                        onPress={() => startDirectChat(m.empId)}
                                                        style={styles.groupMemberActionBtn}
                                                    >
                                                        <Text style={styles.groupMemberActionText}>Message</Text>
                                                    </TouchableOpacity>
                                                    {isSelectedGroupAdmin && normalizeId(m.empId) !== normalizeId(currentUser?.empId) && (
                                                        <>
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    const currentAdmins = selectedGroup.adminIds || [];
                                                                    const nextAdmins = m.isAdmin
                                                                        ? currentAdmins.filter((id) => id !== m.empId)
                                                                        : Array.from(new Set([...currentAdmins, m.empId]));
                                                                    runGroupAction({ action: "set-admins", adminIds: nextAdmins });
                                                                }}
                                                                style={styles.groupAdminActionBtn}
                                                            >
                                                                <Text style={styles.groupAdminActionText}>{m.isAdmin ? "Remove admin" : "Make admin"}</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => runGroupAction({ action: "remove-member", targetId: m.empId })}
                                                                style={styles.groupRemoveActionBtn}
                                                            >
                                                                <Text style={styles.groupRemoveActionText}>Remove</Text>
                                                            </TouchableOpacity>
                                                        </>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </View>

                                    {isSelectedGroupAdmin && (
                                        <View style={styles.profileSection}>
                                            <Text style={styles.profileSectionTitle}>Admin Controls</Text>
                                            <TouchableOpacity
                                                disabled={groupActionBusy}
                                                onPress={() =>
                                                    runGroupAction({
                                                        action: "update-settings",
                                                        adminOnlyMessaging: !selectedGroup.adminOnlyMessaging,
                                                    })
                                                }
                                                style={styles.adminControlRow}
                                            >
                                                <View style={styles.adminControlLeft}>
                                                    <Shield size={16} color="#a16207" />
                                                    <Text style={styles.adminControlLabel}>Admin-only messaging</Text>
                                                </View>
                                                <Text style={styles.adminControlValue}>
                                                    {selectedGroup.adminOnlyMessaging ? "On" : "Off"}
                                                </Text>
                                            </TouchableOpacity>

                                            <View style={styles.addMemberRow}>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    {addableEmployees.map((employee) => {
                                                        const empId = String(employee.empId || "");
                                                        const active = addMemberEmpId === empId;
                                                        return (
                                                            <TouchableOpacity
                                                                key={empId}
                                                                onPress={() => setAddMemberEmpId(empId)}
                                                                style={[styles.memberPickerChip, active && styles.memberPickerChipActive]}
                                                            >
                                                                <Text style={[styles.memberPickerChipText, active && styles.memberPickerChipTextActive]}>
                                                                    {employee.displayName || employee.name}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </ScrollView>
                                                <TouchableOpacity
                                                    disabled={!addMemberEmpId || groupActionBusy}
                                                    onPress={async () => {
                                                        await runGroupAction({ action: "add-members", memberIds: [addMemberEmpId] });
                                                        setAddMemberEmpId("");
                                                    }}
                                                    style={[styles.addMemberButton, (!addMemberEmpId || groupActionBusy) && styles.sendButtonDisabled]}
                                                >
                                                    <Text style={styles.addMemberButtonText}>Add member</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    <View style={styles.profileSection}>
                                        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 12 }}>
                                            {["media", "links", "docs"].map((tab) => (
                                                <TouchableOpacity
                                                    key={tab}
                                                    onPress={() => setProfileTab(tab as any)}
                                                    style={{
                                                        paddingVertical: 10,
                                                        paddingHorizontal: 16,
                                                        borderBottomWidth: profileTab === tab ? 2 : 0,
                                                        borderBottomColor: '#059669'
                                                    }}
                                                >
                                                    <Text style={{
                                                        fontSize: 14,
                                                        fontWeight: '600',
                                                        color: profileTab === tab ? '#059669' : '#64748b',
                                                        textTransform: 'capitalize'
                                                    }}>{tab}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {profileTab === "media" && renderSharedTabContent()}
                                        {profileTab === "links" && renderSharedTabContent()}
                                        {profileTab === "docs" && renderSharedTabContent()}
                                    </View>

                                    {selectedGroupMemberProfile && (
                                        <View style={styles.profileSection}>
                                            <View style={styles.modalHeader}>
                                                <Text style={styles.profileSectionTitle}>Member Profile</Text>
                                                <TouchableOpacity onPress={() => setSelectedGroupMemberProfile(null)}>
                                                    <X size={18} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.profileValue}>
                                                {selectedGroupMemberProfile.displayName || selectedGroupMemberProfile.name || "-"}
                                            </Text>
                                            <Text style={styles.groupMemberProfileText}>
                                                {selectedGroupMemberProfile.mailId || selectedGroupMemberProfile.email || "-"}
                                            </Text>
                                            <Text style={styles.groupMemberProfileText}>
                                                {selectedGroupMemberProfile.phoneNumber || "-"}
                                            </Text>
                                            <Text style={styles.groupMemberProfileText}>
                                                {selectedGroupMemberProfile.role || selectedGroupMemberProfile.department || "-"}
                                            </Text>
                                        </View>
                                    )}
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>

                <Modal transparent visible={isCreateGroupOpen} animationType="slide">
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Create Group</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsCreateGroupOpen(false);
                                        setNewGroupName("");
                                        setNewGroupMemberIds([]);
                                        setNewGroupAdminOnlyMessaging(false);
                                    }}
                                >
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalScroll}>
                                <TextInput
                                    style={styles.groupNameInput}
                                    placeholder="Group name"
                                    value={newGroupName}
                                    onChangeText={setNewGroupName}
                                />

                                <TouchableOpacity
                                    onPress={() => setNewGroupAdminOnlyMessaging((prev) => !prev)}
                                    style={styles.adminControlRow}
                                >
                                    <View style={styles.adminControlLeft}>
                                        <Shield size={16} color="#a16207" />
                                        <Text style={styles.adminControlLabel}>Restrict messaging to admins</Text>
                                    </View>
                                    <Text style={styles.adminControlValue}>
                                        {newGroupAdminOnlyMessaging ? "On" : "Off"}
                                    </Text>
                                </TouchableOpacity>

                                <Text style={styles.profileSectionTitle}>Choose members</Text>
                                <View style={styles.memberSelectorList}>
                                    {employees.map((employee) => {
                                        const empId = String(employee.empId || "").trim();
                                        if (!empId) return null;
                                        const selected = newGroupMemberIds.includes(empId);
                                        return (
                                            <TouchableOpacity
                                                key={empId}
                                                onPress={() =>
                                                    setNewGroupMemberIds((prev) =>
                                                        selected ? prev.filter((id) => id !== empId) : [...prev, empId]
                                                    )
                                                }
                                                style={[styles.memberSelectRow, selected && styles.memberSelectRowActive]}
                                            >
                                                <View style={styles.memberSelectIdentity}>
                                                    <View style={styles.conversationAvatar}>
                                                        {employee.photo ? (
                                                            <Image source={{ uri: employee.photo }} style={styles.avatarImage} />
                                                        ) : (
                                                            <Text style={styles.conversationAvatarText}>
                                                                {(employee.displayName || employee.name || "U").charAt(0).toUpperCase()}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <View style={styles.conversationInfo}>
                                                        <Text style={styles.conversationName}>{employee.displayName || employee.name}</Text>
                                                        <Text style={styles.groupMemberMeta}>{empId}</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.memberSelectIndicator}>{selected ? "Selected" : "Select"}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <TouchableOpacity onPress={handleCreateGroup} style={styles.primaryModalButton}>
                                    <Text style={styles.primaryModalButtonText}>Create group</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                <Modal transparent visible={isForwardModalOpen} animationType="fade">
                    <View style={styles.forwardModal}>
                        <View style={styles.forwardContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Forward to...</Text>
                                <TouchableOpacity onPress={() => setIsForwardModalOpen(false)}>
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search employees..."
                                value={forwardSearch}
                                onChangeText={setForwardSearch}
                            />
                            <FlatList
                                data={employees.filter((employee) => {
                                    if (normalizeId(employee.empId) === normalizeId(currentUser?.empId)) return false;
                                    const query = forwardSearch.trim().toLowerCase();
                                    if (!query) return true;
                                    const name = String(employee.displayName || employee.name || "").toLowerCase();
                                    const empId = String(employee.empId || "").toLowerCase();
                                    return name.includes(query) || empId.includes(query);
                                })}
                                keyExtractor={(item) => item.empId || ""}
                                style={styles.forwardList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.conversationItem}
                                        onPress={() => forwardToEmployee(item)}
                                    >
                                        <View style={styles.conversationAvatar}>
                                            {item.photo ? (
                                                <Image source={{ uri: item.photo }} style={styles.avatarImage} />
                                            ) : (
                                                <Text style={styles.conversationAvatarText}>
                                                    {(item.displayName || item.name || "U").charAt(0).toUpperCase()}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.conversationName}>{item.displayName || item.name}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </Modal>
                {!selectedKey && (
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/attendance')}>
                            <Fingerprint size={22} color="#64748b" />
                            <Text style={styles.footerLabel}>Mark Attendance</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.footerButton}>
                            <MessageSquare size={22} color="#059669" />
                            <Text style={[styles.footerLabel, { color: '#059669', fontWeight: 'bold' }]}>Chat</Text>
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
        justifyContent: "flex-start",
        paddingTop: 80,
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
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
        backgroundColor: "#ffffff",
        height: 64,
    },
    chatHeaderInfo: {
        flex: 1,
        justifyContent: "center",
        marginLeft: 4,
    },
    backButton: {
        marginRight: 4,
        padding: 4,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0f172a",
    },
    headerSubtitle: {
        fontSize: 12,
        color: "#64748b",
        marginTop: 2,
    },
    conversationPreview: {
        fontSize: 12,
        color: "#64748b",
        marginTop: -1,
        flex: 1,
    },
    conversationTime: {
        fontSize: 11,
        color: "#64748b",
    },
    conversationSubHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    createGroupBtn: {
        padding: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#cbd5e1",
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        position: "relative",
    },
    filterTabs: {
        paddingHorizontal: 16,
        paddingBottom: 6,
        gap: 8,
    },
    filterTab: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingHorizontal: 10,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#cbd5e1",
        backgroundColor: "#f8fafc",
    },
    filterTabActive: {
        backgroundColor: "#059669",
        borderColor: "#059669",
    },
    filterTabText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#334155",
    },
    filterTabTextActive: {
        color: "#ffffff",
    },
    filterBadge: {
        minWidth: 16,
        paddingHorizontal: 4,
        height: 14,
        borderRadius: 7,
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
    },
    filterBadgeActive: {
        backgroundColor: "rgba(255,255,255,0.18)",
    },
    filterBadgeText: {
        fontSize: 9,
        fontWeight: "700",
        color: "#475569",
    },
    filterBadgeTextActive: {
        color: "#ffffff",
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
    avatarImage: {
        width: "100%",
        height: "100%",
        borderRadius: 20,
    },
    groupAvatarIcon: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f1f5f9",
        borderRadius: 20,
    },
    headerAvatarContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        marginRight: 10,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f1f5f9",
    },
    headerAvatarImage: {
        width: "100%",
        height: "100%",
    },
    headerAvatarText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#64748b",
    },
    conversationList: {
        flex: 1,
    },
    conversationItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    conversationItemActive: {
        backgroundColor: "#f0fdf4",
    },
    conversationAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
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
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
        paddingBottom: 10,
    },
    conversationHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 2,
    },
    conversationMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginLeft: 8,
    },
    conversationName: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#0f172a",
        flex: 1,
    },
    unreadBadge: {
        backgroundColor: "#25D366",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadText: {
        color: "#ffffff",
        fontSize: 10,
        fontWeight: "bold",
    },
    emptyConversationState: {
        paddingHorizontal: 24,
        paddingTop: 32,
        alignItems: "flex-start",
    },
    emptyConversationTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0f172a",
    },
    emptyConversationSubtitle: {
        fontSize: 13,
        color: "#64748b",
        textAlign: "left",
        marginTop: 6,
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
        paddingLeft: 4,
        paddingRight: 40,
    },
    messageWrapperRight: {
        justifyContent: "flex-end",
        paddingLeft: 40,
        paddingRight: 4,
    },
    messageBubbleAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 8,
        marginTop: 4,
        backgroundColor: "#f1f5f9",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    messageBubbleAvatarImage: {
        width: "100%",
        height: "100%",
    },
    messageBubbleAvatarText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#64748b",
    },
    messageBubble: {
        maxWidth: "85%",
        borderRadius: 12,
        padding: 10,
        position: "relative",
    },
    messageBubbleLeft: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    messageBubbleRight: {
        backgroundColor: "#d1fae5",
    },
    attachmentsContainer: {
        marginBottom: 8,
        gap: 4,
    },
    attachmentItem: {
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#f1f5f9",
    },
    attachmentImage: {
        width: 200,
        height: 200,
        resizeMode: "cover",
    },
    fileAttachment: {
        flexDirection: "row",
        alignItems: "center",
        padding: 8,
        gap: 8,
        backgroundColor: "#f1f5f9",
        borderRadius: 6,
    },
    fileName: {
        fontSize: 12,
        color: "#475569",
        flex: 1,
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
        flexShrink: 1,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 12,
        backgroundColor: "#ffffff",
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
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
        maxHeight: 120,
        minHeight: 40,
        fontSize: 14,
        color: "#0f172a",
        textAlignVertical: "top",
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
    sharedList: {
        gap: 10,
    },
    sharedCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        padding: 12,
        backgroundColor: "#ffffff",
        marginBottom: 10,
    },
    sharedCardBody: {
        flex: 1,
    },
    sharedPrimaryText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#0f172a",
    },
    sharedSecondaryText: {
        fontSize: 12,
        color: "#64748b",
        marginTop: 4,
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
    groupMemberRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 8,
    },
    groupMemberIdentity: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    groupMemberMeta: {
        fontSize: 11,
        color: "#64748b",
        marginTop: 2,
    },
    groupMemberActions: {
        flexDirection: "row",
        gap: 8,
    },
    groupMemberActionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#ecfdf5",
    },
    groupMemberActionText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#047857",
    },
    groupAdminActionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#eff6ff",
    },
    groupAdminActionText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#1d4ed8",
    },
    groupRemoveActionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#fef2f2",
    },
    groupRemoveActionText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#dc2626",
    },
    adminControlRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#fcd34d",
        backgroundColor: "#fffbeb",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
    },
    adminControlLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
    },
    adminControlLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#92400e",
    },
    adminControlValue: {
        fontSize: 12,
        fontWeight: "700",
        color: "#a16207",
    },
    addMemberRow: {
        gap: 10,
    },
    memberPickerChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#f1f5f9",
        marginRight: 8,
    },
    memberPickerChipActive: {
        backgroundColor: "#dcfce7",
    },
    memberPickerChipText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
    },
    memberPickerChipTextActive: {
        color: "#047857",
    },
    addMemberButton: {
        alignSelf: "flex-start",
        backgroundColor: "#059669",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    addMemberButtonText: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "700",
    },
    groupMemberProfileText: {
        fontSize: 13,
        color: "#475569",
        marginTop: 6,
    },
    groupNameInput: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: "#0f172a",
        marginBottom: 16,
    },
    memberSelectorList: {
        marginTop: 8,
    },
    memberSelectRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 14,
        padding: 10,
        marginBottom: 10,
        backgroundColor: "#ffffff",
    },
    memberSelectRowActive: {
        borderColor: "#34d399",
        backgroundColor: "#ecfdf5",
    },
    memberSelectIdentity: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    memberSelectIndicator: {
        fontSize: 12,
        fontWeight: "700",
        color: "#047857",
    },
    primaryModalButton: {
        marginTop: 10,
        backgroundColor: "#059669",
        borderRadius: 14,
        alignItems: "center",
        paddingVertical: 14,
        marginBottom: 12,
    },
    primaryModalButtonText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "700",
    },
    mentionPopup: {
        position: "absolute",
        bottom: 70,
        left: 12,
        right: 12,
        backgroundColor: "#ffffff",
        borderRadius: 12,
        maxHeight: 200,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        zIndex: 1000,
    },
    mentionItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
    },
    mentionAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#e2e8f0",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
    },
    mentionAvatarText: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#475569",
    },
    mentionName: {
        fontSize: 14,
        color: "#0f172a",
        fontWeight: "500",
    },
    mentionEmpty: {
        padding: 20,
        alignItems: "center",
    },
    mentionEmptyText: {
        color: "#64748b",
        fontSize: 13,
    },
    replyPreview: {
        flexDirection: "row",
        backgroundColor: "#f8fafc",
        padding: 10,
        borderLeftWidth: 4,
        borderLeftColor: "#059669",
        alignItems: "center",
        marginHorizontal: 12,
        marginTop: 8,
        borderRadius: 4,
    },
    replyPreviewContent: {
        flex: 1,
    },
    replyPreviewName: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#059669",
        marginBottom: 2,
    },
    replyPreviewText: {
        fontSize: 12,
        color: "#64748b",
    },
    forwardModal: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        padding: 20,
    },
    forwardContent: {
        backgroundColor: "#ffffff",
        borderRadius: 16,
        maxHeight: "80%",
        padding: 16,
    },
    forwardList: {
        marginTop: 12,
    },
    reactionsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 4,
        gap: 4,
    },
    reactionBadge: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    reactionText: {
        fontSize: 12,
    },
    callButtons: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    callButton: {
        padding: 10,
        borderRadius: 20,
        backgroundColor: "transparent",
    },
    onlineStatus: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#10b981",
        borderWidth: 1.5,
        borderColor: "#ffffff",
        position: "absolute",
        bottom: 0,
        right: 0,
    },
});