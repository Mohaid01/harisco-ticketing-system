import type { Request, Response } from 'express';

import { IncomingMessage } from 'http';

type UserRoles = 'it' | 'employee' | 'manager' | 'executive' | 'factory_employee' | 'factory_it' | 'factory_manager';

type TicketTypes = 'hardware' | 'software' | 'maintenance' | 'upgrade';

type LeaveCategories = 'annual' | 'casual' | 'medical';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface DbUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRoles;
  avatar?: string;
  passwordHash: string;
  needsPasswordReset: number;
  isDepartmentHead: number;
  loginEnabled: number;
  department: string | null;
  designation: string | null;
  casualLeaves?: number;
  annualLeaves?: number;
  medicalLeaves?: number;
  defaultShift?: string;
  is_active?: number;
}

export type RequestWithId = Request & { requestId: string };

export interface AuthRequest extends Request {
  user?: DbUser;
}

// Generic type for requests with typed body
export interface ApiRequest<T> extends Request {
  body: T;
}

// Generic type for authenticated requests with typed body
export interface ApiAuthRequest<T> extends AuthRequest {
  body: T;
}

export type ApiResponse<T> = Response<T | ApiErrorResponse>;

export interface ExtendedWebSocket extends WebSocket {
  upgrade?: {
    request?: IncomingMessage;
  };
}

export interface DbTicket {
  id: string;
  title: string;
  description: string;
  type: TicketTypes;
  status: string;
  justification: string;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  assigneeId: string | null;
  assigneeName: string | null;
  quotation: number | null;
}

export interface DbComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  avatar: string;
  content: string;
  createdAt: string;
}

export interface DbActivityLog {
  id: string;
  ticketId: string;
  action: string;
  timestamp: string;
  performedByName: string;
  performedByRole: string;
}

export interface DbNotice {
  id: string;
  type: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  expiresAt: string | null;
  enTitle: string;
  enContent: string;
  urTitle: string;
  urContent: string;
}

export interface AttendanceLog {
  id: number;
  name: string;
  userId: string;
  ioTime: string;
  method: string;
  status: string;
  timestamp: string;
}

export interface LeaveApplication {
  id: string;
  userId: string;
  userName: string;
  category: LeaveCategories;
  startDate: string;
  endDate: string;
  reason: string;
  status: ApplicationStatus;
  appliedAt: string;
}

