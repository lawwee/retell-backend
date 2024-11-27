import Retell from "retell-sdk";
import { AgentUpdateParams } from "retell-sdk/resources/agent";
import { LlmUpdateParams } from "retell-sdk/resources/llm";
import { LLMUpdateHistory } from "./lllm-schema";

const client = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});
export async function getAllLLM() {
  try {
    const llmResponses = await client.llm.list();

    console.log(llmResponses);
    return {
      success: true,
      data: llmResponses,
    };
  } catch (error) {
    let errorMessage = "An unknown error occurred while retrieving LLMs.";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    console.error("Error getting LLMs:", errorMessage);

    return {
      success: false,
      message: errorMessage,
    };
  }
}
export async function getOneLLM(llm_id: string) {
  try {
    if (!llm_id) {
      throw new Error("LLM ID is required.");
    }

    const llmResponse = await client.llm.retrieve(llm_id);

    return {
      success: true,
      data: llmResponse,
    };
  } catch (error) {
    let errorMessage = "An unknown error occurred while retrieving the LLM.";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    console.error("Error getting single LLM:", errorMessage);

    return {
      success: false,
      message: errorMessage,
    };
  }
}
export async function updateAgent(
  agentId: string,
  payload: Partial<{
    agent_name: string | null;
    ambient_sound:
      | "coffee-shop"
      | "convention-hall"
      | "summer-outdoor"
      | "mountain-outdoor"
      | "static-noise"
      | "call-center"
      | null;
    ambient_sound_volume: number;
    backchannel_frequency: number;
    backchannel_words: string[] | null;
    boosted_keywords: string[] | null;
    enable_backchannel: boolean;
    enable_voicemail_detection: boolean;
    end_call_after_silence_ms: number;
    fallback_voice_ids: string[] | null;
    interruption_sensitivity: number;
    language:
      | "en-US"
      | "en-IN"
      | "en-GB"
      | "de-DE"
      | "es-ES"
      | "es-419"
      | "hi-IN"
      | "ja-JP"
      | "pt-PT"
      | "pt-BR"
      | "fr-FR"
      | "zh-CN"
      | "ru-RU"
      | "it-IT"
      | "ko-KR"
      | "nl-NL"
      | "pl-PL"
      | "tr-TR"
      | "vi-VN"
      | "multi";
    llm_websocket_url: string;
    max_call_duration_ms: number;
    normalize_for_speech: boolean;
    opt_out_sensitive_data_storage: boolean;
    post_call_analysis_data: Array<
      | AgentUpdateParams.StringAnalysisData
      | AgentUpdateParams.EnumAnalysisData
      | AgentUpdateParams.BooleanAnalysisData
      | AgentUpdateParams.NumberAnalysisData
    > | null;
    pronunciation_dictionary:
      | AgentUpdateParams.PronunciationDictionary[]
      | null;
    reminder_max_count: number;
    reminder_trigger_ms: number;
    responsiveness: number;
    voice_id: string;
    voice_model:
      | "eleven_turbo_v2"
      | "eleven_turbo_v2_5"
      | "eleven_multilingual_v2"
      | null;
    voice_speed: number;
    voice_temperature: number;
    voicemail_detection_timeout_ms: number;
    voicemail_message: string;
    volume: number;
    webhook_url: string | null;
  }>,
) {
  try {
    // Filter payload strictly against the allowed keys
    const allowedKeys: Array<keyof typeof payload> = [
      "agent_name",
      "ambient_sound",
      "ambient_sound_volume",
      "backchannel_frequency",
      "backchannel_words",
      "boosted_keywords",
      "enable_backchannel",
      "enable_voicemail_detection",
      "end_call_after_silence_ms",
      "fallback_voice_ids",
      "interruption_sensitivity",
      "language",
      "llm_websocket_url",
      "max_call_duration_ms",
      "normalize_for_speech",
      "opt_out_sensitive_data_storage",
      "post_call_analysis_data",
      "pronunciation_dictionary",
      "reminder_max_count",
      "reminder_trigger_ms",
      "responsiveness",
      "voice_id",
      "voice_model",
      "voice_speed",
      "voice_temperature",
      "voicemail_detection_timeout_ms",
      "voicemail_message",
      "volume",
      "webhook_url",
    ];

    // Use type assertion to ensure filteredPayload matches the type
    const filteredPayload: Partial<typeof payload> = Object.keys(payload)
      .filter((key): key is keyof typeof payload =>
        allowedKeys.includes(key as keyof typeof payload),
      )
      .reduce((obj: any, key) => {
        obj[key] = payload[key as keyof typeof payload]; // Safely assign key-value pair
        return obj;
      }, {} as Partial<typeof payload>);

    // Ensure there are valid fields to update
    if (Object.keys(filteredPayload).length === 0) {
      return {
        success: false,
        message: "No valid fields to update. Please provide valid keys.",
      };
    }

    // Update the agent using the filtered payload
    const agentResponse = await client.agent.update(agentId, filteredPayload);

    return {
      success: true,
      message: "Agent updated successfully.",
      data: agentResponse,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unknown error occurred during the update operation.";

    return {
      success: false,
      message: "Failed to update agent.",
      error: errorMessage,
    };
  }
}
export async function updateLLM(
  llmid: string,
  payload: Partial<{
    begin_message: string | null;
    general_prompt: string | null;
    general_tools: Array<
      | LlmUpdateParams.EndCallTool
      | LlmUpdateParams.TransferCallTool
      | LlmUpdateParams.CheckAvailabilityCalTool
      | LlmUpdateParams.BookAppointmentCalTool
      | LlmUpdateParams.PressDigitTool
      | LlmUpdateParams.CustomTool
    > | null;
    inbound_dynamic_variables_webhook_url: string | null;
    model: "gpt-4o" | "gpt-4o-mini" | "claude-3.5-sonnet" | "claude-3-haiku";
    model_temperature: number;
    starting_state: string | null;
    states: Array<LlmUpdateParams.State> | null;
  }>,
) {
  try {
    if (!payload || typeof payload !== "object") {
      return {
        success: false,
        message: "Invalid payload. Please provide an object with valid fields.",
      };
    }

    const allowedKeys: Array<keyof typeof payload> = [
      "begin_message",
      "general_prompt",
      "general_tools",
      "inbound_dynamic_variables_webhook_url",
      "model",
      "model_temperature",
      "starting_state",
      "states",
    ];

    const filteredPayload = Object.keys(payload)
      .filter((key) => allowedKeys.includes(key as keyof typeof payload))
      .reduce((obj: any, key) => {
        obj[key as keyof typeof payload] = payload[key as keyof typeof payload];
        return obj;
      }, {} as typeof payload);

    if (Object.keys(filteredPayload).length === 0) {
      return {
        success: false,
        message: "No valid fields to update. Please provide valid keys.",
      };
    }

    const previousData = await client.llm.retrieve(llmid);

    const result = await client.llm.update(llmid, filteredPayload);

    const lastUpdate = await LLMUpdateHistory.findOne({ llm_id:llmid })
      .sort({ createdAt: "desc" })
      .lean();

    
    
    const newUpdateIndex = lastUpdate ? lastUpdate.updateIndex + 1 : 1;

    await LLMUpdateHistory.create({
      llm_id:llmid,
      previousData,
      updatedData: result,
      updateIndex: newUpdateIndex,
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: "LLM updated successfully.",
      data: result,
    };
  } catch (error) {
    console.error("Error updating LLM:", error);

    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";

    return {
      success: false,
      message: errorMessage,
    };
  }
}
export async function revertLLM(llmid: string, updateIndex: number) {
  try {
    if (!llmid || typeof llmid !== "string") {
      return {
        success: false,
        message: "Invalid LLM ID. Please provide a valid llmid.",
      };
    }

    if (!updateIndex || typeof updateIndex !== "number") {
      return {
        success: false,
        message: "Invalid update index. Please provide a valid number.",
      };
    }

    const historyRecord = await LLMUpdateHistory.findOne({
      llm_id:llmid,
      updateIndex,
    }).lean();

    if (!historyRecord) {
      return {
        success: false,
        message: `No history found for LLM ID ${llmid} at update index ${updateIndex}.`,
      };
    }

    const { previousData } = historyRecord;

    if (!previousData) {
      return {
        success: false,
        message: `No previous data available for LLM ID ${llmid} at update index ${updateIndex}.`,
      };
    }

    const result = await client.llm.update(llmid, previousData);

    const lastUpdate = await LLMUpdateHistory.findOne({ llm_id:llmid })
      .sort({ createdAt: "desc" })
      .lean();

    const newUpdateIndex = lastUpdate ? lastUpdate.updateIndex + 1 : 1;

    await LLMUpdateHistory.create({
      llm_id:llmid,
      previousData: result,
      updatedData: previousData,
      updateIndex: newUpdateIndex,
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: `LLM reverted successfully to update index ${updateIndex}.`,
      data: result,
    };
  } catch (error) {
    console.error("Error reverting LLM:", error);

    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";

    return {
      success: false,
      message: errorMessage,
    };
  }
}
