import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
// const cors = require('cors');
import { cors } from 'hono/cors';

export const deleteRoutes = new Hono<{
  Bindings: {
    DATABASE_URL: string,
    CLIENT_ID: string,
    CLIENT_SECRET: string,
    REDIRECT_URL: string,
  }
}>();

deleteRoutes.use(async (c, next) => {
  cors({
    origin:`${c.env.REDIRECT_URL}`
  })
  await next();
});

// Delete a particular course for that user
deleteRoutes.get('/deleteCourse', async (c) => {
  const { IndivCourse } = c.req.query();
  const assignedBy = c.req.header().assignedBy;

  try {
        const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
        const deletedDayCourse = prisma.day_Course.deleteMany({
        where: {
            assignedBy,
            course: {
            IndivCourse,
            userDetails: {
                email: assignedBy,
            },
            }
        }
        });

        const deletedCourse = prisma.courses.deleteMany({
          where: {
              IndivCourse,
              userDetails: {
              email: assignedBy,
              },
          }
        });

        const result = await prisma.$transaction([deletedDayCourse, deletedCourse]);
        // console.log(result);
        c.status(200);
        return c.json(result);
  } catch (error) {
    // console.error(error);
    c.status(500)
    return c.json({
    error,
    message: "Error deleting the course.",
    });
  }
});

// Delete a particular day for that user
deleteRoutes.get('/deleteDay', async (c) => {
  const { day } = c.req.query();
  const assignedBy = c.req.header().assignedBy;

  try {
    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
    const deletedDayCourse = await prisma.day_Course.deleteMany({
      where: {
        assignedBy,
        day: {
          day,
        },
        course: {
          userDetails: {
            email: assignedBy,
          },
        }
      }
    });

    c.status(200)
    return c.json(deletedDayCourse);
  } catch (error) {
        // console.error(error);
        c.status(500)
        return c.json({
        error,
        message: "Error deleting the day.",
        });
  }
});

// Delete all courses
deleteRoutes.get('/deleteallCourse', async (c) => {
  const assignedBy = c.req.header().assignedBy;

  try {
    const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
    const allDeletedCoursesForThatDay = prisma.day_Course.deleteMany({
      where: {
        assignedBy,
      }
    });

    const allDeletedDays = prisma.courses.deleteMany({
      where: {
        userDetails: {
          email: assignedBy,
        }
      }
    });

    const result = await prisma.$transaction([allDeletedCoursesForThatDay, allDeletedDays]);
    c.status(200);
    return c.json(result);
  } catch (error) {
    // console.error(error);
    c.status(500)
    return c.json({
    error,
    message: "Error deleting all courses.",
    });
  }
});

// export deleteRoutes;