export interface SiteDutyApplication {
  id: string;
  userId: string;
  userName: string;
  siteName: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: ApplicationStatus;
  appliedAt: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface LoginRequestBody {
  username: string;
  password: string;
}

export interface ResetPasswordRequestBody {
  password: string;
}

export interface ChangePasswordRequestBody {
  oldPassword: string;
  newPassword: string;
}

export interface LoginUserResponse {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRoles;
  avatar?: string;
  designation?: string | null;
  loginEnabled: number;
  needsPasswordReset: number;
  department?: string | null;
  isDepartmentHead?: number;
  casualLeaves?: number | null;
  annualLeaves?: number | null;
  medicalLeaves?: number | null;
}

export interface LoginResponse {
  token: string;
  user: LoginUserResponse;
}

export interface MeResponse {
  user: DbUser;
}

export interface ResetPasswordUserResponse {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRoles;
  avatar?: string;
  needsPasswordReset: number;
}

export interface ResetPasswordResponse {
  token: string;
  user: ResetPasswordUserResponse;
}

export interface ChangePasswordResponse {
  message: string;
}

export interface ApiErrorResponse {
  error: string;
}

export interface ActivityLogWithTicket extends DbActivityLog {
  ticketTitle: string;
}

export type ActivityLogsResponse = ActivityLogWithTicket[];

export interface DbAdminTicket {
  id: string;
  description: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  executiveId?: string | null;
  executiveName?: string | null;
}

export interface DbAdminComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

export interface DbAdminActivityLog {
  id: string;
  ticketId: string;
  action: string;
  timestamp: string;
  performedByName: string;
  performedByRole: string;
}

export interface CreateAdminTicketRequestBody {
  description: string;
  category: string;
}

export interface UpdateAdminTicketStatusRequestBody {
  status: string;
  actionMessage: string;
  executiveId?: string;
  executiveName?: string;
}

export interface AddAdminCommentRequestBody {
  content: string;
}

export interface UpdateAdminTicketRequestBody {
  description: string;
  category: string;
}

export interface AdminTicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

export interface AdminTicketActivityLog {
  id: string;
  ticketId: string;
  action: string;
  timestamp: string;
  performedByName: string;
  performedByRole: string;
}

export interface AdminTicketResponse {
  id: string;
  description: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  executiveId?: string | null;
  executiveName?: string | null;
  comments: AdminTicketComment[];
  activityLogs: AdminTicketActivityLog[];
}

export type AdminTicketsResponse = AdminTicketResponse[];

export interface CreateAdminTicketResponse {
  id: string;
  description: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  comments: AdminTicketComment[];
  activityLogs: AdminTicketActivityLog[];
}

export interface UpdateAdminTicketStatusResponse {
  success: boolean;
  status: string;
  updatedAt: string;
  executiveId?: string;
  executiveName?: string;
  newLog?: AdminTicketActivityLog;
}

export interface AddAdminCommentResponse {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

export interface DeleteAdminTicketResponse {
  success: boolean;
  message: string;
}

export interface UpdateAdminTicketResponse {
  success: boolean;
  updatedAt: string;
  newLog?: AdminTicketActivityLog;
}

export interface AddManualAttendanceRequestBody {
  userId: string;
  date: string;
  time: string;
  status: string;
}

export interface AddManualAttendanceResponse {
  success: boolean;
}

export interface ClearAttendanceResponse {
  success: boolean;
  message: string;
}

export interface DeleteAttendanceLogResponse {
  success: boolean;
}

export interface HealthMemoryUsage {
  rss: string;
  heapUsed: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime?: string;
  memoryUsage?: HealthMemoryUsage;
  error?: string;
}

export type AttendanceLogsResponse = AttendanceLog[];

export interface CreateHolidayRequestBody {
  date: string;
  name: string;
}

export interface HolidayResponse {
  date: string;
  name: string;
}

export type HolidaysResponse = HolidayResponse[];

export interface CreateHolidayResponse {
  success: boolean;
}

export interface DeleteHolidayResponse {
  success: boolean;
}

export interface CreateLeaveRequestBody {
  category: LeaveCategories;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface UpdateLeaveStatusRequestBody {
  status: ApplicationStatus;
}

export interface LeaveApplicationWithUserCode extends LeaveApplication {
  userCode: string;
}

export type LeavesResponse = LeaveApplicationWithUserCode[];

export interface CreateLeaveResponse {
  success: boolean;
  id: string;
}

export interface UpdateLeaveStatusResponse {
  success: boolean;
}

export interface NoticeContent {
  title: string;
  content: string;
}

export interface NoticeAuthor {
  name: string;
  avatar: string;
  department: string;
  designation: string;
}

export interface NoticeResponse {
  id: string;
  type: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string;
  authorDepartment: string;
  authorDesignation: string;
  createdAt: string;
  expiresAt: string | null;
  en: NoticeContent;
  ur: NoticeContent;
}

export type NoticesResponse = NoticeResponse[];

export interface CreateNoticeRequestBody {
  type: string;
  en: NoticeContent;
  ur: NoticeContent;
  expiresAt?: string | null;
}

export interface UpdateNoticeRequestBody {
  type: string;
  en: NoticeContent;
  ur: NoticeContent;
  expiresAt?: string | null;
}

export interface CreateNoticeResponse {
  id: string;
  type: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  expiresAt: string | null;
  en: NoticeContent;
  ur: NoticeContent;
}

export interface UpdateNoticeResponse {
  message: string;
}

export interface DeleteNoticeResponse {
  message: string;
}

export interface CreateSiteDutyRequestBody {
  siteName: string;
  reason: string;
  startDate: string;
  endDate: string;
}

export interface UpdateSiteDutyStatusRequestBody {
  status: ApplicationStatus;
}

export interface SiteDutyApplicationWithUserCode extends SiteDutyApplication {
  userCode: string;
}

export type SiteDutiesResponse = SiteDutyApplicationWithUserCode[];

export interface CreateSiteDutyResponse {
  success: boolean;
  id: string;
}

export interface UpdateSiteDutyStatusResponse {
  success: boolean;
}

export interface CreateUserRequestBody {
  name: string;
  email?: string;
  username: string;
  role: UserRoles;
  password?: string;
  avatar?: string;
  department?: string | null;
  designation?: string | null;
  isDepartmentHead?: number | boolean;
  loginEnabled?: number | boolean;
}

export interface UpdateUserRequestBody {
  name: string;
  email?: string;
  department?: string | null;
  designation?: string | null;
  avatar?: string;
  isDepartmentHead?: number | boolean;
  loginEnabled?: number | boolean;
}

export interface ResetUserPasswordRequestBody {
  newPassword: string;
}

export type UsersResponse = DbUser[];

export interface CreateUserResponse {
  id: string;
  name: string;
  email: string | null;
  username: string;
  role: UserRoles;
  avatar?: string;
  department?: string | null;
  designation?: string | null;
  isDepartmentHead: number;
  loginEnabled: number;
}

export interface UpdateUserResponse {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  avatar?: string;
  isDepartmentHead: number;
  loginEnabled: number;
}

export interface ResetUserPasswordResponse {
  message: string;
}

export interface DeleteUserResponse {
  message: string;
}

export interface OffboardUserRequestBody {
  reason?: string;
}

export interface OffboardUserResponse {
  message: string;
}

export interface CreateTicketRequestBody {
  description: string;
  type: string;
  justification: string;
}

export interface UpdateTicketStatusRequestBody {
  status: string;
  actionMessage: string;
  quotation?: number | null;
}

export interface UpdateTicketRequestBody {
  description: string;
  type: string;
  justification?: string;
}

export interface AssignTicketRequestBody {
  assigneeId: string;
  assigneeName: string;
}

export interface AddTicketCommentRequestBody {
  content: string;
}

export interface TicketResponse {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  justification: string;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  assigneeId: string | null;
  assigneeName: string | null;
  quotation: number | null;
  comments: DbComment[];
  activityLogs: DbActivityLog[];
}

export type TicketsResponse = TicketResponse[];

export interface CreateTicketResponse {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  justification: string;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  assigneeId: string | null;
  assigneeName: string | null;
  comments: DbComment[];
  activityLogs: DbActivityLog[];
}

export interface UpdateTicketStatusResponse {
  success: boolean;
  status: string;
  updatedAt: string;
  quotation: number | null;
  newLog: DbActivityLog;
}

export interface UpdateTicketResponse {
  success: boolean;
  updatedAt: string;
  newLog: DbActivityLog;
}

export interface DeleteTicketResponse {
  success: boolean;
  message: string;
}

export interface AssignTicketResponse {
  success: boolean;
  assigneeId: string;
  assigneeName: string;
  status: string;
  updatedAt: string;
  newLog: DbActivityLog;
}

export interface AddTicketCommentResponse {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  avatar: string;
  content: string;
  createdAt: string;
}

export interface CreateFactoryUserRequestBody {
  name: string;
  email?: string;
  username: string;
  role: UserRoles;
  password?: string;
  avatar?: string;
  department?: string | null;
  designation?: string | null;
  isDepartmentHead?: number | boolean;
  loginEnabled?: number | boolean;
  defaultShift?: string;
}

export interface UpdateFactoryUserRequestBody {
  name: string;
  email?: string;
  department?: string | null;
  designation?: string | null;
  avatar?: string;
  isDepartmentHead?: number | boolean;
  loginEnabled?: number | boolean;
  defaultShift?: string;
}

export interface ResetFactoryUserPasswordRequestBody {
  newPassword: string;
}

export type FactoryUsersResponse = DbUser[];

export interface CreateFactoryUserResponse {
  id: string;
  name: string;
  email: string | null;
  username: string;
  role: UserRoles;
  avatar?: string;
  department?: string | null;
  designation?: string | null;
  isDepartmentHead: number;
  loginEnabled: number;
  defaultShift: string;
}

export interface UpdateFactoryUserResponse {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  avatar?: string;
  isDepartmentHead: number;
  loginEnabled: number;
  defaultShift: string;
}

export interface ResetFactoryUserPasswordResponse {
  message: string;
}

export interface DeleteFactoryUserResponse {
  message: string;
}

export interface AddFactoryManualAttendanceRequestBody {
  userId: string;
  date: string;
  time: string;
  status: string;
}

export interface AddFactoryManualAttendanceResponse {
  success: boolean;
}

export interface ClearFactoryAttendanceResponse {
  success: boolean;
  message: string;
}

export interface DeleteFactoryAttendanceLogResponse {
  success: boolean;
}

export type FactoryAttendanceLogsResponse = AttendanceLog[];
