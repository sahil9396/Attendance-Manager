import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import { cors } from 'hono/cors';

import {
    getCookie,
    getSignedCookie,
    setCookie,
    setSignedCookie,
    deleteCookie,
} from 'hono/cookie'

export const calAPirouter = new Hono<{
  Bindings: {
    DATABASE_URL: string,
    CLIENT_ID: string,
    CLIENT_SECRET: string,
    REDIRECT_URL: string,
  },
  Variables: {
    accessToken: string,
  }
}>();

calAPirouter.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

async function getTokenHttp(things:any,client_id:string,client_secret:string) {
  const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({...things,client_id,client_secret}),
  });

  const tokenData = await tokenResponse.json();
 
  return tokenData;
}

async function CheckExpiryAndAuthorization(c:any) {
  let {authorization:accessToken} = c.req.header();
  const {expiraryTime} = c.req.query();
  const {refreshToken} = getCookie(c);
  accessToken = accessToken.split(' ')[1];
  if (accessToken) {
      c.status(401)
      return c.json({
          message: 'Unauthorized',
      });
  }
  if (expiraryTime < 0) {
    const { accessToken } : any = await getTokenHttp({refresh_token: refreshToken, grant_type: 'refresh_token'},c.env.CLIENT_ID,c.env.CLIENT_SECRET);
    c.set("accessToken", accessToken);
  }
  await c.next();
}

calAPirouter.get('/oauth2callback', async (c) => {
  const {  refreshToken } = getCookie(c);
  const {  authorization : Authorization} = c.req.header();
  const code = Authorization.split(' ')[1];

  const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
  
  try {
      const tokenDatas = refreshToken ? {refresh_token: refreshToken, grant_type: 'refresh_token'} : {code, grant_type: 'authorization_code', redirect_uri: c.env.REDIRECT_URL};
      const TokenData :any = await getTokenHttp(tokenDatas,c.env.CLIENT_ID,c.env.CLIENT_SECRET);
      !refreshToken && setCookie(c,'refreshToken', TokenData.refresh_token, {httpOnly: true,secure: false});
      !refreshToken && await prisma.user.create({
          data: {
              email: TokenData.email,
          }
      })
      c.status(200);
      return c.json({token:TokenData});
  } catch (error) {
      c.status(500);
      c.json({
          message: 'Error getting accessToken',
      });
  }
});

calAPirouter.get('/auth/check', async (c) => {
  const {refreshToken} = getCookie(c);
  const sendingData = !refreshToken ? {
      LoginIn: false,
      refreshToken: false
  } : {
      LoginIn: true,
      token: await getTokenHttp({refreshToken, grant_type: 'refresh_token'},c.env.CLIENT_ID,c.env.CLIENT_SECRET)
  }
  c.status(200);
  return c.json({sendingData});
});

calAPirouter.get('/logout',CheckExpiryAndAuthorization, async (c) => {
  deleteCookie(c,"refreshToken");
  return c.json({
      message:"You are Loggout successfully"
  })
});

calAPirouter.get('/userinfo', async (c) => {

  const {refreshToken} = getCookie(c);

  const {  authorization : Authorization} = c.req.header();
  const accessToken = Authorization.split(' ')[1];

  try {
      const GOOGLE_USERINFO_ENDPOINT = `https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=${accessToken}`;
      const data = await fetch(GOOGLE_USERINFO_ENDPOINT, {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`
      }});
      const dataParses = await data.json();
      return c.json({dataParses})
  } catch (error) {
      console.error('Error getting user info:', error);
      c.status(500)
      return c.json({
          error
      });
  }
});

// Helper function to get the current date in YYYY-MM-DD format.
export const getDate = () => {
  const today = new Date();
  let date = (today.getDate()).toString().padStart(2, '0');
  let month = (today.getMonth() + 1).toString().padStart(2, '0');
  let year = today.getFullYear().toString();
  return `${year}-${month}-${date}`;
}

// Function to set credentials and create an event
export async function createCalendarEvent(accessToken:string, eventDetails:any) {
  try {
      const GOOGLE_CREATE_ENDPOINT = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
      let response = await fetch(GOOGLE_CREATE_ENDPOINT, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify(eventDetails),
      });
      response = await response.json();
      return response;
  } catch (error) {
      throw new Error('Error creating event: ' + error);
  }
}

const event = {
  summary: 'Google I/O 2022',
  location: '800 Howard St., San Francisco, CA 94103',
  description: 'A chance to hear more about Google\'s developer products.',
  start: {
      dateTime: '2024-07-26T09:00:00+05:30',
      timeZone: 'IST',
  },
  end: {
      dateTime: '2024-07-26T17:00:00+05:30',
      timeZone: 'IST',
  },
}

// const accessToken = "ya29.a0AXooCgvOUwcxWAfT45wX41vJL9R8zharY9om1VwfSFEp9794RKCYstVCW9yRD_YBgxlZ8vKXPUtx3YHt0RjBHBp1ck74XL2-ZrifahAFWeZ_yIBPt17HMr_inmlGejNS6fzr20zP8HkLeXPtHA44TpWA-gTu7zPowhdtUwaCgYKAVwSARMSFQHGX2MiCV4UfyRdMZ7YtjYjH40URQ0173"

// Function to show events on the user's primary calendar for the current date.
const showEvent = async (MaxDays:number,accessToken:string) => {
  const GOOGLE_VIEW_ENDPOINT = `https://www.googleapis.com/calendar/v3/calendars/en.indian%23holiday%40group.v.calendar.google.com/events?timeMin=${getDate()}T00%3A00%3A00%2B05%3A30&maxResults=${MaxDays}&singleEvents=true&orderBy=startTime&access_token=${accessToken}`;
  const res = await fetch(GOOGLE_VIEW_ENDPOINT,{
      method: 'GET',
      headers: {
          'Content-Type': 'application/json',
      }
  });
  const events:any = await res.json();
  return events.items;
}

calAPirouter.get('/FutureEvents', async (c) => {
  const {refreshToken} = getCookie(c);
  let {authorization:accessToken} = c.req.header();
  accessToken = accessToken.split(' ')[1];
  try {
      const future_events = await showEvent(2,accessToken);
      c.json({future_events});
  } catch (error) {
      c.status(500)
      c.json({ error: error });
  }
});

// const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
const color_id = {
  'p': '2',
  'a': '11',
  'c': '5'
};
