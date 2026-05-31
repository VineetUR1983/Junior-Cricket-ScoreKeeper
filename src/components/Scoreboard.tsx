/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Innings, Team, BatterStats, BowlerStats, BallRecord } from '../types';
import { Key, Target, AlertTriangle, User, ShieldAlert } from 'lucide-react';

interface ScoreboardProps {
  battingTeam: Team;
  bowlingTeam: Team;
  innings: Innings;
  activeStriker: BatterStats | null;
  activeNonStriker: BatterStats | null;
  activeBowler: BowlerStats | null;
  isFreeHit: boolean;
  consecutiveExtras: number;
  ballLimit: number;
  targetRuns?: number; // Target to chase in 2nd innings
  opponentWickets?: number; // Opposition wickets lost
  wicketKeeper1Id: string;
  wicketKeeper2Id: string;
  isSpecialSingleActive?: boolean;
  matchOvers?: number;
  onSelectBallToEdit?: (ball: BallRecord, idx: number) => void;
}

// Helpers
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

export default function Scoreboard({
  battingTeam,
  bowlingTeam,
  innings,
  activeStriker,
  activeNonStriker,
  activeBowler,
  isFreeHit,
  consecutiveExtras,
  ballLimit,
  targetRuns,
  opponentWickets = 0,
  wicketKeeper1Id,
  wicketKeeper2Id,
  isSpecialSingleActive = false,
  matchOvers = 20,
  onSelectBallToEdit,
}: ScoreboardProps) {
  // Helpers
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

  const currentOverNumber = Math.floor(innings.ballsBowledTotal / 6) + 1;
  const currentRunRate = innings.ballsBowledTotal === 0 
    ? '0.00' 
    : ((innings.totalRuns / innings.ballsBowledTotal) * 6).toFixed(2);

  const midPoint = Math.ceil(matchOvers / 2);
  const activeWicketKeeperId = currentOverNumber <= midPoint ? wicketKeeper1Id : wicketKeeper2Id;
  const activeWicketKeeperPlayer = bowlingTeam.players.find((p) => p.id === activeWicketKeeperId);
  const activeWicketKeeperName = activeWicketKeeperPlayer ? activeWicketKeeperPlayer.name : 'Not Assigned';

  // Dynamic status text for batsman ball limit
  const getBallLimitProgressWidth = (ballsFaced: number) => {
    const pct = Math.min((ballsFaced / ballLimit) * 100, 100);
    return `${pct}%`;
  };

  const getBallLimitProgressColor = (ballsFaced: number) => {
    const remaining = ballLimit - ballsFaced;
    if (remaining <= 0) return 'bg-rose-500';
    if (remaining <= 3) return 'bg-amber-500';
    return 'bg-indigo-500';
  };

  return (
    <div className="space-y-4" id="scoreboard-root">
      {/* Target and Chased Summary (If 2nd innings) */}
      {targetRuns !== undefined && (
        <div className="bg-emerald-50 text-emerald-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold border border-emerald-200 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
            <span>Chasing Target: <strong className="text-emerald-990 font-black">{targetRuns} Runs</strong></span>
          </div>
          <div>
            {(innings.totalRuns + opponentWickets * 4) >= targetRuns ? (
              <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[9px] font-black">TARGET ACHIEVED 🎉</span>
            ) : (
              <span>Need {targetRuns - (innings.totalRuns + opponentWickets * 4)} runs off {(matchOvers * 6) - innings.ballsBowledTotal} balls left</span>
            )}
          </div>
        </div>
      )}

      {/* Main Scoreboard Card */}
      <div className="bg-indigo-700 text-white p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden" id="live-scoreboard-deck">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="white"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
        </div>
        
        <div className="flex justify-between items-end relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-indigo-200 uppercase font-black tracking-widest bg-indigo-650 px-2.5 py-1 rounded-lg">
                CURRENT INNINGS
              </span>
              {isFreeHit && (
                <div className="bg-emerald-500 text-white px-3 py-1 rounded-lg flex items-center gap-1.5 border border-emerald-400 shadow-xs animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span className="text-[9px] font-black uppercase tracking-widest">FREE HIT ACTIVE</span>
                </div>
              )}
            </div>
            
            <h2 className="text-xl font-bold font-sans tracking-tight mt-3 text-indigo-50">{battingTeam.name}</h2>
            
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-6xl font-black tracking-tighter" id="scoreboard-total-score">{innings.totalRuns + opponentWickets * 4}</span>
              <span className="text-3xl font-light text-indigo-200">/ {innings.totalWickets}</span>
            </div>
            {opponentWickets > 0 && (
              <p className="text-[10px] text-indigo-200/90 font-bold mt-1.5 uppercase tracking-wide">
                (Batting: {innings.totalRuns} + Opposition Wicket Penalty: +{opponentWickets * 4})
              </p>
            )}
          </div>
          
          <div className="text-right">
            <p className="text-xs text-indigo-100 font-semibold tracking-wider uppercase">Overs: {formatOvers(innings.ballsBowledTotal)} / {matchOvers}.0</p>
            <p className="text-xs text-indigo-100 font-semibold tracking-wider uppercase mt-1">CRR: {currentRunRate}</p>
            {targetRuns !== undefined && (
              <p className="text-indigo-200 font-bold text-xs uppercase tracking-wider mt-3">Target: {targetRuns}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-4 relative z-10">
          <div className="bg-indigo-600/50 px-4 py-2.5 rounded-xl flex flex-col border border-indigo-500/40">
            <span className="text-[9px] text-indigo-200 uppercase font-black tracking-widest">Team Extras Breakdown</span>
            <span className="text-base font-mono font-bold mt-1">
              {innings.extras.wides + innings.extras.noBalls + innings.extras.byes + innings.extras.legByes}{' '}
              <span className="text-xs font-normal opacity-70">
                ({innings.extras.wides}wd, {innings.extras.noBalls}nb, {innings.extras.byes}b, {innings.extras.legByes}lb)
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Batting Unit Column */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">At the Crease (Batting)</h3>
          
          <div className="space-y-3">
            {/* Striker Panel */}
            <div className={`p-4 rounded-xl border-l-4 transition-all ${
              activeStriker 
                ? 'bg-slate-50 border-indigo-500 text-slate-900 shadow-xs' 
                : 'bg-white border-slate-200 border-dashed text-slate-400 flex items-center justify-center py-6'
            }`} id="striker-panel">
              {activeStriker ? (
                <div className="flex justify-between items-center w-full">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-extrabold text-sm text-slate-900">{activeStriker.playerName} *</p>
                      {isSpecialSingleActive && (
                        <span className="text-[8px] font-black bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                          Solo Mode
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-[11px] text-slate-500">
                        {isSpecialSingleActive ? (
                          <span>Quota: <b className="text-slate-700">{activeStriker.ballsFaced} / {ballLimit} (Unlimited)</b></span>
                        ) : (
                          <span>Quota: <b className="text-slate-700">{activeStriker.ballsFaced} / {ballLimit} balls</b></span>
                        )}
                      </span>
                      <div className="w-16 h-1 bg-slate-200 rounded-full">
                        <div 
                          className={`h-full rounded-full ${getBallLimitProgressColor(activeStriker.ballsFaced)}`} 
                          style={{ width: getBallLimitProgressWidth(activeStriker.ballsFaced) }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black tracking-tight text-slate-900">
                      {activeStriker.runs} <span className="text-xs font-normal text-slate-400">({activeStriker.ballsFaced})</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">SR: {getStrikeRate(activeStriker.runs, activeStriker.ballsFaced)}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-xs">
                  <User className="w-4 h-4 mx-auto mb-1 opacity-50" />
                  No striker in crease
                </div>
              )}
            </div>

            {/* Non-Striker Panel */}
            <div className={`p-4 rounded-xl border transition-all ${
              activeNonStriker 
                ? (isSpecialSingleActive 
                    ? 'bg-indigo-50/40 border-indigo-200 text-slate-800 shadow-xs' 
                    : 'bg-white border-slate-200 text-slate-900 shadow-xs') 
                : 'bg-white border-slate-200 border-dashed text-slate-400 flex items-center justify-center py-6'
            }`} id="non-striker-panel">
              {activeNonStriker ? (
                <div className="flex justify-between items-center w-full">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <p className="font-extrabold text-sm text-slate-700">{activeNonStriker.playerName}</p>
                      {isSpecialSingleActive && (
                        <span className="text-[8px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">SOLO RUNNER</span>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-[11px] text-slate-500">
                        Quota: <b className="text-slate-700">{activeNonStriker.ballsFaced} / {ballLimit} balls</b>
                      </span>
                      <div className="w-16 h-1 bg-slate-200 rounded-full">
                        <div 
                          className={`h-full rounded-full ${getBallLimitProgressColor(activeNonStriker.ballsFaced)}`} 
                          style={{ width: getBallLimitProgressWidth(activeNonStriker.ballsFaced) }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black tracking-tight text-slate-900">
                      {activeNonStriker.runs} <span className="text-xs font-normal text-slate-400">({activeNonStriker.ballsFaced})</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">SR: {getStrikeRate(activeNonStriker.runs, activeNonStriker.ballsFaced)}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-xs">
                  <User className="w-4 h-4 mx-auto mb-1 opacity-55" />
                  No non-striker in crease
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bowling figures Column */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between" id="bowler-panel">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bowling Figures</h3>
            
            {activeBowler ? (
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-extrabold text-slate-900" id="active-bowler-heading">{activeBowler.playerName}</p>
                  <p className="text-xs text-slate-500 mt-1">Overs: {formatOvers(activeBowler.ballsBowled)} of 4.0 Max</p>
                </div>
                <div className="flex gap-2">
                  <div className="text-center bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-100">
                    <p className="text-[9px] text-slate-400 font-black uppercase">Wkt</p>
                    <p className="font-extrabold text-sm mt-0.5 text-slate-900">{activeBowler.wickets}</p>
                  </div>
                  <div className="text-center bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-100">
                    <p className="text-[9px] text-slate-400 font-black uppercase">Runs</p>
                    <p className="font-extrabold text-sm mt-0.5 text-slate-900">{activeBowler.runsConceded}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-6 text-xs">
                Please select a bowler below to start recording figures.
              </div>
            )}
          </div>

          {activeBowler && (
            <div className="grid grid-cols-4 gap-2 pt-4 mt-4 border-t border-slate-100 text-center">
              <div>
                <span className="text-[9px] text-slate-400 font-black block uppercase">Wd/Nb</span>
                <span className="text-xs font-bold text-slate-800">{activeBowler.wides}/{activeBowler.noBalls}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-black block uppercase">Maidens</span>
                <span className="text-xs font-bold text-slate-800">{activeBowler.maidens}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-black block uppercase">Econ</span>
                <span className="text-xs font-bold text-slate-800">{getEconomy(activeBowler.runsConceded, activeBowler.ballsBowled)}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-black block uppercase">Runs/Ball</span>
                <span className="text-xs font-bold text-slate-800">
                  {activeBowler.ballsBowled > 0 ? (activeBowler.runsConceded / activeBowler.ballsBowled).toFixed(1) : '0'}
                </span>
              </div>
            </div>
          )}

          {/* Active Wicket Keeper */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-slate-400 font-extrabold block uppercase">ACTIVE WICKET KEEPER</span>
              <span className="text-xs font-black text-slate-800">{activeWicketKeeperName}</span>
            </div>
            <span className="text-[9px] bg-indigo-50 text-indigo-650 font-black px-2 py-0.5 rounded-lg border border-indigo-100/60 uppercase">
              {currentOverNumber <= midPoint ? `Overs 1-${midPoint}` : `Overs ${midPoint + 1}-${matchOvers}`}
            </span>
          </div>
        </div>
      </div>

      {/* Free hit trigger alert banner */}
      {consecutiveExtras > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>Extra warnings: <strong className="text-amber-950">{consecutiveExtras}</strong> consecutive extra(s) bowled.</span>
          </div>
          {consecutiveExtras >= 1 && (
            <span className="bg-amber-100 font-bold text-amber-800 rounded-lg px-2.5 py-1 text-[9px] uppercase tracking-wider">
              FREE HIT POTENTIAL NEXT BALL
            </span>
          )}
        </div>
      )}

      {/* Ball by Ball over feed */}
      {innings && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs" id="current-over-feed">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Current Over Sequence
              </p>
              <p className="text-[9px] text-slate-400/90 font-medium">Click any ball below to change its scoring details</p>
            </div>
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {innings.currentOverBalls.filter((b) => b.ballType !== 'FreeHit').length} / 6 legal ball(s) complete
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {innings.currentOverBalls.map((b, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectBallToEdit?.(b, idx)}
                className={`w-10 h-10 rounded-full flex flex-col items-center justify-center font-extrabold text-xs transition-all cursor-pointer hover:scale-108 active:scale-95 relative ${
                  b.isWicket
                    ? 'bg-red-500 text-white shadow-xs hover:bg-red-600'
                    : b.ballType === 'FreeHit'
                    ? 'bg-rose-50 border border-rose-300 text-rose-700 ring-2 ring-rose-500/20 hover:bg-rose-100'
                    : b.ballType === 'Wide' || b.ballType === 'NoBall'
                    ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-400/30 hover:bg-amber-100'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100'
                }`}
                title="Click to edit details of this ball"
              >
                <span className="text-[9px] font-black tracking-tighter leading-none">
                  {getBallText(b)}
                </span>
                {b.runsFromExtras > 0 && 
                 !(b.ballType === 'Wide' || b.ballType === 'NoBall') && 
                 !(b.extraType === 'Bye' || b.extraType === 'LegBye') && (
                  <span className="text-[8px] font-bold absolute -bottom-1 -right-0.5 bg-slate-200 text-slate-800 px-1 rounded-sm">
                    +{b.runsFromExtras}
                  </span>
                )}
                {b.ballType === 'FreeHit' && (
                  <span className="absolute -top-1 -right-0.5 bg-rose-600 w-2 h-2 rounded-full" />
                )}
              </button>
            ))}
            
            {/* Blanks representing remaining balls inside the over */}
            {Array.from({ length: Math.max(0, 6 - innings.currentOverBalls.filter((b) => b.ballType !== 'FreeHit').length) }).map((_, i) => (
              <div key={`blank-${i}`} className="w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 border-dashed border-slate-200 text-slate-300 select-none">
                ?
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-slate-400 leading-relaxed font-medium">
            * Extra note: Under-9 rules count both NB & WD towards the 6-ball over maximum to restrict bowler burnout. Free hits trigger on consecutive extras.
          </p>
        </div>
      )}
    </div>
  );
}

