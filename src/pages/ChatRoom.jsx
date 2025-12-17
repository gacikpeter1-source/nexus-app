// src/pages/ChatRoom.jsx - WITH COLORED MESSAGES AND IMPORTANT MESSAGE FEATURE
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import {
  getChat,
  subscribeToMessages,
  sendMessage,
  addReaction,
  removeReaction,
  voteOnPoll,
  addChatMember,
  removeChatMember,
  closeChat,
  markMessageAsImportant,
  markImportantAsRead,
} from '../firebase/chats';
import { getUser, getClub } from '../firebase/firestore';
import { isSuperAdmin } from '../utils/permissions';

const MESSAGE_COLORS = [
  'bg-blue-500',
  'bg-green-500', 
  'bg-purple-500',
  'bg-pink-500',
  'bg-yellow-500',
  'bg-indigo-500',
  'bg-red-500',
  'bg-teal-500',
];

export default function ChatRoom() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const { getChatById } = useChat();
  const navigate = useNavigate();

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [clubInfo, setClubInfo] = useState(null);
  const [teamInfo, setTeamInfo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const [userColors, setUserColors] = useState({});
  const [showImportantModal, setShowImportantModal] = useState(false);
  const [selectedImportantMsg, setSelectedImportantMsg] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Assign colors to users
  useEffect(() => {
    if (members.length > 0) {
      const colors = {};
      members.forEach((member, index) => {
        colors[member.id] = MESSAGE_COLORS[index % MESSAGE_COLORS.length];
      });
      setUserColors(colors);
    }
  }, [members]);

  // Load chat and subscribe to messages
  useEffect(() => {
    if (!chatId) return;

    const loadChat = async () => {
      try {
        const chatData = await getChat(chatId);
        if (!chatData) {
          navigate('/chats');
          return;
        }

        // Check if user has access
        if (!isSuperAdmin(user) && !chatData.members?.includes(user.id)) {
          alert('You do not have access to this chat');
          navigate('/chats');
          return;
        }

        setChat(chatData);

        // Load members
        const memberPromises = chatData.members.map((memberId) => getUser(memberId));
        const membersData = await Promise.all(memberPromises);
        setMembers(membersData.filter(Boolean));

        // Load club and team info
        if (chatData.clubId) {
          const club = await getClub(chatData.clubId);
          setClubInfo(club);

          if (chatData.teamId && club?.teams) {
            const team = club.teams.find((t) => t.id === chatData.teamId);
            setTeamInfo(team);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading chat:', error);
        setLoading(false);
      }
    };

    loadChat();

    // Subscribe to messages
    const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [chatId, user, navigate]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    try {
      await sendMessage(chatId, {
        senderId: user.id,
        text: messageText.trim(),
      });
      setMessageText('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  };

  const handleSendPoll = async (pollData) => {
    try {
      await sendMessage(chatId, {
        senderId: user.id,
        text: `📊 Poll: ${pollData.question}`,
        isPoll: true,
        pollData: {
          ...pollData,
          votes: {},
        },
      });
      setShowPollCreator(false);
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Failed to create poll');
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const message = messages.find((m) => m.id === messageId);
      if (!message) return;

      const currentReaction = message.reactions?.[user.id];

      if (currentReaction === emoji) {
        await removeReaction(chatId, messageId, user.id);
      } else {
        await addReaction(chatId, messageId, user.id, emoji);
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const handleVote = async (messageId, optionIndex) => {
    try {
      await voteOnPoll(chatId, messageId, user.id, optionIndex);
    } catch (error) {
      console.error('Error voting on poll:', error);
    }
  };

  const canManageImportant = () => {
    if (isSuperAdmin(user)) return true;
    if (user.role === 'admin') return true;
    if (chat?.createdBy === user.id) return true;
    
    // Check if user is trainer or assistant in the club
    if (clubInfo) {
      if (clubInfo.trainers?.includes(user.id)) return true;
      if (clubInfo.assistants?.includes(user.id)) return true;
    }
    
    return false;
  };

  const handleMarkImportant = async (messageId) => {
    try {
      await markMessageAsImportant(chatId, messageId, true);
    } catch (error) {
      console.error('Error marking important:', error);
    }
  };

  const handleMarkAsRead = async (messageId) => {
    try {
      await markImportantAsRead(chatId, messageId, user.id);
      setShowImportantModal(false);
      setSelectedImportantMsg(null);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAsLater = () => {
    setShowImportantModal(false);
    setSelectedImportantMsg(null);
  };

  const getUnreadImportantMessages = () => {
    return messages.filter(msg => 
      msg.isImportant && 
      !msg.importantReadBy?.[user.id]
    );
  };

  const canCloseChat = () => {
    if (isSuperAdmin(user)) return true;
    if (chat?.createdBy === user.id) return true;
    return false;
  };

  const handleCloseChat = async () => {
    if (!window.confirm('Are you sure you want to close this chat? This action cannot be undone.')) {
      return;
    }

    try {
      await closeChat(chatId);
      navigate('/chats');
    } catch (error) {
      console.error('Error closing chat:', error);
      alert('Failed to close chat');
    }
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const messageDate = new Date(date);
    messageDate.setHours(0, 0, 0, 0);

    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (messageDate.getTime() === today.getTime() - 86400000) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-dark text-light flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-light/60">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="fixed inset-0 bg-dark text-light flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-light/60">Chat not found</p>
          <button
            onClick={() => navigate('/chats')}
            className="mt-4 px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
          >
            Back to Chats
          </button>
        </div>
      </div>
    );
  }

  const unreadImportant = getUnreadImportantMessages();

  return (
    <div className="fixed inset-0 top-16 md:top-20 bg-dark text-light flex flex-col">
      {/* Header */}
      <div className="bg-mid-dark border-b border-white/10 px-4 py-4 flex-shrink-0">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => navigate('/chats')}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{chat.title}</h1>
              <div className="flex gap-2 mt-1 flex-wrap items-center">
                {clubInfo && (
                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                    {clubInfo.name}
                  </span>
                )}
                {teamInfo && (
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                    {teamInfo.name}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                  {members.length} members
                </span>
                
                {/* Important Messages Bubbles */}
                {unreadImportant.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedImportantMsg(unreadImportant[0]);
                      setShowImportantModal(true);
                    }}
                    className="relative px-3 py-1 bg-red-500/90 hover:bg-red-500 text-white rounded-full text-xs font-bold animate-pulse"
                  >
                    ⚠️ {unreadImportant.length} Important
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMemberList(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title="View members"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            {canCloseChat() && (
              <button
                onClick={handleCloseChat}
                className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                title="Close chat"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 pb-safe">
        <div className="container mx-auto max-w-4xl space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-light/40">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const sender = members.find((m) => m.id === message.senderId);
              const isOwn = message.senderId === user.id;
              const senderColor = userColors[message.senderId] || 'bg-gray-500';

              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Sender name with color dot */}
                    {!isOwn && (
                      <div className="flex items-center gap-2 mb-1 px-2">
                        <div className={`w-2 h-2 rounded-full ${senderColor}`}></div>
                        <p className="text-xs text-light/60">
                          {sender?.username || sender?.email || 'Unknown'}
                        </p>
                        {sender?.role === 'trainer' && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Trainer</span>
                        )}
                        {sender?.role === 'assistant' && (
                          <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">Assistant</span>
                        )}
                      </div>
                    )}

                    {/* Message bubble with colored border */}
                    <div className="relative w-full">
                      {message.isImportant && (
                        <div className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-xs">
                          ⚠️
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          message.isImportant
                            ? 'bg-orange-500/30 border-2 border-orange-400 text-white'
                            : message.isPoll
                              ? 'bg-blue-500/20 border border-blue-400/30 text-white'
                              : isOwn
                                ? 'bg-primary text-white'
                                : `bg-mid-dark text-light border-l-4 ${senderColor}`
                        }`}
                      >
                        {message.isPoll ? (
                          <PollMessage
                            message={message}
                            onVote={(optionIndex) => handleVote(message.id, optionIndex)}
                            userId={user.id}
                            members={members}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                        )}
                      </div>
                    </div>

                    {/* Reactions and actions */}
                    <div className="flex items-center gap-2 mt-1 px-2 flex-wrap">
                      {message.reactions && Object.keys(message.reactions).length > 0 && (
                        <div className="flex gap-1">
                          {Object.entries(
                            Object.values(message.reactions).reduce((acc, emoji) => {
                              acc[emoji] = (acc[emoji] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([emoji, count]) => (
                            <span
                              key={emoji}
                              className="text-xs px-2 py-0.5 bg-white/10 rounded-full cursor-pointer hover:bg-white/20"
                              onClick={() => handleReaction(message.id, emoji)}
                            >
                              {emoji} {count}
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                        className="text-xs text-light/40 hover:text-light/60"
                      >
                        +
                      </button>
                      
                      {/* Mark as important button */}
                      {canManageImportant() && !message.isImportant && (
                        <button
                          onClick={() => handleMarkImportant(message.id)}
                          className="text-xs text-red-400/60 hover:text-red-400"
                          title="Mark as important"
                        >
                          ⚠️
                        </button>
                      )}
                    </div>

                    {/* Emoji picker */}
                    {showEmojiPicker === message.id && (
                      <div className="flex gap-1 mt-1 px-2">
                        {['👍', '❤️', '😂', '😮', '😢', '🎉'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              handleReaction(message.id, emoji);
                              setShowEmojiPicker(null);
                            }}
                            className="text-xl hover:scale-125 transition"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-mid-dark border-t border-white/10 p-4 flex-shrink-0">
        <div className="container mx-auto max-w-4xl">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowPollCreator(true)}
              className="p-3 hover:bg-white/10 rounded-lg transition"
              title="Create poll"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-dark border border-white/10 rounded-lg text-light placeholder-light/40 focus:outline-none focus:border-primary transition"
            />
            <button
              type="submit"
              disabled={!messageText.trim()}
              className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Important Message Modal */}
      {showImportantModal && selectedImportantMsg && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-mid-dark rounded-lg max-w-2xl w-full p-6 border-2 border-red-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">⚠️</div>
              <div>
                <h3 className="text-xl font-bold text-red-400">Important Message</h3>
                <p className="text-sm text-light/60">
                  From: {members.find(m => m.id === selectedImportantMsg.senderId)?.username || 'Unknown'}
                </p>
              </div>
            </div>
            
            <div className="bg-dark p-4 rounded-lg mb-6 max-h-96 overflow-y-auto">
              <p className="text-light whitespace-pre-wrap break-words">
                {selectedImportantMsg.text}
              </p>
            </div>

            {unreadImportant.length > 1 && (
              <p className="text-sm text-light/60 mb-4">
                {unreadImportant.length - 1} more important message(s) pending
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleMarkAsRead(selectedImportantMsg.id)}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
              >
                ✓ Read
              </button>
              <button
                onClick={handleMarkAsLater}
                className="flex-1 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition font-medium"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showPollCreator && (
        <PollCreatorModal
          onClose={() => setShowPollCreator(false)}
          onSubmit={handleSendPoll}
        />
      )}

      {showMemberList && (
        <MemberListModal
          members={members}
          chatCreatorId={chat.createdBy}
          currentUserId={user.id}
          onClose={() => setShowMemberList(false)}
        />
      )}
    </div>
  );
}

// Poll Message Component
function PollMessage({ message, onVote, userId, members }) {
  const pollData = message.pollData;
  if (!pollData) return null;

  const totalVotes = Object.values(pollData.votes || {}).reduce((sum, votes) => sum + votes.length, 0);

  return (
    <div className="space-y-3">
      <p className="font-semibold">{pollData.question}</p>
      <div className="space-y-2">
        {pollData.options.map((option, index) => {
          const votes = pollData.votes?.[index] || [];
          const percentage = totalVotes > 0 ? (votes.length / totalVotes) * 100 : 0;
          const hasVoted = votes.includes(userId);

          return (
            <button
              key={index}
              onClick={() => onVote(index)}
              className={`w-full text-left p-3 rounded-lg border transition ${
                hasVoted
                  ? 'border-green-400 bg-green-500/20'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm">{option}</span>
                <span className="text-xs text-light/60">
                  {votes.length} ({percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-green-500 h-full rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-light/60">Total votes: {totalVotes}</p>
    </div>
  );
}

// Poll Creator Modal
function PollCreatorModal({ onClose, onSubmit }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validOptions = options.filter((opt) => opt.trim());
    if (!question.trim() || validOptions.length < 2) {
      alert('Please enter a question and at least 2 options');
      return;
    }
    onSubmit({ question: question.trim(), options: validOptions });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-light mb-4">Create Poll</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-light/80 mb-2">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What's your question?"
              className="w-full px-4 py-3 bg-dark border border-white/10 rounded-lg text-light placeholder-light/40 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-light/80 mb-2">Options</label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...options];
                    newOptions[index] = e.target.value;
                    setOptions(newOptions);
                  }}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 px-4 py-2 bg-dark border border-white/10 rounded-lg text-light placeholder-light/40 focus:outline-none focus:border-primary"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="text-sm text-primary hover:text-primary-dark"
              >
                + Add option
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-dark hover:bg-dark/80 text-light rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Member List Modal
function MemberListModal({ members, chatCreatorId, currentUserId, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-light mb-4">Members ({members.length})</h3>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-dark rounded-lg">
              <div>
                <p className="text-light font-medium">{member.username || member.email}</p>
                {member.id === chatCreatorId && (
                  <span className="text-xs text-primary">Creator</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
