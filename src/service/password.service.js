// services/password.service.js
import bcrypt from 'bcryptjs';

export async function generateDefaultPassword() {
    return '123';
}

export async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}