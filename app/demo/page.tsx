"use client";

import * as React from "react";
import { MessageBubble } from "@/components/conversations/MessageBubble";
import { MessageComposer } from "@/components/conversations/MessageComposer";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatDisplayPhoneNumber } from "@/lib/validation";
import type { MessageDirection, MessageStatus } from "@/types/sms";

/**
 * Simplified message type for demo purposes
 * Maps to the Message type expected by MessageBubble
 */
interface DemoMessage {
  id: string;
  conversationId: string;
  twilioSid: string;
  body: string;
  direction: MessageDirection;
  status: MessageStatus;
  authorPhone: string | null;
  authorSaxId: number | null;
  createdOn: string;
  createdBy: number | null;
  segmentCount: number;
  sentiment: null;
  sentimentScore: null;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  active: boolean;
  tenantId: string;
  practiceId: string;
}

/**
 * Create a demo message with all required fields
 */
function createDemoMessage(
  id: string,
  body: string,
  direction: MessageDirection,
  status: MessageStatus,
  createdAt: Date,
  authorPhone: string | null = null,
): DemoMessage {
  return {
    id,
    conversationId: "conv-demo",
    twilioSid: `SM${id}`,
    body,
    direction,
    status,
    authorPhone,
    authorSaxId: direction === "outbound" ? 1 : null,
    createdOn: createdAt.toISOString(),
    createdBy: direction === "outbound" ? 1 : null,
    segmentCount: Math.ceil(body.length / 160),
    sentiment: null,
    sentimentScore: null,
    errorCode: null,
    errorMessage: null,
    sentAt: status !== "sending" ? createdAt.toISOString() : null,
    deliveredAt:
      status === "delivered" || status === "read"
        ? createdAt.toISOString()
        : null,
    readAt: status === "read" ? createdAt.toISOString() : null,
    active: true,
    tenantId: "demo-tenant",
    practiceId: "demo-practice",
  };
}

/**
 * Demo page for testing UI components visually
 * No real Twilio connection required
 */
export default function DemoPage() {
  const [messages, setMessages] = React.useState<DemoMessage[]>([
    createDemoMessage(
      "msg-1",
      "Hi! This is a test message from the patient.",
      "inbound",
      "delivered",
      new Date(Date.now() - 3600000),
      "+15551234567",
    ),
    createDemoMessage(
      "msg-2",
      "Hello! Thank you for reaching out. How can I help you today?",
      "outbound",
      "delivered",
      new Date(Date.now() - 3500000),
    ),
    createDemoMessage(
      "msg-3",
      "I wanted to ask about my upcoming appointment on Friday. Will the doctor be available?",
      "inbound",
      "delivered",
      new Date(Date.now() - 3400000),
      "+15551234567",
    ),
    createDemoMessage(
      "msg-4",
      "Yes, Dr. Smith will be available on Friday. Your appointment is confirmed for 2:00 PM. Please arrive 15 minutes early to complete any necessary paperwork.",
      "outbound",
      "sent",
      new Date(Date.now() - 60000),
    ),
    createDemoMessage(
      "msg-5",
      "This message is still sending...",
      "outbound",
      "sending",
      new Date(),
    ),
  ]);

  const [isOptedOut, setIsOptedOut] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (body: string) => {
    // Check for STOP command
    if (body.trim().toUpperCase() === "STOP") {
      setIsOptedOut(true);
      return;
    }

    const messageId = `msg-${Date.now()}`;

    // Optimistic update - add message as "sending"
    const tempMessage = createDemoMessage(
      messageId,
      body,
      "outbound",
      "sending",
      new Date(),
    );

    setMessages((prev) => [...prev, tempMessage]);

    // Simulate network delay then update to sent
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: "sent" as MessageStatus } : m,
      ),
    );

    // Simulate delivery after another delay
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, status: "delivered" as MessageStatus }
            : m,
        ),
      );
    }, 2000);
  };

  const handleAddInbound = () => {
    const inboundMessage = createDemoMessage(
      `msg-${Date.now()}`,
      "This is a simulated inbound message from the patient.",
      "inbound",
      "delivered",
      new Date(),
      "+15551234567",
    );
    setMessages((prev) => [...prev, inboundMessage]);
  };

  const handleSimulateStop = () => {
    const stopMessage = createDemoMessage(
      `msg-${Date.now()}`,
      "STOP",
      "inbound",
      "delivered",
      new Date(),
      "+15551234567",
    );
    setMessages((prev) => [...prev, stopMessage]);
    setIsOptedOut(true);
  };

  const handleReset = () => {
    setIsOptedOut(false);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      {/* Demo Controls */}
      <PageHeader
        title="SMS Components Demo"
        subtitle={
          <div className="flex items-center gap-2">
            <span>Patient: {formatDisplayPhoneNumber("+15551234567")}</span>
            {isOptedOut && (
              <span className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-300">
                OPTED OUT
              </span>
            )}
          </div>
        }
        className="px-4 py-2"
      >
        <div className="flex gap-2">
          <button
            onClick={handleAddInbound}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
            disabled={isOptedOut}
          >
            + Simulate Inbound
          </button>
          <button
            onClick={handleSimulateStop}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
            disabled={isOptedOut}
          >
            Simulate STOP
          </button>
          {isOptedOut && (
            <button
              onClick={handleReset}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              Reset Opt-Out
            </button>
          )}
        </div>
      </PageHeader>

      {/* Opt-out Warning Banner */}
      {isOptedOut && (
        <div className="flex items-center gap-2 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            This patient has opted out of SMS communications. You cannot send
            messages until they opt back in.
          </span>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Composer */}
      <div className="border-t border-gray-700 bg-gray-800 p-4">
        <div className="mx-auto max-w-3xl">
          <MessageComposer
            onSend={handleSend}
            disabled={isOptedOut}
            placeholder={
              isOptedOut
                ? "Cannot send messages - patient has opted out"
                : "Type your message..."
            }
          />
        </div>
      </div>
    </div>
  );
}
