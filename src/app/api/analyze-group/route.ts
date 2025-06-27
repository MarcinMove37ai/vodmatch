// ========================================
// WATCHMATCH ENHANCED SEMANTIC API - Next.js API Route
// src/app/api/analyze-group/route.ts
// ========================================

import { NextRequest, NextResponse } from 'next/server'

// ========================================
// INTERFACES
// ========================================

interface QuizResult {
  userId: string
  answers: string[]
  totalTime: number
  completedAt: string
  displayName: string
}

interface IndividualAnalysis {
  userId: string
  displayName: string
  profileType: string
  personalityInsights: {
    coreNeed: string
    energyStyle: string
    decisionMaking: string
    stressResponse: string
    socialDynamic: string
  }
  filmPreferences: {
    idealLength: string
    preferredPace: string
    complexityLevel: string
    emotionalTone: string
    viewingContext: string
  }
  psychologicalFlags: string[]
  engagingFeedback: string
  discussionStarters: string[]
}

interface GroupAnalysis {
  groupPersonality: {
    archetype: string
    coreCharacteristics: string[]
    groupDynamic: string
    decisionMakingStyle: string
    conflictResolutionApproach: string
  }
  filmingCompatibility: {
    sharedPreferences: string[]
    potentialTensions: string[]
    optimizationStrategy: string
    recommendedApproach: string
  }
  semanticDescription: string
  llmContext: {
    groupEmotionalState: string
    dominantPersonalities: string[]
    filmingNeeds: string[]
    warningsForLLM: string[]
    strategicGuidance: string
  }
  engagingGroupFeedback: string
}

// ========================================
// ENHANCED ANALYSIS FUNCTIONS
// ========================================

// Mapowanie odpowiedzi na wartości numeryczne (bez zmian)
const mappings = {
  energy: { A: 1, B: 2, C: 3, D: 4 },
  cognitive: { A: 1, B: 3, C: 1, D: 4 },
  emotional: { A: "unclear", B: "mixed", C: "intense", D: "stable" },
  role: { A: "accommodator", B: "mediator", C: "dominator", D: "wildcard" },
  rhythm: { A: "30-60min", B: "90-120min", C: "120-180min", D: "episodic" },
  tension: { A: "mobilizing", B: "relaxed", C: "blocked", D: "floating" },
  processing: { A: "analytical", B: "passive", C: "clearing", D: "exploratory" },
  motivation: { A: "hedonistic", B: "social", C: "eudaimonic", D: "exploratory" },
  control: { A: "overwhelmed_control", B: "delegated_comfort", C: "frustrated_agency", D: "empowered_control" },
  time: { A: "stretched_painful", B: "natural_rhythm", C: "compressed_intense", D: "flowing_harmonious" }
}

// Funkcja enhanced analizy indywidualnej
function analyzeIndividualEnhanced(answers: string[], userId: string, displayName: string, totalTime: number): IndividualAnalysis {
  // Podstawowe obliczenia (bez zmian)
  const energy = mappings.energy[answers[0] as keyof typeof mappings.energy]
  const cognitive = mappings.cognitive[answers[1] as keyof typeof mappings.cognitive]
  const emotional = mappings.emotional[answers[2] as keyof typeof mappings.emotional]
  const role = mappings.role[answers[3] as keyof typeof mappings.role]
  const rhythm = mappings.rhythm[answers[4] as keyof typeof mappings.rhythm]
  const tension = mappings.tension[answers[5] as keyof typeof mappings.tension]
  const processing = mappings.processing[answers[6] as keyof typeof mappings.processing]
  const motivation = mappings.motivation[answers[7] as keyof typeof mappings.motivation]
  const control = mappings.control[answers[8] as keyof typeof mappings.control]
  const timePerception = mappings.time[answers[9] as keyof typeof mappings.time]

  const rhythmModifier = { A: 0.5, B: 1.0, C: 1.5, D: 2.0 }[answers[4] as 'A'|'B'|'C'|'D'] || 1.0
  const energyScore = (energy + rhythmModifier) / 2

  const stressIndicators = [answers[1], answers[5], answers[9]]
  const stressCount = stressIndicators.filter(ans => ans === 'A' || ans === 'C').length
  const compensationCoefficient = stressCount / 3

  const tempoValues = [energy, mappings.energy[answers[5] as keyof typeof mappings.energy] || 2, mappings.energy[answers[9] as keyof typeof mappings.energy] || 2]
  const tempoPreference = tempoValues.reduce((a, b) => a + b) / 3

  let complexityTolerance = "medium"
  if (cognitive === 1 || processing === "passive" || processing === "clearing") {
    complexityTolerance = "low"
  } else if (cognitive === 4 && processing === "exploratory") {
    complexityTolerance = "high"
  }

  // Wykrywanie flag psychologicznych
  const psychologicalFlags: string[] = []

  if (answers[0] === 'A' && (answers[1] === 'A' || answers[1] === 'C') &&
      answers[4] === 'A' && answers[5] === 'C') {
    psychologicalFlags.push("burnout_risk")
  }

  if (answers[0] === 'D' && answers[1] === 'D' && answers[5] === 'A' && answers[9] === 'C') {
    psychologicalFlags.push("overstimulation_warning")
  }

  const bCount = answers.filter(ans => ans === 'B').length
  if (bCount >= 7) {
    psychologicalFlags.push("decision_paralysis")
  }

  const energyValues = answers.map(ans => mappings.energy[ans as keyof typeof mappings.energy] || 2)
  const variance = calculateVariance(energyValues)
  if (variance > 1.5) {
    psychologicalFlags.push("chaos_indicator")
  }

  // Enhanced profil identification
  const profileType = identifyEnhancedProfile(answers, energyScore, cognitive, emotional, role, compensationCoefficient)

  // Generate personality insights
  const personalityInsights = generatePersonalityInsights(profileType, energyScore, cognitive, emotional, role, motivation, control, timePerception, compensationCoefficient)

  // Generate film preferences
  const filmPreferences = generateFilmPreferences(energyScore, cognitive, complexityTolerance, tempoPreference, rhythm, motivation, emotional)

  // Generate engaging feedback and discussion starters
  const { engagingFeedback, discussionStarters } = generateEngagingFeedback(profileType, personalityInsights, filmPreferences, psychologicalFlags, totalTime)

  return {
    userId,
    displayName,
    profileType,
    personalityInsights,
    filmPreferences,
    psychologicalFlags,
    engagingFeedback,
    discussionStarters
  }
}

