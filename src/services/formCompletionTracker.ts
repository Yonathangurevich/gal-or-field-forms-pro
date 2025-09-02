export interface FormCompletionEvent {
  formId: string
  agentId: string
  completedAt: string
  responses?: Record<string, any>
}

export class FormCompletionTracker {
  private listeners: Map<string, (event: FormCompletionEvent) => void> = new Map()

  // Check if we can use postMessage to communicate with Google Forms iframe
  initializeFormTracking(formId: string, agentId: string, formUrl: string) {
    // Create a unique identifier for this form session
    const sessionId = `${formId}_${agentId}_${Date.now()}`
    
    // Listen for messages from Google Forms
    const messageHandler = (event: MessageEvent) => {
      // Verify the origin is from Google
      if (!event.origin.includes('docs.google.com')) return
      
      try {
        const data = event.data
        
        // Check if this is a form submission completion event
        if (data && typeof data === 'object' && data.type === 'form_submission_complete') {
          const completionEvent: FormCompletionEvent = {
            formId,
            agentId,
            completedAt: new Date().toISOString(),
            responses: data.responses || {}
          }
          
          this.notifyCompletion(sessionId, completionEvent)
        }
      } catch (error) {
        console.error('Error processing form completion message:', error)
      }
    }
    
    window.addEventListener('message', messageHandler)
    
    // Return cleanup function
    return () => {
      window.removeEventListener('message', messageHandler)
      this.listeners.delete(sessionId)
    }
  }

  // Alternative method: Use URL monitoring for forms opened in new tabs
  monitorFormCompletion(formId: string, agentId: string, formUrl: string): () => void {
    const sessionId = `${formId}_${agentId}_${Date.now()}`
    
    // Extract the form ID from Google Forms URL
    const formMatch = formUrl.match(/\/forms\/d\/([a-zA-Z0-9-_]+)/)
    if (!formMatch) {
      console.error('Could not extract form ID from URL:', formUrl)
      return () => {}
    }
    
    const googleFormId = formMatch[1]
    
    // Monitor for form completion using storage events
    const storageHandler = (event: StorageEvent) => {
      if (event.key === `form_completion_${googleFormId}`) {
        const completionData = event.newValue
        if (completionData) {
          try {
            const data = JSON.parse(completionData)
            const completionEvent: FormCompletionEvent = {
              formId,
              agentId,
              completedAt: new Date().toISOString(),
              responses: data.responses || {}
            }
            
            this.notifyCompletion(sessionId, completionEvent)
          } catch (error) {
            console.error('Error parsing completion data:', error)
          }
        }
      }
    }
    
    window.addEventListener('storage', storageHandler)
    
    return () => {
      window.removeEventListener('storage', storageHandler)
      this.listeners.delete(sessionId)
    }
  }

  private notifyCompletion(sessionId: string, event: FormCompletionEvent) {
    const listener = this.listeners.get(sessionId)
    if (listener) {
      listener(event)
    }
  }

  // Register a completion listener
  onFormCompletion(sessionId: string, callback: (event: FormCompletionEvent) => void) {
    this.listeners.set(sessionId, callback)
  }

  // Manual completion trigger (for cases where automatic detection fails)
  triggerManualCompletion(formId: string, agentId: string, responses?: Record<string, any>) {
    const completionEvent: FormCompletionEvent = {
      formId,
      agentId,
      completedAt: new Date().toISOString(),
      responses: responses || {}
    }
    
    // Notify all relevant listeners
    this.listeners.forEach((listener, sessionId) => {
      if (sessionId.startsWith(`${formId}_${agentId}`)) {
        listener(completionEvent)
      }
    })
  }

  // Inject script into Google Forms to detect completion
  injectCompletionDetector(formId: string, agentId: string): string {
    return `
      (function() {
        const formId = '${formId}';
        const agentId = '${agentId}';
        
        // Monitor form submissions
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
          form.addEventListener('submit', function(e) {
            setTimeout(() => {
              // Check if we're on the thank you page or if form shows completion
              const thankYouElement = document.querySelector('[data-response="Thank you"]') || 
                                    document.querySelector('div[role="main"] div:contains("תגובתך נרשמה")') ||
                                    document.querySelector('.freebirdFormviewerViewResponseConfirmationMessage');
              
              if (thankYouElement) {
                // Form was completed, notify parent window
                const completionData = {
                  type: 'form_submission_complete',
                  formId: formId,
                  agentId: agentId,
                  timestamp: new Date().toISOString(),
                  responses: extractFormData()
                };
                
                // Try to post message to parent window
                try {
                  window.parent.postMessage(completionData, '*');
                  localStorage.setItem('form_completion_' + formId, JSON.stringify(completionData));
                } catch (error) {
                  console.error('Could not notify form completion:', error);
                }
              }
            }, 1000);
          });
        });
        
        function extractFormData() {
          const data = {};
          const inputs = document.querySelectorAll('input, textarea, select');
          inputs.forEach(input => {
            if (input.name && input.value) {
              data[input.name] = input.value;
            }
          });
          return data;
        }
        
        // Also check for URL changes (SPA behavior)
        let currentUrl = window.location.href;
        setInterval(() => {
          if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            if (currentUrl.includes('formResponse')) {
              // Form response page detected
              const completionData = {
                type: 'form_submission_complete',
                formId: formId,
                agentId: agentId,
                timestamp: new Date().toISOString()
              };
              
              try {
                window.parent.postMessage(completionData, '*');
                localStorage.setItem('form_completion_' + formId, JSON.stringify(completionData));
              } catch (error) {
                console.error('Could not notify form completion:', error);
              }
            }
          }
        }, 1000);
      })();
    `
  }
}

export const formCompletionTracker = new FormCompletionTracker()