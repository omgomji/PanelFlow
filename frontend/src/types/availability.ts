export interface AvailabilityIntervalPayload {
  startTime: string;
  endTime: string;
}

export interface AvailabilityDayPayload {
  dayOfWeek: number;
  intervals: AvailabilityIntervalPayload[];
}

export interface AvailabilityDateOverridePayload {
  date: string;
  intervals: AvailabilityIntervalPayload[];
}

export interface AvailabilityPayload {
  timezone: string;
  days: AvailabilityDayPayload[];
  dateOverrides?: AvailabilityDateOverridePayload[];
  beforeEventBufferMinutes?: number;
  afterEventBufferMinutes?: number;
  startTimeIncrementMinutes?: number;
  minimumNoticeMinutes?: number;
  maximumDaysInFuture?: number;
  allowBackToBack?: boolean;
}

export interface AvailabilitySchedule {
  message?: string;
  timezone?: string;
  days?: AvailabilityDayPayload[];
  dateOverrides?: AvailabilityDateOverridePayload[];
  beforeEventBufferMinutes?: number;
  afterEventBufferMinutes?: number;
  startTimeIncrementMinutes?: number;
  minimumNoticeMinutes?: number;
  maximumDaysInFuture?: number;
  allowBackToBack?: boolean;
}