// Enhanced profile identification with more nuanced archetypes
function identifyEnhancedProfile(answers: string[], energy: number, cognitive: number, emotional: string, role: string, compensation: number): string {
  // Check for specific patterns first
  if (energy <= 1.5 && cognitive <= 2 && compensation > 0.5) {
    return "overwhelmed_caregiver"
  }

  if (energy >= 3.5 && cognitive >= 4 && emotional === "stable" && role === "dominator") {
    return "confident_curator"
  }

  if (role === "wildcard" && energy >= 2.0 && cognitive >= 3) {
    if (compensation < 0.3) {
      return "adventurous_explorer"
    } else {
      return "conflicted_seeker"
    }
  }

  if (energy >= 2.5 && emotional === "intense" && cognitive <= 2) {
    return "energetic_escapist"
  }

  if (role === "mediator" && energy >= 1.5 && energy <= 3.0) {
    return "harmonious_connector"
  }

  if (energy <= 2.0 && cognitive <= 2 && role === "accommodator") {
    return "gentle_follower"
  }

  if (cognitive >= 4 && energy >= 2.5 && compensation < 0.3) {
    return "intellectual_enthusiast"
  }

  if (compensation > 0.6) {
    return "seeking_balance"
  }

  // Default patterns
  if (role === "dominator") return "natural_leader"
  if (role === "accommodator") return "supportive_viewer"

  return "balanced_participant"
}

// Generate detailed personality insights
function generatePersonalityInsights(profileType: string, energy: number, cognitive: number, emotional: string, role: string, motivation: string, control: string, timePerception: string, compensation: number) {
  const profiles: Record<string, any> = {
    overwhelmed_caregiver: {
      coreNeed: "Emotional restoration and gentle comfort",
      energyStyle: "Currently depleted, needs recharging through calm experiences",
      decisionMaking: "Prefers others to lead while maintaining veto power",
      stressResponse: "Seeks simplicity and predictability to reduce overwhelm",
      socialDynamic: "Supportive but needs personal space protected"
    },
    confident_curator: {
      coreNeed: "Intellectual stimulation and artistic excellence",
      energyStyle: "High energy directed toward discovery and mastery",
      decisionMaking: "Takes charge with strong, informed preferences",
      stressResponse: "Channels stress into productive exploration",
      socialDynamic: "Natural leader who guides group toward quality experiences"
    },
    adventurous_explorer: {
      coreNeed: "Novel experiences and creative surprises",
      energyStyle: "Adaptable energy that rises to meet interesting challenges",
      decisionMaking: "Independent but collaborative when intrigued",
      stressResponse: "Uses variety and change as stress relief",
      socialDynamic: "Wild card who can energize or redirect group dynamics"
    },
    conflicted_seeker: {
      coreNeed: "Resolution of internal contradictions through external harmony",
      energyStyle: "Variable energy influenced by context and group mood",
      decisionMaking: "Struggles with choices, benefits from structured options",
      stressResponse: "Seeks experiences that provide clarity and direction",
      socialDynamic: "Adaptable contributor who reflects group energy"
    },
    energetic_escapist: {
      coreNeed: "High-stimulation distraction from daily pressures",
      energyStyle: "Intense bursts seeking immediate engagement",
      decisionMaking: "Quick choices favoring action over contemplation",
      stressResponse: "Prefers to outrun stress through immersive experiences",
      socialDynamic: "Catalyst for group energy and momentum"
    },
    harmonious_connector: {
      coreNeed: "Shared experiences that bring people together",
      energyStyle: "Steady, sustainable energy focused on group cohesion",
      decisionMaking: "Seeks consensus and win-win solutions",
      stressResponse: "Finds peace through group harmony and understanding",
      socialDynamic: "Natural mediator who facilitates group satisfaction"
    },
    gentle_follower: {
      coreNeed: "Safe, predictable experiences with minimal pressure",
      energyStyle: "Low-key energy that appreciates gentle pacing",
      decisionMaking: "Defers to others while maintaining personal comfort",
      stressResponse: "Withdraws or seeks familiar, comforting experiences",
      socialDynamic: "Supportive presence who benefits from protection"
    },
    intellectual_enthusiast: {
      coreNeed: "Mental engagement and learning through entertainment",
      energyStyle: "High cognitive energy seeking complex stimulation",
      decisionMaking: "Analytical approach weighing multiple factors",
      stressResponse: "Processes stress through intellectual understanding",
      socialDynamic: "Contributes depth and thoughtful analysis to group"
    },
    seeking_balance: {
      coreNeed: "Equilibrium between current state and desired experience",
      energyStyle: "Compensatory energy seeking opposite of current mood",
      decisionMaking: "Chooses based on what's needed rather than preferred",
      stressResponse: "Actively seeks corrective experiences",
      socialDynamic: "May have different needs than expressed preferences"
    },
    natural_leader: {
      coreNeed: "Influence over group experience and quality outcomes",
      energyStyle: "Directed energy toward achieving group satisfaction",
      decisionMaking: "Confident, decisive with group welfare in mind",
      stressResponse: "Takes action to improve situations",
      socialDynamic: "Assumes responsibility for group experience quality"
    },
    supportive_viewer: {
      coreNeed: "Harmony and avoiding conflict while enjoying together",
      energyStyle: "Flexible energy that adapts to group needs",
      decisionMaking: "Accommodating with hidden preferences",
      stressResponse: "Prioritizes group peace over personal desires",
      socialDynamic: "Stabilizing influence that prevents group conflict"
    },
    balanced_participant: {
      coreNeed: "Satisfying experience without extreme demands",
      energyStyle: "Moderate, adaptable energy suitable for various options",
      decisionMaking: "Open-minded with reasonable preferences",
      stressResponse: "Flexible coping through variety of approaches",
      socialDynamic: "Easy-going contributor to group dynamics"
    }
  }

  return profiles[profileType] || profiles.balanced_participant
}

