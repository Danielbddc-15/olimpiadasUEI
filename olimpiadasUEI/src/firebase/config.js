// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDa6hEAkkYZJfRk1YsJbi6nK4rj5DkUZvo",
  authDomain: "olimpiadasuei-683a1.firebaseapp.com",
  projectId: "olimpiadasuei-683a1",
  storageBucket: "olimpiadasuei-683a1.firebasestorage.app",
  messagingSenderId: "394543410338",
  appId: "1:394543410338:web:b06626c4a1cbd91fb53bfb",
  measurementId: "G-G9Y30ECW16"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
