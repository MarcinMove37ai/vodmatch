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
    displayName: 'Netflix',
    color: 'from-red-600 to-red-700',
    selected: false
  },
  {
    id: 'amazon',
    name: 'amazon',
    displayName: 'Prime Video',
    color: 'from-blue-500 to-cyan-600',
    selected: false
  },
  {
    id: 'hulu',
    name: 'hulu',
    displayName: 'Hulu',
    color: 'from-green-500 to-emerald-600',
    selected: false
  },
  {
    id: 'hbo',
    name: 'hbo',
    displayName: 'HBO Max',
    color: 'from-purple-600 to-violet-700',
    selected: false
  },
  {
    id: 'apple',
    name: 'apple',
    displayName: 'Apple TV+',
    color: 'from-gray-700 to-gray-800',
    selected: false
  }
]