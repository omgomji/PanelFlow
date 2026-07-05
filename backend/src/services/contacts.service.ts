/**
 * Contacts Service
 *
 * Business logic for admin contacts CRUD.
 */
import { prisma } from '../config/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';

type ContactCreateInput = {
  name: string;
  email: string;
  phone?: string;
  note?: string;
};

type ContactUpdateInput = {
  name?: string;
  email?: string;
  phone?: string;
  note?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return String(email).trim().toLowerCase();
}

function cleanOptionalText(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text : undefined;
}

export const contactsService = {
  /** Return all contacts owned by a user. */
  async findAllByUser(userId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.contact.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.contact.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /** Create a new contact with user-scoped email dedupe. */
  async create(userId: number, data: ContactCreateInput) {
    const name = String(data.name).trim();
    const email = normalizeEmail(data.email);
    const phone = cleanOptionalText(data.phone);
    const note = cleanOptionalText(data.note);

    if (!name) {
      throw new BadRequestError('name is required');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestError('Invalid email format');
    }

    const existing = await prisma.contact.findUnique({
      where: { userId_email: { userId, email } },
    });

    if (existing) {
      throw new BadRequestError('A contact with this email already exists');
    }

    return prisma.contact.create({
      data: {
        userId,
        name,
        email,
        phone,
        note,
      },
    });
  },

  /** Update an existing contact with ownership + dedupe checks. */
  async update(userId: number, id: number, data: ContactUpdateInput) {
    const contact = await prisma.contact.findUnique({ where: { id } });

    if (!contact || contact.userId !== userId) {
      throw new NotFoundError('Contact not found');
    }

    const nextName =
      data.name !== undefined ? String(data.name).trim() : contact.name;
    const nextEmail =
      data.email !== undefined ? normalizeEmail(data.email) : contact.email;

    if (!nextName) {
      throw new BadRequestError('name cannot be empty');
    }

    if (!EMAIL_REGEX.test(nextEmail)) {
      throw new BadRequestError('Invalid email format');
    }

    if (nextEmail !== contact.email) {
      const existing = await prisma.contact.findUnique({
        where: { userId_email: { userId, email: nextEmail } },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestError('A contact with this email already exists');
      }
    }

    return prisma.contact.update({
      where: { id },
      data: {
        name: nextName,
        email: nextEmail,
        phone:
          data.phone !== undefined ? cleanOptionalText(data.phone) : undefined,
        note: data.note !== undefined ? cleanOptionalText(data.note) : undefined,
      },
    });
  },

  /** Delete a contact owned by user. */
  async remove(userId: number, id: number) {
    const contact = await prisma.contact.findUnique({ where: { id } });

    if (!contact || contact.userId !== userId) {
      throw new NotFoundError('Contact not found');
    }

    await prisma.contact.delete({ where: { id } });
    return { success: true };
  },
};
