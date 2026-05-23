/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Player, Team, BatterStats, BowlerStats, BallRecord, Innings, MatchState } from './types';
import SquadManager from './components/SquadManager';
import Scoreboard from './components/Scoreboard';
import ScoreControls from './components/ScoreControls';
import StatsView from './components/StatsView';
import MatchHistory from './components/MatchHistory';
import OversRecovery from './components/OversRecovery';
import CorrectTypos from './components/CorrectTypos';
import ScorecardExport from './components/ScorecardExport';
import { db, saveMatch, deleteMatch, saveOverSnapshot, cleanUpSubsequentSnapshots } from './firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Trophy, RefreshCw, Play, BookOpen, RotateCcw, PencilLine, Plus, Trash2, Calendar, Loader2, Share2 } from 'lucide-react';

const INITIAL_SQUAD_A: Player[] = [
  { id: 'a-1', name: 'Leo "Express" Carter', role: 'All-rounder' },
  { id: 'a-2', name: 'Jaxson Miller', role: 'Batter' },
  { id: 'a-3', name: 'Arlo Bennett', role: 'Batter' },
  { id: 'a-4', name: 'Mason Davis', role: 'Bowler' },
  { id: 'a-5', name: 'Elijah Bennett', role: 'All-rounder' },
  { id: 'a-6', name: 'Oscar Wood', role: 'Wicket-keeper' },
  { id: 'a-7', name: 'Freddie Collins', role: 'Bowler' },
  { id: 'a-8', name: 'Toby Hall', role: 'Batter' }
];

const INITIAL_SQUAD_B: Player[] = [
  { id: 'b-1', name: 'Lucas Green', role: 'All-rounder' },
  { id: 'b-2', name: 'Milo Cooper', role: 'Batter' },
  { id: 'b-3', name: 'Theo Ward', role: 'Batter' },
  { id: 'b-4', name: 'Noah Bailey', role: 'All-rounder' },
  { id: 'b-5', name: 'Arthur Morris', role: 'Bowler' },
  { id: 'b-6', name: 'Harrison Palmer', role: 'Wicket-keeper' },
  { id: 'b-7', name: 'Archie King', role: 'Bowler' },
  { id: 'b-8', name: 'Jude Parker', role: 'Batter' }
];

