import prisma from "../../db/prismaClient.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);


export async function registerUser(email: string, password: string, name?: string) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({ data: { email, passwordHash, name } });
    return user;
}


export async function validateUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
}


export function signAccessToken(userId: number) {
    return jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET);
}