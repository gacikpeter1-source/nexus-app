// src/firebase/chats.js
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get parent IDs for children in a list of user IDs
 * @param {Array<string>} userIds - Array of user IDs
 * @returns {Promise<Array<string>>} - Array of parent IDs
 */
const getParentIdsForChildren = async (userIds) => {
  const parentIds = [];
  
  for (const userId of userIds) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // If user is a child account (subaccount or linked), add their parents
        if (userData.parentIds && userData.parentIds.length > 0) {
          parentIds.push(...userData.parentIds);
          console.log(`👨‍👩‍👧 Auto-including ${userData.parentIds.length} parent(s) for child ${userId}`);
        }
      }
    } catch (error) {
      console.error(`Error checking if user ${userId} is a child:`, error);
    }
  }
  
  return [...new Set(parentIds)]; // Remove duplicates
};

// ============================================================================
// CHAT OPERATIONS
// ============================================================================

/**
 * Create a new chat
 * @param {Object} chatData - Chat configuration
 * @returns {Promise<string>} - Chat ID
 */
export const createChat = async (chatData) => {
  try {
    const {
      title,
      clubId = null,
      teamId = null,
      createdBy,
      members = [],
    } = chatData;

    // Combine all user IDs
    const allUserIds = [...new Set([createdBy, ...members])];
    
    // Get parent IDs for any children in the chat
    const parentIds = await getParentIdsForChildren(allUserIds);
    
    // Combine members with their parents
    const allMembers = [...new Set([...allUserIds, ...parentIds])];
    
    if (parentIds.length > 0) {
      console.log(`👨‍👩‍👧 Chat includes ${parentIds.length} parent(s) of child account(s)`);
    }

    const chat = {
      title,
      clubId,
      teamId,
      createdBy,
      members: allMembers, // Includes children AND their parents
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
      lastMessageAt: null,
      isActive: true,
    };

    const chatRef = await addDoc(collection(db, 'chats'), chat);
    console.log('✅ Chat created:', chatRef.id);
    return chatRef.id;
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    throw error;
  }
};

/**
 * Get a single chat by ID
 * @param {string} chatId - Chat ID
 * @returns {Promise<Object|null>}
 */
export const getChat = async (chatId) => {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
      return { id: chatSnap.id, ...chatSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting chat:', error);
    throw error;
  }
};

/**
 * Get all chats for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
export const getUserChats = async (userId) => {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('members', 'array-contains', userId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const chats = [];
    querySnapshot.forEach((doc) => {
      chats.push({ id: doc.id, ...doc.data() });
    });

    return chats;
  } catch (error) {
    console.error('❌ Error getting user chats:', error);
    throw error;
  }
};

/**
 * Get all chats (Admin only)
 * @returns {Promise<Array>}
 */
export const getAllChats = async () => {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));

    const querySnapshot = await getDocs(q);
    const chats = [];
    querySnapshot.forEach((doc) => {
      chats.push({ id: doc.id, ...doc.data() });
    });

    return chats;
  } catch (error) {
    console.error('❌ Error getting all chats:', error);
    throw error;
  }
};

/**
 * Get chats by team ID
 * @param {string} teamId - Team ID
 * @returns {Promise<Array>}
 */
export const getTeamChats = async (teamId) => {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('teamId', '==', teamId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const chats = [];
    querySnapshot.forEach((doc) => {
      chats.push({ id: doc.id, ...doc.data() });
    });

    return chats;
  } catch (error) {
    console.error('❌ Error getting team chats:', error);
    throw error;
  }
};

/**
 * Get chats by club ID
 * @param {string} clubId - Club ID
 * @returns {Promise<Array>}
 */
export const getClubChats = async (clubId) => {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('clubId', '==', clubId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const chats = [];
    querySnapshot.forEach((doc) => {
      chats.push({ id: doc.id, ...doc.data() });
    });

    return chats;
  } catch (error) {
    console.error('❌ Error getting club chats:', error);
    throw error;
  }
};

/**
 * Update chat details
 * @param {string} chatId - Chat ID
 * @param {Object} updates - Fields to update
 */
