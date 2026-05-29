/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Player, BatterStats, BowlerStats, BallRecord } from '../types';
import { RotateCcw, AlertCircle, HelpCircle, Check, Swords, Settings, Award } from 'lucide-react';

interface ScoreControlsProps {
  striker: BatterStats | null;
  nonStriker: BatterStats | null;
  currentBowler: BowlerStats | null;
  availableBatters: Player[];
  availableBowlers: Player[];
  isFreeHit: boolean;
  onRecordBall: (ballData: {
    ballType: 'Normal' | 'Wide' | 'NoBall' | 'FreeHit';
    runsFromBat: number;
    runsFromExtras: number;
    extraType: 'Wide' | 'NoBall' | 'Bye' | 'LegBye' | 'None';
    isWicket: boolean;
    wicketType?: 'Bowled' | 'Caught' | 'Run Out' | 'LBW' | 'Stumped' | 'Retired';
    wicketPlayerId?: string;
    wicketFielderId?: string;
    wicketFielderName?: string;
  }) => void;
  onChangeStriker: (strikerId: string) => void;
  onChangeNonStriker: (nonStrikerId: string) => void;
  onChangeBowler: (bowlerId: string) => void;
  onUndoLastBall: () => void;
  canUndo: boolean;
  ballLimit: number;
  wicketKeeper1Id: string;
  wicketKeeper2Id: string;
  fieldingPlayers: Player[];
  onChangeWicketKeeper1: (keeperId: string) => void;
  onChangeWicketKeeper2: (keeperId: string) => void;
  currentOverNumber: number;
  isSpecialSingleActive?: boolean;
  onEndOver: () => void;
  currentOverBalls: BallRecord[];
}

