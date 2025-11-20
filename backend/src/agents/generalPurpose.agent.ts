// Add this to your functions file
import dotenv from 'dotenv';
dotenv.config();
export const getCoordinatesForLocation = async (args) => {
  const { locationName } = args;
  const GEOCODING_API_KEY = process.env.GOOGLE_CLOUD_API_KEY; // Same key is fine

  if (!GEOCODING_API_KEY) {
    return { error: "Server API Key is missing." };
  }
  if (!locationName) {
    return { error: "locationName is required." };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationName)}&key=${GEOCODING_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Geocoding API Error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return { error: `Could not find coordinates for: ${locationName}` };
    }

    const location = data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: data.results[0].formatted_address
    };

  } catch (error) {
    console.error("Geocoding failed:", error);
    return { error: `Failed to fetch coordinates: ${error.message}` };
  }
};


export const getCurrentConditions = async (args) => {
  const { latitude, longitude, units = "METRIC" } = args;
  const WEATHER_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
console.log("getCurrentConditions got triggered")
  if (!WEATHER_API_KEY) {
    return { error: "Server API Key is missing." };
  }
  if (!latitude || !longitude) {
    return { error: "Latitude and Longitude are required." };
  }

  const baseUrl = "https://weather.googleapis.com/v1";
  const locationQuery = `location.latitude=${latitude}&location.longitude=${longitude}`;
  const unitsQuery = `unitsSystem=${units}`;
  const keyQuery = `key=${WEATHER_API_KEY}`;

  const url = `${baseUrl}/currentConditions:lookup?${keyQuery}&${locationQuery}&${unitsQuery}`;

  try {
    const response = await fetch(url);
    console.log(response);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message || `API Error ${response.status}`);
    }
    
    // Return the full JSON response from the API
    const data = await response.json();
    return data; 

  } catch (error) {
    console.error("Current conditions fetch failed:", error);
    return { error: `Failed to fetch current conditions: ${error.message}` };
  }
};


export const getDailyForecast = async (args) => {
  const { latitude, longitude, units = "METRIC", days = 5 } = args;
  const WEATHER_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;

  if (!WEATHER_API_KEY) {
    return { error: "Server API Key is missing." };
  }
  if (!latitude || !longitude) {
    return { error: "Latitude and Longitude are required." };
  }

  const baseUrl = "https://weather.googleapis.com/v1";
  const locationQuery = `location.latitude=${latitude}&location.longitude=${longitude}`;
  const unitsQuery = `unitsSystem=${units}`;
  const daysQuery = `days=${days}`;
  const keyQuery = `key=${WEATHER_API_KEY}`;

  const url = `${baseUrl}/forecast/days:lookup?${keyQuery}&${locationQuery}&${unitsQuery}&${daysQuery}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message || `API Error ${response.status}`);
    }
    
    const data = await response.json();
    // Return just the array of forecast days, which is what the model needs
    return data.forecastDays; 

  } catch (error) {
    console.error("Daily forecast fetch failed:", error);
    return { error: `Failed to fetch daily forecast: ${error.message}` };
  }
};

export const getCurrentTemperature = async (args) => {
  const WEATHER_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;

  const { location, units = "METRIC" } = args;

  if (!WEATHER_API_KEY) {
    return { error: "Server API Key is missing." };
  }
  if (!location) {
    return { error: "Location is required." };
  }

  try {
    // --- STEP 1: Geocoding (Location -> Lat/Lng) ---
    console.log(`Geocoding location: ${location}`);
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${WEATHER_API_KEY}`;
    
    const geoResponse = await fetch(geocodeUrl);
    if (!geoResponse.ok) {
      throw new Error(`Geocoding API error: ${geoResponse.status}`);
    }

    const geoData = await geoResponse.json();
    if (geoData.status !== 'OK' || !geoData.results || geoData.results.length === 0) {
      return { error: `Could not find coordinates for: ${location}` };
    }

    const coords = geoData.results[0].geometry.location;
    const formattedAddress = geoData.results[0].formatted_address;
    const { lat, lng } = coords;

    // --- STEP 2: Get Current Weather (Lat/Lng -> Temp) ---
    console.log(`Fetching weather for ${formattedAddress} [${lat}, ${lng}]`);
    const locationQuery = `location.latitude=${lat}&location.longitude=${lng}`;
    const unitsQuery = `unitsSystem=${units}`;
    const keyQuery = `key=${API_KEY}`;
    
    const weatherUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?${keyQuery}&${locationQuery}&${unitsQuery}`;

    const weatherResponse = await fetch(weatherUrl);
    if (!weatherResponse.ok) {
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();

    // --- STEP 3: Return a clean, simple object for the AI ---
    return {
      location: formattedAddress,
      temperature: weatherData.current.temperature,
      feelsLike: weatherData.current.feelsLike,
      condition: weatherData.current.condition.text,
      units: units
    };

  } catch (error) {
    console.error("getCurrentTemperature failed:", error);
    return { error: `Failed to get temperature: ${error.message}` };
  }
};

export const generalTalk = async (args) => {
  // args.prompt contains the user's raw message, e.g., "Hi, what can you do?"
  
  try {
    // Minimized "Manual" for the AI
    // Groups tools by category to reduce token usage and improve context understanding.
    const agentCapabilities = [
      {
        category: "📅 Calendar & Scheduling",
        description: "Manage schedule, meetings, and birthdays.",
        capabilities: [
          "getCalendarEvents(minTime, maxTime) - View schedule",
          "setCalendarEvent(summary, start, end) - Create events",
          "scheduleMeeting(attendees, date, time) - Book meetings",
          "setBirthdayEvent(personName, date) - Add recurring birthdays"
        ]
      },
      {
        category: "✅ Tasks & To-Dos",
        description: "Manage Google Tasks and Todo lists.",
        capabilities: [
          "setCalendarTask(title, dueDate, category) - Add new task",
          "listCalendarTasks(category, groupBy, showCompleted) - View/Filter tasks"
        ]
      },
      {
        category: "📧 Email",
        description: "Access and filter emails.",
        capabilities: [
          "getEmails(filter) - Find emails (e.g., 'unread', 'from:boss')"
        ]
      },
      {
        category: "🌤️ Weather & Location",
        description: "Check real-time weather conditions.",
        capabilities: [
          "getCurrentConditions(lat, long) - Get weather",
          "getCoordinatesForLocation(locationName) - Get geo-coordinates"
        ]
      }
    ];

    // Return this structured data. 
    // The LLM will use this object to construct a natural language response.
    return {
      status: "success",
      type: "general_interaction",
      user_prompt_received: args.prompt,
      system_message: "Here is the guide to your capabilities. Summarize these to the user naturally if asked, or use this context to answer their general query.",
      available_agents: agentCapabilities
    };

  } catch (error) {
    console.error("Error in generalTalk:", error);
    return { error: "Failed to retrieve agent guide." };
  }
};