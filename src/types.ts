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
  linktocallLogModel: any;
  datesCalled: string[];
  answeredByVM: boolean;
  dayToBeProcessed: string
}

export enum DaysToBeProcessedEnum{
  MONDAY = "monday",
  TUESDAY = "tuesday",
  WEDNESDAY = "wednesday", 
  THURSDAY = "thursday",
  FRIDAY = "friday",
  SATURDAY = "saturday",
  SUNDAY = "sunday"
}
export enum callstatusenum {
  QUEUED = "queued",
  RINGING = "ringing",
  IN_PROGRESS = "on call",
  CALLED = "call-connected",
  BUSY = "busy",
  FAILED = "call-failed",
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
  myDate: String;
  totalCalls: number;
  callsAnswered: number;
  callsNotAnswered: number;
  agentId: String;
}

// Retell -> Your Server Events
interface PingPongRequest {
  interaction_type: "ping_pong";
  timestamp: number;
}

interface CallDetailsRequest {
  interaction_type: "call_details";
  call: any;
}

interface UpdateOnlyRequest {
  interaction_type: "update_only";
  transcript: Utterance[];
  turntaking?: "agent_turn" | "user_turn";
}

export interface ResponseRequiredRequest {
  interaction_type: "response_required";
  transcript: Utterance[];
  response_id: number;
}

export interface ReminderRequiredRequest {
  interaction_type: "reminder_required";
  transcript: Utterance[];
  response_id: number;
}

export type CustomLlmRequest =
  | PingPongRequest
  | CallDetailsRequest
  | UpdateOnlyRequest
  | ResponseRequiredRequest
  | ReminderRequiredRequest;

// Your Server -> Retell Events

interface ConfigResponse {
  response_type: "config";
  config: {
    auto_reconnect: boolean;
    call_details: boolean;
  };
}

interface PingPongResponse {
  response_type: "ping_pong";
  timestamp: number;
}

interface ResponseResponse {
  response_type: "response";
  response_id: number;
  content: string;
  content_complete: boolean;
  no_interruption_allowed?: boolean;
  end_call?: boolean;
  transfer_number?: string;
}

interface AgentInterruptResponse {
  response_type: "agent_interrupt";
  interrupt_id: number;
  content: string;
  content_complete: boolean;
  no_interruption_allowed?: boolean;
  end_call?: boolean;
  transfer_number?: string;
}

export type CustomLlmResponse =
  | ConfigResponse
  | PingPongResponse
  | ResponseResponse
  | AgentInterruptResponse;

export interface FunctionCall {
  id: string;
  funcName: string;
  arguments: Record<string, any>;
  result?: string;
}

export interface transcriptEnum {
  UNINTERETED: "Uninterested";
  INTERESTED: "Interested";
  SCHEDULED: "Scheduled";
  VOICEMAIL: "Voicemail";
  INCOMPLETE_CALL: "Incomplete call";
  CALL_BACK: "Call back";
}
