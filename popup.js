document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const authorizeButton = document.getElementById('authorize-button');
  const authStatus = document.getElementById('auth-status');
  const contentArea = document.getElementById('content-area');
  const addEventButton = document.getElementById('add-event-button');
  const resultMessage = document.getElementById('result-message');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Chat elements
  const chatInput = document.getElementById('chat-input');
  const sendChatButton = document.getElementById('send-chat');
  const chatMessages = document.getElementById('chat-messages');
  
  // Settings elements
  const settingsButton = document.getElementById('settings-button');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsButton = document.getElementById('close-settings');
  const groqApiKeyInput = document.getElementById('groq-api-key');
  const toggleApiKeyButton = document.getElementById('toggle-api-key');
  const reconnectCalendarButton = document.getElementById('reconnect-calendar');
  const saveSettingsButton = document.getElementById('save-settings');
  const themeButtons = document.querySelectorAll('.theme-btn');
  
  // Day planning elements
  const addTaskButton = document.getElementById('add-task-btn');
  const taskList = document.getElementById('task-list');
  const generateScheduleButton = document.getElementById('generate-schedule-btn');
  const schedulePreview = document.getElementById('schedule-preview');
  const timelineContainer = document.getElementById('timeline-container');
  const addAllEventsButton = document.getElementById('add-all-events');
  
  // Today tab elements
  const refreshEventsButton = document.getElementById('refresh-events');
  const currentDateElement = document.getElementById('current-date');
  
  // Tracking tab elements
  const startTrackingButton = document.getElementById('start-tracking');
  const stopTrackingButton = document.getElementById('stop-tracking');
  const trackingStatus = document.getElementById('tracking-status');
  const websiteStats = document.getElementById('website-stats');
  const clearTrackingButton = document.getElementById('clear-tracking');
  const analyzeProductivityButton = document.getElementById('analyze-productivity');
  const productivityResults = document.getElementById('productivity-results');
  const analysisContent = document.getElementById('analysis-content');
  
  // Add new constants at the top with the other element references
  const blockerToggle = document.getElementById('blocker-toggle');
  const addBlockButton = document.getElementById('add-block');
  const blockUrlInput = document.getElementById('block-url');
  const blockedList = document.getElementById('blocked-list');
  
  // Display current date correctly
  updateCurrentDate();
  
  // Apply theme from storage
  loadAndApplyTheme();
  
  // Load Groq API key from storage and set it in the input
  chrome.storage.local.get(['groqApiKey'], function(result) {
    if (result.groqApiKey) {
      window.groqService.setApiKey(result.groqApiKey);
      groqApiKeyInput.value = result.groqApiKey;
    }
  });
  
  // Check authentication status
  checkAuthStatus();
  
  // Load today's events
  loadTodayEvents();
  
  // Make sure "today" tab is active by default - add this if needed
  if (contentArea && !contentArea.classList.contains('hidden')) {
    switchTab('today');
  }
  
  // Event listeners
  authorizeButton.addEventListener('click', authenticate);
  addEventButton.addEventListener('click', addEventToCalendar);
  sendChatButton.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
  
  // Settings event listeners
  settingsButton.addEventListener('click', function() {
    settingsModal.classList.remove('hidden');
  });
  
  closeSettingsButton.addEventListener('click', function() {
    settingsModal.classList.add('hidden');
  });
  
  toggleApiKeyButton.addEventListener('click', function() {
    if (groqApiKeyInput.type === 'password') {
      groqApiKeyInput.type = 'text';
      toggleApiKeyButton.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
      groqApiKeyInput.type = 'password';
      toggleApiKeyButton.innerHTML = '<i class="fas fa-eye"></i>';
    }
  });
  
  reconnectCalendarButton.addEventListener('click', function() {
    chrome.storage.local.remove(['token'], function() {
      authenticate();
    });
  });
  
  saveSettingsButton.addEventListener('click', saveSettings);
  
  themeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const theme = this.dataset.theme;
      setTheme(theme);
      
      themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn === this);
      });
      
      chrome.storage.local.set({ theme: theme });
    });
  });
  
  // Day planning event listeners
  addTaskButton.addEventListener('click', addNewTaskInput);
  generateScheduleButton.addEventListener('click', generateDailySchedule);
  addAllEventsButton.addEventListener('click', addScheduleToCalendar);
  
  // Add event listeners for today tab
  refreshEventsButton.addEventListener('click', loadTodayEvents);
  
  // Add event listeners for tracking tab
  startTrackingButton.addEventListener('click', startTracking);
  stopTrackingButton.addEventListener('click', stopTracking);
  clearTrackingButton.addEventListener('click', clearTrackingData);
  analyzeProductivityButton.addEventListener('click', analyzeProductivity);
  
  // Add these new event listeners in the existing event listeners section
  blockerToggle.addEventListener('change', toggleBlocker);
  addBlockButton.addEventListener('click', addBlockedSite);
  blockUrlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addBlockedSite();
    }
  });
  
  // Tab switching with today as default when authenticated
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  function switchTab(tabId) {
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabId + '-tab');
    });
    
    // Special handling for specific tabs
    if (tabId === 'plan-day' && taskList.children.length === 0) {
      addNewTaskInput();
    } else if (tabId === 'today') {
      loadTodayEvents();
    } else if (tabId === 'tracking') {
      updateTrackingStats();
    } else if (tabId === 'blocker') {
      loadBlockedSites();
    }
  }
  
  function checkAuthStatus() {
    chrome.storage.local.get(['token'], function(result) {
      if (result.token) {
        // Validate token
        chrome.runtime.sendMessage(
          { action: 'validateToken' },
          function(response) {
            if (response.valid) {
              showContentArea();
            } else {
              showAuthButton();
            }
          }
        );
      } else {
        showAuthButton();
      }
    });
  }
  
  function authenticate() {
    authorizeButton.disabled = true;
    authStatus.textContent = "Connecting to Google Calendar...";
    
    chrome.runtime.sendMessage(
      { action: 'authenticate' },
      function(response) {
        if (response.success) {
          showContentArea();
          loadTodayEvents();
        } else {
          authStatus.textContent = "Authentication failed: " + response.error;
          authorizeButton.disabled = false;
        }
      }
    );
  }
  
  function showAuthButton() {
    contentArea.classList.add('hidden');
    document.getElementById('auth-section').classList.remove('hidden');
    authStatus.textContent = "";
  }
  
  function showContentArea() {
    document.getElementById('auth-section').classList.add('hidden');
    contentArea.classList.remove('hidden');
    authStatus.textContent = "Connected";
    
    // Update current date
    updateCurrentDate();
    
    // Always switch to Today tab when showing content area
    switchTab('today');
  }
  
  function loadAndApplyTheme() {
    chrome.storage.local.get(['theme'], function(result) {
      if (result.theme) {
        setTheme(result.theme);
        
        themeButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.theme === result.theme);
        });
      } else {
        // Default to auto theme
        document.body.classList.add('theme-auto');
      }
    });
  }
  
  function setTheme(theme) {
    document.body.className = '';
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else if (theme === 'auto') {
      document.body.classList.add('theme-auto');
    }
    // light theme is default (no class needed)
  }
  
  function saveSettings() {
    const apiKey = groqApiKeyInput.value.trim();
    
    if (apiKey) {
      chrome.storage.local.set({ groqApiKey: apiKey }, function() {
        window.groqService.setApiKey(apiKey);
        showResult('Settings saved successfully!', 'success');
        settingsModal.classList.add('hidden');
      });
    } else {
      showResult('Please enter a valid Groq API Key', 'error');
    }
  }
  
  async function loadTodayEvents() {
    // Show loading state
    const todayEventsList = document.getElementById('today-events-list');
    todayEventsList.innerHTML = `
      <div class="loader-container">
        <div class="loader-spinner"></div>
        <p>Loading events...</p>
      </div>
    `;
    
    chrome.storage.local.get(['token'], function(result) {
      if (!result.token) {
        todayEventsList.innerHTML = `<div class="no-data">Please connect to Google Calendar first</div>`;
        return;
      }
      
      // Get today's range (midnight to midnight)
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const timeMin = today.toISOString();
      const timeMax = tomorrow.toISOString();
      
      chrome.runtime.sendMessage(
        {
          action: 'getEvents',
          timeMin: timeMin,
          timeMax: timeMax
        },
        function(response) {
          if (response.success) {
            displayTodayEvents(response.events);
          } else {
            todayEventsList.innerHTML = `<div class="no-data">Error loading events: ${response.error}</div>`;
          }
        }
      );
    });
  }
  
  // Update the displayTodayEvents function to add delete buttons
  function displayTodayEvents(events) {
    const todayEventsList = document.getElementById('today-events-list');
    todayEventsList.innerHTML = '';
    
    if (events.length === 0) {
      const noEvents = document.createElement('div');
      noEvents.className = 'no-events';
      noEvents.innerHTML = `
        <i class="fas fa-calendar-minus"></i>
        <p>No events scheduled for today</p>
        <button id="quick-add-event" class="btn primary">Add Event</button>
      `;
      todayEventsList.appendChild(noEvents);
      
      // Add event listener to the quick add button
      document.getElementById('quick-add-event').addEventListener('click', function() {
        switchTab('manual');
      });
      
      return;
    }
    
    // Sort events by start time
    events.sort((a, b) => {
      return new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date);
    });
    
    // Group events by time blocks (morning, afternoon, evening)
    const morning = [];
    const afternoon = [];
    const evening = [];
    
    events.forEach(event => {
      const startTime = event.start.dateTime ? new Date(event.start.dateTime) : new Date();
      const hour = startTime.getHours();
      
      if (hour < 12) {
        morning.push(event);
      } else if (hour < 17) {
        afternoon.push(event);
      } else {
        evening.push(event);
      }
    });
    
    // Create time blocks
    if (morning.length > 0) {
      createTimeBlock('Morning', morning, todayEventsList);
    }
    
    if (afternoon.length > 0) {
      createTimeBlock('Afternoon', afternoon, todayEventsList);
    }
    
    if (evening.length > 0) {
      createTimeBlock('Evening', evening, todayEventsList);
    }
  }
  
  // Update the createTimeBlock function to include delete buttons
  function createTimeBlock(title, events, container) {
    const timeBlock = document.createElement('div');
    timeBlock.className = 'time-block';
    
    const timeBlockTitle = document.createElement('div');
    timeBlockTitle.className = 'time-block-title';
    timeBlockTitle.textContent = title;
    timeBlock.appendChild(timeBlockTitle);
    
    events.forEach(event => {
      const eventItem = document.createElement('div');
      eventItem.className = 'event-item';
      
      const startTime = event.start.dateTime ? 
        new Date(event.start.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
        'All day';
      
      eventItem.innerHTML = `
        <div class="event-time">${startTime}</div>
        <div class="event-details">
          <div class="event-title">${event.summary}</div>
          ${event.location ? `<div class="event-location">${event.location}</div>` : ''}
        </div>
        <div class="event-actions">
          <div class="event-delete" data-event-id="${event.id}" title="Delete event">
            <i class="fas fa-trash-alt"></i>
          </div>
        </div>
      `;
      
      timeBlock.appendChild(eventItem);
      
      // Add event listener for delete button
      const deleteBtn = eventItem.querySelector('.event-delete');
      deleteBtn.addEventListener('click', function() {
        deleteEvent(event.id, event.summary);
      });
    });
    
    container.appendChild(timeBlock);
  }
  
  // Add new function to delete events
  function deleteEvent(eventId, eventTitle) {
    if (confirm(`Are you sure you want to delete "${eventTitle}"?`)) {
      chrome.runtime.sendMessage(
        {
          action: 'deleteEvent',
          eventId: eventId
        },
        function(response) {
          if (response.success) {
            showResult(`Event "${eventTitle}" has been deleted.`, 'success');
            // Refresh the events list
            loadTodayEvents();
          } else {
            showResult(`Error deleting event: ${response.error}`, 'error');
          }
        }
      );
    }
  }
  
  function addNewTaskInput() {
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    
    taskItem.innerHTML = `
      <input type="text" class="task-input" placeholder="Enter a task...">
      <input type="number" class="task-duration" placeholder="Min" min="5" value="30">
      <button class="btn small remove-task">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    taskList.appendChild(taskItem);
    
    // Add event listener to the remove button
    taskItem.querySelector('.remove-task').addEventListener('click', function() {
      taskList.removeChild(taskItem);
    });
    
    // Focus the new input
    taskItem.querySelector('.task-input').focus();
  }
  
  async function generateDailySchedule() {
    // Collect task data
    const tasks = [];
    const taskItems = taskList.querySelectorAll('.task-item');
    let hasEmptyTask = false;
    
    taskItems.forEach(item => {
      const taskName = item.querySelector('.task-input').value.trim();
      const taskDuration = item.querySelector('.task-duration').value;
      
      if (!taskName) {
        hasEmptyTask = true;
        return;
      }
      
      tasks.push({
        name: taskName,
        duration: parseInt(taskDuration) || 30
      });
    });
    
    if (hasEmptyTask) {
      showResult('Please fill in all task names or remove empty tasks', 'error');
      return;
    }
    
    if (tasks.length === 0) {
      showResult('Please add at least one task', 'error');
      return;
    }
    
    // Get time preferences
    const dayStartTime = document.getElementById('day-start-time').value;
    const dayEndTime = document.getElementById('day-end-time').value;
    const breakDuration = document.getElementById('break-duration').value;
    
    if (!dayStartTime || !dayEndTime) {
      showResult('Please set day start and end times', 'error');
      return;
    }
    
    // Disable button and show loading state
    generateScheduleButton.disabled = true;
    generateScheduleButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    
    try {
      // Call the Groq API to generate a schedule
      const schedule = await window.groqService.planDay(
        tasks, 
        dayStartTime, 
        dayEndTime, 
        breakDuration
      );
      
      // Display the schedule
      displaySchedule(schedule);
      
      // Show the schedule preview
      schedulePreview.classList.remove('hidden');
      schedulePreview.scrollIntoView({ behavior: 'smooth' });
      
    } catch (error) {
      showResult('Error generating schedule: ' + error.message, 'error');
    } finally {
      // Reset button
      generateScheduleButton.disabled = false;
      generateScheduleButton.innerHTML = '<i class="fas fa-calendar-check"></i> Generate Schedule';
    }
  }
  
  function displaySchedule(schedule) {
    timelineContainer.innerHTML = '';
    
    schedule.forEach(item => {
      const startTime = new Date(item.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const endTime = new Date(item.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      const timelineItem = document.createElement('div');
      timelineItem.className = `timeline-item ${item.type === 'break' ? 'timeline-break' : ''}`;
      
      timelineItem.innerHTML = `
        <div class="timeline-time">${startTime}<br>to<br>${endTime}</div>
        <div class="timeline-content">
          <div class="timeline-title">${item.title}</div>
          <div class="timeline-duration">${item.type === 'break' ? 'Break' : item.description || ''}</div>
        </div>
      `;
      
      timelineContainer.appendChild(timelineItem);
    });
  }
  
  function addScheduleToCalendar() {
    const items = timelineContainer.querySelectorAll('.timeline-item');
    if (items.length === 0) return;
    
    addAllEventsButton.disabled = true;
    addAllEventsButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    
    let completedEvents = 0;
    let successfulEvents = 0;
    const totalEvents = items.length;
    
    items.forEach((item, index) => {
      const title = item.querySelector('.timeline-title').textContent;
      const timeText = item.querySelector('.timeline-time').textContent;
      const description = item.querySelector('.timeline-duration').textContent;
      
      // Extract times from HTML
      const times = timeText.split('to').map(t => t.trim());
      
      // Create a date for today
      const today = new Date().toISOString().split('T')[0];
      
      // Convert 12-hour format to 24-hour format for the API
      const startTimeParts = times[0].match(/(\d+):(\d+)(\s*[AP]M)?/);
      const endTimeParts = times[1].match(/(\d+):(\d+)(\s*[AP]M)?/);
      
      let startHour = parseInt(startTimeParts[1]);
      const startMinute = parseInt(startTimeParts[2]);
      let endHour = parseInt(endTimeParts[1]);
      const endMinute = parseInt(endTimeParts[2]);
      
      // Adjust hours for PM if 12-hour format is used
      if (startTimeParts[3] && startTimeParts[3].trim().toUpperCase() === 'PM' && startHour < 12) {
        startHour += 12;
      }
      if (endTimeParts[3] && endTimeParts[3].trim().toUpperCase() === 'PM' && endHour < 12) {
        endHour += 12;
      }
      
      // Format times for the API
      const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
      
      const event = {
        summary: title,
        description: description,
        start: {
          dateTime: `${today}T${startTime}:00`,
          timeZone: 'Asia/Kolkata'
        },
        end: {
          dateTime: `${today}T${endTime}:00`,
          timeZone: 'Asia/Kolkata'
        }
      };
      
      // Add a small delay between each request
      setTimeout(() => {
        chrome.runtime.sendMessage(
          {
            action: 'addEvent',
            event: event
          },
          function(response) {
            completedEvents++;
            if (response.success) {
              successfulEvents++;
            }
            
            // Check if all events have been processed
            if (completedEvents === totalEvents) {
              addAllEventsButton.disabled = false;
              addAllEventsButton.innerHTML = 'Add All Events to Calendar';
              showResult(`Added ${successfulEvents} out of ${totalEvents} events to your calendar!`, successfulEvents > 0 ? 'success' : 'error');
              if (successfulEvents > 0) {
                loadTodayEvents(); // Refresh today's events list
              }
            }
          }
        );
      }, index * 300); // Stagger requests by 300ms to avoid rate limiting
    });
  }
  
  async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessageToChat(message, 'user');
    chatInput.value = '';
    chatInput.focus(); // Keep focus on input for continued conversation
    
    // Add loading indicator with a unique ID
    const loadingDivId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message';
    loadingDiv.id = loadingDivId; // Add a unique ID
    loadingDiv.innerHTML = 'Processing <span class="loader"></span>';
    chatMessages.appendChild(loadingDiv);
    scrollChatToBottom();
    
    try {
      // Process with Groq API
      const event = await window.groqService.processMessage(message);
      
      // Remove loading indicator safely
      removeLoadingIndicator(loadingDivId);
      
      // Format dates safely
      const startFormatted = formatDateTime(event.start.dateTime);
      const endFormatted = formatDateTime(event.end.dateTime);
      
      // Show the extracted event details
      const responseText = `I'll create an event: "${event.summary}" ${event.location ? 'at ' + event.location : ''} from ${startFormatted} to ${endFormatted}. Is that correct?`;
      addMessageToChat(responseText, 'bot');
      
      // Add confirm/edit buttons
      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'message bot-message';
      buttonsDiv.innerHTML = `
        <button id="confirm-event" class="btn primary">Yes, Add Event</button>
        <button id="edit-event" class="btn">Edit Event</button>
      `;
      chatMessages.appendChild(buttonsDiv);
      scrollChatToBottom();
      
      // Add event listeners to these buttons
      document.getElementById('confirm-event').addEventListener('click', () => {
        addAIEventToCalendar(event);
        buttonsDiv.remove();
      });
      
      document.getElementById('edit-event').addEventListener('click', () => {
        // Fill the manual form with this data
        document.getElementById('event-title').value = event.summary;
        document.getElementById('event-location').value = event.location || '';
        document.getElementById('event-description').value = event.description || '';
        
        // Parse dates and times
        const startDateTime = new Date(event.start.dateTime);
        document.getElementById('event-start-date').value = startDateTime.toISOString().split('T')[0];
        document.getElementById('event-start-time').value = startDateTime.toTimeString().split(' ')[0].substring(0, 5);
        
        const endDateTime = new Date(event.end.dateTime);
        document.getElementById('event-end-date').value = endDateTime.toISOString().split('T')[0];
        document.getElementById('event-end-time').value = endDateTime.toTimeString().split(' ')[0].substring(0, 5);
        
        // Switch to manual tab
        switchTab('manual');
        buttonsDiv.remove();
      });
    } catch (error) {
      // Remove loading indicator safely
      removeLoadingIndicator(loadingDivId);
      
      // Show error
      addMessageToChat(`Sorry, I couldn't process that: ${error.message}. Please try again with more details.`, 'bot');
    }
  }
  
  // Helper function to safely remove loading indicator
  function removeLoadingIndicator(loadingId) {
    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) {
      loadingElement.remove();
    }
  }
  
  function addMessageToChat(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    scrollChatToBottom();
  }
  
  function scrollChatToBottom() {
    // Ensure chat always scrolls to the newest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function addAIEventToCalendar(event) {
    addMessageToChat('Adding event to your calendar...', 'bot');
    
    // Add extra check to ensure the date is current
    const eventDate = new Date(event.start.dateTime);
    const today = new Date();
    
    // If the event date looks suspicious (e.g., very far from today), confirm with the user
    if (Math.abs(eventDate.getTime() - today.getTime()) > 31536000000) { // More than a year difference
      addMessageToChat(`The date (${eventDate.toDateString()}) seems unusual. Please confirm this is correct.`, 'bot');
    }
    
    sendEventToCalendar(event, true);
  }
  
  function addEventToCalendar() {
    // Get form values
    const title = document.getElementById('event-title').value;
    const location = document.getElementById('event-location').value;
    const description = document.getElementById('event-description').value;
    const startDate = document.getElementById('event-start-date').value;
    const startTime = document.getElementById('event-start-time').value;
    const endDate = document.getElementById('event-end-date').value;
    const endTime = document.getElementById('event-end-time').value;
    
    // Validate
    if (!title || !startDate || !startTime || !endDate || !endTime) {
      showResult('Please fill in all required fields', 'error');
      return;
    }
    
    // Disable button while processing
    addEventButton.disabled = true;
    addEventButton.textContent = 'Adding...';
    
    // Create event object
    const event = {
      summary: title,
      location: location,
      description: description,
      start: {
        dateTime: `${startDate}T${startTime}:00`,
        timeZone: 'Asia/Kolkata' // IST timezone
      },
      end: {
        dateTime: `${endDate}T${endTime}:00`,
        timeZone: 'Asia/Kolkata' // IST timezone
      }
    };
    
    sendEventToCalendar(event);
  }
  
  function sendEventToCalendar(event, fromAI = false) {
    // Send to background script
    chrome.runtime.sendMessage(
      {
        action: 'addEvent',
        event: event
      },
      function(response) {
        if (fromAI) {
          // Display result in chat
          if (response.success) {
            addMessageToChat(`Event "${event.summary}" has been added to your calendar! ✨`, 'bot');
          } else {
            addMessageToChat(`Sorry, there was an error adding the event: ${response.error}`, 'bot');
          }
        } else {
          // Display result in form
          addEventButton.disabled = false;
          addEventButton.textContent = 'Add to Calendar';
          
          if (response.success) {
            showResult(`Event "${event.summary}" added to calendar! <a href="${response.link}" target="_blank">View</a>`, 'success');
            // Clear form
            document.getElementById('event-title').value = '';
            document.getElementById('event-location').value = '';
            document.getElementById('event-description').value = '';
          } else {
            showResult('Error adding event: ' + response.error, 'error');
          }
        }
      }
    );
  }
  
  function showResult(message, type) {
    resultMessage.innerHTML = message;
    resultMessage.className = type;
    resultMessage.scrollIntoView({ behavior: 'smooth' });
    
    // Auto-hide the message after 5 seconds
    setTimeout(() => {
      resultMessage.innerHTML = '';
      resultMessage.className = '';
    }, 5000);
  }
  
  // Function to update and display the current date
  function updateCurrentDate() {
    const now = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    currentDateElement.textContent = now.toLocaleDateString(undefined, options);
    
    // Set default date values to today for the event form
    const today = now.toISOString().split('T')[0]; // This ensures correct format YYYY-MM-DD
    document.getElementById('event-start-date').value = today;
    document.getElementById('event-end-date').value = today;
  }
  
  // Website tracking functions
  function startTracking() {
    chrome.permissions.request({
      permissions: ['webNavigation'],
      origins: ['<all_urls>']
    }, function(granted) {
      if (granted) {
        chrome.runtime.sendMessage({ action: 'startTracking' }, function(response) {
          if (response.success) {
            trackingStatus.innerHTML = `<span class="tracking-active">Tracking active</span>`;
            startTrackingButton.classList.add('hidden');
            stopTrackingButton.classList.remove('hidden');
          } else {
            trackingStatus.textContent = 'Failed to start tracking';
          }
        });
      } else {
        trackingStatus.textContent = 'Permission denied. Tracking not available.';
      }
    });
  }
  
  function stopTracking() {
    chrome.runtime.sendMessage({ action: 'stopTracking' }, function(response) {
      if (response.success) {
        trackingStatus.textContent = 'Tracking stopped';
        stopTrackingButton.classList.add('hidden');
        startTrackingButton.classList.remove('hidden');
        updateTrackingStats();
      }
    });
  }
  
  function updateTrackingStats() {
    chrome.runtime.sendMessage({ action: 'getTrackingStats' }, function(response) {
      if (response.success && response.stats) {
        displayTrackingStats(response.stats);
        
        // Update tracking status and buttons
        if (response.isActive) {
          trackingStatus.innerHTML = `<span class="tracking-active">Tracking active</span>`;
          startTrackingButton.classList.add('hidden');
          stopTrackingButton.classList.remove('hidden');
        } else {
          trackingStatus.textContent = 'Tracking is currently disabled';
          stopTrackingButton.classList.add('hidden');
          startTrackingButton.classList.remove('hidden');
        }
      } else {
        websiteStats.innerHTML = '<div class="no-data">No tracking data available yet</div>';
      }
    });
  }
  
  function displayTrackingStats(stats) {
    if (!stats || Object.keys(stats).length === 0) {
      websiteStats.innerHTML = '<div class="no-data">No tracking data available yet</div>';
      return;
    }
    
    // Sort by time spent (descending)
    const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    
    websiteStats.innerHTML = '';
    
    // Create chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    
    // Create table for detailed stats
    const statsTable = document.createElement('table');
    statsTable.className = 'stats-table';
    statsTable.innerHTML = `
      <thead>
        <tr>
          <th>Website</th>
          <th>Time Spent</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    
    const tbody = statsTable.querySelector('tbody');
    
    sortedStats.forEach(([domain, seconds]) => {
      const row = document.createElement('tr');
      
      // Format time (convert seconds to minutes and hours if needed)
      let timeFormatted;
      if (seconds < 60) {
        timeFormatted = `${seconds} sec`;
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        timeFormatted = `${minutes} min`;
      } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        timeFormatted = `${hours}h ${minutes}m`;
      }
      
      row.innerHTML = `
        <td>${domain}</td>
        <td>${timeFormatted}</td>
      `;
      
      tbody.appendChild(row);
    });
    
    websiteStats.appendChild(statsTable);
  }
  
  function clearTrackingData() {
    if (confirm('Are you sure you want to clear today\'s tracking data? This cannot be undone.')) {
      chrome.runtime.sendMessage({ action: 'clearTrackingData' }, function(response) {
        if (response.success) {
          showResult('Tracking data cleared successfully', 'success');
          updateTrackingStats();
        } else {
          showResult('Failed to clear tracking data', 'error');
        }
      });
    }
  }
  
  async function analyzeProductivity() {
    // Show the results container and loading state
    productivityResults.classList.remove('hidden');
    analysisContent.innerHTML = `<div class="loader-spinner"></div><p>Analyzing your productivity patterns...</p>`;
    
    // Scroll to make the analysis visible
    productivityResults.scrollIntoView({ behavior: 'smooth' });
    
    try {
      // Get the tracking data
      chrome.runtime.sendMessage({ action: 'getTrackingStats' }, async function(response) {
        if (response.success && response.stats) {
          const trackingData = response.stats;
          
          if (Object.keys(trackingData).length === 0) {
            analysisContent.innerHTML = `<p>No tracking data available for analysis. Please use the tracking feature for some time.</p>`;
            return;
          }
          
          // Format the data for the AI
          const formattedData = formatTrackingDataForAI(trackingData);
          
          // Call the AI service to analyze the data
          try {
            const analysis = await window.groqService.analyzeProductivity(formattedData);
            
            // Display the analysis
            analysisContent.innerHTML = analysis;
          } catch (error) {
            analysisContent.innerHTML = `<p class="error">Failed to analyze productivity: ${error.message}</p>`;
          }
        } else {
          analysisContent.innerHTML = `<p class="error">Failed to retrieve tracking data</p>`;
        }
      });
    } catch (error) {
      analysisContent.innerHTML = `<p class="error">An error occurred: ${error.message}</p>`;
    }
  }
  
  // Helper function to format tracking data for the AI
  function formatTrackingDataForAI(trackingData) {
    const sites = Object.entries(trackingData)
      .sort((a, b) => b[1] - a[1]) // Sort by most time spent
      .map(([domain, seconds]) => {
        // Format time
        let timeFormatted;
        if (seconds < 60) {
          timeFormatted = `${seconds} seconds`;
        } else if (seconds < 3600) {
          const minutes = Math.floor(seconds / 60);
          timeFormatted = `${minutes} minutes`;
        } else {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          timeFormatted = `${hours} hours and ${minutes} minutes`;
        }
        
        return `${domain}: ${timeFormatted}`;
      })
      .join('\n');
    
    return sites;
  }
  
  // Add functions to handle website blocking
  function loadBlockedSites() {
    chrome.storage.local.get(['blockedSites', 'blockerEnabled'], function(result) {
      // Update toggle state
      blockerToggle.checked = result.blockerEnabled === true;
      
      // Update blocked sites list
      if (result.blockedSites && result.blockedSites.length > 0) {
        displayBlockedSites(result.blockedSites);
      } else {
        blockedList.innerHTML = '<div class="no-data">No websites blocked yet</div>';
      }
    });
  }
  
  function displayBlockedSites(sites) {
    blockedList.innerHTML = '';
    
    sites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'blocked-item';
      siteItem.innerHTML = `
        <div class="blocked-domain">${site}</div>
        <div class="unblock-btn" data-site="${site}">
          <i class="fas fa-times"></i> Remove
        </div>
      `;
      
      blockedList.appendChild(siteItem);
      
      // Add event listener for unblock button
      const unblockBtn = siteItem.querySelector('.unblock-btn');
      unblockBtn.addEventListener('click', function() {
        removeBlockedSite(site);
      });
    });
  }
  
  function addBlockedSite() {
    const site = blockUrlInput.value.trim().toLowerCase();
    
    // Simple validation
    if (!site) {
      showResult('Please enter a website domain to block', 'error');
      return;
    }
    
    // Remove http://, https://, and www. if present
    let cleanSite = site.replace(/^(https?:\/\/)?(www\.)?/, '');
    
    // Further clean up any paths or query parameters
    cleanSite = cleanSite.split('/')[0];
    
    chrome.storage.local.get(['blockedSites'], function(result) {
      let blockedSites = result.blockedSites || [];
      
      // Check if site is already blocked
      if (blockedSites.includes(cleanSite)) {
        showResult(`${cleanSite} is already blocked`, 'error');
        return;
      }
      
      // Add to blocked sites
      blockedSites.push(cleanSite);
      
      // Save to storage
      chrome.storage.local.set({ blockedSites: blockedSites }, function() {
        blockUrlInput.value = '';
        showResult(`${cleanSite} added to blocked sites`, 'success');
        displayBlockedSites(blockedSites);
        
        // Notify background script to update blocking rules
        chrome.runtime.sendMessage({ action: 'updateBlockRules' });
      });
    });
  }
  
  // Update the removeBlockedSite function
  function removeBlockedSite(site) {
    chrome.storage.local.get(['blockedSites'], function(result) {
      let blockedSites = result.blockedSites || [];
      
      // Remove site from array
      blockedSites = blockedSites.filter(s => s !== site);
      
      // Save to storage
      chrome.storage.local.set({ blockedSites: blockedSites }, function() {
        // Show more descriptive message
        showResult(`"${site}" removed from blocked sites. Any open tabs will be refreshed.`, 'success');
        displayBlockedSites(blockedSites);
        
        // Notify background script to update blocking rules
        chrome.runtime.sendMessage({ action: 'updateBlockRules' });
      });
    });
  }
  
  function toggleBlocker() {
    const enabled = blockerToggle.checked;
    
    chrome.storage.local.set({ blockerEnabled: enabled }, function() {
      showResult(`Website blocker ${enabled ? 'enabled' : 'disabled'}`, 'success');
      
      // Notify background script to update blocking rules
      chrome.runtime.sendMessage({ 
        action: 'toggleBlocker',
        enabled: enabled
      });
    });
  }
});

// Add the formatDateTime function that's currently missing
function formatDateTime(dateTimeString) {
  try {
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) {
      // Handle invalid date
      return "Invalid date";
    }
    return date.toLocaleString('en-IN', { 
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  } catch (error) {
    console.error("Error formatting date:", error, dateTimeString);
    return dateTimeString; // Return original string if formatting fails
  }
}
