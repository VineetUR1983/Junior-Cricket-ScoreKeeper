/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  RotateCcw, 
  ShieldCheck, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  History, 
  Trophy, 
  User 
} from 'lucide-react';
import { BallRecord, Innings, Team } from '../types';

interface OversRecoveryProps {
  overSnapshots: any[];
  inningsIndex: number;
  onRestoreSnapshot: (snapshot: any) => void;
  inningsList?: [Innings | null, Innings | null];
  teams?: [Team, Team];
}

export default function OversRecovery({ 
  overSnapshots, 
  inningsIndex, 
  onRestoreSnapshot,
  inningsList,
  teams
}: OversRecoveryProps) {

  // Current active innings being scored
  const currentInnings = inningsList?.[inningsIndex];
  const battingTeam = currentInnings ? teams?.[currentInnings.battingTeamIndex] : null;
  const bowlingTeam = currentInnings ? teams?.[currentInnings.bowlingTeamIndex] : null;

  // Track expanded state for live overs detail
  const [expandedOvers, setExpandedOvers] = useState<{ [overNum: number]: boolean }>({
    // Expand the latest over by default if available
  });

  // Track expanded state for cloud snapshot overs detail
  const [expandedSnapshotOvers, setExpandedSnapshotOvers] = useState<{ [snapId: string]: boolean }>({});

  // Helper to extract player names robustly
  const getPlayerName = (playerId: string): string => {
    if (!playerId) return 'Unknown';
    const cleanId = playerId.trim();
    const bPlayer = battingTeam?.players.find(p => p.id === cleanId);
    if (bPlayer) return bPlayer.name;
    const fPlayer = bowlingTeam?.players.find(p => p.id === cleanId);
    if (fPlayer) return fPlayer.name;
    return playerId.split('-')[1] || playerId;
  };

  // Format balls bowled (6 valid balls = 1 over)
  const formatOversCount = (balls: number) => {
    const overs = Math.floor(balls / 6);
    const rem = balls % 6;
    return `${overs}.${rem}`;
  };

  // Helper to construct exact ball code display (same as Scoreboard for consistency)
  const getBallText = (b: BallRecord): string => {
    if (b.isWicket) return 'W';

    const runsFromBat = b.runsFromBat || 0;
    const runsFromExtras = b.runsFromExtras || 0;

    if (b.ballType === 'Wide' || b.extraType === 'Wide') {
      const suffix = runsFromBat > 0 ? `+${runsFromBat}` : '';
      const prefix = runsFromExtras > 1 ? `${runsFromExtras}` : '';
      return `${prefix}Wd${suffix}`;
    }

    if (b.ballType === 'NoBall' || b.extraType === 'NoBall') {
      const suffix = runsFromBat > 0 ? `+${runsFromBat}` : '';
      const prefix = runsFromExtras > 1 ? `${runsFromExtras}` : '';
      return `${prefix}Nb${suffix}`;
    }

    if (b.extraType === 'Bye') {
      const prefix = runsFromExtras > 1 ? `${runsFromExtras}` : '';
      return `${prefix}By`;
    }

    if (b.extraType === 'LegBye') {
      const prefix = runsFromExtras > 1 ? `${runsFromExtras}` : '';
      return `${prefix}Lb`;
    }

    return `${runsFromBat}`;
  };

  // Get color badges for balls
  const getBallColorClasses = (b: BallRecord) => {
    if (b.isWicket) {
      return 'bg-red-500 text-white border-red-650 font-black shadow-sm';
    }
    if (b.ballType === 'Wide' || b.extraType === 'Wide') {
      return 'bg-amber-100 text-amber-850 border-amber-300 font-extrabold';
    }
    if (b.ballType === 'NoBall' || b.extraType === 'NoBall') {
      return 'bg-amber-100 text-amber-900 border-amber-400 font-extrabold';
    }
    if (b.extraType === 'Bye' || b.extraType === 'LegBye') {
      return 'bg-sky-100 text-sky-850 border-sky-300 font-bold';
    }
    if (b.runsFromBat === 4) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-250 font-black';
    }
    if (b.runsFromBat === 6) {
      return 'bg-indigo-650 text-white border-indigo-700 font-black shadow-xs';
    }
    if (b.runsFromBat === 0) {
      return 'bg-slate-50 text-slate-400 border-slate-200 font-semibold';
    }
    return 'bg-slate-100 text-slate-800 border-slate-250 font-extrabold';
  };

  // Group current live balls by over
  const groupedLiveOvers: { [overNum: number]: BallRecord[] } = {};
  if (currentInnings?.balls) {
    currentInnings.balls.forEach((ball) => {
      const oNum = ball.overNum;
      if (!groupedLiveOvers[oNum]) {
        groupedLiveOvers[oNum] = [];
      }
      groupedLiveOvers[oNum].push(ball);
    });
  }

  // Live overs keys sorted sequentially (first over to last over)
  const sortedLiveOverNums = Object.keys(groupedLiveOvers)
    .map(Number)
    .sort((a, b) => a - b);

  // Filter snapshots matching this innings indices
  const currentInningsSnapshots = overSnapshots
    .filter((snap) => snap.inningsIndex === inningsIndex)
    .sort((a, b) => a.overNumber - b.overNumber);

  // Toggle helpers
  const toggleLiveOver = (overNum: number) => {
    setExpandedOvers(prev => ({ ...prev, [overNum]: !prev[overNum] }));
  };

  const toggleSnapshotOver = (snapId: string) => {
    setExpandedSnapshotOvers(prev => ({ ...prev, [snapId]: !prev[snapId] }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="overs-history-management-tab">
      
      {/* SECTION 1: VISUAL OVER-BY-OVER PROGRESS SUMMARY */}
      <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-150 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-black text-slate-800 tracking-tight" id="overs-log-heading">
              Live Overs History & Over-by-Over Sequences
            </h3>
          </div>
          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-lg font-black tracking-wide uppercase">
            Innings {inningsIndex + 1}
          </span>
        </div>

        {/* Current status summary info */}
        {currentInnings ? (
          <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-[11px] text-slate-600 flex justify-between items-center sm:flex-row flex-col gap-3" id="active-overs-banner">
            <div className="space-y-1">
              <span className="bg-slate-200/70 text-slate-700 text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-md tracking-wider">Active Match Progress</span>
              <p className="font-semibold text-slate-700 mt-1 leading-relaxed">
                Currently Batting: <strong className="text-slate-900">{battingTeam?.name || 'Innings Batters'}</strong> • Bowling: <strong className="text-slate-900">{bowlingTeam?.name || 'Innings Bowlers'}</strong>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-black text-indigo-650 bg-indigo-50 border border-indigo-100 py-1 px-3 rounded-lg">
                Score: {currentInnings.totalRuns}/{currentInnings.totalWickets} ({formatOversCount(currentInnings.ballsBowledTotal)} ov)
              </span>
            </div>
          </div>
        ) : null}

        {/* The Live Sequenced List of Overs */}
        <div className="space-y-4" id="visual-overs-timeline">
          {sortedLiveOverNums.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
              <History className="w-8 h-8 text-slate-350 stroke-1" />
              <span>Deliveries logged here will assemble sequential over summary lists & details.</span>
            </div>
          ) : (
            sortedLiveOverNums.map((overNum) => {
              const balls = groupedLiveOvers[overNum];
              const isExpanded = !!expandedOvers[overNum];

              // Calculate over stats
              const totalRunsConceded = balls.reduce((sum, b) => sum + (b.runsFromBat || 0) + (b.runsFromExtras || 0), 0);
              const totalWickets = balls.filter(b => b.isWicket).length;
              
              // Find bowler name
              const bowlerId = balls[0]?.bowlerId;
              const bowlerName = bowlerId ? getPlayerName(bowlerId) : 'Unknown Bowler';

              return (
                <div 
                  key={overNum} 
                  className="border border-slate-200/75 rounded-2xl overflow-hidden hover:border-slate-300/80 transition-all bg-white shadow-xs"
                  id={`live-over-card-${overNum}`}
                >
                  {/* Over header visual trigger */}
                  <div 
                    onClick={() => toggleLiveOver(overNum)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/40 select-none"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      {/* Over Counter Badge */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                          Over {overNum + 1}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">
                          ({balls.length} {balls.length === 1 ? 'ball' : 'balls'})
                        </span>
                      </div>

                      {/* Bowler Designation */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{bowlerName}</span>
                      </div>
                    </div>

                    {/* Ball by Ball sequence visual bubbles */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto max-w-[150px] sm:max-w-none py-0.5">
                        {balls.map((ball, bIdx) => (
                          <span
                            key={bIdx}
                            className={`w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded-full border text-[8px] sm:text-[9.5px] uppercase tracking-tighter flex items-center justify-center shrink-0 ${getBallColorClasses(ball)}`}
                            title={ball.description}
                          >
                            {getBallText(ball)}
                          </span>
                        ))}
                      </div>

                      {/* Cumulative total indicator */}
                      <div className="text-right px-2.5 py-1 bg-slate-50 border border-slate-150 rounded-lg shrink-0 text-[10px] font-black leading-tight text-slate-700">
                        {totalRunsConceded} R • {totalWickets} W
                      </div>

                      {/* Toggle arrow */}
                      <div className="text-slate-400 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Detailing inside each over */}
                  {isExpanded && (
                    <div className="bg-slate-50/45 border-t border-slate-150 p-4 space-y-3" id={`live-over-detail-content-${overNum}`}>
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Detailed Deliveries capture timeline logs
                      </h4>
                      <div className="space-y-2">
                        {balls.map((ball, bIdx) => {
                          const visualIndex = bIdx + 1;
                          const strikerName = getPlayerName(ball.strikerId);
                          const bowlerLabelName = getPlayerName(ball.bowlerId);
                          
                          return (
                            <div 
                              key={bIdx}
                              className="bg-white border border-slate-200/70 p-3 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
                              id={`live-ball-detail-${overNum}-${bIdx}`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Miniature outcome design circle */}
                                <span className={`w-[20px] h-[20px] rounded-full border text-[7.5px] uppercase flex items-center justify-center shrink-0 font-extrabold ${getBallColorClasses(ball)}`}>
                                  {getBallText(ball)}
                                </span>
                                <div>
                                  <p className="font-extrabold text-slate-800 text-[11px]">
                                    {ball.description}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                    Bowler: {bowlerLabelName} • Batter: {strikerName}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                {ball.cumulativeRuns !== undefined ? (
                                  <span className="text-[10px] font-mono font-black text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 leading-tight">
                                    Score: {ball.cumulativeRuns}/{ball.cumulativeWickets ?? 0}
                                  </span>
                                ) : null}
                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">
                                  Ball {visualIndex}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 2: SYSTEM SNAPSHOT RECOVERY CLOUD BACKUPS */}
      <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-xs space-y-5" id="overs-recovery-panel-content">
        <div className="flex items-center gap-2 border-b border-slate-150 pb-3">
          <RotateCcw className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-black text-slate-800 tracking-tight">
            Cloud Snapshots Reversion & Safety Recovery
          </h3>
        </div>

        <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-[11px] text-slate-600 space-y-1.5">
          <div className="flex items-center gap-1.5 text-indigo-650 font-extrabold uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Active Game Protection Backups</span>
          </div>
          <p className="leading-relaxed">
            At the completion of each 6-ball over, a full system snapshot is generated and persisted to the cloud database. If a scoring mistake was made, select any completed over below to revert the live database back and continue play!
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            COMPLETED OVER SNAPSHOTS TIMELINE
          </h4>

          {currentInningsSnapshots.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
              No completed over snapshots found yet for this innings. Snapshots occur automatically at 6 valid balls.
            </div>
          ) : (
            <div className="space-y-3">
              {currentInningsSnapshots.map((snap) => {
                const inn = snap.matchState?.inningsList?.[inningsIndex];
                const runs = inn?.totalRuns ?? 0;
                const wickets = inn?.totalWickets ?? 0;
                const balls = inn?.ballsBowledTotal ?? 0;
                const formatOvers = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;

                // Find the bowler who bowled this over (the ball records in this over)
                const overBalls = inn?.balls?.filter((ball: any) => ball.overNum === (snap.overNumber - 1)) || [];
                const lastBall = overBalls[overBalls.length - 1];
                let bowlerInfo = 'Unknown Bowler';
                if (lastBall) {
                  const bowlerObj = snap.matchState?.teams?.[inn.bowlingTeamIndex]?.players?.find((p: any) => p.id === lastBall.bowlerId);
                  bowlerInfo = bowlerObj ? bowlerObj.name : 'Bowler';
                }

                const isExpanded = !!expandedSnapshotOvers[snap.id];

                return (
                  <div 
                    key={snap.id}
                    className="border border-slate-200/70 rounded-2xl overflow-hidden bg-white hover:border-slate-350 shadow-xs"
                    id={`snapshot-card-${snap.id}`}
                  >
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-800">
                            End of Over {snap.overNumber}
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleSnapshotOver(snap.id)}
                            className="text-slate-400 hover:text-slate-650 flex items-center gap-0.5 text-[9px] uppercase font-bold tracking-tight px-1 py-0.5 border border-slate-200 rounded hover:bg-white"
                          >
                            <span>View sequence</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          Score Snapshot: <span className="text-indigo-650 font-extrabold">{runs}/{wickets}</span> ({formatOvers(balls)} ov) • Bowler: <span className="text-slate-600 font-bold">{bowlerInfo}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => onRestoreSnapshot(snap)}
                        className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-[10px] font-black uppercase tracking-wide rounded-lg flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-center shrink-0"
                      >
                        <RotateCcw className="w-3 h-3 animate-spin-reverse" />
                        REVERT LIVE STATE HERE
                      </button>
                    </div>

                    {/* Detailed snapshot over sequence if expanded */}
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-150 space-y-3 bg-slate-50/20">
                        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                          {overBalls.map((ball: any, bIdx: number) => (
                            <div key={bIdx} className="flex flex-col items-center gap-1">
                              <span
                                className={`w-[24px] h-[24px] rounded-full border text-[8.5px] uppercase tracking-tighter flex items-center justify-center shrink-0 ${getBallColorClasses(ball)}`}
                                title={ball.description}
                              >
                                {getBallText(ball)}
                              </span>
                              <span className="text-[7.5px] font-mono font-bold text-slate-400">
                                Ball {bIdx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1.5 text-[10px] bg-slate-100/70 p-3 rounded-xl text-slate-550 border border-slate-200/60 font-medium">
                          <p className="uppercase font-black tracking-widest text-slate-400 text-[8px] mb-1">Backup Snapshot Deliveries</p>
                          {overBalls.map((ball: any, bIdx: number) => (
                            <p key={bIdx} className="leading-relaxed font-semibold">
                              • Ball {bIdx + 1}: <strong className="text-slate-700">{ball.description}</strong>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-amber-50/55 border border-amber-100 p-3.5 rounded-2xl text-[10px] text-amber-850 flex items-start gap-2 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
          <span>
            <strong>Warning</strong>: Reverting to a previous over snapshot will discard all subsequent events and clear later snapshots from the cloud backup database as you resume live scoring.
          </span>
        </div>
      </div>
    </div>
  );
}