// Generate specific film preferences
function generateFilmPreferences(energy: number, cognitive: number, complexity: string, tempo: number, rhythm: string, motivation: string, emotional: string) {
  const lengthMapping: Record<string, string> = {
    "30-60min": "Short format (series episodes, documentaries under 90min)",
    "90-120min": "Standard feature length (90-120 minutes)",
    "120-180min": "Extended experience (120+ minutes, mini-series)",
    "episodic": "Flexible format (can handle series or film marathons)"
  }

  const paceMapping = {
    1: "Contemplative pacing with time to process",
    2: "Steady, comfortable rhythm without rush",
    3: "Dynamic pacing with varied energy levels",
    4: "High-energy, fast-moving narrative"
  }

  const complexityMapping: Record<string, string> = {
    "low": "Straightforward stories with clear resolution",
    "medium": "Moderately complex with some layers to discover",
    "high": "Multi-layered narratives with depth and ambiguity"
  }

  const emotionalMapping: Record<string, string> = {
    "unclear": "Films that provide clarity and emotional resolution",
    "mixed": "Stories that acknowledge life's complexity",
    "intense": "High-stakes drama or cathartic experiences",
    "stable": "Wide range of emotional tones, very adaptable"
  }

  const motivationMapping: Record<string, string> = {
    "hedonistic": "Pure entertainment focused on pleasure and comfort",
    "social": "Character-driven stories about relationships and connection",
    "eudaimonic": "Meaningful narratives about growth and purpose",
    "exploratory": "Unique perspectives and innovative storytelling"
  }

  const paceLevel = Math.round(tempo)

  return {
    idealLength: lengthMapping[rhythm],
    preferredPace: paceMapping[paceLevel as keyof typeof paceMapping] || paceMapping[2],
    complexityLevel: complexityMapping[complexity],
    emotionalTone: emotionalMapping[emotional],
    viewingContext: motivationMapping[motivation]
  }
}

