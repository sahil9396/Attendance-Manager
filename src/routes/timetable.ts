import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
const cors = require('cors');
import {
    getCookie,
} from 'hono/cookie'


const timetablerouter = new Hono<{
    Bindings: {
      DATABASE_URL: string,
      CLIENT_ID: string,
      CLIENT_SECRET: string,
      REDIRECT_URL: string,
    }
}>();

timetablerouter.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

timetablerouter.post('/create', async (c) => {
    const { assignedBy, inputData, day } = await c.req.json();
    const datacreated = day.map((val: any) => ({
      assignedBy,
      assignedAt: new Date(),
      day: {
        connectOrCreate: {
          where: { day: val },
          create: { day: val }
        }
      }
    }));
  
    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
    
    try {
      const courseExists = await prisma.courses.findFirst({
        where: {
          IndivCourse: inputData.IndivCourse,
          userDetails: { email: assignedBy }
        }
      });
  
      if (courseExists) {
        c.status(200)
        return c.json({ message: "Course already exists", exists: true });
      }
  
      const createdData = await prisma.courses.create({
        data: {
          IndivCourse: inputData.IndivCourse,
          timeofcourse: `${inputData.startTime} - ${inputData.endTime}`,
          Totaldays: inputData.Totaldays || 35,
          present: inputData.present || 0,
          absent: inputData.absent || 0,
          cancelled: inputData.cancelled || 0,
          criteria: inputData.criteria || "75%",
          userDetails: { connect: { email: assignedBy } },
          thatday: { create: datacreated }
        }
      });
      return c.json({ message: createdData });
    } catch (error) {
      console.error(error);
    c.status(500)
    return c.json({ error, message: "An error occurred while creating the course." });
    }
});

// Route to get all courses of that user on a specific day.
timetablerouter.get('/getallcoursesAtthatday', async (c) => {
    const { assignedBy, day } = getCookie(c);
    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
  
    try {
      const allCourses = await prisma.courses.findMany({
        where: {
          userDetails: { email: assignedBy },
          thatday: {
            some: { day: { day: day } }
          }
        }
      });
    c.status(200)
    return c.json({ message: allCourses });
    } catch (error) {
      console.error(error);
    c.status(500)
    return c.json({ message: "Error fetching courses for the specified day." });
    }
});

// Route to get all courses of the user.
timetablerouter.get('/getallcourses', async (c) => {
    const { assignedBy } = getCookie(c);
    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
  
    try {
        const allCourses = await prisma.courses.findMany({
        where: { userDetails: { email: assignedBy } },
        include: { thatday: true }
        });

        const filteredCourses = allCourses.filter(course => course.thatday.length > 0);
        c.status(200)
        return c.json({ message: filteredCourses });
    } catch (error) {
        console.error(error);
        c.status(500)
        return c.json({ message: "Error fetching all courses." });
    }
});

// Route to get the courses with their days.
timetablerouter.post('/AlldataforTimeTable', async (c) => {
    const { assignedBy } = getCookie(c);
    const { courseNames } = await c.req.json();
    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
  
    try {
        const daysPromise = courseNames.map((course: any) => 
            prisma.days.findMany({
                where: {
                course: {
                    some: {
                    assignedBy,
                    course: {
                        IndivCourse: course.IndivCourse,
                        userDetails: { email: assignedBy }
                    }
                    }
                }
                }
        }));
  
        const promiseComplete = await prisma.$transaction(daysPromise);

        const coursesWithTheirDays = promiseComplete.map((days, index) => ({
            course: courseNames[index].IndivCourse,
            day: days.map((day:any) => day.day)
        }));
  
        const daysWithTheirCourses = coursesWithTheirDays.flatMap(course => course.day)
            .filter((day, index, self) => self.indexOf(day) === index)
            .map(day => ({
                day,
                courses: coursesWithTheirDays
                .filter(course => course.day.includes(day))
                .map(course => course.course)
        }));
  
        c.status(200)
        return c.json({ coursesWithTheirDays, daysWithTheirCourses });
    } catch (error) {
        console.error(error);
        c.status(500)
        return c.json({ message: "Error fetching timetable data." });
    }
});
// timetablerouter.use('/updater' , updateRoutes);
// timetablerouter.use('/deleter' , deleteRoutes);
