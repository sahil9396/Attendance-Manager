import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
// const {updateRoutes} = require('./updateRoutes');
import { updateRoutes } from './updateRoutes';
import { deleteRoutes } from './DeleteRoutes';
// const {deleteRoutes} = require('./DeleteRoutes');

import { cors } from 'hono/cors';
import {
    getCookie,
} from 'hono/cookie'


export const timetablerouter = new Hono<{
    Bindings: {
      DATABASE_URL: string,
      CLIENT_ID: string,
      CLIENT_SECRET: string,
      REDIRECT_URL: string,
    }
}>();

timetablerouter.use(async (c, next) => {
  cors({
    origin:`${c.env.REDIRECT_URL}`,
    credentials:true
  })
  await next();
});

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
          criteria: Number(inputData.criteria) || 75,
          userDetails: { connectOrCreate:{ where: { email: assignedBy }, create: { email: assignedBy } } },
          thatday: { create: datacreated }
        }
      });
      return c.json({ message: createdData });
    } catch (error) {
      // console.error(error);
      c.status(500)
      return c.json({ error, message: "An error occurred while creating the course." });
    }
});

// Route to get all courses with their days In one route.
timetablerouter.get('/getEverything', async (c) => {
  const { assignedBy } = c.req.query();
  const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
  
  try {
    const allCourses_Prisma = await prisma.user.findUnique({
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
    if (!allCourses_Prisma) {
      c.status(404);
      return c.json({ message: "User not found." });
    }

    // Transform the data to include only the necessary fields
    const allcoursesList = allCourses_Prisma.courses.map(course => ({
      IndivCourse: course.IndivCourse,
      timeofcourse: course.timeofcourse,
      Totaldays: course.Totaldays,
      present: course.present,
      absent: course.absent,
      cancelled: course.cancelled,
      criteria: course.criteria,
      day: course.thatday.map(dayCourse => dayCourse.day.day), // Extract day names
    }));

    const CourseWise= allcoursesList.map(course => ({
      course: course.IndivCourse,
      day: course.day
    }));

    const daysWithTheirCourses = allcoursesList.flatMap(course => course.day).filter((day, index, self) => self.indexOf(day) === index)
    .map(day => ({
      day,
      courses: allcoursesList
      .filter(course => course.day.includes(day))
      .map(course => course.IndivCourse),
    }));
    c.status(200);
    
    return c.json({ allcoursesList,  daysWithTheirCourses,CourseWise});
  } catch (error) {
    c.status(500)
    return c.json({ message: "Error fetching courses for the specified day." });
  }
})

// Route to get all courses of the user.
timetablerouter.get('/getallcourses_Prisma', async (c) => {
    const { assignedBy } = c.req.query();
    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
  
    try {
        const allCourses_Prisma = await prisma.courses.findMany({
        where: { userDetails: { email: assignedBy } },
        include: { thatday: true }
        });

        const filteredCourses = allCourses_Prisma.filter(course => course.thatday.length > 0);
        c.status(200)
        return c.json({ message: filteredCourses });
    } catch (error) {
        // console.error(error);
        c.status(500)
        return c.json({ message: "Error fetching all courses." });
    }
});

// Route to get the courses with their days.
timetablerouter.post('/AlldataforTimeTable', async (c) => {
    const { assignedBy } = c.req.query();
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
        // console.error(error);
        c.status(500)
        return c.json({ message: "Error fetching timetable data." });
    }
});

timetablerouter.route('/updater' , updateRoutes);
timetablerouter.route('/deleter' , deleteRoutes);
