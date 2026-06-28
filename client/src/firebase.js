import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock-firebase-key",
  authDomain: "vibeshiphack.firebaseapp.com",
  projectId: "vibeshiphack",
  storageBucket: "vibeshiphack.appspot.com"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
