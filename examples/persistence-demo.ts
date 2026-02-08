import { type State, state } from '@nerdalytics/beacon'
import { BeaconRewind, type CleanupFn } from '../src/index.ts'

interface AppSettings {
	theme: 'light' | 'dark'
	language: string
	notifications: boolean
}

// Create a BeaconRewind instance with a persistent database
const db: BeaconRewind = new BeaconRewind({
	databasePath: 'settings.sqlite',
})

// Create initial state
const settings: State<AppSettings> = state({
	language: 'en',
	notifications: true,
	theme: 'light',
})

console.debug('=== Cache Restoration Demo ===')
console.debug('Initial state:', settings())

// Persist the state - this will restore from database if it exists
const _cleanup: CleanupFn | undefined = db.persist('appSettings', settings)

// Check if we restored from disk or using initial values
const currentSettings: AppSettings = settings()
if (currentSettings.theme === 'dark' && currentSettings.language === 'es') {
	console.debug('✅ State restored from disk!')
	console.debug('Restored state:', currentSettings)
} else {
	console.debug('📝 Using initial state (no persisted state found)')

	// Update the state - this will be persisted automatically
	console.debug('\nUpdating settings...')
	settings.set({
		language: 'es',
		notifications: false,
		theme: 'dark',
	})
	console.debug('Updated state:', settings())
	console.debug('\n💾 State has been saved to disk')
	console.debug('Run this script again to see state restoration!')
}

// Important: Don't call cleanup() here!
// cleanup() drops the table, preventing restoration on next run
// Only call cleanup() when you want to completely remove persisted data

console.debug('\n=== End of Demo ===')
