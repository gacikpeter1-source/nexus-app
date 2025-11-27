import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDYktjeayxZ6Th9WArEXKkr7t1vEeEnHJc",
  authDomain: "nexus-app-c69da.firebaseapp.com",
  projectId: "nexus-app-c69da",
  storageBucket: "nexus-app-c69da.firebasestorage.app",
  messagingSenderId: "975531023010",
  appId: "1:975531023010:web:8b41c68772331ddf17d5fb"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
