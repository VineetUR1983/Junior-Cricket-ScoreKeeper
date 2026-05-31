/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("Firebase client is currently offline:", error.message);
    }
  }
}
testConnection();

// Custom error info contract as requested by instructions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || 'anonymous',
      email: auth.currentUser?.email || 'unauthenticated',
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

import { 
  collection, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  serverTimestamp 
} from 'firebase/firestore';

// Keep track of match existences in this session to avoid redundant getDoc checks when saving ball-by-ball.
const knownMatchIds = new Set<string>();

// Helper safe local storage accessor
function getLocalStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

// 1. Local Match History Database persistence
export function getLocalMatches(): any[] {
  const ls = getLocalStorage();
  if (!ls) return [];
  try {
    const data = ls.getItem('u9_junior_matches_local');
    if (data) {
      const parsed = JSON.parse(data);
      return Object.values(parsed).sort((a: any, b: any) => {
        const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
    }
  } catch (e) {
    console.error("Local DB History parse failure:", e);
  }
  return [];
}

export function saveMatchLocally(matchId: string, matchState: any) {
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    const data = ls.getItem('u9_junior_matches_local');
    const matchesObj = data ? JSON.parse(data) : {};
    
    // Check if we already have a created time, otherwise default to now
    const existing = matchesObj[matchId] || {};
    const nowSec = Math.floor(Date.now() / 1000);
    const cleanState = JSON.parse(JSON.stringify(matchState));

    matchesObj[matchId] = {
      ...cleanState,
      id: matchId,
      createdAt: existing.createdAt || { seconds: nowSec, nanoseconds: 0 },
      updatedAt: { seconds: nowSec, nanoseconds: 0 }
    };
    
    ls.setItem('u9_junior_matches_local', JSON.stringify(matchesObj));
  } catch (e) {
    console.error("Local DB History write failure:", e);
  }
}

export function deleteMatchLocally(matchId: string) {
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    const data = ls.getItem('u9_junior_matches_local');
    if (data) {
      const matchesObj = JSON.parse(data);
      delete matchesObj[matchId];
      ls.setItem('u9_junior_matches_local', JSON.stringify(matchesObj));
    }
  } catch (e) {
    console.error("Local DB History delete failure:", e);
  }
}

// 2. Local Over Snapshots Database persistence
export function getLocalOverSnapshots(matchId: string): any[] {
  const ls = getLocalStorage();
  if (!ls) return [];
  try {
    const data = ls.getItem('u9_junior_overs_snapshots_local');
    if (data) {
      const snapObj = JSON.parse(data);
      return Object.values(snapObj)
        .filter((item: any) => item.matchId === matchId)
        .sort((a: any, b: any) => a.overNumber - b.overNumber);
    }
  } catch (e) {
    console.error("Local DB Over Snapshots query failure:", e);
  }
  return [];
}

export function saveOverSnapshotLocally(matchId: string, overNumber: number, inningsIndex: number, currentMatchState: any) {
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    const overId = `Innings${inningsIndex + 1}_Over${overNumber}`;
    const data = ls.getItem('u9_junior_overs_snapshots_local');
    const snapObj = data ? JSON.parse(data) : {};
    
    snapObj[`${matchId}_${overId}`] = {
      id: overId,
      matchId,
      overNumber,
      inningsIndex,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      matchState: JSON.parse(JSON.stringify(currentMatchState))
    };
    
    ls.setItem('u9_junior_overs_snapshots_local', JSON.stringify(snapObj));
  } catch (e) {
    console.error("Local DB Over Snapshots save failure:", e);
  }
}

export function cleanUpSubsequentSnapshotsLocally(matchId: string, restoredOverNumber: number, inningsIndex: number) {
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    const data = ls.getItem('u9_junior_overs_snapshots_local');
    if (data) {
      const snapObj = JSON.parse(data);
      let changed = false;
      Object.keys(snapObj).forEach((key) => {
        const item = snapObj[key];
        if (item.matchId === matchId && item.inningsIndex === inningsIndex && item.overNumber > restoredOverNumber) {
          delete snapObj[key];
          changed = true;
        }
      });
      if (changed) {
        ls.setItem('u9_junior_overs_snapshots_local', JSON.stringify(snapObj));
      }
    }
  } catch (e) {
    console.error("Local DB Over Snapshots clean failure:", e);
  }
}

