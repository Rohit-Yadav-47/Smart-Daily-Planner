// Google Calendar API endpoint
const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3';

// Tracking service
let trackingService;

// Add these variables at the top with other globals
let blockedSites = [];
let blockerEnabled = false;

// Add this variable to track rule IDs
let maxRuleId = 100; // Start with a higher number to avoid conflicts

// Handle extension installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('Daily Planner Calendar Integration installed');
  
  // Initialize tracking service
  initTrackingService();
  
  // Initialize website blocker
  initializeBlocker();
});

// Initialize tracking service on background script startup
initTrackingService();

// Initialize tracking service
function initTrackingService() {
  if (!trackingService) {
    trackingService = {
      isTracking: false,
      currentSite: null,
      startTime: null,
      trackingData: {},
      
      startTracking: function() {
        this.isTracking = true;
        
        // Get the current tab to start tracking
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            this.updateCurrentSite(tabs[0].url);
          }
        });
        
        // Save state
        chrome.storage.local.set({ 
          isTracking: true,
          trackingData: this.trackingData
        });
        
        return { success: true };
      },
      
      stopTracking: function() {
        // Record time for current site before stopping
        this.recordTimeForCurrentSite();
        
        this.isTracking = false;
        this.currentSite = null;
        this.startTime = null;
        
        // Save state
        chrome.storage.local.set({ isTracking: false });
        
        return { success: true };
      },
      
      getTrackingStats: function() {
        // Record time for current site to get up-to-date stats
        if (this.isTracking && this.currentSite) {
          this.recordTimeForCurrentSite();
          this.startTime = Date.now(); // Reset start time for current site
        }
        
        return { 
          success: true,
          stats: this.trackingData,
          isActive: this.isTracking
        };
      },
      
      updateCurrentSite: function(url) {
        try {
          if (!url || url.startsWith('chrome') || url.startsWith('about')) {
            this.currentSite = null;
            this.startTime = null;
            return;
          }
          
          const domain = new URL(url).hostname;
          this.currentSite = domain;
          this.startTime = Date.now();
          
          if (!this.trackingData[domain]) {
            this.trackingData[domain] = 0;
          }
        } catch (e) {
          console.error('Error parsing URL:', e);
          this.currentSite = null;
          this.startTime = null;
        }
      },
      
      recordTimeForCurrentSite: function() {
        if (!this.currentSite || !this.startTime) return;
        
        const timeSpent = Math.floor((Date.now() - this.startTime) / 1000);
        
        if (timeSpent > 0) {
          this.trackingData[this.currentSite] = (this.trackingData[this.currentSite] || 0) + timeSpent;
          
          // Save updated tracking data
          chrome.storage.local.set({ trackingData: this.trackingData });
        }
      }
    };
    
    // Load previous tracking data
    chrome.storage.local.get(['trackingData', 'isTracking'], (result) => {
      if (result.trackingData) {
        trackingService.trackingData = result.trackingData;
      }
      
      if (result.isTracking) {
        trackingService.isTracking = result.isTracking;
        
        // Continue tracking current tab if tracking was active
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            trackingService.updateCurrentSite(tabs[0].url);
          }
        });
      }
    });
    
    // Improved tab tracking
    chrome.tabs.onActivated.addListener((activeInfo) => {
      if (!trackingService.isTracking) return;
      
      console.log("Tab activated:", activeInfo.tabId);
      
      // Record time for previous site
      trackingService.recordTimeForCurrentSite();
      
      // Update for new tab
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.url) {
          console.log("Tracking new tab:", tab.url);
          trackingService.updateCurrentSite(tab.url);
        }
      });
    });
    
    // Track URL changes in active tab
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && trackingService.isTracking) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].id === tabId) {
            console.log("URL updated in active tab:", changeInfo.url);
            trackingService.recordTimeForCurrentSite();
            trackingService.updateCurrentSite(changeInfo.url);
          }
        });
      }
    });
    
    // Load previous state
    chrome.storage.local.get(['trackingData', 'isTracking'], (result) => {
      if (result.trackingData) {
        trackingService.trackingData = result.trackingData;
      }
      
      if (result.isTracking) {
        trackingService.isTracking = true;
        console.log("Resuming tracking session");
        
        // Try to get the active tab to start tracking
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].url) {
            trackingService.updateCurrentSite(tabs[0].url);
          }
        });
      }
    });
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch(request.action) {
    // Existing calendar actions
    case 'authenticate':
      authenticate(sendResponse);
      return true;
    
    case 'validateToken':
      validateToken(sendResponse);
      return true;
      
    case 'addEvent':
      addEventToCalendar(request.event, sendResponse);
      return true;
    
    case 'getEvents':
      getEvents(request.timeMin, request.timeMax, sendResponse);
      return true;
      
    // New tracking actions
    case 'startTracking':
      try {
        if (!trackingService) initTrackingService();
        console.log("Starting tracking service from message");
        const response = trackingService.startTracking();
        sendResponse(response);
      } catch (e) {
        console.error("Error starting tracking:", e);
        sendResponse({ success: false, error: e.message });
      }
      return false;
      
    case 'stopTracking':
      try {
        if (!trackingService) initTrackingService();
        const response = trackingService.stopTracking();
        sendResponse(response);
      } catch (e) {
        console.error("Error stopping tracking:", e);
        sendResponse({ success: false, error: e.message });
      }
      return false;
      
    case 'getTrackingStats':
      try {
        if (!trackingService) initTrackingService();
        const response = trackingService.getTrackingStats();
        sendResponse(response);
      } catch (e) {
        console.error("Error getting tracking stats:", e);
        sendResponse({ success: false, error: e.message });
      }
      return false;

    case 'clearTrackingData':
      try {
        if (!trackingService) initTrackingService();
        trackingService.trackingData = {};
        chrome.storage.local.set({ trackingData: {} });
        console.log("Tracking data cleared");
        sendResponse({ success: true });
      } catch (e) {
        console.error("Error clearing tracking data:", e);
        sendResponse({ success: false, error: e.message });
      }
      return false;
    
    // Add these new cases to the message handler
    case 'deleteEvent':
      deleteEventFromCalendar(request.eventId, sendResponse);
      return true;
    
    case 'updateBlockRules':
      updateBlockRules();
      sendResponse({ success: true });
      return false;
    
    case 'toggleBlocker':
      blockerEnabled = request.enabled;
      updateBlockRules();
      sendResponse({ success: true });
      return false;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

// Authenticate with Google Calendar
function authenticate(sendResponse) {
  chrome.identity.getAuthToken({ interactive: true }, function(token) {
    if (chrome.runtime.lastError) {
      sendResponse({ 
        success: false, 
        error: chrome.runtime.lastError.message 
      });
      return;
    }
    
    // Store token
    chrome.storage.local.set({ token: token }, function() {
      sendResponse({ success: true });
    });
  });
}

// Validate stored token
function validateToken(sendResponse) {
  chrome.storage.local.get(['token'], function(result) {
    if (!result.token) {
      sendResponse({ valid: false });
      return;
    }
    
    // Make a test API call to check if the token is valid
    fetch(`${CALENDAR_API_URL}/users/me/calendarList`, {
      headers: {
        'Authorization': 'Bearer ' + result.token
      }
    })
    .then(response => {
      if (response.ok) {
        sendResponse({ valid: true });
      } else {
        // Token is invalid, remove it
        chrome.storage.local.remove(['token']);
        sendResponse({ valid: false });
      }
    })
    .catch(error => {
      console.error('Error validating token:', error);
      sendResponse({ valid: false });
    });
  });
}

// Add event to Google Calendar
function addEventToCalendar(event, sendResponse) {
  chrome.storage.local.get(['token'], function(result) {
    if (!result.token) {
      sendResponse({ 
        success: false, 
        error: 'Not authenticated. Please connect to Google Calendar first.' 
      });
      return;
    }
    
    fetch(`${CALENDAR_API_URL}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + result.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to add event');
      }
      return response.json();
    })
    .then(data => {
      sendResponse({
        success: true,
        link: data.htmlLink
      });
    })
    .catch(error => {
      console.error('Error adding event:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    });
  });
}

// Get events from Google Calendar
function getEvents(timeMin, timeMax, sendResponse) {
  chrome.storage.local.get(['token'], function(result) {
    if (!result.token) {
      sendResponse({ 
        success: false, 
        error: 'Not authenticated. Please connect to Google Calendar first.' 
      });
      return;
    }
    
    const params = new URLSearchParams({
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      maxResults: 50 // Reasonable limit for a day
    });
    
    fetch(`${CALENDAR_API_URL}/calendars/primary/events?${params.toString()}`, {
      headers: {
        'Authorization': 'Bearer ' + result.token
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    })
    .then(data => {
      sendResponse({
        success: true,
        events: data.items || []
      });
    })
    .catch(error => {
      console.error('Error fetching events:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    });
  });
}

// Add these functions to handle event notifications

// Add or modify these functions to fix event notifications
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // ...existing code...
  
  if (request.action === 'getCurrentEvents') {
    console.log("Received getCurrentEvents request");
    getCurrentEvents(sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'openCalendarEvent') {
    openCalendarEvent(request.eventId);
    return false;
  }
  
  // ...existing code...
});

// Get current and upcoming events
function getCurrentEvents(sendResponse) {
  console.log("Getting current events");
  chrome.storage.local.get(['token'], function(result) {
    if (!result.token) {
      console.log("No auth token found");
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }
    
    // Get events for today plus a small buffer
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1); // Look ahead by one day
    
    // Format times for API
    const timeMin = now.toISOString();
    const timeMax = tomorrow.toISOString();
    
    const params = new URLSearchParams({
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      maxResults: 10, // Focus on immediate events
      orderBy: 'startTime' // Ensure events are sorted by start time
    });
    
    console.log("Fetching calendar events");
    fetch(`${CALENDAR_API_URL}/calendars/primary/events?${params.toString()}`, {
      headers: {
        'Authorization': 'Bearer ' + result.token
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    })
    .then(data => {
      console.log("Calendar events fetched successfully:", data.items?.length);
      sendResponse({
        success: true,
        events: data.items || []
      });
    })
    .catch(error => {
      console.error('Error fetching events:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    });
  });
}

// Open calendar event in a new tab
function openCalendarEvent(eventId) {
  chrome.storage.local.get(['token'], function(result) {
    if (!result.token) return;
    
    // First get the event to get its htmlLink
    fetch(`${CALENDAR_API_URL}/calendars/primary/events/${eventId}`, {
      headers: {
        'Authorization': 'Bearer ' + result.token
      }
    })
    .then(response => response.json())
    .then(event => {
      if (event.htmlLink) {
        chrome.tabs.create({ url: event.htmlLink });
      }
    })
    .catch(error => {
      console.error('Error opening event:', error);
    });
  });
}

// Proactively notify tabs about events
function notifyTabsAboutEvents() {
  console.log("Checking for events to notify tabs");
  getCurrentEvents(function(response) {
    if (response.success && response.events && response.events.length > 0) {
      console.log("Found events, notifying tabs");
      chrome.tabs.query({}, function(tabs) {
        tabs.forEach(tab => {
          // Ignore chrome:// and edge:// URLs which can't run content scripts
          if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
            chrome.tabs.sendMessage(tab.id, { 
              action: 'showEvents',
              events: response.events
            }).catch(err => console.log("Tab not ready:", tab.id));
          }
        });
      });
    }
  });
}

// Check for events more frequently
chrome.alarms.create('checkUpcomingEvents', {
  periodInMinutes: 0.5 // Check every 30 seconds
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'checkUpcomingEvents') {
    notifyTabsAboutEvents();
  }
});

// Initial check when extension loads
setTimeout(notifyTabsAboutEvents, 5000); // Wait 5 seconds after startup

// Add these functions for event deletion
function deleteEventFromCalendar(eventId, sendResponse) {
  chrome.storage.local.get(['token'], function(result) {
    if (!result.token) {
      sendResponse({ 
        success: false, 
        error: 'Not authenticated. Please connect to Google Calendar first.' 
      });
      return;
    }
    
    fetch(`${CALENDAR_API_URL}/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + result.token
      }
    })
    .then(response => {
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Event not found');
        }
        throw new Error('Failed to delete event');
      }
      
      sendResponse({
        success: true
      });
    })
    .catch(error => {
      console.error('Error deleting event:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    });
  });
}

