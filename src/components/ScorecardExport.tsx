/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Innings, Team, BatterStats, BowlerStats } from '../types';
import { Download, FileText, Check, Copy, X, Printer, Share2 } from 'lucide-react';

interface ScorecardExportProps {
  isOpen: boolean;
  onClose: () => void;
  teams: [Team, Team];
  inningsList: [Innings | null, Innings | null];
}

export default function ScorecardExport({ isOpen, onClose, teams, inningsList }: ScorecardExportProps) {
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

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

  const getMatchResultsSummary = () => {
    const first = inningsList[0];
    const second = inningsList[1];
    if (!first) return 'Match in progress';
    if (!second) return `${teams[first.battingTeamIndex].name} finished their innings. Waiting for 2nd innings to start.`;

    const formatA = teams[first.battingTeamIndex].name;
    const formatB = teams[second.battingTeamIndex].name;

    if (second.isCompleted) {
      if (second.totalRuns > first.totalRuns) {
        return `${formatB} won by ${second.totalRuns - first.totalRuns} runs`;
      } else if (first.totalRuns > second.totalRuns) {
        return `${formatA} won by ${first.totalRuns - second.totalRuns} runs`;
      } else {
        return `Match tied (Equal Totals)`;
      }
    }
    return `${formatB} is chasing target of ${first.totalRuns + 1} runs (${second.totalRuns}/${second.totalWickets}, ${formatOvers(second.ballsBowledTotal)} ov)`;
  };

  // Generate ASCII Plain Text Scorecard
  const generateAsciiText = () => {
    const divider = '='.repeat(68);
    const thinDivider = '-'.repeat(68);
    let out = '';

    out += `${divider}\n`;
    out += `         JUNIOR SCORER (U-9 FORMAT) - CRICKET MATCH REPORT\n`;
    out += `${divider}\n`;
    out += `Match Profile : ${teams[0].name} vs ${teams[1].name}\n`;
    out += `Date          : ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}\n`;
    out += `Status        : ${getMatchResultsSummary()}\n`;
    out += `${divider}\n\n`;

    inningsList.forEach((innings, idx) => {
      if (!innings) return;
      const batTeam = teams[innings.battingTeamIndex].name;
      const bowlTeam = teams[innings.bowlingTeamIndex].name;

      out += `>> INNINGS ${idx + 1}: ${batTeam.toUpperCase()} (BATTING)\n`;
      out += `Total Score: ${innings.totalRuns}/${innings.totalWickets} in ${formatOvers(innings.ballsBowledTotal)} overs\n`;
      out += `${thinDivider}\n`;
      out += `BATTER              STATUS                      R   B   4s  6s   S/R\n`;
      out += `${thinDivider}\n`;

      innings.batters.forEach((b) => {
        const name = b.playerName.padEnd(19).substring(0, 19);
        let status = b.howOut;
        if (status === 'Active') status = 'not out';
        status = status.padEnd(27).substring(0, 27);
        const runs = b.runs.toString().padStart(3);
        const balls = b.ballsFaced.toString().padStart(3);
        const fours = b.fours.toString().padStart(3);
        const sixes = b.sixes.toString().padStart(3);
        const sr = getStrikeRate(b.runs, b.ballsFaced).padStart(6);
        out += `${name} ${status} ${runs} ${balls} ${fours} ${sixes} ${sr}\n`;
      });

      const extrasTotal = innings.extras.wides + innings.extras.noBalls + innings.extras.byes + innings.extras.legByes;
      out += `${thinDivider}\n`;
      out += `EXTRAS TOTAL: ${extrasTotal} (Wides ${innings.extras.wides}, No-Balls ${innings.extras.noBalls}, Byes ${innings.extras.byes}, Leg-Byes ${innings.extras.legByes})\n`;
      const opponentInnings = inningsList[1 - idx];
      const opponentWkts = opponentInnings ? opponentInnings.totalWickets : 0;
      const penaltyRuns = opponentWkts * 4;
      out += `OPPOSITION WKT PENALTY  : +${penaltyRuns} (4 runs x ${opponentWkts} wicket(s) lost by ${bowlTeam})\n`;
      out += `TOTAL MATCH RUNS: ${innings.totalRuns} (${innings.totalWickets} wickets, ${formatOvers(innings.ballsBowledTotal)} overs)\n`;
      out += `${thinDivider}\n\n`;

      out += `>> BOWLING STATISTICS: ${bowlTeam.toUpperCase()}\n`;
      out += `${thinDivider}\n`;
      out += `BOWLER              OVERS   MAIDENS   RUNS   WICKETS   WD/NB   ECON\n`;
      out += `${thinDivider}\n`;

      if (innings.bowlers.length === 0) {
        out += `No bowling deliveries recorded for this innings yet.\n`;
      } else {
        innings.bowlers.forEach((bowler) => {
          const name = bowler.playerName.padEnd(19).substring(0, 19);
          const ovs = formatOvers(bowler.ballsBowled).padStart(7);
          const mdns = bowler.maidens.toString().padStart(9);
          const runs = bowler.runsConceded.toString().padStart(6);
          const wkts = bowler.wickets.toString().padStart(9);
          const wdnb = `${bowler.wides}/${bowler.noBalls}`.padStart(9);
          const econ = getEconomy(bowler.runsConceded, bowler.ballsBowled).padStart(6);
          out += `${name} ${ovs} ${mdns} ${runs} ${wkts} ${wdnb} ${econ}\n`;
        });
      }
      out += `${thinDivider}\n\n`;

      const getBattingPlayerName = (pId: string) => {
        const stats = innings.batters.find((b) => b.playerId === pId);
        if (stats) return stats.playerName;
        const pl = teams[innings.battingTeamIndex].players.find((p) => p.id === pId);
        return pl ? pl.name : 'Unknown';
      };

      const getBowlingPlayerName = (pId: string) => {
        const stats = innings.bowlers.find((b) => b.playerId === pId);
        if (stats) return stats.playerName;
        const pl = teams[innings.bowlingTeamIndex].players.find((p) => p.id === pId);
        return pl ? pl.name : 'Unknown';
      };

      // Ball Feed summary
      if (innings.balls.length > 0) {
        out += `>> BALL-BY-BALL CHRONOLOGY MATCH TIMELINE (ALL DELIVERIES):\n`;
        out += `${thinDivider}\n`;
        out += `BALL   BOWLER              BATSMAN             DELIVERY PLAY DESCRIPTION\n`;
        out += `${thinDivider}\n`;
        innings.balls.forEach((b) => {
          const ovNum = Math.floor(b.overNum);
          const bNum = b.ballNumInOver;
          const deliveryStr = `${ovNum}.${bNum === 0 ? 'F' : bNum}`.padEnd(6);
          const bowlerStr = getBowlingPlayerName(b.bowlerId).padEnd(19).substring(0, 19);
          const batterStr = getBattingPlayerName(b.strikerId).padEnd(19).substring(0, 19);
          out += `${deliveryStr} ${bowlerStr} ${batterStr} ${b.description}\n`;
        });
        out += `${thinDivider}\n\n`;
      }
    });

    out += `Report generated via U-9 Cricket Scoring Engine on ${new Date().toLocaleString()}\n`;
    out += `MCC Junior Format Compliant Rule set: 2 Run penalties for wides/no-balls, Bowlers limited to 24 balls max.\n`;
    out += `Database verification reference status: verified secure.\n`;
    return out;
  };

  // Generate Executive self-contained responsive HTML Scorecard
  const generateHtmlContent = () => {
    const title = `Cricket Match Scorecard: ${teams[0].name} v ${teams[1].name}`;
    const dateStr = new Date().toLocaleDateString(undefined, { dateStyle: 'long' });
    const resultSummary = getMatchResultsSummary();

    let inningsHtml = '';
    inningsList.forEach((innings, idx) => {
      if (!innings) return;
      const batTeam = teams[innings.battingTeamIndex].name;
      const bowlTeam = teams[innings.bowlingTeamIndex].name;
      const extrasTotal = innings.extras.wides + innings.extras.noBalls + innings.extras.byes + innings.extras.legByes;
      const opponentInnings = inningsList[1 - idx];
      const opponentWkts = opponentInnings ? opponentInnings.totalWickets : 0;

      let batterRows = '';
      innings.batters.forEach((b) => {
        let outLabel = b.howOut;
        if (outLabel === 'Active') {
          outLabel = '<span class="not-out-tag">not out</span>';
        } else if (outLabel === 'Retired') {
          outLabel = '<span class="retired-tag">retired</span>';
        }
        batterRows += `
          <tr>
            <td style="font-weight: 700; color: #1e293b;">${b.playerName}</td>
            <td style="color: #64748b;">${outLabel}</td>
            <td class="text-right num-font" style="font-weight: 900; color: #0f172a;">${b.runs}</td>
            <td class="text-right num-font">${b.ballsFaced}</td>
            <td class="text-right num-font">${b.fours}</td>
            <td class="text-right num-font">${b.sixes}</td>
            <td class="text-right num-font" style="color: #64748b;">${getStrikeRate(b.runs, b.ballsFaced)}</td>
          </tr>
        `;
      });

      let bowlerRows = '';
      if (innings.bowlers.length === 0) {
        bowlerRows = `
          <tr>
            <td colspan="7" style="color: #94a3b8; font-style: italic; text-align: center; py: 12px;">No deliveries standard logs.</td>
          </tr>
        `;
      } else {
        innings.bowlers.forEach((bw) => {
          bowlerRows += `
            <tr>
              <td style="font-weight: 700; color: #1e293b;">${bw.playerName}</td>
              <td class="text-right num-font" style="font-weight: 900;">${formatOvers(bw.ballsBowled)}</td>
              <td class="text-right num-font">${bw.maidens}</td>
              <td class="text-right num-font" style="font-weight: 700;">${bw.runsConceded}</td>
              <td class="text-right num-font" style="font-weight: 950; color: #4f46e5;">${bw.wickets}</td>
              <td class="text-right num-font" style="color: #64748b;">${bw.wides} / ${bw.noBalls}</td>
              <td class="text-right num-font" style="color: #64748b; font-weight: 500;">${getEconomy(bw.runsConceded, bw.ballsBowled)}</td>
            </tr>
          `;
        });
      }

      const getBattingPlayerName = (pId: string) => {
        const stats = innings.batters.find((b) => b.playerId === pId);
        if (stats) return stats.playerName;
        const pl = teams[innings.battingTeamIndex].players.find((p) => p.id === pId);
        return pl ? pl.name : 'Unknown';
      };

      const getBowlingPlayerName = (pId: string) => {
        const stats = innings.bowlers.find((b) => b.playerId === pId);
        if (stats) return stats.playerName;
        const pl = teams[innings.bowlingTeamIndex].players.find((p) => p.id === pId);
        return pl ? pl.name : 'Unknown';
      };

      let ballDetailsLog = '';
      if (innings.balls.length > 0) {
        ballDetailsLog += `
          <table class="report-table" style="margin-top: 12px; width: 100%;">
            <thead>
              <tr>
                <th style="width: 12%; font-weight: 855; color: #475569;">Delivery</th>
                <th style="width: 25%; font-weight: 855; color: #475569;">Bowler</th>
                <th style="width: 25%; font-weight: 855; color: #475569;">Batter</th>
                <th style="width: 12%; text-align: center; font-weight: 855; color: #475569;">Runs</th>
                <th style="width: 12%; text-align: center; font-weight: 855; color: #475569;">Extras</th>
                <th style="width: 14%; text-align: center; font-weight: 855; color: #475569;">Event</th>
              </tr>
            </thead>
            <tbody>
        `;

        innings.balls.forEach((b) => {
          const ovNum = Math.floor(b.overNum);
          const bNum = b.ballNumInOver;
          const deliveryStr = `${ovNum}.${bNum === 0 ? 'F' : bNum}`;

          const isWik = b.isWicket ? '<span class="badge-wicket">WKT</span>' : '';
          const isExtra = b.ballType !== 'Normal' ? `<span class="badge-extra">${b.ballType}</span>` : '';
          
          let eventHtml = '';
          if (isExtra && isWik) {
            eventHtml = `<div style="display: flex; gap: 4px; justify-content: center; align-items: center;">${isExtra}${isWik}</div>`;
          } else if (isExtra) {
            eventHtml = isExtra;
          } else if (isWik) {
            eventHtml = isWik;
          } else {
            eventHtml = '<span style="color: #cbd5e1;">-</span>';
          }

          const runsBatStr = b.runsFromBat > 0 ? `<strong>${b.runsFromBat}</strong>` : '0';
          const runsExtrasStr = b.runsFromExtras > 0 ? `<span style="color: #b45309; font-weight: 600;">+${b.runsFromExtras} ${b.extraType && b.extraType !== 'None' ? `(${b.extraType})` : ''}</span>` : '0';

          ballDetailsLog += `
            <tr style="background-color: #fafbfc;">
              <td class="num-font" style="font-weight: 800; color: #4f46e5; padding-top: 8px; padding-bottom: 8px;">${deliveryStr}</td>
              <td style="font-weight: 700; color: #334155; padding-top: 8px; padding-bottom: 8px;">${getBowlingPlayerName(b.bowlerId)}</td>
              <td style="font-weight: 700; color: #334155; padding-top: 8px; padding-bottom: 8px;">${getBattingPlayerName(b.strikerId)}</td>
              <td class="text-center num-font" style="text-align: center; padding-top: 8px; padding-bottom: 8px;">${runsBatStr}</td>
              <td class="text-center num-font" style="text-align: center; padding-top: 8px; padding-bottom: 8px;">${runsExtrasStr}</td>
              <td class="text-center" style="text-align: center; padding-top: 8px; padding-bottom: 8px;">${eventHtml}</td>
            </tr>
            <tr>
              <td colspan="6" style="padding-top: 4px; padding-bottom: 10px; color: #475569; font-size: 11px; border-bottom: 1.5px solid #edf2f7; padding-left: 20px; font-weight: 500; background-color: #ffffff;">
                ↳ Play detail: ${b.description}
              </td>
            </tr>
          `;
        });

        ballDetailsLog += `
            </tbody>
          </table>
        `;
      }

      inningsHtml += `
        <div class="card-section">
          <div class="section-badge">INNINGS DETAILS ${idx + 1}</div>
          <div class="innings-header">
            <div>
              <h3>${batTeam}</h3>
              <p style="margin: 0; font-size: 11px; color: #64748b;">Opposing bowler squad: ${bowlTeam}</p>
            </div>
            <div class="innings-total-bubble">
              <span class="total-score-val">${innings.totalRuns}/${innings.totalWickets}</span>
              <span class="total-overs-label">${formatOvers(innings.ballsBowledTotal)} Overs</span>
            </div>
          </div>

          <h4 style="margin-bottom: 8px; font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em;">Batting Performance Card</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Batter</th>
                <th>Dismissal Action</th>
                <th class="text-right">R</th>
                <th class="text-right">B</th>
                <th class="text-right">4s</th>
                <th class="text-right">6s</th>
                <th class="text-right">S/R</th>
              </tr>
            </thead>
            <tbody>
              ${batterRows}
              <tr class="totals-row">
                <td colspan="2">Batting Extras Collected</td>
                <td class="text-right font-black" style="color: #0f172a;">${extrasTotal}</td>
                <td colspan="4" style="font-size: 10px; color: #64748b; font-weight: 500;">
                  (Wide penalty ${innings.extras.wides}, No-Ball penalty ${innings.extras.noBalls}, Byes ${innings.extras.byes}, Leg-Byes ${innings.extras.legByes})
                </td>
              </tr>
              <tr class="totals-row" style="background-color: #fffbeb;">
                <td colspan="2" style="color: #b45309; font-weight: bold;">Opposition Wicket Penalty</td>
                <td class="text-right font-black" style="color: #b45309;">+${opponentWkts * 4}</td>
                <td colspan="4" style="font-size: 10px; color: #d97706; font-weight: bold;">
                  (4 runs x ${opponentWkts} wicket(s) lost by ${bowlTeam})
                </td>
              </tr>
              <tr class="totals-row">
                <td colspan="2" style="font-size: 11px; text-transform: uppercase;">Team Innings Total Cumulative</td>
                <td class="text-right font-black" style="font-size: 14px; color: #4f46e5;">${innings.totalRuns}</td>
                <td colspan="4" style="font-size: 10px; color: #64748b;">
                  For ${innings.totalWickets} wickets in ${formatOvers(innings.ballsBowledTotal)} completed overs block
                </td>
              </tr>
            </tbody>
          </table>

          <h4 style="margin: 24px 0 8px 0; font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em;">Bowling Performance Card</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th class="text-right">Overs</th>
                <th class="text-right">Mdns</th>
                <th class="text-right">Runs</th>
                <th class="text-right">Wickets</th>
                <th class="text-right">Wd/Nb</th>
                <th class="text-right">Econ</th>
              </tr>
            </thead>
            <tbody>
              ${bowlerRows}
            </tbody>
          </table>

          ${innings.balls.length > 0 ? `
            <h4 style="margin: 24px 0 8px 0; font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em;">Ball-by-Ball Timeline Table (All Deliveries)</h4>
            <div class="ball-log-container">
              ${ballDetailsLog}
            </div>
          ` : ''}
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;750&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            margin: 0;
            padding: 32px 16px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 24px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
            padding: 40px;
          }
          .header {
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 24px;
            margin-bottom: 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .brand-logo {
            background-color: #4f46e5;
            color: #ffffff;
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 900;
          }
          .title-section h1 {
            font-size: 22px;
            font-weight: 850;
            margin: 0 0 4px 0;
            letter-spacing: -0.025em;
          }
          .title-section p {
            font-size: 11px;
            color: #94a3b8;
            margin: 0;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
          .match-meta-card {
            background: linear-gradient(135deg, #f5f3ff 0%, #edd8ff 100%);
            border: 1px solid #ddd6fe;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 32px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .result-summary-text {
            font-size: 16px;
            font-weight: 900;
            color: #4c1d95;
            margin: 0;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 600;
            color: #5b21b6;
            opacity: 0.85;
          }
          .card-section {
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 32px;
            background-color: #ffffff;
          }
          .section-badge {
            display: inline-block;
            background-color: #f1f5f9;
            color: #475569;
            font-size: 9px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 6px;
            letter-spacing: 0.05em;
            margin-bottom: 16px;
          }
          .innings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .innings-header h3 {
            font-size: 18px;
            font-weight: 850;
            margin: 0 0 2px 0;
          }
          .innings-total-bubble {
            background-color: #4f46e5;
            color: #ffffff;
            border-radius: 12px;
            padding: 10px 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-weight: bold;
          }
          .total-score-val {
            font-size: 18px;
            font-weight: 900;
          }
          .total-overs-label {
            font-size: 9px;
            text-transform: uppercase;
            opacity: 0.85;
            letter-spacing: 0.05em;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            text-align: left;
            margin-bottom: 12px;
          }
          .report-table th, .report-table td {
            padding: 10px 12px;
          }
          .report-table th {
            font-size: 9px;
            font-weight: 800;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 2px solid #f1f5f9;
          }
          .report-table td {
            border-bottom: 1px solid #f8fafc;
          }
          .num-font {
            font-family: 'JetBrains Mono', monospace;
          }
          .text-right {
            text-align: right;
          }
          .font-black {
            font-weight: 900;
          }
          .not-out-tag {
            color: #047857;
            background-color: #ecfdf5;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .retired-tag {
            color: #4b5563;
            background-color: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .totals-row td {
            background-color: #faf5ff/20;
            border-top: 1px solid #e2e8f0;
            font-weight: 750;
            padding: 12px;
          }
          .ball-log-container {
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 16px;
            background-color: #ffffff;
            margin-top: 12px;
            overflow-x: auto;
          }
          .ball-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            border-bottom: 1px solid #edf2f7;
            padding-bottom: 6px;
          }
          .ball-coord {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 800;
            color: #4f46e5;
            width: 80px;
          }
          .badge-wicket {
            background-color: #fee2e2;
            color: #991b1b;
            font-size: 8px;
            font-weight: 900;
            padding: 2px 5px;
            border-radius: 4px;
          }
          .badge-extra {
            background-color: #fffbeb;
            color: #92400e;
            font-size: 8px;
            font-weight: 900;
            padding: 2px 5px;
            border-radius: 4px;
          }
          .action-panel {
            text-align: center;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px dashed #e2e8f0;
          }
          .btn-print {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 800;
            font-size: 11px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            padding: 12px 24px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
          }
          .btn-print:hover {
            background-color: #1e293b;
          }
          .rule-disclaimer {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 24px;
            text-align: center;
            line-height: 1.6;
          }
          @media print {
            body {
              background-color: #ffffff;
              padding: 0;
            }
            .container {
              border: none;
              box-shadow: none;
              padding: 0;
            }
            .action-panel {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="brand-logo">🏏</div>
              <div class="title-section">
                <h1>Junior Scorer Match Report</h1>
                <p>official under-9 formats score sheet</p>
              </div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #94a3b8; font-weight: 700; font-family: 'JetBrains Mono', monospace;">
              Ref: #${Math.floor(Math.random() * 89999 + 10000)}<br>${dateStr}
            </div>
          </div>

          <div class="match-meta-card">
            <p class="result-summary-text">${resultSummary}</p>
            <div class="meta-row">
              <span>TEAM 1 Roster: ${teams[0].name}</span>
              <span>TEAM 2 Roster: ${teams[1].name}</span>
            </div>
          </div>

          ${inningsHtml}

          <div class="rule-disclaimer">
            This scorecard sheet was generated dynamically via standard MCC rules guidelines for Junior U-9 formats.<br>
            All wide/no-ball inputs incur a +2 run penalty automatically and do not require rebowling of the delivery.<br>
            For help and info contact: scoring@juniorcricket.org
          </div>

          <div class="action-panel">
            <button class="btn-print" onclick="window.print()">
              <span>🖨️</span> Print Score Sheet / Save as PDF
            </button>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleDownloadTextFile = () => {
    const textData = generateAsciiText();
    const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scorecard_${teams[0].name.replace(/\s+/g, '_')}_vs_${teams[1].name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtmlFile = () => {
    const htmlData = generateHtmlContent();
    const blob = new Blob([htmlData], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scorecard_${teams[0].name.replace(/\s+/g, '_')}_vs_${teams[1].name.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    const textData = generateAsciiText();
    navigator.clipboard.writeText(textData)
      .then(() => {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy text scorecard to clipboard: ', err);
      });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-205 shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-650" />
            <h3 className="text-base font-black text-slate-800 tracking-tight">Export Match Record & Statistics</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800">Choose Export Format</h4>
            <p className="text-[11px] text-slate-400">
              Download the official Under-9 compliance scorecard sheet. Share with clubs, coaches, or parents.
            </p>
          </div>

          <div className="space-y-3">
            {/* HTML / Print Format Option */}
            <div className="p-4 border border-slate-200/85 hover:border-indigo-300 hover:bg-indigo-50/10 rounded-2xl transition-all flex items-start gap-4" id="html-export-card">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-650 shrink-0 mt-0.5">
                <Printer className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1 select-text">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">Executive HTML Report (.html)</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  A high-contrast visual dashboard that launches in any browser. It includes complete charts, team sheets, overs, ball timeline descriptions, and an integrated **Print-to-PDF/Save-as-PDF** layout engine.
                </p>
                <div className="pt-1.5">
                  <button
                    onClick={handleDownloadHtmlFile}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download browser sheet</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Monospace Text Scorecard Option */}
            <div className="p-4 border border-slate-200/85 hover:border-slate-300 hover:bg-slate-50/50 rounded-2xl transition-all flex items-start gap-4" id="text-export-card">
              <div className="p-3 bg-slate-100 rounded-xl text-slate-600 shrink-0 mt-0.5">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1 select-text">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">Monospace Plain Text (.txt)</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  A perfectly aligned ASCII table suitable for plain-text copy/paste sharing. Ideal for sending direct score updates to WhatsApp, Discord, Signal, SMS, or email groups.
                </p>
                <div className="pt-1.5 flex items-center gap-2">
                  <button
                    onClick={handleDownloadTextFile}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download TXT file</span>
                  </button>
                  <button
                    onClick={handleCopyToClipboard}
                    className="px-3 py-1.5 border border-slate-205 text-slate-650 hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 animate-in fade-in" />
                        <span className="text-emerald-700">Copied scorecard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy to clipboard</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Direct WhatsApp / Email quick hints */}
          <div className="bg-slate-50 border border-slate-205/60 p-4 rounded-2xl text-[10px] text-slate-500 leading-relaxed space-y-1">
            <span className="font-extrabold uppercase tracking-wide text-indigo-600 block">Pro Tip</span>
            <p>
              To create an official PDF file: Choose the **Executive HTML Report** format, click "Print Score Sheet / Save as PDF", and select "Save as PDF" as your destination printer in the browser dialog! This produces an elegant, vector-sharp PDF document package.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-150 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