export default function ScoreControls({
  striker,
  nonStriker,
  currentBowler,
  availableBatters,
  availableBowlers,
  isFreeHit,
  onRecordBall,
  onChangeStriker,
  onChangeNonStriker,
  onChangeBowler,
  onUndoLastBall,
  canUndo,
  ballLimit,
  wicketKeeper1Id,
  wicketKeeper2Id,
  fieldingPlayers,
  onChangeWicketKeeper1,
  onChangeWicketKeeper2,
  currentOverNumber,
  isSpecialSingleActive = false,
  onEndOver,
  currentOverBalls,
}: ScoreControlsProps) {
  // Advanced panel state Toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advBallType, setAdvBallType] = useState<'Normal' | 'Wide' | 'NoBall' | 'FreeHit'>(isFreeHit ? 'FreeHit' : 'Normal');
  const [advRunsBat, setAdvRunsBat] = useState<number>(0);
  const [advRunsExtras, setAdvRunsExtras] = useState<number>(0);
  const [advExtraType, setAdvExtraType] = useState<'Wide' | 'NoBall' | 'Bye' | 'LegBye' | 'None'>('None');

  // Wicket flow modal
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [wicketType, setWicketType] = useState<'Bowled' | 'Caught' | 'Run Out' | 'LBW' | 'Stumped' | 'Retired'>('Bowled');
  const [wicketPlayerId, setWicketPlayerId] = useState<string>(striker?.playerId || '');
  const [wicketFielderId, setWicketFielderId] = useState<string>('');

  // End of over manual decision states
  const [showEndOverConfirm, setShowEndOverConfirm] = useState(false);
  const [dismissedOverForNumber, setDismissedOverForNumber] = useState(-1);

  const currentOverLegalBalls = currentOverBalls ? currentOverBalls.filter((b) => b.ballType !== 'FreeHit').length : 0;

  React.useEffect(() => {
    if (currentOverLegalBalls === 6 && currentOverNumber !== dismissedOverForNumber && !isFreeHit) {
      setShowEndOverConfirm(true);
    }
  }, [currentOverLegalBalls, currentOverNumber, dismissedOverForNumber, isFreeHit]);

  // Sync free hit state when active
  React.useEffect(() => {
    if (isFreeHit) {
      setAdvBallType('FreeHit');
    } else {
      setAdvBallType('Normal');
    }
  }, [isFreeHit]);

  // Quick state overrides
  const handleQuickRun = (runs: number) => {
    if (!striker || (!nonStriker && !isSpecialSingleActive) || !currentBowler) return;

    if (striker.ballsFaced >= ballLimit && !isFreeHit && !isSpecialSingleActive) {
      alert(`Batter ${striker.playerName} has hit the retirement limit of ${ballLimit} balls! Please retire them first.`);
      return;
    }

    onRecordBall({
      ballType: isFreeHit ? 'FreeHit' : 'Normal',
      runsFromBat: runs,
      runsFromExtras: 0,
      extraType: 'None',
      isWicket: false,
    });
  };

  const handleQuickExtra = (type: 'Wide' | 'NoBall' | 'Bye' | 'LegBye') => {
    if (!striker || (!nonStriker && !isSpecialSingleActive) || !currentBowler) return;

    if (striker.ballsFaced >= ballLimit && !isFreeHit && !isSpecialSingleActive) {
      alert(`Batter ${striker.playerName} has hit the retirement limit of ${ballLimit} balls! They must retire first.`);
      return;
    }

    if (type === 'Wide') {
      onRecordBall({
        ballType: 'Wide',
        runsFromBat: 0,
        runsFromExtras: 1, // 1 run base penalty
        extraType: 'Wide',
        isWicket: false,
      });
    } else if (type === 'NoBall') {
      onRecordBall({
        ballType: 'NoBall',
        runsFromBat: 0,
        runsFromExtras: 1, // 1 run base penalty
        extraType: 'NoBall',
        isWicket: false,
      });
    } else if (type === 'Bye') {
      onRecordBall({
        ballType: 'Normal',
        runsFromBat: 0,
        runsFromExtras: 1,
        extraType: 'Bye',
        isWicket: false,
      });
    } else if (type === 'LegBye') {
      onRecordBall({
        ballType: 'Normal',
        runsFromBat: 0,
        runsFromExtras: 1,
        extraType: 'LegBye',
        isWicket: false,
      });
    }
  };

  const handleAdvancedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!striker || (!nonStriker && !isSpecialSingleActive) || !currentBowler) return;

    if (striker.ballsFaced >= ballLimit && advBallType !== 'FreeHit' && !isSpecialSingleActive) {
      alert(`Batter ${striker.playerName} has hit the retirement limit of ${ballLimit} balls!`);
      return;
    }

    let penalty = 0;
    if (advBallType === 'Wide' || advBallType === 'NoBall') {
      penalty = 1;
    }

    const runsBat = advBallType === 'Wide' ? 0 : advRunsBat;
    const runsExt = advBallType === 'Wide' 
      ? (penalty + advRunsExtras) 
      : (advExtraType === 'None' ? penalty : penalty + advRunsExtras);

    onRecordBall({
      ballType: advBallType,
      runsFromBat: runsBat,
      runsFromExtras: runsExt,
      extraType: advBallType === 'Wide' 
        ? 'Wide' 
        : advBallType === 'NoBall' 
        ? 'NoBall' 
        : advExtraType,
      isWicket: false,
    });

    setAdvRunsBat(0);
    setAdvRunsExtras(0);
    setAdvExtraType('None');
    setShowAdvanced(false);
  };

  const handleWicketSubmit = () => {
    if (!striker || (!nonStriker && !isSpecialSingleActive) || !currentBowler) return;

    if (isFreeHit && wicketType !== 'Run Out' && wicketType !== 'Retired') {
      alert("FREE HIT RULES: You can ONLY get out by a Run Out or Retired off a Free Hit ball!");
      return;
    }

    const needsFielder = ['Caught', 'Run Out', 'Stumped'].includes(wicketType);
    if (needsFielder && !wicketFielderId) {
      alert(`Please select the fielder who made the ${wicketType}!`);
      return;
    }

    const fielderObj = fieldingPlayers.find((p) => p.id === wicketFielderId);
    const wicketFielderName = fielderObj ? fielderObj.name : undefined;

    onRecordBall({
      ballType: isFreeHit ? 'FreeHit' : 'Normal',
      runsFromBat: 0,
      runsFromExtras: 0,
      extraType: 'None',
      isWicket: wicketType !== 'Retired',
      wicketType,
      wicketPlayerId,
      wicketFielderId: needsFielder ? wicketFielderId : undefined,
      wicketFielderName: needsFielder ? wicketFielderName : undefined,
    });

    setWicketFielderId('');
    setShowWicketModal(false);
  };

  const isStrikerNull = striker === null;
  const isNonStrikerNull = nonStriker === null;
  const isBowlerNull = currentBowler === null;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6" id="score-controls-panel">
      {/* Header with Title and Always-Visible Manual End Over Button */}
      <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 pb-4 border-b border-slate-100" id="score-controls-header">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600 shrink-0 animate-spin-slow" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-sans">
            Score Entry Controls
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowEndOverConfirm(true)}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          title="Manually end the current over at any time"
          id="btn-global-manual-end-over"
        >
          <span>MANUAL END OVER ➔</span>
        </button>
      </div>

      {/* Block 1: Active Lineup selectors */}
      <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60" id="roster-selectors">
        <div className="space-y-4">
          {/* Batting Team Assignments */}
          <div>
            <h4 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2.5">
              Batting Crew Assignments
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Striker Select */}
              <div className="space-y-1.5 animate-in fade-in">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Striker (ON STRIKE *)</span>
                  {isSpecialSingleActive && (
                    <span className="text-[8px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">SOLO STRIKER</span>
                  )}
                </label>
                <select
                  value={striker?.playerId || ''}
                  onChange={(e) => onChangeStriker(e.target.value)}
                  disabled={isSpecialSingleActive}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer disabled:bg-indigo-50/50 disabled:border-indigo-150 disabled:text-indigo-900 disabled:font-black"
                  id="select-striker"
                >
                  <option value="" disabled>-- Select Striker --</option>
                  {availableBatters.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.role})
                    </option>
                  ))}
                  {striker && (
                    <option value={striker.playerId} disabled>
                      {striker.playerName} ({isSpecialSingleActive ? 'Solo Striker' : 'Current'})
                    </option>
                  )}
                </select>
              </div>

              {/* Non Striker Select */}
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Non-Striker</span>
                  {isSpecialSingleActive && (
                    <span className="text-[8px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">SOLO RUNNER ONLY</span>
                  )}
                </label>
                <select
                  value={nonStriker?.playerId || ''}
                  onChange={(e) => onChangeNonStriker(e.target.value)}
                  disabled={isSpecialSingleActive && !nonStriker}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer disabled:bg-indigo-50/50 disabled:border-indigo-150 disabled:text-indigo-900 disabled:font-black"
                  id="select-non-striker"
                >
                  <option value="" disabled={!isSpecialSingleActive}>
                    {isSpecialSingleActive ? '-- No Non-Striker (Solo Mode) --' : '-- Select Non-Striker --'}
                  </option>
                  {availableBatters.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.role})
                    </option>
                  ))}
                  {nonStriker && (
                    <option value={nonStriker.playerId} disabled>
                      {nonStriker.playerName} ({isSpecialSingleActive ? 'Solo Runner' : 'Current'})
                    </option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Fielding Team Assignments */}
          <div className="pt-3 border-t border-slate-200">
            <h4 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2.5">
              Fielding Crew & Wicket Keeper Assignments
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bowler Select */}
              <div className="space-y-1.5 animate-in fade-in">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Active Bowler
                </label>
                <select
                  value={currentBowler?.playerId || ''}
                  onChange={(e) => onChangeBowler(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                  id="select-bowler"
                >
                  <option value="" disabled>-- Select Bowler --</option>
                  {availableBowlers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.role})
                    </option>
                  ))}
                  {currentBowler && <option value={currentBowler.playerId} disabled>{currentBowler.playerName} (Current)</option>}
                </select>
              </div>

              {/* Wicket Keeper 1 (Overs 1-10) */}
              <div className="space-y-1.5 relative">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Keeper (Overs 1-10)</span>
                  {currentOverNumber <= 10 && (
                    <span className="text-[8px] bg-emerald-500 text-white font-black uppercase px-1.5 py-0.5 rounded-md animate-pulse">ACTIVE NOW</span>
                  )}
                </label>
                <select
                  value={wicketKeeper1Id}
                  onChange={(e) => onChangeWicketKeeper1(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-550/30 cursor-pointer ${
                    currentOverNumber <= 10 ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs font-extrabold' : 'border-slate-200'
                  }`}
                  id="select-keeper-1"
                >
                  <option value="" disabled>-- Select Wicket Keeper --</option>
                  {fieldingPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Wicket Keeper 2 (Overs 11-20) */}
              <div className="space-y-1.5 relative">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Keeper (Overs 11-20)</span>
                  {currentOverNumber > 10 && (
                    <span className="text-[8px] bg-emerald-500 text-white font-black uppercase px-1.5 py-0.5 rounded-md animate-pulse">ACTIVE NOW</span>
                  )}
                </label>
                <select
                  value={wicketKeeper2Id}
                  onChange={(e) => onChangeWicketKeeper2(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-550/30 cursor-pointer ${
                    currentOverNumber > 10 ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs font-extrabold' : 'border-slate-200'
                  }`}
                  id="select-keeper-2"
                >
                  <option value="" disabled>-- Select Wicket Keeper --</option>
                  {fieldingPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roster Assignment warnings */}
      {(isStrikerNull || (isNonStrikerNull && !isSpecialSingleActive) || isBowlerNull) ? (
        <div className="bg-amber-50 text-amber-800 text-xs p-4 rounded-2xl border border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <span className="font-extrabold block mb-0.5 uppercase tracking-wide">CREASE LINEUP REQUIRED</span>
            Ensure you assign the Striker, Non-Striker (if not Solo Mode), and Bowler above to open the ball recording score control keypad.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Score Pad Deck */}
          <div className="space-y-4" id="quick-score-pad">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                BALL BY BALL SCORING PAD
              </h3>
              
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEndOverConfirm(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                  title="Force end the current over manually"
                  id="btn-manual-end-over"
                >
                  <span>END OVER ➔</span>
                </button>

                {!isSpecialSingleActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeStriker(nonStriker.playerId);
                      onChangeNonStriker(striker.playerId);
                    }}
                    className="px-3 py-1.5 bg-indigo-55 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Swap batsman striker ends"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>ROTATE STRIKE</span>
                  </button>
                ) : (
                  <span className="text-[9px] font-extrabold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5">
                    <Swords className="w-3 h-3 text-indigo-555" />
                    <span>Solo Striker Locked</span>
                  </span>
                )}
              </div>
            </div>

            {/* Inline Confirm & End Over banner */}
            {currentOverLegalBalls >= 6 && !isFreeHit && (
              <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300" id="over-complete-banner-inline">
                <div className="flex items-center gap-3">
                  <span className="text-2xl animate-bounce">🔔</span>
                  <div className="text-left">
                    <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Confirm & Trigger End of Over {currentOverNumber}</h4>
                    <p className="text-xs text-amber-700 font-medium">Currently, {currentOverLegalBalls} legal balls have been bowled. Please end the over to rotate batsman strike ends and assign the next bowler.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEndOverConfirm(false);
                    onEndOver();
                  }}
                  className="w-full sm:w-auto px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:scale-102 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  id="btn-inline-trigger-end-over"
                >
                  <span>Confirm & End Over ➔</span>
                </button>
              </div>
            )}
            
            {/* Minimal CSS design control block: exact score buttons from template */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* Dot Button */}
              <button
                onClick={() => handleQuickRun(0)}
                className="py-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="text-2xl font-black text-slate-900">0</span>
                <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-0.5">DOT BALL</span>
              </button>

              {/* Single Run */}
              <button
                onClick={() => handleQuickRun(1)}
                className="py-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="text-2xl font-black text-slate-900">1</span>
                <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-0.5">SINGLE</span>
              </button>

              {/* Double Runs */}
              <button
                onClick={() => handleQuickRun(2)}
                className="py-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="text-2xl font-black text-slate-900">2</span>
                <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-0.5">DOUBLE</span>
              </button>

              {/* Triple Runs */}
              <button
                onClick={() => handleQuickRun(3)}
                className="py-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="text-2xl font-black text-slate-900">3</span>
                <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-0.5">TRIPLE</span>
              </button>

              {/* Boundary 4 */}
              <button
                onClick={() => handleQuickRun(4)}
                className="py-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="text-2xl font-black text-indigo-600">4</span>
                <span className="text-[9px] text-indigo-400 font-extrabold uppercase mt-0.5">BOUNDARY</span>
              </button>

              {/* Maximum 6 */}
              <button
                onClick={() => handleQuickRun(6)}
                className="py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex flex-col items-center justify-center transition-all cursor-pointer shadow-md shadow-indigo-100 active:scale-95"
              >
                <span className="text-2xl font-black">6</span>
                <span className="text-[9px] text-indigo-100/80 font-extrabold uppercase mt-0.5">MAXIMUM</span>
              </button>
            </div>

            {/* Extras, Dismissal, and Advanced Options key rows */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
              <button
                onClick={() => handleQuickExtra('Wide')}
                className="py-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100/75 border border-amber-200 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <span className="text-base font-extrabold text-amber-700">WD</span>
                <span className="text-[9px] text-amber-500 font-black uppercase mt-0.5">WIDE</span>
              </button>

              <button
                onClick={() => handleQuickExtra('NoBall')}
                className="py-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100/75 border border-amber-200 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <span className="text-base font-extrabold text-amber-700">NB</span>
                <span className="text-[9px] text-amber-500 font-black uppercase mt-0.5">NO BALL</span>
              </button>

              <button
                onClick={() => handleQuickExtra('Bye')}
                className="py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <span className="text-base font-extrabold text-slate-700">BYE</span>
                <span className="text-[9px] text-slate-500 font-black uppercase mt-0.5">+ EXTRAS</span>
              </button>

              <button
                onClick={() => handleQuickExtra('LegBye')}
                className="py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <span className="text-base font-extrabold text-slate-700">LB</span>
                <span className="text-[9px] text-slate-500 font-black uppercase mt-0.5 font-mono font-bold">LEG BYE</span>
              </button>

              <button
                onClick={() => {
                  setWicketPlayerId(striker.playerId);
                  setShowWicketModal(true);
                }}
                className="py-3.5 rounded-2xl bg-red-50 hover:bg-red-100/70 border border-red-200 flex flex-col items-center justify-center col-span-2 md:col-span-1 transition-all cursor-pointer active:scale-95"
              >
                <span className="text-base font-black text-red-600 italic">OUT</span>
                <span className="text-[9px] text-red-400 font-black uppercase mt-0.5">WICKET</span>
              </button>
            </div>

            {/* Config & Editor toggles */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`px-4 py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showAdvanced 
                    ? 'bg-slate-800 border-slate-800 text-white' 
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{showAdvanced ? 'HIDE ADVANCED SCORER' : 'USE ADVANCED SCORER'}</span>
              </button>
            </div>
          </div>

          {/* Advanced / Specific Delivery Scoring Panel */}
          {showAdvanced && (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-inner space-y-4" id="advanced-ball-form">
              <div className="border-b border-slate-200/60 pb-3">
                <h4 className="text-xs font-black text-slate-700 flex items-center gap-2 tracking-wider">
                  <span>SPECIFIC DELIVERY EDITOR</span>
                  {isFreeHit && <span className="text-[9px] bg-red-100 text-red-800 font-bold uppercase rounded px-1.5 py-0.5 font-black animate-pulse">FREE HIT ACTIVE</span>}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Control individual batsman runs, additional penalties, and specific types of fielding extras.</p>
              </div>

              <form onSubmit={handleAdvancedSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Delivery type */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ball Type</label>
                    <select
                      value={advBallType}
                      onChange={(e) => {
                        const type = e.target.value as any;
                        setAdvBallType(type);
                        if (type === 'Wide') {
                          setAdvRunsBat(0);
                          setAdvExtraType('Wide');
                        } else if (type === 'NoBall') {
                          setAdvExtraType('NoBall');
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value="Normal">Normal ball delivery</option>
                      <option value="Wide">Wide extra ball</option>
                      <option value="NoBall">No Ball extra</option>
                      <option value="FreeHit">Free hit delivery</option>
                    </select>
                  </div>

                  {/* Batsman runs */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Runs from Bat</label>
                    <select
                      value={advRunsBat}
                      disabled={advBallType === 'Wide'}
                      onChange={(e) => setAdvRunsBat(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
                    >
                      <option value={0}>0 (Dot)</option>
                      <option value={1}>1 Run</option>
                      <option value={2}>2 Runs</option>
                      <option value={3}>3 Runs</option>
                      <option value={4}>4 Runs</option>
                      <option value={5}>5 Runs</option>
                      <option value={6}>6 Runs</option>
                    </select>
                  </div>

                  {/* Extras Runs */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fielding Byes / LegByes</label>
                    <div className="flex gap-2">
                      <select
                        value={advExtraType}
                        disabled={advBallType === 'Wide'}
                        onChange={(e) => {
                          const type = e.target.value as any;
                          setAdvExtraType(type);
                          if (type === 'None') setAdvRunsExtras(0);
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
                      >
                        <option value="None">None</option>
                        <option value="Bye">Byes</option>
                        <option value="LegBye">Leg Byes</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        disabled={advExtraType === 'None'}
                        value={advExtraType === 'None' ? 0 : advRunsExtras}
                        onChange={(e) => setAdvRunsExtras(Number(e.target.value))}
                        className="w-20 px-1.5 py-2 text-center bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400"
                        id="fielding-byes-value"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(false)}
                    className="px-4 py-2 text-xs font-extrabold text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-extrabold rounded-xl hover:bg-indigo-700 shadow-xs"
                  >
                    Record Ball Detail
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Undo and stats section footer */}
          <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-slate-100 gap-4">
            <span className="text-[11px] text-slate-400 font-medium">
              * Note: Individual batsmen automatically retire once reaching their assigned over ball limits.
            </span>
            
            <button
              onClick={onUndoLastBall}
              disabled={!canUndo}
              className="w-full sm:w-auto px-5 py-2.5 bg-rose-50 hover:bg-rose-100/80 disabled:opacity-40 text-rose-700 font-bold text-xs rounded-xl border border-rose-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              id="btn-undo-last-ball"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>UNDO LAST DELIVERY</span>
            </button>
          </div>
        </div>
      )}

      {/* Wicket / Retirement Overlay modal */}
      {showWicketModal && striker && (
        <div className="fixed inset-0 z-55 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-lg p-6 space-y-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-slate-150 pb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xl font-bold">
                ☠
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Record Batsman Dismissal</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Select legal dismissal type or voluntary retirement</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Select batsman to dismiss */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Who is out?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setWicketPlayerId(striker.playerId)}
                    className={`p-3 text-xs font-extrabold rounded-2xl border text-center transition-all ${
                      wicketPlayerId === striker.playerId
                        ? 'bg-red-50 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {striker.playerName} (Striker)
                  </button>
                  {nonStriker && (
                    <button
                      onClick={() => setWicketPlayerId(nonStriker.playerId)}
                      className={`p-3 text-xs font-extrabold rounded-2xl border text-center transition-all ${
                        wicketPlayerId === nonStriker.playerId
                          ? 'bg-red-50 border-red-400 text-red-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    >
                      {nonStriker.playerName} (Non-Striker)
                    </button>
                  )}
                </div>
              </div>

              {/* Select Wicket Type */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Method of Dismissal</label>
                <select
                  value={wicketType}
                  onChange={(e) => {
                    const newType = e.target.value as any;
                    setWicketType(newType);
                    // Clear fielder state if not needed
                    if (!['Caught', 'Run Out', 'Stumped'].includes(newType)) {
                      setWicketFielderId('');
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Bowled">Bowled</option>
                  <option value="Caught">Caught</option>
                  <option value="Run Out">Run Out</option>
                  <option value="LBW">LBW (Leg Before Wicket)</option>
                  <option value="Stumped">Stumped</option>
                  <option value="Retired">Retired / Reached Ball Limit</option>
                </select>
                {isFreeHit && wicketType !== 'Run Out' && wicketType !== 'Retired' && (
                  <p className="text-[10px] text-red-500 font-extrabold bg-red-50 p-2.5 rounded-xl border border-red-150 mt-2">
                    ⚠️ Free Hit active: Bowler cannot claim this wicket. Only Run Out or Retirements count!
                  </p>
                )}
              </div>

              {/* Select Fielder (Conditional) */}
              {['Caught', 'Run Out', 'Stumped'].includes(wicketType) && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Fielder Involved ({wicketType === 'Caught' ? 'Who caught it?' : wicketType === 'Stumped' ? 'Who stumped it?' : 'Who ran them out?'})
                  </label>
                  <select
                    value={wicketFielderId}
                    onChange={(e) => setWicketFielderId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-550/20"
                  >
                    <option value="">-- Select Fielder --</option>
                    {fieldingPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWicketModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 font-extrabold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWicketSubmit}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-xs"
              >
                Confirm Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Over Confirmation Modal */}
      {showEndOverConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-xl space-y-4 animate-in fade-in zoom-in-95" id="end-over-confirm-modal">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Settings className="w-4 h-4 text-indigo-600" />
                <span>Confirm End of Over {currentOverNumber}</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setDismissedOverForNumber(currentOverNumber);
                  setShowEndOverConfirm(false);
                }}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-sm hover:scale-110 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Currently, <b className="text-indigo-600 font-extrabold">{currentOverLegalBalls}</b> legal balls have been bowled in Over {currentOverNumber}.
              <br /><br />
              Do you want to confirm ending this over? This will rotate batsman strike ends and unassign the current bowler.
            </p>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowEndOverConfirm(false);
                  onEndOver();
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer text-center hover:scale-102 active:scale-98"
                id="btn-confirm-end-over-ok"
              >
                Confirm End Over
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissedOverForNumber(currentOverNumber);
                  setShowEndOverConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center hover:scale-102 active:scale-98"
                id="btn-confirm-end-over-cancel"
              >
                Keep Bowling
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