// Generate engaging feedback and discussion starters
function generateEngagingFeedback(profileType: string, insights: any, preferences: any, flags: string[], totalTime: number) {
  const profileDescriptions: Record<string, any> = {
    overwhelmed_caregiver: {
      title: "The Nurturing Soul Seeking Solace",
      description: "You're in full caregiver mode and your emotional tank needs refilling. You crave stories that wrap around you like a warm blanket - predictable enough to relax into, but beautiful enough to restore your faith in good things.",
      quirks: "You probably pause movies to check on others, but tonight, you deserve to be taken care of by the story.",
      filmSoul: "Your movie soulmate tonight is anything that feels like a gentle hug from a wise friend."
    },
    confident_curator: {
      title: "The Artistic Visionary",
      description: "You're operating at full creative capacity and hungry for excellence. You want films that challenge conventions, showcase mastery, and leave you discussing craft long after the credits roll.",
      quirks: "You're the person who notices cinematography choices and probably has strong opinions about film scores.",
      filmSoul: "Your movie soulmate tonight celebrates the art of storytelling at its finest."
    },
    adventurous_explorer: {
      title: "The Fearless Discovery Seeker",
      description: "You're in full exploration mode, ready to venture into uncharted narrative territory. You thrive on surprises, innovative storytelling, and experiences that expand your worldview.",
      quirks: "You're probably the one suggesting foreign films or that weird indie everyone else is scared to try.",
      filmSoul: "Your movie soulmate tonight is something that doesn't quite fit in traditional categories."
    },
    conflicted_seeker: {
      title: "The Thoughtful Wanderer",
      description: "You're navigating some internal complexity and seeking stories that make sense of mixed feelings. You appreciate nuance and need narratives that honor life's contradictions.",
      quirks: "You might find yourself relating to multiple characters instead of picking just one favorite.",
      filmSoul: "Your movie soulmate tonight understands that growth comes through grappling with difficult questions."
    },
    energetic_escapist: {
      title: "The High-Octane Dreamer",
      description: "You're channeling intense energy and need a story that can match your pace. You want to be swept away by momentum, action, and experiences bigger than daily life.",
      quirks: "You're probably the one who cheers during action sequences and doesn't mind if the plot is simple as long as it's thrilling.",
      filmSoul: "Your movie soulmate tonight is pure adrenaline with heart."
    },
    harmonious_connector: {
      title: "The Group Harmony Weaver",
      description: "You're focused on creating positive shared experiences and naturally tune into what brings people together. You excel at finding the sweet spot where everyone feels included.",
      quirks: "You probably ask 'Is everyone okay with this?' more than anyone else, and genuinely care about the answer.",
      filmSoul: "Your movie soulmate tonight makes everyone feel like they're part of something special."
    },
    gentle_follower: {
      title: "The Peaceful Appreciator",
      description: "You're seeking comfort and gentle experiences that don't demand too much emotional labor. You appreciate quality storytelling that unfolds at a humane pace.",
      quirks: "You probably prefer happy endings and might peek ahead if things get too suspenseful.",
      filmSoul: "Your movie soulmate tonight is like a conversation with your most understanding friend."
    },
    intellectual_enthusiast: {
      title: "The Analytical Adventurer",
      description: "Your mind is sharp and eager for stories that reward attention and reflection. You love catching details, understanding motivations, and unpacking layers of meaning.",
      quirks: "You're probably the one explaining plot connections and catching easter eggs everyone else missed.",
      filmSoul: "Your movie soulmate tonight respects your intelligence and rewards careful viewing."
    },
    seeking_balance: {
      title: "The Equilibrium Seeker",
      description: "You're in a state of transition and seeking stories that help restore your emotional balance. You might need something different from your usual preferences.",
      quirks: "Your movie mood might surprise even you tonight - trust your instincts over your history.",
      filmSoul: "Your movie soulmate tonight is exactly what you need, not necessarily what you expected."
    },
    natural_leader: {
      title: "The Experience Architect",
      description: "You take ownership of group experiences and have strong instincts about what creates memorable moments. You're willing to advocate for quality and guide others toward great choices.",
      quirks: "You probably have a mental list of 'movies everyone should see' and aren't afraid to share opinions.",
      filmSoul: "Your movie soulmate tonight showcases why film is such a powerful art form."
    },
    supportive_viewer: {
      title: "The Diplomatic Appreciator",
      description: "You prioritize group harmony and are skilled at finding enjoyment in others' choices. You're the emotional glue that helps everyone have a good time together.",
      quirks: "You probably say 'I'm fine with whatever' but actually have preferences you rarely voice.",
      filmSoul: "Your movie soulmate tonight appreciates your generous spirit and rewards your flexibility."
    },
    balanced_participant: {
      title: "The Adaptable Enthusiast",
      description: "You bring a healthy flexibility and genuine curiosity to film experiences. You're open to various genres and styles, making you an ideal viewing companion.",
      quirks: "You probably enjoy a wider range of films than most people and rarely leave a theater disappointed.",
      filmSoul: "Your movie soulmate tonight could be almost anything - your openness is your superpower."
    }
  }

  const profile = profileDescriptions[profileType] || profileDescriptions.balanced_participant

  const timeInsight = totalTime < 30 ? "Quick decision-maker" :
                     totalTime > 90 ? "Thoughtful contemplator" : "Balanced deliberator"

  const flagInsights = flags.map(flag => {
    const flagMeanings: Record<string, string> = {
      burnout_risk: "Signs suggest you need extra gentleness right now",
      overstimulation_warning: "Your system might benefit from something more grounding",
      decision_paralysis: "You might appreciate having fewer overwhelming choices",
      chaos_indicator: "Your responses suggest some internal complexity to honor"
    }
    return flagMeanings[flag] || flag
  })

  const engagingFeedback = `🎭 ${profile.title}

${profile.description}

🎬 ${profile.filmSoul}

✨ ${profile.quirks}

📊 Quiz insight: ${timeInsight} who completed this in ${totalTime} seconds${flagInsights.length > 0 ? `\n💭 Special consideration: ${flagInsights.join(', ')}` : ''}`

  const discussionStarters = [
    `What does your "${profile.title}" type say about your real-life movie habits?`,
    `Do you agree that you're "${insights.socialDynamic.toLowerCase()}"?`,
    `Your core need is "${insights.coreNeed.toLowerCase()}" - does that surprise you?`,
    `${preferences.viewingContext} - is this how you usually choose what to watch?`
  ]

  return { engagingFeedback, discussionStarters }
}