// Add these functions for website blocking
function initializeBlocker() {
  chrome.storage.local.get(['blockedSites', 'blockerEnabled'], function(result) {
    blockedSites = result.blockedSites || [];
    blockerEnabled = result.blockerEnabled === true;
    
    if (blockerEnabled && blockedSites.length > 0) {
      setupBlockingRules();
    }
  });
}

// Update the setupBlockingRules function
function setupBlockingRules() {
  try {
    // Check if the declarativeNetRequest API is available
    if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
      // Get existing rules
      chrome.declarativeNetRequest.getDynamicRules().then(currentRules => {
        const ruleIdsToRemove = currentRules.map(rule => rule.id);
        
        // If blockerEnabled is false or no sites to block, just clear rules and return
        if (!blockerEnabled || blockedSites.length === 0) {
          chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ruleIdsToRemove,
            addRules: []
          }).then(() => {
            console.log("Blocking disabled or no sites to block. All rules removed.");
          }).catch(err => {
            console.error("Error clearing block rules:", err);
          });
          return;
        }
        
        // Create new rules for currently blocked sites
        const newRules = blockedSites.map((site, index) => ({
          id: index + 1,
          priority: 1,
          action: { type: 'block' },
          condition: {
            urlFilter: `||${site}^`,
            resourceTypes: ['main_frame']
          }
        }));
        
        // Update rules: remove all existing ones and add new ones
        chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove,
          addRules: newRules
        }).then(() => {
          console.log(`Blocking rules updated. Active: ${blockerEnabled}, Sites: ${blockedSites.length}`);
          // Force refresh any tabs with blocked sites that are now unblocked
          refreshBlockedTabs();
        }).catch(err => {
          console.error("Error updating block rules:", err);
        });
      }).catch(err => {
        console.error("Error getting current rules:", err);
      });
    } else {
      console.log("declarativeNetRequest API not available, using alternative blocking method");
      
      // Use a different approach to block sites
      if (blockerEnabled && blockedSites.length > 0) {
        // Set up a blocking webRequest listener for matches
        if (chrome.tabs && chrome.tabs.onUpdated) {
          // We'll monitor tab updates instead
          refreshAllTabs();
        }
      }
    }
  } catch (error) {
    console.error("Error in setupBlockingRules:", error);
  }
}

