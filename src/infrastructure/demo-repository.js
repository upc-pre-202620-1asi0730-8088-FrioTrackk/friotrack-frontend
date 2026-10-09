import { computed, ref } from 'vue';
import { createSeed } from '../domains/seed.js';
import { applyCommand, registerLocalProfile } from '../domains/operations.js';

export const STORAGE_KEY = 'friotrack.tb1.sample.v1';
const SESSION_KEY = 'friotrack.tb1.sample.profile';
const storageIssue = ref(false);
function readData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.schema === 1 && ['profiles', 'vehicles', 'drivers', 'shipments', 'alerts', 'notifications'].every((key) => Array.isArray(saved[key]))) return saved;
  } catch { storageIssue.value = true; }
  return createSeed();
}
export const data = ref(readData());
const profileId = ref(null);
try { profileId.value = localStorage.getItem(SESSION_KEY); } catch { storageIssue.value = true; }
export const profile = computed(() => data.value.profiles.find((item) => item.id === profileId.value) || null);
export const persistenceWarning = computed(() => storageIssue.value);

function persist(next) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch { throw new Error('storageUnavailable'); }
  data.value = next;
}

// Commands always validate against the latest stored snapshot. This prevents a
// second tab from booking a resource using an obsolete in-memory collection.
// localStorage is a TB1 demo adapter, not a database or security boundary.
export function execute(type, payload) {
  const latest = readData();
  const actor = latest.profiles.find((item) => item.id === profileId.value);
  const { state, result } = applyCommand(latest, actor, { type, payload });
  persist(state);
  return result;
}
export function enterSample(id) {
  if (!data.value.profiles.some((item) => item.id === id)) throw new Error('invalidProfile');
  try { localStorage.setItem(SESSION_KEY, id); } catch { throw new Error('storageUnavailable'); }
  profileId.value = id;
}
export function registerSample(draft) {
  const { state, result } = registerLocalProfile(readData(), draft);
  persist(state); enterSample(result.id); return result;
}
export function leaveSample() {
  try { localStorage.removeItem(SESSION_KEY); } catch { storageIssue.value = true; }
  profileId.value = null;
}
export function resetSamples() { persist(createSeed()); leaveSample(); }
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) data.value = readData();
  if (event.key === SESSION_KEY) profileId.value = event.newValue;
});

// Future REST adapter must implement these operations using authenticated
// server-side authorization, transactions and optimistic concurrency (ETag).
export const repositoryContract = Object.freeze({
  shipments: ['list', 'create', 'update', 'transition', 'deleteScheduled', 'export'],
  monitoring: ['readings', 'alerts', 'recordCorrectiveAction'],
  resources: ['vehicles', 'drivers'],
  identity: ['signIn', 'register', 'recoverPassword', 'profile'],
});