// Enhanced group analysis
function analyzeGroupEnhanced(individualAnalyses: IndividualAnalysis[]): GroupAnalysis {
  const groupSize = individualAnalyses.length

  // Extract individual metrics for analysis
  const energies = individualAnalyses.map(a => {
    const energy = mappings.energy[a.profileType.includes('overwhelmed') ? 'A' :
                                   a.profileType.includes('confident') || a.profileType.includes('energetic') ? 'D' : 'B']
    return energy
  })

  const roles = individualAnalyses.map(a => {
    if (a.personalityInsights.socialDynamic.includes('leader') || a.personalityInsights.decisionMaking.includes('charge')) return 'dominator'
    if (a.personalityInsights.socialDynamic.includes('mediator') || a.personalityInsights.decisionMaking.includes('consensus')) return 'mediator'
    if (a.personalityInsights.socialDynamic.includes('supportive') || a.personalityInsights.decisionMaking.includes('others')) return 'accommodator'
    return 'wildcard'
  })

  // Calculate group metrics
  const energyVariance = calculateVariance(energies)
  const wdg = energyVariance

  const roleCount = {
    dominator: roles.filter(r => r === "dominator").length,
    mediator: roles.filter(r => r === "mediator").length,
    accommodator: roles.filter(r => r === "accommodator").length,
    wildcard: roles.filter(r => r === "wildcard").length
  }

  // Identify group archetype
  const groupArchetype = identifyGroupArchetype(individualAnalyses, roleCount, wdg)

  // Generate group personality
  const groupPersonality = generateGroupPersonality(groupArchetype, individualAnalyses, roleCount)

  // Generate filming compatibility analysis
  const filmingCompatibility = generateFilmingCompatibility(individualAnalyses, wdg)

  // Generate semantic description for LLM
  const semanticDescription = generateSemanticDescription(groupArchetype, individualAnalyses, groupPersonality, filmingCompatibility)

  // Generate LLM context
  const llmContext = generateLLMContext(individualAnalyses, groupPersonality, filmingCompatibility)

  // Generate engaging group feedback
  const engagingGroupFeedback = generateEngagingGroupFeedback(groupArchetype, groupPersonality, individualAnalyses)

  return {
    groupPersonality,
    filmingCompatibility,
    semanticDescription,
    llmContext,
    engagingGroupFeedback
  }
}

function identifyGroupArchetype(analyses: IndividualAnalysis[], roleCount: Record<string, number>, wdg: number): string {
  const size = analyses.length

  // Check for specific patterns
  if (roleCount.wildcard === size) {
    return wdg < 0.5 ? "harmonious_independents" : "creative_collective"
  }

  if (analyses.every(a => a.personalityInsights.coreNeed.includes("comfort") || a.personalityInsights.coreNeed.includes("restoration"))) {
    return "restoration_circle"
  }

  if (analyses.every(a => a.personalityInsights.energyStyle.includes("high") || a.personalityInsights.coreNeed.includes("stimulation"))) {
    return "energy_amplifiers"
  }

  if (roleCount.dominator > 1) {
    return "multiple_visionaries"
  }

  if (roleCount.mediator > size / 2) {
    return "diplomatic_consensus"
  }

  if (analyses.some(a => a.psychologicalFlags.includes("chaos_indicator")) && wdg > 1.0) {
    return "complex_dynamics"
  }

  if (wdg < 0.3) {
    return "aligned_tribe"
  }

  return "diverse_collective"
}

function generateGroupPersonality(archetype: string, analyses: IndividualAnalysis[], roleCount: Record<string, number>) {
  const archetypes: Record<string, any> = {
    harmonious_independents: {
      archetype: "The Harmonious Independents",
      coreCharacteristics: ["Self-directed but considerate", "Values personal choice within group harmony", "Flexible and adaptable"],
      groupDynamic: "Democratic collaboration with individual autonomy",
      decisionMakingStyle: "Consensus through individual input and mutual respect",
      conflictResolutionApproach: "Natural avoidance through flexibility and understanding"
    },
    creative_collective: {
      archetype: "The Creative Collective",
      coreCharacteristics: ["Diverse perspectives", "Openness to experimentation", "Unpredictable but creative"],
      groupDynamic: "Dynamic interplay of different creative energies",
      decisionMakingStyle: "Organic emergence through creative discussion",
      conflictResolutionApproach: "Integration of differences into creative solutions"
    },
    restoration_circle: {
      archetype: "The Restoration Circle",
      coreCharacteristics: ["Mutual care and support", "Preference for gentle experiences", "Protective of group emotional safety"],
      groupDynamic: "Nurturing environment focused on collective healing",
      decisionMakingStyle: "Careful consideration of everyone's emotional needs",
      conflictResolutionApproach: "Gentle discussion prioritizing emotional comfort"
    },
    energy_amplifiers: {
      archetype: "The Energy Amplifiers",
      coreCharacteristics: ["High enthusiasm", "Mutual energy building", "Adventure-seeking"],
      groupDynamic: "Synergistic energy that builds momentum",
      decisionMakingStyle: "Quick decisions based on collective excitement",
      conflictResolutionApproach: "Channel disagreement into creative energy"
    },
    multiple_visionaries: {
      archetype: "The Multiple Visionaries",
      coreCharacteristics: ["Strong individual perspectives", "High standards", "Potential for creative tension"],
      groupDynamic: "Multiple leaders navigating shared authority",
      decisionMakingStyle: "Negotiation between strong viewpoints",
      conflictResolutionApproach: "Structured discussion and possible compromise or rotation"
    },
    diplomatic_consensus: {
      archetype: "The Diplomatic Consensus",
      coreCharacteristics: ["Natural peacemakers", "Focus on group satisfaction", "Skilled at finding middle ground"],
      groupDynamic: "Collaborative harmony through active mediation",
      decisionMakingStyle: "Thorough discussion seeking win-win solutions",
      conflictResolutionApproach: "Active mediation and compromise facilitation"
    },
    complex_dynamics: {
      archetype: "The Complex Dynamics",
      coreCharacteristics: ["Varied and sometimes conflicting needs", "Rich internal diversity", "Requires careful navigation"],
      groupDynamic: "Multifaceted with potential for both harmony and tension",
      decisionMakingStyle: "Careful assessment of multiple perspectives",
      conflictResolutionApproach: "Recognition and integration of complexity"
    },
    aligned_tribe: {
      archetype: "The Aligned Tribe",
      coreCharacteristics: ["Shared wavelength", "Intuitive understanding", "Easy collaboration"],
      groupDynamic: "Natural synchronicity and mutual understanding",
      decisionMakingStyle: "Quick consensus through shared instincts",
      conflictResolutionApproach: "Rare conflicts resolved through natural alignment"
    },
    diverse_collective: {
      archetype: "The Diverse Collective",
      coreCharacteristics: ["Balanced variety", "Complementary strengths", "Democratic flexibility"],
      groupDynamic: "Healthy diversity creating rich group texture",
      decisionMakingStyle: "Democratic consideration of diverse input",
      conflictResolutionApproach: "Balance and integration of different needs"
    }
  }

  return archetypes[archetype] || archetypes.diverse_collective
}

