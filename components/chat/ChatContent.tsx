import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { CalendarDays, ChevronLeft, Copy, Fingerprint, Forward, History as HistoryIcon, MessageSquare, Paperclip, PartyPopper, Phone, Plus, Search, Trash2, Users, Video, X } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View } from "react-native";
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
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [mentionResults, setMentionResults] = useState<Employee[]>([]);
    const [mentionLoading, setMentionLoading] = useState(false);
    const [mentionError, setMentionError] = useState("");
    const [mentionAnchor, setMentionAnchor] = useState<{ bottom: number; left: number; width: number } | null>(null);
    const [clearedAtByConversation, setClearedAtByConversation] = useState<Record<string, number>>({});
    const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, string[]>>({});
    const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
    const [forwardSearch, setForwardSearch] = useState("");
    const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
    const [groupPhotoFile, setGroupPhotoFile] = useState<any>(null);
    const [seenProfileEmployee, setSeenProfileEmployee] = useState<Employee | null>(null);
    const [profileTab, setProfileTab] = useState<"media" | "links" | "docs">("media");
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
            const id = String(employee.empId || "").trim();
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

    const handleChatTextChange = (value: string) => {
        setText(value);

        // Assuming cursor is at the end for simple logic, 
        // but robust would used onSelectionChange
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
        } catch (error: any) {
            console.error("Edit failed", error);
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
        } catch (error: any) {
            console.error("Delete failed", error);
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
        } catch (error: any) {
            console.error("Forward failed", error);
        }
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
                                                {conversation.kind === "group" ? (
                                                    <View style={styles.groupAvatarIcon}>
                                                        <Users size={20} color="#64748b" />
                                                    </View>
                                                ) : (
                                                    employeeById[conversation.partnerId]?.photo ? (
                                                        <Image 
                                                            source={{ uri: employeeById[conversation.partnerId].photo }} 
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
                                                    : employeeById[selectedConversation.partnerId]?.displayName || selectedEmployee?.name || selectedConversation.partnerId}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                                <View style={styles.callButtons}>
                                    <TouchableOpacity onPress={() => startCall('audio')} style={styles.callButton}>
                                        <Phone size={20} color="#64748b" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => startCall('video')} style={styles.callButton}>
                                        <Video size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <FlatList
                                data={visibleMessages}
                                inverted={false}
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
                                                        <Text style={[styles.messageContent, isMyMessage && { color: "#064e3b" }]}>{message.content}</Text>
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
                                                    {mentionLoading ? "Searching..." : "No results found"}
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
                                <TouchableOpacity style={styles.attachButton} onPress={handleSelectFiles} disabled={isSending}>
                                    <Paperclip size={20} color="#64748b" />
                                </TouchableOpacity>
                                <TextInput
                                    ref={messageInputRef}
                                    style={styles.messageInput}
                                    placeholder="Type a message..."
                                    value={text}
                                    onChangeText={handleChatTextChange}
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
                                            <View>
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
                                        )}

                                        {profileTab === "links" && (
                                            <View>
                                                <Text style={styles.profileEmptyText}>No shared links.</Text>
                                            </View>
                                        )}

                                        {profileTab === "docs" && (
                                            <View>
                                                <Text style={styles.profileEmptyText}>No shared documents.</Text>
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>

                {/* Group Info Modal */}
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
                                            <View key={m.empId} style={styles.conversationItem}>
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
                                                    {m.isAdmin && <Text style={{ fontSize: 10, color: '#059669' }}>Admin</Text>}
                                                </View>
                                            </View>
                                        ))}
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
                                            <View>
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
                                        )}
                                        {/* Links and Docs can follow same pattern as ProfileModal */}
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>

                {/* Forward Modal */}
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
                                data={employees.filter(e => 
                                    (e.displayName || e.name || "").toLowerCase().includes(forwardSearch.toLowerCase())
                                )}
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
    conversationPreview: {
        fontSize: 12,
        color: "#64748b",
        marginTop: -1,
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
    },
    messageWrapperRight: {
        justifyContent: "flex-end",
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
        maxWidth: "80%",
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
    // Mentions
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
    // Reply Preview
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
    // Forward Modal
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
    // Reactions
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
    // Call Styles
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
    // Online indicator
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
