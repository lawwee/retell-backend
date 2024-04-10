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
  callId: String;
  status: string;
  agentId: string;
  referenceToCallId: any;
}

export enum callstatusenum {
  QUEUED = "queued",
  RINGING = "ringing",
  IN_PROGRESS = "in progress",
  CALLED = "called-answered",
  BUSY = "busy",
  FAILED = "failed",
  VOICEMAIL = "called-NA-VM",
  CANCELED = "canceled",
  NOT_CALLED = "not called",
}

export interface Itranscript {
  transcript: string;
}

export enum jobstatus {
  QUEUED = "queued",
  ON_CALL = "Calling",
  CALLED = "Called",
  CANCELLED = "cancelled",
}

export interface Ijob {
  callstatus: string;
  jobId: string;
  processedContacts: number;
  processedContactsForRedial: number;
  agentId: string;
  scheduledTime: string;
  shouldContinueProcessing: boolean;
}

export interface Ilogs {
  date: string;
  totalCalls: number;
  callsAnswered: Number;
  callsNotAnswered: Number;
  agentId: String;
}
export interface CustomLlmRequest {
  response_id?: number;
  transcript: Utterance[];
  interaction_type: "update_only" | "response_required" | "reminder_required";
}

export interface CustomLlmResponse {
  response_id: number;
  content: string;
  content_complete: boolean;
  end_call: boolean;
}
