// Sample Data Creator for Firebase
// This script helps you create sample clubs and teams in your database

import { createClub, generateUniqueCode } from '../firebase/firestore';

// Sample clubs data
export const sampleClubs = [
  {
    name: "Elite Football Academy",
    description: "Professional football training for youth",
    sport: "Football",
    teams: [
      {
        name: "U12 Dragons",
        ageGroup: "U12",
        description: "Under 12 football team",
        members: [],
        trainers: []
      },
      {
        name: "U15 Lions",
        ageGroup: "U15",
        description: "Under 15 competitive team",
        members: [],
        trainers: []
      }
    ]
  },
  {
    name: "City Basketball Club",
    description: "Basketball training and competitions",
    sport: "Basketball",
    teams: [
      {
        name: "Junior Stars",
        ageGroup: "U14",
        description: "Junior basketball team",
        members: [],
        trainers: []
      }
    ]
  },
  {
    name: "Harmony Dance Studio",
    description: "Contemporary and classical dance classes",
    sport: "Dance",
    teams: [
      {
        name: "Beginners Group",
        ageGroup: "All Ages",
        description: "Beginner dance classes",
        members: [],
        trainers: []
      },
      {
        name: "Advanced Performance",
        ageGroup: "Advanced",
        description: "Competition-level dance group",
        members: [],
        trainers: []
      }
    ]
  }
];

/**
 * Creates sample clubs in Firebase
 * @param {string} userId - The user ID to assign as creator/trainer
 * @returns {Promise<Array>} Array of created club IDs
 */
export async function createSampleData(userId) {
  const createdClubs = [];
  
  try {
    console.log('🚀 Creating sample clubs...');
    
    for (const sampleClub of sampleClubs) {
      // Generate unique club code
      const clubCode = await generateUniqueCode();
      
      // Prepare club data
      const clubData = {
        name: sampleClub.name,
        description: sampleClub.description,
        clubCode: clubCode,
        createdBy: userId,
        trainers: [userId],
        assistants: [],
        members: [],
        teams: sampleClub.teams || [],
        sport: sampleClub.sport || 'General'
      };
      
      // Create the club
      const result = await createClub(clubData);
      createdClubs.push(result);
      
      console.log(`✅ Created: ${sampleClub.name} (Code: ${clubCode})`);
    }
    
    console.log(`🎉 Successfully created ${createdClubs.length} clubs!`);
    return createdClubs;
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    throw error;
  }
}

/**
 * Helper function to create a single custom club
 */
export async function createCustomClub(userId, clubData) {
  try {
    const clubCode = await generateUniqueCode();
    
    const fullClubData = {
      name: clubData.name || 'New Club',
      description: clubData.description || '',
      clubCode: clubCode,
      createdBy: userId,
      trainers: [userId],
      assistants: [],
      members: [],
      teams: clubData.teams || [],
      sport: clubData.sport || 'General',
      ...clubData
    };
    
    const result = await createClub(fullClubData);
    console.log(`✅ Created club: ${fullClubData.name} (Code: ${clubCode})`);
    return result;
    
  } catch (error) {
    console.error('❌ Error creating club:', error);
    throw error;
  }
}

export default {
  createSampleData,
  createCustomClub,
  sampleClubs
};
