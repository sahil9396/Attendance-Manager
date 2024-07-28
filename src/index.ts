import { Hono } from 'hono'
// import { oauth2 } from 'googleapis/build/src/apis/oauth2';
import {timetablerouter} from './routes/timetable';
import {calAPirouter} from './routes/calApi';
import { cors } from 'hono/cors';
import {CookieStore, sessionMiddleware,Session} from "hono-sessions";
import { setCookie } from 'hono/cookie';
const app = new Hono<{
  Bindings:{
    JWT_KEY:string
  }
}>()

app.use(cors({
  origin: ['https://attendance-frontend-nqvemkze3-sahil9396s-projects.vercel.app','http://localhost:5173'],
  credentials: true,
}));

app.route('/timetable',timetablerouter );
app.route('/gapi/api', calAPirouter);

export default app
