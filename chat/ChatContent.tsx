"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  CornerUpLeft,
  FileText,
  Forward,
  Link as LinkIcon,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Shield,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
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

const renderTextWithLinks = (text: string) => {
  const value = String(text || "");
  const parts = value.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, idx) => {
    const isUrl = /^https?:\/\/[^\s]+$/i.test(part);
    if (isUrl) {
      return (
        <a
          key={`${part}-${idx}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="underline text-emerald-700 break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={`${idx}`}>{part}</span>;
  });
};

const ChatPage = ({ centered = false, wide = false }: { centered?: boolean; wide?: boolean }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const [isGroupPanelOpen, setIsGroupPanelOpen] = useState(false);
  const [selectedGroupMemberProfile, setSelectedGroupMemberProfile] = useState<Employee | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);
  const [newGroupAdminOnlyMessaging, setNewGroupAdminOnlyMessaging] = useState(false);
  const [newGroupPhotoFile, setNewGroupPhotoFile] = useState<File | null>(null);
  const [newGroupPhotoPreview, setNewGroupPhotoPreview] = useState("");
  const [addMemberEmpId, setAddMemberEmpId] = useState("");
  const [groupPhotoFile, setGroupPhotoFile] = useState<File | null>(null);
  const [groupActionBusy, setGroupActionBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingText, setEditingText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [clearedAtByConversation, setClearedAtByConversation] = useState<Record<string, number>>({});

  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const profilePopupRef = useRef<HTMLDivElement | null>(null);

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

    // Default: show only existing chats.
    // Search mode: include all employees so user can start new chats.
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

  const mediaItems = useMemo(() => {
    return messages.flatMap((message) =>
      (message.attachments || [])
        .filter((attachment) => {
          const type = String(attachment.fileType || "").toLowerCase();
          return type.startsWith("image/") || type.startsWith("video/");
        })
        .map((attachment, index) => ({
          key: `${attachment.url}-${index}`,
          attachment,
          senderName: message.senderName,
          createdAt: message.createdAt,
        }))
    );
  }, [messages]);

  const docItems = useMemo(() => {
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
  }, [messages]);

  const sharedLinks = useMemo<LinkPreview[]>(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return messages.flatMap((message) => {
      const text = String(message.content || "");
      const found = text.match(urlRegex) || [];
      return found.map((url) => ({
        url,
        senderName: message.senderName || "",
        createdAt: message.createdAt,
      }));
    });
  }, [messages]);

  const canCurrentUserSend = useMemo(() => {
    if (!selectedConversation || !currentUser?.empId) return false;
    if (selectedConversation.kind !== "group") return true;
    if (!selectedConversation.adminOnlyMessaging) return true;
    return (selectedConversation.adminIds || []).includes(currentUser.empId);
  }, [selectedConversation, currentUser?.empId]);

  useEffect(() => {
    const empId = localStorage.getItem("userEmpId")?.trim() || "";
    const name = localStorage.getItem("userName")?.trim() || "You";
    if (!empId) return;
    setCurrentUser({ empId, name });
  }, []);

  useEffect(() => {
    if (!currentUser?.empId) return;
    try {
      const raw = localStorage.getItem(clearedStorageKey);
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
  }, [currentUser?.empId, clearedStorageKey]);

  useEffect(() => {
    if (!currentUser?.empId) return;
    localStorage.setItem(clearedStorageKey, JSON.stringify(clearedAtByConversation));
  }, [clearedAtByConversation, currentUser?.empId, clearedStorageKey]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (profilePopupRef.current && !profilePopupRef.current.contains(event.target as Node)) {
        setIsProfilePopupOpen(false);
        setIsGroupPanelOpen(false);
        setSelectedGroupMemberProfile(null);
      }
    };
    if (isProfilePopupOpen || isGroupPanelOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isProfilePopupOpen, isGroupPanelOpen]);

  useEffect(() => {
    if (!currentUser?.empId) return;

    const loadEmployees = async () => {
      try {
        const response = await fetch("/api/employees?limit=500", { cache: "no-store" });
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
          `/api/chat/conversations?userId=${encodeURIComponent(currentUser.empId)}&t=${Date.now()}`,
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
    if (!currentUser?.empId) return;

    fetch("/api/socket")
      .then(() => {
        socket = io({ path: "/api/socket" });
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
          window.dispatchEvent(new CustomEvent("chat:new-message"));
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
            ? `/api/chat/messages?groupId=${encodeURIComponent(
                selectedConversation.groupId
              )}&userId=${encodeURIComponent(currentUser.empId)}&t=${Date.now()}`
            : `/api/chat/messages?roomId=${encodeURIComponent(activeRoomId)}&senderId=${encodeURIComponent(
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
        window.dispatchEvent(
          new CustomEvent("chat:opened", {
            detail: { roomId: activeRoomId, conversation: getConversationKey(selectedConversation) },
          })
        );
      } catch (error) {
        console.error("Failed to load messages", error);
      }
    };

    loadMessages();
  }, [selectedConversation, activeRoomId, currentUser?.empId]);

  const markDelivered = async (messageIds: string[]) => {
    if (!currentUser?.empId || messageIds.length === 0) return;
    try {
      await fetch("/api/chat/messages", {
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
      await fetch("/api/chat/messages", {
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

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleCopy = async (value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      alert("Failed to copy");
    }
  };

  const handleCreateGroup = async () => {
    if (!currentUser?.empId) return;
    if (!newGroupName.trim()) {
      alert("Enter a group name");
      return;
    }
    if (newGroupMemberIds.length < 1) {
      alert("Select at least one member");
      return;
    }

    try {
      const response = await fetch("/api/chat/groups", {
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

      const createdGroupId = String(data.group._id || "");
      if (newGroupPhotoFile && createdGroupId) {
        const photoForm = new FormData();
        photoForm.append("groupId", createdGroupId);
        photoForm.append("requesterId", currentUser.empId);
        photoForm.append("photo", newGroupPhotoFile);
        const photoRes = await fetch("/api/chat/groups/photo", {
          method: "POST",
          body: photoForm,
        });
        const photoData = await photoRes.json().catch(() => ({}));
        if (!photoRes.ok || !photoData?.success) {
          throw new Error(photoData?.error || "Group created but photo upload failed");
        }
      }

      setIsCreateGroupOpen(false);
      setNewGroupName("");
      setNewGroupMemberIds([]);
      setNewGroupAdminOnlyMessaging(false);
      setNewGroupPhotoFile(null);
      setNewGroupPhotoPreview("");
      setRefreshTick((prev) => prev + 1);
      const newKey = `group:${String(data.group._id)}`;
      setSelectedKey(newKey);
    } catch (error: any) {
      alert(error?.message || "Failed to create group");
    }
  };

  const updateSelectedGroupPhoto = async () => {
    if (!selectedGroup || !currentUser?.empId || !groupPhotoFile) return;
    try {
      setGroupActionBusy(true);
      const form = new FormData();
      form.append("groupId", selectedGroup.groupId);
      form.append("requesterId", currentUser.empId);
      form.append("photo", groupPhotoFile);
      const response = await fetch("/api/chat/groups/photo", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data?.success || !data?.group) {
        throw new Error(data?.error || "Failed to update group photo");
      }
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.kind === "group" && conversation.groupId === selectedGroup.groupId
            ? { ...conversation, groupPhoto: String(data.group.photo || "") }
            : conversation
        )
      );
      setGroupPhotoFile(null);
      setRefreshTick((prev) => prev + 1);
    } catch (error: any) {
      alert(error?.message || "Failed to update group photo");
    } finally {
      setGroupActionBusy(false);
    }
  };

  const clearCurrentChat = () => {
    if (!selectedConversation) return;
    const confirmed = window.confirm("Clear this chat for you?");
    if (!confirmed) return;

    const key = getConversationKey(selectedConversation);
    setClearedAtByConversation((prev) => ({ ...prev, [key]: Date.now() }));
  };

  const startDirectChat = (partnerId: string) => {
    if (!currentUser?.empId) return;
    const normalizedPartner = String(partnerId || "").trim();
    if (!normalizedPartner) return;

    const existing = conversations.find(
      (conversation) => conversation.kind === "direct" && conversation.partnerId === normalizedPartner
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

  const runGroupAction = async (payload: Record<string, any>) => {
    if (!selectedGroup || !currentUser?.empId) return;
    setGroupActionBusy(true);
    try {
      const response = await fetch("/api/chat/groups", {
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
                memberIds: Array.isArray(updatedGroup.memberIds) ? updatedGroup.memberIds : conversation.memberIds,
                adminIds: Array.isArray(updatedGroup.adminIds) ? updatedGroup.adminIds : conversation.adminIds,
                adminOnlyMessaging: Boolean(updatedGroup?.settings?.adminOnlyMessaging),
              }
            : conversation
        )
      );

      setRefreshTick((prev) => prev + 1);
    } catch (error: any) {
      alert(error?.message || "Failed to update group");
    } finally {
      setGroupActionBusy(false);
    }
  };

  const startCall = async (mode: "audio" | "video") => {
    if (!selectedConversation || !currentUser?.empId) return;
    const featureLabel = mode === "audio" ? "Audio" : "Video";
    const join = window.confirm(`${featureLabel} call will start with an internal meeting link. Continue?`);
    if (!join) return;

    const participantIds =
      selectedConversation.kind === "group"
        ? selectedConversation.memberIds
        : [currentUser.empId, selectedConversation.partnerId];
    const conversationId =
      selectedConversation.kind === "group" ? selectedConversation.groupId : selectedConversation.partnerId;

    try {
      const response = await fetch("/api/calls", {
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

      const callUrl = `${window.location.origin}${data.url}`;

      // Post join link into the current chat so invited participants can join.
      const body: Record<string, any> = {
        roomId: activeRoomId,
        chatType: selectedConversation.kind,
        senderId: currentUser.empId,
        senderName: currentUser.name,
        content: `${featureLabel} call started. Join here: ${callUrl}`,
        attachments: [],
      };
      if (selectedConversation.kind === "group") {
        body.groupId = selectedConversation.groupId;
      } else {
        body.receiverId = selectedConversation.partnerId;
      }
      const persistRes = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const persistData = await persistRes.json();
      if (persistRes.ok && persistData?.success && persistData?.message) {
        const savedMessage: Message = persistData.message;
        setMessages((prev) => [...prev, savedMessage]);
        const recipientIds =
          selectedConversation.kind === "group"
            ? selectedConversation.memberIds.filter((id) => id !== currentUser.empId)
            : [selectedConversation.partnerId];
        socket?.emit("send-message", {
          ...savedMessage,
          roomId: activeRoomId,
          recipientIds,
        });
        window.dispatchEvent(new CustomEvent("chat:new-message"));
      }

      window.open(callUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      alert(error?.message || "Failed to start call");
    }
  };

  const sendMessage = async () => {
    if (!currentUser || !selectedConversation || !activeRoomId) return;
    if (!text.trim() && pendingFiles.length === 0) return;
    if (
      selectedConversation.kind === "group" &&
      selectedConversation.adminOnlyMessaging &&
      !(selectedConversation.adminIds || []).includes(currentUser.empId)
    ) {
      alert("Only group admins can send messages in this group.");
      return;
    }

    setIsSending(true);

    try {
      let uploadedAttachments: Attachment[] = [];

      if (pendingFiles.length > 0) {
        const formData = new FormData();
        formData.append("roomId", activeRoomId);
        pendingFiles.forEach((file) => formData.append("attachments", file));

        const uploadRes = await fetch("/api/chat/attachments", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData?.success) {
          throw new Error(uploadData?.error || "Attachment upload failed");
        }

        uploadedAttachments = uploadData.attachments || [];
      }

      const recipientIds =
        selectedConversation.kind === "group"
          ? selectedConversation.memberIds.filter((id) => id !== currentUser.empId)
          : [selectedConversation.partnerId];

      const body: Record<string, any> = {
        roomId: activeRoomId,
        chatType: selectedConversation.kind,
        senderId: currentUser.empId,
        senderName: currentUser.name,
        content: text.trim(),
        attachments: uploadedAttachments,
        replyTo: replyTo
          ? {
              messageId: replyTo._id || "",
              senderName: replyTo.senderName || "",
              content: replyTo.content || "",
            }
          : undefined,
      };

      if (selectedConversation.kind === "group") {
        body.groupId = selectedConversation.groupId;
      } else {
        body.receiverId = selectedConversation.partnerId;
      }

      const persistRes = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const persistData = await persistRes.json();
      if (!persistRes.ok || !persistData?.success || !persistData?.message) {
        throw new Error(persistData?.error || "Failed to save message");
      }

      const savedMessage: Message = persistData.message;
      setMessages((prev) => [...prev, savedMessage]);

      socket?.emit("send-message", {
        ...savedMessage,
        roomId: activeRoomId,
        recipientIds,
      });

      setText("");
      setPendingFiles([]);
      setReplyTo(null);
      setRefreshTick((prev) => prev + 1);
      window.dispatchEvent(new CustomEvent("chat:new-message"));
    } catch (error) {
      console.error("Failed to send message", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
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
      const response = await fetch("/api/chat/messages", {
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
      alert(error?.message || "Failed to edit message");
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!currentUser?.empId) return;
    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/chat/messages?messageId=${encodeURIComponent(messageId)}&userId=${encodeURIComponent(currentUser.empId)}`,
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
      alert(error?.message || "Failed to delete message");
    }
  };

  const handleForwardMessage = (message: Message) => {
    setForwardMessage(message);
    setForwardSearch("");
    setIsForwardModalOpen(true);
  };

  const forwardToEmployee = async (targetEmployee: Employee) => {
    if (!currentUser?.empId || !targetEmployee?.empId || !forwardMessage) return;
    if (normalizeId(targetEmployee.empId) === normalizeId(currentUser.empId)) {
      alert("Cannot forward to yourself.");
      return;
    }

    try {
      const roomId = makeRoomId(currentUser.empId, targetEmployee.empId);
      const content = String(forwardMessage.content || "").trim()
        ? `Forwarded: ${String(forwardMessage.content || "").trim()}`
        : "Forwarded message";

      const persistRes = await fetch("/api/chat/messages", {
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
      window.dispatchEvent(new CustomEvent("chat:new-message"));
      alert(`Message forwarded to ${targetEmployee.name}.`);
    } catch (error: any) {
      alert(error?.message || "Failed to forward message.");
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const getMyMessageStatus = (message: Message) => {
    if (!selectedConversation || !currentUser?.empId) return "Sent";

    if (selectedConversation.kind === "direct") {
      const partnerId = selectedConversation.partnerId;
      if ((message.seenBy || []).includes(partnerId)) return "Seen";
      if ((message.deliveredTo || []).includes(partnerId)) return "Delivered";
      return "Sent";
    }

    const recipientIds = selectedConversation.memberIds.filter((id) => id !== currentUser.empId);
    if (recipientIds.length === 0) return "Sent";

    const deliveredCount = recipientIds.filter((id) => (message.deliveredTo || []).includes(id)).length;
    const seenCount = recipientIds.filter((id) => (message.seenBy || []).includes(id)).length;

    if (seenCount === recipientIds.length) return `Seen ${seenCount}/${recipientIds.length}`;
    if (deliveredCount > 0) return `Delivered ${deliveredCount}/${recipientIds.length}`;
    return "Sent";
  };

  if (!currentUser?.empId) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl px-6 py-4 text-slate-700">
          User not found. Please login again.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        centered ? "h-[calc(100vh-8rem)] flex items-center justify-center" : "min-h-screen"
      }p-4 md:p-6`}
    >
      <div
        className={`${
          wide ? "max-w-[96rem]" : "max-w-7xl"
        } w-full mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden h-[84vh] grid grid-cols-1 md:grid-cols-[320px_1fr]`}
      >
        <aside className="border-b md:border-b-0 md:border-r border-slate-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Chats</h2>
            <button
              type="button"
              onClick={() => setIsCreateGroupOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Group
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employees..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-black placeholder:text-slate-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto max-h-[640px] pr-1 space-y-2">
            {sortedConversationList.map((conversation) => {
              const key = getConversationKey(conversation);
              const isActive = selectedKey === key;
              const unreadCount = Number(conversation.unreadCount || 0);

              const label =
                conversation.kind === "group"
                  ? conversation.groupName
                  : employeeById[conversation.partnerId]?.displayName ||
                    employeeById[conversation.partnerId]?.name ||
                    conversation.partnerId;

              const photo =
                conversation.kind === "group"
                  ? String(conversation.groupPhoto || "")
                  : String(employeeById[conversation.partnerId]?.photo || "");

              const preview = conversation.lastMessage
                ? String(conversation.lastMessage.content || "").trim()
                  ? String(conversation.lastMessage.content)
                  : (conversation.lastMessage.attachments || []).length > 0
                  ? `${(conversation.lastMessage.attachments || []).length} attachment${
                      (conversation.lastMessage.attachments || []).length > 1 ? "s" : ""
                    }`
                  : "Message"
                : "No messages yet";

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectConversation(conversation)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    isActive
                      ? "bg-emerald-50 border-emerald-300"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {photo ? (
                      <img
                        src={photo}
                        alt={label}
                        className="h-9 w-9 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold">
                        {conversation.kind === "group" ? (
                          <Users className="h-4 w-4" />
                        ) : (
                          label.charAt(0).toUpperCase()
                        )}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm text-slate-900 truncate">{label}</div>
                        {unreadCount > 0 && (
                          <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{preview}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex flex-col min-h-0">
          <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2 relative" ref={profilePopupRef}>
            <div>
              {!selectedConversation && <h3 className="text-base font-semibold text-slate-900">Select an employee to start chat</h3>}

              {selectedConversation && selectedConversation.kind === "direct" && (
                <button
                  type="button"
                  onClick={() => setIsProfilePopupOpen((prev) => !prev)}
                  className="text-base font-semibold text-slate-900 hover:text-emerald-700"
                >
                  {selectedEmployee?.displayName || selectedEmployee?.name || selectedConversation.partnerId}
                </button>
              )}

              {selectedConversation && selectedConversation.kind === "group" && (
                <button
                  type="button"
                  onClick={() => setIsGroupPanelOpen((prev) => !prev)}
                  className="text-base font-semibold text-slate-900 hover:text-emerald-700"
                >
                  {selectedConversation.groupName}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedConversation && (
                <>
                  <button
                    type="button"
                    onClick={() => startCall("audio")}
                    className="h-8 w-8 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                    title="Audio Call"
                  >
                    <Phone className="h-4 w-4 mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startCall("video")}
                    className="h-8 w-8 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                    title="Video Call"
                  >
                    <Video className="h-4 w-4 mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={clearCurrentChat}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Clear Chat
                  </button>
                </>
              )}
            </div>

            {isProfilePopupOpen && selectedEmployee && (
              <div className="absolute right-4 top-14 z-20 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl p-4 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center gap-3 mb-3">
                  {selectedEmployee.photo ? (
                    <img
                      src={selectedEmployee.photo}
                      alt={selectedEmployee.name}
                      className="h-11 w-11 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                      {(selectedEmployee.displayName || selectedEmployee.name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {selectedEmployee.displayName || selectedEmployee.name}
                    </div>
                    <div className="text-xs text-slate-500">{selectedEmployee.department || "-"}</div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-700">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Email</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{selectedEmployee.mailId || selectedEmployee.email || "-"}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(String(selectedEmployee.mailId || selectedEmployee.email || ""))}
                        className="text-slate-500 hover:text-slate-800"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Phone</div>
                    <div className="flex items-center justify-between gap-2">
                      <span>{selectedEmployee.phoneNumber || "-"}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(String(selectedEmployee.phoneNumber || ""))}
                        className="text-slate-500 hover:text-slate-800"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Department</div>
                    <div>{selectedEmployee.department || "-"}</div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Media</div>
                  <div className="grid grid-cols-3 gap-2">
                    {mediaItems.slice(0, 9).map((item) => (
                      <a
                        key={item.key}
                        href={item.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md overflow-hidden border border-slate-200"
                      >
                        <img src={item.attachment.url} alt={item.attachment.fileName} className="h-20 w-full object-cover" />
                      </a>
                    ))}
                    {mediaItems.length === 0 && (
                      <p className="col-span-3 text-xs text-slate-500">No shared media.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Links</div>
                  <div className="space-y-2">
                    {sharedLinks.slice(0, 10).map((entry, index) => (
                      <a
                        key={`${entry.url}-${index}`}
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md border border-slate-200 px-2 py-1.5 text-xs text-emerald-700 break-all hover:bg-slate-50"
                      >
                        <div className="inline-flex items-center gap-1">
                          <LinkIcon className="h-3.5 w-3.5" />
                          {entry.url}
                        </div>
                      </a>
                    ))}
                    {sharedLinks.length === 0 && (
                      <p className="text-xs text-slate-500">No shared links.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Docs</div>
                  <div className="space-y-2">
                    {docItems.slice(0, 10).map((item) => (
                      <a
                        key={item.key}
                        href={item.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <span className="truncate pr-2">{item.attachment.fileName}</span>
                        <FileText className="h-3.5 w-3.5 text-slate-500" />
                      </a>
                    ))}
                    {docItems.length === 0 && (
                      <p className="text-xs text-slate-500">No shared docs.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isGroupPanelOpen && selectedGroup && (
              <div className="absolute right-4 top-14 z-20 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl p-4 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{selectedGroup.groupName}</div>
                    <div className="text-xs text-slate-500">
                      {groupMembers.length} members • {(selectedGroup.adminIds || []).length} admins
                    </div>
                  </div>
                  {selectedGroup.groupPhoto ? (
                    <img
                      src={selectedGroup.groupPhoto}
                      alt={selectedGroup.groupName}
                      className="h-10 w-10 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                      {String(selectedGroup.groupName || "G").charAt(0).toUpperCase()}
                    </div>
                  )}
                  {selectedGroup.adminOnlyMessaging && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      <Shield className="h-3 w-3" />
                      Admin-only
                    </span>
                  )}
                </div>

                {isSelectedGroupAdmin && (
                  <div className="mb-3 rounded-lg border border-slate-200 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-black"
                        onChange={(event) => setGroupPhotoFile(event.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        disabled={!groupPhotoFile || groupActionBusy}
                        onClick={updateSelectedGroupPhoto}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Update Photo
                      </button>
                    </div>
                    <label className="flex items-center justify-between text-xs font-medium text-slate-700">
                      Admin-only messaging
                      <input
                        type="checkbox"
                        checked={Boolean(selectedGroup.adminOnlyMessaging)}
                        disabled={groupActionBusy}
                        onChange={(event) =>
                          runGroupAction({ action: "update-settings", adminOnlyMessaging: event.target.checked })
                        }
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={addMemberEmpId}
                        onChange={(event) => setAddMemberEmpId(event.target.value)}
                        className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-black"
                      >
                        <option value="">Add member...</option>
                        {addableEmployees.map((employee) => (
                          <option key={employee.empId} value={employee.empId}>
                            {employee.displayName || employee.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!addMemberEmpId || groupActionBusy}
                        onClick={async () => {
                          await runGroupAction({ action: "add-members", memberIds: [addMemberEmpId] });
                          setAddMemberEmpId("");
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {groupMembers.map((member) => {
                    const empId = member.empId;
                    const label =
                      member.employee?.displayName || member.employee?.name || member.employee?.empId || empId;
                    const isSelf = normalizeId(empId) === normalizeId(currentUser?.empId || "");
                    return (
                      <div key={empId} className="rounded-lg border border-slate-200 px-2 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedGroupMemberProfile(member.employee)}
                              className="text-left text-sm font-medium text-slate-900 hover:text-emerald-700"
                            >
                              {label}
                            </button>
                            <div className="text-[11px] text-slate-500">
                              {empId} {member.isAdmin ? "• Admin" : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => startDirectChat(empId)}
                                className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                Message
                              </button>
                            )}
                            {isSelectedGroupAdmin && !isSelf && (
                              <>
                                <button
                                  type="button"
                                  disabled={groupActionBusy}
                                  onClick={() => {
                                    const currentAdmins = selectedGroup.adminIds || [];
                                    const nextAdmins = member.isAdmin
                                      ? currentAdmins.filter((id) => id !== empId)
                                      : Array.from(new Set([...currentAdmins, empId]));
                                    runGroupAction({ action: "set-admins", adminIds: nextAdmins });
                                  }}
                                  className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  {member.isAdmin ? "Remove Admin" : "Make Admin"}
                                </button>
                                <button
                                  type="button"
                                  disabled={groupActionBusy}
                                  onClick={() => runGroupAction({ action: "remove-member", targetId: empId })}
                                  className="rounded border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Media</div>
                  <div className="grid grid-cols-3 gap-2">
                    {mediaItems.slice(0, 9).map((item) => (
                      <a
                        key={item.key}
                        href={item.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md overflow-hidden border border-slate-200"
                      >
                        <img src={item.attachment.url} alt={item.attachment.fileName} className="h-20 w-full object-cover" />
                      </a>
                    ))}
                    {mediaItems.length === 0 && (
                      <p className="col-span-3 text-xs text-slate-500">No shared media.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Links</div>
                  <div className="space-y-2">
                    {sharedLinks.slice(0, 10).map((entry, index) => (
                      <a
                        key={`${entry.url}-${index}`}
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md border border-slate-200 px-2 py-1.5 text-xs text-emerald-700 break-all hover:bg-slate-50"
                      >
                        <div className="inline-flex items-center gap-1">
                          <LinkIcon className="h-3.5 w-3.5" />
                          {entry.url}
                        </div>
                      </a>
                    ))}
                    {sharedLinks.length === 0 && (
                      <p className="text-xs text-slate-500">No shared links.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Docs</div>
                  <div className="space-y-2">
                    {docItems.slice(0, 10).map((item) => (
                      <a
                        key={item.key}
                        href={item.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <span className="truncate pr-2">{item.attachment.fileName}</span>
                        <FileText className="h-3.5 w-3.5 text-slate-500" />
                      </a>
                    ))}
                    {docItems.length === 0 && (
                      <p className="text-xs text-slate-500">No shared docs.</p>
                    )}
                  </div>
                </div>

                {selectedGroupMemberProfile && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="text-xs font-semibold text-slate-600">Member Profile</div>
                      <button
                        type="button"
                        onClick={() => setSelectedGroupMemberProfile(null)}
                        className="text-xs font-semibold text-red-600"
                      >
                        Close
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      {selectedGroupMemberProfile.photo ? (
                        <img
                          src={selectedGroupMemberProfile.photo}
                          alt={selectedGroupMemberProfile.name}
                          className="h-10 w-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold">
                          {String(selectedGroupMemberProfile.displayName || selectedGroupMemberProfile.name || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {selectedGroupMemberProfile.displayName || selectedGroupMemberProfile.name || "-"}
                        </div>
                        <div className="text-xs text-slate-500">{selectedGroupMemberProfile.empId || "-"}</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-500">Email:</span>{" "}
                        {selectedGroupMemberProfile.mailId || selectedGroupMemberProfile.email || "-"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Phone:</span>{" "}
                        {selectedGroupMemberProfile.phoneNumber || "-"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Role:</span>{" "}
                        {selectedGroupMemberProfile.role || selectedGroupMemberProfile.department || "-"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {selectedConversation && visibleMessages.length === 0 && (
              <p className="text-sm text-slate-500">No messages yet.</p>
            )}

            {visibleMessages.map((message, idx) => {
              const isMyMessage =
                normalizeId(message.senderId) === normalizeId(currentUser.empId);
              const canManage = isMyMessage;

              return (
                <div key={message._id || `${message.senderId}-${idx}`} className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-xl px-3 py-2 shadow-sm ${
                      isMyMessage
                        ? "bg-emerald-100 text-emerald-950"
                        : "bg-white text-slate-900 border border-slate-200"
                    }`}
                  >
                    {!isMyMessage && (
                      <div className="text-xs font-semibold text-slate-500 mb-1">
                        {selectedConversation?.kind === "group" ? (
                          <button
                            type="button"
                            onClick={() => {
                              const sender = employeeById[String(message.senderId || "").trim()];
                              if (sender) {
                                setSelectedGroupMemberProfile(sender);
                                setIsGroupPanelOpen(true);
                              }
                            }}
                            className="hover:text-emerald-700"
                          >
                            {message.senderName}
                          </button>
                        ) : (
                          message.senderName
                        )}
                      </div>
                    )}

                    {editingMessageId === message._id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          className="w-full rounded-md border border-slate-300 p-2 text-sm text-black"
                          rows={2}
                        />
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={saveEditedMessage}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId("");
                              setEditingText("");
                            }}
                            className="rounded-md border border-slate-300 px-2 py-1 text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.replyTo?.content && (
                          <div className="mb-2 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs text-slate-700">
                            Reply to {message.replyTo.senderName || "message"}: {message.replyTo.content}
                          </div>
                        )}
                        {!!message.content && (
                          <div className="whitespace-pre-wrap break-words">{renderTextWithLinks(message.content)}</div>
                        )}

                        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.attachments.map((attachment, attachmentIndex) => {
                              const isImage = String(attachment.fileType || "").startsWith("image/");
                              return (
                                <div key={`${attachment.url}-${attachmentIndex}`} className="text-sm">
                                  {isImage ? (
                                    <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
                                      <img
                                        src={attachment.url}
                                        alt={attachment.fileName}
                                        className="max-h-48 rounded-lg border border-slate-200"
                                      />
                                      <div className="text-xs mt-1 text-slate-600">{attachment.fileName}</div>
                                    </a>
                                  ) : (
                                    <a
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline text-emerald-700 break-all"
                                    >
                                      {attachment.fileName}
                                      {attachment.size ? ` (${formatFileSize(attachment.size)})` : ""}
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                      <div>
                        {formatTime(message.createdAt)}
                        {message.editedAt && " • edited"}
                      </div>

                      {isMyMessage && <div>{getMyMessageStatus(message)}</div>}
                    </div>

                    {editingMessageId !== message._id && (
                      <div className="mt-2 flex items-center gap-3 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setReplyTo(message)}
                          className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                          title="Reply"
                        >
                          <CornerUpLeft className="h-3.5 w-3.5" />
                          Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => handleForwardMessage(message)}
                          className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                          title="Forward"
                        >
                          <Forward className="h-3.5 w-3.5" />
                          Forward
                        </button>
                        {isMyMessage && canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditMessage(message)}
                              className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMessage(String(message._id || ""))}
                              className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 p-3 space-y-2">
            {replyTo && (
              <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700 flex items-start justify-between gap-2">
                <div className="truncate">
                  Replying to {replyTo.senderName || "message"}: {replyTo.content || "Attachment"}
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="text-red-600 font-semibold">
                  Cancel
                </button>
              </div>
            )}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="inline-flex items-center gap-2 text-xs bg-slate-100 border border-slate-300 rounded-full px-3 py-1"
                  >
                    <span className="max-w-[200px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      className="text-red-600 font-semibold"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.7z"
                onChange={handleSelectFiles}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                disabled={!selectedConversation || isSending || !canCurrentUserSend}
                className="h-10 w-10 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                <Paperclip className="h-4 w-4 mx-auto" />
              </button>

              <textarea
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm text-black placeholder:text-gray-600 resize-none"
                placeholder={
                  selectedConversation?.kind === "group" &&
                  selectedConversation.adminOnlyMessaging &&
                  !canCurrentUserSend
                    ? "Only admins can send messages in this group"
                    : "Type a message..."
                }
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={2}
                disabled={!selectedConversation || isSending || !canCurrentUserSend}
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={!selectedConversation || isSending || !canCurrentUserSend}
                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {isForwardModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4">
          <div className="w-[min(560px,95vw)] rounded-xl bg-white border border-slate-200 shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">Forward Message</h3>
              <button
                type="button"
                onClick={() => {
                  setIsForwardModalOpen(false);
                  setForwardMessage(null);
                  setForwardSearch("");
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={forwardSearch}
                onChange={(event) => setForwardSearch(event.target.value)}
                placeholder="Search employee..."
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-black placeholder:text-slate-500"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {employees
                .filter(
                  (employee) =>
                    normalizeId(String(employee.empId || "")) !== normalizeId(currentUser?.empId || "")
                )
                .filter((employee) => {
                  const query = forwardSearch.trim().toLowerCase();
                  if (!query) return true;
                  const name = String(employee.displayName || employee.name || "").toLowerCase();
                  const empId = String(employee.empId || "").toLowerCase();
                  return name.includes(query) || empId.includes(query);
                })
                .map((employee) => {
                  const label = employee.displayName || employee.name || String(employee.empId || "");
                  const empId = String(employee.empId || "");
                  return (
                    <button
                      key={empId}
                      type="button"
                      onClick={() => forwardToEmployee(employee)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        {employee.photo ? (
                          <img
                            src={employee.photo}
                            alt={label}
                            className="h-8 w-8 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                            {label.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{label}</div>
                          <div className="text-xs text-slate-500">{empId}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className="w-[min(560px,95vw)] rounded-xl bg-white border border-slate-200 shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">Create Group</h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateGroupOpen(false);
                  setNewGroupAdminOnlyMessaging(false);
                  setNewGroupPhotoFile(null);
                  setNewGroupPhotoPreview("");
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {newGroupPhotoPreview ? (
                  <img
                    src={newGroupPhotoPreview}
                    alt="Group preview"
                    className="h-14 w-14 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">
                    No Photo
                  </div>
                )}
                <label className="text-xs font-semibold text-slate-700">
                  Group Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="block mt-1 text-xs text-slate-600"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setNewGroupPhotoFile(file);
                      if (!file) {
                        setNewGroupPhotoPreview("");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setNewGroupPhotoPreview(String(reader.result || ""));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>

              <input
                type="text"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Group name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-black"
              />

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Select Members</p>
                <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2">
                  {employees.map((employee) => {
                    const empId = String(employee.empId || "").trim();
                    if (!empId) return null;
                    const checked = newGroupMemberIds.includes(empId);
                    return (
                      <label key={empId} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setNewGroupMemberIds((prev) => Array.from(new Set([...prev, empId])));
                            } else {
                              setNewGroupMemberIds((prev) => prev.filter((id) => id !== empId));
                            }
                          }}
                        />
                        <span>{employee.displayName || employee.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                Restrict messaging to admins only
                <input
                  type="checkbox"
                  checked={newGroupAdminOnlyMessaging}
                  onChange={(event) => setNewGroupAdminOnlyMessaging(event.target.checked)}
                />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateGroupOpen(false);
                    setNewGroupAdminOnlyMessaging(false);
                    setNewGroupPhotoFile(null);
                    setNewGroupPhotoPreview("");
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
