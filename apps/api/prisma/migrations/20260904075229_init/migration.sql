-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