export function deleteOverSnapshotsLocallyForMatch(matchId: string) {
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    const data = ls.getItem('u9_junior_overs_snapshots_local');
    if (data) {
      const snapObj = JSON.parse(data);
      let changed = false;
      Object.keys(snapObj).forEach((key) => {
        const item = snapObj[key];
        if (item.matchId === matchId) {
          delete snapObj[key];
          changed = true;
        }
      });
      if (changed) {
        ls.setItem('u9_junior_overs_snapshots_local', JSON.stringify(snapObj));
      }
    }
  } catch (e) {
    console.error("Local DB Over Snapshots removal failure:", e);
  }
}

// 3. Main synchronized Firestore APIs that replicate state locally and coordinate background updates
export async function saveMatch(matchId: string, matchState: any) {
  const path = `matches/${matchId}`;
  
  // 1. Clean and persist to the local storage database immediately
  const cleanState = JSON.parse(JSON.stringify(matchState)); 
  saveMatchLocally(matchId, cleanState);

  // 2. Perform background firestore operation
  try {
    const docRef = doc(db, 'matches', matchId);
    
    // Check local lookup memory cache first
    let exists = knownMatchIds.has(matchId);
    if (!exists) {
      const snap = await getDoc(docRef);
      exists = snap.exists();
      if (exists) {
        knownMatchIds.add(matchId);
      }
    }

    if (!exists) {
      await setDoc(docRef, {
        ...cleanState,
        id: matchId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      knownMatchIds.add(matchId);
    } else {
      await setDoc(docRef, {
        ...cleanState,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  } catch (error) {
    // Graceful logging, don't crash app if internet fluctuates because local database is already updated
    console.warn("Firestore save status (Offline/Syncing in background):", error);
  }
}

export async function deleteMatch(matchId: string) {
  const path = `matches/${matchId}`;
  
  // 1. Delete from local storage immediately so it is gone for the user right away
  deleteMatchLocally(matchId);
  deleteOverSnapshotsLocallyForMatch(matchId);
  knownMatchIds.delete(matchId);

  // 2. Background firestore deletion
  try {
    await deleteDoc(doc(db, 'matches', matchId));
  } catch (error) {
    console.warn("Firestore delete match status (Offline/Pending sync):", error);
  }
}

export async function saveOverSnapshot(matchId: string, overNumber: number, inningsIndex: number, currentMatchState: any) {
  const overId = `Innings${inningsIndex + 1}_Over${overNumber}`;
  const path = `matches/${matchId}/oversSnapshots/${overId}`;
  
  // 1. Save locally instantly
  const cleanState = JSON.parse(JSON.stringify(currentMatchState));
  saveOverSnapshotLocally(matchId, overNumber, inningsIndex, cleanState);

  // 2. Background Firestore setDoc
  try {
    await setDoc(doc(db, 'matches', matchId, 'oversSnapshots', overId), {
      id: overId,
      matchId,
      overNumber,
      inningsIndex,
      createdAt: serverTimestamp(),
      matchState: cleanState,
    });
  } catch (error) {
    console.warn("Firestore save over snapshot status (Offline/Pending sync):", error);
  }
}

export async function cleanUpSubsequentSnapshots(matchId: string, restoredOverNumber: number, inningsIndex: number) {
  const path = `matches/${matchId}/oversSnapshots`;
  
  // 1. Clean locally instantly
  cleanUpSubsequentSnapshotsLocally(matchId, restoredOverNumber, inningsIndex);

  // 2. Background Firestore clean up
  try {
    const q = query(
      collection(db, 'matches', matchId, 'oversSnapshots'),
      where('inningsIndex', '==', inningsIndex)
    );
    const snapshot = await getDocs(q);
    const deletePromises: Promise<void>[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.overNumber > restoredOverNumber) {
        deletePromises.push(deleteDoc(docSnap.ref));
      }
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.warn("Firestore snapshot clean up status (Offline/Pending sync):", error);
  }
}
