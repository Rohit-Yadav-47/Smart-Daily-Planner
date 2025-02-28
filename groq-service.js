class GroqService {
  constructor() {
    this.apiKey = ''; // Will be set from extension settings
    this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    this.model = 'llama3-8b-8192'; // Using Mixtral model
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  async processMessage(userMessage) {
    if (!this.apiKey) {
      throw new Error('Groq API key is not set. Please configure it in settings.');
    }

    // Always get the current date and time at the moment of the request
    const currentDateTime = new Date();
    const currentDateStr = currentDateTime.toISOString().split('T')[0];
    const currentTimeStr = currentDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Format the date in a readable format for the prompt
    const formattedDate = currentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const prompt = `
      You are a daily planning assistant that helps users create calendar events.
      Extract event details from the user's message and format them as a structured JSON object.
      Always use Indian Standard Time (IST) unless user specifies another timezone.
      
      IMPORTANT: Today's date is ${formattedDate} (${currentDateStr}).
      Current time is ${currentTimeStr}.
      
      Return ONLY a valid JSON object with these fields:
      - summary: The event title
      - location: Where the event takes place (empty string if not specified)
      - description: Additional details about the event (empty string if not specified)
      - startDateTime: In ISO format with IST timezone (YYYY-MM-DDTHH:MM:SS+05:30)
      - endDateTime: In ISO format with IST timezone (YYYY-MM-DDTHH:MM:SS+05:30)
      
      Ensure that:
      1. The dates are correct relative to today (${currentDateStr})
      2. The timezone is specifically IST (+05:30)
      3. You handle relative dates correctly ("tomorrow", "next Monday", etc.)
      
      If the user doesn't specify a duration, assume 1 hour for meetings and 30 minutes for calls.
    `;

    try {
      console.log("Sending request to Groq API...");
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.2, // Lower temperature for more consistent outputs
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Groq API error response:", errorData);
        throw new Error(`Groq API error: ${errorData.error?.message || response.statusText || 'Unknown error'}`);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0) {
        throw new Error('Empty response from Groq API');
      }

      const content = data.choices[0].message.content;
      console.log("Received response from Groq API:", content);
      return this.parseResponseToEvent(content);
    } catch (error) {
      console.error('Error calling Groq API:', error);
      throw error;
    }
  }

  async planDay(tasks, dayStartTime, dayEndTime, breakDuration) {
    if (!this.apiKey) {
      throw new Error('Groq API key is not set. Please configure it in settings.');
    }

    const currentDateTime = new Date();
    const currentDateStr = currentDateTime.toISOString().split('T')[0];
    const formattedDate = currentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Calculate total task minutes
    const totalTaskMinutes = tasks.reduce((total, task) => total + parseInt(task.duration), 0);
    
    // Calculate available minutes in the day
    const startParts = dayStartTime.split(':').map(Number);
    const endParts = dayEndTime.split(':').map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];
    const availableMinutes = endMinutes - startMinutes;
    
    // Determine number of breaks needed
    const breakMinutes = parseInt(breakDuration);
    const workingBlocks = Math.ceil(totalTaskMinutes / 90); // Assume break after ~90 mins of work
    const totalBreakMinutes = (workingBlocks - 1) * breakMinutes;
    
    // Format tasks for the prompt
    const taskList = tasks.map(task => 
      `- ${task.name} (${task.duration} minutes)`
    ).join('\n');

    const prompt = `
      You are an expert productivity planner. Plan a daily schedule based on the tasks provided.
      Today's date is ${formattedDate}.
      
      Schedule details:
      - Day starts at: ${dayStartTime}
      - Day ends at: ${dayEndTime}
      - Break duration: ${breakDuration} minutes
      - Total task time: ${totalTaskMinutes} minutes
      - Available time: ${availableMinutes} minutes
      
      Tasks to schedule:
      ${taskList}
      
      Fill the entire day between ${dayStartTime} and ${dayEndTime} with tasks and appropriate breaks.
      Insert breaks after approximately 60-90 minutes of work.
      Prioritize tasks in a logical order, considering dependencies and cognitive load.
      
      Return ONLY a JSON array with scheduled events including breaks. Each event should have:
      - title: The event title (use task name for tasks, "Break" or similar for breaks)
      - startTime: Start time in 24-hour format (HH:MM)
      - endTime: End time in 24-hour format (HH:MM)
      - type: Either "task" or "break"
      - description: Brief description or empty string
    `;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: "Please create a productive schedule with these tasks." }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Groq API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0) {
        throw new Error('Empty response from Groq API');
      }

      const content = data.choices[0].message.content;
      return this.parseScheduleResponse(content, currentDateStr);
    } catch (error) {
      console.error('Error calling Groq API for day planning:', error);
      throw error;
    }
  }

  async analyzeProductivity(trackingData) {
    if (!this.apiKey) {
      throw new Error('Groq API key is not set. Please configure it in settings.');
    }
    
    const prompt = `
      Analyze this website usage data and provide an extremely concise productivity assessment:
      
      ${trackingData}
      
      Format your response as HTML using this exact structure:
      Never include timings or percentage or any values 
      1. Start with a single "headline" sentence summarizing productivity (30 words max)
      2. Two key metrics: productive vs. distracting time ratio (as bullet points) 
      3. A simple, bulleted "Focus Areas" list with 2-3 extremely specific, actionable items
      
      Style guidelines:
      - Keep the entire response under 100 words total
      - Use <span class="productivity-highlight"> for productivity positives
      - Use <span class="productivity-warning"> for areas of concern
      - Use <h4> for section headings
      - Use bullet points (<ul><li>) for lists
      - No introductory text or conclusions
    `;
    
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: "Generate a concise productivity analysis." }
          ],
          temperature: 0.4,
          max_tokens: 500
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Groq API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      if (!data.choices || data.choices.length === 0) {
        throw new Error('Empty response from Groq API');
      }
      
      // Apply additional formatting to ensure consistent styling
      let content = data.choices[0].message.content;
      
      // Ensure spans are properly closed
      content = content.replace(/<span class="productivity-highlight">([^<]+)(?!<\/span>)/g, 
                              '<span class="productivity-highlight">$1</span>');
      content = content.replace(/<span class="productivity-warning">([^<]+)(?!<\/span>)/g, 
                              '<span class="productivity-warning">$1</span>');
      
      // Wrap the content in a standard format
      content = `
        <div class="productivity-report">
          ${content}
          <div class="productivity-timestamp">
            <small>Analysis generated on ${new Date().toLocaleString()}</small>
          </div>
        </div>
      `;
      
      return content;
    } catch (error) {
      console.error('Error analyzing productivity:', error);
      throw error;
    }
  }

  parseResponseToEvent(content) {
    try {
      // Find JSON object in the response using a more robust pattern
      let jsonString = content;
      
      // Try to extract JSON if it's embedded in text
      const jsonRegex = /({[\s\S]*})/;
      const match = content.match(jsonRegex);
      if (match) {
        jsonString = match[0];
      }
      
      // Clean up the string (removing markdown code blocks if present)
      jsonString = jsonString.replace(/```json|```/g, '').trim();
      
      console.log("Attempting to parse JSON:", jsonString);
      
      // Parse the JSON
      const eventData = JSON.parse(jsonString);
      
      // Validate required fields
      if (!eventData.summary || !eventData.startDateTime || !eventData.endDateTime) {
        throw new Error("Missing required fields in AI response");
      }
      
      // Convert to Google Calendar event format
      return {
        summary: eventData.summary,
        location: eventData.location || '',
        description: eventData.description || '',
        start: {
          dateTime: eventData.startDateTime,
          timeZone: 'Asia/Kolkata' // IST timezone
        },
        end: {
          dateTime: eventData.endDateTime,
          timeZone: 'Asia/Kolkata' // IST timezone
        }
      };
    } catch (error) {
      console.error('Failed to parse response:', error, 'Content was:', content);
      throw new Error('Failed to understand AI response. Please try again with clearer instructions.');
    }
  }
  
  parseScheduleResponse(content, dateStr) {
    try {
      // Extract JSON array from the response
      const jsonMatch = content.match(/\[([\s\S]*)\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      
      // Parse the JSON
      const scheduleData = JSON.parse(jsonString);
      
      // Convert to a more usable format
      return scheduleData.map(event => ({
        title: event.title,
        startTime: `${dateStr}T${event.startTime}:00+05:30`,
        endTime: `${dateStr}T${event.endTime}:00+05:30`,
        type: event.type,
        description: event.description || ''
      }));
    } catch (error) {
      console.error('Failed to parse schedule response:', error);
      throw new Error('Failed to understand AI response. Please try again with clearer instructions.');
    }
  }
}

// Export the service
window.groqService = new GroqService();