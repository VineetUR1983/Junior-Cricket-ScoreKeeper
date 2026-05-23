/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RotateCcw, ShieldCheck, AlertCircle } from 'lucide-react';

interface OversRecoveryProps {
  overSnapshots: any[];
  inningsIndex: number;
  onRestoreSnapshot: (snapshot: any) => void;
}

export default function OversRecovery({ overSnapshots, inningsIndex, onRestoreSnapshot }: OversRecoveryProps) {
  // Filter snapshots matching this innings
  const currentInningsSnapshots = overSnapshots
    .filter((snap) => snap.inningsIndex === inningsIndex)
    .sort((a, b) => a.overNumber - b.overNumber);

  return (
    <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-xs space-y-5 animate-in fade-in duration-200" id="overs-recovery-panel">
      <div className="flex items-center gap-2 border-b border-slate-150 pb-3">
        <RotateCcw className="w-5 h-5 text-indigo-600" />
        <h3 className="text-base font-black text-slate-800 tracking-tight">Overs Snapshot Recovery</h3>
      </div>

      <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-[11px] text-slate-600 space-y-1.5">
        <div className="flex items-center gap-1.5 text-indigo-600 font-extrabold uppercase tracking-wide">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Active Game Protection</span>
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
          <div className="space-y-2.5">
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

              return (
                <div
                  key={snap.id}
                  className="flex items-center justify-between p-4 bg-slate-50/40 hover:bg-slate-50 rounded-2xl border border-slate-200/60 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-800">
                      End of Over {snap.overNumber}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      Score: <span className="text-indigo-650 font-bold">{runs}/{wickets}</span> ({formatOvers(balls)} ov) • Bowler: <span className="text-slate-600 font-bold">{bowlerInfo}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => onRestoreSnapshot(snap)}
                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-[10px] font-black uppercase tracking-wide rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    REVERT HERE
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-2xl text-[10px] text-amber-850 flex items-start gap-2 leading-relaxed">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
        <span>
          <strong>Warning</strong>: Reverting to a previous over will discard all subsequent events and clear later over snapshots from the database timeline as you resume scoring.
        </span>
      </div>
    </div>
  );
}
