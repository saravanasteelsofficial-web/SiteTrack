// Optional cloud sync configuration. Add your Firebase web app config here when ready.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB_HwB0-WaG-BI6arP0B91uSO-HIcvl_04',
  authDomain: 'sitetrack-24731.firebaseapp.com',
  projectId: 'sitetrack-24731',
  storageBucket: 'sitetrack-24731.firebasestorage.app',
  messagingSenderId: '498082737765',
  appId: '1:498082737765:web:5c9c4b4d1f1f4b3027e08c'
};

export const CLOUD_ENABLED = Object.values(FIREBASE_CONFIG).every(Boolean);
