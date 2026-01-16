

// import { User } from '../models/User.js';
import prisma from "../db/prismaClient.js";
// const User = require('../models/User.js');
import { google } from 'googleapis'; // You'll need googleapis
import dotenv from 'dotenv';
dotenv.config();
// const SCOPES = [
//   'https://www.googleapis.com/auth/calendar',
//   'https://www.googleapis.com/auth/gmail.readonly'
// ];
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI // e.g., "http://localhost:3000/api/auth/google/callback"
);
const calenderTest=async (req, res) => {

  console.log("calender event triggered")
  // console.log("args", args);
  let {userId, refreshToken, minTime, maxTime}=req.body;
  console.log("userId", userId);
  console.log("refreshToken", refreshToken);
  console.log("minTime", minTime);
  console.log("maxTime", maxTime);
  try {
    // 1. Find user by your app's internal _id
    const user =await prisma.user.findUnique({
      where: { id: userId },
    }); 

    if (!user || !user.refreshToken) {
      return { error: "User has not linked their Google account." };
    }

    // 2. Set user's refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 3. Destructure arguments from the 'args' object
    // let { minTime, maxTime } = args;

    // 4. Handle default logic *smartly*
    //    If no dates, default to today.
    //    If only one date, search *that specific day*.
    const today = new Date();
    if (!minTime && !maxTime) {
      minTime = today;
      maxTime = today;
    } else if (minTime && !maxTime) {
      maxTime = minTime; // Search for the single day provided
    } else if (!minTime && maxTime) {
      minTime = maxTime; // Search for the single day provided
    }

    // 5. Create date objects and set to full day
    const timeMinDate = new Date(minTime);
    timeMinDate.setHours(0, 0, 0, 0); // Start of the minTime day

    const timeMaxDate = new Date(maxTime);
    timeMaxDate.setHours(23, 59, 59, 999); // End of the maxTime day

    console.log("timeMinDate", timeMinDate);
    console.log("timeMaxDate", timeMaxDate);
    // 6. Make the API Call
    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMinDate.toISOString(),
      timeMax: timeMaxDate.toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    });
    // console.log("result", result);

    const events = result.data.items;
    if (!events || events.length === 0) {
      return { events: [], message: 'No upcoming events found for this period.' };
    }
    console.log("events", events);
    // 7. Return a clean, simple response for the model
    const simplifiedEvents = events.map(event => ({
      summary: event.summary,
      start: event.start?.dateTime || event.start?.date,
    }));
    console.log("following events, ", simplifiedEvents);
    res.status(200).json({ events: simplifiedEvents });
    return { events: simplifiedEvents };

  } catch (error: any) {
    console.error('Error fetching calendar:', error?.message);
    console.error('Error is ... ', error);
    if (error.response?.data?.error === 'invalid_grant') {
      return { error: "Permission denied. Please re-link your Google account." };
    }
    res.status(500).json({ error: 'Failed to fetch calendar events.' });
    return { error: 'Failed to fetch calendar events.' };
  }
};

