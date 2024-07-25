import { Hono } from 'hono'
// import { oauth2 } from 'googleapis/build/src/apis/oauth2';
import {timetablerouter} from './routes/timetable';
import {calAPirouter} from './routes/calApi';
import { cors } from 'hono/cors';

const app = new Hono()


app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.get('/stsrt',async (c)=>{
  console.log("ji");
  try {
    c.status(200);
    return c.json({
      message:"Hi there!!!"
    })
  } catch (error) {
    console.log(error);
    c.status(500);
    c.json({
      messgae:"Hi there!!!"
    })
  }
})

app.route('/timetable',timetablerouter );
app.route('/gapi/api', calAPirouter);

export default app
