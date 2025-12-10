// src/pages/ChatRoom.jsx
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
} from '../firebase/chats';
import { getUser, getClub } from '../firebase/firestore';
import { isSuperAdmin } from '../utils/permissions';

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // messageId
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
        isPoll: false,
        pollData: null,
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
        text: pollData.question,
        isPoll: true,
        pollData: {
          question: pollData.question,
          options: pollData.options,
          votes: {},
        },
      });
      setShowPollCreator(false);
    } catch (error) {
      console.error('Error sending poll:', error);
      alert('Failed to send poll');
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const message = messages.find((m) => m.id === messageId);
      const currentReaction = message?.reactions?.[user.id];

      if (currentReaction === emoji) {
        // Remove reaction
        await removeReaction(chatId, messageId, user.id);
      } else {
        // Add or change reaction
        await addReaction(chatId, messageId, user.id, emoji);
      }
      setShowEmojiPicker(null);
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const handleVote = async (messageId, optionIndex) => {
    try {
      await voteOnPoll(chatId, messageId, user.id, optionIndex);
    } catch (error) {
      console.error('Error voting:', error);
      alert('Failed to vote');
    }
  };

  const handleCloseChat = async () => {
    if (!confirm('Are you sure you want to close this chat? This action cannot be undone.')) {
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

  const canCloseChat = () => {
    return isSuperAdmin(user) || chat?.createdBy === user.id;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return '';
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

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
      <div className="min-h-screen bg-dark text-light flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-light/60">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="min-h-screen bg-dark text-light flex items-center justify-center">
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

  return (
    <div className="h-screen bg-dark text-light flex flex-col">
      {/* Header */}
      <div className="bg-mid-dark border-b border-white/10 px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/chats')}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">{chat.title}</h1>
              <div className="flex gap-2 mt-1">
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
      <div className="flex-1 overflow-y-auto p-4">
        <div className="container mx-auto max-w-4xl space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-light/40">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const sender = members.find((m) => m.id === message.senderId);
              const isOwn = message.senderId === user.id;

              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Sender name */}
                    {!isOwn && (
                      <p className="text-xs text-light/60 mb-1 px-2">
                        {sender?.username || sender?.email || 'Unknown'}
                      </p>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        isOwn
                          ? 'bg-primary text-white'
                          : 'bg-mid-dark text-light'
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

                    {/* Reactions */}
                    <div className="flex items-center gap-2 mt-1 px-2">
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

                      {/* Add reaction button */}
                      <button
                        onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                        className="text-xs px-2 py-0.5 hover:bg-white/10 rounded-full transition"
                      >
                        ➕
                      </button>

                      {/* Timestamp */}
                      <span className="text-xs text-light/40">
                        {formatTimestamp(message.createdAt)}
                      </span>
                    </div>

                    {/* Emoji Picker */}
                    {showEmojiPicker === message.id && (
                      <div className="mt-2 bg-mid-dark border border-white/10 rounded-lg p-2 shadow-lg flex gap-2">
                        {['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(message.id, emoji)}
                            className="text-2xl hover:scale-125 transition"
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
      <div className="bg-mid-dark border-t border-white/10 p-4">
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
  const userVote = Object.entries(pollData.votes || {}).find(([_, votes]) => votes.includes(userId));

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
                  ? 'border-primary bg-primary/20'
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
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-light/60">{totalVotes} total votes</p>
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

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || options.some((opt) => !opt.trim())) {
      alert('Please fill in all fields');
      return;
    }

    onSubmit({
      question: question.trim(),
      options: options.map((opt) => opt.trim()),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-light">Create Poll</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-light mb-2">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter your question"
              className="w-full px-4 py-3 bg-dark border border-white/10 rounded-lg text-light placeholder-light/40 focus:outline-none focus:border-primary transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-light mb-2">Options</label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 px-4 py-2 bg-dark border border-white/10 rounded-lg text-light placeholder-light/40 focus:outline-none focus:border-primary transition"
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 text-sm text-primary hover:text-primary-dark transition"
              >
                + Add option
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-dark hover:bg-mid-dark border border-white/10 text-light rounded-lg transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium"
            >
              Create Poll
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-light">Chat Members ({members.length})</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-3 bg-dark rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white">
                  {(member.username || member.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-light">
                    {member.username || member.email}
                    {member.id === currentUserId && ' (You)'}
                    {member.id === chatCreatorId && ' 👑'}
                  </p>
                  <p className="text-xs text-light/60 capitalize">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
