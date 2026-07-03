export interface AttendanceLog {
  id: number;
  userId: string;
  name: string;
  ioTime: string;
  method: string;
  status: string;
  timestamp?: string;
}