const getCalendarEvents = async (args, userId) => {
  console.log("calender event triggered")
  console.log("args", args);
  console.log("userId", userId);
  try {
    // 1. Find user by your app's internal _id
    const user =await prisma.user.findUnique({
      where: { id: userId },
    }); 

    if (!user || !user.refreshToken) {
      return { error: "User has not linked their Google account." };
    }

    // 2. Set user's refresh token
    oauth2Client.setCredentials({
      refresh_token: user.refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 3. Destructure arguments from the 'args' object
    let { minTime, maxTime } = args;

    // 4. Handle default logic *smartly*
    //    If no dates, default to today.
    //    If only one date, search *that specific day*.
    const today = new Date();
    if (!minTime && !maxTime) {
      minTime = today;
      maxTime = today;
    } else if (minTime && !maxTime) {
      maxTime = minTime; // Search for the single day provided
    } else if (!minTime && maxTime) {
      minTime = maxTime; // Search for the single day provided
    }

    // 5. Create date objects and set to full day
    const timeMinDate = new Date(minTime);
    timeMinDate.setHours(0, 0, 0, 0); // Start of the minTime day

    const timeMaxDate = new Date(maxTime);
    timeMaxDate.setHours(23, 59, 59, 999); // End of the maxTime day

    // 6. Make the API Call
    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMinDate.toISOString(),
      timeMax: timeMaxDate.toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = result.data.items;
    if (!events || events.length === 0) {
      return { events: [], message: 'No upcoming events found for this period.' };
    }

    // 7. Return a clean, simple response for the model
    const simplifiedEvents = events.map(event => ({
      summary: event.summary,
      start: event.start?.dateTime || event.start?.date,
    }));
    console.log("following events, ", simplifiedEvents);
    return { events: simplifiedEvents };

  } catch (error) {
    console.error('Error fetching calendar:', error.message);
    if (error.response?.data?.error === 'invalid_grant') {
      return { error: "Permission denied. Please re-link your Google account." };
    }
    return { error: 'Failed to fetch calendar events.' };
  }
};

const setCalendarEvent = async (args, userId) => {
  try {
    // 1. Find the user in MongoDB by your app's internal _id
    const user =await prisma.user.findUnique({
      where: { id: userId },
    }); 

    if (!user || !user.refreshToken) {
      return { error: "User has not linked their Google account." };
    }

    // 2. Load the user's refresh token into the client
    oauth2Client.setCredentials({
      refresh_token: user.refreshToken
    });

    // 3. Create an authenticated calendar service
    const calendar:any = google.calendar({ version: 'v3', auth: oauth2Client });

    // 4. Build the event resource for the API.
    //    Because our tool config is clean, 'args' maps almost 1:1.
    const eventResource = {
      summary: args.summary,
      start: args.start,
      end: args.end,
      location: args.location || null, // Handle optional fields
      description: args.description || null,
      recurrence: args.recurrence || null,
      
      // Map the simple email array to the object format Google needs
      attendees: args.attendees ? args.attendees.map(email => ({ email })) : [],
      
      // Add default reminders automatically for the user
      reminders: {
        useDefault: true,
      },
    };

    // 5. Make the API call to insert the event
    const result:any = await calendar.events?.insert({
      calendarId: 'primary',
      resource: eventResource,
      sendNotifications: true, // This sends email invites to attendees
    });

    // 6. Return a simple, clean success message for the model
    return { 
      status: "success",
      summary: result?.data.summary,
      htmlLink: result?.data.htmlLink // This is the link to the event
    };

  } catch (error:any) {
    // Handle errors cleanly
    console.error('Error creating calendar event:', error.message);
    
    // Specific check for revoked tokens
    if (error.response?.data?.error === 'invalid_grant') {
      return { error: "Permission denied. Please re-link your Google account." };
    }
    
    return { error: 'Failed to create the calendar event.' };
  }
};


const setBirthdayEvent = async (args, userId) => {
  try {
    // 1. Authenticate the user
    const user =await prisma.user.findUnique({
      where: { id: userId },
    }); 
    if (!user || !user.refreshToken) {
      return { error: "User has not linked their Google account." };
    }

    oauth2Client.setCredentials({
      refresh_token: user.refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 2. Get arguments from the model
    const { personName, date } = args; // date is "YYYY-MM-DD"
    
    // --- 3. Apply Birthday-Specific Logic ---

    // a. Handle all-day event dates (Google API uses YYYY-MM-DD strings)
    const startDate = date; // e.g., "1990-02-15"
    
    // For all-day events, the 'end' date is the *exclusive* end date,
    // so it's one day *after* the start.
    const endDateObj = new Date(date);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endDate = endDateObj.toISOString().split('T')[0]; // e.g., "1990-02-16"
    
    // b. Handle leap year (Feb 29) recurrence rule
    let recurrenceRule;
    const dateObj = new Date(date);
    if (dateObj.getMonth() === 1 && dateObj.getDate() === 29) {
      // Rule for Feb 29 as per docs
      recurrenceRule = 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1';
    } else {
      // Standard annual recurrence
      recurrenceRule = 'RRULE:FREQ=YEARLY';
    }

    // 4. Build the event resource *exactly* as docs require
    const eventResource = {
      eventType: 'birthday',
      summary: `${personName}'s Birthday`,
      start: {
        date: startDate, // Use 'date' for all-day events
      },
      end: {
        date: endDate, // Use 'date' for all-day events
      },
      recurrence: [
        recurrenceRule
      ],
      visibility: 'private',     // Required by docs
      transparency: 'transparent', // Required by docs
      birthdayProperties: {
        type: 'birthday'
      },
      reminders: {
        useDefault: true
      },
    };

    // 5. Make the API call
    const result = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventResource,
    });

    // 6. Return a clean success message
    return { 
      status: "success",
      summary: result.data.summary,
      htmlLink: result.data.htmlLink
    };

  } catch (error) {
    console.error('Error creating birthday event:', error.message);
    if (error.response?.data?.error === 'invalid_grant') {
      return { error: "Permission denied. Please re-link your Google account." };
    }
    return { error: 'Failed to create the birthday event.' };
  }
};
async function getTaskListId(service, listName) {
  if (!listName) return '@default';

  try {
    const response = await service.tasklists.list({ maxResults: 100 });
    const lists = response.data.items || [];
    
    // Case-insensitive search
    const match = lists.find(l => l.title.toLowerCase() === listName.toLowerCase());
    return match ? match.id : '@default';
  } catch (err) {
    console.warn('Could not fetch task lists, defaulting to @default:', err.message);
    return '@default';
  }
}

const setCalendarTask = async (args, userId) => {
  try {
    // --- 0. Input Validation & Defaults ---
    if (!args) args = {}; // Prevent crash if args is null

    // Default Title if missing
    const taskTitle = args.title || "Untitled Task";

    // Validate Date Format if provided
    let validDueDate = null;
    if (args.dueDate) {
        try {
            // Check if it is a valid date string
            const dateObj = new Date(args.dueDate);
            if (!isNaN(dateObj.getTime())) {
                validDueDate = args.dueDate; // It's valid, use it
            } else {
                console.warn(`Invalid date format received: ${args.dueDate}. Creating task without date.`);
            }
        } catch (e) {
            console.warn(`Date parsing error: ${e.message}`);
        }
    }

    // --- 1. Find the user ---
    const user =await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      return { error: "User has not linked their Google account." };
    }

    oauth2Client.setCredentials({
      refresh_token: user.refreshToken
    });
    const service = google.tasks({ version: 'v1', auth: oauth2Client });
    const taskListId = await getTaskListId(service, args.category);
    const taskResource = {
      title: taskTitle,
      notes: args.description || "", // Default to empty string if null
      due: validDueDate, 
      status: args.isCompleted === true ? 'completed' : 'needsAction',
    };
    const result = await service.tasks.insert({
      tasklist: taskListId, 
      resource: taskResource,
    });
    return { 
      status: "success",
      data: {
        title: result.data.title,
        listId: taskListId,
        taskId: result.data.id,
        due: result.data.due,
        notes: result.data.notes,
        selfLink: result.data.selfLink,
        webViewLink: result.data.webViewLink
      }
    };

  } catch (error:any) {
    console.error('Error creating Google Task:', error.message);
    
    // Handle specific API errors
    if (error.response?.data?.error === 'invalid_grant') {
      return { error: "Permission denied. Please re-link your Google account." };
    }
    
    if (error.code === 403) {
        return { error: "Missing permissions. Ensure the 'https://www.googleapis.com/auth/tasks' scope is added." };
    }

    if (error.code === 400) {
        return { error: "Invalid request data. Please check the task details." };
    }

    return { error: 'Failed to create the task.' };
  }
};


const listCalendarTasks = async (args, userId ) => {
  try {
    // --- 0. Input Defaults ---
    // groupBy: 'category' (default), 'status', or 'none'
    const groupBy = args.groupBy || 'category'; 
    const showCompleted = args.showCompleted !== false; // Default true
    const showHidden = args.showHidden || false;

    // --- 1. Authenticate ---
    const user =await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.refreshToken) {
      return { error: "User has not linked their Google account." };
    }
    oauth2Client.setCredentials({ refresh_token: user.refreshToken });
    const service = google.tasks({ version: 'v1', auth: oauth2Client });

    // --- 2. Determine which Task Lists to query ---
    // We must fetch lists first because the API cannot "search all tasks" globally 
    // without knowing the list IDs.
    let targetLists = [];
    const allListsRes = await service.tasklists.list({ maxResults: 100 });
    // console.log("allListTasks : ", allListsRes?.data?.items)
    const allLists = allListsRes.data.items || [];

    if (args.category) {
      // Filter for a specific category (e.g., "Work")
      const match = allLists.find(l => l.title.toLowerCase() === args.category.toLowerCase());
      if (!match) return { error: `Category '${args.category}' not found.` };
      targetLists = [match];
    } else {
      // If no category specified, we query ALL lists
      targetLists = allLists;
    }

    // --- 3. Fetch Tasks from the identified lists --- 
    let allTasks = [];
    
    // Run requests in parallel for performance
    const fetchPromises = targetLists.map(async (list) => {
      try {
        const res = await service.tasks.list({
          tasklist: list.id as string,
          showCompleted: showCompleted,
          showHidden: showHidden,
          // API supports date filtering directly:
          dueMin: args.dueMin || undefined, // ISO String
          dueMax: args.dueMax || undefined, // ISO String
          maxResults: 100
        });
        
        const tasks = res.data.items || [];
        
        // Tag each task with its category name so we don't lose that context
        return tasks.map(t => ({
          ...t,
          categoryName: list.title, 
          listId: list.id
        }));
      } catch (err) {
        console.warn(`Failed to fetch list ${list.title}:`, err.message);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    // Flatten the array of arrays into one big list of tasks
    allTasks = results.flat();

    // --- 4. Apply Grouping Logic (Client Side) ---
    let responseData = {};

    if (groupBy === 'category') {
      // Output: { "My Tasks": [...], "Work": [...] }
      responseData = allTasks.reduce((acc, task) => {
        const key = task.categoryName;
        if (!acc[key]) acc[key] = [];
        acc[key].push(formatTaskOutput(task));
        return acc;
      }, {});
    } else if (groupBy === 'status') {
      // Output: { "needsAction": [...], "completed": [...] }
      responseData = allTasks.reduce((acc, task) => {
        const key = task.status; // 'needsAction' or 'completed'
        if (!acc[key]) acc[key] = [];
        acc[key].push(formatTaskOutput(task));
        return acc;
      }, {});
    } else {
      // No grouping, just a clean flat list
      responseData = allTasks.map(formatTaskOutput);
    }

    return {
      status: "success",
      totalCount: allTasks.length,
      data: responseData
    };

  } catch (error) {
    console.error('Error listing Google Tasks:', error.message);
    
    if (error.response?.data?.error === 'invalid_grant') {
      return { error: "Permission denied. Please re-link your Google account." };
    }
    return { error: 'Failed to retrieve tasks.' };
  }
};

/**
 * Helper: Clean up the raw Google API object for the frontend/AI
 */
function formatTaskOutput(task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status, // 'needsAction' or 'completed'
    due: task.due ? task.due.split('T')[0] : null, // Return YYYY-MM-DD
    notes: task.notes || "",
    category: task.categoryName,
    link: task.webViewLink
  };
}
export {getCalendarEvents, setCalendarEvent, setBirthdayEvent, calenderTest, listCalendarTasks, setCalendarTask}