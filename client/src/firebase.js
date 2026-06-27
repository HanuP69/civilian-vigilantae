import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyAxiwmOUo2kqFqDAloLHCn4hnPLMZZhBps",
  authDomain: "vibeshiphack.firebaseapp.com",
  projectId: "vibeshiphack",
  storageBucket: "vibeshiphack.appspot.com"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