function generateFilmingCompatibility(analyses: IndividualAnalysis[], wdg: number) {
  // Analyze shared preferences
  const lengthPrefs = analyses.map(a => a.filmPreferences.idealLength)
  const pacePrefs = analyses.map(a => a.filmPreferences.preferredPace)
  const complexityPrefs = analyses.map(a => a.filmPreferences.complexityLevel)
  const tonePrefs = analyses.map(a => a.filmPreferences.emotionalTone)

  const sharedPreferences: string[] = []
  const potentialTensions: string[] = []

  // Check for commonalities
  if (new Set(lengthPrefs).size === 1) {
    sharedPreferences.push(`Universal agreement on ${lengthPrefs[0].toLowerCase()}`)
  } else if (new Set(lengthPrefs).size > 2) {
    potentialTensions.push("Significant differences in preferred viewing length")
  }

  if (complexityPrefs.filter(p => p.includes("Straightforward")).length > analyses.length / 2) {
    sharedPreferences.push("Group preference for accessible, clear narratives")
  }

  if (complexityPrefs.filter(p => p.includes("Multi-layered")).length > analyses.length / 2) {
    sharedPreferences.push("Group appetite for complex, layered storytelling")
  }

  // Check for tensions
  const hasLowComplexity = complexityPrefs.some(p => p.includes("Straightforward"))
  const hasHighComplexity = complexityPrefs.some(p => p.includes("Multi-layered"))
  if (hasLowComplexity && hasHighComplexity) {
    potentialTensions.push("Complexity gap between group members")
  }

  const hasSlowPace = pacePrefs.some(p => p.includes("Contemplative"))
  const hasFastPace = pacePrefs.some(p => p.includes("High-energy"))
  if (hasSlowPace && hasFastPace) {
    potentialTensions.push("Pacing preferences span from contemplative to high-energy")
  }

  // Determine optimization strategy
  let optimizationStrategy = "Democratic balancing"
  let recommendedApproach = "Find films that offer something for everyone"

  if (wdg < 0.5) {
    optimizationStrategy = "Amplify shared preferences"
    recommendedApproach = "Focus on the group's natural alignment"
  } else if (potentialTensions.length > 2) {
    optimizationStrategy = "Careful tension navigation"
    recommendedApproach = "Sequential viewing or films with varied elements"
  } else if (analyses.some(a => a.personalityInsights.decisionMaking.includes("charge"))) {
    optimizationStrategy = "Guided by natural leaders"
    recommendedApproach = "Let decisive members guide with group input"
  }

  return {
    sharedPreferences,
    potentialTensions,
    optimizationStrategy,
    recommendedApproach
  }
}

function generateSemanticDescription(archetype: string, analyses: IndividualAnalysis[], personality: any, compatibility: any): string {
  const groupSize = analyses.length
  const profileTypes = analyses.map(a => a.profileType)
  const coreNeeds = analyses.map(a => a.personalityInsights.coreNeed)

  return `This ${groupSize}-person group exhibits the "${personality.archetype}" dynamic. The group consists of ${profileTypes.join(', ')}, creating ${personality.groupDynamic.toLowerCase()}.

Core group needs center around: ${coreNeeds.join('; ')}.

The group demonstrates ${compatibility.optimizationStrategy.toLowerCase()} with ${compatibility.sharedPreferences.length > 0 ? `strong alignment in: ${compatibility.sharedPreferences.join(', ')}` : 'diverse individual preferences'}${compatibility.potentialTensions.length > 0 ? `. Potential challenges include: ${compatibility.potentialTensions.join(', ')}` : ''}.

Recommended approach: ${compatibility.recommendedApproach}. The group's decision-making style involves ${personality.decisionMakingStyle.toLowerCase()}, with conflict resolution through ${personality.conflictResolutionApproach.toLowerCase()}.`
}

