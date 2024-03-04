export interface Utterance {
  role: "agent" | "user";
  content: string;
}

export interface RetellRequest {
  response_id?: number;
  transcript: Utterance[];
  interaction_type: "update_only" | "response_required" | "reminder_required";
}

export interface RetellResponse {
  response_id: number;
  content: string;
  content_complete: boolean;
  end_call: boolean;
}

export interface IContact {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  isusercalled: boolean;
  isDeleted: boolean;
  callId: string,
  status: string
}

export enum callstatusenum {
  QUEUED = "queued",
  RINGING = "ringing",
  IN_PROGRESS = "in progress",
  COMPLEETED = "completed",
  BUSY = "busy",
  FAILED = "failed",
  NO_ANSWER = "no answer",
  CANCELED = "canceled",
  NOT_CALLED = "not called",
}

// export interface FunctionCall {
//   id: string
//   FuncName: string
//   arguments: Record <string, any>
//   result?: string
// }