// Add a function to redirect blocked sites
function refreshAllTabs() {
  if (!blockerEnabled || blockedSites.length === 0) return;
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      try {
        if (!tab.url) return;
        
        const tabUrl = new URL(tab.url);
        const tabDomain = tabUrl.hostname;
        
        // Check if the current URL is blocked
        const isBlocked = blockedSites.some(site => 
          tabDomain === site || tabDomain.endsWith(`.${site}`)
        );
        
        if (isBlocked) {
          // Redirect to a blocked page or chrome://blocked
          chrome.tabs.update(tab.id, {
            url: chrome.runtime.getURL("blocked.html") || "chrome://newtab"
          }).catch(err => console.error("Failed to redirect blocked tab:", err));
        }
      } catch (e) {
        console.error("Error processing tab URL:", e);
      }
    });
  });
}

// Add this function to refresh tabs when unblocking sites
function refreshBlockedTabs() {
  // Only process if we have previously blocked sites that might need refreshing
  if (blockedSites.length > 0) {
    // Get all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          if (!tab.url) return;
          
          const tabDomain = new URL(tab.url).hostname;
          
          // If this tab domain is in our blockedSites list
          // and blocker is now disabled or the site has been removed
          if (tabDomain && 
              (!blockerEnabled || !blockedSites.some(site => tabDomain.includes(site)))) {
            // Reload the tab to remove the block
            chrome.tabs.reload(tab.id);
            console.log("Refreshing previously blocked tab:", tabDomain);
          }
        } catch (e) {
          console.error("Error processing tab URL:", e);
        }
      });
    });
  }
}

// Update updateBlockRules function to be more explicit
function updateBlockRules() {
  chrome.storage.local.get(['blockedSites', 'blockerEnabled'], function(result) {
    blockedSites = result.blockedSites || [];
    blockerEnabled = result.blockerEnabled === true;
    
    // Log for debugging
    console.log("Updating block rules. Enabled:", blockerEnabled, "Sites:", blockedSites);
    
    // Update the rules
    setupBlockingRules();
  });
}
