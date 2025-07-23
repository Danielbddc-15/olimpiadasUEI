// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAyUhVYbk5og3e1qsOiliFoB92NnWsSmCc",
  authDomain: "olimpiadasuei.firebaseapp.com",
  projectId: "olimpiadasuei",
  storageBucket: "olimpiadasuei.firebasestorage.app",
  messagingSenderId: "462565915640",
  appId: "1:462565915640:web:2db95b641fca338876f40d",
  measurementId: "G-0FFT6H7NPR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
