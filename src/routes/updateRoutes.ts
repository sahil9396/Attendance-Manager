import { Hono } from 'hono';
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import {createCalendarEvent,getDate,CheckExpiryAndAuthorization} from './calApi';
// const {createCalendarEvent, color_id, getDate} = require('./calApi');
import { cors } from 'hono/cors';

export const updateRoutes = new Hono<{
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

updateRoutes.use(async (c, next) => {
    cors({
      origin:`${c.env.REDIRECT_URL}`,
      credentials:true
    })
    await next();
});

interface eventType{
    summary: string,
    start: {
        dateTime: string,
        timeZone: string,
    },
    end: {
        dateTime: string,
        timeZone: string,
    },
    colorId: string
}

updateRoutes.put('/extraClass',CheckExpiryAndAuthorization, async (c) => {
    const { assignedBy, IndivCourse, present, absent, cancelled, status, timeofcourse }:any = await c.req.json();
    const [start, end] = timeofcourse.split(' - ').map((time:string) => time.split(" ")[0]);
    const tokens = c.get('accessToken');
    const {permission} = c.req.query();
    try {
        const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
        const updatedCourse = await prisma.courses.updateMany({
            where: {
                userDetails: {
                    email: assignedBy,
                },
                IndivCourse,
            },
            data: {
                present,
                absent,
                cancelled,
            }
        });
        if (permission) {
            const event:eventType = {
                summary: `Extra Class : ${IndivCourse}`,
                start: {
                    dateTime: `${getDate()}T${start}:00+05:30`,
                    timeZone: 'IST',
                },
                end: {
                    dateTime: `${getDate()}T${end}:00+05:30`,
                    timeZone: 'IST',
                },
                colorId:( status === '1'?'2':'11')
            };
            const createdData = await createCalendarEvent(tokens, event);
            c.status(200)
            return c.json(createdData);
        }
        c.status(200)
        return c.json(updatedCourse);
    } catch (error) {
        // console.error(error);
        c.status(500)
        return c.json({
            error,
            message: "Error updating attendance.",
        });
    }
})

// Update the present, absent, and cancelled classes for that user
updateRoutes.put('/updateAttendance',CheckExpiryAndAuthorization, async (c) => {
    const { assignedBy, IndivCourse, present, absent, cancelled, status, timeofcourse }:any = await c.req.json();
    const tokens = c.get('accessToken');

    const [start, end] = timeofcourse.split(' - ').map((time:string) => time.split(" ")[0]);

    try {
        const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
        const updatedCourse = await prisma.courses.updateMany({
            where: {
                userDetails: {
                    email: assignedBy,
                },
                IndivCourse,
            },
            data: {
                present,
                absent,
                cancelled,
            }
        });
        const event:eventType = {
            summary: IndivCourse,
            start: {
                dateTime: `${getDate()}T${start}:00+05:30`,
                timeZone: 'IST',
            },
            end: {
                dateTime: `${getDate()}T${end}:00+05:30`,
                timeZone: 'IST',
            },
            colorId:( status === 'p'?'2': status === 'a' ?'11':'5')
        };
        const createdData = await createCalendarEvent(tokens, event);
        c.status(200)
        return c.json({updatedCourse, createdData});
    } catch (error) {
        // console.error(error);
        c.status(500)
        return c.json({
            error,
            message: "Error updating attendance.",
        });
    }
});

// Update attendance based on action letter for a set of courses
updateRoutes.put('/updateSetOfCourses', async (c) => {
    const { assignedBy, actionletter, courses } = await c.req.json();

    try {
        const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
        const updatePromises = courses.map((course: { present: number; absent: number; cancelled: number; IndivCourse: string }) => {
            let updateData: Partial<{ present: number; absent: number; cancelled: number }> = {};
            switch (actionletter) {
                case 'p':
                    updateData.present = course.present + 1;
                    break;
                case 'a':
                    updateData.absent = course.absent + 1;
                    break;
                case 'c':
                    updateData.cancelled = course.cancelled + 1;
                    break;
                default:
                    throw new Error('Invalid action letter');
            }

            return prisma.courses.updateMany({
                where: {
                    userDetails: { email: assignedBy },
                    IndivCourse: course.IndivCourse,
                },
                data: updateData,
            });
        });

        const result = await prisma.$transaction(updatePromises);
        c.status(200)
        return c.json(result);
    } catch (error) {
        // console.error(error);
        c.status(500)
        return c.json({
            error,
            message: "Error updating the set of courses.",
        });
    }
});

// Reset individual course for that user
updateRoutes.put('/resetIndividualCourse', async (c) => {
    const { assignedBy, IndivCourse } = await c.req.json();

    try {
        const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
        const resetCourse = await prisma.courses.updateMany({
            where: {
                userDetails: { email: assignedBy },
                IndivCourse,
            },
            data: {
                present: 0,
                absent: 0,
                cancelled: 0,
            }
        });

        c.status(200)
        return c.json(resetCourse);
    } catch (error) {
        // console.error(error);
        c.status(500)
        return c.json({
            error,
            message: "Error resetting individual course.",
        });
    }
});

// Reset the present, absent, and cancelled classes for every course for that user
updateRoutes.put('/resetAttendance', async (c) => {
    const { assignedBy } = await c.req.json();

    try {
        const prisma = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL }).$extends(withAccelerate());
        const resetCourses = await prisma.courses.updateMany({
            where: {
                userDetails: { email: assignedBy },
            },
            data: {
                present: 0,
                absent: 0,
                cancelled: 0,
            }
        });

        c.status(200)
        return c.json(resetCourses);
    } catch (error) {
        // console.error(error);
        c.status(500)
        return c.json({
            error,
            message: "Error resetting attendance.",
        });
    }
});

// export default updateRoutes;