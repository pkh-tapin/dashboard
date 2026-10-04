import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDk3nllKLXwLJl45coPm_SmWPmLwdWZSts",
  authDomain: "app-form-41d5b.firebaseapp.com",
  databaseURL: "https://app-form-41d5b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "app-form-41d5b",
  storageBucket: "app-form-41d5b.firebasestorage.app",
  messagingSenderId: "604153407167",
  appId: "1:604153407167:web:f25c79dc5fdf7d3ebbc80a"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);