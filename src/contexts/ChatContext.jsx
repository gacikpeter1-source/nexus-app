// src/contexts/ChatContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  getUserChats,
  getAllChats,
  subscribeToUserChats,
  createChat as createChatFirebase,
  getChat,
  sendMessage as sendMessageFirebase,
  addChatMember,
  removeChatMember,
  closeChat as closeChatFirebase,
  deleteChat as deleteChatFirebase,
} from '../firebase/chats';
import { isSuperAdmin } from '../utils/permissions';

const ChatContext = createContext(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Load chats on mount and subscribe to updates
  useEffect(() => {
    if (!user) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribe;

    const loadChats = async () => {
      try {
        // SuperAdmin/Admin sees all chats
        if (isSuperAdmin(user)) {
          const allChats = await getAllChats();
          setChats(allChats);
          setLoading(false); 
        } else {
          // Subscribe to user's chats for real-time updates
          unsubscribe = subscribeToUserChats(user.id, (userChats) => {
            setChats(userChats);
            setLoading(false);
          });
        }
        setError(null);
      } catch (err) {
        console.error('Error loading chats:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadChats();

    // Cleanup subscription
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  /**
   * Create a new chat
   */
  const createChat = async (chatData) => {
    try {
      const chatId = await createChatFirebase({
        ...chatData,
        createdBy: user.id,
      });

      return { ok: true, chatId };
    } catch (error) {
      console.error('Error creating chat:', error);
      return { ok: false, message: 'Failed to create chat' };
    }
  };

  /**
   * Send a message
   */
  const sendMessage = async (chatId, text, isPoll = false, pollData = null) => {
    try {
      await sendMessageFirebase(chatId, {
        senderId: user.id,
        text,
        isPoll,
        pollData,
      });

      return { ok: true };
    } catch (error) {
      console.error('Error sending message:', error);
      return { ok: false, message: 'Failed to send message' };
    }
  };

  /**
   * Add member to chat
   */
  const addMember = async (chatId, userId) => {
    try {
      await addChatMember(chatId, userId);
      return { ok: true };
    } catch (error) {
      console.error('Error adding member:', error);
      return { ok: false, message: 'Failed to add member' };
    }
  };

  /**
   * Remove member from chat
   */
  const removeMember = async (chatId, userId) => {
    try {
      await removeChatMember(chatId, userId);
      return { ok: true };
    } catch (error) {
      console.error('Error removing member:', error);
      return { ok: false, message: 'Failed to remove member' };
    }
  };

  /**
   * Close chat
   */
  const closeChat = async (chatId) => {
    try {
      await closeChatFirebase(chatId);
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));
      return { ok: true };
    } catch (error) {
      console.error('Error closing chat:', error);
      return { ok: false, message: 'Failed to close chat' };
    }
  };

  /**
   * Delete chat permanently
   */
  const deleteChat = async (chatId) => {
    try {
      await deleteChatFirebase(chatId);
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));
      return { ok: true };
    } catch (error) {
      console.error('Error deleting chat:', error);
      return { ok: false, message: 'Failed to delete chat' };
    }
  };

  /**
   * Get chat by ID
   */
  const getChatById = (chatId) => {
    return chats.find((chat) => chat.id === chatId);
  };

  /**
   * Search chats
   */
  const searchChats = (searchText) => {
    const lowerSearch = searchText.toLowerCase();
    return chats.filter((chat) => {
      return (
        chat.title?.toLowerCase().includes(lowerSearch) ||
        chat.lastMessage?.toLowerCase().includes(lowerSearch)
      );
    });
  };

  const value = {
    chats,
    loading,
    error,
    createChat,
    sendMessage,
    addMember,
    removeMember,
    closeChat,
    deleteChat,
    getChatById,
    searchChats,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
