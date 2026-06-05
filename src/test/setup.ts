// Install fake-indexeddb globally so Dexie works in the jsdom test environment.
// This must run before any Dexie imports or database operations.
import 'fake-indexeddb/auto';
