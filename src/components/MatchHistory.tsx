/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BallRecord, Innings } from '../types';
import { History, AlertCircle } from 'lucide-react';

interface MatchHistoryProps {
  inningsList: [Innings | null, Innings | null];
  currentInningsIndex: 0 | 1 | 2;
}

export default function MatchHistory({ inningsList, currentInningsIndex }: MatchHistoryProps) {
  // Let's inspect the active innings
  const inningsIndex = currentInningsIndex === 0 ? 0 : currentInningsIndex - 1;
  const currentInnings = inningsList[inningsIndex];

  if (!currentInnings || currentInnings.balls.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-center py-12 text-slate-400 text-xs flex flex-col items-center justify-center gap-2 animate-in fade-in duration-200">
        <History className="w-8 h-8 text-slate-300 stroke-1" />
        <span className="font-semibold">No deliveries logged in this match yet.</span>
      </div>
    );
  }

  // Reverse balls for chronological timeline (recent events at the top)
  const reversedBalls = [...currentInnings.balls].reverse();

  // Group balls by Over Number for structured reading
  const groupedOvers: { [overNum: number]: BallRecord[] } = {};
  reversedBalls.forEach((ball) => {
    if (!groupedOvers[ball.overNum]) {
      groupedOvers[ball.overNum] = [];
    }
    groupedOvers[ball.overNum].push(ball);
  });

  const sortedOverNumbers = Object.keys(groupedOvers)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in duration-200" id="match-timeline-panel">
      <div className="flex items-center justify-between border-b border-slate-150 pb-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-650" />
          <h2 className="text-base font-black text-slate-800 tracking-tight">Delivery timeline log</h2>
        </div>
        <span className="text-[10px] text-indigo-700 bg-indigo-50/70 border border-indigo-100 px-2.5 py-1 rounded-lg font-black tracking-wide uppercase">
          Innings {inningsIndex + 1}
        </span>
      </div>

      <div className="space-y-6 max-h-[500px] overflow-y-auto pr-1">
        {sortedOverNumbers.map((overNum) => {
          const ballsInOver = groupedOvers[overNum];
          return (
            <div key={overNum} className="space-y-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3.5 py-1.5 rounded-xl">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">OVER {overNum + 1}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  ({ballsInOver.length} {ballsInOver.length === 1 ? 'ball' : 'balls'})
                </span>
              </div>

              <div className="space-y-2.5 pl-3 border-l border-slate-200 ml-4">
                {ballsInOver.map((ball, idx) => {
                  let badgeColor = 'bg-slate-50 text-slate-805 border-slate-200';
                  let outcomeText = `${ball.runsFromBat} Run${ball.runsFromBat !== 1 ? 's' : ''}`;

                  if (ball.isWicket) {
                    badgeColor = 'bg-red-500 text-white border-red-500 font-extrabold';
                    outcomeText = `WICKET: ${ball.wicketType}`;
                  } else if (ball.ballType === 'FreeHit') {
                    badgeColor = 'bg-pink-50 text-pink-700 border-pink-200 font-extrabold';
                    outcomeText = `FREE HIT / ${ball.runsFromBat} runs`;
                  } else if (ball.ballType === 'Wide') {
                    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200 font-black';
                    outcomeText = `WIDE EXTRA`;
                  } else if (ball.ballType === 'NoBall') {
                    badgeColor = 'bg-amber-50 text-amber-805 border-amber-200 font-black';
                    outcomeText = `NO BALL EXTRA`;
                  } else if (ball.runsFromExtras > 0) {
                    badgeColor = 'bg-indigo-50 text-indigo-850 border-indigo-100 font-bold';
                    outcomeText = `+${ball.runsFromExtras} Extra Bye`;
                  } else if (ball.runsFromBat === 4) {
                    badgeColor = 'bg-indigo-50 text-indigo-600 border-indigo-200 font-black uppercase';
                    outcomeText = `FOUR`;
                  } else if (ball.runsFromBat === 6) {
                    badgeColor = 'bg-indigo-600 text-white border-indigo-600 font-black uppercase';
                    outcomeText = `MAXIMUM 6`;
                  } else if (ball.runsFromBat === 0) {
                    badgeColor = 'bg-slate-55 text-slate-400 border-slate-200';
                    outcomeText = 'DOT';
                  }

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 hover:bg-slate-50/50 rounded-2xl border border-slate-200/60 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-lg border text-[9px] uppercase tracking-wide flex items-center justify-center font-black ${badgeColor}`}>
                          {outcomeText}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-800">
                            {ball.description}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            Bowler: {ball.bowlerId.split('-')[1] || ball.bowlerId} • Batter: {ball.strikerId.split('-')[1] || ball.strikerId}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-black font-mono">
                        BALL {ball.ballNumInOver}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline tips */}
      <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/60 text-[11px] text-slate-500 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 animate-pulse" />
        <div className="leading-relaxed">
          Matches support continuous instant <strong className="text-slate-700">Live Scorer State Undo</strong> triggers. Tap "Undo Last Delivery" to roll back live event records instantly without corrupting the historical database.
        </div>
      </div>
    </div>
  );
}
