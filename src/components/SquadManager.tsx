/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Player, Team } from '../types';
import { 
  Plus, 
  Trash2, 
  Users, 
  HelpCircle, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Edit3, 
  Check, 
  X, 
  Save, 
  UserPlus, 
  FolderOpen,
  Copy
} from 'lucide-react';

interface SquadManagerProps {
  teams: [Team, Team];
  onSaveTeams: (updatedTeams: [Team, Team]) => void;
  onStartMatch: () => void;
  matchOvers: number;
  setMatchOvers: (overs: number) => void;
  matchBatsmanBallLimit: number;
  setMatchBatsmanBallLimit: (limit: number) => void;
}

interface MasterTeamProfile {
  id: string;
  name: string;
  players: Player[];
}

export default function SquadManager({
  teams,
  onSaveTeams,
  onStartMatch,
  matchOvers,
  setMatchOvers,
  matchBatsmanBallLimit,
  setMatchBatsmanBallLimit,
}: SquadManagerProps) {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [localTeams, setLocalTeams] = useState<[Team, Team]>([...teams]);
  
  // Player form states for active match
  const [playerName, setPlayerName] = useState('');
  const [playerRole, setPlayerRole] = useState<Player['role']>('Batter');

  // Master profiles management state
  const [masterProfiles, setMasterProfiles] = useState<MasterTeamProfile[]>(() => {
    const saved = localStorage.getItem('u9_junior_master_profiles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse master profiles", e);
      }
    }
    // Default initial master squads (saves time during first load)
    return [
      {
        id: 'master-a',
        name: 'Junior Warriors',
        players: [
          { id: 'a-1', name: 'Leo "Express" Carter', role: 'All-rounder' },
          { id: 'a-2', name: 'Jaxson Miller', role: 'Batter' },
          { id: 'a-3', name: 'Arlo Bennett', role: 'Batter' },
          { id: 'a-4', name: 'Mason Davis', role: 'Bowler' },
          { id: 'a-5', name: 'Elijah Bennett', role: 'All-rounder' },
          { id: 'a-6', name: 'Oscar Wood', role: 'Wicket-keeper' },
          { id: 'a-7', name: 'Freddie Collins', role: 'Bowler' },
          { id: 'a-8', name: 'Toby Hall', role: 'Batter' }
        ]
      },
      {
        id: 'master-b',
        name: 'Little Giants',
        players: [
          { id: 'b-1', name: 'Lucas Green', role: 'All-rounder' },
          { id: 'b-2', name: 'Milo Cooper', role: 'Batter' },
          { id: 'b-3', name: 'Theo Ward', role: 'Batter' },
          { id: 'b-4', name: 'Noah Bailey', role: 'All-rounder' },
          { id: 'b-5', name: 'Arthur Morris', role: 'Bowler' },
          { id: 'b-6', name: 'Harrison Palmer', role: 'Wicket-keeper' },
          { id: 'b-7', name: 'Archie King', role: 'Bowler' },
          { id: 'b-8', name: 'Jude Parker', role: 'Batter' }
        ]
      }
    ];
  });

  // Track editing profiles
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [newMasterTeamName, setNewMasterTeamName] = useState('');
  const [newMasterPlayerName, setNewMasterPlayerName] = useState('');
  const [newMasterPlayerRole, setNewMasterPlayerRole] = useState<Player['role']>('Batter');
  const [renamingMasterName, setRenamingMasterName] = useState('');

  // Persist master profiles to localStorage
  useEffect(() => {
    localStorage.setItem('u9_junior_master_profiles', JSON.stringify(masterProfiles));
  }, [masterProfiles]);

  // Sync prop changes back if necessary
  useEffect(() => {
    setLocalTeams([...teams]);
  }, [teams]);

  const activeTeam = localTeams[activeTab];

  // Active match team rename
  const handleUpdateTeamName = (name: string) => {
    const updated = [...localTeams] as [Team, Team];
    updated[activeTab] = { ...updated[activeTab], name };
    setLocalTeams(updated);
    onSaveTeams(updated);
  };

  // Add player to active match list
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const newPlayer: Player = {
      id: `${activeTab}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: playerName.trim(),
      role: playerRole,
    };

    const updated = [...localTeams] as [Team, Team];
    updated[activeTab] = {
      ...updated[activeTab],
      players: [...updated[activeTab].players, newPlayer],
    };

    setLocalTeams(updated);
    onSaveTeams(updated);
    setPlayerName('');
    setPlayerRole('Batter');
  };

  // Remove player from active match (Option to delete sick/non-attending players)
  const handleRemovePlayer = (id: string) => {
    const updated = [...localTeams] as [Team, Team];
    updated[activeTab] = {
      ...updated[activeTab],
      players: updated[activeTab].players.filter((p) => p.id !== id),
    };
    setLocalTeams(updated);
    onSaveTeams(updated);
  };

  // Rearrange batting / playing order inside the active match
  const handleMoveActivePlayer = (index: number, direction: 'up' | 'down') => {
    const updated = [...localTeams] as [Team, Team];
    const players = [...updated[activeTab].players];
    
    if (direction === 'up' && index > 0) {
      const temp = players[index];
      players[index] = players[index - 1];
      players[index - 1] = temp;
    } else if (direction === 'down' && index < players.length - 1) {
      const temp = players[index];
      players[index] = players[index + 1];
      players[index + 1] = temp;
    }

    updated[activeTab] = { ...updated[activeTab], players };
    setLocalTeams(updated);
    onSaveTeams(updated);
  };

  // --- Master Profiles Logic ---

  // Load a Master Profile directly into active match
  const handleLoadMasterToActive = (profile: MasterTeamProfile, targetIdx: 0 | 1) => {
    const updated = [...localTeams] as [Team, Team];
    updated[targetIdx] = {
      name: profile.name,
      players: profile.players.map(p => ({ ...p })), // clone players
      batsmanBallLimit: matchBatsmanBallLimit
    };
    setLocalTeams(updated);
    onSaveTeams(updated);
    alert(`Loaded master profile "${profile.name}" into ${targetIdx === 0 ? '1st Innings' : '2nd Innings'}!`);
  };

  // Save the currently set active match team back as a master profile
  const handleSaveActiveToMaster = () => {
    const newProfile: MasterTeamProfile = {
      id: `master-${Date.now()}`,
      name: activeTeam.name || `Team ${activeTab === 0 ? 'A' : 'B'}`,
      players: activeTeam.players.map(p => ({ ...p }))
    };
    setMasterProfiles([...masterProfiles, newProfile]);
    alert(`Successfully registered "${newProfile.name}" as a device-persisted Master Team Profile!`);
  };

  // Create new master profile
  const handleCreateMasterProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterTeamName.trim()) return;

    const newProfile: MasterTeamProfile = {
      id: `master-${Date.now()}`,
      name: newMasterTeamName.trim(),
      players: []
    };

    setMasterProfiles([...masterProfiles, newProfile]);
    setNewMasterTeamName('');
    setEditingProfileId(newProfile.id);
    setRenamingMasterName(newProfile.name);
  };

  // Delete master profile
  const handleDeleteMasterProfile = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}" from your Master Profiles? This will not affect active matches.`)) {
      setMasterProfiles(masterProfiles.filter(p => p.id !== id));
      if (editingProfileId === id) setEditingProfileId(null);
    }
  };

  // Save Name rename for Master Profile
  const handleSaveMasterProfileRename = (id: string) => {
    if (!renamingMasterName.trim()) return;
    setMasterProfiles(masterProfiles.map(p => p.id === id ? { ...p, name: renamingMasterName.trim() } : p));
  };

  // Add player to a Master Profile
  const handleAddPlayerToMaster = (e: React.FormEvent, profileId: string) => {
    e.preventDefault();
    if (!newMasterPlayerName.trim()) return;

    const newPlayer: Player = {
      id: `mplayer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newMasterPlayerName.trim(),
      role: newMasterPlayerRole
    };

    setMasterProfiles(masterProfiles.map(p => {
      if (p.id === profileId) {
        return {
          ...p,
          players: [...p.players, newPlayer]
        };
      }
      return p;
    }));

    setNewMasterPlayerName('');
    setNewMasterPlayerRole('Batter');
  };

  // Remove player from Master Profile
  const handleRemovePlayerFromMaster = (profileId: string, playerId: string) => {
    setMasterProfiles(masterProfiles.map(p => {
      if (p.id === profileId) {
        return {
          ...p,
          players: p.players.filter(pl => pl.id !== playerId)
        };
      }
      return p;
    }));
  };

  // Move player order in Master Profile
  const handleMoveMasterPlayer = (profileId: string, index: number, direction: 'up' | 'down') => {
    setMasterProfiles(masterProfiles.map(p => {
      if (p.id !== profileId) return p;
      const players = [...p.players];

      if (direction === 'up' && index > 0) {
        const temp = players[index];
        players[index] = players[index - 1];
        players[index - 1] = temp;
      } else if (direction === 'down' && index < players.length - 1) {
        const temp = players[index];
        players[index] = players[index + 1];
        players[index + 1] = temp;
      }

      return {
        ...p,
        players
      };
    }));
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-8 font-sans text-slate-900" id="squad-manager-container">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Design Header Section */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-3xl shadow-xs border border-slate-200 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl self-start sm:self-center">
              C
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight leading-none text-slate-900">U9 Junior League</h1>
              <p className="text-xs text-indigo-600 mt-2.5 uppercase tracking-widest font-black">Cricket Scorer & Match Configurator</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1.5 bg-amber-50 text-amber-800 rounded-lg text-xs font-bold border border-amber-200 uppercase tracking-wide">
              U9 Active Rules
            </div>
          </div>
        </header>

        {/* Custom Rules Quick Info Box */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs text-xs text-slate-600 space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-wider text-[10px]">
            <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Active Junior Game Standards</span>
          </div>
          <p className="leading-relaxed">
            Wides and No balls carry a <strong>1-run penalty</strong> recorded as team extras, counting directly toward the bowler's 6-ball over cap to prevent fatigue. Batters retire retired-out once they reach their matching ball-limit selection. Rearrange the batting lineups using up/down controls.
          </p>
        </div>

        {/* PERSISTED MASTER SQUADS - MASTER PROFILE CONTROLS */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5" id="master-squads-panel">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">👥</span>
              <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight">Master Team Profiles</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Persisted globally for future match setups</p>
              </div>
            </div>
            {/* Create profile form */}
            <form onSubmit={handleCreateMasterProfile} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="New Team Profile Name..."
                value={newMasterTeamName}
                onChange={(e) => setNewMasterTeamName(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 flex-1 sm:w-48"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create</span>
              </button>
            </form>
          </div>

          {/* Master profile cards */}
          {masterProfiles.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs font-semibold bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              No saved team profiles found. Use the field above to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {masterProfiles.map((profile) => {
                const isEditing = editingProfileId === profile.id;
                return (
                  <div 
                    key={profile.id}
                    className={`rounded-2xl border p-4.5 transition-all space-y-3.5 ${
                      isEditing 
                        ? 'border-indigo-500 ring-2 ring-indigo-50 bg-indigo-50/10' 
                        : 'border-slate-200 bg-slate-5/20 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100/80 pb-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={renamingMasterName}
                            onChange={(e) => setRenamingMasterName(e.target.value)}
                            className="bg-white border border-slate-250 px-2 py-1 text-xs text-slate-800 rounded-lg font-bold flex-1"
                          />
                          <button
                            onClick={() => {
                              handleSaveMasterProfileRename(profile.id);
                              setEditingProfileId(null);
                            }}
                            className="p-1 px-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingProfileId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-xs text-slate-800 tracking-tight">{profile.name}</h4>
                          <span className="text-[9px] bg-slate-100 text-slate-500 font-bold rounded-full px-2 py-0.5">
                            {profile.players.length} players
                          </span>
                        </div>
                      )}

                      {!isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingProfileId(profile.id);
                              setRenamingMasterName(profile.name);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                            title="Edit Master Profile"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMasterProfile(profile.id, profile.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            title="Delete Master Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Load into current match controls */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <button
                        onClick={() => handleLoadMasterToActive(profile, 0)}
                        className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1 transition-all"
                      >
                        <FolderOpen className="w-3 h-3 text-indigo-300" />
                        Load Team A
                      </button>
                      <button
                        onClick={() => handleLoadMasterToActive(profile, 1)}
                        className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1 transition-all border border-indigo-150"
                      >
                        <FolderOpen className="w-3 h-3 text-indigo-600" />
                        Load Team B
                      </button>
                    </div>

                    {/* Editing expanded player management block */}
                    {isEditing && (
                      <div className="space-y-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs mt-2.5">
                        <p className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-wider">Configure Master Roster Order</p>
                        
                        {profile.players.length === 0 ? (
                          <p className="text-[10px] text-slate-400 font-medium italic py-2 text-center">No players registered under this profile.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {profile.players.map((plyr, pIdx) => (
                              <div key={plyr.id} className="flex items-center justify-between bg-slate-50/50 p-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-black text-slate-300 select-none w-3">
                                    {pIdx + 1}
                                  </span>
                                  <div>
                                    <p className="text-xs font-bold text-slate-800 leading-tight">{plyr.name}</p>
                                    <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">{plyr.role}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  {/* REARRANGE CONTROLS WITHIN MASTER SQUAD */}
                                  <button
                                    onClick={() => handleMoveMasterPlayer(profile.id, pIdx, 'up')}
                                    disabled={pIdx === 0}
                                    className="p-1 hover:bg-white border border-transparent hover:border-slate-100 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                                    title="Move Match Lineup Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveMasterPlayer(profile.id, pIdx, 'down')}
                                    disabled={pIdx === profile.players.length - 1}
                                    className="p-1 hover:bg-white border border-transparent hover:border-slate-100 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                                    title="Move Match Lineup Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleRemovePlayerFromMaster(profile.id, plyr.id)}
                                    className="p-1 text-slate-350 hover:text-rose-600 rounded-md hover:bg-rose-50/50 ml-1 cursor-pointer"
                                    title="Remove Player from Master"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Master roster quick insert form */}
                        <form
                          onSubmit={(e) => handleAddPlayerToMaster(e, profile.id)}
                          className="flex gap-1 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100"
                        >
                          <input
                            type="text"
                            placeholder="Add kid's name..."
                            value={newMasterPlayerName}
                            onChange={(e) => setNewMasterPlayerName(e.target.value)}
                            className="bg-white border border-slate-200 px-2 py-1 text-[11px] text-slate-700 rounded-md flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <select
                            value={newMasterPlayerRole}
                            onChange={(e) => setNewMasterPlayerRole(e.target.value as Player['role'])}
                            className="bg-white border border-slate-200 px-1.5 py-1 text-[11px] text-slate-600 font-bold rounded-md"
                          >
                            <option value="Batter">Batter</option>
                            <option value="Bowler">Bowler</option>
                            <option value="All-rounder">All-rounder</option>
                            <option value="Wicket-keeper">Keeper</option>
                          </select>
                          <button
                            type="submit"
                            disabled={!newMasterPlayerName.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-md text-[10px] uppercase font-black cursor-pointer disabled:opacity-30 shrink-0"
                          >
                            Add
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* MATCH CONFIG CARD */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5" id="match-settings-card">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span className="text-xl">⚙️</span>
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight">Core Match Settings</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Configured prior to commencing play</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overs Options */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
                Innings Overs Count
              </label>
              <div className="flex flex-wrap gap-2">
                {[2, 5, 10, 15, 20].map((overs) => (
                  <button
                    key={overs}
                    type="button"
                    onClick={() => setMatchOvers(overs)}
                    className={`py-2 px-3.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${
                      matchOvers === overs
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {overs} Overs
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Determines maximum overs bowled per innings ({matchOvers * 6} total valid balls).</p>
            </div>

            {/* Batsman Ball Limit Options */}
            <div className="space-y-3">
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
                Batsman Ball Limit
              </label>
              <div className="flex flex-wrap gap-2">
                {[2, 5, 10, 15, 20, 24].map((limit) => (
                  <button
                    key={limit}
                    type="button"
                    onClick={() => setMatchBatsmanBallLimit(limit)}
                    className={`py-2 px-3.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${
                      matchBatsmanBallLimit === limit
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {limit} Balls Limit
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-semibold italic">
                Batters retire upon reaching {matchBatsmanBallLimit} balls. Last eligible batter stands solo.
              </p>
            </div>
          </div>
        </div>

        {/* TEAM DECK FOR THE ACTIVE MATCH */}
        <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
          {/* Active squads list tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/50">
            <button
              onClick={() => setActiveTab(0)}
              className={`flex-1 py-4 text-center font-extrabold text-sm transition-all border-b-3 ${
                activeTab === 0
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
              id="tab-team-a"
            >
              1st Innings: {localTeams[0].name || 'Team A'}
            </button>
            <button
              onClick={() => setActiveTab(1)}
              className={`flex-1 py-4 text-center font-extrabold text-sm transition-all border-b-3 ${
                activeTab === 1
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
              id="tab-team-b"
            >
              2nd Innings: {localTeams[1].name || 'Team B'}
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Team Settings Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Custom Match Team Name
                </label>
                <input
                  type="text"
                  value={activeTeam.name}
                  onChange={(e) => handleUpdateTeamName(e.target.value)}
                  placeholder="Enter custom match team name..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-sm"
                  id="input-team-name"
                />
              </div>

              <div className="space-y-2 flex flex-col justify-end">
                <button
                  type="button"
                  onClick={handleSaveActiveToMaster}
                  className="w-full px-4 py-3 border border-indigo-200 bg-indigo-50/45 hover:bg-indigo-50 text-indigo-750 rounded-2xl text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-all shadow-2xs leading-none cursor-pointer"
                >
                  <Save className="w-4 h-4 text-indigo-600" />
                  Save active match lineup as a Master Profile
                </button>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Match Lineup / Batting Order section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span>Match Playing Order Lineup</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-black">
                      {activeTeam.players.length} Active
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">This list defines the batting order. Modify as needed for who is attending today.</p>
                </div>
              </div>

              {activeTeam.players.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                  Roster empty. Load a Master Profile above or register new cricket players below.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="player-grid">
                  {activeTeam.players.map((player, pIdx) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3 bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-all shadow-4xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-150 text-[10px] font-bold text-slate-600 flex items-center justify-center shrink-0">
                          {pIdx + 1}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-800 text-sm">{player.name}</p>
                          <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider mt-0.5 inline-block">
                            {player.role}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {/* REARRANGE CONTROLS WITHIN CURRENT ACTIVE MATCH LINEUP */}
                        <button
                          onClick={() => handleMoveActivePlayer(pIdx, 'up')}
                          disabled={pIdx === 0}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer"
                          title="Move Match Lineup Up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveActivePlayer(pIdx, 'down')}
                          disabled={pIdx === activeTeam.players.length - 1}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer"
                          title="Move Match Lineup Down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        
                        {/* DELETE Non-Attending Player */}
                        <button
                          onClick={() => handleRemovePlayer(player.id)}
                          className="p-1.5 text-slate-350 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all ml-1 cursor-pointer"
                          title="Remove player since not attending match"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add form */}
              <form onSubmit={handleAddPlayer} className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50/55 p-4 rounded-2xl border border-slate-250/50" id="add-player-form">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Register attending youngster..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-semibold"
                  />
                </div>
                <div className="sm:col-span-4">
                  <select
                    value={playerRole}
                    onChange={(e) => setPlayerRole(e.target.value as Player['role'])}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="Batter">Batter</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-rounder">All-rounder</option>
                    <option value="Wicket-keeper">Wicketkeeper</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={!playerName.trim()}
                    className="w-full h-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black tracking-widest uppercase rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    ADD
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Action trigger footer */}
          <div className="bg-slate-50 border-t border-slate-100 p-6 sm:p-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium max-w-md text-center sm:text-left leading-normal">
              Rule Note: Requires a minimum of 2 players per squad to initiate. Roster sizes can vary as per junior cricket rules to ensure game balancing.
            </span>
            <button
              onClick={onStartMatch}
              disabled={localTeams[0].players.length < 2 || localTeams[1].players.length < 2}
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-md shadow-indigo-150/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              id="btn-start-match"
            >
              <Plus className="w-4 h-4" />
              START MATCH RECORDING
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
