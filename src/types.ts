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
  phone: Number;
  isusercalled: boolean;
  isDeleted: boolean;
  callId: string
}

