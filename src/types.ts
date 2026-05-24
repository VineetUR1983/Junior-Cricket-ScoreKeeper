/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  id: string;
  name: string;
  role: 'Batter' | 'Bowler' | 'All-rounder' | 'Wicket-keeper';
}

export interface Team {
  name: string;
  players: Player[];
  batsmanBallLimit: number;
}

export interface BatterStats {
  playerId: string;
  playerName: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  howOut: string; // 'Active' | 'Retired' | 'Bowled' | 'Caught' | 'Run Out' | 'LBW' | 'Stumped' | 'Hit Wicket'
  bowledBy?: string;
  caughtBy?: string;
  runOutBy?: string;
  stumpedBy?: string;
}

export interface BowlerStats {
  playerId: string;
  playerName: string;
  ballsBowled: number; // For easy over math (6 balls = 1 over)
  runsConceded: number;
  wickets: number;
  maidens: number;
  wides: number;
  noBalls: number;
  oversHistory: { [overNum: number]: { runs: number; wickets: number; hasExtra: boolean } };
}

export interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export interface BallRecord {
  ballId?: string;       // Unique ID for editing
  ballNumInOver: number; // 1 to 6 (excluding Free Hits)
  overNum: number;       // 0 to 19
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  ballType: 'Normal' | 'Wide' | 'NoBall' | 'FreeHit';
  runsFromBat: number;   // Goes to batsman
  runsFromExtras: number; // Wide/No-ball penalty, Byes, Leg Byes
  extraType?: 'Wide' | 'NoBall' | 'Bye' | 'LegBye' | 'None';
  isWicket: boolean;
  wicketType?: 'Bowled' | 'Caught' | 'Run Out' | 'LBW' | 'Stumped' | 'Retired';
  wicketPlayerId?: string; // Who got out
  wicketFielderId?: string;
  wicketFielderName?: string;
  description: string;   // Ball-by-ball description
  cumulativeRuns?: number;
  cumulativeWickets?: number;
}

export interface Innings {
  battingTeamIndex: number;  // 0 or 1
  bowlingTeamIndex: number;  // 1 or 0
  batsmanBallLimit: number;
  totalRuns: number;
  totalWickets: number;
  ballsBowledTotal: number;  // Total valid bowler balls (max 120 for T20, counting wides & no-balls per rule)
  activeStrikerId: string;
  activeNonStrikerId: string;
  activeBowlerId: string;
  extras: Extras;
  batters: BatterStats[];   // Stats for all batters in this innings
  bowlers: BowlerStats[];   // Stats for all bowlers in this innings
  balls: BallRecord[];      // Full history of balls in this innings
  currentOverBalls: BallRecord[]; // Balls bowled in the current over
  wicketKeeper1Id: string;  // Overs 1-10
  wicketKeeper2Id: string;  // Overs 11-20
  isCompleted: boolean;
}

export interface MatchState {
  teams: [Team, Team];
  currentInningsIndex: 0 | 1 | 2; // 0 = not started, 1 = 1st innings, 2 = 2nd innings
  innings: [Innings | null, Innings | null];
  selectedStrikerId: string;
  selectedNonStrikerId: string;
  selectedBowlerId: string;
  consecutiveExtrasCount: number; // Tracking for Free Hit trigger
  isFreeHitActive: boolean;       // Active state for next ball
  history: string[];              // Snapshot-like string logs
}
