import { z } from 'zod';

// Configuration validation schema
export const configurationSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  
  configuration_name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  
  total_price: z
    .number()
    .positive('Price must be positive')
    .max(1000000, 'Price exceeds maximum')
    .multipleOf(0.01, 'Invalid price format'),
  
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be positive')
    .max(1000, 'Quantity exceeds maximum')
    .default(1),
  
  configuration_data: z.record(
    z.string().uuid('Invalid option ID'),
    z.string().uuid('Invalid value ID')
  ),
  
  session_id: z
    .string()
    .trim()
    .min(10, 'Invalid session ID')
    .max(100, 'Session ID too long')
    .optional(),
  
  user_id: z
    .string()
    .uuid('Invalid user ID')
    .optional()
});

export type ConfigurationInput = z.infer<typeof configurationSchema>;

// Analytics validation schema
export const analyticsSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  
  configuration_data: z.record(z.string(), z.any()),
  
  completion_rate: z
    .number()
    .min(0, 'Completion rate cannot be negative')
    .max(1, 'Completion rate cannot exceed 1')
    .default(0),
  
  session_id: z
    .string()
    .trim()
    .min(10, 'Invalid session ID')
    .max(100, 'Session ID too long')
    .optional(),
  
  user_agent: z
    .string()
    .trim()
    .max(500, 'User agent too long')
    .optional(),
  
  abandonment_point: z
    .string()
    .trim()
    .max(200, 'Abandonment point too long')
    .optional()
});

export type AnalyticsInput = z.infer<typeof analyticsSchema>;

// Validation helper functions
export function validateConfiguration(input: unknown): ConfigurationInput {
  return configurationSchema.parse(input);
}

export function safeValidateConfiguration(input: unknown) {
  const result = configurationSchema.safeParse(input);
  
  if (!result.success) {
    return {
      success: false as const,
      errors: result.error.flatten().fieldErrors
    };
  }
  
  return {
    success: true as const,
    data: result.data
  };
}

export function validateAnalytics(input: unknown): AnalyticsInput {
  return analyticsSchema.parse(input);
}

export function safeValidateAnalytics(input: unknown) {
  const result = analyticsSchema.safeParse(input);
  
  if (!result.success) {
    return {
      success: false as const,
      errors: result.error.flatten().fieldErrors
    };
  }
  
  return {
    success: true as const,
    data: result.data
  };
}
