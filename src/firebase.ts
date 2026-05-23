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

export async function saveMatch(matchId: string, matchState: any) {
  const path = `matches/${matchId}`;
  try {
    const docRef = doc(db, 'matches', matchId);
    const snap = await getDoc(docRef);
    const cleanState = JSON.parse(JSON.stringify(matchState)); // remove any functions or symbol keys
    
    if (!snap.exists()) {
      await setDoc(docRef, {
        ...cleanState,
        id: matchId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        ...cleanState,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMatch(matchId: string) {
  const path = `matches/${matchId}`;
  try {
    await deleteDoc(doc(db, 'matches', matchId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveOverSnapshot(matchId: string, overNumber: number, inningsIndex: number, currentMatchState: any) {
  const overId = `Innings${inningsIndex + 1}_Over${overNumber}`;
  const path = `matches/${matchId}/oversSnapshots/${overId}`;
  try {
    await setDoc(doc(db, 'matches', matchId, 'oversSnapshots', overId), {
      id: overId,
      matchId,
      overNumber,
      inningsIndex,
      createdAt: serverTimestamp(),
      matchState: JSON.parse(JSON.stringify(currentMatchState)),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cleanUpSubsequentSnapshots(matchId: string, restoredOverNumber: number, inningsIndex: number) {
  const path = `matches/${matchId}/oversSnapshots`;
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
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
