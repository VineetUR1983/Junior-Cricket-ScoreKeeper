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
import EditBallModal from './components/EditBallModal';
import { db, saveMatch, deleteMatch, saveOverSnapshot, cleanUpSubsequentSnapshots, getLocalMatches, getLocalOverSnapshots } from './firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Trophy, RefreshCw, Play, BookOpen, RotateCcw, PencilLine, Plus, Trash2, Calendar, Loader2, Share2, Check } from 'lucide-react';

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

  // Ball Editing State
  const [selectedBallToEdit, setSelectedBallToEdit] = useState<BallRecord | null>(null);
  const [selectedBallIndex, setSelectedBallIndex] = useState<number>(-1);
  const [isEditBallModalOpen, setIsEditBallModalOpen] = useState<boolean>(false);

  const [currentInningsIndex, setCurrentInningsIndex] = useState<0 | 1 | 2>(0); // 0 = Setup, 1 = 1st Innings, 2 = 2nd Innings
  const [inningsList, setInningsList] = useState<[Innings | null, Innings | null]>([null, null]);
  const [manuallySelectedWinnerIndex, setManuallySelectedWinnerIndex] = useState<number | null>(null);

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
  const [matches, setMatches] = useState<any[]>(() => getLocalMatches());
  const [loadingMatches, setLoadingMatches] = useState<boolean>(true);
  const [overSnapshots, setOverSnapshots] = useState<any[]>([]);
  const [isTypoModalOpen, setIsTypoModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportMatchData, setExportMatchData] = useState<{ teams: [Team, Team]; inningsList: [Innings | null, Innings | null] } | null>(null);

  // Target Achieved verification states
  const [isTargetAchievedModalOpen, setIsTargetAchievedModalOpen] = useState<boolean>(false);
  const [hasDeclinedTargetPrompt, setHasDeclinedTargetPrompt] = useState<boolean>(false);

  // Target Achieved verification hook
  useEffect(() => {
    if (currentInningsIndex !== 2) {
      if (hasDeclinedTargetPrompt) {
        setHasDeclinedTargetPrompt(false);
      }
      if (isTargetAchievedModalOpen) {
        setIsTargetAchievedModalOpen(false);
      }
      return;
    }
    const firstInnings = inningsList[0];
    const secondInnings = inningsList[1];
    if (!firstInnings || !secondInnings || secondInnings.isCompleted) {
      if (hasDeclinedTargetPrompt) {
        setHasDeclinedTargetPrompt(false);
      }
      if (isTargetAchievedModalOpen) {
        setIsTargetAchievedModalOpen(false);
      }
      return;
    }

    const target = firstInnings.totalRuns + (secondInnings.totalWickets * 4) + 1;
    if (secondInnings.totalRuns >= target) {
      if (!hasDeclinedTargetPrompt && !isTargetAchievedModalOpen) {
        setIsTargetAchievedModalOpen(true);
      }
    } else {
      if (hasDeclinedTargetPrompt) {
        setHasDeclinedTargetPrompt(false);
      }
      if (isTargetAchievedModalOpen) {
        setIsTargetAchievedModalOpen(false);
      }
    }
  }, [currentInningsIndex, inningsList, hasDeclinedTargetPrompt, isTargetAchievedModalOpen]);

  // Handler to Declare Winner (conclude the match early if target achieved is acceptable and confirmed)
  const handleDeclareWinnerYes = () => {
    const first = inningsList[0];
    const second = inningsList[1];
    if (!first || !second) return;

    // Build updated second innings
    const updatedSecond = { ...second, isCompleted: true };
    const updatedInningsList = [first, updatedSecond] as [Innings | null, Innings | null];
    setInningsList(updatedInningsList);

    // Who won?
    const winnerIndex = second.battingTeamIndex;
    setManuallySelectedWinnerIndex(winnerIndex);

    // Sync to Firestore if there's an active match
    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, {
        inningsList: updatedInningsList,
        manuallySelectedWinnerIndex: winnerIndex,
      });
    }

    // Close the target achieved modal
    setIsTargetAchievedModalOpen(false);

    // Provide confirmation message to declare the winner
    alert(`Confirmation: Match concluded successfully! ${teams[winnerIndex].name} has been declared the winner.`);
  };

  // Listen to match changes in Firestore real-time
  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort in memory by updatedAt or createdAt desc to make sure recently played matches swim to the top
      list.sort((a, b) => {
        const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setMatches(list);
      setLoadingMatches(false);
    }, (err) => {
      console.error("Failed to load match listings from Firestore: ", err);
      // Perfect safe fallback to offline local records
      setMatches(getLocalMatches());
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
    // Set local snapshots immediately so there is no loading lag whatsoever on match resume
    setOverSnapshots(getLocalOverSnapshots(activeMatchId));

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
      manuallySelectedWinnerIndex?: number | null;
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
    const nextManuallySelectedWinnerIndex = updates.manuallySelectedWinnerIndex !== undefined ? updates.manuallySelectedWinnerIndex : manuallySelectedWinnerIndex;

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
      manuallySelectedWinnerIndex: nextManuallySelectedWinnerIndex,
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
    setManuallySelectedWinnerIndex(match.manuallySelectedWinnerIndex !== undefined ? match.manuallySelectedWinnerIndex : null);
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
      setManuallySelectedWinnerIndex(stateObj.manuallySelectedWinnerIndex !== undefined ? stateObj.manuallySelectedWinnerIndex : null);
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
      manuallySelectedWinnerIndex,
      currentInningsIndex,
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
    setManuallySelectedWinnerIndex(parsed.manuallySelectedWinnerIndex !== undefined ? parsed.manuallySelectedWinnerIndex : null);
    if (parsed.currentInningsIndex !== undefined) {
      setCurrentInningsIndex(parsed.currentInningsIndex);
    }

    setUndoStack((prev) => prev.slice(0, -1));

    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, {
        inningsList: parsed.inningsList,
        strikerId: parsed.strikerId,
        nonStrikerId: parsed.nonStrikerId,
        bowlerId: parsed.bowlerId,
        consecutiveExtras: parsed.consecutiveExtras,
        isFreeHitActive: parsed.isFreeHitActive,
        manuallySelectedWinnerIndex: parsed.manuallySelectedWinnerIndex !== undefined ? parsed.manuallySelectedWinnerIndex : null,
        currentInningsIndex: parsed.currentInningsIndex,
      });
    }
  };

  const recalculateInnings = (inn: Innings, battingTeam: Team, bowlingTeam: Team): Innings => {
    // 1. Re-initialize batters list to clean slate
    const resetBatters: BatterStats[] = battingTeam.players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      howOut: '',
    }));

    // 2. Re-initialize bowler list
    const resetBowlers: BowlerStats[] = [];

    // 3. Reset team totals
    let totalRuns = 0;
    let totalWickets = 0;
    let ballsBowledTotal = 0;
    const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };

    // 4. Process all balls in order
    inn.balls.forEach((b) => {
      const striker = resetBatters.find((bt) => bt.playerId === b.strikerId);

      // Bowler stats check
      if (b.bowlerId) {
        let bowler = resetBowlers.find((bw) => bw.playerId === b.bowlerId);
        if (!bowler) {
          const p = bowlingTeam.players.find((pl) => pl.id === b.bowlerId);
          bowler = {
            playerId: b.bowlerId,
            playerName: p ? p.name : 'Unknown',
            ballsBowled: 0,
            runsConceded: 0,
            wickets: 0,
            maidens: 0,
            wides: 0,
            noBalls: 0,
            oversHistory: {},
          };
          resetBowlers.push(bowler);
        }

        // Team and Bowler stats additions
        const runsBat = Number(b.runsFromBat || 0);
        const runsExt = Number(b.runsFromExtras || 0);
        const totalRunsThisBall = runsBat + runsExt;
        totalRuns += totalRunsThisBall;

        // Store cumulative stats for auditability
        b.cumulativeRuns = totalRuns;
        b.cumulativeWickets = totalWickets;

        // Batsman balls
        const countsTowardsBatsmanBalls = b.ballType !== 'FreeHit';
        if (striker && countsTowardsBatsmanBalls) {
          striker.ballsFaced += 1;
        }
        if (striker) {
          striker.runs += runsBat;
          if (runsBat === 4) striker.fours += 1;
          if (runsBat === 6) striker.sixes += 1;
        }

        // Bowler balls
        const countsTowardsBowlerBalls = b.ballType !== 'FreeHit';
        if (countsTowardsBowlerBalls) {
          ballsBowledTotal += 1;
          bowler.ballsBowled += 1;
        }

        let runsConcededToBowler = runsBat;
        if (b.ballType === 'Wide' || b.ballType === 'NoBall') {
          runsConcededToBowler += runsExt;
        }
        bowler.runsConceded += runsConcededToBowler;

        // Extras
        if (b.ballType === 'Wide') {
          bowler.wides += 1;
          extras.wides += runsExt;
        } else if (b.ballType === 'NoBall') {
          bowler.noBalls += 1;
          extras.noBalls += runsExt;
        } else if (b.extraType === 'Wide') {
          extras.wides += runsExt;
        } else if (b.extraType === 'NoBall') {
          extras.noBalls += runsExt;
        } else if (b.extraType === 'Bye') {
          extras.byes += runsExt;
        } else if (b.extraType === 'LegBye') {
          extras.legByes += runsExt;
        }

        // Wicket
        if (b.wicketType) {
          const outPlayer = resetBatters.find((bt) => bt.playerId === b.wicketPlayerId);
          if (outPlayer) {
            if (b.wicketType === 'Retired') {
              outPlayer.isOut = true;
              outPlayer.howOut = 'Retired';
            } else {
              totalWickets += 1;
              outPlayer.isOut = true;
              if (b.wicketType === 'Caught') {
                outPlayer.howOut = b.wicketFielderName ? `ct. ${b.wicketFielderName} b. ${bowler.playerName}` : `Caught b. ${bowler.playerName}`;
                outPlayer.caughtBy = b.wicketFielderName;
                outPlayer.bowledBy = bowler.playerName;
              } else if (b.wicketType === 'Bowled') {
                outPlayer.howOut = `b. ${bowler.playerName}`;
                outPlayer.bowledBy = bowler.playerName;
              } else if (b.wicketType === 'LBW') {
                outPlayer.howOut = `lbw b. ${bowler.playerName}`;
                outPlayer.bowledBy = bowler.playerName;
              } else if (b.wicketType === 'Stumped') {
                outPlayer.howOut = b.wicketFielderName ? `st. ${b.wicketFielderName} b. ${bowler.playerName}` : `Stumped b. ${bowler.playerName}`;
                outPlayer.stumpedBy = b.wicketFielderName;
                outPlayer.bowledBy = bowler.playerName;
              } else if (b.wicketType === 'Run Out') {
                outPlayer.howOut = b.wicketFielderName ? `Run Out (${b.wicketFielderName})` : `Run Out`;
                outPlayer.runOutBy = b.wicketFielderName;
              } else {
                outPlayer.howOut = b.wicketType;
              }

              if (b.wicketType !== 'Run Out') {
                bowler.wickets += 1;
              }
            }
          }
        }
      }
    });

    // Re-verify and apply ball limit retirement for physical bat exit, respecting Solo Striker status
    resetBatters.forEach((b) => {
      if (b.ballsFaced >= inn.batsmanBallLimit) {
        // Only retire if doing so does not leave the team with fewer than 2 active batsmen (Solo Striker Mode)
        const eligiblesCount = resetBatters.filter((rb) => !rb.isOut && !rb.howOut.includes('Retired')).length;
        if (eligiblesCount > 1) {
          b.isOut = true;
          if (b.howOut === 'Active' || b.howOut === '') {
            b.howOut = 'Retired (Limit Reached)';
          }
        }
      }
    });

    // Update currentOverBalls reference with newly updated balls to keep cumulative info synced
    const recalculatedCurrentOverBalls = inn.currentOverBalls.map((cob) => {
      const matchedBall = inn.balls.find((b) => b.ballId === cob.ballId);
      return matchedBall ? { ...matchedBall } : cob;
    });

    return {
      ...inn,
      balls: inn.balls,
      currentOverBalls: recalculatedCurrentOverBalls,
      totalRuns,
      totalWickets,
      ballsBowledTotal,
      extras,
      batters: resetBatters,
      bowlers: resetBowlers,
    };
  };

  const handleEndOver = () => {
    saveSnapshot();

    const inningsIdx = currentInningsIndex - 1;
    const innings = inningsList[inningsIdx];
    if (!innings) return;

    // Save snapshot of previous roster state to handle strike rotation properly
    let nextStrikerId = strikerId;
    let nextNonStrikerId = nonStrikerId;

    const updatedInnings = { ...innings };
    
    // Rotate strike (if not solo active)
    const currentBattersNotFinished = updatedInnings.batters.filter(
      (b) => !b.isOut && !b.howOut.includes('Retired') && b.ballsFaced < updatedInnings.batsmanBallLimit
    );
    const isSoloActive = currentBattersNotFinished.length === 1;

    if (nextStrikerId && nextNonStrikerId && !isSoloActive) {
      const temp = nextStrikerId;
      nextStrikerId = nextNonStrikerId;
      nextNonStrikerId = temp;
      setStrikerId(nextStrikerId);
      setNonStrikerId(nextNonStrikerId);
    }

    // Bowler is unassigned to force selection
    setBowlerId('');
    setConsecutiveExtras(0);
    setIsFreeHitActive(false);

    const currentOverNum = updatedInnings.currentOverBalls.length > 0 
      ? updatedInnings.currentOverBalls[updatedInnings.currentOverBalls.length - 1].overNum + 1
      : 1;

    // Manually clear current over balls block
    updatedInnings.currentOverBalls = [];

    const updatedInningsList = [...inningsList] as [Innings | null, Innings | null];
    updatedInningsList[inningsIdx] = updatedInnings;
    setInningsList(updatedInningsList);

    if (activeMatchId) {
      syncStateToFirestore(activeMatchId, {
        inningsList: updatedInningsList,
        strikerId: nextStrikerId,
        nonStrikerId: nextNonStrikerId,
        bowlerId: '',
        consecutiveExtras: 0,
        isFreeHitActive: false,
      });

      saveOverSnapshot(activeMatchId, currentOverNum, inningsIdx, {
        teams,
        currentInningsIndex,
        inningsList: updatedInningsList,
        strikerId: nextStrikerId,
        nonStrikerId: nextNonStrikerId,
        bowlerId: '',
        consecutiveExtras: 0,
        isFreeHitActive: false,
        teamsConfig: teams,
      });
    }

    alert('Current over completed! Strike rotated and bowler unassigned successfully.');
  };

  const propagateStrikerRotation = (
    balls: BallRecord[],
    startIndex: number,
    battingTeam: Team,
    batsmanBallLimit: number
  ): { updatedBalls: BallRecord[]; finalStrikerId: string; finalNonStrikerId: string } => {
    const updatedBalls = [...balls];
    const ballsFacedMap: { [playerId: string]: number } = {};
    const outBattersSet = new Set<string>();

    // 1. Initialize ballsFaced counts and dismissals/retirements up to startIndex
    for (let i = 0; i < startIndex; i++) {
      const b = updatedBalls[i];
      if (b.ballType !== 'FreeHit' && b.strikerId) {
        ballsFacedMap[b.strikerId] = (ballsFacedMap[b.strikerId] || 0) + 1;
      }
      if (b.isWicket || b.wicketType !== undefined) {
        if (b.wicketPlayerId) {
          outBattersSet.add(b.wicketPlayerId);
        }
      }
      if (b.strikerId && (ballsFacedMap[b.strikerId] || 0) >= batsmanBallLimit) {
        const eligibleCountCount = battingTeam.players.filter(
          (p) => !outBattersSet.has(p.id) && (ballsFacedMap[p.id] || 0) < batsmanBallLimit
        ).length;
        if (eligibleCountCount > 1) {
          outBattersSet.add(b.strikerId);
        }
      }
      if (b.nonStrikerId && (ballsFacedMap[b.nonStrikerId] || 0) >= batsmanBallLimit) {
        const eligibleCountCount = battingTeam.players.filter(
          (p) => !outBattersSet.has(p.id) && (ballsFacedMap[p.id] || 0) < batsmanBallLimit
        ).length;
        if (eligibleCountCount > 1) {
          outBattersSet.add(b.nonStrikerId);
        }
      }
    }

    // 2. Initialize simulation striker and non-striker at startIndex
    let currStrikerId = startIndex < updatedBalls.length ? updatedBalls[startIndex].strikerId : '';
    let currNonStrikerId = startIndex < updatedBalls.length ? updatedBalls[startIndex].nonStrikerId : '';
    let previousOverNum = startIndex < updatedBalls.length ? updatedBalls[startIndex].overNum : -1;

    // 3. Keep simulating forward from startIndex to the end of the balls list
    for (let i = startIndex; i < updatedBalls.length; i++) {
      const b = { ...updatedBalls[i] };
      const origStrikerId = b.strikerId;
      const origNonStrikerId = b.nonStrikerId;

      // Handle transitions between overs
      if (previousOverNum !== -1 && b.overNum !== previousOverNum) {
        const eligibleCount = battingTeam.players.filter(
          (p) => !outBattersSet.has(p.id) && (ballsFacedMap[p.id] || 0) < batsmanBallLimit
        ).length;
        const isSoloActiveAtOverEnd = eligibleCount === 1;
        if (currStrikerId && currNonStrikerId && !isSoloActiveAtOverEnd) {
          const temp = currStrikerId;
          currStrikerId = currNonStrikerId;
          currNonStrikerId = temp;
        }
      }
      previousOverNum = b.overNum;

      if (i > startIndex) {
        // Detect and resolve manual replacements / batsman incoming assignments
        const activeSim = new Set([currStrikerId, currNonStrikerId].filter((id) => id !== ''));
        const newBatters = [];
        if (origStrikerId && !activeSim.has(origStrikerId)) {
          newBatters.push(origStrikerId);
        }
        if (origNonStrikerId && !activeSim.has(origNonStrikerId) && origNonStrikerId !== origStrikerId) {
          newBatters.push(origNonStrikerId);
        }

        if (newBatters.length > 0) {
          // Identify simulation player who was replaced
          const replacedId = [currStrikerId, currNonStrikerId].find(
            (id) => id && id !== origStrikerId && id !== origNonStrikerId
          );
          if (replacedId) {
            if (currStrikerId === replacedId) {
              currStrikerId = newBatters.shift() || '';
            } else {
              currNonStrikerId = newBatters.shift() || '';
            }
          }

          while (newBatters.length > 0) {
            if (currStrikerId === '') {
              currStrikerId = newBatters.shift() || '';
            } else if (currNonStrikerId === '') {
              currNonStrikerId = newBatters.shift() || '';
            } else {
              break;
            }
          }
        }

        b.strikerId = currStrikerId;
        b.nonStrikerId = currNonStrikerId;
      }

      // Count balls faced
      const countsTowardsBatsmanBalls = b.ballType !== 'FreeHit';
      if (currStrikerId && countsTowardsBatsmanBalls) {
        ballsFacedMap[currStrikerId] = (ballsFacedMap[currStrikerId] || 0) + 1;
      }

      // Handle wickets / dismissals
      const gotOut = b.isWicket || b.wicketType !== undefined;
      const dismissedPlayerId = b.wicketPlayerId || currStrikerId;
      if (gotOut && dismissedPlayerId) {
        outBattersSet.add(dismissedPlayerId);
        if (dismissedPlayerId === currStrikerId) {
          currStrikerId = '';
        } else if (dismissedPlayerId === currNonStrikerId) {
          currNonStrikerId = '';
        }
      }

      // Handle compulsory retirements upon hitting the ball limit, respecting Solo Striker status
      if (currStrikerId && (ballsFacedMap[currStrikerId] || 0) >= batsmanBallLimit) {
        const eligibleCountCount = battingTeam.players.filter(
          (p) => !outBattersSet.has(p.id) && (ballsFacedMap[p.id] || 0) < batsmanBallLimit
        ).length;
        if (eligibleCountCount > 1) {
          outBattersSet.add(currStrikerId);
          currStrikerId = '';
        }
      }
      if (currNonStrikerId && (ballsFacedMap[currNonStrikerId] || 0) >= batsmanBallLimit) {
        const eligibleCountCount = battingTeam.players.filter(
          (p) => !outBattersSet.has(p.id) && (ballsFacedMap[p.id] || 0) < batsmanBallLimit
        ).length;
        if (eligibleCountCount > 1) {
          outBattersSet.add(currNonStrikerId);
          currNonStrikerId = '';
        }
      }

      // Calculate strike rotation for this ball
      const eligibleBattersList = battingTeam.players.filter(
        (p) => !outBattersSet.has(p.id) && (ballsFacedMap[p.id] || 0) < batsmanBallLimit
      );
      const isSoloActive = eligibleBattersList.length === 1;

      const isByeOrLegBye = b.extraType === 'Bye' || b.extraType === 'LegBye';
      const physicalRuns = isByeOrLegBye ? b.runsFromExtras : b.runsFromBat;
      const rotatingRuns = (physicalRuns % 2) !== 0;

      if (rotatingRuns && currStrikerId && currNonStrikerId && !gotOut && !isSoloActive) {
        const temp = currStrikerId;
        currStrikerId = currNonStrikerId;
        currNonStrikerId = temp;
      }

      if (isSoloActive) {
        const specialBatter = eligibleBattersList[0];
        currStrikerId = specialBatter.id;

        if (!currNonStrikerId || currNonStrikerId === currStrikerId) {
          const partner = battingTeam.players.find((p) => p.id !== specialBatter.id);
          currNonStrikerId = partner ? partner.id : '';
        }
      }

      updatedBalls[i] = b;
    }

    return {
      updatedBalls,
      finalStrikerId: currStrikerId,
      finalNonStrikerId: currNonStrikerId,
    };
  };

  const handleSaveEditedBall = (updatedBall: BallRecord) => {
    saveSnapshot();

    let inningsIdx = inningsList.findIndex(inn => inn && inn.balls.some(b => b.ballId === updatedBall.ballId));
    if (inningsIdx === -1) {
      inningsIdx = currentInningsIndex - 1;
    }
    const innings = inningsList[inningsIdx];
    if (!innings) return;

    const battingTeam = teams[innings.battingTeamIndex];
    const bowlingTeam = teams[innings.bowlingTeamIndex];
    if (!battingTeam || !bowlingTeam) return;

    // 1. Swap the edited ball inside local arrays first
    const updatedBalls = innings.balls.map((b) => {
      if (updatedBall.ballId && b.ballId === updatedBall.ballId) {
        return updatedBall;
      }
      return b;
    });

    const ballIndex = updatedBalls.findIndex((b) => b.ballId === updatedBall.ballId);

    // 2. Propagate striker rotation starting from this ball
    const {
      updatedBalls: propagatedBalls,
      finalStrikerId,
      finalNonStrikerId,
    } = propagateStrikerRotation(
      updatedBalls,
      ballIndex !== -1 ? ballIndex : 0,
      battingTeam,
      innings.batsmanBallLimit || 24
    );

    // 3. Re-map current over balls using the fully propagated balls array
    const updatedCurrentOverBalls = innings.currentOverBalls.map((cob) => {
      const matchedBall = propagatedBalls.find((b) => b.ballId === cob.ballId);
      return matchedBall ? { ...matchedBall } : cob;
    });

    const updatedInnings = {
      ...innings,
      balls: propagatedBalls,
      currentOverBalls: updatedCurrentOverBalls,
    };

    const recalculated = recalculateInnings(updatedInnings, battingTeam, bowlingTeam);

    // 4. Update core state variables if it's the active innings
    if (inningsIdx === currentInningsIndex - 1) {
      setStrikerId(finalStrikerId);
      setNonStrikerId(finalNonStrikerId);
      recalculated.activeStrikerId = finalStrikerId;
      recalculated.activeNonStrikerId = finalNonStrikerId;
    }

    const updatedInningsList = [...inningsList] as [Innings | null, Innings | null];
    updatedInningsList[inningsIdx] = recalculated;
    setInningsList(updatedInningsList);

    if (activeMatchId) {
      const updatedFields: any = {
        inningsList: updatedInningsList,
      };
      if (inningsIdx === currentInningsIndex - 1) {
        updatedFields.strikerId = finalStrikerId;
        updatedFields.nonStrikerId = finalNonStrikerId;
      }
      syncStateToFirestore(activeMatchId, updatedFields);
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
      batsmanBallLimit: teamA.batsmanBallLimit || matchBatsmanBallLimit || 24,
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

    setManuallySelectedWinnerIndex(null);

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
      manuallySelectedWinnerIndex: null,
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
      batsmanBallLimit: teamB.batsmanBallLimit || matchBatsmanBallLimit || 24,
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

    const currentEligibles = updatedBatters.filter((b) => !b.isOut && !b.howOut.includes('Retired'));
    const isSoloModeActive = currentEligibles.length === 1;

    if (!strikerStats) {
      alert('Please activate Striker first!');
      return;
    }

    if (!nonStrikerStats && !isSoloModeActive) {
      alert('Please activate Non-Striker first!');
      return;
    }

    const countsTowardsBowlerBalls = ballData.ballType !== 'FreeHit';

    let overNum = 0;
    if (updatedInnings.balls.length === 0) {
      overNum = 0;
    } else if (updatedInnings.currentOverBalls.length === 0) {
      overNum = updatedInnings.balls[updatedInnings.balls.length - 1].overNum + 1;
    } else {
      overNum = updatedInnings.currentOverBalls[updatedInnings.currentOverBalls.length - 1].overNum;
    }

    const previousBowlerBallsCount = updatedInnings.currentOverBalls.filter(
      (b) => b.ballType !== 'FreeHit'
    ).length;
    let ballNumInOver = countsTowardsBowlerBalls ? previousBowlerBallsCount + 1 : 0;

    const totalRunsThisBall = ballData.runsFromBat + ballData.runsFromExtras;
    updatedInnings.totalRuns += totalRunsThisBall;

    const countsTowardsBatsmanBalls = ballData.ballType !== 'FreeHit' && !isFreeHitActive;
    if (countsTowardsBatsmanBalls) {
      strikerStats.ballsFaced += 1;
    }

    strikerStats.runs += ballData.runsFromBat;
    if (ballData.runsFromBat === 4) strikerStats.fours += 1;
    if (ballData.runsFromBat === 6) strikerStats.sixes += 1;

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
        gotOut = true;

        if (ballData.wicketType === 'Retired') {
          outPlayerStats.isOut = true;
          outPlayerStats.howOut = 'Retired';
          wicketDetailsString = `Retired: ${outPlayerStats.playerName}`;
        } else {
          // It's a real dismissal (wicket)
          outPlayerStats.isOut = true;
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

        if (ballData.wicketType === 'Retired') {
          if (ballData.wicketPlayerId === strikerId) {
            setStrikerId('');
          } else if (ballData.wicketPlayerId === nonStrikerId) {
            setNonStrikerId('');
          }
        }
      }
    }

    const additionalRunsRecorded = ballData.ballType === 'Wide' || ballData.ballType === 'NoBall'
      ? Math.max(0, ballData.runsFromExtras - 1)
      : ballData.runsFromExtras;

    let ballDescription = `${bowlerStats.playerName} to ${strikerStats.playerName}: `;
    if (gotOut) {
      ballDescription += wicketDetailsString;
    } else if (ballData.ballType === 'Wide') {
      if (additionalRunsRecorded > 0) {
        ballDescription += `Wide delivery + ${additionalRunsRecorded} extra run${additionalRunsRecorded > 1 ? 's' : ''}`;
      } else {
        ballDescription += `Wide delivery`;
      }
    } else if (ballData.ballType === 'NoBall') {
      if (ballData.runsFromBat > 0) {
        ballDescription += `No ball delivery, ${ballData.runsFromBat} run${ballData.runsFromBat > 1 ? 's' : ''} scored off bat`;
      } else if (additionalRunsRecorded > 0) {
        ballDescription += `No ball delivery + ${additionalRunsRecorded} extra run${additionalRunsRecorded > 1 ? 's' : ''}`;
      } else {
        ballDescription += `No ball delivery`;
      }
    } else if (ballData.ballType === 'FreeHit') {
      ballDescription += `Free hit delivery scored for ${ballData.runsFromBat}`;
    } else if (ballData.extraType === 'Bye' && additionalRunsRecorded > 0) {
      ballDescription += `Byes, ${additionalRunsRecorded} extra run${additionalRunsRecorded > 1 ? 's' : ''}`;
    } else if (ballData.extraType === 'LegBye' && additionalRunsRecorded > 0) {
      ballDescription += `Leg byes, ${additionalRunsRecorded} extra run${additionalRunsRecorded > 1 ? 's' : ''}`;
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
      ballId: `${overNum}-${ballNumInOver}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
      cumulativeRuns: updatedInnings.totalRuns,
      cumulativeWickets: updatedInnings.totalWickets,
    };

    updatedInnings.balls.push(ballRecord);
    updatedInnings.currentOverBalls.push(ballRecord);

    let nextStrikerId = strikerId;
    let nextNonStrikerId = nonStrikerId;
    let nextBowlerId = bowlerId;
    let nextConsecutiveExtras = consecutiveExtras;
    let nextIsFreeHitActive = isFreeHitActive;

    // Handle wicket out
    if (gotOut && ballData.wicketType === 'Retired') {
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

    // Runs of Bat determines strike rotation: odd runs strike rotates, even runs strike remains with the striker.
    // Also including Byes/Leg Byes which are physically run.
    const isByeOrLegBye = ballData.extraType === 'Bye' || ballData.extraType === 'LegBye';
    const physicalRuns = isByeOrLegBye ? ballData.runsFromExtras : ballData.runsFromBat;
    const rotatingRuns = (physicalRuns % 2) !== 0;

    if (rotatingRuns && nextStrikerId && nextNonStrikerId && !gotOut && !isSoloActive) {
      const temp = nextStrikerId;
      nextStrikerId = nextNonStrikerId;
      nextNonStrikerId = temp;
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

    // Over completed check is now manually decided by the scorer via 'END OVER' button
    let isOverCompleted = false;

    // Batsman retirement limit check (after all strike rotations are done)
    let hasRetired = false;
    let retiredPlayerNames: string[] = [];

    const nextStrikerStats = nextStrikerId ? updatedBatters.find((b) => b.playerId === nextStrikerId) : null;
    const nextNonStrikerStats = nextNonStrikerId ? updatedBatters.find((b) => b.playerId === nextNonStrikerId) : null;

    // Check striker limit
    if (nextStrikerStats && nextStrikerStats.ballsFaced >= updatedInnings.batsmanBallLimit) {
      if (nextIsFreeHitActive) {
        // "If Ball limit is reached for the Striker who is supposed to face the free hit, then allow"
      } else {
        const eligibleCount = updatedBatters.filter((b) => !b.isOut && !b.howOut.includes('Retired')).length;
        if (eligibleCount > 1) {
          nextStrikerStats.isOut = true;
          if (nextStrikerStats.howOut === 'Active' || nextStrikerStats.howOut === '') {
            nextStrikerStats.howOut = 'Retired (Limit Reached)';
          }
          nextStrikerId = '';
          hasRetired = true;
          retiredPlayerNames.push(nextStrikerStats.playerName);
        }
      }
    }

    // Check non-striker limit
    if (nextNonStrikerStats && nextNonStrikerStats.ballsFaced >= updatedInnings.batsmanBallLimit) {
      // "if the Non striker reached the ball limit then retire the player."
      const currentEligibleCount = updatedBatters.filter((b) => !b.isOut && !b.howOut.includes('Retired')).length;
      if (currentEligibleCount > 1) {
        nextNonStrikerStats.isOut = true;
        if (nextNonStrikerStats.howOut === 'Active' || nextNonStrikerStats.howOut === '') {
          nextNonStrikerStats.howOut = 'Retired (Limit Reached)';
        }
        nextNonStrikerId = '';
        hasRetired = true;
        retiredPlayerNames.push(nextNonStrikerStats.playerName);
      }
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
    if (isCompletedInnings && nextIsFreeHitActive && eligibleBatters.length > 0) {
      isCompletedInnings = false;
    }

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
        alert(`1st Innings completed! Target score is ${(updatedInnings.totalRuns + 1)} runs. (Note: Opposition Wicket Penalties of +4 runs per wicket will be dynamically added as wickets are lost during the chase)`);
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
    if (retiredPlayerNames.length > 0) {
      retiredPlayerNames.forEach((name) => {
        alert(`Batter ${name} has hit the retirement limit of ${updatedInnings.batsmanBallLimit} balls! Assign a new batsman.`);
      });
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
    if (!activeMatchId) {
      // Fallback if no match is active
      if (window.confirm("No active match ID found. Return to setup screen?")) {
        setInningsList([null, null]);
        setCurrentInningsIndex(0);
        setStrikerId('');
        setNonStrikerId('');
        setBowlerId('');
        setConsecutiveExtras(0);
        setIsFreeHitActive(false);
        setUndoStack([]);
        setActiveMatchId(null);
        setManuallySelectedWinnerIndex(null);
      }
      return;
    }

    const confirmMessage = "Are you sure you want to reset all progress for the current match only to 0? This will permanently wipe all recorded runs, wickets, overs, balls, and snapshots for this match, letting you score it again from the beginning.";
    if (window.confirm(confirmMessage)) {
      const battingTeamIdx = 0;
      const bowlingTeamIdx = 1;
      const teamA = teams[battingTeamIdx];
      const teamB = teams[bowlingTeamIdx];

      const initialInnings: Innings = {
        battingTeamIndex: battingTeamIdx,
        bowlingTeamIndex: bowlingTeamIdx,
        batsmanBallLimit: teamA.batsmanBallLimit || matchBatsmanBallLimit || 24,
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
      const defaultStrikerId = teamA.players[0]?.id || '';
      const defaultNonStrikerId = teamA.players[1]?.id || '';
      const defaultBowlerId = teamB.players[0]?.id || '';

      // Update local state variables immediately
      setInningsList(nextInningsList);
      setCurrentInningsIndex(1); // Play mode start
      setStrikerId(defaultStrikerId);
      setNonStrikerId(defaultNonStrikerId);
      setBowlerId(defaultBowlerId);
      setConsecutiveExtras(0);
      setIsFreeHitActive(false);
      setUndoStack([]);
      setManuallySelectedWinnerIndex(null);

      // Clean snapshots database both locally and in Firestore
      cleanUpSubsequentSnapshots(activeMatchId, -1, 0);
      cleanUpSubsequentSnapshots(activeMatchId, -1, 1);

      // Save match state data as clean status to Local storage database and Firestore
      syncStateToFirestore(activeMatchId, {
        teams,
        currentInningsIndex: 1,
        inningsList: nextInningsList,
        strikerId: defaultStrikerId,
        nonStrikerId: defaultNonStrikerId,
        bowlerId: defaultBowlerId,
        consecutiveExtras: 0,
        isFreeHitActive: false,
        matchOvers,
        matchBatsmanBallLimit,
        manuallySelectedWinnerIndex: null,
      });
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
    ? (selectedInnings.batters.find((b) => b.playerId === strikerId && !b.isOut && !b.howOut.includes('Retired')) || null)
    : null;
  const activeNonStriker = selectedInnings
    ? (selectedInnings.batters.find((b) => b.playerId === nonStrikerId && !b.isOut && !b.howOut.includes('Retired')) || null)
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

    if (manuallySelectedWinnerIndex === null) {
      return 'Awaiting Scorer Verification & Selection';
    }

    if (manuallySelectedWinnerIndex === -1) {
      return 'Match tied (Equal Totals) 🤝';
    }

    const firstGrand = first.totalRuns + second.totalWickets * 4;
    const secondGrand = second.totalRuns + first.totalWickets * 4;
    const runDiff = Math.abs(firstGrand - secondGrand);
    const winnerName = teams[manuallySelectedWinnerIndex].name;
    return `${winnerName} won by ${runDiff} runs 🏆`;
  };

  const ballsFacedLimit = selectedInnings?.batsmanBallLimit || matchBatsmanBallLimit || 24;

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
                  Overs History & Backups
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
              <div className="bg-white border border-slate-205 p-6 rounded-3xl shadow-sm space-y-6 text-center animate-in fade-in duration-300" id="whole-match-concluded-container">
                <Trophy className="w-12 h-12 text-indigo-650 mx-auto animate-bounce" />
                
                {manuallySelectedWinnerIndex === null ? (
                  <div className="space-y-4 max-w-md mx-auto" id="winner-manual-selection-section">
                    <div>
                      <span className="text-[10px] uppercase font-black text-amber-600 tracking-widest bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100">Scorer Verification Action Required</span>
                      <h2 className="text-base font-black text-slate-800 tracking-tight mt-2" id="verification-title">Verify Scores & Select Winning Team</h2>
                      <p className="text-xs text-slate-450 font-medium">Review the recorded innings totals and designate the winner manually.</p>
                    </div>

                    {/* Score comparative card */}
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 grid grid-cols-2 divide-x divide-slate-200">
                      <div className="pr-2 text-center">
                        <p className="text-[10px] font-bold text-slate-450 truncate uppercase">{teams[inningsList[0]!.battingTeamIndex].name}</p>
                        <p className="text-lg font-black text-indigo-750 mt-1">{inningsList[0]!.totalRuns + (inningsList[1]!.totalWickets * 4)} runs</p>
                        <p className="text-[9px] text-slate-500 font-bold">(Batting: {inningsList[0]!.totalRuns}, Wkts lost: {inningsList[0]!.totalWickets})</p>
                        <p className="text-[9px] text-amber-700 font-black mt-0.5">(Opponent Wkts Penalty: +{inningsList[1]!.totalWickets * 4})</p>
                      </div>
                      <div className="pl-2 text-center">
                        <p className="text-[10px] font-bold text-slate-450 truncate uppercase">{teams[inningsList[1]!.battingTeamIndex].name}</p>
                        <p className="text-lg font-black text-indigo-750 mt-1">{inningsList[1]!.totalRuns + (inningsList[0]!.totalWickets * 4)} runs</p>
                        <p className="text-[9px] text-slate-500 font-bold">(Batting: {inningsList[1]!.totalRuns}, Wkts lost: {inningsList[1]!.totalWickets})</p>
                        <p className="text-[9px] text-amber-700 font-black mt-0.5">(Opponent Wkts Penalty: +{inningsList[0]!.totalWickets * 4})</p>
                      </div>
                    </div>

                    {/* Handover manual triggers group */}
                    <div className="space-y-2 pt-1.5 flex flex-col items-center">
                      <button
                        onClick={() => {
                          setManuallySelectedWinnerIndex(0);
                          if (activeMatchId) syncStateToFirestore(activeMatchId, { manuallySelectedWinnerIndex: 0 });
                        }}
                        className="w-full py-2.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-indigo-700 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                        id="btn-manual-winner-team-a"
                      >
                        Designate {teams[0].name} as Winner
                      </button>
                      <button
                        onClick={() => {
                          setManuallySelectedWinnerIndex(1);
                          if (activeMatchId) syncStateToFirestore(activeMatchId, { manuallySelectedWinnerIndex: 1 });
                        }}
                        className="w-full py-2.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-indigo-700 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                        id="btn-manual-winner-team-b"
                      >
                        Designate {teams[1].name} as Winner
                      </button>
                      <button
                        onClick={() => {
                          setManuallySelectedWinnerIndex(-1);
                          if (activeMatchId) syncStateToFirestore(activeMatchId, { manuallySelectedWinnerIndex: -1 });
                        }}
                        className="w-full py-2 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        id="btn-manual-winner-tie"
                      >
                        Designate Match as Tied / Draw
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3" id="verified-result-section">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-md inline-block border border-emerald-100">Verified Result Selected</p>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1" id="verified-result-title">{getMatchResultsSummary()}</h2>
                    
                    {/* Re-trigger manual chooser option */}
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setManuallySelectedWinnerIndex(null);
                          if (activeMatchId) syncStateToFirestore(activeMatchId, { manuallySelectedWinnerIndex: null });
                        }}
                        className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg text-[9px] uppercase font-bold tracking-wider transition-all cursor-pointer"
                        id="btn-change-manual-selection"
                      >
                        Change Winner Selection
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-450 font-semibold max-w-sm mx-auto leading-relaxed">
                  The final statistics and rosters have been compiled safely. Standard under-9 custom metrics were fully utilized for calculations.
                </p>

                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleReopenInnings}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs transition-shadow"
                    id="btn-reopen-concluded-innings"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Undo Completion / Resume Match</span>
                  </button>
                  <button
                    onClick={handleResetMatch}
                    className="px-6 py-2.5 bg-slate-900 border border-slate-900/80 text-white hover:bg-slate-805 font-black uppercase text-[10px] tracking-wider rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs transition-shadow"
                    id="btn-reset-concluded-match"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Commence new match</span>
                  </button>
                  <button
                    onClick={() => {
                      setExportMatchData({
                        teams: teams,
                        inningsList: inningsList,
                        manuallySelectedWinnerIndex: manuallySelectedWinnerIndex
                      });
                      setIsExportModalOpen(true);
                    }}
                    className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={manuallySelectedWinnerIndex === null}
                    id="btn-export-concluded-scorecard"
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
                targetRuns={currentInningsIndex === 2 ? (inningsList[0]?.totalRuns || 0) + (inningsList[1]?.totalWickets || 0) * 4 + 1 : undefined}
                opponentWickets={currentInningsIndex === 1 ? (inningsList[1]?.totalWickets || 0) : (inningsList[0]?.totalWickets || 0)}
                wicketKeeper1Id={selectedInnings.wicketKeeper1Id}
                wicketKeeper2Id={selectedInnings.wicketKeeper2Id}
                isSpecialSingleActive={isSpecialSingleActive}
                matchOvers={matchOvers}
                onSelectBallToEdit={(ball, idx) => {
                  setSelectedBallToEdit(ball);
                  setSelectedBallIndex(idx);
                  setIsEditBallModalOpen(true);
                }}
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
                onEndOver={handleEndOver}
                currentOverBalls={selectedInnings.currentOverBalls}
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
                inningsList={inningsList}
                teams={teams}
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
        manuallySelectedWinnerIndex={exportMatchData?.manuallySelectedWinnerIndex !== undefined ? exportMatchData.manuallySelectedWinnerIndex : manuallySelectedWinnerIndex}
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportMatchData(null);
        }}
      />

      {/* Dynamic Ball Editor Modal overlay */}
      <EditBallModal
        isOpen={isEditBallModalOpen}
        onClose={() => {
          setIsEditBallModalOpen(false);
          setSelectedBallToEdit(null);
          setSelectedBallIndex(-1);
        }}
        ball={selectedBallToEdit}
        ballIndex={selectedBallIndex}
        onSave={handleSaveEditedBall}
        battingPlayers={currentBattingTeam?.players ?? []}
        fieldingPlayers={currentBowlingTeam?.players ?? []}
      />

      {/* Target Achieved Pop Up Modal */}
      {isTargetAchievedModalOpen && currentInningsIndex === 2 && inningsList[0] && inningsList[1] && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200" id="target-achieved-modal">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-lg border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-emerald-50 text-emerald-950 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight" id="target-achieved-title">Target Achieved!</h3>
                <p className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-widest mt-0.5">
                  Second Innings Chase Complete
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-slate-700">
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                The chasing team <b>{teams[inningsList[1].battingTeamIndex].name}</b> has successfully achieved or exceeded the target of <b>{(inningsList[0]?.totalRuns || 0) + (inningsList[1]?.totalWickets || 0) * 4 + 1}</b> runs!
              </p>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium space-y-2" id="innings-completion-summary">
                <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Match Summary</h4>
                <div className="grid grid-cols-2 gap-y-1.5 pt-0.5 mt-1 border-t border-slate-100 pr-1.5">
                  <div className="text-slate-400">1st Innings:</div>
                  <div className="font-extrabold text-slate-800">{teams[inningsList[0].battingTeamIndex].name} ({inningsList[0]?.totalRuns} runs, {inningsList[0]?.totalWickets} wkts)</div>
                  
                  <div className="text-slate-400">Chasing Team:</div>
                  <div className="font-extrabold text-slate-800">{teams[inningsList[1].battingTeamIndex].name}</div>
                  
                  <div className="text-slate-400">Current Score:</div>
                  <div className="font-extrabold text-slate-800">{inningsList[1]?.totalRuns} / {inningsList[1]?.totalWickets}</div>

                  <div className="text-slate-400">Overs Bowled:</div>
                  <div className="font-extrabold text-slate-800">
                    {Math.floor(inningsList[1]?.ballsBowledTotal / 6)}.{inningsList[1]?.ballsBowledTotal % 6} overs
                  </div>

                  <div className="text-slate-400 font-semibold text-slate-500">Active Target:</div>
                  <div className="font-black text-indigo-650">{(inningsList[0]?.totalRuns || 0) + (inningsList[1]?.totalWickets || 0) * 4 + 1} runs</div>
                </div>
              </div>

              <div className="py-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Verify Decision</label>
                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                  Would you like to conclude the match now and declare <span className="text-emerald-700 font-extrabold">{teams[inningsList[1].battingTeamIndex].name}</span> as the winner?
                </p>
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end items-center">
              <button
                type="button"
                onClick={() => {
                  setHasDeclinedTargetPrompt(true);
                  setIsTargetAchievedModalOpen(false);
                }}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                id="btn-target-modal-no"
              >
                No, Continue Match
              </button>
              <button
                type="button"
                onClick={handleDeclareWinnerYes}
                className="py-2.5 px-5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                id="btn-target-modal-yes"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Yes, Declare Winner</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basic brand attribution */}
      <footer className="py-4 text-center text-slate-400 text-[10px] uppercase font-black border-t border-slate-200 mt-auto bg-white tracking-widest">
        U9 Cricket Scoring Engine • MCC Junior Format compliant
      </footer>
    </div>
  );
}
