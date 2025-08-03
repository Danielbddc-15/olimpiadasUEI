// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBQAlHWKMjbtLfM9QtEoQnPTKQt9AO30zc",
  authDomain: "olimpiadasuei-27d6d.firebaseapp.com",
  projectId: "olimpiadasuei-27d6d",
  storageBucket: "olimpiadasuei-27d6d.firebasestorage.app",
  messagingSenderId: "745765222766",
  appId: "1:745765222766:web:6306cc5234a1fc1f8e297f",
  measurementId: "G-60P2D21E8N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
