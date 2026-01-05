// BROWSER SCRIPT: Assign seasons to existing league games
// 
// HOW TO USE:
// 1. Open your app in the browser
// 2. Log in as a trainer/admin
// 3. Go to the League Schedule page
// 4. Press F12 to open Developer Tools
// 5. Go to the Console tab
// 6. Copy and paste this entire script
// 7. Press Enter to run
//
// The script will automatically update all games with the correct seasonId

(async function assignSeasonsToGames() {
  console.log('🔍 Starting season assignment for league games...\n');
  
  try {
    // Get Firestore instance
    const { db } = await import('./src/firebase/config.js');
    const { collection, getDocs, doc, updateDoc, query, where } = await import('firebase/firestore');
    const { autoAssignSeason } = await import('./src/firebase/firestore.js');
    
    console.log('✅ Firebase modules loaded\n');
    
    // Get all league games
    const gamesRef = collection(db, 'leagueSchedule');
    const gamesSnapshot = await getDocs(gamesRef);
    
    console.log(`📊 Found ${gamesSnapshot.size} games total\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data();
      
      console.log(`\n🎮 ${game.homeTeam} vs ${game.guestTeam}`);
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
        // Convert date format if needed (DD.MM.YYYY → YYYY-MM-DD)
        let isoDate;
        if (game.date.includes('.')) {
          const [day, month, year] = game.date.split('.');
          isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          isoDate = game.date;
        }
        
        // Auto-assign season based on date
        const season = await autoAssignSeason(game.clubId, isoDate);
        
        if (season) {
          await updateDoc(doc(db, 'leagueSchedule', gameDoc.id), {
            seasonId: season.id
          });
          console.log(`  ✅ Updated with season: ${season.name}`);
          updatedCount++;
        } else {
          console.log(`  ⚠️  Could not find matching season - skipping`);
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
    console.log('✨ Done! Refresh the page to see updated games.');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error('Make sure you are logged in and have the necessary permissions.');
  }
})();