export const updateChat = async (chatId, updates) => {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    console.log('✅ Chat updated');
  } catch (error) {
    console.error('❌ Error updating chat:', error);
    throw error;
  }
};

/**
 * Add member to chat (also adds their parents if they're a child)
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID to add
 */
export const addChatMember = async (chatId, userId) => {
  try {
    // Get parent IDs if this user is a child
    const parentIds = await getParentIdsForChildren([userId]);
    
    // Add the user and their parents (if any)
    const usersToAdd = [userId, ...parentIds];
    
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      members: arrayUnion(...usersToAdd),
      updatedAt: serverTimestamp(),
    });
    
    if (parentIds.length > 0) {
      console.log(`✅ Member added to chat (+ ${parentIds.length} parent(s))`);
    } else {
      console.log('✅ Member added to chat');
    }
  } catch (error) {
    console.error('❌ Error adding member:', error);
    throw error;
  }
};

/**
 * Remove member from chat
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID to remove
 */
export const removeChatMember = async (chatId, userId) => {
  try {
    // Check if this user is a parent of any child in the chat
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    if (chatDoc.exists()) {
      const chatData = chatDoc.data();
      const members = chatData.members || [];
      
      // Check if any members are children of this user
      for (const memberId of members) {
        if (memberId === userId) continue; // Skip self
        
        const memberDoc = await getDoc(doc(db, 'users', memberId));
        if (memberDoc.exists()) {
          const memberData = memberDoc.data();
          if (memberData.parentIds && memberData.parentIds.includes(userId)) {
            throw new Error('Cannot remove parent while their child is in the chat');
          }
        }
      }
    }
    
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      members: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });
    console.log('✅ Member removed from chat');
  } catch (error) {
    console.error('❌ Error removing member:', error);
    throw error;
  }
};

/**
 * Close/Delete chat (soft delete)
 * @param {string} chatId - Chat ID
 */
export const closeChat = async (chatId) => {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      isActive: false,
      closedAt: serverTimestamp(),
    });
    console.log('✅ Chat closed');
  } catch (error) {
    console.error('❌ Error closing chat:', error);
    throw error;
  }
};

/**
 * Permanently delete chat and all messages
 * @param {string} chatId - Chat ID
 */
export const deleteChat = async (chatId) => {
  try {
    const batch = writeBatch(db);

    // Delete all messages
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    messagesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete chat document
    const chatRef = doc(db, 'chats', chatId);
    batch.delete(chatRef);

    await batch.commit();
    console.log('✅ Chat permanently deleted');
  } catch (error) {
    console.error('❌ Error deleting chat:', error);
    throw error;
  }
};

/**
 * Subscribe to chat updates
 * @param {string} chatId - Chat ID
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToChatUpdates = (chatId, callback) => {
  const chatRef = doc(db, 'chats', chatId);
  return onSnapshot(chatRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() });
    }
  });
};

/**
 * Subscribe to user's chats
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToUserChats = (userId, callback) => {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('members', 'array-contains', userId),
    where('isActive', '==', true),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const chats = [];
    querySnapshot.forEach((doc) => {
      chats.push({ id: doc.id, ...doc.data() });
    });
    callback(chats);
  });
};

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Send a message
 * @param {string} chatId - Chat ID
 * @param {Object} messageData - Message data
 * @returns {Promise<string>} - Message ID
 */
export const sendMessage = async (chatId, messageData) => {
  try {
    const { senderId, text, isPoll = false, pollData = null } = messageData;

    const message = {
      senderId,
      text,
      isPoll,
      pollData,
      reactions: {},
      createdAt: serverTimestamp(),
      editedAt: null,
      isDeleted: false,
    };

    // Add message to subcollection
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messageRef = await addDoc(messagesRef, message);

    // Update chat's last message
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Message sent:', messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
};

/**
 * Get messages for a chat
 * @param {string} chatId - Chat ID
 * @param {number} limit - Number of messages to fetch
 * @returns {Promise<Array>}
 */
export const getMessages = async (chatId, limit = 50) => {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(
      messagesRef,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      // limit(limit)
    );

    const querySnapshot = await getDocs(q);
    const messages = [];
    querySnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });

    return messages.reverse(); // Return in chronological order
  } catch (error) {
    console.error('❌ Error getting messages:', error);
    throw error;
  }
};

