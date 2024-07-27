import { Hono } from 'hono'
// import { oauth2 } from 'googleapis/build/src/apis/oauth2';
import {timetablerouter} from './routes/timetable';
import {calAPirouter} from './routes/calApi';
import { cors } from 'hono/cors';

const app = new Hono<{
  Bindings:{
    REDIRECT_URL:string
  }
}>()

// app.use(cors({
//   origin: 'http://localhost:5173',
//   credentials: true,
// }));
app.use(cors({
  origin: 'https://attendance-frontend-kjovk5ezp-sahil9396s-projects.vercel.app',
  credentials: true,
}));

app.route('/timetable',timetablerouter );
app.route('/gapi/api', calAPirouter);

export default app
