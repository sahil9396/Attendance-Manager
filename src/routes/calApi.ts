import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import { google } from 'googleapis';
const cors = require('cors');
const cookieParser = require('cookie-parser');
import {
    getCookie,
    getSignedCookie,
    setCookie,
    setSignedCookie,
    deleteCookie,
} from 'hono/cookie'

const calAPirouter = new Hono<{
  Bindings: {
    DATABASE_URL: string,
    CLIENT_ID: string,
    CLIENT_SECRET: string,
    REDIRECT_URL: string,
  }
}>();

calAPirouter.use(cookieParser());
calAPirouter.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URL;

// validate the tokens
async function validateToken(c:any) {
  const { refreshToken } = c.req.cookie();
  let { authorization: accessToken, username } = c.req.header();
  if (!accessToken || !refreshToken || !username) {
    return c.status(401).json({ message: 'Unauthorized: Missing credentials' });
  }
  accessToken = accessToken.split(' ')[1];

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  await oAuth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  try {
    const TokenInfo = await oAuth2Client.getTokenInfo(accessToken);

    if (TokenInfo.email_verified === true && TokenInfo.email === username) {
      await c.next();
    } else {
      console.log(TokenInfo.email === username, TokenInfo.email_verified);
      return c.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    console.error('Error validating token:', error);
    return c.status(500).json({ message: 'Internal Server Error' });
  }
}

const color_id = {
  'p': '2',
  'a': '11',
  'c': '5'
};

interface createType {
  accessToken: string,
  refreshToken: string,
  eventDetails: any
}

// Function to set credentials and create an event
async function createCalendarEvent({ accessToken, refreshToken, eventDetails }: createType) {
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  oAuth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

  try {
    const response = await calendar.events.insert({
        calendarId:'primary',
        requestBody: eventDetails,
        // resource: eventDetails,
    });
    return response;
  } catch (error) {
    console.error('Error creating event:', error);
    throw new Error('Error creating event: ' + error);
  }
}

// Helper function to get the current date in YYYY-MM-DD format.
const getDate = () => {
  const today = new Date();
  let date = (today.getDate()).toString().padStart(2, '0');
  let month = (today.getMonth() + 1).toString().padStart(2, '0');
  let year = today.getFullYear().toString();
  return `${year}-${month}-${date}`;
}

// Function to show events on the user's primary calendar for the current date.
const showEvent = async (MaxDays:number, auth:any) => {
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const res = await calendar.events.list({
      calendarId: 'en.indian#holiday@group.v.calendar.google.com',
      timeMin: `${getDate()}T00:00:00+05:30`,
      maxResults: MaxDays,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = res.data.items;
    if (!events || events.length === 0) {
      console.log('No upcoming events found.');
      return [];
    }
    return events;
  } catch (error) {
    console.error('Error showing events:', error);
    throw new Error('Error showing events: ' + error);
  }
}

calAPirouter.get('/FutureEvents', validateToken, async (c) => {
  const { refreshToken } = getCookie(c);
  let { authorization: accessToken } = c.req.header();
  accessToken = accessToken.split(' ')[1];

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  await oAuth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  console.log("It is starting!!!");

  try {
    const future_events = await showEvent(2, oAuth2Client);
    console.log("It is done!!!");
    return c.json(future_events);
  } catch (error) {
    console.error('Error fetching future events:', error);
    c.status(500);
    return c.json({ message: 'Internal Server Error' });
  }
});

calAPirouter.get('/auth/check', async (c) => {
  const { refreshToken } = getCookie(c);
  if (!refreshToken) {
    return c.json({
      LoginIn: false,
      refreshToken: false
    });
  }
  console.log(refreshToken);
  try {
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    const accessToken = await oAuth2Client.getAccessToken();
    return c.json({ LoginIn: true, accessToken: accessToken.token });
  } catch (error) {
    console.log('Error in check:', error);
    c.status(500);
    return c.json({
      LoginIn: false,
      refreshToken: false,
      message: 'Internal Server Error'
    });
  }
});

calAPirouter.get('/oauth2callback', async (c) => {
  const { refreshToken } = getCookie(c);
  const { authorization: Authorization } = c.req.header();
  const code = Authorization.split(' ')[1];
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

  try {
    if (!refreshToken) {
      const { tokens } = await oAuth2Client.getToken(code);
      await oAuth2Client.setCredentials(tokens);
      setCookie(c,'refreshToken', tokens.refresh_token || '', { httpOnly: true, secure: false });
      return c.json({ accessToken: tokens.access_token });
    }
    await oAuth2Client.setCredentials({ refresh_token: refreshToken });
    const accessTokenGet = await oAuth2Client.getAccessToken();
    return c.json({ accessToken: accessTokenGet.token });
  } catch (error) {
    console.error('Error getting accessToken:', error);
    c.status(500);
    return c.json({ message: 'Failed to get accessToken' });
  }
});

calAPirouter.get('/userinfo', async (c) => {
  const { refreshToken } = getCookie(c);
  const { authorization: Authorization } = c.req.header();
  const code = Authorization.split(' ')[1];
  try {
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
    oAuth2Client.setCredentials({ access_token: code, refresh_token: refreshToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const userInfo = await oauth2.userinfo.get();
    return c.json(userInfo.data);
  } catch (error) {
    console.error('Error getting user info:', error);
    c.status(500);
    return c.json({ message: 'Error getting user info' });
  }
});

calAPirouter.get('/logout', async (c) => {
    deleteCookie(c,"refreshToken");
    return c.json({
        message: "You have logged out successfully"
    });
});

export default calAPirouter;
