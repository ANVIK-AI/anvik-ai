// services/auth.service.js
// import prisma from "../../db/prismaClient.js";
import prisma from "../db/prismaClient.js";
import { v4 as uuidv4 } from 'uuid';

class AuthService {
  static async findOrCreateUser(profile: any, tokens: any) {
    const user = await prisma.user.findUnique({
      where: { googleId: profile.id },
    });
    const expiresAt = new Date();
    // expiresAt.setSeconnds(expiresAt.getSeconds())
    expiresAt.setSeconds(expiresAt.getSeconds() + 86400);


    if (!user) {


      const newSpace = await prisma.space.create({
        data: {
          id: uuidv4(),
          name: "My Space",  // Optional but recommended
          orgId: "default-org-id",  // You'll need to get this from the user's context
          ownerId: profile.id,  // Assuming profile contains the user's ID
          visibility: "private",  // Using the default value
          contentTextIndex: {},   // Default empty JSON
        },
      });

      const newUser = await prisma.user.create({
        data: {
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value,
          photo: profile.photos?.[0]?.value,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: expiresAt,
          spaceIds: [newSpace.id],
        },
      });
      return newUser;
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + 86400 * 1000),
        },
      });
      return user;
    }
  }
}

export { AuthService };