
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBai4L2SOrvdAUo7d3tj1pt-kIaNpdklmo",
  authDomain: "cherry-buy-buy.firebaseapp.com",
  projectId: "cherry-buy-buy",
  storageBucket: "cherry-buy-buy.firebasestorage.app",
  messagingSenderId: "277472445020",
  appId: "1:277472445020:web:d4e06fd512004fa5b21c99"
};

// Initialize Firebase using the Compat API
const app = firebase.initializeApp(firebaseConfig);

// Export Firestore instance
export const db = app.firestore();
export default firebase;
