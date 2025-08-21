// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAkOKiV5U4qkGMd5pdT1hAwaLd8sDN9AMU",
  authDomain: "olimpiadasuei-2025.firebaseapp.com",
  projectId: "olimpiadasuei-2025",
  storageBucket: "olimpiadasuei-2025.firebasestorage.app",
  messagingSenderId: "676158035440",
  appId: "1:676158035440:web:aa679ea5d275b3c0c17935"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
