// src/utils/leagueScraper.js
// League Schedule Scraping Utilities
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Scrape games from a league website
 * Uses Firebase Cloud Function to avoid CORS issues
 */
export async function scrapeLeagueSchedule(config) {
  const { provider, url, teamIdentifier } = config;

  try {
    console.log(`[SCRAPER] Calling Cloud Function to scrape: ${url} for team: ${teamIdentifier}`);
    
    // Call the Firebase Cloud Function
    const functions = getFunctions();
    const scrapeFunction = httpsCallable(functions, 'scrapeLeagueSchedule');
    
    const result = await scrapeFunction({ 
      url: url || 'https://hlcana.sk/zapasy',
      teamIdentifier: teamIdentifier || 'MYS'
    });
    
    console.log(`[SCRAPER] Cloud Function returned ${result.data.games?.length || 0} games`);
    
    return result.data.games || [];
  } catch (error) {
    console.error('Error scraping league schedule:', error);
    throw new Error(`Failed to fetch league schedule: ${error.message}`);
  }
}

/**
 * Parse different league provider formats
 */
function parseLeagueData(provider, html, teamIdentifier) {
  switch (provider) {
    case 'sportspress':
      return parseSportsPressSchedule(html, teamIdentifier);
    case 'teamsnap':
      return parseTeamSnapSchedule(html, teamIdentifier);
    case 'leaguevine':
      return parseLeaguevineSchedule(html, teamIdentifier);
    case 'custom':
    default:
      return parseGenericSchedule(html, teamIdentifier);
  }
}

/**
 * Parse SportsPress format
 */
function parseSportsPressSchedule(html, teamIdentifier) {
  // TODO: Implement SportsPress-specific parsing
  // Example: Look for .sp-template-event-blocks, .sp-table-wrapper classes
  const games = [];
  
  // Parse HTML structure specific to SportsPress
  // Extract: date, time, home team, away team, venue, result
  
  return games;
}

/**
 * Parse TeamSnap format
 */
function parseTeamSnapSchedule(html, teamIdentifier) {
  // TODO: Implement TeamSnap-specific parsing
  return [];
}

/**
 * Parse Leaguevine format (Ultimate Frisbee)
 */
function parseLeaguevineSchedule(html, teamIdentifier) {
  // TODO: Implement Leaguevine API integration
  // Leaguevine has a public API: https://www.leaguevine.com/api/v1/
  return [];
}

/**
 * Parse generic/custom schedule format
 */
function parseGenericSchedule(html, teamIdentifier) {
  // Generic parser - tries to find common patterns
  // Look for date/time patterns, team names, scores, etc.
  const games = [];
  
  // Common patterns:
  // - Tables with game information
  // - Divs/cards with structured data
  // - JSON-LD structured data
  
  return games;
}

/**
 * Generate mock scraped games for testing
 */
function generateMockScrapedGames(teamIdentifier) {
  const today = new Date();
  const mockGames = [];

  // Realistic opponent team names
  const opponentTeams = [
    'HC Košice',
    'HK Nitra',
    'HC Slovan Bratislava',
    'HK Poprad',
    'HC 05 Banská Bystrica',
    'HKM Zvolen',
    'HK Dukla Trenčín',
    'HC Nové Zámky'
  ];

  // Use the team identifier or a default
  const myTeamName = teamIdentifier || 'HK Myslava';

  // Generate 5 upcoming mock games
  for (let i = 1; i <= 5; i++) {
    const gameDate = new Date(today);
    gameDate.setDate(gameDate.getDate() + (i * 7)); // Weekly games
    
    const opponentName = opponentTeams[i % opponentTeams.length];
    const isHome = i % 2 === 0;
    
    mockGames.push({
      externalId: `scraped-${Date.now()}-${i}`,
      date: gameDate.toISOString().split('T')[0],
      time: isHome ? '18:00' : '20:00',
      type: 'game',
      homeTeam: isHome ? myTeamName : opponentName,
      guestTeam: isHome ? opponentName : myTeamName,
      location: isHome ? 'home' : 'away',
      result: null,
      notes: `Scraped from league website on ${new Date().toLocaleString()}`
    });
  }

  // Generate 3 past games with results
  for (let i = 1; i <= 3; i++) {
    const gameDate = new Date(today);
    gameDate.setDate(gameDate.getDate() - (i * 7)); // Past games
    
    const opponentName = opponentTeams[(i + 5) % opponentTeams.length];
    const isHome = i % 2 === 0;
    const homeScore = Math.floor(Math.random() * 5);
    const guestScore = Math.floor(Math.random() * 5);
    
    mockGames.push({
      externalId: `scraped-past-${Date.now()}-${i}`,
      date: gameDate.toISOString().split('T')[0],
      time: '19:00',
      type: 'game',
      homeTeam: isHome ? myTeamName : opponentName,
      guestTeam: isHome ? opponentName : myTeamName,
      location: isHome ? 'home' : 'away',
      result: `${homeScore}:${guestScore}`,
      notes: `Scraped result from league website`
    });
  }

  return mockGames.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Match scraped game with existing game
 */
export function matchGames(scrapedGame, existingGames) {
  // Try to match by scrapedId first
  let match = existingGames.find(g => 
    g.scrapedId && g.scrapedId === scrapedGame.externalId
  );
  
  if (match) return { match, confidence: 'high' };

  // Try to match by date + time
  match = existingGames.find(g => 
    g.date === scrapedGame.date && 
    g.time === scrapedGame.time
  );
  
  if (match) return { match, confidence: 'medium' };

  // Try to match by date + opponent
  match = existingGames.find(g => 
    g.date === scrapedGame.date && 
    (g.homeTeam === scrapedGame.homeTeam || 
     g.guestTeam === scrapedGame.guestTeam)
  );
  
  if (match) return { match, confidence: 'low' };

  return { match: null, confidence: 'none' };
}

/**
 * Detect conflicts between manual and scraped data
 */
export function detectConflicts(existingGame, scrapedGame) {
  const conflicts = [];

  if (existingGame.date !== scrapedGame.date) {
    conflicts.push({
      field: 'date',
      existing: existingGame.date,
      scraped: scrapedGame.date
    });
  }

  if (existingGame.time !== scrapedGame.time) {
    conflicts.push({
      field: 'time',
      existing: existingGame.time,
      scraped: scrapedGame.time
    });
  }

  if (existingGame.location !== scrapedGame.location) {
    conflicts.push({
      field: 'location',
      existing: existingGame.location,
      scraped: scrapedGame.location
    });
  }

  if (existingGame.result !== scrapedGame.result) {
    conflicts.push({
      field: 'result',
      existing: existingGame.result,
      scraped: scrapedGame.result
    });
  }

  return conflicts;
}

/**
 * Example backend API structure (for reference)
 * This should be implemented as a Firebase Function or backend endpoint
 */
export const BACKEND_SCRAPER_API = {
  endpoint: '/api/scrape-league',
  method: 'POST',
  body: {
    provider: 'string',
    url: 'string',
    teamIdentifier: 'string'
  },
  response: {
    games: [],
    success: true,
    error: null
  }
};

