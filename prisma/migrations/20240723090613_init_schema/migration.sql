-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courses" (
    "id" SERIAL NOT NULL,
    "IndivCourse" TEXT NOT NULL,
    "timeofcourse" TEXT NOT NULL,
    "Totaldays" INTEGER NOT NULL DEFAULT 35,
    "present" INTEGER NOT NULL DEFAULT 0,
    "absent" INTEGER NOT NULL DEFAULT 0,
    "cancelled" INTEGER NOT NULL DEFAULT 0,
    "criteria" INTEGER NOT NULL DEFAULT 75,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Days" (
    "id" SERIAL NOT NULL,
    "day" TEXT NOT NULL,

    CONSTRAINT "Days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Day_Course" (
    "courseId" INTEGER NOT NULL,
    "dayId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "Day_Course_pkey" PRIMARY KEY ("dayId","courseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Days_day_key" ON "Days"("day");

-- AddForeignKey
ALTER TABLE "Courses" ADD CONSTRAINT "Courses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Day_Course" ADD CONSTRAINT "Day_Course_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Day_Course" ADD CONSTRAINT "Day_Course_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