const formatOvers = (balls: number) => {
  const overs = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${overs}.${rem}`;
};

const findDefaultWicketKeeper = (team: Team) => {
  const keeper = team.players.find((p) => p.role === 'Wicket-keeper');
  return keeper ? keeper.id : (team.players[5]?.id || team.players[0]?.id || '');
};

export default function App() {
  // Setup state
  const [teams, setTeams] = useState<[Team, Team]>(() => {
    const saved = localStorage.getItem('u9_junior_active_match_teams');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse active match teams from local storage", e);
      }
    }
    return [
      { name: 'Junior Warriors', players: INITIAL_SQUAD_A, batsmanBallLimit: 24 },
      { name: 'Little Giants', players: INITIAL_SQUAD_B, batsmanBallLimit: 24 }
    ];
  });

  useEffect(() => {
    localStorage.setItem('u9_junior_active_match_teams', JSON.stringify(teams));
  }, [teams]);

  const [matchOvers, setMatchOvers] = useState<number>(20);
  const [matchBatsmanBallLimit, setMatchBatsmanBallLimit] = useState<number>(24);

  const [currentInningsIndex, setCurrentInningsIndex] = useState<0 | 1 | 2>(0); // 0 = Setup, 1 = 1st Innings, 2 = 2nd Innings
  const [inningsList, setInningsList] = useState<[Innings | null, Innings | null]>([null, null]);

  // Active playing states (IDs for easy lookup)
  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');

  // Consecutive extras tracking for Free Hit rules
  const [consecutiveExtras, setConsecutiveExtras] = useState<number>(0);
  const [isFreeHitActive, setIsFreeHitActive] = useState<boolean>(false);

  // Undo history state stack (Array of serialized JSON snapshots)
  const [undoStack, setUndoStack] = useState<string[]>([]);

  // Right-hand sidebar tab selector on active play dashboard
  const [activePlayTab, setActivePlayTab] = useState<'scorecard' | 'timeline' | 'rules' | 'overs'>('scorecard');

  // Firestore integration states
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(true);
  const [overSnapshots, setOverSnapshots] = useState<any[]>([]);
  const [isTypoModalOpen, setIsTypoModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportMatchData, setExportMatchData] = useState<{ teams: [Team, Team]; inningsList: [Innings | null, Innings | null] } | null>(null);

  // Listen to match changes in Firestore real-time
  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMatches(list);
      setLoadingMatches(false);
    }, (err) => {
      console.error("Failed to load match listings from Firestore: ", err);
      setLoadingMatches(false);
    });
    return unsubscribe;
  }, []);

  // Listen to over snapshots for the active match
  useEffect(() => {
    if (!activeMatchId) {
      setOverSnapshots([]);
      return;
    }
    const q = query(
      collection(db, 'matches', activeMatchId, 'oversSnapshots'),
      orderBy('overNumber', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setOverSnapshots(list);
    }, (err) => {
      console.error("Failed to load over snapshots from Firestore: ", err);
    });
    return unsubscribe;
  }, [activeMatchId]);

  // General Firestore sync state helper
  const syncStateToFirestore = (
    mId: string,
    updates: {
      teams?: [Team, Team];
      currentInningsIndex?: 0 | 1 | 2;
      inningsList?: [Innings | null, Innings | null];
      strikerId?: string;
      nonStrikerId?: string;
      bowlerId?: string;
      consecutiveExtras?: number;
      isFreeHitActive?: boolean;
      matchOvers?: number;
      matchBatsmanBallLimit?: number;
    }
  ) => {
    const nextTeams = updates.teams !== undefined ? updates.teams : teams;
    const nextCurrentInningsIndex = updates.currentInningsIndex !== undefined ? updates.currentInningsIndex : currentInningsIndex;
    const nextInningsList = updates.inningsList !== undefined ? updates.inningsList : inningsList;
    const nextStrikerId = updates.strikerId !== undefined ? updates.strikerId : strikerId;
    const nextNonStrikerId = updates.nonStrikerId !== undefined ? updates.nonStrikerId : nonStrikerId;
    const nextBowlerId = updates.bowlerId !== undefined ? updates.bowlerId : bowlerId;
    const nextConsecutiveExtras = updates.consecutiveExtras !== undefined ? updates.consecutiveExtras : consecutiveExtras;
    const nextIsFreeHitActive = updates.isFreeHitActive !== undefined ? updates.isFreeHitActive : isFreeHitActive;
    const nextMatchOvers = updates.matchOvers !== undefined ? updates.matchOvers : matchOvers;
    const nextMatchBatsmanBallLimit = updates.matchBatsmanBallLimit !== undefined ? updates.matchBatsmanBallLimit : matchBatsmanBallLimit;

    let status: 'setup' | 'active' | 'completed' = 'active';
    if (nextCurrentInningsIndex === 0) {
      status = 'setup';
    } else if (nextInningsList[0]?.isCompleted && nextInningsList[1]?.isCompleted) {
      status = 'completed';
    }

    saveMatch(mId, {
      teams: nextTeams,
      currentInningsIndex: nextCurrentInningsIndex,
      inningsList: nextInningsList,
      strikerId: nextStrikerId,
      nonStrikerId: nextNonStrikerId,
      bowlerId: nextBowlerId,
      consecutiveExtras: nextConsecutiveExtras,
      isFreeHitActive: nextIsFreeHitActive,
      status,
      matchOvers: nextMatchOvers,
      matchBatsmanBallLimit: nextMatchBatsmanBallLimit,
    });
  };

  // Dedicated synchronized state setters for UI selectors
  const handleSetStrikerId = (id: string) => {
    setStrikerId(id);
    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, { strikerId: id });
    }
  };

  const handleSetNonStrikerId = (id: string) => {
    setNonStrikerId(id);
    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, { nonStrikerId: id });
    }
  };

  const handleSetBowlerId = (id: string) => {
    setBowlerId(id);
    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, { bowlerId: id });
    }
  };

  // Resume active match loaded from DB
  const resumeMatch = (match: any) => {
    setActiveMatchId(match.id);
    setTeams(match.teams);

    const resumedOvers = match.matchOvers || match.maxOvers || 20;
    const resumedLimit = match.matchBatsmanBallLimit || match.batsmanBallLimit || 24;
    setMatchOvers(resumedOvers);
    setMatchBatsmanBallLimit(resumedLimit);

    const loadedInningsList = match.inningsList || [null, null];
    let forceReopenIdx = -1;
    for (let i = 0; i < loadedInningsList.length; i++) {
      const inn = loadedInningsList[i];
      if (inn && inn.isCompleted && inn.ballsBowledTotal < (resumedOvers * 6)) {
        const eligible = inn.batters.filter((b: any) => !b.isOut && !b.howOut.includes('Retired'));
        if (eligible.length === 1) {
          inn.isCompleted = false;
          forceReopenIdx = i;
        }
      }
    }

    setInningsList(loadedInningsList);

    let nextStrikerId = match.strikerId || '';
    let nextNonStrikerId = match.nonStrikerId || '';
    let nextBowlerId = match.bowlerId || '';

    if (forceReopenIdx !== -1) {
      const reopenedInnings = loadedInningsList[forceReopenIdx];
      const eligible = reopenedInnings.batters.filter((b: any) => !b.isOut && !b.howOut.includes('Retired'));
      if (eligible.length === 1) {
        nextStrikerId = eligible[0].playerId;
        if (!nextNonStrikerId || nextNonStrikerId === nextStrikerId) {
          const partner = reopenedInnings.batters.find((b: any) => b.playerId !== nextStrikerId);
          nextNonStrikerId = partner ? partner.playerId : '';
        }
      }

      const currentBowlingTeam = match.teams[reopenedInnings.bowlingTeamIndex];
      const masonDavis = currentBowlingTeam.players.find((p: any) => p.name.includes("Mason Davis"));
      if (masonDavis) {
        nextBowlerId = masonDavis.id;
      }
    }

    setStrikerId(nextStrikerId);
    setNonStrikerId(nextNonStrikerId);
    setBowlerId(nextBowlerId);
    setConsecutiveExtras(match.consecutiveExtras || 0);
    setIsFreeHitActive(match.isFreeHitActive || false);
    setCurrentInningsIndex(match.currentInningsIndex || 0);
    setUndoStack([]);

    if (forceReopenIdx !== -1) {
      setTimeout(() => {
        saveMatch(match.id, {
          teams: match.teams,
          currentInningsIndex: match.currentInningsIndex || 0,
          inningsList: loadedInningsList,
          strikerId: nextStrikerId,
          nonStrikerId: nextNonStrikerId,
          bowlerId: nextBowlerId,
          status: 'active',
          matchOvers: resumedOvers,
          matchBatsmanBallLimit: resumedLimit,
        });
      }, 505);
    }
  };

  // Roster correct typos cascading spell changes
  const handleCorrectPlayerName = (playerId: string, newName: string) => {
    // Correct in teams squad
    const updatedTeams = teams.map((team) => {
      const updatedPlayers = team.players.map((p) => {
        if (p.id === playerId) {
          return { ...p, name: newName };
        }
        return p;
      });
      return { ...team, players: updatedPlayers };
    }) as [Team, Team];

    // Cascade to active innings batters/bowlers list and ball descriptions
    const updatedInningsList = inningsList.map((inn) => {
      if (!inn) return null;
      const battingInnings = { ...inn };
      battingInnings.batters = battingInnings.batters.map((b) => {
        if (b.playerId === playerId) {
          return { ...b, playerName: newName };
        }
        return b;
      });
      battingInnings.bowlers = battingInnings.bowlers.map((b) => {
        if (b.playerId === playerId) {
          return { ...b, playerName: newName };
        }
        return b;
      });
      battingInnings.balls = battingInnings.balls.map((ball) => {
        let updatedDesc = ball.description;
        const oldPlayer = teams.flatMap((t) => t.players).find((p) => p.id === playerId);
        if (oldPlayer) {
          updatedDesc = updatedDesc.replace(new RegExp(oldPlayer.name, 'g'), newName);
        }
        return { ...ball, description: updatedDesc };
      });
      return battingInnings;
    }) as [Innings | null, Innings | null];

    setTeams(updatedTeams);
    setInningsList(updatedInningsList);

    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, {
        teams: updatedTeams,
        inningsList: updatedInningsList,
      });
    }
  };

  // Restore snapshot revert handler
  const handleRestoreSnapshot = async (snapshot: any) => {
    if (window.confirm(`Revert match data and continue play from end of Over ${snapshot.overNumber}?`)) {
      const stateObj = snapshot.matchState;
      setInningsList(stateObj.inningsList);
      setStrikerId(stateObj.strikerId);
      setNonStrikerId(stateObj.nonStrikerId);
      setBowlerId(stateObj.bowlerId);
      setConsecutiveExtras(stateObj.consecutiveExtras || 0);
      setIsFreeHitActive(stateObj.isFreeHitActive || false);
      setTeams(stateObj.teams);
      setUndoStack([]);

      if (activeMatchId) {
        await saveMatch(activeMatchId, stateObj);
        await cleanUpSubsequentSnapshots(activeMatchId, snapshot.overNumber, snapshot.inningsIndex);
      }
      alert(`Match state reverted successfully to end of Over ${snapshot.overNumber}!`);
    }
  };

  // Load and save state snapshots for Undo
  const saveSnapshot = () => {
    const currentSnapshot = JSON.stringify({
      inningsList,
      strikerId,
      nonStrikerId,
      bowlerId,
      consecutiveExtras,
      isFreeHitActive,
    });
    setUndoStack((prev) => [...prev, currentSnapshot]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const parsed = JSON.parse(previous);
    
    setInningsList(parsed.inningsList);
    setStrikerId(parsed.strikerId);
    setNonStrikerId(parsed.nonStrikerId);
    setBowlerId(parsed.bowlerId);
    setConsecutiveExtras(parsed.consecutiveExtras);
    setIsFreeHitActive(parsed.isFreeHitActive);

    setUndoStack((prev) => prev.slice(0, -1));

    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, {
        inningsList: parsed.inningsList,
        strikerId: parsed.strikerId,
        nonStrikerId: parsed.nonStrikerId,
        bowlerId: parsed.bowlerId,
        consecutiveExtras: parsed.consecutiveExtras,
        isFreeHitActive: parsed.isFreeHitActive,
      });
    }
  };

  // Switch between setup screen and core application match play status
  const startMatchPlay = () => {
    const battingTeamIdx = 0;
    const bowlingTeamIdx = 1;
    const teamA = teams[battingTeamIdx];
    const teamB = teams[bowlingTeamIdx];

    const initialInnings: Innings = {
      battingTeamIndex: battingTeamIdx,
      bowlingTeamIndex: bowlingTeamIdx,
      batsmanBallLimit: matchBatsmanBallLimit,
      totalRuns: 0,
      totalWickets: 0,
      ballsBowledTotal: 0,
      activeStrikerId: '',
      activeNonStrikerId: '',
      activeBowlerId: '',
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      batters: teamA.players.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        howOut: 'Active',
      })),
      bowlers: [],
      balls: [],
      currentOverBalls: [],
      wicketKeeper1Id: findDefaultWicketKeeper(teamB),
      wicketKeeper2Id: findDefaultWicketKeeper(teamB),
      isCompleted: false,
    };

    const nextInningsList: [Innings | null, Innings | null] = [initialInnings, null];
    const matchId = `match_${Date.now()}`;
    
    setActiveMatchId(matchId);
    setInningsList(nextInningsList);
    setCurrentInningsIndex(1); // Play mode start
    setStrikerId(teamA.players[0]?.id || '');
    setNonStrikerId(teamA.players[1]?.id || '');
    setBowlerId(teamB.players[0]?.id || '');
    setConsecutiveExtras(0);
    setIsFreeHitActive(false);
    setUndoStack([]);

    syncStateToFirestore(matchId, {
      teams,
      currentInningsIndex: 1,
      inningsList: nextInningsList,
      strikerId: teamA.players[0]?.id || '',
      nonStrikerId: teamA.players[1]?.id || '',
      bowlerId: teamB.players[0]?.id || '',
      consecutiveExtras: 0,
      isFreeHitActive: false,
      matchOvers,
      matchBatsmanBallLimit,
    });
  };

  const startSecondInnings = () => {
    saveSnapshot(); // Save for undo

    const battingTeamIdx = 1;
    const bowlingTeamIdx = 0;
    const teamA = teams[bowlingTeamIdx];
    const teamB = teams[battingTeamIdx];

    const initialInnings: Innings = {
      battingTeamIndex: battingTeamIdx,
      bowlingTeamIndex: bowlingTeamIdx,
      batsmanBallLimit: matchBatsmanBallLimit,
      totalRuns: 0,
      totalWickets: 0,
      ballsBowledTotal: 0,
      activeStrikerId: '',
      activeNonStrikerId: '',
      activeBowlerId: '',
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      batters: teamB.players.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        howOut: 'Active',
      })),
      bowlers: [],
      balls: [],
      currentOverBalls: [],
      wicketKeeper1Id: findDefaultWicketKeeper(teamA),
      wicketKeeper2Id: findDefaultWicketKeeper(teamA),
      isCompleted: false,
    };

    const nextInningsList: [Innings | null, Innings | null] = [inningsList[0], initialInnings];
    setInningsList(nextInningsList);
    setCurrentInningsIndex(2);
    setStrikerId(teamB.players[0]?.id || '');
    setNonStrikerId(teamB.players[1]?.id || '');
    setBowlerId(teamA.players[0]?.id || '');
    setConsecutiveExtras(0);
    setIsFreeHitActive(false);

    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, {
        currentInningsIndex: 2,
        inningsList: nextInningsList,
        strikerId: teamB.players[0]?.id || '',
        nonStrikerId: teamB.players[1]?.id || '',
        bowlerId: teamA.players[0]?.id || '',
        consecutiveExtras: 0,
        isFreeHitActive: false,
        matchOvers,
        matchBatsmanBallLimit,
      });
    }
  };

  const recordBall = (ballData: {
    ballType: 'Normal' | 'Wide' | 'NoBall' | 'FreeHit';
    runsFromBat: number;
    runsFromExtras: number;
    extraType: 'Wide' | 'NoBall' | 'Bye' | 'LegBye' | 'None';
    isWicket: boolean;
    wicketType?: 'Bowled' | 'Caught' | 'Run Out' | 'LBW' | 'Stumped' | 'Retired';
    wicketPlayerId?: string;
    wicketFielderId?: string;
    wicketFielderName?: string;
  }) => {
    saveSnapshot();

    const inningsIdx = currentInningsIndex - 1;
    const innings = inningsList[inningsIdx];
    if (!innings) return;

    const updatedInnings = { ...innings };
    const updatedBatters = [...updatedInnings.batters];
    const updatedBowlers = [...updatedInnings.bowlers];
    const currentBattingTeam = teams[updatedInnings.battingTeamIndex];
    const currentBowlingTeam = teams[updatedInnings.bowlingTeamIndex];

    const bowlerPlayer = currentBowlingTeam.players.find((p) => p.id === bowlerId);
    if (!bowlerPlayer) {
      alert('Please configure bowler profile before recording the ball.');
      return;
    }

    let bowlerStats = updatedBowlers.find((b) => b.playerId === bowlerId);
    if (!bowlerStats) {
      bowlerStats = {
        playerId: bowlerId,
        playerName: bowlerPlayer.name,
        ballsBowled: 0,
        runsConceded: 0,
        wickets: 0,
        maidens: 0,
        wides: 0,
        noBalls: 0,
        oversHistory: {},
      };
      updatedBowlers.push(bowlerStats);
    }

    const strikerStats = updatedBatters.find((b) => b.playerId === strikerId);
    const nonStrikerStats = updatedBatters.find((b) => b.playerId === nonStrikerId);

    if (!strikerStats || !nonStrikerStats) {
      alert('Please activate both Striker and Non-Striker first!');
      return;
    }

    let overNum = Math.floor(updatedInnings.ballsBowledTotal / 6);
    let ballNumInOver = (updatedInnings.ballsBowledTotal % 6) + 1;

    // RULE: If we have an active Free Hit triggered at the end of the over,
    // the Free Hit must be recorded in the SAME over.
    if (isFreeHitActive && updatedInnings.ballsBowledTotal > 0 && updatedInnings.ballsBowledTotal % 6 === 0) {
      overNum = overNum - 1;
      ballNumInOver = 6;
    }

    const totalRunsThisBall = ballData.runsFromBat + ballData.runsFromExtras;
    updatedInnings.totalRuns += totalRunsThisBall;

    const countsTowardsBatsmanBalls = ballData.ballType !== 'Wide';
    if (countsTowardsBatsmanBalls) {
      strikerStats.ballsFaced += 1;
    }

    strikerStats.runs += ballData.runsFromBat;
    if (ballData.runsFromBat === 4) strikerStats.fours += 1;
    if (ballData.runsFromBat === 6) strikerStats.sixes += 1;

    const countsTowardsBowlerBalls = ballData.ballType !== 'FreeHit';
    if (countsTowardsBowlerBalls) {
      updatedInnings.ballsBowledTotal += 1;
      bowlerStats.ballsBowled += 1;
    }

    let runsConcededToBowler = ballData.runsFromBat;
    if (ballData.ballType === 'Wide' || ballData.ballType === 'NoBall') {
      runsConcededToBowler += ballData.runsFromExtras;
    }
    bowlerStats.runsConceded += runsConcededToBowler;

    if (ballData.ballType === 'Wide') {
      bowlerStats.wides += 1;
      updatedInnings.extras.wides += ballData.runsFromExtras;
    } else if (ballData.ballType === 'NoBall') {
      bowlerStats.noBalls += 1;
      updatedInnings.extras.noBalls += ballData.runsFromExtras;
    } else if (ballData.extraType === 'Bye') {
      updatedInnings.extras.byes += ballData.runsFromExtras;
    } else if (ballData.extraType === 'LegBye') {
      updatedInnings.extras.legByes += ballData.runsFromExtras;
    }

    let gotOut = false;
    let wicketDetailsString = '';

    if (ballData.wicketType) {
      const outPlayerStats = updatedBatters.find((b) => b.playerId === ballData.wicketPlayerId);
      if (outPlayerStats) {
        outPlayerStats.isOut = true;
        gotOut = true;

        if (ballData.wicketType === 'Retired') {
          outPlayerStats.howOut = 'Retired';
          wicketDetailsString = `Retired: ${outPlayerStats.playerName}`;
        } else {
          // It's a real dismissal (wicket)
          updatedInnings.totalWickets += 1;
          const fielderLabel = ballData.wicketFielderName ? ` by ${ballData.wicketFielderName}` : '';
          wicketDetailsString = `Wicket: ${outPlayerStats.playerName} (${ballData.wicketType}${fielderLabel})`;
          
          if (ballData.wicketType === 'Caught') {
            outPlayerStats.howOut = ballData.wicketFielderName ? `ct. ${ballData.wicketFielderName} b. ${bowlerStats.playerName}` : `Caught b. ${bowlerStats.playerName}`;
            outPlayerStats.caughtBy = ballData.wicketFielderName;
            outPlayerStats.bowledBy = bowlerStats.playerName;
          } else if (ballData.wicketType === 'Bowled') {
            outPlayerStats.howOut = `b. ${bowlerStats.playerName}`;
            outPlayerStats.bowledBy = bowlerStats.playerName;
          } else if (ballData.wicketType === 'LBW') {
            outPlayerStats.howOut = `lbw b. ${bowlerStats.playerName}`;
            outPlayerStats.bowledBy = bowlerStats.playerName;
          } else if (ballData.wicketType === 'Stumped') {
            outPlayerStats.howOut = ballData.wicketFielderName ? `st. ${ballData.wicketFielderName} b. ${bowlerStats.playerName}` : `Stumped b. ${bowlerStats.playerName}`;
            outPlayerStats.stumpedBy = ballData.wicketFielderName;
            outPlayerStats.bowledBy = bowlerStats.playerName;
          } else if (ballData.wicketType === 'Run Out') {
            outPlayerStats.howOut = ballData.wicketFielderName ? `Run Out (${ballData.wicketFielderName})` : `Run Out`;
            outPlayerStats.runOutBy = ballData.wicketFielderName;
          } else {
            outPlayerStats.howOut = ballData.wicketType;
          }

          if (ballData.wicketType !== 'Run Out') {
            bowlerStats.wickets += 1;
          }
        }

        if (ballData.wicketPlayerId === strikerId) {
          setStrikerId('');
        } else if (ballData.wicketPlayerId === nonStrikerId) {
          setNonStrikerId('');
        }
      }
    }

    let ballDescription = `${bowlerStats.playerName} to ${strikerStats.playerName}: `;
    if (gotOut) {
      ballDescription += wicketDetailsString;
    } else if (ballData.ballType === 'Wide') {
      ballDescription += `Wide delivery`;
    } else if (ballData.ballType === 'NoBall') {
      ballDescription += `No ball delivery`;
    } else if (ballData.ballType === 'FreeHit') {
      ballDescription += `Free hit delivery scored for ${ballData.runsFromBat}`;
    } else if (ballData.runsFromBat === 4) {
      ballDescription += `Boundary four runs`;
    } else if (ballData.runsFromBat === 6) {
      ballDescription += `Maximum sixer runs`;
    } else if (totalRunsThisBall === 0) {
      ballDescription += `Dot ball`;
    } else {
      ballDescription += `${totalRunsThisBall} run${totalRunsThisBall > 1 ? 's' : ''}`;
    }

    const ballRecord: BallRecord = {
      ballNumInOver: countsTowardsBowlerBalls ? ballNumInOver : 0, 
      overNum,
      strikerId,
      nonStrikerId,
      bowlerId,
      ballType: ballData.ballType,
      runsFromBat: ballData.runsFromBat,
      runsFromExtras: ballData.runsFromExtras,
      extraType: ballData.extraType,
      isWicket: gotOut && ballData.wicketType !== 'Retired',
      wicketType: ballData.wicketType,
      wicketPlayerId: ballData.wicketPlayerId,
      wicketFielderId: ballData.wicketFielderId,
      wicketFielderName: ballData.wicketFielderName,
      description: ballDescription,
    };

    updatedInnings.balls.push(ballRecord);

    if (ballNumInOver === 1 && countsTowardsBowlerBalls && updatedInnings.currentOverBalls.length >= 6) {
      updatedInnings.currentOverBalls = [ballRecord];
    } else {
      updatedInnings.currentOverBalls.push(ballRecord);
    }

    let nextStrikerId = strikerId;
    let nextNonStrikerId = nonStrikerId;
    let nextBowlerId = bowlerId;
    let nextConsecutiveExtras = consecutiveExtras;
    let nextIsFreeHitActive = isFreeHitActive;

    // Handle wicket out
    if (gotOut) {
      if (ballData.wicketPlayerId === strikerId) {
        nextStrikerId = '';
      } else if (ballData.wicketPlayerId === nonStrikerId) {
        nextNonStrikerId = '';
      }
    }

    // Calculate solo mode (isSpecialSingleActive) on the fly for strike rotation checks
    const currentBattersNotFinished = updatedBatters.filter(
      (b) => !b.isOut && !b.howOut.includes('Retired') && b.ballsFaced < updatedInnings.batsmanBallLimit
    );
    const isSoloActive = currentBattersNotFinished.length === 1;

    // Rotating runs (not on wickets and not in solo mode)
    const rotatingRuns = ballData.runsFromBat === 1 || ballData.runsFromBat === 3 || ballData.runsFromBat === 5;
    if (rotatingRuns && nextStrikerId && nextNonStrikerId && !gotOut && !isSoloActive) {
      const temp = nextStrikerId;
      nextStrikerId = nextNonStrikerId;
      nextNonStrikerId = temp;
    }

    // Check how many OTHER batsmen have not finished their quota (which means they are not out, not retired, and balls faced < limit)
    const otherBattersNotFinishedCount = updatedBatters.filter(
      (b) => b.playerId !== strikerId && !b.isOut && !b.howOut.includes('Retired') && b.ballsFaced < updatedInnings.batsmanBallLimit
    ).length;

    // Batsman retirement limit
    let hasRetired = false;
    if (strikerStats.ballsFaced >= updatedInnings.batsmanBallLimit && !gotOut) {
      if (otherBattersNotFinishedCount > 0) {
        strikerStats.isOut = true;
        strikerStats.howOut = 'Retired (Limit Reached)';
        // Considers retired, but does NOT count as a wicket (user request: "When a Batsman reaches his Ball Limit, then consider then retired but do not count then as wickets")
        nextStrikerId = '';
        hasRetired = true;
      }
    }

    // Extras update logic (done before over complete check so nextIsFreeHitActive is ready)
    if (ballData.ballType === 'Wide' || ballData.ballType === 'NoBall') {
      nextConsecutiveExtras = consecutiveExtras + 1;
      if (nextConsecutiveExtras >= 2) {
        nextIsFreeHitActive = true;
      }
    } else {
      if (ballData.ballType === 'FreeHit') {
        nextIsFreeHitActive = false;
      }
      nextConsecutiveExtras = 0;
    }

    // Over completed check (now incorporates nextIsFreeHitActive deferment)
    let isOverCompleted = countsTowardsBowlerBalls && (ballNumInOver === 6);
    if (isOverCompleted && nextIsFreeHitActive) {
      // Defer over completion to record the free hit within the same over
      isOverCompleted = false;
    }
    if (ballData.ballType === 'FreeHit' && ballNumInOver === 6 && !nextIsFreeHitActive) {
      isOverCompleted = true;
    }

    if (isOverCompleted) {
      if (nextStrikerId && nextNonStrikerId && !isSoloActive) {
        const temp = nextStrikerId;
        nextStrikerId = nextNonStrikerId;
        nextNonStrikerId = temp;
      }
      nextBowlerId = '';
    }

    // Force-strike and partner assignment if solo mode (exactly 1 eligible batter left)
    const eligibleBatters = updatedBatters.filter((b) => !b.isOut && !b.howOut.includes('Retired'));
    const isSpecialSingleActive = eligibleBatters.length === 1;

    if (isSpecialSingleActive) {
      const specialBatter = eligibleBatters[0];
      nextStrikerId = specialBatter.playerId;

      if (!nextNonStrikerId || nextNonStrikerId === nextStrikerId) {
        const partner = updatedBatters.find((b) => b.playerId !== specialBatter.playerId);
        nextNonStrikerId = partner ? partner.playerId : '';
      }
    }

    // Apply state updates to React
    setStrikerId(nextStrikerId);
    setNonStrikerId(nextNonStrikerId);
    setBowlerId(nextBowlerId);
    setConsecutiveExtras(nextConsecutiveExtras);
    setIsFreeHitActive(nextIsFreeHitActive);

    updatedInnings.batters = updatedBatters;
    updatedInnings.bowlers = updatedBowlers;

    let isCompletedInnings = updatedInnings.ballsBowledTotal >= (matchOvers * 6);

    if (eligibleBatters.length === 0) {
      isCompletedInnings = true;
    } else if (eligibleBatters.length > 1) {
      const outPlayersCount = updatedBatters.filter((b) => b.isOut || b.howOut.includes('Retired')).length;
      if (outPlayersCount >= currentBattingTeam.players.length - 1) {
        isCompletedInnings = true;
      }
    }

    // Match is not won until the whole 20 overs is bowled in each innings, as per rules, so we don't finish early even if 2nd innings runs exceed 1st innings totalRuns.

    if (isCompletedInnings) {
      updatedInnings.isCompleted = true;
      if (currentInningsIndex === 1) {
        alert(`1st Innings completed! Target score is ${(updatedInnings.totalRuns + 1)} runs.`);
      } else {
        alert(`Match complete! Full stats compiled below.`);
      }
    }

    const updatedInningsList = [...inningsList] as [Innings | null, Innings | null];
    updatedInningsList[inningsIdx] = updatedInnings;
    setInningsList(updatedInningsList);

    // Sync state to Firestore!
    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, {
        inningsList: updatedInningsList,
        strikerId: nextStrikerId,
        nonStrikerId: nextNonStrikerId,
        bowlerId: nextBowlerId,
        consecutiveExtras: nextConsecutiveExtras,
        isFreeHitActive: nextIsFreeHitActive,
      });

      // Save over snapshot to Firestore if completed
      if (isOverCompleted) {
        saveOverSnapshot(activeMatchId, overNum + 1, inningsIdx, {
          teams,
          currentInningsIndex,
          inningsList: updatedInningsList,
          strikerId: nextStrikerId,
          nonStrikerId: nextNonStrikerId,
          bowlerId: '', // bowler cleared at end of over in snapshot
          consecutiveExtras: 0,
          isFreeHitActive: false,
          teamsConfig: teams,
        });
      }
    }

    // Warning alerts
    if (hasRetired) {
      alert(`Batter ${strikerStats.playerName} has hit the retirement limit of ${updatedInnings.batsmanBallLimit} balls! Assign a new batsman.`);
    }
    if (isOverCompleted) {
      alert(`Over complete! Please select a new bowler.`);
    }
  };
  const getAvailableBattersList = (inningsIdx: number, currentTeam: Team) => {
    const innings = inningsList[inningsIdx];
    if (!innings) return [];
    
    // Check if there is only 1 batsman who is NOT out or retired and hasn't reached limit
    const eligibleBatters = innings.batters.filter((b) => !b.isOut && !b.howOut.includes('Retired') && b.ballsFaced < innings.batsmanBallLimit);
    const isSpecialSingleActive = eligibleBatters.length === 1;
    const activeIds = [strikerId, nonStrikerId];

    return currentTeam.players.filter((p) => {
      const stat = innings.batters.find((bt) => bt.playerId === p.id);
      const limitReached = stat ? stat.ballsFaced >= innings.batsmanBallLimit : false;
      if (limitReached) {
        return false;
      }

      if (isSpecialSingleActive) {
        // If the special mode is active, the non-striker can be any player except the striker
        return p.id !== strikerId;
      }
      return (!stat || (!stat.isOut && !stat.howOut.includes('Retired'))) && !activeIds.includes(p.id);
    });
  };

  const getAvailableBowlersList = (inningsIdx: number, bowlingTeam: Team) => {
    const innings = inningsList[inningsIdx];
    if (!innings) return [];

    const currentOverNumber = Math.floor(innings.ballsBowledTotal / 6) + 1;
    const midPoint = Math.ceil(matchOvers / 2);
    const activeWicketKeeperId = currentOverNumber <= midPoint ? innings.wicketKeeper1Id : innings.wicketKeeper2Id;

    const activeIds = [bowlerId];
    return bowlingTeam.players.filter((p) => {
      if (activeWicketKeeperId && p.id === activeWicketKeeperId) {
        return false;
      }
      const stats = innings.bowlers.find((bo) => bo.playerId === p.id);
      const isOverLimit = stats ? stats.ballsBowled >= 24 : false;
      return !isOverLimit && !activeIds.includes(p.id);
    });
  };

  const handleReopenInnings = () => {
    saveSnapshot();
    const inningsIdx = currentInningsIndex - 1;
    const innings = inningsList[inningsIdx];
    if (!innings) return;

    const updatedInnings = { ...innings, isCompleted: false };
    const updatedInningsList = [...inningsList] as [Innings | null, Innings | null];
    updatedInningsList[inningsIdx] = updatedInnings;
    
    setInningsList(updatedInningsList);

    let nextStrikerId = strikerId;
    let nextNonStrikerId = nonStrikerId;
    let nextBowlerId = bowlerId;

    const eligibleBatters = updatedInnings.batters.filter((b) => !b.isOut && !b.howOut.includes('Retired'));
    if (eligibleBatters.length === 1) {
      nextStrikerId = eligibleBatters[0].playerId;
      if (!nextNonStrikerId || nextNonStrikerId === nextStrikerId) {
        const partner = updatedInnings.batters.find((b) => b.playerId !== nextStrikerId);
        nextNonStrikerId = partner ? partner.playerId : '';
      }
    } else if (eligibleBatters.length > 1) {
      if (!nextStrikerId) {
        nextStrikerId = eligibleBatters[0].playerId;
      }
      if (!nextNonStrikerId || nextNonStrikerId === nextStrikerId) {
        nextNonStrikerId = eligibleBatters[1]?.playerId || '';
      }
    }

    const currentBowlingTeam = teams[updatedInnings.bowlingTeamIndex];
    const masonDavis = currentBowlingTeam.players.find(p => p.name.includes("Mason Davis"));
    if (masonDavis) {
      nextBowlerId = masonDavis.id;
    }

    setStrikerId(nextStrikerId);
    setNonStrikerId(nextNonStrikerId);
    setBowlerId(nextBowlerId);

    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, {
        inningsList: updatedInningsList,
        strikerId: nextStrikerId,
        nonStrikerId: nextNonStrikerId,
        bowlerId: nextBowlerId,
      });
    }
  };

  const handleResetMatch = () => {
    if (window.confirm("Disconnect current match events and start new setup?")) {
      setInningsList([null, null]);
      setCurrentInningsIndex(0);
      setStrikerId('');
      setNonStrikerId('');
      setBowlerId('');
      setConsecutiveExtras(0);
      setIsFreeHitActive(false);
      setUndoStack([]);
      setActiveMatchId(null);
    }
  };

  const handleUpdateWicketKeeper = (half: 1 | 2, keeperId: string) => {
    saveSnapshot();
    const inningsIdx = currentInningsIndex - 1;
    const innings = inningsList[inningsIdx];
    if (!innings) return;

    const updatedInnings = { ...innings };
    if (half === 1) {
      updatedInnings.wicketKeeper1Id = keeperId;
    } else {
      updatedInnings.wicketKeeper2Id = keeperId;
    }

    const updatedInningsList = [...inningsList] as [Innings | null, Innings | null];
    updatedInningsList[inningsIdx] = updatedInnings;
    setInningsList(updatedInningsList);

    const currentOverNumber = Math.floor(updatedInnings.ballsBowledTotal / 6) + 1;
    const midPoint = Math.ceil(matchOvers / 2);
    const assignedAsActiveKeeper = (half === 1 && currentOverNumber <= midPoint) || (half === 2 && currentOverNumber > midPoint);
    
    let nextBowlerId = bowlerId;
    if (assignedAsActiveKeeper && keeperId && keeperId === bowlerId) {
      nextBowlerId = '';
      setBowlerId('');
    }

    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, {
        inningsList: updatedInningsList,
        bowlerId: nextBowlerId,
      });
    }
  };

  const selectedInnings = inningsList[currentInningsIndex - 1];
  const eligibleBatters = selectedInnings
    ? selectedInnings.batters.filter((b) => !b.isOut && !b.howOut.includes('Retired'))
    : [];
  const isSpecialSingleActive = selectedInnings ? eligibleBatters.length === 1 : false;

  const activeStriker = selectedInnings
    ? (selectedInnings.batters.find((b) => b.playerId === strikerId && !(b.ballsFaced >= selectedInnings.batsmanBallLimit && !isSpecialSingleActive)) || null)
    : null;
  const activeNonStriker = selectedInnings
    ? (selectedInnings.batters.find((b) => b.playerId === nonStrikerId && !(b.ballsFaced >= selectedInnings.batsmanBallLimit && !isSpecialSingleActive)) || null)
    : null;
  
  let activeBowler: BowlerStats | null = null;
  if (selectedInnings && bowlerId) {
    activeBowler = selectedInnings.bowlers.find((b) => b.playerId === bowlerId) || null;
    if (!activeBowler) {
      const currentBowlingTeam = teams[selectedInnings.bowlingTeamIndex];
      const playerObj = currentBowlingTeam.players.find((p) => p.id === bowlerId);
      if (playerObj) {
        activeBowler = {
          playerId: bowlerId,
          playerName: playerObj.name,
          ballsBowled: 0,
          runsConceded: 0,
          wickets: 0,
          maidens: 0,
          wides: 0,
          noBalls: 0,
          oversHistory: {},
        };
      }
    }
  }

  const currentBattingTeam = currentInningsIndex > 0 ? teams[selectedInnings?.battingTeamIndex || 0] : null;
  const currentBowlingTeam = currentInningsIndex > 0 ? teams[selectedInnings?.bowlingTeamIndex || 0] : null;

  const availableBatters = currentBattingTeam ? getAvailableBattersList(currentInningsIndex - 1, currentBattingTeam) : [];
  const availableBowlers = currentBowlingTeam ? getAvailableBowlersList(currentInningsIndex - 1, currentBowlingTeam) : [];

  const getMatchResultsSummary = () => {
    const first = inningsList[0];
    const second = inningsList[1];
    if (!first || !second) return '';

    const formatA = teams[first.battingTeamIndex].name;
    const formatB = teams[second.battingTeamIndex].name;

    if (second.isCompleted) {
      if (second.totalRuns > first.totalRuns) {
        return `${formatB} won by ${second.totalRuns - first.totalRuns} runs 🏆`;
      } else if (first.totalRuns > second.totalRuns) {
        return `${formatA} won by ${first.totalRuns - second.totalRuns} runs 🏆`;
      } else {
        return `Match tied (Equal Totals) 🤝`;
      }
    }
    return '';
  };

  const ballsFacedLimit = currentBattingTeam?.batsmanBallLimit || 24;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans select-none" id="cricket-app-container">
      {/* Top Banner Navigation: Light theme Minimal design */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 rounded-2xl w-10 h-10 flex items-center justify-center font-bold text-white text-lg shadow-sm">
              🏏
            </div>
            <div>
              <h1 className="text-base font-black text-slate-800 tracking-tight">Junior Scorer</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Under-9 Format Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentInningsIndex > 0 && (
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 font-medium text-xs">
                <button
                  onClick={() => setActivePlayTab('scorecard')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer ${
                    activePlayTab === 'scorecard' 
                      ? 'bg-white text-indigo-705 shadow-xs border border-slate-205/50' 
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Scorecard
                </button>
                <button
                  onClick={() => setActivePlayTab('timeline')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer ${
                    activePlayTab === 'timeline' 
                      ? 'bg-white text-indigo-705 shadow-xs border border-slate-205/50' 
                      : 'text-slate-400 hover:text-slate-705'
                  }`}
                >
                  Ball Feed
                </button>
                <button
                  onClick={() => setActivePlayTab('overs')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer ${
                    activePlayTab === 'overs' 
                      ? 'bg-white text-indigo-705 shadow-xs border border-slate-205/50' 
                      : 'text-slate-400 hover:text-slate-705'
                  }`}
                >
                  Overs Snapshots
                </button>
                <button
                  onClick={() => setActivePlayTab('rules')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer ${
                    activePlayTab === 'rules' 
                      ? 'bg-white text-indigo-705 shadow-xs border border-slate-205/50' 
                      : 'text-slate-400 hover:text-slate-750'
                  }`}
                >
                  Rules
                </button>
              </div>
            )}

            {currentInningsIndex > 0 && (
              <button
                onClick={() => setIsTypoModalOpen(true)}
                className="px-3 py-2 border border-slate-200 text-slate-505 hover:text-indigo-650 hover:bg-slate-50 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer flex items-center gap-1"
                id="btn-edit-typos"
              >
                <PencilLine className="w-3.5 h-3.5" />
                <span>Correct Spellings</span>
              </button>
            )}

            {currentInningsIndex > 0 && (
              <button
                onClick={() => {
                  setExportMatchData(null);
                  setIsExportModalOpen(true);
                }}
                className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-755 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-xs transition-colors"
                id="btn-export-active"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Export Scorecard</span>
              </button>
            )}

            {currentInningsIndex > 0 && (
              <button
                onClick={handleResetMatch}
                className="px-3 py-2 text-slate-400 hover:text-red-650 text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer border border-transparent hover:border-slate-100 rounded-xl"
                id="btn-reset-match"
              >
                Reset Match
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      {currentInningsIndex === 0 ? (
        // Setup Screen Route with match database history list visible cleanly below squad configs
        <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-8">
          <SquadManager
            teams={teams}
            onSaveTeams={setTeams}
            onStartMatch={startMatchPlay}
            matchOvers={matchOvers}
            setMatchOvers={setMatchOvers}
            matchBatsmanBallLimit={matchBatsmanBallLimit}
            setMatchBatsmanBallLimit={setMatchBatsmanBallLimit}
          />
          
          <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-xs space-y-5" id="match-archive-container">
            <div className="flex items-center gap-2.5 border-b border-slate-150 pb-3" id="database-header">
              <span className="text-xl">🗄️</span>
              <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight">Database Match History</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Persistent Cloud Records</p>
              </div>
            </div>

            {loadingMatches ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs font-semibold gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <span>Querying Firebase Firestore match documents...</span>
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
                No saved cricket matches found in Firestore. Complete team setup and start scoring to record matches automatically!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((m) => {
                  const mDate = m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : 'Active now';
                  
                  const isFinished = m.status === 'completed';
                  
                  return (
                    <div
                      key={m.id}
                      className="p-5 border border-slate-200 hover:border-indigo-250 hover:ring-2 hover:ring-indigo-50/50 rounded-2xl bg-slate-50/20 hover:bg-slate-50/50 transition-all text-xs flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-slate-100/50 p-2 rounded-xl">
                          <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${
                            isFinished ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-indigo-50 text-indigo-800 border border-indigo-100'
                          }`}>
                            {isFinished ? 'concluded' : 'resumable stats'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-extrabold flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {mDate}
                          </span>
                        </div>

                        <div className="space-y-1 pl-1">
                          <p className="font-extrabold text-slate-800 text-sm">
                            {m.teams?.[0]?.name || 'Team 1'} <span className="text-slate-400 font-normal text-xs">v</span> {m.teams?.[1]?.name || 'Team 2'}
                          </p>
                          <p className="text-slate-400 font-semibold text-[11px]">
                            {m.inningsList?.[0] ? `1st Inn: ${m.inningsList[0].totalRuns}/${m.inningsList[0].totalWickets}` : 'No score logs'}
                            {m.inningsList?.[1] ? ` • 2nd Inn: ${m.inningsList[1].totalRuns}/${m.inningsList[1].totalWickets}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => resumeMatch(m)}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Resume & View Live</span>
                        </button>
                        <button
                          onClick={() => {
                            setExportMatchData({
                              teams: m.teams,
                              inningsList: m.inningsList || [null, null]
                            });
                            setIsExportModalOpen(true);
                          }}
                          className="p-2.5 border border-slate-200 hover:bg-indigo-50 hover:border-indigo-150 text-indigo-655 hover:text-indigo-750 rounded-xl transition-all cursor-pointer"
                          title="Export archived scorecard"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Are you absolutely sure you want to permanently delete this match and all associated over snapshots from the database? This cannot be undone.")) {
                              deleteMatch(m.id);
                            }
                          }}
                          className="p-2.5 border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-650 rounded-xl transition-all cursor-pointer"
                          title="Delete match"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Play dashboard Route
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative" id="live-dashboard">
          
          {/* LEFT COLUMN: CORE SCORING (7 COLS) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 2nd Innings Prompt */}
            {inningsList[0]?.isCompleted && !inningsList[1] && (
              <div className="bg-amber-50 border border-amber-200 text-amber-905 p-5 rounded-3xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">First Innings complete!</h3>
                  <p className="text-xs text-amber-700/90 font-medium">
                    {teams[0].name} scored <strong>{inningsList[0]?.totalRuns}</strong>. Click below to begin second innings.
                  </p>
                </div>
                <button
                  onClick={startSecondInnings}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs tracking-wider rounded-xl uppercase shadow-xs flex items-center gap-1.5 cursor-pointer"
                  id="btn-start-innings-2"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start 2nd innings</span>
                </button>
              </div>
            )}

            {/* Whole Match Concluded Screen */}
            {inningsList[0]?.isCompleted && inningsList[1]?.isCompleted && (
              <div className="bg-white border border-slate-205 p-6 rounded-3xl shadow-sm space-y-4 text-center animate-in fade-in duration-300">
                <Trophy className="w-12 h-12 text-indigo-650 mx-auto animate-bounce" />
                <div>
                  <p className="text-[10px] uppercase font-black text-slate-450 tracking-widest">CRICKET MATCH DETERMINED</p>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1">{getMatchResultsSummary()}</h2>
                </div>
                <p className="text-xs text-slate-450 font-semibold max-w-md mx-auto leading-relaxed">
                  The final statistics and rosters have been compiled safely. Standard under-9 custom metrics were fully utilized for calculations.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleReopenInnings}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs transition-shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Undo Completion / Resume Match</span>
                  </button>
                  <button
                    onClick={handleResetMatch}
                    className="px-6 py-2.5 bg-slate-900 border border-slate-900/80 text-white hover:bg-slate-805 font-black uppercase text-[10px] tracking-wider rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs transition-shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Commence new match</span>
                  </button>
                  <button
                    onClick={() => {
                      setExportMatchData(null);
                      setIsExportModalOpen(true);
                    }}
                    className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs transition-shadow"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Export final scorecard</span>
                  </button>
                </div>
              </div>
            )}

            {/* Live Score board */}
            {selectedInnings && (
              <Scoreboard
                battingTeam={currentBattingTeam!}
                bowlingTeam={currentBowlingTeam!}
                innings={selectedInnings}
                activeStriker={activeStriker}
                activeNonStriker={activeNonStriker}
                activeBowler={activeBowler}
                isFreeHit={isFreeHitActive}
                consecutiveExtras={consecutiveExtras}
                ballLimit={ballsFacedLimit}
                targetRuns={currentInningsIndex === 2 ? (inningsList[0]?.totalRuns || 0) + 1 : undefined}
                wicketKeeper1Id={selectedInnings.wicketKeeper1Id}
                wicketKeeper2Id={selectedInnings.wicketKeeper2Id}
                isSpecialSingleActive={isSpecialSingleActive}
                matchOvers={matchOvers}
              />
            )}

            {/* Score Controls panel */}
            {selectedInnings && !selectedInnings.isCompleted && (
              <ScoreControls
                striker={activeStriker}
                nonStriker={activeNonStriker}
                currentBowler={activeBowler}
                availableBatters={availableBatters}
                availableBowlers={availableBowlers}
                isFreeHit={isFreeHitActive}
                onRecordBall={recordBall}
                onChangeStriker={handleSetStrikerId}
                onChangeNonStriker={handleSetNonStrikerId}
                onChangeBowler={handleSetBowlerId}
                onUndoLastBall={handleUndo}
                canUndo={undoStack.length > 0}
                ballLimit={ballsFacedLimit}
                wicketKeeper1Id={selectedInnings.wicketKeeper1Id}
                wicketKeeper2Id={selectedInnings.wicketKeeper2Id}
                fieldingPlayers={currentBowlingTeam!.players}
                onChangeWicketKeeper1={(id) => handleUpdateWicketKeeper(1, id)}
                onChangeWicketKeeper2={(id) => handleUpdateWicketKeeper(2, id)}
                currentOverNumber={Math.floor(selectedInnings.ballsBowledTotal / 6) + 1}
                isSpecialSingleActive={isSpecialSingleActive}
              />
            )}
          </div>

          {/* RIGHT COLUMN: SIDEBARS (5 COLS) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Display correct right-sidebar tab dynamically */}
            {activePlayTab === 'scorecard' && (
              <StatsView teams={teams} inningsList={inningsList} currentInningsIndex={currentInningsIndex} />
            )}

            {activePlayTab === 'timeline' && (
              <MatchHistory
                inningsList={inningsList}
                currentInningsIndex={currentInningsIndex}
              />
            )}

            {activePlayTab === 'overs' && (
              <OversRecovery
                overSnapshots={overSnapshots}
                inningsIndex={currentInningsIndex - 1}
                onRestoreSnapshot={handleRestoreSnapshot}
              />
            )}

            {activePlayTab === 'rules' && (
              <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 border-b border-slate-150 pb-3">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Junior Play Rules Checklist</h3>
                </div>
                
                <div className="space-y-4 text-xs text-slate-600 leading-relaxed font-sans">
                  <div className="flex gap-3 items-start">
                    <span className="text-base mt-0.5">🏏</span>
                    <div>
                      <h4 className="font-extrabold text-slate-850">Under-9 Ball Faced Limits</h4>
                      <p className="text-slate-450 mt-0.5">To distribute gameplay fairly, each batsman faces a hard-stop limit of 20, 24, or 30 balls before compulsory retirement. (Configured at team batting setup).</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 items-start">
                    <span className="text-base mt-0.5">🔴</span>
                    <div>
                      <h4 className="font-extrabold text-slate-850">Bowler Over Caps and Extras</h4>
                      <p className="text-slate-450 mt-0.5">Wides and No-balls grant a 1-run penalty and count directly towards the bowler's 6-ball over cap. Pitch matches have a strict cap of 4 overs maximum per bowler.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 items-start">
                    <span className="text-base mt-0.5">⚡</span>
                    <div>
                      <h4 className="font-extrabold text-slate-850">Two-Extras Free Hit Trigger</h4>
                      <p className="text-slate-450 mt-0.5">If a bowler delivers consecutive invalid balls (No ball / Wide), the batsman receives a FREE HIT next. Off Free Hits, batsmen can only get dismissed via Run-Out or Retirement.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Roster & Typo Correction Modal overlay */}
      <CorrectTypos
        teams={teams}
        isOpen={isTypoModalOpen}
        onClose={() => setIsTypoModalOpen(false)}
        onSaveTeams={setTeams}
        onCorrectPlayerName={handleCorrectPlayerName}
      />

      {/* Scorecard Exporter Modal overlay */}
      <ScorecardExport
        teams={exportMatchData?.teams ?? teams}
        inningsList={exportMatchData?.inningsList ?? inningsList}
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportMatchData(null);
        }}
      />

      {/* Basic brand attribution */}
      <footer className="py-4 text-center text-slate-400 text-[10px] uppercase font-black border-t border-slate-200 mt-auto bg-white tracking-widest">
        U9 Cricket Scoring Engine • MCC Junior Format compliant
      </footer>
    </div>
  );
}
