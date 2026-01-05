// src/firebase/parentChild.js
// Parent-Child Account Management Functions

import { db } from './config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  addDoc
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getClub } from './firestore';

/* ===========================
   PARENT-CHILD RELATIONSHIPS
   =========================== */

/**
 * Create a child subaccount (managed by parent)
 * @param {string} parentId - Parent user ID
 * @param {object} childData - Child account data
 * @returns {object} Created child account
 */
export async function createChildAccount(parentId, childData) {
  try {
    // Get parent user
    const parentDoc = await getDoc(doc(db, 'users', parentId));
    if (!parentDoc.exists()) {
      throw new Error('PARENT_NOT_FOUND');
    }
    
    const parent = { id: parentDoc.id, ...parentDoc.data() };
    if (parent.role !== 'parent') {
      throw new Error('USER_NOT_PARENT');
    }
    
    // Create child user ID
    const childId = `child_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create child user document
    const childUser = {
      id: childId,
      email: parent.email,  // Same email as parent
      username: `${childData.firstName} ${childData.lastName}`.trim(),
      firstName: childData.firstName || '',
      lastName: childData.lastName || '',
      
      role: 'user',
      accountType: 'subaccount',
      isSubAccount: true,
      managedByParentId: parentId,
      parentIds: [parentId],
      childIds: [],
      passwordManagedByParent: true,
      
      profilePicture: childData.profilePicture || null,
      allowBirthdateTracking: childData.allowBirthdateTracking || false,
      birthdate: childData.birthdate || null,
      
      clubIds: childData.clubIds || [],
      teamIds: childData.teamIds || [],
      
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Save child user
    await setDoc(doc(db, 'users', childId), childUser);
    
    // Update parent's childIds
    await updateDoc(doc(db, 'users', parentId), {
      childIds: arrayUnion(childId),
      updatedAt: serverTimestamp()
    });
    
    // Create relationship document
    const relationshipId = `rel_${Date.now()}`;
    await setDoc(doc(db, 'parentChildRelationships', relationshipId), {
      id: relationshipId,
      parentId,
      childId,
      relationshipType: 'subaccount',
      status: 'active',
      requestedBy: parentId,
      parentApproved: true,
      childApproved: true,
      allParentIds: [parentId],
      createdAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
    });
    
    // Auto-approve team assignment if parent is already a member
    // Otherwise create join request for trainer approval
    const joinRequests = [];
    const autoApproved = [];
    
    for (const teamId of childData.teamIds || []) {
      // Find which club this team belongs to
      for (const clubId of childData.clubIds || []) {
        const clubRef = doc(db, 'clubs', clubId);
        const clubDoc = await getDoc(clubRef);
        
        if (clubDoc.exists()) {
          const club = clubDoc.data();
          const team = (club.teams || []).find(t => t.id === teamId);
          
          if (team) {
            try {
              // Check if parent is a member of this team
              const isParentMember = 
                (team.members || []).includes(parentId) ||
                (team.trainers || []).includes(parentId) ||
                (team.assistants || []).includes(parentId);
              
              if (isParentMember) {
                // Auto-approve: directly add child to team
                console.log(`Auto-approving child ${childId} for team ${teamId} (parent is member)`);
                
                // Add child to team members
                const updatedTeams = club.teams.map(t => {
                  if (t.id === teamId) {
                    return {
                      ...t,
                      members: [...(t.members || []), childId]
                    };
                  }
                  return t;
                });
                
                // Update club with new team membership
                await updateDoc(clubRef, { teams: updatedTeams });
                
                // Add club/team to child's arrays
                await updateDoc(doc(db, 'users', childId), {
                  clubIds: arrayUnion(clubId),
                  teamIds: arrayUnion(teamId)
                });
                
                autoApproved.push({
                  clubId,
                  teamId,
                  teamName: team.name,
                  reason: 'parent_is_member'
                });
              } else {
                // Create join request for trainer approval
                const requestRef = await addDoc(collection(db, 'requests'), {
                  userId: childId,
                  clubId: clubId,
                  teamId: teamId,
                  status: 'pending',
                  requestedBy: parentId, // Parent is requesting on behalf of child
                  requestType: 'child_account',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                
                joinRequests.push({
                  requestId: requestRef.id,
                  clubId,
                  teamId,
                  teamName: team.name
                });
              }
            } catch (requestError) {
              console.warn(`Could not process team assignment for ${teamId}:`, requestError.message);
            }
            break; // Found the club for this team, no need to check other clubs
          }
        }
      }
    }
    
    return { 
      success: true, 
      childId, 
      childUser,
      joinRequests,
      autoApproved,
      needsApproval: joinRequests.length > 0,
      autoApprovedCount: autoApproved.length
    };
  } catch (error) {
    console.error('Error creating child account:', error);
    throw error;
  }
}

/**
 * Request to link an existing account as child
 * @param {string} parentId - Parent user ID
 * @param {string} childEmail - Child's email address
 * @returns {object} Relationship request info
 */
export async function requestParentChildLink(parentId, childEmail) {
  try {
    // Find child user by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', childEmail.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }
    
    const childDoc = querySnapshot.docs[0];
    const childUser = { id: childDoc.id, ...childDoc.data() };
    const childId = childUser.id;
    
    // Check if already linked
    if (childUser.parentIds && childUser.parentIds.includes(parentId)) {
      throw new Error('ALREADY_LINKED');
    }
    
    // Check maximum parents limit
    if (childUser.parentIds && childUser.parentIds.length >= 3) {
      throw new Error('MAX_PARENTS_REACHED');
    }
    
    // Create pending relationship
    const relationshipId = `rel_${Date.now()}`;
    await setDoc(doc(db, 'parentChildRelationships', relationshipId), {
      id: relationshipId,
      parentId,
      childId,
      relationshipType: 'linked',
      status: 'pending',
      requestedBy: parentId,
      requestedAt: serverTimestamp(),
      parentApproved: true,  // Parent initiating = already approved
      childApproved: false,
      allParentIds: [parentId],
      createdAt: serverTimestamp(),
    });
    
    // TODO: Send verification emails (implement with your email system)
    // await sendParentLinkVerificationEmail(parentId, childId, relationshipId);
    // await sendChildLinkVerificationEmail(childId, parentId, relationshipId);
    
    return { success: true, relationshipId };
  } catch (error) {
    console.error('Error requesting link:', error);
    throw error;
  }
}

/**
 * Approve parent-child link request
 * @param {string} relationshipId - Relationship ID
 * @param {string} approvingUserId - User approving the request
 * @returns {object} Updated relationship
 */
export async function approveParentChildLink(relationshipId, approvingUserId) {
  try {
    const relationshipDoc = await getDoc(doc(db, 'parentChildRelationships', relationshipId));
    if (!relationshipDoc.exists()) {
      throw new Error('RELATIONSHIP_NOT_FOUND');
    }
    
    const relationship = { id: relationshipDoc.id, ...relationshipDoc.data() };
    
    // Handle different types of relationships
    if (relationship.relationshipType === 'additional_parent') {
      // Additional parent link - only new parent needs to approve
      if (approvingUserId !== relationship.parentId) {
        throw new Error('INVALID_USER');
      }
      
      const updates = {
        newParentApproved: true,
        status: 'active',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Update user documents
      const parentDoc = await getDoc(doc(db, 'users', relationship.parentId));
      const childDoc = await getDoc(doc(db, 'users', relationship.childId));
      
      if (parentDoc.exists() && childDoc.exists()) {
        // Add child to new parent's childIds
        await updateDoc(doc(db, 'users', relationship.parentId), {
          childIds: arrayUnion(relationship.childId),
          updatedAt: serverTimestamp()
        });
        
        // Add new parent to child's parentIds
        await updateDoc(doc(db, 'users', relationship.childId), {
          parentIds: arrayUnion(relationship.parentId),
          updatedAt: serverTimestamp()
        });
      }
      
      await updateDoc(doc(db, 'parentChildRelationships', relationshipId), updates);
      
      return { success: true, relationship: { ...relationship, ...updates } };
    } else {
      // Regular parent-child link - both must approve
      const updates = {
        updatedAt: serverTimestamp()
      };
      
      if (approvingUserId === relationship.parentId) {
        updates.parentApproved = true;
      } else if (approvingUserId === relationship.childId) {
        updates.childApproved = true;
      } else {
        throw new Error('INVALID_USER');
      }
      
      // Check if both approved
      const bothApproved = 
        (approvingUserId === relationship.parentId ? true : relationship.parentApproved) &&
        (approvingUserId === relationship.childId ? true : relationship.childApproved);
      
      if (bothApproved) {
        updates.status = 'active';
        updates.approvedAt = serverTimestamp();
        
        // Update user documents
        const parentDoc = await getDoc(doc(db, 'users', relationship.parentId));
        const childDoc = await getDoc(doc(db, 'users', relationship.childId));
        
        if (parentDoc.exists() && childDoc.exists()) {
          await updateDoc(doc(db, 'users', relationship.parentId), {
            childIds: arrayUnion(relationship.childId),
            updatedAt: serverTimestamp()
          });
          
          await updateDoc(doc(db, 'users', relationship.childId), {
            parentIds: arrayUnion(relationship.parentId),
            accountType: 'linked',
            updatedAt: serverTimestamp()
          });
        }
      }
      
      await updateDoc(doc(db, 'parentChildRelationships', relationshipId), updates);
      
      return { success: true, relationship: { ...relationship, ...updates } };
    }
  } catch (error) {
    console.error('Error approving link:', error);
    throw error;
  }
}

/**
 * Decline parent-child link request
 * @param {string} relationshipId - Relationship ID
 * @returns {object} Success response
 */
export async function declineParentChildLink(relationshipId) {
  try {
    await updateDoc(doc(db, 'parentChildRelationships', relationshipId), {
      status: 'declined',
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error declining link:', error);
    throw error;
  }
}

/**
 * Request to add an additional parent to an existing child account
 * @param {string} requestingParentId - Current parent user ID
 * @param {string} childId - Child user ID
 * @param {string} newParentId - New parent user ID to add
 * @returns {object} Created relationship request
 */
export async function requestAdditionalParentLink(requestingParentId, childId, newParentId) {
  try {
    // Get child document
    const childDoc = await getDoc(doc(db, 'users', childId));
    if (!childDoc.exists()) {
      throw new Error('CHILD_NOT_FOUND');
    }
    
    const child = { id: childDoc.id, ...childDoc.data() };
    
    // Verify requesting parent is already linked to child
    if (!child.parentIds || !child.parentIds.includes(requestingParentId)) {
      throw new Error('NOT_AUTHORIZED');
    }
    
    // Check if child already has 3 parents
    if (child.parentIds.length >= 3) {
      throw new Error('MAX_PARENTS_REACHED');
    }
    
    // Check if new parent is already linked
    if (child.parentIds.includes(newParentId)) {
      throw new Error('ALREADY_LINKED');
    }
    
    // Get new parent document
    const newParentDoc = await getDoc(doc(db, 'users', newParentId));
    if (!newParentDoc.exists()) {
      throw new Error('PARENT_NOT_FOUND');
    }
    
    const newParent = { id: newParentDoc.id, ...newParentDoc.data() };
    if (newParent.role !== 'parent') {
      throw new Error('USER_NOT_PARENT');
    }
    
    // Check if they share at least one team by checking actual club documents
    const childClubIds = child.clubIds || [];
    const sharedTeams = [];
    
    for (const clubId of childClubIds) {
      const club = await getClub(clubId);
      if (!club || !club.teams) continue;
      
      // Check each team in the club
      for (const team of club.teams) {
        const childInTeam = (team.members || []).includes(childId) ||
                           (team.trainers || []).includes(childId) ||
                           (team.assistants || []).includes(childId);
        
        const parentInTeam = (team.members || []).includes(newParentId) ||
                            (team.trainers || []).includes(newParentId) ||
                            (team.assistants || []).includes(newParentId);
        
        if (childInTeam && parentInTeam) {
          sharedTeams.push(team.id);
        }
      }
    }
    
    if (sharedTeams.length === 0) {
      throw new Error('NO_SHARED_TEAMS');
    }
    
    // Check for existing pending request
    // Note: This might fail with permission error if requesting parent can't read all relationships
    // That's OK - we'll treat it as "no existing requests" and let the backend handle duplicates
    try {
      const existingRequests = await getDocs(
        query(
          collection(db, 'parentChildRelationships'),
          where('childId', '==', childId),
          where('parentId', '==', newParentId),
          where('status', '==', 'pending')
        )
      );
      
      if (!existingRequests.empty) {
        throw new Error('REQUEST_ALREADY_EXISTS');
      }
    } catch (queryError) {
      // If permission denied, proceed anyway (duplicate check will happen on backend)
      if (queryError.code !== 'permission-denied') {
        throw queryError;
      }
      console.log('Note: Could not check for existing requests due to permissions, proceeding...');
    }
    
    // Create relationship request
    const relationshipId = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const relationshipData = {
      id: relationshipId,
      parentId: newParentId,
      childId,
      relationshipType: 'additional_parent',
      status: 'pending',
      requestedBy: requestingParentId,
      requestedByParentId: requestingParentId,
      
      // Both must approve
      requestingParentApproved: true, // Auto-approved by requester
      newParentApproved: false, // Must approve
      
      allParentIds: [...child.parentIds, newParentId],
      sharedTeams,
      
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    await setDoc(doc(db, 'parentChildRelationships', relationshipId), relationshipData);
    
    return { success: true, relationshipId, relationship: relationshipData };
  } catch (error) {
    console.error('Error requesting additional parent link:', error);
    throw error;
  }
}

/**
 * Get all children for a parent
 * @param {string} parentId - Parent user ID
 * @returns {array} Array of child users
 */
export async function getParentChildren(parentId) {
  try {
    const parentDoc = await getDoc(doc(db, 'users', parentId));
    if (!parentDoc.exists()) {
      return [];
    }
    
    const parent = { id: parentDoc.id, ...parentDoc.data() };
    const childIds = parent.childIds || [];
    
    if (childIds.length === 0) {
      return [];
    }
    
    // Fetch all children
    const children = await Promise.all(
      childIds.map(async (childId) => {
        const childDoc = await getDoc(doc(db, 'users', childId));
        if (childDoc.exists()) {
          return { id: childDoc.id, ...childDoc.data() };
        }
        return null;
      })
    );
    
    return children.filter(child => child !== null);
  } catch (error) {
    console.error('Error getting children:', error);
    throw error;
  }
}

/**
 * Delete/unlink child account
 * @param {string} parentId - Parent user ID
 * @param {string} childId - Child user ID
 * @returns {object} Success response
 */
export async function deleteChildAccount(parentId, childId) {
  try {
    console.log('🗑️ Deleting child account:', { parentId, childId });
    
    const childDoc = await getDoc(doc(db, 'users', childId));
    if (!childDoc.exists()) {
      throw new Error('CHILD_NOT_FOUND');
    }
    
    const child = { id: childDoc.id, ...childDoc.data() };
    console.log('👶 Child account data:', { 
      accountType: child.accountType, 
      managedByParentId: child.managedByParentId,
      parentIds: child.parentIds 
    });
    
    // Remove from parent's childIds
    try {
      console.log('📝 Step 1: Removing child from parent childIds...');
      await updateDoc(doc(db, 'users', parentId), {
        childIds: arrayRemove(childId),
        updatedAt: serverTimestamp()
      });
      console.log('✅ Step 1 complete');
    } catch (e) {
      console.error('❌ Step 1 failed:', e.message);
      throw e;
    }
    
    if (child.accountType === 'subaccount' && child.managedByParentId === parentId) {
      // Subaccount: Delete completely
      
      // Step 2a: Remove from all clubs and teams first
      try {
        console.log('📝 Step 2a: Removing child from clubs and teams...');
        const clubIds = child.clubIds || [];
        const teamIds = child.teamIds || [];
        
        for (const clubId of clubIds) {
          try {
            const clubRef = doc(db, 'clubs', clubId);
            const clubDoc = await getDoc(clubRef);
            
            if (clubDoc.exists()) {
              const club = clubDoc.data();
              
              // Remove from club members
              const updatedMembers = (club.members || []).filter(id => id !== childId);
              
              // Remove from all teams in this club
              const updatedTeams = (club.teams || []).map(team => ({
                ...team,
                members: (team.members || []).filter(id => id !== childId),
                trainers: (team.trainers || []).filter(id => id !== childId),
                assistants: (team.assistants || []).filter(id => id !== childId)
              }));
              
              await updateDoc(clubRef, {
                members: updatedMembers,
                teams: updatedTeams,
                updatedAt: serverTimestamp()
              });
              console.log(`✅ Removed from club ${clubId}`);
            }
          } catch (clubError) {
            console.warn(`⚠️ Could not remove from club ${clubId}:`, clubError.message);
            // Continue with other clubs
          }
        }
        console.log('✅ Step 2a complete');
      } catch (e) {
        console.error('❌ Step 2a failed (remove from clubs):', e.message);
        // Continue anyway
      }
      
      // Step 2b: Delete child user document
      try {
        console.log('📝 Step 2b: Deleting child user document...');
        await deleteDoc(doc(db, 'users', childId));
        console.log('✅ Step 2b complete');
      } catch (e) {
        console.error('❌ Step 2b failed (delete user):', e.message);
        throw e;
      }
      
      // Step 2c: Delete relationship (only ones where this parent is the parentId)
      try {
        console.log('📝 Step 2c: Deleting relationships...');
        const relationshipsQuery = query(
          collection(db, 'parentChildRelationships'),
          where('childId', '==', childId),
          where('parentId', '==', parentId)  // Only delete relationships for THIS parent
        );
        const relationships = await getDocs(relationshipsQuery);
        console.log(`Found ${relationships.docs.length} relationship(s) to delete`);
        for (const rel of relationships.docs) {
          await deleteDoc(doc(db, 'parentChildRelationships', rel.id));
        }
        console.log('✅ Step 2c complete');
      } catch (e) {
        console.error('❌ Step 2c failed (delete relationships):', e.message);
        // Don't throw - child is already deleted
      }
      
      return { success: true, deleted: true };
    } else {
      // Linked account: Just remove relationship
      try {
        console.log('📝 Step 3a: Updating child user (linked account)...');
        await updateDoc(doc(db, 'users', childId), {
          parentIds: arrayRemove(parentId),
          accountType: (child.parentIds && child.parentIds.length <= 1) ? 'independent' : 'linked',
          updatedAt: serverTimestamp()
        });
        console.log('✅ Step 3a complete');
      } catch (e) {
        console.error('❌ Step 3a failed:', e.message);
        throw e;
      }
      
      // Update relationship status
      try {
        console.log('📝 Step 3b: Updating relationship status...');
        const relationshipsQuery = query(
          collection(db, 'parentChildRelationships'),
          where('childId', '==', childId),
          where('parentId', '==', parentId)
        );
        const relationships = await getDocs(relationshipsQuery);
        for (const rel of relationships.docs) {
          await updateDoc(doc(db, 'parentChildRelationships', rel.id), {
            status: 'removed',
            updatedAt: serverTimestamp()
          });
        }
        console.log('✅ Step 3b complete');
      } catch (e) {
        console.error('❌ Step 3b failed:', e.message);
        // Don't throw - main update succeeded
      }
      
      return { success: true, unlinked: true };
    }
  } catch (error) {
    console.error('❌ Error deleting child account:', error);
    throw error;
  }
}

/**
 * Update child profile
 * @param {string} childId - Child user ID
 * @param {object} updates - Profile updates
 * @returns {object} Success response
 */
export async function updateChildProfile(childId, updates) {
  try {
    await updateDoc(doc(db, 'users', childId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating child profile:', error);
    throw error;
  }
}

/**
 * Assign existing child to team (auto-approve if parent is member)
 * @param {string} childId - Child user ID
 * @param {string} clubId - Club ID
 * @param {string} teamId - Team ID  
 * @param {string} parentId - Parent user ID making the assignment
 * @returns {object} Assignment result
 */
export async function assignChildToTeam(childId, clubId, teamId, parentId) {
  try {
    // Verify child exists and is managed by this parent
    const childDoc = await getDoc(doc(db, 'users', childId));
    if (!childDoc.exists()) {
      throw new Error('CHILD_NOT_FOUND');
    }
    
    const child = { id: childDoc.id, ...childDoc.data() };
    if (!child.isSubAccount || child.managedByParentId !== parentId) {
      throw new Error('NOT_AUTHORIZED');
    }
    
    // Get club and team data
    const clubRef = doc(db, 'clubs', clubId);
    const clubDoc = await getDoc(clubRef);
    
    if (!clubDoc.exists()) {
      throw new Error('CLUB_NOT_FOUND');
    }
    
    const club = clubDoc.data();
    const team = (club.teams || []).find(t => t.id === teamId);
    
    if (!team) {
      throw new Error('TEAM_NOT_FOUND');
    }
    
    // Check if child is already a member
    if ((team.members || []).includes(childId)) {
      return {
        success: true,
        alreadyMember: true,
        message: 'Child is already a member of this team'
      };
    }
    
    // Check if parent is a member of this team
    const isParentMember = 
      (team.members || []).includes(parentId) ||
      (team.trainers || []).includes(parentId) ||
      (team.assistants || []).includes(parentId);
    
    if (isParentMember) {
      // Auto-approve: directly add child to team
      console.log(`Auto-approving child ${childId} for team ${teamId} (parent is member)`);
      
      // Add child to team members
      const updatedTeams = club.teams.map(t => {
        if (t.id === teamId) {
          return {
            ...t,
            members: [...(t.members || []), childId]
          };
        }
        return t;
      });
      
      // Update club with new team membership
      await updateDoc(clubRef, { teams: updatedTeams });
      
      // Add club/team to child's arrays
      await updateDoc(doc(db, 'users', childId), {
        clubIds: arrayUnion(clubId),
        teamIds: arrayUnion(teamId),
        updatedAt: serverTimestamp()
      });
      
      return {
        success: true,
        autoApproved: true,
        teamName: team.name,
        clubName: club.name,
        message: 'Child successfully added to team'
      };
    } else {
      // Parent is not a member - create join request
      const requestRef = await addDoc(collection(db, 'requests'), {
        userId: childId,
        clubId: clubId,
        teamId: teamId,
        status: 'pending',
        requestedBy: parentId,
        requestType: 'child_account',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return {
        success: true,
        autoApproved: false,
        needsApproval: true,
        requestId: requestRef.id,
        teamName: team.name,
        clubName: club.name,
        message: 'Join request created - waiting for trainer approval'
      };
    }
  } catch (error) {
    console.error('Error assigning child to team:', error);
    throw error;
  }
}

/* ===========================
   SUBSCRIPTION APPROVALS
   =========================== */

/**
 * Request child subscription (requires parent approval)
 * @param {string} childId - Child user ID
 * @param {object} subscriptionDetails - Subscription plan details
 * @returns {object} Approval request info
 */
export async function requestChildSubscription(childId, subscriptionDetails) {
  try {
    const childDoc = await getDoc(doc(db, 'users', childId));
    if (!childDoc.exists()) {
      throw new Error('CHILD_NOT_FOUND');
    }
    
    const child = { id: childDoc.id, ...childDoc.data() };
    const parentIds = child.parentIds || [];
    
    if (parentIds.length === 0) {
      // No parents, process subscription directly
      return { requiresApproval: false };
    }
    
    // Create approval request
    const approvalId = `approval_${Date.now()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);  // 7 days
    
    await setDoc(doc(db, 'subscriptionApprovals', approvalId), {
      id: approvalId,
      childId,
      parentIds,
      subscriptionDetails: {
        planId: subscriptionDetails.planId,
        planName: subscriptionDetails.planName || '',
        price: subscriptionDetails.price || 0,
        currency: subscriptionDetails.currency || 'EUR',
        billingCycle: subscriptionDetails.billingCycle || 'monthly'
      },
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      createdAt: serverTimestamp(),
    });
    
    // TODO: Send notifications to parents
    // for (const parentId of parentIds) {
    //   await sendSubscriptionApprovalNotification(parentId, approvalId);
    // }
    
    return { requiresApproval: true, approvalId };
  } catch (error) {
    console.error('Error requesting subscription:', error);
    throw error;
  }
}

