/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Player, BallRecord } from '../types';
import { X, Wrench, AlertTriangle, Check } from 'lucide-react';

interface EditBallModalProps {
  isOpen: boolean;
  onClose: () => void;
  ball: BallRecord | null;
  ballIndex: number;
  onSave: (updatedBall: BallRecord) => void;
  battingPlayers: Player[];
  fieldingPlayers: Player[];
}

export default function EditBallModal({
  isOpen,
  onClose,
  ball,
  ballIndex,
  onSave,
  battingPlayers,
  fieldingPlayers,
}: EditBallModalProps) {
  const [ballType, setBallType] = useState<'Normal' | 'Wide' | 'NoBall' | 'FreeHit'>('Normal');
  const [runsFromBat, setRunsFromBat] = useState<number>(0);
  const [extraType, setExtraType] = useState<'Wide' | 'NoBall' | 'Bye' | 'LegBye' | 'None'>('None');
  const [additionalRuns, setAdditionalRuns] = useState<number>(0);
  const [isWicket, setIsWicket] = useState<boolean>(false);
  const [wicketType, setWicketType] = useState<'Bowled' | 'Caught' | 'Run Out' | 'LBW' | 'Stumped' | 'Retired' | undefined>(undefined);
  const [wicketPlayerId, setWicketPlayerId] = useState<string>('');
  const [wicketFielderName, setWicketFielderName] = useState<string>('');

  useEffect(() => {
    if (ball) {
      setBallType(ball.ballType);
      setRunsFromBat(ball.runsFromBat);
      setExtraType(ball.extraType || 'None');
      
      let initialAddRuns = ball.runsFromExtras;
      if (ball.ballType === 'Wide' || ball.ballType === 'NoBall') {
        initialAddRuns = Math.max(0, ball.runsFromExtras - 1);
      }
      setAdditionalRuns(initialAddRuns);

      setIsWicket(ball.isWicket || false);
      setWicketType(ball.wicketType);
      setWicketPlayerId(ball.wicketPlayerId || '');
      setWicketFielderName(ball.wicketFielderName || '');
    }
  }, [ball, isOpen]);

  if (!isOpen || !ball) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Derive elegant descriptions on ball modification
    const strikerName = battingPlayers.find((p) => p.id === ball.strikerId)?.name || 'Striker';
    const bowlerName = fieldingPlayers.find((p) => p.id === ball.bowlerId)?.name || 'Bowler';
    
    let wicketDetailsString = '';
    if (wicketType) {
      const outPlayerName = battingPlayers.find((p) => p.id === wicketPlayerId)?.name || strikerName;
      if (wicketType === 'Retired') {
        wicketDetailsString = `Retired: ${outPlayerName}`;
      } else {
        const fielderLabel = wicketFielderName ? ` by ${wicketFielderName}` : '';
        wicketDetailsString = `Wicket: ${outPlayerName} (${wicketType}${fielderLabel})`;
      }
    }

    // Capture calculated final runs from extras
    let finalRunsExtras = additionalRuns;
    if (ballType === 'Wide' || ballType === 'NoBall') {
      finalRunsExtras = 1 + additionalRuns;
    } else if (extraType === 'None') {
      finalRunsExtras = 0;
    }

    const totalRunsThisBall = runsFromBat + finalRunsExtras;

    let ballDescription = `${bowlerName} to ${strikerName}: `;
    if (wicketType) {
      ballDescription += wicketDetailsString;
    } else if (ballType === 'Wide') {
      if (additionalRuns > 0) {
        ballDescription += `Wide delivery + ${additionalRuns} extra run${additionalRuns > 1 ? 's' : ''}`;
      } else {
        ballDescription += `Wide delivery`;
      }
    } else if (ballType === 'NoBall') {
      if (runsFromBat > 0) {
        ballDescription += `No ball delivery, ${runsFromBat} run${runsFromBat > 1 ? 's' : ''} scored off bat`;
      } else if (additionalRuns > 0) {
        ballDescription += `No ball delivery + ${additionalRuns} extra run${additionalRuns > 1 ? 's' : ''}`;
      } else {
        ballDescription += `No ball delivery`;
      }
    } else if (ballType === 'FreeHit') {
      ballDescription += `Free hit delivery scored for ${runsFromBat}`;
    } else if (extraType === 'Bye' && additionalRuns > 0) {
      ballDescription += `Byes, ${additionalRuns} extra run${additionalRuns > 1 ? 's' : ''}`;
    } else if (extraType === 'LegBye' && additionalRuns > 0) {
      ballDescription += `Leg byes, ${additionalRuns} extra run${additionalRuns > 1 ? 's' : ''}`;
    } else if (runsFromBat === 4) {
      ballDescription += `Boundary four runs`;
    } else if (runsFromBat === 6) {
      ballDescription += `Maximum sixer runs`;
    } else {
      if (totalRunsThisBall === 0) {
        ballDescription += `Dot ball`;
      } else {
        ballDescription += `${totalRunsThisBall} run${totalRunsThisBall > 1 ? 's' : ''}`;
      }
    }

    onSave({
      ...ball,
      ballType,
      runsFromBat,
      extraType: extraType === 'None' ? undefined : extraType,
      runsFromExtras: finalRunsExtras,
      isWicket: isWicket && wicketType !== 'Retired',
      wicketType: isWicket ? wicketType : undefined,
      wicketPlayerId: isWicket ? (wicketPlayerId || ball.strikerId) : undefined,
      wicketFielderName: isWicket && ['Caught', 'Run Out', 'Stumped'].includes(wicketType || '') ? wicketFielderName : undefined,
      description: ballDescription,
    });
    onClose();
  };

  const handleWicketToggle = (checked: boolean) => {
    setIsWicket(checked);
    if (checked) {
      setWicketType('Bowled');
      setWicketPlayerId(ball.strikerId);
    } else {
      setWicketType(undefined);
      setWicketPlayerId('');
      setWicketFielderName('');
    }
  };

  const handleBallTypeChange = (type: 'Normal' | 'Wide' | 'NoBall' | 'FreeHit') => {
    setBallType(type);
    if (type === 'Wide') {
      setExtraType('Wide');
      setRunsFromBat(0);
      setAdditionalRuns(0);
    } else if (type === 'NoBall') {
      setExtraType('NoBall');
      setAdditionalRuns(0);
    } else if (type === 'FreeHit') {
      setExtraType('None');
      setAdditionalRuns(0);
    } else {
      setExtraType('None');
      setAdditionalRuns(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4" id="edit-ball-modal">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Edit Ball Score Details</h3>
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">
                Ball #{ballIndex + 1} inside Over #{ball.overNum + 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[11px] text-slate-600 font-medium space-y-1">
            <p>👨‍🍳 <b>Striker:</b> {battingPlayers.find(p => p.id === ball.strikerId)?.name || 'Unknown'}</p>
            <p>🎯 <b>Bowler:</b> {fieldingPlayers.find(p => p.id === ball.bowlerId)?.name || 'Unknown'}</p>
            <p>📝 <b>Original note:</b> <span className="italic text-slate-500 font-normal">"{ball.description}"</span></p>
          </div>

          {/* Ball Type Selection */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['Normal', 'Wide', 'NoBall', 'FreeHit'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleBallTypeChange(type)}
                  className={`py-2 px-1 text-center font-extrabold text-xs rounded-xl border transition-all cursor-pointer ${
                    ballType === type
                      ? 'bg-indigo-650 border-indigo-650 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {type === 'NoBall' ? 'No Ball' : type === 'FreeHit' ? 'Free Hit' : type}
                </button>
              ))}
            </div>
          </div>

          {/* Base Extra Penalty info banner for Wide/No Ball */}
          {(ballType === 'Wide' || ballType === 'NoBall') && (
            <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-3.5 flex items-center justify-between text-xs text-amber-900 font-bold">
              <span>⚡ Base Penalty Extra:</span>
              <span className="font-extrabold px-2.5 py-1 bg-amber-100 border border-amber-200 rounded-lg text-amber-800">
                +1 Run ({ballType === 'NoBall' ? 'No Ball' : 'Wide'})
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Runs from Bat */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Runs Off Bat</label>
              <select
                value={runsFromBat}
                onChange={(e) => setRunsFromBat(Number(e.target.value))}
                disabled={ballType === 'Wide'}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
                  <option key={runs} value={runs}>{runs} Runs</option>
                ))}
              </select>
              <p className="text-[9px] text-slate-400 leading-normal">
                {ballType === 'Wide' ? 'Locked for Wide deliveries' : 'Scored off the bat'}
              </p>
            </div>

            {/* Extra Type */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Extra Penalty Type</label>
              <select
                value={extraType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setExtraType(val);
                  if (val === 'None') {
                    setAdditionalRuns(0);
                  }
                }}
                disabled={ballType === 'Wide' || ballType === 'NoBall'}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 font-extrabold disabled:opacity-50"
              >
                <option value="None">None (Normal Runs)</option>
                <option value="Wide">Wide</option>
                <option value="NoBall">No Ball</option>
                <option value="Bye">Bye (Runs with no contact)</option>
                <option value="LegBye">Leg Bye (Runs off pad)</option>
              </select>
              <p className="text-[9px] text-slate-400 leading-normal">
                {ballType === 'Wide' || ballType === 'NoBall' ? `Locked as ${ballType}` : 'Select extras penalty if applicable'}
              </p>
            </div>
          </div>

          {/* Runs from Extras */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Additional Runs Run Between Wickets
            </label>
            <select
              value={additionalRuns}
              onChange={(e) => setAdditionalRuns(Number(e.target.value))}
              disabled={ballType === 'Normal' && extraType === 'None'}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((runs) => (
                <option key={runs} value={runs}>
                  {runs === 0 ? '0 runs (No additional runs)' : `+${runs} additional run${runs > 1 ? 's' : ''}`}
                </option>
              ))}
            </select>
            <p className="text-[9px] text-slate-400 leading-relaxed italic">
              Note: Only additional runs which batters run between wickets are selected here. The 1-run wide/no-ball base penalty is auto-recorded and processed.
            </p>
          </div>

          {/* Wicket Section */}
          <div className="border border-red-150 rounded-2xl p-4 bg-red-50/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is-wicket"
                  checked={isWicket}
                  onChange={(e) => handleWicketToggle(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-red-300 rounded-sm focus:ring-red-500 cursor-pointer"
                />
                <label htmlFor="edit-is-wicket" className="text-xs font-extrabold text-red-800 cursor-pointer select-none">
                  Record Dismissal / Wicket on this Ball
                </label>
              </div>
            </div>

            {isWicket && (
              <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-200 text-left">
                <div className="grid grid-cols-2 gap-3">
                  {/* Wicket Type */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-red-500 uppercase tracking-widest">Wicket Type</label>
                    <select
                      value={wicketType || 'Bowled'}
                      onChange={(e: any) => setWicketType(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      <option value="Bowled">Bowled</option>
                      <option value="Caught">Caught</option>
                      <option value="Run Out">Run Out</option>
                      <option value="LBW">LBW</option>
                      <option value="Stumped">Stumped</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>

                  {/* Player dismissed */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-red-500 uppercase tracking-widest">Dismissed Player</label>
                    <select
                      value={wicketPlayerId}
                      onChange={(e) => setWicketPlayerId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      <option value="" disabled>-- Select Player --</option>
                      {battingPlayers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {['Caught', 'Run Out', 'Stumped'].includes(wicketType || '') && (
                  <div className="space-y-1 animate-in slide-in-from-top-1 duration-150">
                    <label className="block text-[9px] font-black text-red-500 uppercase tracking-widest">Fielder Name</label>
                    <input
                      type="text"
                      value={wicketFielderName}
                      onChange={(e) => setWicketFielderName(e.target.value)}
                      placeholder="e.g. David J"
                      className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-xs font-semibold text-slate-705"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Footer Button */}
          <div className="flex gap-3 justify-end items-center pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-205 text-xs font-extrabold text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2.5 px-5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Ball Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
