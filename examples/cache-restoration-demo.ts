import { type State, state } from '@nerdalytics/beacon'
import { BeaconCache, type CleanupFn } from '../src/index.ts'

interface AppSettings {
	theme: 'light' | 'dark'
	language: string
	notifications: boolean
}

// Create a cache instance with a persistent database
const cache: BeaconCache = new BeaconCache({
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

// Cache the state - this will restore from database if it exists
const _cleanup: CleanupFn | undefined = cache.cache('appSettings', settings)

// Check if we restored from cache or using initial values
const currentSettings: AppSettings = settings()
if (currentSettings.theme === 'dark' && currentSettings.language === 'es') {
	console.debug('✅ State restored from cache!')
	console.debug('Restored state:', currentSettings)
} else {
	console.debug('📝 Using initial state (no cache found)')

	// Update the state - this will be persisted automatically
	console.debug('\nUpdating settings...')
	settings.set({
		language: 'es',
		notifications: false,
		theme: 'dark',
	})
	console.debug('Updated state:', settings())
	console.debug('\n💾 State has been saved to cache')
	console.debug('Run this script again to see cache restoration!')
}

// Important: Don't call cleanup() here!
// cleanup() drops the table, preventing restoration on next run
// Only call cleanup() when you want to completely remove cached data

console.debug('\n=== End of Demo ===')
