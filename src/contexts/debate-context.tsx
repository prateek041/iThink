"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// Define possible statuses for the debate
type DebateStatus = "not_started" | "in_progress" | "paused" | "user_speaking";

// Define possible speakers in the debate
type Speaker = "for" | "against" | "user";

// Interface for the debate state
interface DebateState {
  topic: string; // The current debate topic
  status: DebateStatus; // The current status of the debate
  history: Array<{
    speaker: Speaker; // The speaker of the message
    content: string; // The content of the message
    timestamp: number; // The timestamp of the message
  }>;
  currentSpeaker: Speaker; // The current speaker in the debate
}

// Interface for the context type
interface DebateContextType {
  state: DebateState; // The current state of the debate
  setTopic: (topic: string) => void; // Function to set the debate topic
  addToHistory: (speaker: Speaker, content: string) => void; // Function to add a message to the history
  setStatus: (status: DebateStatus) => void; // Function to set the debate status
  setCurrentSpeaker: (speaker: Speaker) => void; // Function to set the current speaker
}

// Create the DebateContext
const DebateContext = createContext<DebateContextType | undefined>(undefined);

// Initial state for the debate
const initialState: DebateState = {
  topic: "",
  status: "not_started",
  history: [],
  currentSpeaker: "for",
};

/**
 * DebateProvider component to provide debate context to its children.
 * @param children - The child components that will consume the context.
 */
export function DebateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DebateState>(initialState);

  /**
   * Sets the debate topic and changes the status to in_progress.
   * @param topic - The new debate topic.
   */
  const setTopic = (topic: string) => {
    setState((prev) => ({
      ...prev,
      topic,
      status: "in_progress",
    }));
  };

  /**
   * Adds a message to the debate history.
   * @param speaker - The speaker of the message.
   * @param content - The content of the message.
   */
  const addToHistory = (speaker: Speaker, content: string) => {
    setState((prev) => ({
      ...prev,
      history: [
        ...prev.history,
        {
          speaker,
          content,
          timestamp: Date.now(),
        },
      ],
    }));
  };

  /**
   * Sets the current status of the debate.
   * @param status - The new status of the debate.
   */
  const setStatus = (status: DebateStatus) => {
    setState((prev) => ({
      ...prev,
      status,
    }));
  };

  /**
   * Sets the current speaker in the debate.
   * @param speaker - The new current speaker.
   */
  const setCurrentSpeaker = (speaker: Speaker) => {
    setState((prev) => ({
      ...prev,
      currentSpeaker: speaker,
    }));
  };

  return (
    <DebateContext.Provider
      value={{
        state,
        setTopic,
        addToHistory,
        setStatus,
        setCurrentSpeaker,
      }}
    >
      {children}
    </DebateContext.Provider>
  );
}

/**
 * Custom hook to use the DebateContext.
 * Throws an error if used outside of a DebateProvider.
 */
export function useDebate() {
  const context = useContext(DebateContext);
  if (context === undefined) {
    throw new Error("useDebate must be used within a DebateProvider");
  }
  return context;
}
