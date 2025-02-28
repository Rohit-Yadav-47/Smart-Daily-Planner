# Smart Daily Planner - Chrome Extension

A comprehensive Chrome extension for efficient daily planning, event management, productivity tracking, and website blocking.


## Features

### 📅 Calendar Management
- View today's schedule at a glance
- Add events manually with detailed fields
- AI-powered natural language event creation
- Quick event deletion
- Direct Google Calendar integration

### 📝 Schedule Planning
- Create task lists with time estimations
- Generate optimized daily schedules
- Automatically include appropriate breaks
- One-click addition of all events to your calendar

### 📊 Website Usage Tracking
- Track time spent on different websites
- View detailed breakdown of browsing habits
- Clear visualization of productivity patterns
- AI-powered productivity insights

### 🚫 Website Blocker
- Block distracting websites
- Easy management of blocked site list
- Toggle blocking on/off as needed
- Custom blocked page notification

### ⚙️ Additional Features
- Dark/light/auto theme support
- AI-powered assistant using Groq API
- Persistent settings across sessions
- Event notifications and reminders

## Installation (Developer Mode)

Since this extension isn't published to the Chrome Web Store, you'll need to install it in Developer Mode:

1. **Download/Clone the Repository**
   - Download this repository or clone it with Git:
   ```
   git clone [repository-url]
   ```
   - Extract the ZIP if downloaded

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/` in your Chrome browser
   - Or go to Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle on "Developer mode" in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to the extracted folder (`/Daily_Planner`) and select it

5. **Extension Installed!**
   - The Smart Daily Planner should now appear in your extensions list
   - Pin it to your toolbar for easy access

## Configuration

### Required API Keys

1. **Groq API Key** (for AI features)
   - Sign up at [Groq](https://console.groq.com/)
   - Create an API key
   - Add it in the extension settings

2. **Google Calendar Authentication**
   - The extension will prompt you to connect your Google Calendar
   - Click "Connect Google Calendar" when prompted

## Usage Guide

### 🗓️ Today Tab
- View all of today's events organized by time blocks
- Click the trash icon to delete events
- Use the refresh button to update your calendar view

### 📋 Plan Day Tab
1. Add tasks with estimated durations
2. Set your day's start/end times
3. Configure break duration preferences
4. Click "Generate Schedule" for an optimized plan
5. Review and add all events to your calendar with one click

### ➕ Add Event Tab
- Fill in event details manually
- Supports title, location, description, start/end times

### 🤖 AI Tab
- Type natural language requests like:
  - "Schedule team meeting tomorrow at 3pm for 1 hour"
  - "Add lunch with Sarah at Cafe Milano on Friday 1pm"
- Review the AI's interpretation
- Confirm or edit the events before adding

### 📊 Tracking Tab
1. Click "Start Tracking" to monitor website usage
2. View your browsing statistics in real-time
3. Click "Analyze My Productivity" for AI insights
4. Clear data as needed

### 🚫 Blocker Tab
1. Enter website domains to block (e.g., facebook.com)
2. Toggle blocking on/off as needed
3. Remove blocked sites with a single click

## Troubleshooting

- **Extension Not Loading**: Make sure all files are correctly placed in the folder
- **Calendar Connection Issues**: Try reconnecting via the Settings menu
- **AI Features Not Working**: Verify your Groq API key in Settings
- **Tracking Not Working**: Ensure you've granted necessary permissions

## Privacy Note

- All your data is stored locally on your device
- Google Calendar access is used only to read/write events
- Website tracking data never leaves your browser

