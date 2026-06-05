import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { io, Socket } from "socket.io-client";
import TopBar from "../common/TopBar";
import FooterNav, {
    getFooterNavClearance,
} from "../leave_feature/components/FooterNav";

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
type ConversationListRow =
    | { type: "section"; id: string; title: string }
    | { type: "conversation"; id: string; conversation: Conversation };

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

const formatDisplayText = (value?: string | null) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text;
};

const getEmployeeLabel = (employee?: Employee | null, fallback?: string) => {
    const displayName = formatDisplayText(employee?.displayName);
    if (displayName) return displayName;

    const name = formatDisplayText(employee?.name);
    if (name) return name;

    return formatDisplayText(fallback) || "Unknown User";
};

const getConversationLabel = (conversation: Conversation, employee?: Employee | null) => {
    if (conversation.kind === "group") {
        return formatDisplayText(conversation.groupName) || "Unnamed Group";
    }

    return getEmployeeLabel(employee, conversation.partnerId);
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
    const insets = useSafeAreaInsets();
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
    const conversationListRef = React.useRef<FlatList>(null);

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
                return getConversationLabel(conversation).toLowerCase().includes(query);
            }
            const employee = employeeById[normalizeId(conversation.partnerId)];
            const label = getEmployeeLabel(employee, conversation.partnerId).toLowerCase();
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

    const chatListRows = useMemo(() => {
        const pinned = filteredConversationList.filter((conversation) =>
            pinnedKeys.includes(getConversationKey(conversation))
        );
        const recent = filteredConversationList.filter(
            (conversation) => !pinnedKeys.includes(getConversationKey(conversation))
        );

        const rows: ConversationListRow[] = [];

        if (pinned.length > 0) {
            rows.push({ type: "section", id: "section-pinned", title: "Pinned" });
            pinned.forEach((conversation) => {
                rows.push({
                    type: "conversation",
                    id: getConversationKey(conversation),
                    conversation,
                });
            });
        }

        if (recent.length > 0) {
            rows.push({ type: "section", id: "section-recent", title: "Recent" });
            recent.forEach((conversation) => {
                rows.push({
                    type: "conversation",
                    id: getConversationKey(conversation),
                    conversation,
                });
            });
        }

        return rows;
    }, [filteredConversationList, pinnedKeys]);

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
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
            >
                <View style={styles.chatContainer}>
                    {!selectedConversation ? (
                        <View style={styles.sidebar}>
                            <TopBar subtitle="Chats">
                                <View style={styles.topBarActions}>
                                    <TouchableOpacity onPress={() => setIsCreateGroupOpen(true)} style={styles.createGroupBtn}>
                                        <Plus size={18} color="#059669" />
                                    </TouchableOpacity>
                                </View>
                            </TopBar>

                            <View style={styles.searchContainer}>
                                <View style={styles.searchInputWrapper}>
                                    <Search size={16} color="#94a3b8" style={styles.searchIcon} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search employees..."
                                        placeholderTextColor="#94a3b8"
                                        value={searchTerm}
                                        onChangeText={setSearchTerm}
                                    />
                                    {searchTerm.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearchTerm("")} style={styles.searchClear}>
                                            <X size={14} color="#94a3b8" />
                                        </TouchableOpacity>
                                    )}
                                </View>
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
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                                                {tab.label}
                                            </Text>
                                            {sidebarFilterCounts[tab.id] > 0 && (
                                                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                                                    <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                                                        {sidebarFilterCounts[tab.id]}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <FlatList
                                ref={conversationListRef}
                                data={chatListRows}
                                keyExtractor={(item) => item.id}
                                style={styles.conversationList}
                                contentContainerStyle={{ 
                                    paddingBottom: getFooterNavClearance(insets.bottom) + 80,
                                    paddingTop: 0,
                                }}
                                showsVerticalScrollIndicator={true}
                                renderItem={({ item, index }) => {
                                    if (item.type === "section") {
                                        return (
                                            <Text style={[
                                                styles.conversationSectionTitle,
                                                index === 0 && styles.firstConversationSectionTitle,
                                            ]}>
                                                {item.title}
                                            </Text>
                                        );
                                    }

                                    const conversation = item.conversation;
                                    const key = getConversationKey(conversation);
                                    const isActive = selectedKey === key;
                                    const unreadCount = Number(conversation.unreadCount || 0);
                                    const isPinned = pinnedKeys.includes(key);

                                    const conversationEmployee =
                                        conversation.kind === "direct"
                                            ? employeeById[normalizeId(conversation.partnerId)]
                                            : undefined;
                                    const label = getConversationLabel(conversation, conversationEmployee);
                                    const isOnline = conversationEmployee?.isOnline ?? false;

                                    return (
                                        <TouchableOpacity
                                            onPress={() => handleSelectConversation(conversation)}
                                            onLongPress={() => setContextMenu({ key, label, isPinned })}
                                            activeOpacity={0.7}
                                            style={[styles.conversationItem, isActive && styles.conversationItemActive]}
                                        >
                                            <View style={styles.avatarWrapper}>
                                                <View style={styles.conversationAvatar}>
                                                    {conversation.kind === "group" ? (
                                                        <View style={styles.groupAvatarIcon}>
                                                            <Users size={22} color="#059669" />
                                                        </View>
                                                    ) : conversationEmployee?.photo ? (
                                                        <Image
                                                            source={{ uri: conversationEmployee.photo }}
                                                            style={styles.avatarImage}
                                                        />
                                                    ) : (
                                                        <Text style={styles.conversationAvatarText}>
                                                            {label.charAt(0).toUpperCase()}
                                                        </Text>
                                                    )}
                                                </View>
                                                {conversation.kind === "direct" && isOnline && (
                                                    <View style={styles.onlineDot} />
                                                )}
                                            </View>

                                            <View style={styles.conversationContent}>
                                                <View style={styles.conversationTopRow}>
                                                    <Text
                                                        style={[
                                                            styles.conversationName,
                                                            unreadCount > 0 && styles.conversationNameBold,
                                                        ]}
                                                        numberOfLines={1}
                                                    >
                                                        {label}
                                                    </Text>
                                                    <View style={styles.conversationTopRight}>
                                                        {isPinned && <Pin size={11} color="#059669" fill="#059669" style={{ marginRight: 4 }} />}
                                                        <Text style={[styles.conversationTime, unreadCount > 0 && styles.conversationTimeUnread]}>
                                                            {formatTime(conversation.lastMessage?.createdAt)}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={styles.conversationBottomRow}>
                                                    <Text style={[styles.conversationPreview, unreadCount > 0 && styles.conversationPreviewBold]} numberOfLines={1}>
                                                        {conversation.lastMessage?.content || "No messages yet"}
                                                    </Text>
                                                    {unreadCount > 0 && (
                                                        <View style={styles.unreadBadge}>
                                                            <Text style={styles.unreadText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                                ListEmptyComponent={() => (
                                    <View style={styles.emptyConversationState}>
                                        <MessageSquare size={40} color="#cbd5e1" />
                                        <Text style={styles.emptyConversationTitle}>No chats in this view</Text>
                                        <Text style={styles.emptyConversationSubtitle}>Try another filter or search for a teammate.</Text>
                                    </View>
                                )}
                            />
                        </View>
                    ) : (
                        <View style={styles.mainChat}>
                            <View style={styles.chatHeader}>
                                <TouchableOpacity
                                    onPress={() => setSelectedKey("")}
                                    style={styles.backButton}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <ChevronLeft size={26} color="#0f172a" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        if (selectedConversation?.kind === "group") setIsGroupPanelOpen(true);
                                        else setIsProfilePopupOpen(true);
                                    }}
                                    style={styles.chatHeaderInfo}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.chatHeaderAvatarWrapper}>
                                        <View style={styles.headerAvatarContainer}>
                                            {selectedConversation.kind === "group" ? (
                                                <Users size={18} color="#059669" />
                                            ) : selectedEmployee?.photo ? (
                                                <Image source={{ uri: selectedEmployee.photo }} style={styles.headerAvatarImage} />
                                            ) : (
                                                <Text style={styles.headerAvatarText}>
                                                    {getEmployeeLabel(selectedEmployee, "?").charAt(0).toUpperCase()}
                                                </Text>
                                            )}
                                        </View>
                                        {selectedConversation.kind === "direct" && selectedEmployee?.isOnline && (
                                            <View style={styles.headerOnlineDot} />
                                        )}
                                    </View>

                                    <View style={styles.chatHeaderTextBlock}>
                                        <Text style={styles.chatHeaderName} numberOfLines={1}>
                                            {selectedConversation.kind === "group"
                                                ? getConversationLabel(selectedConversation)
                                                : getEmployeeLabel(
                                                    employeeById[normalizeId(selectedConversation.partnerId)] || selectedEmployee,
                                                    selectedConversation.partnerId
                                                )}
                                        </Text>
                                        <Text style={[
                                            styles.chatHeaderSubtitle,
                                            selectedConversation.kind === "direct" && selectedEmployee?.isOnline && styles.chatHeaderSubtitleOnline,
                                        ]}>
                                            {selectedConversation.kind === "group"
                                                ? `${groupMembers.length} members`
                                                : selectedEmployee?.isOnline
                                                    ? "Online"
                                                    : selectedEmployee?.department || "Direct message"}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.chatHeaderActions}>
                                    <TouchableOpacity
                                        onPress={() => togglePin(selectedKey)}
                                        style={styles.headerActionBtn}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        {pinnedKeys.includes(selectedKey) ? (
                                            <PinOff size={19} color="#059669" />
                                        ) : (
                                            <Pin size={19} color="#64748b" />
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={clearCurrentChat}
                                        style={styles.headerActionBtn}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Trash2 size={19} color="#64748b" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => startCall('audio')}
                                        style={styles.headerActionBtn}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Phone size={20} color="#64748b" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => startCall('video')}
                                        style={styles.headerActionBtn}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Video size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <FlatList
                                data={reversedMessages}
                                inverted={true}
                                keyExtractor={(item, index) => item._id || `${item.senderId}-${index}`}
                                style={styles.messagesList}
                                contentContainerStyle={styles.messagesContent}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item: message }) => {
                                    const isMyMessage = normalizeId(message.senderId) === normalizeId(currentUser?.empId);
                                    const reactions = reactionsByMessage[message._id || ""] || [];

                                    return (
                                        <View style={[
                                            styles.messageRow,
                                            isMyMessage ? styles.messageRowRight : styles.messageRowLeft,
                                        ]}>
                                            {!isMyMessage && (
                                                <View style={styles.messageSenderAvatar}>
                                                    {employeeById[message.senderId]?.photo ? (
                                                        <Image
                                                            source={{ uri: employeeById[message.senderId].photo }}
                                                            style={styles.messageSenderAvatarImg}
                                                        />
                                                    ) : (
                                                        <Text style={styles.messageSenderAvatarText}>
                                                            {(message.senderName || "?").charAt(0).toUpperCase()}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}

                                            <TouchableOpacity
                                                onLongPress={() => {
                                                    if (isMyMessage) handleEditMessage(message);
                                                    else setReplyTo(message);
                                                }}
                                                activeOpacity={0.85}
                                                style={[
                                                    styles.messageBubble,
                                                    isMyMessage ? styles.messageBubbleRight : styles.messageBubbleLeft,
                                                ]}
                                            >
                                                {!isMyMessage && selectedConversation?.kind === "group" && (
                                                    <Text style={styles.bubbleSenderName}>{message.senderName}</Text>
                                                )}

                                                {message.replyTo && (
                                                    <View style={[styles.bubbleReplyPreview, isMyMessage && styles.bubbleReplyPreviewRight]}>
                                                        <Text style={styles.bubbleReplyName}>{message.replyTo.senderName}</Text>
                                                        <Text style={styles.bubbleReplyText} numberOfLines={1}>{message.replyTo.content}</Text>
                                                    </View>
                                                )}

                                                {editingMessageId === message._id ? (
                                                    <View>
                                                        <TextInput
                                                            style={styles.editInput}
                                                            value={editingText}
                                                            onChangeText={setEditingText}
                                                            autoFocus
                                                            multiline
                                                        />
                                                        <View style={styles.editActions}>
                                                            <TouchableOpacity onPress={() => setEditingMessageId("")} style={styles.editCancelBtn}>
                                                                <Text style={styles.editCancelText}>Cancel</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={saveEditedMessage} style={styles.editSaveBtn}>
                                                                <Text style={styles.editSaveText}>Save</Text>
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

                                                        {!!message.content && (
                                                            <Text
                                                                style={[styles.messageText, isMyMessage && styles.messageTextRight]}
                                                                selectable
                                                            >
                                                                {message.content}
                                                            </Text>
                                                        )}
                                                    </View>
                                                )}

                                                {reactions.length > 0 && (
                                                    <View style={styles.reactionsContainer}>
                                                        {Array.from(new Set(reactions)).map((emoji, idx) => (
                                                            <TouchableOpacity
                                                                key={`${message._id}-r-${idx}`}
                                                                style={styles.reactionBadge}
                                                                onPress={() => toggleReaction(message._id || "", emoji)}
                                                            >
                                                                <Text style={styles.reactionText}>{emoji}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                )}

                                                <View style={[styles.messageMeta, isMyMessage && styles.messageMetaRight]}>
                                                    <Text style={styles.messageTime}>
                                                        {formatTime(message.createdAt)}
                                                        {message.editedAt ? " · edited" : ""}
                                                    </Text>

                                                    {isMyMessage && (() => {
                                                        const isDirect = selectedConversation?.kind === 'direct';
                                                        const partnerId = selectedConversation?.kind === 'direct' ? selectedConversation.partnerId : null;

                                                        if (isDirect && partnerId) {
                                                            if ((message.seenBy || []).includes(partnerId))
                                                                return <CheckCheck size={13} color="#3b82f6" style={{ marginLeft: 4 }} />;
                                                            if ((message.deliveredTo || []).includes(partnerId))
                                                                return <CheckCheck size={13} color="#94a3b8" style={{ marginLeft: 4 }} />;
                                                            return <Check size={13} color="#94a3b8" style={{ marginLeft: 4 }} />;
                                                        } else if (selectedConversation?.kind === 'group') {
                                                            const recipientIds = selectedConversation.memberIds.filter(id => normalizeId(id) !== normalizeId(currentUser?.empId));
                                                            if (recipientIds.length === 0) return <Check size={13} color="#94a3b8" style={{ marginLeft: 4 }} />;
                                                            const seenCount = recipientIds.filter(id => (message.seenBy || []).includes(id)).length;
                                                            if (seenCount === recipientIds.length) return <CheckCheck size={13} color="#3b82f6" style={{ marginLeft: 4 }} />;
                                                            const deliveredCount = recipientIds.filter(id => (message.deliveredTo || []).includes(id)).length;
                                                            if (deliveredCount > 0) return <CheckCheck size={13} color="#94a3b8" style={{ marginLeft: 4 }} />;
                                                            return <Check size={13} color="#94a3b8" style={{ marginLeft: 4 }} />;
                                                        }
                                                        return <Clock size={13} color="#94a3b8" style={{ marginLeft: 4 }} />;
                                                    })()}

                                                    <View style={styles.messageActions}>
                                                        {isMyMessage && (
                                                            <TouchableOpacity
                                                                onPress={() => deleteMessage(message._id || "")}
                                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                            >
                                                                <Trash2 size={13} color="#94a3b8" />
                                                            </TouchableOpacity>
                                                        )}
                                                        <TouchableOpacity
                                                            onPress={() => handleForwardMessage(message)}
                                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                        >
                                                            <Forward size={13} color="#94a3b8" />
                                                        </TouchableOpacity>
                                                    </View>
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
                                        keyboardShouldPersistTaps="handled"
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
                                                            {getEmployeeLabel(item, "U").charAt(0).toUpperCase()}
                                                        </Text>
                                                    )}
                                                </View>
                                                <View>
                                                    <Text style={styles.mentionName}>{getEmployeeLabel(item)}</Text>
                                                    {item.department && (
                                                        <Text style={styles.mentionDept}>{item.department}</Text>
                                                    )}
                                                </View>
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
                                <View style={styles.replyBar}>
                                    <View style={styles.replyBarLeft} />
                                    <View style={styles.replyBarContent}>
                                        <Text style={styles.replyBarName}>{replyTo.senderName}</Text>
                                        <Text style={styles.replyBarText} numberOfLines={1}>
                                            {replyTo.content || "Attachment"}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setReplyTo(null)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <X size={18} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {pendingFiles.length > 0 && (
                                <View style={styles.pendingFilesContainer}>
                                    <FlatList
                                        data={pendingFiles}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        keyExtractor={(_, index) => `pending-${index}`}
                                        renderItem={({ item, index }) => (
                                            <View style={styles.pendingFileBadge}>
                                                <Paperclip size={12} color="#475569" />
                                                <Text style={styles.pendingFileText} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                <TouchableOpacity onPress={() => removePendingFile(index)}>
                                                    <X size={13} color="#dc2626" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
                                    />
                                </View>
                            )}

                            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                                <TouchableOpacity
                                    style={styles.attachBtn}
                                    onPress={handleSelectFiles}
                                    disabled={isSending || !canCurrentUserSend}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Paperclip size={21} color={canCurrentUserSend ? "#64748b" : "#cbd5e1"} />
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
                                    placeholderTextColor="#94a3b8"
                                    value={text}
                                    onChangeText={handleChatTextChange}
                                    multiline
                                    editable={canCurrentUserSend && !isSending}
                                />

                                <TouchableOpacity
                                    style={[
                                        styles.sendBtn,
                                        ((!text.trim() && pendingFiles.length === 0) || isSending || !canCurrentUserSend) && styles.sendBtnDisabled,
                                    ]}
                                    onPress={sendMessage}
                                    disabled={(!text.trim() && pendingFiles.length === 0) || isSending || !canCurrentUserSend}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.sendBtnText}>{isSending ? "..." : "Send"}</Text>
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
                                onPress={() => { if (contextMenu) togglePin(contextMenu.key); setContextMenu(null); }}
                            >
                                <Text style={[styles.primaryModalButtonText, { color: '#0f172a' }]}>
                                    {contextMenu?.isPinned ? "Unpin Chat" : "Pin Chat"}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.primaryModalButton, { backgroundColor: '#f1f5f9' }]}
                                onPress={() => { if (contextMenu) clearConversationByKey(contextMenu.key); setContextMenu(null); }}
                            >
                                <Text style={[styles.primaryModalButtonText, { color: '#0f172a' }]}>Clear Chat</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.primaryModalButton, { backgroundColor: '#fee2e2', marginBottom: 0 }]}
                                onPress={() => { if (contextMenu) deleteConversation(contextMenu.key); setContextMenu(null); }}
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
                                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                    <View style={styles.profileHeader}>
                                        {selectedEmployee.photo ? (
                                            <Image source={{ uri: selectedEmployee.photo }} style={styles.profileAvatar} />
                                        ) : (
                                            <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
                                                <Text style={styles.profileAvatarText}>
                                                    {getEmployeeLabel(selectedEmployee, "U").charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={styles.profileName}>{getEmployeeLabel(selectedEmployee)}</Text>
                                        <Text style={styles.profileDept}>{selectedEmployee.department || "No Department"}</Text>
                                    </View>
                                    <View style={styles.profileSection}>
                                        <View style={styles.profileRow}>
                                            <Text style={styles.profileLabel}>Name</Text>
                                            <View style={styles.profileValueRow}>
                                                <Text style={styles.profileValue}>{getEmployeeLabel(selectedEmployee, "-")}</Text>
                                                <TouchableOpacity onPress={() => handleCopy(getEmployeeLabel(selectedEmployee, "-"), "Name")} style={styles.copyButton}>
                                                    <Copy size={16} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <View style={styles.profileRow}>
                                            <Text style={styles.profileLabel}>Email</Text>
                                            <View style={styles.profileValueRow}>
                                                <Text style={styles.profileValue}>{selectedEmployee.mailId || selectedEmployee.email || "-"}</Text>
                                                <TouchableOpacity onPress={() => handleCopy(selectedEmployee.mailId || selectedEmployee.email || "-", "Email")} style={styles.copyButton}>
                                                    <Copy size={16} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <View style={styles.profileRow}>
                                            <Text style={styles.profileLabel}>Phone</Text>
                                            <View style={styles.profileValueRow}>
                                                <Text style={styles.profileValue}>{selectedEmployee.phoneNumber || "-"}</Text>
                                                <TouchableOpacity onPress={() => handleCopy(selectedEmployee.phoneNumber || "-", "Phone")} style={styles.copyButton}>
                                                    <Copy size={16} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.profileSection}>
                                        <View style={styles.tabRow}>
                                            {(["media", "links", "docs"] as const).map((tab) => (
                                                <TouchableOpacity key={tab} onPress={() => setProfileTab(tab)} style={[styles.tabItem, profileTab === tab && styles.tabItemActive]}>
                                                    <Text style={[styles.tabItemText, profileTab === tab && styles.tabItemTextActive]}>{tab}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        {renderSharedTabContent()}
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
                                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
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
                                                <TouchableOpacity style={styles.groupMemberIdentity} onPress={() => setSelectedGroupMemberProfile(m.employee)}>
                                                    <View style={styles.conversationAvatar}>
                                                        {m.employee?.photo ? (
                                                            <Image source={{ uri: m.employee.photo }} style={styles.avatarImage} />
                                                        ) : (
                                                            <Text style={styles.conversationAvatarText}>{getEmployeeLabel(m.employee, m.empId).charAt(0).toUpperCase()}</Text>
                                                        )}
                                                    </View>
                                                    <View style={styles.conversationContent}>
                                                        <Text style={styles.conversationName}>{getEmployeeLabel(m.employee, m.empId)}</Text>
                                                        <Text style={styles.groupMemberMeta}>{m.empId} {m.isAdmin ? "• Admin" : ""}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                                <View style={styles.groupMemberActions}>
                                                    <TouchableOpacity onPress={() => startDirectChat(m.empId)} style={styles.groupMemberActionBtn}>
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
                                                            <TouchableOpacity onPress={() => runGroupAction({ action: "remove-member", targetId: m.empId })} style={styles.groupRemoveActionBtn}>
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
                                                onPress={() => runGroupAction({ action: "update-settings", adminOnlyMessaging: !selectedGroup.adminOnlyMessaging })}
                                                style={styles.adminControlRow}
                                            >
                                                <View style={styles.adminControlLeft}>
                                                    <Shield size={16} color="#a16207" />
                                                    <Text style={styles.adminControlLabel}>Admin-only messaging</Text>
                                                </View>
                                                <Text style={styles.adminControlValue}>{selectedGroup.adminOnlyMessaging ? "On" : "Off"}</Text>
                                            </TouchableOpacity>
                                            <View style={styles.addMemberRow}>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    {addableEmployees.map((employee) => {
                                                        const empId = String(employee.empId || "");
                                                        const active = addMemberEmpId === empId;
                                                        return (
                                                            <TouchableOpacity key={empId} onPress={() => setAddMemberEmpId(empId)} style={[styles.memberPickerChip, active && styles.memberPickerChipActive]}>
                                                                <Text style={[styles.memberPickerChipText, active && styles.memberPickerChipTextActive]}>{getEmployeeLabel(employee)}</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </ScrollView>
                                                <TouchableOpacity
                                                    disabled={!addMemberEmpId || groupActionBusy}
                                                    onPress={async () => { await runGroupAction({ action: "add-members", memberIds: [addMemberEmpId] }); setAddMemberEmpId(""); }}
                                                    style={[styles.addMemberButton, (!addMemberEmpId || groupActionBusy) && styles.sendBtnDisabled]}
                                                >
                                                    <Text style={styles.addMemberButtonText}>Add member</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                    <View style={styles.profileSection}>
                                        <View style={styles.tabRow}>
                                            {(["media", "links", "docs"] as const).map((tab) => (
                                                <TouchableOpacity key={tab} onPress={() => setProfileTab(tab)} style={[styles.tabItem, profileTab === tab && styles.tabItemActive]}>
                                                    <Text style={[styles.tabItemText, profileTab === tab && styles.tabItemTextActive]}>{tab}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        {renderSharedTabContent()}
                                    </View>
                                    {selectedGroupMemberProfile && (
                                        <View style={styles.profileSection}>
                                            <View style={styles.modalHeader}>
                                                <Text style={styles.profileSectionTitle}>Member Profile</Text>
                                                <TouchableOpacity onPress={() => setSelectedGroupMemberProfile(null)}>
                                                    <X size={18} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.profileValue}>{getEmployeeLabel(selectedGroupMemberProfile, "-")}</Text>
                                            <Text style={styles.groupMemberProfileText}>{selectedGroupMemberProfile.mailId || selectedGroupMemberProfile.email || "-"}</Text>
                                            <Text style={styles.groupMemberProfileText}>{selectedGroupMemberProfile.phoneNumber || "-"}</Text>
                                            <Text style={styles.groupMemberProfileText}>{selectedGroupMemberProfile.role || selectedGroupMemberProfile.department || "-"}</Text>
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
                                <TouchableOpacity onPress={() => { setIsCreateGroupOpen(false); setNewGroupName(""); setNewGroupMemberIds([]); setNewGroupAdminOnlyMessaging(false); }}>
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                <TextInput
                                    style={styles.groupNameInput}
                                    placeholder="Group name"
                                    value={newGroupName}
                                    onChangeText={setNewGroupName}
                                />
                                <TouchableOpacity onPress={() => setNewGroupAdminOnlyMessaging((prev) => !prev)} style={styles.adminControlRow}>
                                    <View style={styles.adminControlLeft}>
                                        <Shield size={16} color="#a16207" />
                                        <Text style={styles.adminControlLabel}>Restrict messaging to admins</Text>
                                    </View>
                                    <Text style={styles.adminControlValue}>{newGroupAdminOnlyMessaging ? "On" : "Off"}</Text>
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
                                                onPress={() => setNewGroupMemberIds((prev) => selected ? prev.filter((id) => id !== empId) : [...prev, empId])}
                                                style={[styles.memberSelectRow, selected && styles.memberSelectRowActive]}
                                            >
                                                <View style={styles.memberSelectIdentity}>
                                                    <View style={styles.conversationAvatar}>
                                                        {employee.photo ? (
                                                            <Image source={{ uri: employee.photo }} style={styles.avatarImage} />
                                                        ) : (
                                                            <Text style={styles.conversationAvatarText}>{getEmployeeLabel(employee, "U").charAt(0).toUpperCase()}</Text>
                                                        )}
                                                    </View>
                                                    <View style={styles.conversationContent}>
                                                        <Text style={styles.conversationName}>{getEmployeeLabel(employee)}</Text>
                                                        <Text style={styles.groupMemberMeta}>{empId}</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.memberSelectIndicator}>{selected ? "✓ Selected" : "Select"}</Text>
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
                            <View style={styles.searchInputWrapper}>
                                <Search size={15} color="#94a3b8" style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search employees..."
                                    placeholderTextColor="#94a3b8"
                                    value={forwardSearch}
                                    onChangeText={setForwardSearch}
                                />
                            </View>
                            <FlatList
                                data={employees.filter((employee) => {
                                    if (normalizeId(employee.empId) === normalizeId(currentUser?.empId)) return false;
                                    const query = forwardSearch.trim().toLowerCase();
                                    if (!query) return true;
                                    const name = getEmployeeLabel(employee).toLowerCase();
                                    const empId = String(employee.empId || "").toLowerCase();
                                    return name.includes(query) || empId.includes(query);
                                })}
                                keyExtractor={(item) => item.empId || ""}
                                style={styles.forwardList}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.conversationItem} onPress={() => forwardToEmployee(item)}>
                                        <View style={styles.conversationAvatar}>
                                            {item.photo ? (
                                                <Image source={{ uri: item.photo }} style={styles.avatarImage} />
                                            ) : (
                                                <Text style={styles.conversationAvatarText}>{getEmployeeLabel(item, "U").charAt(0).toUpperCase()}</Text>
                                            )}
                                        </View>
                                        <Text style={styles.conversationName}>{getEmployeeLabel(item)}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </Modal>

                {!selectedKey && <FooterNav activeTab="chat" />}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
    topBarActions: {
        alignItems: "flex-end",
    },
    createGroupBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: "#d1fae5",
        backgroundColor: "#f0fdf4",
        alignItems: "center",
        justifyContent: "center",
    },
    searchContainer: {
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    searchInputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#0f172a",
        paddingVertical: 0,
    },
    searchClear: {
        padding: 4,
    },
    filterTabs: {
        paddingHorizontal: 14,
        gap: 8,
        paddingVertical: 8,
        marginBottom: -2,
    },
    filterTab: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 12,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        backgroundColor: "#f8fafc",
    },
    filterTabActive: {
        backgroundColor: "#059669",
        borderColor: "#059669",
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#475569",
    },
    filterTabTextActive: {
        color: "#ffffff",
    },
    filterBadge: {
        minWidth: 20,
        paddingHorizontal: 5,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#e2e8f0",
        alignItems: "center",
        justifyContent: "center",
    },
    filterBadgeActive: {
        backgroundColor: "rgba(255,255,255,0.25)",
    },
    filterBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#475569",
    },
    filterBadgeTextActive: {
        color: "#ffffff",
    },
    conversationList: {
        flex: 1,
        marginTop: -600,
    },
    conversationSectionTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: "#ffffff",
    },
    firstConversationSectionTitle: {
        paddingTop: 4,
    },
    conversationItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: "#ffffff",
        marginTop: 0,
    },
    conversationItemActive: {
        backgroundColor: "#f0fdf4",
    },
    avatarWrapper: {
        position: "relative",
        marginRight: 12,
    },
    conversationAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#e2e8f0",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    avatarImage: {
        width: "100%",
        height: "100%",
        borderRadius: 26,
    },
    groupAvatarIcon: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0fdf4",
    },
    conversationAvatarText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#475569",
    },
    onlineDot: {
        position: "absolute",
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#10b981",
        borderWidth: 2,
        borderColor: "#ffffff",
    },
    conversationContent: {
        flex: 1,
        justifyContent: "center",
    },
    conversationTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    conversationName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#0f172a",
        flex: 1,
        marginRight: 8,
    },
    conversationNameBold: {
        fontWeight: "700",
        color: "#0f172a",
    },
    conversationTopRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    conversationTime: {
        fontSize: 11,
        color: "#94a3b8",
        fontWeight: "500",
    },
    conversationTimeUnread: {
        color: "#059669",
        fontWeight: "700",
    },
    conversationBottomRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    conversationPreview: {
        fontSize: 13,
        color: "#94a3b8",
        flex: 1,
        marginRight: 8,
        fontWeight: "400",
    },
    conversationPreviewBold: {
        color: "#475569",
        fontWeight: "600",
    },
    unreadBadge: {
        backgroundColor: "#059669",
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    unreadText: {
        color: "#ffffff",
        fontSize: 10,
        fontWeight: "700",
    },
    emptyConversationState: {
        paddingHorizontal: 24,
        paddingTop: 60,
        alignItems: "center",
    },
    emptyConversationTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0f172a",
        marginTop: 16,
    },
    emptyConversationSubtitle: {
        fontSize: 13,
        color: "#94a3b8",
        textAlign: "center",
        marginTop: 6,
        lineHeight: 20,
    },
    mainChat: {
        flex: 1,
        backgroundColor: "#f1f5f9",
    },
    chatHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#e2e8f0",
        backgroundColor: "#ffffff",
        minHeight: 62,
    },
    backButton: {
        padding: 6,
        marginRight: 2,
        borderRadius: 8,
    },
    chatHeaderInfo: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 2,
        paddingRight: 4,
    },
    chatHeaderAvatarWrapper: {
        position: "relative",
        marginRight: 10,
    },
    headerAvatarContainer: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#f0fdf4",
        borderWidth: 1.5,
        borderColor: "#d1fae5",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    headerAvatarImage: {
        width: "100%",
        height: "100%",
    },
    headerAvatarText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#059669",
    },
    headerOnlineDot: {
        position: "absolute",
        bottom: 1,
        right: 1,
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: "#10b981",
        borderWidth: 2,
        borderColor: "#ffffff",
    },
    chatHeaderTextBlock: {
        flex: 1,
        justifyContent: "center",
    },
    chatHeaderName: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0f172a",
        letterSpacing: -0.2,
    },
    chatHeaderSubtitle: {
        fontSize: 12,
        color: "#94a3b8",
        marginTop: 1,
        fontWeight: "500",
    },
    chatHeaderSubtitleOnline: {
        color: "#10b981",
        fontWeight: "600",
    },
    chatHeaderActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
    },
    headerActionBtn: {
        padding: 8,
        borderRadius: 8,
    },
    messagesList: {
        flex: 1,
    },
    messagesContent: {
        paddingHorizontal: 12,
        paddingVertical: 16,
        gap: 10,
    },
    messageRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        width: "100%",
    },
    messageRowLeft: {
        justifyContent: "flex-start",
        paddingRight: 52,
    },
    messageRowRight: {
        justifyContent: "flex-end",
        paddingLeft: 52,
    },
    messageSenderAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "#e2e8f0",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
        marginBottom: 2,
        overflow: "hidden",
        flexShrink: 0,
    },
    messageSenderAvatarImg: {
        width: "100%",
        height: "100%",
    },
    messageSenderAvatarText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#64748b",
    },
    messageBubble: {
        maxWidth: "82%",
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 6,
    },
    messageBubbleLeft: {
        backgroundColor: "#ffffff",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#e2e8f0",
        borderBottomLeftRadius: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    messageBubbleRight: {
        backgroundColor: "#dcfce7",
        borderBottomRightRadius: 4,
    },
    bubbleSenderName: {
        fontSize: 11,
        fontWeight: "700",
        color: "#059669",
        marginBottom: 4,
    },
    bubbleReplyPreview: {
        backgroundColor: "#f1f5f9",
        borderLeftWidth: 3,
        borderLeftColor: "#94a3b8",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 5,
        marginBottom: 6,
    },
    bubbleReplyPreviewRight: {
        backgroundColor: "#bbf7d0",
        borderLeftColor: "#059669",
    },
    bubbleReplyName: {
        fontSize: 11,
        fontWeight: "700",
        color: "#059669",
        marginBottom: 2,
    },
    bubbleReplyText: {
        fontSize: 11,
        color: "#64748b",
    },
    messageText: {
        fontSize: 14,
        color: "#0f172a",
        lineHeight: 20,
    },
    messageTextRight: {
        color: "#064e3b",
    },
    editInput: {
        fontSize: 14,
        color: "#0f172a",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minHeight: 40,
        textAlignVertical: "top",
    },
    editActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 8,
        gap: 12,
    },
    editCancelBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    editCancelText: {
        color: "#ef4444",
        fontSize: 13,
        fontWeight: "600",
    },
    editSaveBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: "#059669",
        borderRadius: 8,
    },
    editSaveText: {
        color: "#ffffff",
        fontSize: 13,
        fontWeight: "700",
    },
    attachmentsContainer: {
        marginBottom: 6,
        gap: 4,
    },
    attachmentItem: {
        borderRadius: 10,
        overflow: "hidden",
    },
    attachmentImage: {
        width: 200,
        height: 180,
        resizeMode: "cover",
        borderRadius: 10,
    },
    fileAttachment: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        gap: 8,
        backgroundColor: "#f8fafc",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    fileName: {
        fontSize: 12,
        color: "#475569",
        flex: 1,
    },
    reactionsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 6,
        gap: 4,
    },
    reactionBadge: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    reactionText: {
        fontSize: 13,
    },
    messageMeta: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 5,
        gap: 4,
    },
    messageMetaRight: {
        justifyContent: "flex-end",
    },
    messageTime: {
        fontSize: 10,
        color: "#94a3b8",
        fontWeight: "500",
    },
    messageActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginLeft: 4,
    },
    replyBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e2e8f0",
        gap: 10,
    },
    replyBarLeft: {
        width: 3,
        height: 36,
        backgroundColor: "#059669",
        borderRadius: 2,
    },
    replyBarContent: {
        flex: 1,
    },
    replyBarName: {
        fontSize: 12,
        fontWeight: "700",
        color: "#059669",
        marginBottom: 2,
    },
    replyBarText: {
        fontSize: 12,
        color: "#64748b",
    },
    pendingFilesContainer: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: "#f8fafc",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e2e8f0",
    },
    pendingFileBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#e2e8f0",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        maxWidth: 180,
    },
    pendingFileText: {
        fontSize: 12,
        color: "#334155",
        flex: 1,
    },
    inputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 10,
        paddingTop: 10,
        backgroundColor: "#ffffff",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e2e8f0",
        gap: 8,
    },
    attachBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 1,
    },
    messageInput: {
        flex: 1,
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        maxHeight: 120,
        minHeight: 42,
        fontSize: 14,
        color: "#0f172a",
        textAlignVertical: "top",
    },
    sendBtn: {
        backgroundColor: "#059669",
        borderRadius: 20,
        paddingHorizontal: 18,
        height: 42,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 1,
    },
    sendBtnDisabled: {
        opacity: 0.45,
    },
    sendBtnText: {
        color: "#ffffff",
        fontWeight: "700",
        fontSize: 14,
    },
    mentionPopup: {
        position: "absolute",
        bottom: 64,
        left: 12,
        right: 12,
        backgroundColor: "#ffffff",
        borderRadius: 14,
        maxHeight: 220,
        elevation: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        zIndex: 1000,
        overflow: "hidden",
    },
    mentionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#f1f5f9",
        gap: 10,
    },
    mentionAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#e2e8f0",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    mentionAvatarText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#475569",
    },
    mentionName: {
        fontSize: 14,
        color: "#0f172a",
        fontWeight: "600",
    },
    mentionDept: {
        fontSize: 11,
        color: "#94a3b8",
        marginTop: 1,
    },
    mentionEmpty: {
        padding: 20,
        alignItems: "center",
    },
    mentionEmptyText: {
        color: "#94a3b8",
        fontSize: 13,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#ffffff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: "85%",
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
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
    modalScroll: {},
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
        fontWeight: "700",
        color: "#0f172a",
    },
    profileDept: {
        fontSize: 13,
        color: "#64748b",
        marginTop: 4,
    },
    profileSection: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e2e8f0",
        paddingVertical: 16,
    },
    profileRow: {
        marginBottom: 14,
    },
    profileLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: 0.5,
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
        flex: 1,
    },
    copyButton: {
        marginLeft: 8,
        padding: 6,
    },
    profileSectionTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#64748b",
        marginBottom: 12,
        textTransform: "uppercase",
        letterSpacing: 0.4,
    },
    tabRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
        marginBottom: 14,
    },
    tabItem: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabItemActive: {
        borderBottomColor: "#059669",
    },
    tabItemText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#94a3b8",
        textTransform: "capitalize",
    },
    tabItemTextActive: {
        color: "#059669",
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
        marginBottom: 4,
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
        fontSize: 11,
        color: "#94a3b8",
        marginTop: 3,
    },
    mediaGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    mediaItem: {
        width: "31%",
        aspectRatio: 1,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#f1f5f9",
    },
    mediaImage: {
        width: "100%",
        height: "100%",
    },
    profileEmptyText: {
        fontSize: 13,
        color: "#94a3b8",
        textAlign: "center",
        paddingVertical: 12,
    },
    groupMemberRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        paddingVertical: 8,
    },
    groupMemberIdentity: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: 10,
    },
    groupMemberMeta: {
        fontSize: 11,
        color: "#94a3b8",
        marginTop: 2,
    },
    groupMemberActions: {
        flexDirection: "row",
        gap: 6,
        flexShrink: 0,
    },
    groupMemberActionBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#ecfdf5",
    },
    groupMemberActionText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#047857",
    },
    groupAdminActionBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#eff6ff",
    },
    groupAdminActionText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#1d4ed8",
    },
    groupRemoveActionBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#fef2f2",
    },
    groupRemoveActionText: {
        fontSize: 11,
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
        marginBottom: 14,
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
        borderColor: "#e2e8f0",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: "#0f172a",
        marginBottom: 14,
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
        marginBottom: 8,
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
        gap: 10,
    },
    memberSelectIndicator: {
        fontSize: 12,
        fontWeight: "700",
        color: "#047857",
    },
    primaryModalButton: {
        marginTop: 8,
        backgroundColor: "#059669",
        borderRadius: 14,
        alignItems: "center",
        paddingVertical: 14,
        marginBottom: 8,
    },
    primaryModalButtonText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "700",
    },
    forwardModal: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "center",
        padding: 16,
    },
    forwardContent: {
        backgroundColor: "#ffffff",
        borderRadius: 20,
        maxHeight: "80%",
        padding: 16,
    },
    forwardList: {
        marginTop: 12,
    },
});
