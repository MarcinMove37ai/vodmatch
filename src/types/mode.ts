export interface ViewingMode {
  id: string
  name: string
  displayName: string
  description: string
  icon: string
  selected: boolean
}

export const VIEWING_MODES: ViewingMode[] = [
  {
    id: 'solo',
    name: 'solo',
    displayName: 'Solo',
    description: 'Personal movie discovery',
    icon: 'user',
    selected: false
  },
  {
    id: 'couple',
    name: 'couple',
    displayName: 'Couple',
    description: 'Perfect for date night',
    icon: 'users-2',
    selected: false
  },
  {
    id: 'group',
    name: 'group',
    displayName: 'Group',
    description: 'Movie night with friends',
    icon: 'users',
    selected: false
  }
]