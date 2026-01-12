
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBai4L2SOrvdAUo7d3tj1pt-kIaNpdklmo",
  authDomain: "cherry-buy-buy.firebaseapp.com",
  projectId: "cherry-buy-buy",
  storageBucket: "cherry-buy-buy.firebasestorage.app",
  messagingSenderId: "277472445020",
  appId: "1:277472445020:web:d4e06fd512004fa5b21c99"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
