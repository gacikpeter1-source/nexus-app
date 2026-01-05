// Script to assign seasons to existing league games
// Run with: node scripts/assign-seasons-to-games.js

const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

// Auto-assign season based on game date
async function autoAssignSeason(clubId, gameDate) {
  try {
    // Parse date (handle both DD.MM.YYYY and YYYY-MM-DD formats)
    let date;
    if (gameDate.includes('.')) {
      const [day, month, year] = gameDate.split('.');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      date = new Date(gameDate);
    }

    // Get all active seasons for this club
    const seasonsSnapshot = await db.collection('seasons')
      .where('clubId', '==', clubId)
      .where('status', '==', 'active')
      .get();

    if (seasonsSnapshot.empty) {
      console.log(`  ⚠️  No active seasons found for club ${clubId}`);
      return null;
    }

    // Find season that contains this date
    for (const doc of seasonsSnapshot.docs) {
      const season = doc.data();
      const startDate = new Date(season.startDate);
      const endDate = new Date(season.endDate);

      if (date >= startDate && date <= endDate) {
        console.log(`  ✅ Matched to season: ${season.name}`);
        return { id: doc.id, ...season };
      }
    }

    console.log(`  ⚠️  No season found for date ${gameDate}`);
    return null;
  } catch (error) {
    console.error(`  ❌ Error assigning season:`, error);
    return null;
  }
}

async function assignSeasonsToGames() {
  try {
    console.log('🔍 Fetching all league games...\n');
    
    const gamesSnapshot = await db.collection('leagueSchedule').get();
    console.log(`📊 Found ${gamesSnapshot.size} games total\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const doc of gamesSnapshot.docs) {
      const game = doc.data();
      
      console.log(`\n🎮 Game: ${game.homeTeam} vs ${game.guestTeam}`);
      console.log(`   Date: ${game.date}`);
      console.log(`   Current seasonId: ${game.seasonId || 'NONE'}`);
      
      // Skip if already has a season
      if (game.seasonId) {
        console.log(`  ⏭️  Already has season - skipping`);
        skippedCount++;
        continue;
      }
      
      // Skip if no date or clubId
      if (!game.date || !game.clubId) {
        console.log(`  ⚠️  Missing date or clubId - skipping`);
        skippedCount++;
        continue;
      }
      
      try {
        // Auto-assign season based on date
        const season = await autoAssignSeason(game.clubId, game.date);
        
        if (season) {
          await doc.ref.update({ seasonId: season.id });
          console.log(`  ✅ Updated with seasonId: ${season.id}`);
          updatedCount++;
        } else {
          console.log(`  ⚠️  Could not assign season - skipping`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`  ❌ Error updating game:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Updated: ${updatedCount} games`);
    console.log(`⏭️  Skipped: ${skippedCount} games`);
    console.log(`❌ Errors: ${errorCount} games`);
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
assignSeasonsToGames();

