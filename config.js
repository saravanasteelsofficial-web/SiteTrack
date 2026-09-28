// Optional cloud sync configuration. Add your Firebase web app config here when ready.
export const FIREBASE_CONFIG = { apiKey:'', authDomain:'', projectId:'', storageBucket:'', messagingSenderId:'', appId:'' };
export const CLOUD_ENABLED = Object.values(FIREBASE_CONFIG).every(Boolean);
