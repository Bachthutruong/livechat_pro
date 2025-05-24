
// src/app/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { ChatInterface } from '@/components/chat/ChatInterface';
import type { Message, UserSession, Conversation, MessageViewerRole, AppointmentBookingFormData, AppointmentDetails } from '@/lib/types';
import {
  handleCustomerAccess,
  processUserMessage,
  getUserConversations,
  getMessagesByIds,
  updateConversationTitle,
  pinMessageToConversation,
  unpinMessageFromConversation,
  getAppSettings,
  handleBookAppointmentFromForm,
  cancelCustomerAppointment, // Added
} from './actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2, ListChecks, XCircle } from 'lucide-react';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { AppointmentBookingForm } from '@/components/chat/AppointmentBookingForm';
import { useSocket } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';


export default function HomePage() {
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  const [initialSessionFromStorage, setInitialSessionFromStorage] = useState<UserSession | null>(null);

  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [currentSuggestedReplies, setCurrentSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentDetails[]>([]); // New state for appointments


  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const appSettingsContext = useAppSettingsContext();
  const [brandName, setBrandName] = useState('AetherChat');

  const usersTypingMapRef = useRef<Record<string, string>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    const updateBrandName = async () => {
      if (appSettingsContext?.brandName) {
        setBrandName(appSettingsContext.brandName);
      } else {
        const settings = await getAppSettings();
        setBrandName(settings?.brandName || 'AetherChat');
      }
    };
    updateBrandName();
  }, [appSettingsContext]);

  const fetchPinnedMessages = useCallback(async (conversation: Conversation | null) => {
    if (!conversation || !conversation.pinnedMessageIds || conversation.pinnedMessageIds.length === 0) {
      setPinnedMessages([]);
      return;
    }
    try {
      console.log(`[Customer] Fetching pinned messages for conv ${conversation.id}:`, conversation.pinnedMessageIds);
      const fetchedPinned = await getMessagesByIds(conversation.pinnedMessageIds);
      setPinnedMessages(fetchedPinned);
    } catch (error) {
      console.error("HomePage: Error fetching pinned messages:", error);
      setPinnedMessages([]);
    }
  }, []);

  const loadInitialData = useCallback(async (session: UserSession) => {
    if (session.role !== 'customer' || !session.id) {
      setIsLoadingSession(false);
      return;
    }
    console.log("HomePage: Starting loadInitialData for session:", session.id);
    setIsLoadingSession(true);
    setHasLoadedInitialData(false);

    try {
      const result = await handleCustomerAccess(session.phoneNumber);
      console.log("HomePage: Data from handleCustomerAccess:", result);

      setCurrentUserSession(result.userSession);
      setUpcomingAppointments(result.upcomingAppointments || []); // Load upcoming appointments
      setCurrentMessages((result.initialMessages || []).map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })));
      setCurrentSuggestedReplies(result.initialSuggestedReplies || []);

      const custConvs: Conversation[] = (result.conversations || []).map((c: Conversation) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        lastMessageTimestamp: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp) : undefined,
        pinnedMessageIds: c.pinnedMessageIds || [],
      }));
      setAllConversations(custConvs);

      const primaryConversation = custConvs.find(c => c.id === result.activeConversationId) || custConvs[0] || null;
      setActiveConversation(primaryConversation);

      if (primaryConversation) {
        await fetchPinnedMessages(primaryConversation);
      }
      setHasLoadedInitialData(true);
      console.log("HomePage: loadInitialData completed. Active conversation ID:", primaryConversation?.id);
    } catch (error: any) {
      console.error("HomePage: Error in loadInitialData:", error);
      toast({ title: "Lỗi", description: `Không thể tải dữ liệu trò chuyện: ${error.message}`, variant: "destructive" });
      sessionStorage.removeItem('aetherChatUserSession');
      sessionStorage.removeItem('aetherChatPrefetchedData');
      if (router && router.replace) router.replace('/enter-phone'); else window.location.pathname = '/enter-phone';
    } finally {
      setIsLoadingSession(false);
    }
  }, [toast, router, fetchPinnedMessages]);


  useEffect(() => {
    console.log("HomePage: Initial session check effect running. Pathname:", pathname);
    setIsLoadingSession(true);
    const storedSessionString = sessionStorage.getItem('aetherChatUserSession');
    if (storedSessionString) {
      try {
        const session: UserSession = JSON.parse(storedSessionString);
        console.log("HomePage: Found session in storage:", session);
        setInitialSessionFromStorage(session);
      } catch (error) {
        console.error("HomePage: Error parsing session from sessionStorage:", error);
        sessionStorage.removeItem('aetherChatUserSession');
        sessionStorage.removeItem('aetherChatPrefetchedData');
        if (router && router.replace) router.replace('/enter-phone'); else window.location.pathname = '/enter-phone';
      }
    } else {
      console.log("HomePage: No session in storage. Current path:", pathname);
      if (pathname && !['/enter-phone', '/login', '/register'].includes(pathname)) {
        if (router && router.replace) router.replace('/enter-phone'); else window.location.pathname = '/enter-phone';
      } else {
        setIsLoadingSession(false);
      }
    }
  }, [router, pathname]);


  useEffect(() => {
    if (initialSessionFromStorage) {
      if (initialSessionFromStorage.role === 'customer') {
        setCurrentUserSession(initialSessionFromStorage); // Set current user session first

        const prefetchedDataRaw = sessionStorage.getItem('aetherChatPrefetchedData');
        if (prefetchedDataRaw && !hasLoadedInitialData) {
          try {
            const prefetchedData = JSON.parse(prefetchedDataRaw);
            if (prefetchedData.userSession && prefetchedData.userSession.id === initialSessionFromStorage.id) {
              console.log("HomePage: Using pre-fetched data for session:", initialSessionFromStorage.id);

              setUpcomingAppointments(prefetchedData.upcomingAppointments || []);
              setCurrentMessages((prefetchedData.initialMessages || []).map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })));
              setCurrentSuggestedReplies(prefetchedData.initialSuggestedReplies || []);

              const custConvs: Conversation[] = (prefetchedData.conversations || []).map((c: Conversation) => ({
                ...c,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt),
                lastMessageTimestamp: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp) : undefined,
                pinnedMessageIds: c.pinnedMessageIds || [],
              }));
              setAllConversations(custConvs);
              const primaryConv = custConvs.find(c => c.id === prefetchedData.activeConversationId) || custConvs[0] || null;
              setActiveConversation(primaryConv);

              if (primaryConv) {
                fetchPinnedMessages(primaryConv);
              }

              setHasLoadedInitialData(true);
              sessionStorage.removeItem('aetherChatPrefetchedData');
              setIsLoadingSession(false);
              return;
            } else {
              sessionStorage.removeItem('aetherChatPrefetchedData');
            }
          } catch (e) {
            console.error("HomePage: Error parsing pre-fetched data. Clearing.", e);
            sessionStorage.removeItem('aetherChatPrefetchedData');
          }
        }

        if (!hasLoadedInitialData) {
          loadInitialData(initialSessionFromStorage);
        } else {
          setIsLoadingSession(false);
        }

      } else if (initialSessionFromStorage.role === 'admin' || initialSessionFromStorage.role === 'staff') {
        setCurrentUserSession(initialSessionFromStorage);
        setIsLoadingSession(false);
      } else {
        setIsLoadingSession(false);
      }
    } else if (router && pathname && !['/enter-phone', '/login', '/register'].includes(pathname)) {
      setIsLoadingSession(false);
    }
  }, [initialSessionFromStorage, loadInitialData, router, pathname, hasLoadedInitialData, fetchPinnedMessages]);

  useEffect(() => {
    if (!currentUserSession) {
      setHasLoadedInitialData(false);
    }
  }, [currentUserSession]);


  const handlePinnedMessagesUpdated = useCallback(async (updatedConvId: string, newPinnedIds: string[]) => {
    console.log(`[Customer] Received pinnedMessagesUpdated for conv ${updatedConvId}. New IDs:`, newPinnedIds, "Current active conv ID:", activeConversation?.id);
    if (updatedConvId === activeConversation?.id) {
      setActiveConversation(prev => {
        if (prev && prev.id === updatedConvId) {
          const updatedConv = { ...prev, pinnedMessageIds: newPinnedIds || [] };
          fetchPinnedMessages(updatedConv); // Re-fetch full pinned messages based on new IDs
          return updatedConv;
        }
        return prev;
      });
    }
  }, [activeConversation, fetchPinnedMessages]);

  useEffect(() => {
    if (!socket) {
      console.log("Socket not initialized");
      return;
    }

    const handleConnect = () => console.log("Socket connected");
    const handleDisconnect = () => console.log("Socket disconnected");
    const handleConnectError = (error: Error) => {
      console.error("Socket connection error:", error);
      toast({ title: "Lỗi kết nối", description: "Không thể kết nối đến máy chủ. Đang thử kết nối lại...", variant: "destructive" });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket, toast]);

  useEffect(() => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession || currentUserSession.role !== 'customer') {
      return;
    }

    console.log(`HomePage: Customer ${currentUserSession.id} joining room: ${activeConversation.id}`);
    socket.emit('joinRoom', activeConversation.id);

    const handleNewMessage = (newMessage: Message) => {
      console.log('HomePage: Customer received new message via socket:', newMessage);
      if (newMessage.conversationId === activeConversation?.id && newMessage.userId !== currentUserSession?.id) {
        setCurrentMessages(prev => {
          if (prev.find(m => m.id === newMessage.id)) return prev;
          return [...prev, { ...newMessage, timestamp: new Date(newMessage.timestamp) }];
        });
      }
    };

    const handleSocketPinnedMessagesUpdated = ({ conversationId: updatedConvId, pinnedMessageIds: newPinnedIds }: { conversationId: string, pinnedMessageIds: string[] }) => {
      handlePinnedMessagesUpdated(updatedConvId, newPinnedIds);
    };

    const handleMessageDeleted = ({ messageId, conversationId: convId }: { messageId: string, conversationId: string }) => {
      if (convId === activeConversation?.id) {
        setCurrentMessages(prev => prev.filter(m => m.id !== messageId));
        setPinnedMessages(prev => prev.filter(pm => pm.id !== messageId));
      }
    };

    const handleMessageEdited = ({ message: editedMessage, conversationId: convId }: { message: Message, conversationId: string }) => {
      if (convId === activeConversation?.id) {
        setCurrentMessages(prev => prev.map(m => m.id === editedMessage.id ? { ...editedMessage, timestamp: new Date(editedMessage.timestamp) } : m));
        setPinnedMessages(prev => prev.map(pm => pm.id === editedMessage.id ? { ...editedMessage, timestamp: new Date(editedMessage.timestamp) } : pm));
      }
    };


    socket.on('newMessage', handleNewMessage);
    socket.on('pinnedMessagesUpdated', handleSocketPinnedMessagesUpdated);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messageEdited', handleMessageEdited);

    return () => {
      if (socket && activeConversation?.id && currentUserSession) {
        console.log(`HomePage: Customer ${currentUserSession.id} leaving room: ${activeConversation.id}`);
        socket.emit('leaveRoom', activeConversation.id);
        socket.off('newMessage', handleNewMessage);
        socket.off('pinnedMessagesUpdated', handleSocketPinnedMessagesUpdated);
        socket.off('messageDeleted', handleMessageDeleted);
        socket.off('messageEdited', handleMessageEdited);
      }
    };
  }, [socket, isConnected, activeConversation, currentUserSession, handlePinnedMessagesUpdated]);


  const handleLogout = () => {
    const currentSessionString = sessionStorage.getItem('aetherChatUserSession');
    let role: UserSession['role'] | null = null;
    if (currentSessionString) { try { role = JSON.parse(currentSessionString).role; } catch (e) { /* ignore */ } }

    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    if (socket && isConnected && activeConversation?.id && currentUserSession?.id && onTyping) { onTyping(false); }

    setCurrentUserSession(null);
    setInitialSessionFromStorage(null);
    sessionStorage.removeItem('aetherChatUserSession');
    sessionStorage.removeItem('aetherChatPrefetchedData');
    setCurrentMessages([]);
    setPinnedMessages([]);
    setCurrentSuggestedReplies([]);
    setActiveConversation(null);
    setAllConversations([]);
    setTypingUsers({});
    setUpcomingAppointments([]);
    setHasLoadedInitialData(false);

    if (role === 'admin' || role === 'staff') router.push('/login');
    else router.push('/enter-phone');
  };

  const onTyping = (isTypingStatus: boolean) => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession) return;
    if (isTypingStatus) {
      socket.emit('typing', { conversationId: activeConversation.id, userName: currentUserSession.name || `Người dùng ${currentUserSession.phoneNumber}`, userId: currentUserSession.id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socket && isConnected && activeConversation?.id && currentUserSession?.id) {
          socket.emit('stopTyping', { conversationId: activeConversation.id, userId: currentUserSession.id });
        }
      }, 1500);
    }
  };


  const handleSendMessage = async (messageContent: string) => {
    if (!currentUserSession || !activeConversation?.id) return;

    const localUserMessageId = `msg_local_user_${Date.now()}`;
    const userMessage: Message = {
      id: localUserMessageId,
      sender: 'user',
      content: messageContent,
      timestamp: new Date(),
      conversationId: activeConversation.id,
      name: currentUserSession.name || `Người dùng ${currentUserSession.phoneNumber}`,
      userId: currentUserSession.id,
    };

    setCurrentMessages((prevMessages) => [...prevMessages, userMessage]);
    setCurrentSuggestedReplies([]);
    setIsChatLoading(true);
    if (socket && isConnected && onTyping) { onTyping(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }

    try {
      const { userMessage: savedUserMessage, aiMessage, updatedAppointment } = await processUserMessage(
        messageContent,
        currentUserSession,
        activeConversation.id,
        currentMessages
      );

      setCurrentMessages((prevMessages) =>
        prevMessages.map(m => m.id === localUserMessageId ? { ...savedUserMessage, timestamp: new Date(savedUserMessage.timestamp) } : m)
      );
      setCurrentMessages(prev => [...prev, { ...aiMessage, timestamp: new Date(aiMessage.timestamp) }]);


      if (socket && isConnected) {
        socket.emit('sendMessage', { message: savedUserMessage, conversationId: activeConversation.id });
        socket.emit('sendMessage', { message: aiMessage, conversationId: activeConversation.id });
      }

      if (updatedAppointment) {
        toast({
          title: "Cập nhật lịch hẹn",
          description: `Dịch vụ: ${updatedAppointment.service}, Ngày: ${updatedAppointment.date}, Giờ: ${updatedAppointment.time}, Trạng thái: ${updatedAppointment.status}`,
        });
        // Refresh upcoming appointments
        const currentAppointments = await AppointmentModel.find({
          customerId: currentUserSession.id,
          status: { $nin: ['cancelled', 'completed'] },
          date: { $gte: dateFnsFormat(new Date(), 'yyyy-MM-dd') }
        }).sort({ date: 1, time: 1 }).populate('customerId staffId').lean();
        setUpcomingAppointments(currentAppointments.map(transformAppointmentDocToDetails));
      }

    } catch (error: any) {
      console.error("Lỗi xử lý tin nhắn:", error);
      setCurrentMessages((prevMessages) => prevMessages.filter(m => m.id !== localUserMessageId)); // Remove optimistic message on error
      const errorMessage: Message = {
        id: `msg_error_${Date.now()}`,
        sender: 'system',
        content: 'Xin lỗi, tôi gặp lỗi. Vui lòng thử lại.',
        timestamp: new Date(),
        conversationId: activeConversation.id,
      };
      setCurrentMessages((prevMessages) => [...prevMessages, errorMessage]);
      toast({ title: "Lỗi tin nhắn", description: "Không thể xử lý tin nhắn của bạn. Vui lòng thử lại.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handlePinRequested = async (messageId: string) => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession) return;
    try {
      socket.emit('pinMessageRequested', {
        conversationId: activeConversation.id,
        messageId,
        userSessionJsonString: JSON.stringify(currentUserSession)
      });
    } catch (error: any) {
      toast({ title: "Lỗi Ghim", description: error.message || "Không thể ghim tin nhắn.", variant: "destructive" });
    }
  };

  const handleUnpinRequested = async (messageId: string) => {
    if (!socket || !isConnected || !activeConversation?.id || !currentUserSession) return;
    try {
      socket.emit('unpinMessageRequested', {
        conversationId: activeConversation.id,
        messageId,
        userSessionJsonString: JSON.stringify(currentUserSession)
      });
    } catch (error: any) {
      toast({ title: "Lỗi Bỏ Ghim", description: error.message || "Không thể bỏ ghim tin nhắn.", variant: "destructive" });
    }
  };

  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-yellow-200', 'dark:bg-yellow-700', 'transition-all', 'duration-1000');
      setTimeout(() => {
        element.classList.remove('bg-yellow-200', 'dark:bg-yellow-700');
      }, 2000);
    }
  };

  const handleDirectBookAppointment = async (formData: AppointmentBookingFormData) => {
    if (!currentUserSession || !activeConversation?.id) return;
    setIsChatLoading(true);
    try {
      const result = await handleBookAppointmentFromForm({ ...formData, customerId: currentUserSession.id });
      toast({
        title: result.success ? "Thành công" : "Thất bại",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });

      let systemMessageContent = result.message;
      if (!result.success && result.suggestedSlots && result.suggestedSlots.length > 0) {
        systemMessageContent += "\nCác khung giờ gợi ý khác:\n" +
          result.suggestedSlots.map(s => `- ${s.date} lúc ${s.time}`).join("\n");
      }

      const systemMessage: Message = {
        id: `msg_system_booking_${Date.now()}`,
        sender: 'system',
        content: systemMessageContent,
        timestamp: new Date(),
        conversationId: activeConversation.id,
      };
      setCurrentMessages(prev => [...prev, systemMessage]);
      if (socket && isConnected) {
        socket.emit('sendMessage', { message: systemMessage, conversationId: activeConversation.id });
      }
      if (result.success && result.appointment) {
        setIsBookingModalOpen(false);
        setUpcomingAppointments(prev => [...prev, result.appointment!].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.time.localeCompare(b.time)));
      }

    } catch (error: any) {
      toast({ title: "Lỗi đặt lịch", description: error.message || "Không thể đặt lịch hẹn.", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!currentUserSession) return;
    try {
      const result = await cancelCustomerAppointment(appointmentId, currentUserSession.id);
      toast({
        title: result.success ? "Hủy thành công" : "Lỗi",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
      if (result.success) {
        setUpcomingAppointments(prev => prev.map(appt =>
          appt.appointmentId === appointmentId ? { ...appt, status: 'cancelled' } : appt
        ));
      }
    } catch (error: any) {
      toast({ title: "Lỗi hủy lịch", description: error.message || "Không thể hủy lịch hẹn.", variant: "destructive" });
    }
  };

  const renderCustomerChatInterface = () => {
    if (!currentUserSession || !activeConversation?.id) {
      return <div className="flex-grow flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    return (
      <ChatInterface
        userSession={currentUserSession}
        conversations={allConversations} // Assuming this is managed for a potential sidebar (though hidden for customer)
        activeConversation={activeConversation}
        messages={currentMessages}
        pinnedMessages={pinnedMessages}
        suggestedReplies={currentMessages.length <= 1 && initialSessionFromStorage?.id === currentUserSession.id ? currentSuggestedReplies : []} // Only show initial suggestions
        onSendMessage={handleSendMessage}
        onSelectConversation={() => {}} // Not used by customer view
        isChatLoading={isChatLoading || isLoadingSession}
        viewerRole="customer_view"
        onPinRequested={handlePinRequested}
        onUnpinRequested={handleUnpinRequested}
        onScrollToMessage={handleScrollToMessage}
        onBookAppointmentClick={() => setIsBookingModalOpen(true)}
        onTyping={onTyping}
        typingUsers={typingUsers}
      />
    );
  };

  const renderUpcomingAppointments = () => {
    if (!currentUserSession || currentUserSession.role !== 'customer') return null;
    const displayableAppointments = upcomingAppointments.filter(appt => appt.status !== 'cancelled' && appt.status !== 'completed');

    if (displayableAppointments.length === 0) {
      return (
        <Card className="my-4 mx-auto md:max-w-screen-lg w-full shadow-none border-none">
          <CardHeader>
            <CardTitle className="text-lg flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" />Lịch hẹn sắp tới của bạn</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Bạn chưa có lịch hẹn nào sắp tới.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="my-4 mx-auto md:max-w-screen-lg w-full shadow-none border-none">
        <CardHeader>
          <CardTitle className="text-lg flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" />Lịch hẹn sắp tới của bạn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {displayableAppointments.map(appt => (
            <div key={appt.appointmentId} className="p-3 border rounded-md bg-muted/50 text-sm">
              <p className="font-semibold">{appt.service}</p>
              <p>Thời gian: {appt.time} - {format(dateFnsParseISO(appt.date), 'dd/MM/yyyy', { locale: vi })}</p>
              {appt.branch && <p>Chi nhánh: {appt.branch}</p>}
              <p>Trạng thái: <span className="font-medium text-primary">{appt.status === 'booked' ? 'Đã đặt' : appt.status === 'pending_confirmation' ? 'Chờ xác nhận' : appt.status}</span></p>
              {(appt.status === 'booked' || appt.status === 'pending_confirmation') && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="mt-2 text-xs h-7 px-2">
                      <XCircle className="mr-1 h-3 w-3" /> Hủy hẹn
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xác nhận hủy lịch hẹn</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bạn có chắc chắn muốn hủy lịch hẹn cho dịch vụ "{appt.service}" vào lúc {appt.time} ngày {format(dateFnsParseISO(appt.date), 'dd/MM/yyyy', { locale: vi })}?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Không</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCancelAppointment(appt.appointmentId)}>Đồng ý hủy</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };


  const renderContent = () => {
    if (isLoadingSession || (!initialSessionFromStorage && (pathname && !['/enter-phone', '/login', '/register'].includes(pathname)))) {
      return (
        <div className="flex flex-col items-center justify-center h-full flex-grow">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Đang tải {brandName}...</p>
        </div>
      );
    }

    if (currentUserSession) {
      if (currentUserSession.role === 'admin') {
        return (
          <Card className="w-full max-w-md text-center shadow-xl mx-auto my-auto">
            <CardHeader>
              <CardTitle>Truy cập Admin</CardTitle>
              <CardDescription>Chào mừng, {currentUserSession.name || 'Admin'}.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Bạn đã đăng nhập với tư cách Admin.</p>
              <Button asChild>
                <Link href="/admin/dashboard">
                  <LogIn className="mr-2 h-4 w-4" /> Đến Bảng điều khiển Admin
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      }

      if (currentUserSession.role === 'staff') {
        return (
          <Card className="w-full max-w-md text-center shadow-xl mx-auto my-auto">
            <CardHeader>
              <CardTitle>Truy cập Nhân viên</CardTitle>
              <CardDescription>Chào mừng, {currentUserSession.name || 'Nhân viên'}.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Bạn đã đăng nhập với tư cách Nhân viên.</p>
              <Button asChild>
                <Link href="/staff/dashboard">
                  <LogIn className="mr-2 h-4 w-4" /> Đến Bảng điều khiển Nhân viên
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      }
      // Customer View
      return (
         <div className="flex flex-col w-full h-full">
          {renderCustomerChatInterface()}
          {renderUpcomingAppointments()}
        </div>
      );
    }

    if (pathname && !['/enter-phone', '/login', '/register'].includes(pathname)) {
      return (
        <div className="flex-grow flex items-center justify-center p-4">
          <p className="text-muted-foreground">Đang chuyển hướng hoặc có lỗi xảy ra...</p>
        </div>
      )
    }
    return null;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background h-screen">
      <AppHeader userSession={currentUserSession} onLogout={handleLogout} />
      <main className={cn(
        "flex-grow flex items-stretch w-full overflow-hidden pt-16",
         currentUserSession?.role === 'customer' ? "h-[calc(100vh-4rem)] md:max-w-screen-lg md:mx-auto flex-col" : "h-auto items-center justify-center"
      )}>
        {renderContent()}
      </main>
      {currentUserSession?.role === 'customer' && activeConversation?.id && (
        <AppointmentBookingForm
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          onSubmit={handleDirectBookAppointment}
          currentUserSession={currentUserSession}
        />
      )}
      {currentUserSession?.role === 'customer' && <AppFooter /> }
    </div>
  );
}
```