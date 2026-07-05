/**
 * Availability Controller
 *
 * Handles GET (read schedule) and PUT (upsert schedule) for
 * the logged-in user's weekly availability configuration.
 */
import { Request, Response } from 'express';
import { availabilityService } from '../services/availability.service';
import { BadRequestError } from '../utils/errors';
import {
  AvailabilityDayPayload,
  AvailabilityDateOverridePayload,
  isValidTimezone,
  validateDays,
  validateDateOverrides,
  parseBufferMinutes,
  parseIntegerInRange,
  parseBoolean,
} from '../utils/availability.validation';
import {
  IST_TIMEZONE,
  convertDaysToIst,
  convertDateOverridesToIst,
} from '../utils/date.utils';

export const availabilityController = {
  /** GET /api/availability */
  async get(req: Request, res: Response) {
    const userId = req.user!.id;
    const schedule = await availabilityService.getByUser(userId);

    if (!schedule) {
      return res.json({ message: 'No schedule found' });
    }

    res.json(schedule);
  },

  /** PUT /api/availability */
  async upsert(req: Request, res: Response) {
    const userId = req.user!.id;
    const {
      timezone,
      days,
      dateOverrides,
      beforeEventBufferMinutes,
      afterEventBufferMinutes,
      startTimeIncrementMinutes,
      minimumNoticeMinutes,
      maximumDaysInFuture,
      allowBackToBack,
    } = req.body;

    // Validation
    if (!timezone || !Array.isArray(days)) {
      throw new BadRequestError('timezone and days array are required');
    }

    const sourceTimezone = String(timezone);

    if (!isValidTimezone(sourceTimezone)) {
      throw new BadRequestError('Invalid timezone value');
    }

    // Validate raw payload first so malformed times return 400s
    // instead of surfacing as conversion-time exceptions.
    validateDays(days as AvailabilityDayPayload[]);
    if (dateOverrides !== undefined) {
      if (!Array.isArray(dateOverrides)) {
        throw new BadRequestError('dateOverrides must be an array');
      }
      validateDateOverrides(dateOverrides as AvailabilityDateOverridePayload[]);
    }

    const normalizedDays = convertDaysToIst(
      sourceTimezone,
      days as AvailabilityDayPayload[]
    );

    let normalizedDateOverrides: AvailabilityDateOverridePayload[] | undefined;
    if (dateOverrides !== undefined) {
      normalizedDateOverrides = convertDateOverridesToIst(
        sourceTimezone,
        dateOverrides as AvailabilityDateOverridePayload[]
      );
      validateDateOverrides(normalizedDateOverrides);
    }

    validateDays(normalizedDays);

    const parsedBeforeEventBufferMinutes = parseBufferMinutes(
      beforeEventBufferMinutes,
      'beforeEventBufferMinutes'
    );
    const parsedAfterEventBufferMinutes = parseBufferMinutes(
      afterEventBufferMinutes,
      'afterEventBufferMinutes'
    );
    const parsedStartTimeIncrementMinutes = parseIntegerInRange(
      startTimeIncrementMinutes,
      'startTimeIncrementMinutes',
      5,
      180
    );
    const parsedMinimumNoticeMinutes = parseIntegerInRange(
      minimumNoticeMinutes,
      'minimumNoticeMinutes',
      0,
      10080
    );
    const parsedMaximumDaysInFuture = parseIntegerInRange(
      maximumDaysInFuture,
      'maximumDaysInFuture',
      1,
      365
    );
    const parsedAllowBackToBack = parseBoolean(
      allowBackToBack,
      'allowBackToBack'
    );

    const schedule = await availabilityService.upsert(userId, IST_TIMEZONE, normalizedDays, {
      beforeEventBufferMinutes: parsedBeforeEventBufferMinutes,
      afterEventBufferMinutes: parsedAfterEventBufferMinutes,
      startTimeIncrementMinutes: parsedStartTimeIncrementMinutes,
      minimumNoticeMinutes: parsedMinimumNoticeMinutes,
      maximumDaysInFuture: parsedMaximumDaysInFuture,
      allowBackToBack: parsedAllowBackToBack,
      dateOverrides: normalizedDateOverrides,
    });
    res.json(schedule);
  },
};
