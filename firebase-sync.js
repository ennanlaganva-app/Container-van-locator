import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, onSnapshot, writeBatch } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAGqOXSz6oAUV6cGFyk2YqwQirzaj9vF2E',
  authDomain: 'psacc-van-locator-sync.firebaseapp.com',
  projectId: 'psacc-van-locator-sync',
  storageBucket: 'psacc-van-locator-sync.firebasestorage.app',
  messagingSenderId: '534149404389',
  appId: '1:534149404389:web:8b90bdbe03a4cb8d94260c'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const recordsRef = collection(db, 'sharedYardRecords');
const historyRef = collection(db, 'sharedYardHistory');
let currentUser = null;
let stopRecords = null;
let stopHistory = null;
let remoteRecords = new Map();
let remoteHistory = new Map();
let recordCache = new Map();
let historyCache = new Map();
let collectionReady = false;
let reconcileQueue = Promise.resolve();
let lastApplied = '';

const bridge = () => window.yardLocatorBridge;
const status = (value, extra = {}) => window.dispatchEvent(new CustomEvent('yardfirebase-status', { detail: { status: value, user: currentUser, ...extra } }));
const stamp = value => { const time = Date.parse(value || ''); return Number.isFinite(time) ? time : 0; };
const stable = value => JSON.stringify(value);

