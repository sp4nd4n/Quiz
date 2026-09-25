// Paste the config object from your Firebase project here.
// Firebase console → Project settings → General → Your apps → SDK setup and configuration
// This same file is used by index.html (owner app) and quiz.html (public quiz page),
// so both talk to the same database.

const firebaseConfig = {
  apiKey: "AIzaSyC_WZi3YbDnVMbY9u1GtsMIPZd_E6I0uCA",
  authDomain: "quiz-app-42455.firebaseapp.com",
  projectId: "quiz-app-42455",
  storageBucket: "quiz-app-42455.firebasestorage.app",
  messagingSenderId: "777843344342",
  appId: "1:777843344342:web:1b1063d6f52390af9ada77"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