function generateLLMContext(analyses: IndividualAnalysis[], personality: any, compatibility: any) {
  const dominantPersonalities = analyses.map(a => a.profileType)
  const groupEmotionalState = analyses.every(a => a.personalityInsights.energyStyle.includes("depleted") || a.personalityInsights.coreNeed.includes("restoration")) ?
    "Group seeking restoration and comfort" :
    analyses.every(a => a.personalityInsights.energyStyle.includes("high") || a.personalityInsights.coreNeed.includes("stimulation")) ?
    "Group seeking high-energy engagement" :
    "Group with mixed energy levels seeking balance"

  const filmingNeeds = compatibility.sharedPreferences.concat([
    `Decision-making style: ${personality.decisionMakingStyle}`,
    `Conflict resolution: ${personality.conflictResolutionApproach}`,
    `Optimization strategy: ${compatibility.optimizationStrategy}`
  ])

  const warningsForLLM = compatibility.potentialTensions.concat(
    analyses.filter(a => a.psychologicalFlags.length > 0)
      .map(a => `${a.displayName} has ${a.psychologicalFlags.join(', ')} considerations`)
  )

  const strategicGuidance = `This group functions as "${personality.archetype}" and responds best to ${compatibility.recommendedApproach.toLowerCase()}. ${compatibility.potentialTensions.length > 0 ? `Navigate carefully around: ${compatibility.potentialTensions.join(', ')}.` : 'Group shows strong natural alignment.'} Leverage their ${personality.coreCharacteristics.join(', ').toLowerCase()} for optimal satisfaction.`

  return {
    groupEmotionalState,
    dominantPersonalities,
    filmingNeeds,
    warningsForLLM,
    strategicGuidance
  }
}

function generateEngagingGroupFeedback(archetype: string, personality: any, analyses: IndividualAnalysis[]): string {
  const size = analyses.length
  const names = analyses.map(a => a.displayName.split('_')[0] || a.displayName.substring(0, 8)).join(', ')

  const archetypeDescriptions: Record<string, string> = {
    harmonious_independents: `You're a beautiful paradox - ${size} independent spirits who somehow sync perfectly. You each value your autonomy but create magic when you collaborate. Tonight will be effortlessly satisfying.`,
    creative_collective: `You're a creative powerhouse! ${size} different artistic souls bringing unique perspectives. Your viewing experience will be anything but predictable - embrace the beautiful chaos you create together.`,
    restoration_circle: `You've formed a healing circle tonight. Everyone's here to recharge and care for each other through gentle, beautiful storytelling. This is going to be wonderfully nurturing.`,
    energy_amplifiers: `You're a group accelerator! Each person's energy feeds off the others, creating momentum that builds and builds. Tonight's going to be exhilarating - buckle up!`,
    multiple_visionaries: `You've got multiple directors in the room! Each of you has strong artistic vision and high standards. This could lead to passionate discussion or creative tension - both are valuable.`,
    diplomatic_consensus: `You're natural peacemakers who excel at finding solutions everyone loves. Your superpower is turning individual preferences into group satisfaction. Magic happens through your collaboration.`,
    complex_dynamics: `You're beautifully complex - multiple layers of needs, preferences, and personalities creating rich group texture. You'll need to navigate carefully, but the result will be uniquely satisfying.`,
    aligned_tribe: `You're operating on the same wavelength! It's like you share a collective consciousness about what makes a great viewing experience. Decisions will feel natural and unanimous.`,
    diverse_collective: `You represent the best of group diversity - different strengths that complement each other perfectly. Your variety is your strength, creating a viewing experience no one could achieve alone.`
  }

  const coreCharacteristics = personality.coreCharacteristics.map((c: string) => c.toLowerCase()).join(', ')

  return `🎭 ${personality.archetype}

${names} - ${archetypeDescriptions[archetype] || archetypeDescriptions.diverse_collective}

🎬 Your group dynamic: ${personality.groupDynamic}

✨ You're characterized by: ${coreCharacteristics}

🤝 How you'll decide: ${personality.decisionMakingStyle}

💫 The magic you create: Each person brings something unique, but together you create an experience none of you could have alone. Your ${personality.archetype.toLowerCase()} energy will make tonight special.`
}

// Helper function (unchanged)
function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b) / numbers.length
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2))
  return squaredDiffs.reduce((a, b) => a + b) / numbers.length
}