async function recordKey(id) {
  const bytes = new TextEncoder().encode(String(id));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function readRecords(snapshot) {
  const result = new Map();
  snapshot.forEach(item => {
    const value = item.data();
    if (value?.id) result.set(String(value.id), { id: String(value.id), record: value.deleted ? null : value.record, deleted: !!value.deleted, updatedAt: String(value.updatedAt || '') });
  });
  return result;
}

function readHistory(snapshot) {
  const result = new Map();
  snapshot.forEach(item => {
    const value = item.data();
    if (value?.id && value.event) result.set(String(value.id), value.event);
  });
  return result;
}

function mergeWorkspace(local, remoteRecordsMap, remoteHistoryMap) {
  const localRecords = new Map((local.records || []).map(record => [String(record.id), record]));
  const localDeleted = local.deletedRecords || {};
  const ids = new Set([...localRecords.keys(), ...Object.keys(localDeleted), ...remoteRecordsMap.keys()]);
  const records = [];
  const deletedRecords = {};
  for (const id of ids) {
    const localRecord = localRecords.get(id);
    const remoteEntry = remoteRecordsMap.get(id);
    const remoteRecord = remoteEntry?.deleted ? null : remoteEntry?.record;
    const localDeleteAt = String(localDeleted[id] || '');
    const remoteDeleteAt = remoteEntry?.deleted ? String(remoteEntry.updatedAt || '') : '';
    const deletedAt = stamp(localDeleteAt) >= stamp(remoteDeleteAt) ? localDeleteAt : remoteDeleteAt;
    let winner = null;
    if (localRecord && remoteRecord) winner = stamp(localRecord.updatedAt) > stamp(remoteRecord.updatedAt) ? localRecord : remoteRecord;
    else winner = localRecord || remoteRecord || null;
    if (winner && (!deletedAt || stamp(winner.updatedAt) > stamp(deletedAt))) records.push(winner);
    else if (deletedAt) deletedRecords[id] = deletedAt;
  }
  const history = new Map();
  for (const event of local.history || []) if (event?.id) history.set(String(event.id), event);
  for (const [id, event] of remoteHistoryMap) if (!history.has(id)) history.set(id, event);
  return {
    records,
    deletedRecords,
    history: Array.from(history.values()).sort((a, b) => stamp(b.at) - stamp(a.at))
  };
}

async function commitEntries(entries) {
  for (let start = 0; start < entries.length; start += 400) {
    const batch = writeBatch(db);
    for (const entry of entries.slice(start, start + 400)) batch.set(entry.ref, entry.value);
    await batch.commit();
  }
}

async function pushChanges(data) {
  const recordEntries = [];
  const wantedRecords = new Map();
  for (const record of data.records || []) {
    const value = { id: String(record.id), record, deleted: false, updatedAt: String(record.updatedAt || new Date().toISOString()) };
    wantedRecords.set(value.id, value);
  }
  for (const [id, deletedAt] of Object.entries(data.deletedRecords || {})) {
    const active = wantedRecords.get(id);
    if (active && stamp(active.updatedAt) > stamp(deletedAt)) continue;
    const value = { id, record: null, deleted: true, updatedAt: String(deletedAt || new Date().toISOString()) };
    wantedRecords.delete(id);
    wantedRecords.set(id, value);
  }
  for (const [id, value] of wantedRecords) {
    const signature = stable(value);
    if (recordCache.get(id) === signature) continue;
    recordEntries.push({ ref: doc(recordsRef, await recordKey(id)), value });
    recordCache.set(id, signature);
  }

  const historyEntries = [];
  for (const event of data.history || []) {
    if (!event?.id) continue;
    const id = String(event.id), signature = stable(event);
    if (historyCache.get(id) === signature) continue;
    historyEntries.push({ ref: doc(historyRef, id), value: { id, event } });
    historyCache.set(id, signature);
  }
  await commitEntries(recordEntries);
  await commitEntries(historyEntries);
  remoteRecords = new Map(wantedRecords);
}

async function reconcile() {
  if (!currentUser || !collectionReady || !bridge()) return;
  const merged = mergeWorkspace(bridge().getSnapshot(), remoteRecords, remoteHistory);
  const signature = stable(merged);
  if (signature !== lastApplied) {
    lastApplied = signature;
    bridge().applyCloudSnapshot(merged);
  }
  status(navigator.onLine ? 'syncing' : 'offline');
  await pushChanges(merged);
  status(navigator.onLine ? 'synced' : 'offline');
}

function scheduleReconcile() {
  reconcileQueue = reconcileQueue.then(reconcile).catch(error => {
    console.error('Shared yard sync failed', error);
    const denied = error?.code === 'permission-denied' || error?.code === 'firestore/permission-denied';
    status('error', { message: denied ? 'You are signed in, but Firestore is blocking access. We need to add the signed-in-user rules in Firebase.' : 'Could not sync right now. Your changes remain saved on this device; try Sync now when the connection is back.' });
  });
  return reconcileQueue;
}

async function refreshFromServer() {
  const [recordSnapshot, historySnapshot] = await Promise.all([getDocs(recordsRef), getDocs(historyRef)]);
  remoteRecords = readRecords(recordSnapshot);
  remoteHistory = readHistory(historySnapshot);
  recordCache = new Map(Array.from(remoteRecords, ([id, value]) => [id, stable(value)]));
  historyCache = new Map(Array.from(remoteHistory, ([id, event]) => [id, stable(event)]));
  collectionReady = true;
  await scheduleReconcile();
}

function stopListeners() {
  stopRecords?.(); stopHistory?.(); stopRecords = null; stopHistory = null;
  collectionReady = false; remoteRecords = new Map(); remoteHistory = new Map(); recordCache = new Map(); historyCache = new Map(); lastApplied = '';
}

async function startSession(user) {
  stopListeners();
  status('syncing');
  try {
    await refreshFromServer();
    stopRecords = onSnapshot(recordsRef, snapshot => {
      remoteRecords = readRecords(snapshot);
      recordCache = new Map(Array.from(remoteRecords, ([id, value]) => [id, stable(value)]));
      scheduleReconcile();
    }, error => scheduleReconcileError(error));
    stopHistory = onSnapshot(historyRef, snapshot => {
      remoteHistory = readHistory(snapshot);
      historyCache = new Map(Array.from(remoteHistory, ([id, event]) => [id, stable(event)]));
      scheduleReconcile();
    }, error => scheduleReconcileError(error));
  } catch (error) {
    const denied = error?.code === 'permission-denied' || error?.code === 'firestore/permission-denied';
    status('error', { message: denied ? 'You are signed in, but Firestore is blocking access. We need to add the signed-in-user rules in Firebase.' : 'Could not connect to the shared yard. Your device copy is safe; check the connection and try again.' });
  }
}

function scheduleReconcileError(error) {
  console.error('Shared yard listener failed', error);
  const denied = error?.code === 'permission-denied' || error?.code === 'firestore/permission-denied';
  status('error', { message: denied ? 'Firestore rules are blocking access. We need to add the signed-in-user rules in Firebase.' : 'The shared connection stopped. Your device copy is still saved.' });
}

window.yardFirebase = {
  currentUser: () => currentUser,
  signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
  createAccount: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  resetPassword: email => sendPasswordResetEmail(auth, email),
  signOut: () => signOut(auth),
  saveData: () => { if (!currentUser || !collectionReady) return Promise.resolve(); status('syncing'); return scheduleReconcile(); },
  syncNow: async () => { if (!currentUser) throw new Error('Sign in first'); await refreshFromServer(); }
};

window.addEventListener('online', () => { if (currentUser) refreshFromServer().catch(scheduleReconcileError); });
window.addEventListener('offline', () => { if (currentUser) status('offline'); });
status('loading');
onAuthStateChanged(auth, user => {
  currentUser = user || null;
  if (!currentUser) { stopListeners(); status('local'); return; }
  startSession(currentUser);
});