/**
 * Subscribe to messages
 * @param {string} chatId - Chat ID
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToMessages = (chatId, callback) => {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(
    messagesRef,
    where('isDeleted', '==', false),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const messages = [];
    querySnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    callback(messages);
  });
};

/**
 * Edit a message
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} newText - New message text
 */
export const editMessage = async (chatId, messageId, newText) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
      text: newText,
      editedAt: serverTimestamp(),
    });
    console.log('✅ Message edited');
  } catch (error) {
    console.error('❌ Error editing message:', error);
    throw error;
  }
};

/**
 * Delete a message (soft delete)
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 */
export const deleteMessage = async (chatId, messageId) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
    });
    console.log('✅ Message deleted');
  } catch (error) {
    console.error('❌ Error deleting message:', error);
    throw error;
  }
};

export const markMessageAsImportant = async (chatId, messageId, isImportant = true) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
      isImportant,
      markedImportantAt: isImportant ? serverTimestamp() : null,
    });
    console.log('✅ Message importance updated');
  } catch (error) {
    console.error('❌ Error marking message as important:', error);
    throw error;
  }
};

// Add this to track who read important messages
export const markImportantAsRead = async (chatId, messageId, userId) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
      [`importantReadBy.${userId}`]: serverTimestamp(),
    });
    console.log('✅ Important message marked as read');
  } catch (error) {
    console.error('❌ Error marking as read:', error);
    throw error;
  }
};

/**
 * Add emoji reaction to message
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID
 * @param {string} emoji - Emoji character
 */
export const addReaction = async (chatId, messageId, userId, emoji) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
      [`reactions.${userId}`]: emoji,
    });
    console.log('✅ Reaction added');
  } catch (error) {
    console.error('❌ Error adding reaction:', error);
    throw error;
  }
};

/**
 * Remove emoji reaction from message
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID
 */
export const removeReaction = async (chatId, messageId, userId) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
      [`reactions.${userId}`]: deleteField(),
    });
    console.log('✅ Reaction removed');
  } catch (error) {
    console.error('❌ Error removing reaction:', error);
    throw error;
  }
};

// Import deleteField
import { deleteField } from 'firebase/firestore';

/**
 * Vote on a poll
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID (poll message)
 * @param {string} userId - User ID
 * @param {number} optionIndex - Index of selected option
 */
export const voteOnPoll = async (chatId, messageId, userId, optionIndex) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      throw new Error('Message not found');
    }

    const messageData = messageSnap.data();
    if (!messageData.isPoll || !messageData.pollData) {
      throw new Error('Message is not a poll');
    }

    const pollData = { ...messageData.pollData };
    const votes = { ...(pollData.votes || {}) };

    // Remove previous vote if exists
    Object.keys(votes).forEach((key) => {
      votes[key] = votes[key].filter((id) => id !== userId);
    });

    // Add new vote
    if (!votes[optionIndex]) {
      votes[optionIndex] = [];
    }
    votes[optionIndex].push(userId);

    pollData.votes = votes;

    await updateDoc(messageRef, {
      pollData,
    });

    console.log('✅ Poll vote recorded');
  } catch (error) {
    console.error('❌ Error voting on poll:', error);
    throw error;
  }
};

/**
 * Search chats by text
 * @param {string} userId - User ID
 * @param {string} searchText - Search query
 * @returns {Promise<Array>}
 */
export const searchChats = async (userId, searchText) => {
  try {
    const chats = await getUserChats(userId);
    const lowerSearch = searchText.toLowerCase();

    return chats.filter((chat) => {
      return (
        chat.title?.toLowerCase().includes(lowerSearch) ||
        chat.lastMessage?.toLowerCase().includes(lowerSearch)
      );
    });
  } catch (error) {
    console.error('❌ Error searching chats:', error);
    throw error;
  }
};
