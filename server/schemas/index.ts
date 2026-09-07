import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(4, 'New password must be at least 4 characters'),
});

// User schemas
export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().nullable(),
  username: z.string().min(1, 'Username is required'),
  role: z.enum(['it', 'employee', 'manager', 'executive']),
  password: z.string().optional(),
  avatar: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  isDepartmentHead: z.union([z.boolean(), z.number()]).optional().default(false),
  loginEnabled: z.union([z.boolean(), z.number()]).optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().nullable(),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  isDepartmentHead: z.union([z.boolean(), z.number()]).optional(),
  loginEnabled: z.union([z.boolean(), z.number()]).optional(),
});

// Factory user schemas
export const createFactoryUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().nullable(),
  username: z.string().min(1, 'Username is required'),
  role: z.enum(['factory_employee', 'factory_it', 'factory_manager']),
  password: z.string().optional(),
  avatar: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  isDepartmentHead: z.union([z.boolean(), z.number()]).optional().default(false),
  loginEnabled: z.union([z.boolean(), z.number()]).optional().default(true),
});

export const updateFactoryUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().nullable(),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  isDepartmentHead: z.union([z.boolean(), z.number()]).optional(),
  loginEnabled: z.union([z.boolean(), z.number()]).optional(),
});

// Ticket schemas
export const createTicketSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  type: z.enum(['hardware', 'software', 'maintenance', 'upgrade']),
  justification: z.string().min(1, 'Justification is required'),
});

export const updateTicketSchema = z.object({
  description: z.string().min(1, 'Description is required').optional(),
  type: z.enum(['hardware', 'software', 'maintenance', 'upgrade']).optional(),
  justification: z.string().min(1, 'Justification is required').optional(),
});

export const ticketStatusSchema = z.object({
  status: z.string().min(1, 'Status is required'),
  actionMessage: z.string().min(1, 'Action message is required'),
  quotation: z.number().optional().nullable(),
});

export const assignTicketSchema = z.object({
  assigneeId: z.string().min(1, 'Assignee ID is required'),
  assigneeName: z.string().min(1, 'Assignee name is required'),
});

export const ticketCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
});

// Admin ticket schemas
export const createAdminTicketSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  category: z.enum([
    'staff_issue',
    'security',
    'maintenance',
    'cleaning_decoration',
    'mess_canteen',
    'travelling',
    'stationery_courier',
  ]),
});

export const updateAdminTicketSchema = z.object({
  description: z.string().min(1, 'Description is required').optional(),
  category: z
    .enum([
      'staff_issue',
      'security',
      'maintenance',
      'cleaning_decoration',
      'mess_canteen',
      'travelling',
      'stationery_courier',
    ])
    .optional(),
});

export const adminTicketStatusSchema = z.object({
  status: z.enum([
    'awaiting_admin_manager',
    'awaiting_materials',
    'awaiting_technician',
    'awaiting_executive',
    'resolved',
  ]),
  actionMessage: z.string().min(1, 'Action message is required'),
  executiveId: z.string().optional().nullable(),
  executiveName: z.string().optional().nullable(),
});

export const adminTicketCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
});

// Attendance schemas
export const manualAttendanceSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  status: z.enum(['Check-In', 'Check-Out', 'Site Duty', 'On Leave']),
});

// Leave schemas
export const createLeaveSchema = z.object({
  category: z.enum(['annual', 'casual', 'medical']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
});

export const updateLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

// Site duty schemas
export const createSiteDutySchema = z.object({
  siteName: z.string().min(1, 'Site name is required'),
  reason: z.string().min(1, 'Reason is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
});

export const updateSiteDutySchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

// Holiday schemas
export const createHolidaySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  name: z.string().min(1, 'Holiday name is required'),
});

// Notice schemas
export const createNoticeSchema = z.object({
  type: z.enum(['general', 'maintenance', 'policy', 'outage']),
  expiresAt: z.string().optional().nullable(),
  en: z.object({
    title: z.string().min(1, 'English title is required'),
    content: z.string().min(1, 'English content is required'),
  }),
  ur: z.object({
    title: z.string().min(1, 'Urdu title is required'),
    content: z.string().min(1, 'Urdu content is required'),
  }),
});

export const updateNoticeSchema = z.object({
  type: z.enum(['general', 'maintenance', 'policy', 'outage']).optional(),
  expiresAt: z.string().optional().nullable(),
  en: z
    .object({
      title: z.string().min(1, 'English title is required').optional(),
      content: z.string().min(1, 'English content is required').optional(),
    })
    .optional(),
  ur: z
    .object({
      title: z.string().min(1, 'Urdu title is required').optional(),
      content: z.string().min(1, 'Urdu content is required').optional(),
    })
    .optional(),
});

// Password reset schema
export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(4, 'Password must be at least 4 characters'),
});
