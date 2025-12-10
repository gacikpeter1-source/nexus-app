// src/pages/Chats.jsx - WITH MANAGE & DELETE BUTTONS
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { getClub, getUser, getAllUsers } from '../firebase/firestore';
import { isSuperAdmin } from '../utils/permissions';
import { addChatMember, removeChatMember } from '../firebase/chats';

export default function Chats() {
  const { user } = useAuth();
  const { chats, loading, createChat, deleteChat } = useChat();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [filteredChats, setFilteredChats] = useState([]);
  const [chatDetails, setChatDetails] = useState({});

  // Load chat details (club, team info)
  useEffect(() => {
    const loadChatDetails = async () => {
      const details = {};

      for (const chat of chats) {
        details[chat.id] = {
          clubName: null,
          teamName: null,
          memberCount: chat.members?.length || 0,
        };

        // Load club name
        if (chat.clubId) {
          try {
            const club = await getClub(chat.clubId);
            if (club) {
              details[chat.id].clubName = club.name;

              // Load team name
              if (chat.teamId && club.teams) {
                const team = club.teams.find((t) => t.id === chat.teamId);
                if (team) {
                  details[chat.id].teamName = team.name;
                }
              }
            }
          } catch (error) {
            console.error('Error loading club:', error);
          }
        }
      }

      setChatDetails(details);
    };

    if (chats.length > 0) {
      loadChatDetails();
    }
  }, [chats]);

  // Filter chats based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = chats.filter((chat) => {
        const details = chatDetails[chat.id];
        return (
          chat.title?.toLowerCase().includes(lowerQuery) ||
          details?.clubName?.toLowerCase().includes(lowerQuery) ||
          details?.teamName?.toLowerCase().includes(lowerQuery) ||
          chat.lastMessage?.toLowerCase().includes(lowerQuery)
        );
      });
      setFilteredChats(filtered);
    }
  }, [searchQuery, chats, chatDetails]);

  const handleChatClick = (chatId) => {
    navigate(`/chat/${chatId}`);
  };

  const canManageChat = (chat) => {
    return isSuperAdmin(user) || chat.createdBy === user.id;
  };

  const handleManageChat = (chat, e) => {
    e.stopPropagation();
    setSelectedChat(chat);
    setShowManageModal(true);
  };

  const handleDeleteChat = async (chat, e) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${chat.title}"? This cannot be undone.`)) {
      return;
    }

    const result = await deleteChat(chat.id);
    if (result.ok) {
      alert('Chat deleted successfully');
    } else {
      alert('Failed to delete chat');
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return '';
    }

    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString();
    } else if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark text-light flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-light/60">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-light">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-light">Chats</h1>
            <p className="text-light/60 mt-1">
              {isSuperAdmin(user)
                ? 'All conversations (Admin View)'
                : 'Your conversations'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Chat
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats by title, club, or team..."
              className="w-full px-4 py-3 pl-12 bg-mid-dark border border-white/10 rounded-lg text-light placeholder-light/40 focus:outline-none focus:border-primary transition"
            />
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-light/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Chat List */}
        <div className="space-y-3">
          {filteredChats.length === 0 ? (
            <div className="bg-mid-dark rounded-lg p-12 text-center">
              <svg
                className="w-16 h-16 text-light/20 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-light/60">
                {searchQuery ? 'No chats found' : 'No chats yet'}
              </p>
              {!searchQuery && (
                <p className="text-light/40 text-sm mt-2">
                  Create a new chat to get started
                </p>
              )}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const details = chatDetails[chat.id] || {};
              const canManage = canManageChat(chat);
              
              return (
                <div
                  key={chat.id}
                  className="bg-mid-dark hover:bg-mid-dark/80 border border-white/10 rounded-lg p-4 cursor-pointer transition group"
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 min-w-0"
                      onClick={() => handleChatClick(chat.id)}
                    >
                      {/* Title */}
                      <h3 className="text-lg font-semibold text-light group-hover:text-primary transition truncate">
                        {chat.title}
                      </h3>

                      {/* Club & Team Info */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {details.clubName && (
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                            🏢 {details.clubName}
                          </span>
                        )}
                        {details.teamName && (
                          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                            👥 {details.teamName}
                          </span>
                        )}
                        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                          {details.memberCount} {details.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>

                      {/* Last Message */}
                      {chat.lastMessage && (
                        <p className="text-sm text-light/60 mt-2 truncate">
                          {chat.lastMessage}
                        </p>
                      )}
                    </div>

                    {/* Actions & Timestamp */}
                    <div className="ml-4 flex flex-col items-end gap-2">
                      <div className="text-xs text-light/40 whitespace-nowrap">
                        {formatTimestamp(chat.lastMessageAt || chat.updatedAt)}
                      </div>
                      
                      {canManage && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => handleManageChat(chat, e)}
                            className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition"
                            title="Manage members"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDeleteChat(chat, e)}
                            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                            title="Delete chat"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modals */}
        {showCreateModal && (
          <CreateChatModal
            user={user}
            onClose={() => setShowCreateModal(false)}
            onCreate={async (chatData) => {
              const result = await createChat(chatData);
              if (result.ok) {
                setShowCreateModal(false);
                navigate(`/chat/${result.chatId}`);
              }
            }}
          />
        )}

        {showManageModal && selectedChat && (
          <ManageChatModal
            chat={selectedChat}
            user={user}
            onClose={() => {
              setShowManageModal(false);
              setSelectedChat(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Manage Chat Modal Component
function ManageChatModal({ chat, user, onClose }) {
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersData, membersData] = await Promise.all([
          getAllUsers(),
          Promise.all(chat.members.map(id => getUser(id)))
        ]);

        setMembers(membersData.filter(Boolean));
        setAllUsers(usersData.filter(u => !chat.members.includes(u.id)));
        setFilteredUsers(usersData.filter(u => !chat.members.includes(u.id)));
        setLoading(false);
      } catch (error) {
        console.error('Error loading users:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [chat]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(allUsers);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = allUsers.filter((u) => {
        const username = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return username.includes(lowerQuery) || email.includes(lowerQuery);
      });
      setFilteredUsers(filtered);
    }
  }, [searchQuery, allUsers]);

  const handleAddMember = async (userId) => {
    try {
      await addChatMember(chat.id, userId);
      
      // Update local state
      const userToAdd = allUsers.find(u => u.id === userId);
      if (userToAdd) {
        setMembers([...members, userToAdd]);
        setAllUsers(allUsers.filter(u => u.id !== userId));
        setFilteredUsers(filteredUsers.filter(u => u.id !== userId));
      }
      
      alert('Member added successfully');
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (userId === chat.createdBy) {
      alert('Cannot remove the chat creator');
      return;
    }

    if (!confirm('Remove this member from the chat?')) return;

    try {
      await removeChatMember(chat.id, userId);
      
      // Update local state
      const userToRemove = members.find(m => m.id === userId);
      if (userToRemove) {
        setMembers(members.filter(m => m.id !== userId));
        setAllUsers([...allUsers, userToRemove]);
        setFilteredUsers([...filteredUsers, userToRemove]);
      }
      
      alert('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-light">Manage Chat Members</h2>
          <p className="text-sm text-light/60 mt-1">{chat.title}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Current Members */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-light mb-3">Current Members ({members.length})</h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-dark rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white">
                      {(member.username || member.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-light">
                        {member.username || member.email}
                        {member.id === chat.createdBy && ' 👑'}
                      </p>
                      <p className="text-xs text-light/60 capitalize">{member.role}</p>
                    </div>
                  </div>
                  {member.id !== chat.createdBy && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add Members */}
          <div>
            <h3 className="text-lg font-semibold text-light mb-3">Add Members</h3>
            
            {/* Search */}
            <div className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full px-4 py-2 pl-10 bg-dark border border-white/10 rounded-lg text-light text-sm placeholder-light/40 focus:outline-none focus:border-primary transition"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-light/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-light/40 text-sm text-center py-4">
                  {searchQuery ? 'No users found' : 'All users are already members'}
                </p>
              ) : (
                filteredUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-dark rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white">
                        {(u.username || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-light">{u.username || u.email}</p>
                        <p className="text-xs text-light/60 capitalize">{u.role}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddMember(u.id)}
                      className="px-3 py-1 text-xs bg-primary hover:bg-primary-dark text-white rounded transition"
                    >
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
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

// Create Chat Modal Component (keeping your existing one with all the features)
function CreateChatModal({ user, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [selectedClub, setSelectedClub] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [clubs, setClubs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(availableUsers);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = availableUsers.filter((u) => {
        const username = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const id = (u.id || '').toLowerCase();
        
        return username.includes(lowerQuery) ||
               email.includes(lowerQuery) ||
               id.includes(lowerQuery);
      });
      setFilteredUsers(filtered);
    }
  }, [searchQuery, availableUsers]);

  // Load clubs and determine user role
  useEffect(() => {
    const loadData = async () => {
      try {
        const { getClubs, getAllUsers } = await import('../firebase/firestore');
        
        const [clubsData, usersData] = await Promise.all([
          getClubs(),
          getAllUsers(),
        ]);

        let userClubs = [];
        let detectedRole = 'user';

        if (isSuperAdmin(user)) {
          userClubs = clubsData;
          detectedRole = 'owner';
        } else {
          userClubs = clubsData.filter((club) => {
            const isOwner = club.createdBy === user.id;
            const isTrainer = club.trainers?.includes(user.id);
            const isAssistant = club.assistants?.includes(user.id);
            const isMember = club.members?.includes(user.id);

            if (isOwner) detectedRole = 'owner';
            else if (isTrainer || isAssistant) detectedRole = 'trainer';

            return isOwner || isTrainer || isAssistant || isMember;
          });
        }

        setClubs(userClubs);
        setUserRole(detectedRole);
        const allUsersFiltered = usersData.filter((u) => u.id !== user.id);
        setAvailableUsers(allUsersFiltered);
        setFilteredUsers(allUsersFiltered);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  useEffect(() => {
    if (selectedClub) {
      const club = clubs.find((c) => c.id === selectedClub);
      if (club) {
        let filteredTeams = club.teams || [];
        
        if (userRole === 'trainer') {
          filteredTeams = filteredTeams.filter((team) =>
            team.trainers?.includes(user.id) || team.assistants?.includes(user.id)
          );
        }

        setTeams(filteredTeams);

        if (userRole === 'owner') {
          const clubMemberIds = [
            ...(club.trainers || []),
            ...(club.assistants || []),
            ...(club.members || [])
          ];
          const clubUsers = availableUsers.filter((u) => clubMemberIds.includes(u.id));
          setAvailableUsers(clubUsers);
        }
      }
    } else {
      setTeams([]);
      setSelectedTeam('');
      setSelectedMembers([]);
    }
  }, [selectedClub, clubs, userRole, user.id]);

  useEffect(() => {
    if (selectedTeam && selectedClub) {
      const club = clubs.find((c) => c.id === selectedClub);
      const team = club?.teams?.find((t) => t.id === selectedTeam);
      
      if (team) {
        const teamMemberIds = [
          ...(team.trainers || []),
          ...(team.assistants || []),
          ...(team.members || [])
        ].filter((id) => id !== user.id);

        setSelectedMembers(teamMemberIds);

        const teamUsers = availableUsers.filter((u) => teamMemberIds.includes(u.id));
        setAvailableUsers(teamUsers);
      }
    } else if (selectedClub && userRole === 'owner') {
      const club = clubs.find((c) => c.id === selectedClub);
      if (club) {
        const clubMemberIds = [
          ...(club.trainers || []),
          ...(club.assistants || []),
          ...(club.members || [])
        ];
      }
    }
  }, [selectedTeam, selectedClub, clubs, userRole, user.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    if (selectedMembers.length === 0) {
      alert('Please select at least one member for the chat');
      return;
    }

    onCreate({
      title: title.trim(),
      clubId: selectedClub || null,
      teamId: selectedTeam || null,
      members: selectedMembers,
    });
  };

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
    
    // Clear search after selecting
    setSearchQuery('');
  };

  const handleSelectAll = () => {
    const allUserIds = filteredUsers.map((u) => u.id);
    setSelectedMembers(allUserIds);
  };

  const handleSelectNone = () => {
    setSelectedMembers([]);
  };

  const allSelected = filteredUsers.length > 0 && 
                      filteredUsers.every((u) => selectedMembers.includes(u.id));
  
  const showSelectAll = selectedClub && !selectedTeam && userRole === 'owner';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-light">Create New Chat</h2>
          <p className="text-sm text-light/60 mt-1">
            {userRole === 'owner' && 'You can chat with anyone in your clubs'}
            {userRole === 'trainer' && 'You can chat with members of your teams'}
            {userRole === 'user' && 'You can chat with teammates or any registered user'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              Chat Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter chat title"
              className="w-full px-4 py-3 bg-dark border border-white/10 rounded-lg text-light placeholder-light/40 focus:outline-none focus:border-primary transition"
              required
            />
          </div>

          {clubs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-light mb-2">
                Club {userRole === 'owner' ? '(optional)' : ''}
              </label>
              <select
                value={selectedClub}
                onChange={(e) => {
                  setSelectedClub(e.target.value);
                  setSelectedTeam('');
                  setSelectedMembers([]);
                }}
                className="w-full px-4 py-3 bg-dark border border-white/10 rounded-lg text-light focus:outline-none focus:border-primary transition"
              >
                <option value="">No club</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedClub && teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-light mb-2">
                Team (optional)
              </label>
              <select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value);
                  setSelectedMembers([]);
                }}
                className="w-full px-4 py-3 bg-dark border border-white/10 rounded-lg text-light focus:outline-none focus:border-primary transition"
              >
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {selectedTeam && (
                <p className="text-xs text-green-400 mt-2">
                  ✓ All team members are automatically included
                </p>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-light">
                {selectedTeam ? 'Team Members (uncheck to exclude)' : 'Add Members *'}
              </label>
              {showSelectAll && (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-primary hover:text-primary-dark transition"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectNone}
                    className="text-xs text-light/60 hover:text-light transition"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or ID..."
                className="w-full px-4 py-2 pl-10 bg-dark border border-white/10 rounded-lg text-light text-sm placeholder-light/40 focus:outline-none focus:border-primary transition"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-light/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-light/40 hover:text-light"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto bg-dark rounded-lg border border-white/10 p-3 space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-light/40 text-sm">
                  {searchQuery 
                    ? 'No users found matching your search'
                    : selectedClub 
                      ? 'No members in this club/team' 
                      : 'No users available'
                  }
                </p>
              ) : (
                filteredUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(u.id)}
                      onChange={() => toggleMember(u.id)}
                      className="w-4 h-4 text-primary bg-dark border-white/20 rounded focus:ring-primary"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-light">{u.username || u.email}</p>
                      <p className="text-xs text-light/40 capitalize">{u.role}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-light/40 mt-2">
              {selectedMembers.length} member(s) selected
              {searchQuery && ` • ${filteredUsers.length} of ${availableUsers.length} shown`}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-mid-dark hover:bg-dark border border-white/10 text-light rounded-lg transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || selectedMembers.length === 0}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
