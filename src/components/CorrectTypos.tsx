/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Team } from '../types';
import { PencilLine, Check, X, ShieldAlert } from 'lucide-react';

interface CorrectTyposProps {
  teams: [Team, Team];
  isOpen: boolean;
  onClose: () => void;
  onSaveTeams: (updatedTeams: [Team, Team]) => void;
  onCorrectPlayerName: (playerId: string, newName: string) => void;
}

export default function CorrectTypos({ teams, isOpen, onClose, onSaveTeams, onCorrectPlayerName }: CorrectTyposProps) {
  const [team1Name, setTeam1Name] = useState(teams[0].name);
  const [team2Name, setTeam2Name] = useState(teams[1].name);
  const [playerNames, setPlayerNames] = useState<{ [playerId: string]: string }>(
    Object.fromEntries(teams.flatMap((t) => t.players).map((p) => [p.id, p.name]))
  );

  const handlePlayerNameChange = (id: string, value: string) => {
    setPlayerNames((prev) => ({ ...prev, [id]: value }));
  };

  const handleApplyCorrections = () => {
    // 1. Correct any modified player names
    teams.flatMap((t) => t.players).forEach((p) => {
      const enteredName = playerNames[p.id]?.trim();
      if (enteredName && enteredName !== p.name) {
        onCorrectPlayerName(p.id, enteredName);
      }
    });

    // 2. Correct team names
    const updatedTeams: [Team, Team] = [
      {
        ...teams[0],
        name: team1Name.trim() || teams[0].name,
        players: teams[0].players.map((p) => ({
          ...p,
          name: playerNames[p.id]?.trim() || p.name,
        })),
      },
      {
        ...teams[1],
        name: team2Name.trim() || teams[1].name,
        players: teams[1].players.map((p) => ({
          ...p,
          name: playerNames[p.id]?.trim() || p.name,
        })),
      },
    ];

    onSaveTeams(updatedTeams);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-205 shadow-xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <PencilLine className="w-5 h-5 text-indigo-650" />
            <h3 className="text-base font-black text-slate-800 tracking-tight">Correct Match Details & Typos</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="bg-amber-50/70 border border-amber-100 p-4 rounded-2xl text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
            <ShieldAlert className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
            <span>
              <strong>Note on live correction</strong>: Editing names or spelling mistakes will dynamically correct records throughout current team cards, scorecards, and live ball descriptions.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team A */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Team 1 Name</label>
                <input
                  type="text"
                  value={team1Name}
                  onChange={(e) => setTeam1Name(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-505/30"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-widest">Team 1 Players Spelling</label>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {teams[0].players.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={playerNames[p.id] ?? ''}
                        onChange={(e) => handlePlayerNameChange(p.id, e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-505/30"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Team B */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Team 2 Name</label>
                <input
                  type="text"
                  value={team2Name}
                  onChange={(e) => setTeam2Name(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-550/30"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-widest">Team 2 Players Spelling</label>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {teams[1].players.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={playerNames[p.id] ?? ''}
                        onChange={(e) => handlePlayerNameChange(p.id, e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-505/30"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-150 bg-slate-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4.5 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-500 font-bold text-xs uppercase tracking-wide rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyCorrections}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Apply Spell Corrections</span>
          </button>
        </div>

      </div>
    </div>
  );
}
