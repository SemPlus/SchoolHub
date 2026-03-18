import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const config = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
};

const app = initializeApp(config);

// Use initializeFirestore with experimentalForceLongPolling to improve connectivity
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';

// Connection test
async function testConnection() {
  try {
    // Attempt to fetch a non-existent doc from server to test connectivity
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log('Firestore connection successful');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore connection failed: The client is offline. Check your network or ad-blocker.');
    } else {
      // Other errors (like permission denied on this specific path) are fine, 
      // they still mean we reached the server.
      console.log('Firestore reached (test completed)');
    }
  }
}

testConnection();

export const auth = getAuth(app);
export const storage = getStorage(app);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error signing in with Google', error);
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
  }
};