// ========================================
// NEXT.JS API ROUTE
// ========================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const startTime = Date.now()
    const quizData: QuizResult[] = await request.json()

    console.log(`📊 WatchMatch Enhanced Analysis: Processing ${quizData.length} quiz results`)

    // Validation (unchanged)
    if (!Array.isArray(quizData) || quizData.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid input: expected array of quiz results"
      }, { status: 400 })
    }

    for (const record of quizData) {
      if (!record.userId || !record.answers || !Array.isArray(record.answers) ||
          record.answers.length !== 10 || !record.displayName) {
        return NextResponse.json({
          success: false,
          error: "Invalid record format: missing required fields or incorrect answers length"
        }, { status: 400 })
      }

      if (!record.answers.every(ans => ['A', 'B', 'C', 'D'].includes(ans))) {
        return NextResponse.json({
          success: false,
          error: "Invalid answers: all answers must be A, B, C, or D"
        }, { status: 400 })
      }
    }

    // Enhanced individual analysis
    const individualAnalyses = quizData.map(record =>
      analyzeIndividualEnhanced(record.answers, record.userId, record.displayName, record.totalTime || 0)
    )

    console.log(`✅ Enhanced individual analyses completed: ${individualAnalyses.length} detailed profiles`)

    // Enhanced group analysis
    const groupAnalysis = analyzeGroupEnhanced(individualAnalyses)

    console.log(`✅ Enhanced group analysis completed: ${groupAnalysis.groupPersonality.archetype}`)

    const processingTime = Date.now() - startTime

    // Enhanced API response
    return NextResponse.json({
      success: true,
      processing_time_ms: processingTime,
      group_summary: {
        total_users: quizData.length,
        group_archetype: groupAnalysis.groupPersonality.archetype,
        compatibility_level: groupAnalysis.filmingCompatibility.sharedPreferences.length > groupAnalysis.filmingCompatibility.potentialTensions.length ? "high" : "moderate",
        optimization_strategy: groupAnalysis.filmingCompatibility.optimizationStrategy,
        estimated_satisfaction: groupAnalysis.filmingCompatibility.potentialTensions.length < 2 ? "high" : "moderate"
      },
      individual_insights: individualAnalyses.map(analysis => ({
        userId: analysis.userId,
        displayName: analysis.displayName,
        profileType: analysis.profileType,
        personalityInsights: analysis.personalityInsights,
        filmPreferences: analysis.filmPreferences,
        engagingFeedback: analysis.engagingFeedback,
        discussionStarters: analysis.discussionStarters,
        psychologicalFlags: analysis.psychologicalFlags
      })),
      group_insights: {
        groupPersonality: groupAnalysis.groupPersonality,
        filmingCompatibility: groupAnalysis.filmingCompatibility,
        semanticDescription: groupAnalysis.semanticDescription,
        engagingGroupFeedback: groupAnalysis.engagingGroupFeedback
      },
      llm_context: {
        semantic_group_description: groupAnalysis.semanticDescription,
        llm_guidance: groupAnalysis.llmContext,
        individual_context_summaries: individualAnalyses.map(a => ({
          userId: a.userId,
          displayName: a.displayName,
          core_need: a.personalityInsights.coreNeed,
          energy_style: a.personalityInsights.energyStyle,
          film_context: a.filmPreferences.viewingContext,
          warnings: a.psychologicalFlags
        }))
      },
      next_steps: {
        ready_for_llm: true,
        requires_social_media_data: true,
        llm_prompt_strategy: groupAnalysis.llmContext.strategicGuidance,
        estimated_llm_cost: "$0.03"
      }
    })

  } catch (error) {
    console.error('❌ WatchMatch Enhanced Analysis error:', error)
    return NextResponse.json({
      success: false,
      error: "Internal server error during analysis",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ========================================
// CONSOLE TEST SCRIPT - ENHANCED
// ========================================

/*
ENHANCED TEST SCRIPT FOR BROWSER CONSOLE:

const testData = [
  {
    "userId": "user_mcf1fosz_aimyau",
    "answers": ["A", "B", "A", "D", "B", "D", "B", "D", "A", "D"],
    "totalTime": 29,
    "completedAt": "2025-06-27T16:41:01.013Z",
    "displayName": "karolinaorzechowska_pro"
  },
  {
    "userId": "user_mcf1fo8r_01vcjg",
    "answers": ["B", "D", "B", "D", "D", "D", "D", "D", "D", "D"],
    "totalTime": 62,
    "completedAt": "2025-06-27T16:41:34.088Z",
    "displayName": "krzysiek_miotk"
  },
  {
    "userId": "user_mcf1ei9o_v3yfhl",
    "answers": ["C", "D", "B", "D", "B", "B", "D", "B", "D", "B"],
    "totalTime": 94,
    "completedAt": "2025-06-27T16:42:06.509Z",
    "displayName": "kappa_motorsport"
  }
];

fetch('/api/analyze-group', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(testData)
})
.then(response => response.json())
.then(data => {
  console.log('=== WATCHMATCH ENHANCED GROUP ANALYSIS ===');

  console.log('\n🎭 GROUP ARCHETYPE:');
  console.log(data.group_insights.groupPersonality.archetype);
  console.log(data.group_insights.engagingGroupFeedback);

  console.log('\n👤 INDIVIDUAL PERSONALITY INSIGHTS:');
  data.individual_insights.forEach((user, index) => {
    console.log(`\n--- ${user.displayName.toUpperCase()} ---`);
    console.log(user.engagingFeedback);
    console.log('\n💬 Discussion Starters:');
    user.discussionStarters.forEach(starter => console.log(`   • ${starter}`));
  });

  console.log('\n🎬 FILMING COMPATIBILITY:');
  console.log('Shared preferences:', data.group_insights.filmingCompatibility.sharedPreferences);
  console.log('Potential tensions:', data.group_insights.filmingCompatibility.potentialTensions);
  console.log('Strategy:', data.group_insights.filmingCompatibility.optimizationStrategy);

  console.log('\n🤖 LLM CONTEXT:');
  console.log('Semantic description:', data.llm_context.semantic_group_description);
  console.log('Strategic guidance:', data.llm_context.llm_guidance.strategicGuidance);
})
.catch(error => {
  console.error('Error:', error);
});

*/