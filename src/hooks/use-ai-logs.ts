import { useState, useCallback } from "react";
import type { AiLog } from "../lib/types";
import * as api from "../services/api";

export function useAiLogs() {
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);

  const loadAiLogs = useCallback(async () => {
    try {
      const data = await api.getAllAiLogs();
      setAiLogs(data);
      return data;
    } catch (error) {
      console.error('Failed to get AI logs:', error);
      return [];
    }
  }, []);

  const deleteAiLog = useCallback(async (logId: number) => {
    try {
      await api.deleteAiLog(logId);
      const updatedLogs = await api.getAllAiLogs();
      setAiLogs(updatedLogs);
    } catch (error) {
      console.error('Failed to delete AI log:', error);
    }
  }, []);

  const deleteAllAiLogs = useCallback(async () => {
    try {
      await api.deleteAllAiLogs();
      setAiLogs([]);
    } catch (error) {
      console.error('Failed to delete all AI logs:', error);
    }
  }, []);

  return {
    aiLogs,
    loadAiLogs,
    deleteAiLog,
    deleteAllAiLogs,
  };
}
