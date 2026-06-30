// src/firebase.ts — Customer App
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDMP1DX8egQ3izkBDdwpXB7mV531h00S2M',
  authDomain: 'cham-soc-khach-hang-2b98f.firebaseapp.com',
  projectId: 'cham-soc-khach-hang-2b98f',
  storageBucket: 'cham-soc-khach-hang-2b98f.firebasestorage.app',
  messagingSenderId: '604510922472',
  appId: '1:604510922472:web:8f26d55c25b81ba62e4b5d'
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
