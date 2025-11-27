// js/firebase-config.js
// VERSÃO 2.0 (Atualizado para SDK v10.7.1 e Autenticação Google)

// Importa as funções do SDK v10.7.1 (Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider,     // NOVO: Para login com Google
    signInWithPopup,      // NOVO: Para login com Google
    signOut,              // NOVO: Para o botão Logout
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    push, 
    remove, 
    onValue, 
    child, 
    off,
    query,
    orderByChild,
    limitToLast,
    update 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { 
    getStorage, 
    ref as storageRef,  // Renomeado para não conflitar com o 'ref' do Database
    uploadBytes, 
    getDownloadURL, 
    deleteObject 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Sua configuração do Firebase (MANTIDA)
const firebaseConfig = {
    apiKey: "AIzaSyBXCMMXEM-e_BNftJNcm6XeEGZ7KYPUiAY",
    authDomain: "controle-financeiro-b7880.firebaseapp.com",
    databaseURL: "https://controle-financeiro-b7880-default-rtdb.firebaseio.com",
    projectId: "controle-financeiro-b7880",
    storageBucket: "controle-financeiro-b7880.firebasestorage.app",
    messagingSenderId: "149823899793",
    appId: "1:149823899793:web:0fcdcd8ece6748697e9730",
    measurementId: "G-SVDY4LSXDK"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Obtém as instâncias dos serviços
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// Exporta as funções e instâncias para serem usadas em outros scripts
export { 
    // Auth
    auth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    
    // Database
    db, 
    ref, 
    set, 
    get, 
    push, 
    remove, 
    onValue, 
    child,
    off,
    query,
    orderByChild,
    limitToLast,
    update, 
    
    // Storage
    storage, 
    storageRef, 
    uploadBytes, 
    getDownloadURL,
    deleteObject
};