import { Hono } from 'hono'
// import { oauth2 } from 'googleapis/build/src/apis/oauth2';
import {timetablerouter} from './routes/timetable';
import {calAPirouter} from './routes/calApi';
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import { cors } from 'hono/cors';
import { getCookie } from 'hono/cookie';
const app = new Hono<{
  Bindings:{
    JWT_KEY:string,
    DATABASE_URL:string,
  }
}>()

app.use(cors({
  origin: ['https://attendance-frontend-k2h04hwgi-sahil9396s-projects.vercel.app','http://localhost:5173'],
  credentials: true,
}));

app.get('/', async (c) => {
  const { assignedBy, day } = c.req.query();
  const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
  
  try {
    const allCourses = await prisma.user.findUnique({
      where: { email: assignedBy },
      include: {
        courses: {
          include: {
            thatday: {
              include: {
                day: true,
              },
            },
          },
        },
      },
    });
    if (!allCourses) {
      c.status(404);
      return c.json({ message: "User not found." });
    }

    // Transform the data to include only the necessary fields
    const coursesWithDays = allCourses.courses.map(course => ({
      IndivCourse: course.IndivCourse,
      timeofcourse: course.timeofcourse,
      Totaldays: course.Totaldays,
      present: course.present,
      absent: course.absent,
      cancelled: course.cancelled,
      criteria: course.criteria,
      day: course.thatday.map(dayCourse => dayCourse.day.day), // Extract day names
    }));
    const daysWithTheirCourses = coursesWithDays.flatMap(course => course.day).filter((day, index, self) => self.indexOf(day) === index)
    .map(day => ({
      day,
      courses: coursesWithDays
      .filter(course => course.day.includes(day))
      .map(course => course.IndivCourse),
    }));
    c.status(200);
    return c.json({ coursesWithDays,  daysWithTheirCourses });
  } catch (error) {
    c.status(500)
    return c.json({ message: "Error fetching courses for the specified day." });
  }
})

// prisma.user.findMany({
//   where: {
//     OR: [
//       {
//         name: {
//           startsWith: 'E',
//         },
//       },
//       {
//         AND: {
//           profileViews: {
//             gt: 0,
//           },
//           role: {
//             equals: 'ADMIN',
//           },
//         },
//       },
//     ],
//   },
// })

app.route('/timetable',timetablerouter );
app.route('/gapi/api', calAPirouter);

export default app
