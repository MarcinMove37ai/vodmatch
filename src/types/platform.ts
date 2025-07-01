// POPRAWIONE mapowanie nazw platform - zastąp w @/types/platform.ts

export interface StreamingPlatform {
  id: string
  name: string
  displayName: string
  color: string
  selected: boolean
}

export const STREAMING_PLATFORMS: StreamingPlatform[] = [
  {
    id: 'netflix',
    name: 'netflix',
    displayName: 'Netflix',        // ✅ Odpowiada bazie
    color: 'from-red-600 to-red-700',
    selected: false
  },
  {
    id: 'amazon',
    name: 'amazon',
    displayName: 'Amazon Prime',   // ✅ POPRAWKA: "Prime Video" → "Amazon Prime"
    color: 'from-blue-500 to-cyan-600',
    selected: false
  },
  {
    id: 'hulu',
    name: 'hulu',
    displayName: 'Hulu',          // ✅ Odpowiada bazie
    color: 'from-green-500 to-emerald-600',
    selected: false
  },
  {
    id: 'hbo',
    name: 'hbo',
    displayName: 'HBO Max',       // ✅ Odpowiada bazie
    color: 'from-purple-600 to-violet-700',
    selected: false
  },
  {
    id: 'apple',
    name: 'apple',
    displayName: 'Apple TV+',     // ✅ Odpowiada bazie
    color: 'from-gray-700 to-gray-800',
    selected: false
  }
]