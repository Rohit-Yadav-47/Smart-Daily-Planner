(function() {
  let notificationElement = null;
  let currentEvent = null;
  let updateTimer = null;
  let dismissedEvents = {};
  let checkInterval = null;
  let isContextValid = true; // Track if extension context is valid
  
  console.log("Event notification content script loaded");
  
  // Initialize when the script loads
  initialize();
  
  function initialize() {
    try {
      // Gracefully handle extension context invalidation
      window.addEventListener('error', function(event) {
        if (event.message && event.message.includes('Extension context invalidated')) {
          cleanupExtensionContext();
        }
      });
      
      // Safely check if chrome runtime is still valid
      if (!isChromeRuntimeAvailable()) {
        console.log("Chrome runtime not available during initialization");
        return;
      }

      // Safely load dismissed events
      safeExecute(() => {
        chrome.storage.local.get(['dismissedEvents'], result => {
          safeExecute(() => {
            if (result && result.dismissedEvents) {
              dismissedEvents = result.dismissedEvents;
            }
            
            // Check for active events immediately
            checkForActiveEvents();
            
            // Set up periodic checks
            checkInterval = setInterval(() => {
              if (isContextValid) {
                checkForActiveEvents();
              } else {
                clearInterval(checkInterval);
              }
            }, 30000); // Check every 30 seconds
            
            // Also listen for direct notifications from the background script
            chrome.runtime.onMessage.addListener(handleMessage);
            
            // Set up visibility change listener (safer than unload)
            setupVisibilityHandler();
          });
        });
      });
    } catch (error) {
      console.error("Error during initialization:", error);
    }
  }
  
  function setupVisibilityHandler() {
    // Use visibility change instead of unload/beforeunload which are restricted by permissions policy
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        // When tab becomes hidden, clean up resources but don't rely on storage
        cleanupResourcesWithoutStorage();
      }
    });
    
    // Handle page unload without using the unload event
    // We'll rely on the browser to clean up resources
    // This avoids "Permissions policy violation: unload is not allowed in this document"
  }
  
  function cleanupResourcesWithoutStorage() {
    // Clean up timers and UI elements without trying to save state
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    if (updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
    removeAllNotifications();
  }
  
  function cleanupResources() {
    cleanupResourcesWithoutStorage();
    // Any additional cleanup that requires storage would go here
    // but we'll avoid that to prevent context invalidation issues
  }
  
  function cleanupExtensionContext() {
    console.log("Extension context invalidated, cleaning up resources");
    isContextValid = false;
    cleanupResourcesWithoutStorage();
    
    // Safely remove message listener if possible
    try {
      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
    } catch (e) {
      // Already invalidated, no need to do anything
      console.log("Could not remove message listener, context already invalid");
    }
  }
  
  function handleMessage(request, sender, sendResponse) {
    if (!isContextValid) return false;
    
    safeExecute(() => {
      console.log("Notification content script received message:", request.action);
      
      if (request.action === 'checkEvents') {
        checkForActiveEvents();
      }
      
      if (request.action === 'showEvents' && request.events) {
        processEvents(request.events);
      }
      
      return false;
    });
  }
  
  function isChromeRuntimeAvailable() {
    try {
      return chrome && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      isContextValid = false;
      return false;
    }
  }
  
  function safeExecute(callback) {
    if (!isContextValid) return;
    
    try {
      // Double-check runtime availability before executing
      if (chrome && chrome.runtime && chrome.runtime.id) {
        callback();
      }
    } catch (err) {
      console.log("Error in safe execute:", err);
      if (err.message && err.message.includes('Extension context invalidated')) {
        cleanupExtensionContext();
      }
    }
  }
  
  function checkForActiveEvents() {
    if (!isContextValid) return;
    
    safeExecute(() => {
      console.log("Checking for active events");
      chrome.runtime.sendMessage({ action: 'getCurrentEvents' }, function(response) {
        safeExecute(() => {
          if (chrome.runtime.lastError) {
            console.error("Error getting events:", chrome.runtime.lastError);
            return;
          }
          
          if (response && response.success && response.events && response.events.length > 0) {
            console.log("Received events:", response.events.length);
            processEvents(response.events);
          } else {
            console.log("No events found or error:", response);
            removeAllNotifications();
          }
        });
      });
    });
  }
  
  function processEvents(events) {
    if (!isContextValid || !events) return;
    
    try {
      // Find the nearest active event that hasn't been dismissed
      const activeEvent = findActiveEvent(events);
      
      if (activeEvent) {
        console.log("Found active/upcoming event:", activeEvent.summary);
        
        const now = new Date();
        const startTime = new Date(activeEvent.start.dateTime || activeEvent.start.date);
        const timeUntilStart = startTime - now;
        
        // Decide which notification type to show
        if (now >= startTime) {
          // Event is happening now - show mini notification
          showMiniNotification(activeEvent, false);
        } else if (timeUntilStart <= 5 * 60 * 1000) {
          // Event starts in 5 minutes or less - show mini notification with urgency
          showMiniNotification(activeEvent, true);
        } else if (!notificationElement && timeUntilStart <= 15 * 60 * 1000) {
          // Event starts between 5 and 15 minutes - show full notification
          showEventNotification(activeEvent);
        }
      } else {
        // No active events, remove all notifications
        removeAllNotifications();
      }
    } catch (err) {
      console.log("Error processing events:", err);
      removeAllNotifications();
    }
  }

  function findActiveEvent(events) {
    const now = new Date();
    
    // Sort events by start time
    const sortedEvents = events.sort((a, b) => {
      return new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date);
    });
    
    let upcomingEvent = null;
    let currentEvent = null;
    
    // Find events that are happening now or starting soon
    for (let event of sortedEvents) {
      const eventId = event.id;
      const startTime = new Date(event.start.dateTime || event.start.date);
      const endTime = new Date(event.end.dateTime || event.end.date);
      
      // Skip dismissed events
      if (dismissedEvents[eventId]) {
        continue;
      }
      
      // Check if event is happening now
      if (now >= startTime && now < endTime) {
        currentEvent = event;
        break; // Current events take priority
      }
      
      // Find the next upcoming event (within 15 minutes)
      const timeUntilStart = startTime - now;
      if (now < startTime && timeUntilStart < 15 * 60 * 1000) {
        if (!upcomingEvent) {
          upcomingEvent = event;
        }
      }
    }
    
    // Return current event if exists, otherwise upcoming event
    return currentEvent || upcomingEvent;
  }
  
  function showEventNotification(event) {
    console.log("Showing notification for event:", event.summary);
    
    // Remove any existing notification
    removeFullNotification();
    
    // Create new notification element
    notificationElement = document.createElement('div');
    notificationElement.className = 'daily-planner-notification';
    
    const startTime = new Date(event.start.dateTime || event.start.date);
    const endTime = new Date(event.end.dateTime || event.end.date);
    const isAllDay = !event.start.dateTime;
    
    const formattedStart = startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const formattedEnd = endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const timeString = isAllDay ? 'All Day' : `${formattedStart} - ${formattedEnd}`;
    
    // Create a simpler, more compact notification
    notificationElement.innerHTML = `
      <div class="notification-header">
        <div class="notification-title">
          <i class="fas fa-calendar-alt"></i> Reminder
        </div>
        <button class="notification-close" title="Close">×</button>
      </div>
      <div class="notification-body">
        <div class="event-title">${event.summary}</div>
        <div class="event-time"><i class="fas fa-clock"></i> ${timeString}</div>
        ${event.location ? `<div class="event-location"><i class="fas fa-map-marker-alt"></i> ${event.location}</div>` : ''}
        <div class="event-countdown" id="event-countdown"></div>
      </div>
      <div class="notification-actions">
        <button class="notification-btn secondary" id="dismiss-event">Dismiss</button>
        <button class="notification-btn primary" id="view-details">Details</button>
      </div>
    `;
    
    // Add notification to page
    document.body.appendChild(notificationElement);
    
    // Set up event listeners
    notificationElement.querySelector('.notification-close').addEventListener('click', function() {
      dismissNotification();
    });
    
    notificationElement.querySelector('#dismiss-event').addEventListener('click', function() {
      dismissEvent(event.id);
    });
    
    notificationElement.querySelector('#view-details').addEventListener('click', function() {
      chrome.runtime.sendMessage({ action: 'openCalendarEvent', eventId: event.id });
    });
    
    // Load font awesome if not already loaded
    if (!document.querySelector('link[href*="font-awesome"]')) {
      const fontAwesome = document.createElement('link');
      fontAwesome.rel = 'stylesheet';
      fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
      document.head.appendChild(fontAwesome);
    }
    
    // Start countdown timer
    updateCountdown(event);
    updateTimer = setInterval(function() {
      updateCountdown(event);
    }, 1000);
    
    // Auto-hide notification after 30 seconds if not interacted with
    const autoHideTimeout = setTimeout(() => {
      if (notificationElement) {
        dismissNotification();
      }
    }, 30000);
    
    // Reset auto-hide on hover
    notificationElement.addEventListener('mouseenter', () => {
      clearTimeout(autoHideTimeout);
    });
  }
  
  function showMiniNotification(event, isUrgent) {
    // Remove full notification if it exists
    removeFullNotification();
    
    // Check if mini notification already exists
    let miniNotification = document.getElementById('mini-event-notification');
    
    if (!miniNotification) {
      // Create new mini notification
      miniNotification = document.createElement('div');
      miniNotification.id = 'mini-event-notification';
      miniNotification.className = `mini-event-notification ${isUrgent ? 'urgent' : 'default'}`;
      
      // Create content
      miniNotification.innerHTML = `
        <div class="mini-event-title">
          ${event.summary}
          <span class="mini-close" title="Dismiss">×</span>
        </div>
        <div class="mini-event-time" id="mini-event-time"></div>
      `;
      
      // Add to page
      document.body.appendChild(miniNotification);
      
      // Add event listener to close button
      miniNotification.querySelector('.mini-close').addEventListener('click', function() {
        dismissEvent(event.id);
      });
    } else {
      // Update existing notification
      miniNotification.className = `mini-event-notification ${isUrgent ? 'urgent' : 'default'}`;
      miniNotification.querySelector('.mini-event-title').textContent = event.summary;
    }
    
    // Store the current event
    currentEvent = event;
    
    // Start/update timer
    updateMiniTimer(event);
    if (updateTimer) clearInterval(updateTimer);
    updateTimer = setInterval(() => updateMiniTimer(event), 1000);
  }
  
  function updateMiniTimer(event) {
    const miniTimeElement = document.getElementById('mini-event-time');
    if (!miniTimeElement) return;
    
    const now = new Date();
    const startTime = new Date(event.start.dateTime || event.start.date);
    const endTime = new Date(event.end.dateTime || event.end.date);
    
    if (now < startTime) {
      // Event hasn't started
      const diff = startTime - now;
      miniTimeElement.textContent = `Starts in ${formatCompactTime(diff)}`;
    } else if (now < endTime) {
      // Event in progress
      const diff = endTime - now;
      miniTimeElement.textContent = `Ends in ${formatCompactTime(diff)}`;
    } else {
      // Event ended
      miniTimeElement.textContent = 'Event ended';
      setTimeout(() => removeAllNotifications(), 10000); // Remove after 10 seconds
    }
  }
  
  // Add a smoother dismissal animation
  function dismissNotification() {
    if (!notificationElement) return;
    
    notificationElement.classList.add('hiding');
    
    setTimeout(() => {
      removeFullNotification();
    }, 300); // Match the CSS animation duration
  }
  
  // Update updateCountdown to be more concise
  function updateCountdown(event) {
    if (!notificationElement) return;
    
    const countdownElement = notificationElement.querySelector('#event-countdown');
    if (!countdownElement) return;
    
    const now = new Date();
    const startTime = new Date(event.start.dateTime || event.start.date);
    const endTime = new Date(event.end.dateTime || event.end.date);
    
    let countdownText = '';
    
    if (now < startTime) {
      // Event hasn't started yet
      const diff = startTime - now;
      // More concise countdown
      countdownText = `Starts in ${formatTimeRemaining(diff, true)}`;
    } else if (now < endTime) {
      // Event is ongoing
      const diff = endTime - now;
      countdownText = `Ends in ${formatTimeRemaining(diff, true)}`;
    } else {
      // Event has ended
      countdownText = 'Event ended';
      clearInterval(updateTimer);
      
      // Auto-dismiss notification after event ends
      setTimeout(dismissNotification, 5000);
    }
    
    countdownElement.textContent = countdownText;
  }
  
  // More concise time formatting
  function formatTimeRemaining(milliseconds, concise = false) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (concise) {
      // For more concise display
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    } else {
      // Original format
      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    }
  }
  
  function formatCompactTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  // Make all chrome API calls more robust
  function dismissEvent(eventId) {
    if (!isContextValid) return;
    
    safeExecute(() => {
      dismissedEvents[eventId] = true;
      
      // Save to storage
      chrome.storage.local.set({ dismissedEvents: dismissedEvents })
        .catch(err => console.log("Error saving dismissed events:", err));
      
      // Remove notification
      removeAllNotifications();
    });
  }
  
  function removeAllNotifications() {
    try {
      removeFullNotification();
      removeMiniNotification();
    } catch (err) {
      console.log("Error removing notifications:", err);
    }
  }
  
  function removeFullNotification() {
    if (notificationElement && notificationElement.parentNode) {
      notificationElement.parentNode.removeChild(notificationElement);
      notificationElement = null;
    }
  }
  
  function removeMiniNotification() {
    const miniNotification = document.getElementById('mini-event-notification');
    if (miniNotification && miniNotification.parentNode) {
      miniNotification.parentNode.removeChild(miniNotification);
    }
    
    if (updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
  }
})();
