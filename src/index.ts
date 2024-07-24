import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'
import { getCookie , setCookie } from 'hono/cookie'

const app = new Hono<{
  Bindings:{
    DATABASE_URL: string
  }
}>()

app.get('/start', async (c) => {
  const body = await c.req.json();
  // const prisma = new PrismaClient({datasourceUrl: c.env.DATABASE_URL,}).$extends(withAccelerate());
  setCookie(c,"name", "value",{
    httpOnly: true,
    secure: false,
  });
  const { authorization} = await c.req.header();
  const head = await c.req.header();
  const cok = await getCookie(c);
  const query = await c.req.query();
  // console.log(body, head, query,cok);
  // return c.text('Hello Hono!');
  return c.json({body, head, query,cok});
})

export default app
