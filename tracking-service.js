class TrackingService {
  constructor() {
    this.isTracking = false;
    this.currentSite = null;
    this.startTime = null;
    this.trackingData = {};
    
    // Load previous tracking data from storage
    this.loadTrackingData();
    
    // Check if tracking was active when popup closed
    chrome.storage.local.get(['isTracking'], (result) => {
      if (result.isTracking) {
        this.startTracking();
      }
    });
    
    // Set up tab tracking
    this.setupTracking();
    
    // Reset tracking data at midnight
    this.setupDailyReset();
  }
  
  setupTracking() {
    // Track active tab changes
    chrome.tabs.onActivated.addListener(this.handleTabChange.bind(this));
    
    // Track URL changes within tabs
    if (chrome.webNavigation) {
      chrome.webNavigation.onCompleted.addListener(this.handleNavigation.bind(this));
    }
    
    // Track tab updates (like when user refreshes the page)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && this.isTracking) {
        this.recordTimeForCurrentSite();
        this.updateCurrentSite(changeInfo.url);
      }
    });
  }
  
  loadTrackingData() {
    chrome.storage.local.get(['trackingData', 'isTracking'], (result) => {
      if (result.trackingData) {
        this.trackingData = result.trackingData;
      }
      
      if (result.isTracking) {
        this.isTracking = result.isTracking;
        
        // If tracking was active, get current tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].url) {
            this.updateCurrentSite(tabs[0].url);
          }
        });
      }
    });
  }
  
  saveTrackingData() {
    chrome.storage.local.set({
      trackingData: this.trackingData,
      isTracking: this.isTracking
    });
  }
  
  startTracking() {
    console.log("Starting tracking service");
    this.isTracking = true;
    
    // Get the current tab to start tracking
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        this.updateCurrentSite(tabs[0].url);
      }
    });
    
    this.saveTrackingData();
    return { success: true };
  }
  
  stopTracking() {
    console.log("Stopping tracking service");
    // Record time for current site before stopping
    this.recordTimeForCurrentSite();
    
    this.isTracking = false;
    this.currentSite = null;
    this.startTime = null;
    
    this.saveTrackingData();
    return { success: true };
  }
  
  getTrackingStats() {
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
  }
  
  handleTabChange(activeInfo) {
    if (!this.isTracking) return;
    
    // Record time for previous site
    this.recordTimeForCurrentSite();
    
    // Update for new tab
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (tab && tab.url) {
        this.updateCurrentSite(tab.url);
      }
    });
  }
  
  handleNavigation(details) {
    if (!this.isTracking || details.frameId !== 0) return;
    
    // Only track main frame navigation
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id === details.tabId) {
        // Record time for previous site
        this.recordTimeForCurrentSite();
        
        // Update for new URL
        this.updateCurrentSite(details.url);
      }
    });
  }
  
  updateCurrentSite(url) {
    try {
      // Skip about:, chrome:, etc.
      if (!url || url.startsWith('chrome') || url.startsWith('about')) {
        this.currentSite = null;
        this.startTime = null;
        return;
      }
      
      const domain = new URL(url).hostname;
      console.log("Now tracking:", domain);
      this.currentSite = domain;
      this.startTime = Date.now();
      
      // Initialize domain if not already tracked
      if (!this.trackingData[domain]) {
        this.trackingData[domain] = 0;
      }
    } catch (e) {
      console.error('Error parsing URL:', e, url);
      this.currentSite = null;
      this.startTime = null;
    }
  }
  
  recordTimeForCurrentSite() {
    if (!this.currentSite || !this.startTime) return;
    
    const timeSpent = Math.floor((Date.now() - this.startTime) / 1000); // Time in seconds
    
    if (timeSpent > 0) {
      this.trackingData[this.currentSite] = (this.trackingData[this.currentSite] || 0) + timeSpent;
      console.log("Recorded", timeSpent, "seconds for", this.currentSite);
      this.saveTrackingData();
    }
  }
  
  setupDailyReset() {
    // Calculate time until midnight
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    
    const timeUntilMidnight = midnight - now;
    
    // Set timeout to reset at midnight
    setTimeout(() => {
      this.resetTrackingData();
      // Set up next day's reset
      this.setupDailyReset();
    }, timeUntilMidnight);
  }
  
  resetTrackingData() {
    console.log("Resetting tracking data at midnight");
    this.trackingData = {};
    this.saveTrackingData();
  }
}

// Create the tracking service
window.trackingService = new TrackingService();
console.log("Tracking service initialized");