/**
 * Process subscription approval/decline
 * @param {string} approvalId - Approval request ID
 * @param {string} approvingParentId - Parent approving/declining
 * @param {boolean} approved - True to approve, false to decline
 * @returns {object} Success response
 */
export async function processSubscriptionApproval(approvalId, approvingParentId, approved) {
  try {
    const approvalDoc = await getDoc(doc(db, 'subscriptionApprovals', approvalId));
    if (!approvalDoc.exists()) {
      throw new Error('APPROVAL_NOT_FOUND');
    }
    
    const approval = { id: approvalDoc.id, ...approvalDoc.data() };
    
    if (approved) {
      // Process subscription for child
      // TODO: Implement actual subscription processing
      // await processSubscription(approval.childId, approval.subscriptionDetails.planId);
      
      await updateDoc(doc(db, 'subscriptionApprovals', approvalId), {
        status: 'approved',
        approvedBy: approvingParentId,
        respondedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'subscriptionApprovals', approvalId), {
        status: 'declined',
        declinedBy: approvingParentId,
        respondedAt: serverTimestamp(),
      });
    }
    
    // TODO: Notify child of approval/decline
    // await notifyChildOfApprovalDecision(approval.childId, approved);
    
    return { success: true };
  } catch (error) {
    console.error('Error processing approval:', error);
    throw error;
  }
}

