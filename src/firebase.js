// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB5ALnli9RnRADuBY_DlxBZ0k85yeK6nGE",
  authDomain: "teamfit-2d658.firebaseapp.com",
  projectId: "teamfit-2d658",
  storageBucket: "teamfit-2d658.firebasestorage.app",
  messagingSenderId: "1009280011416",
  appId: "1:1009280011416:web:d0fa379199dc8c263214ed",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);