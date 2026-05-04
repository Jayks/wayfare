import { z } from "zod";

export const createTripSchema = z.object({
  name: z.string().min(1, "Trip name is required").max(100),
  description: z.string().max(500).optional(),
  coverPhotoUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  defaultCurrency: z.string().length(3),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().positive().optional(),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const addGuestSchema = z.object({
  tripId: z.string().uuid(),
  guestName: z.string().min(1, "Name is required").max(100),
});

export type AddGuestInput = z.infer<typeof addGuestSchema>;