/**
 * Get pending subscription approvals for a parent
 * @param {string} parentId - Parent user ID
 * @returns {array} Pending approval requests
 */
export async function getParentPendingApprovals(parentId) {
  try {
    const approvalsQuery = query(
      collection(db, 'subscriptionApprovals'),
      where('parentIds', 'array-contains', parentId),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(approvalsQuery);
    const approvals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter out expired approvals
    const now = new Date();
    const validApprovals = approvals.filter(approval => {
      const expiresAt = new Date(approval.expiresAt);
      return expiresAt > now;
    });
    
    // Mark expired approvals
    for (const approval of approvals) {
      const expiresAt = new Date(approval.expiresAt);
      if (expiresAt <= now && approval.status === 'pending') {
        await updateDoc(doc(db, 'subscriptionApprovals', approval.id), {
          status: 'expired',
          updatedAt: serverTimestamp()
        });
      }
    }
    
    return validApprovals;
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    throw error;
  }
}

/* ===========================
   PERMISSIONS & CHECKS
   =========================== */

/**
 * Check if user has permission for an action
 * @param {object} user - User object
 * @param {string} action - Action to check
 * @returns {boolean} Has permission
 */
export function checkChildPermissions(user, action) {
  // If not a child account, allow all
  if (!user.isSubAccount && (!user.parentIds || user.parentIds.length === 0)) {
    return true;
  }
  
  // Child permissions (LIMITED)
  const allowedActions = [
    'view_calendar',
    'view_events',
    'respond_to_event',
    'view_chat',
    'send_chat_message',
    'receive_notification',
    'view_own_profile',
    'view_team',
    'view_club'
  ];
  
  const deniedActions = [
    'create_event',
    'delete_event',
    'edit_event',
    'create_chat',
    'create_team',
    'manage_users',
    'purchase_subscription',  // Requires parent approval
    'change_own_password',    // Only for linked accounts
    'delete_own_account',     // Only for linked accounts
    'create_club',
    'edit_club',
    'delete_club'
  ];
  
  if (deniedActions.includes(action)) {
    return false;
  }
  
  return allowedActions.includes(action);
}

/**
 * Check if parent has permission to manage child
 * @param {string} parentId - Parent user ID
 * @param {string} childId - Child user ID
 * @returns {boolean} Has permission
 */
export async function checkParentPermission(parentId, childId) {
  try {
    const childDoc = await getDoc(doc(db, 'users', childId));
    if (!childDoc.exists()) {
      return false;
    }
    
    const child = { id: childDoc.id, ...childDoc.data() };
    return child.parentIds && child.parentIds.includes(parentId);
  } catch (error) {
    console.error('Error checking parent permission:', error);
    return false;
  }
}

export default {
  createChildAccount,
  requestParentChildLink,
  approveParentChildLink,
  declineParentChildLink,
  getParentChildren,
  deleteChildAccount,
  updateChildProfile,
  requestChildSubscription,
  processSubscriptionApproval,
  getParentPendingApprovals,
  checkChildPermissions,
  checkParentPermission
};

