import { Hono } from 'hono'
// import { oauth2 } from 'googleapis/build/src/apis/oauth2';
import {timetablerouter} from './routes/timetable';
import {calAPirouter} from './routes/calApi';
import { cors } from 'hono/cors';
import {CookieStore, sessionMiddleware} from "hono-sessions";

const app = new Hono<{
  Bindings:{
    JWT_KEY:string
  }
}>()

app.use(cors({
  origin: ['https://attendance-frontend-nqvemkze3-sahil9396s-projects.vercel.app','http://localhost:5173'],
  credentials: true,
}));

const sessionStore = new CookieStore();

app.use('*', async(c,next)=>{
  sessionMiddleware({
    store: sessionStore,
    encryptionKey: c.env.JWT_KEY,
    // expireAfterSeconds: 900,
    sessionCookieName: 'session',
    cookieOptions: {
      httpOnly: true,
      secure: false,
      sameSite: 'none',
    },
  })
  await next();
})

app.get('/', async (c) => {
  // sessionStore.createSession(c);
  let session = c.get('session')
  c.status(200);
  return c.json({ message: 'Hello World' });
});

app.route('/timetable',timetablerouter );
app.route('/gapi/api', calAPirouter);

export default app
