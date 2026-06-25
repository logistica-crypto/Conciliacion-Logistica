import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// Explicitly type saveToCloud parameters
export async function saveToCloud(collectionName: string, docId: string, data: any): Promise<boolean> {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, { 
      data, 
      updatedAt: new Date().toISOString() 
    });
    return true;
  } catch (error) {
    console.warn(`[Firebase] Error saving to ${collectionName}/${docId}:`, error);
    return false;
  }
}

// Explicitly type loadFromCloud parameters
export async function loadFromCloud(collectionName: string, docId: string): Promise<any | null> {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const docData = docSnap.data();
      return docData ? docData.data : null;
    }
  } catch (error) {
    console.warn(`[Firebase] Error loading from ${collectionName}/${docId}:`, error);
  }
  return null;
}

// Subscribe to live cloud changes
export function subscribeToCloud(collectionName: string, docId: string, callback: (data: any) => void): () => void {
  try {
    const docRef = doc(db, collectionName, docId);
    return onSnapshot(docRef, (docSnap) => {
      try {
        if (docSnap.exists()) {
          const docData = docSnap.data();
          if (docData && docData.data !== undefined) {
            callback(docData.data);
          }
        }
      } catch (innerErr) {
        console.warn(`[Firebase] Error parsing snapshot data for ${collectionName}/${docId}:`, innerErr);
      }
    }, (error) => {
      console.warn(`[Firebase] Subscription error for ${collectionName}/${docId}:`, error);
    });
  } catch (error) {
    console.error(`[Firebase] Failed to establish subscription for ${collectionName}/${docId}:`, error);
    // Return a dummy unsubscriber to avoid crashes
    return () => {};
  }
}
