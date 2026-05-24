/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Innings, Team, BatterStats, BowlerStats } from '../types';
import { Award, BookOpen, Users, Trophy } from 'lucide-react';

interface StatsViewProps {
  teams: [Team, Team];
  inningsList: [Innings | null, Innings | null];
  currentInningsIndex?: 0 | 1 | 2;
}

export default function StatsView({ teams, inningsList, currentInningsIndex }: StatsViewProps) {
  const [activeInningsTab, setActiveInningsTab] = useState<0 | 1>(() => {
    if (currentInningsIndex === 2) return 1;
    return 0;
  });

  React.useEffect(() => {
    if (currentInningsIndex === 1) {
      setActiveInningsTab(0);
    } else if (currentInningsIndex === 2) {
      setActiveInningsTab(1);
    }
  }, [currentInningsIndex]);

  const selectedInnings = inningsList[activeInningsTab];
  const selectedBattingTeamName = selectedInnings 
    ? teams[selectedInnings.battingTeamIndex].name 
    : (activeInningsTab === 0 ? teams[0].name : teams[1].name);

  const selectedBowlingTeamName = selectedInnings 
    ? teams[selectedInnings.bowlingTeamIndex].name 
    : (activeInningsTab === 0 ? teams[1].name : teams[0].name);

  // Math helpers
  const formatOvers = (balls: number) => {
    const overs = Math.floor(balls / 6);
    const rem = balls % 6;
    return `${overs}.${rem}`;
  };

  const getEconomy = (runs: number, balls: number) => {
    if (balls === 0) return '0.00';
    return ((runs / balls) * 6).toFixed(2);
  };

  const getStrikeRate = (runs: number, balls: number) => {
    if (balls === 0) return '0.0';
    return ((runs / balls) * 100).toFixed(1);
  };

  return (
    <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in duration-200" id="stats-view-panel">
      {/* Tab toggle */}
      <div className="flex border-b border-slate-150 pb-2.5 justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-black text-slate-800 tracking-tight">Innings scorecards</h2>
        </div>

        <div className="flex bg-slate-100/70 p-1 rounded-2xl border border-slate-205/40">
          <button
            onClick={() => setActiveInningsTab(0)}
            className={`px-4 py-1.5 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all cursor-pointer ${
              activeInningsTab === 0
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/50'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            1st Inn: {teams[0].name}
          </button>
          <button
            onClick={() => setActiveInningsTab(1)}
            disabled={!inningsList[1]}
            className={`px-4 py-1.5 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all cursor-pointer ${
              activeInningsTab === 1
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/50'
                : 'text-slate-400 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            2nd Inn: {teams[1].name}
          </button>
        </div>
      </div>

      {!selectedInnings ? (
        <div className="text-center py-14 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
          No live play events recorded for this innings yet.
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-150" id="detailed-scorecard">
          {/* Innings Totals Hero board */}
          <div className="bg-indigo-50/30 border border-indigo-100/80 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                {selectedInnings.isCompleted ? 'INNINGS COMPLETE' : 'INNINGS IN PROGRESS'}
              </p>
              <h3 className="text-lg font-black text-slate-900 mt-1">{selectedBattingTeamName}</h3>
              <p className="text-xs text-slate-400 font-semibold">
                Bowled by {selectedBowlingTeamName}
              </p>
            </div>

            <div className="text-center sm:text-right">
              <p className="text-3xl font-black text-slate-900 tracking-tight">
                {selectedInnings.totalRuns} <span className="text-lg text-slate-400 font-medium">/{selectedInnings.totalWickets}</span>
              </p>
              <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mt-1">
                {formatOvers(selectedInnings.ballsBowledTotal)} OVERS COMPLETED
              </p>
            </div>
          </div>

          {/* Batting scorecard table */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                BATSMEN
              </h4>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-black">
                LIMIT: {selectedInnings.batsmanBallLimit} BALLS
              </span>
            </div>
            
            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="py-3.5 px-4 font-black">BATTER</th>
                    <th className="py-3.5 px-4 font-black">DISMISSAL STATE</th>
                    <th className="py-3.5 px-4 text-center font-black">RUNS</th>
                    <th className="py-3.5 px-4 text-center font-black">BALLS</th>
                    <th className="py-3.5 px-4 text-center font-black">4s</th>
                    <th className="py-3.5 px-4 text-center font-black">6s</th>
                    <th className="py-3.5 px-4 text-center font-black">S/R</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {selectedInnings.batters.map((b) => (
                    <tr key={b.playerId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-800">{b.playerName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-semibold max-w-[200px] truncate">
                        {b.howOut === 'Active' ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-wider border border-emerald-100">not out</span>
                        ) : b.howOut === 'Retired' ? (
                          <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-wider border border-slate-200">retired</span>
                        ) : (
                          <span className="text-slate-500 text-[11px] font-medium">{b.howOut}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-slate-900 text-sm font-mono">{b.runs}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400 font-mono">{b.ballsFaced}</td>
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{b.fours}</td>
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{b.sixes}</td>
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono font-medium">{getStrikeRate(b.runs, b.ballsFaced)}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-slate-50/40 font-bold border-t border-slate-200">
                    <td className="py-3.5 px-4 text-slate-600 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                      BATTING EXTRAS TOTAL
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-705 font-black font-mono">
                      {selectedInnings.extras.wides + selectedInnings.extras.noBalls + selectedInnings.extras.byes + selectedInnings.extras.legByes}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-center text-[11px] font-semibold" colSpan={4}>
                      (Wide {selectedInnings.extras.wides}, No-Ball {selectedInnings.extras.noBalls}, Bye {selectedInnings.extras.byes}, Leg-Bye {selectedInnings.extras.legByes})
                    </td>
                  </tr>

                  {/* Opposition Wicket Penalty segment/row */}
                  {(() => {
                    const opponentInnings = inningsList[1 - activeInningsTab];
                    const opponentWickets = opponentInnings ? opponentInnings.totalWickets : 0;
                    const penaltyRuns = opponentWickets * 4;
                    const opponentTeamName = selectedBowlingTeamName;
                    return (
                      <tr className="bg-amber-50/45 text-amber-900 border-t border-slate-200 font-bold" id={`wicket-penalty-row-inn-${activeInningsTab}`}>
                        <td className="py-3.5 px-4 text-amber-700 font-extrabold uppercase text-[10px] tracking-wide" colSpan={2}>
                          OPPOSITION WICKET PENALTY
                        </td>
                        <td className="py-3.5 px-4 text-center text-amber-800 font-black font-mono text-sm">
                          +{penaltyRuns}
                        </td>
                        <td className="py-3.5 px-4 text-amber-600 text-center text-[11px] font-bold" colSpan={4}>
                          (4 Runs recorded for each of the {opponentWickets} wicket(s) lost by {opponentTeamName} batting)
                        </td>
                      </tr>
                    );
                  })()}
                  <tr className="bg-indigo-50/20 font-black text-slate-900 border-t border-slate-200">
                    <td className="py-4 px-4 text-indigo-805 uppercase tracking-wide text-[11px]" colSpan={2}>
                      GRAND INNINGS TOTAL
                    </td>
                    <td className="py-4 px-4 text-center text-indigo-700 text-base font-black font-mono">
                      {selectedInnings.totalRuns}
                    </td>
                    <td className="py-4 px-4 text-slate-500 text-center text-[10px] uppercase font-bold tracking-wider" colSpan={4}>
                      ({selectedInnings.totalWickets} wickets, {formatOvers(selectedInnings.ballsBowledTotal)} overs)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bowling scorecard table */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              BOWLERS
            </h4>
            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="py-3.5 px-4 font-black">BOWLER</th>
                    <th className="py-3.5 px-4 text-center font-black">OVERS</th>
                    <th className="py-3.5 px-4 text-center font-black">MAIDENS</th>
                    <th className="py-3.5 px-4 text-center font-black">RUNS</th>
                    <th className="py-3.5 px-4 text-center font-black">WICKETS</th>
                    <th className="py-3.5 px-4 text-center font-black">WD / NB</th>
                    <th className="py-3.5 px-4 text-center font-black">ECON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {selectedInnings.bowlers.length === 0 ? (
                    <tr>
                      <td className="py-4 px-4 text-slate-400 font-semibold italic" colSpan={7}>No bowling deliveries recorded yet for this innings block.</td>
                    </tr>
                  ) : (
                    selectedInnings.bowlers.map((bowler) => (
                      <tr key={bowler.playerId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-extrabold text-slate-800">
                          {bowler.playerName}
                          {bowler.ballsBowled >= 24 && (
                            <span className="ml-2 text-[9px] bg-amber-50 border border-amber-200 text-amber-705 font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">capped limit</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-700 font-mono">{formatOvers(bowler.ballsBowled)}</td>
                        <td className="py-3.5 px-4 text-center text-slate-450 font-mono">{bowler.maidens}</td>
                        <td className="py-3.5 px-4 text-center text-slate-800 font-bold font-mono">{bowler.runsConceded}</td>
                        <td className="py-3.5 px-4 text-center text-indigo-700 font-black text-sm font-mono">{bowler.wickets}</td>
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{bowler.wides} / {bowler.noBalls}</td>
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono font-medium">{getEconomy(bowler.runsConceded, bowler.ballsBowled)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              * Note: For Junior Under-9 matches, bowlers do not re-bowl wide/no-balls. Penalty scores are added immediately as bowling statistics.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
