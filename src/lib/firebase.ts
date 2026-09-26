import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCBPxpusvfBDF_UihHTAC3vljKm2kvHmkk",
  authDomain: "grouptrip-5277b.firebaseapp.com",
  projectId: "grouptrip-5277b",
  storageBucket: "grouptrip-5277b.firebasestorage.app",
  messagingSenderId: "96894857581",
  appId: "1:96894857581:web:ced36418f5b91fb268aa64",
  measurementId: "G-19KE1J732Q"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
