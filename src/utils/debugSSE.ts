// src/utils/debugSSE.ts - Utilities do debugowania SSE
export const SSEDebugLogger = {
  // Log state transitions w MovieTinderResultsScreen
  logStateTransition(component: string, from: string, to: string, trigger: string) {
    console.log(`🔄 [${component}] State: ${from} → ${to} (trigger: ${trigger})`);
  },

  // Log SSE events z dodatkowymi szczegółami
  logSSEEvent(source: string, event: any, context?: any) {
    console.log(`📡 [SSE-${source}] Event:`, {
      type: event.type,
      updateType: event.updateType || event.data?.updateType,
      timestamp: event.timestamp || event.data?.timestamp,
      context,
      fullEvent: event
    });
  },

  // Log session state changes
  logSessionChange(reason: string, session: any, previousSession?: any) {
    console.log(`📊 [SESSION] ${reason}:`, {
      currentStep: session?.currentStep,
      finalWinnerId: session?.finalWinnerMovieId,
      status: session?.status,
      changed: previousSession ? {
        step: previousSession.currentStep !== session?.currentStep,
        winner: previousSession.finalWinnerMovieId !== session?.finalWinnerMovieId,
        status: previousSession.status !== session?.status
      } : 'first_load'
    });
  },

  // Debug helper dla final verdict flow
  logFinalVerdictFlow(step: string, data?: any) {
    console.log(`🏆 [FINAL_VERDICT] ${step}:`, data);
  }
};

// Hook dla enhanced debugging w development
export function useSSEDebug(componentName: string, sessionId: string) {
  const logEvent = (event: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🐛 [${componentName}:${sessionId}] ${event}`, data);
    }
  };

  return { logEvent };
}