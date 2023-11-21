import { Client } from "./Client";
import { Conversation } from "./Conversation";
import type { ConversationContext, DecodedMessage } from "../XMTP.types";
import * as XMTPModule from "../index";

export default class Conversations {
  client: Client;
  private known = {} as { [topic: string]: boolean };

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * This method returns a list of all conversations that the client is a member of.
   * 
   * @returns {Promise<Conversation[]>} A Promise that resolves to an array of Conversation objects.
   */
  async list(): Promise<Conversation[]> {
    const result = await XMTPModule.listConversations(this.client.address);

    for (const conversation of result) {
      this.known[conversation.topic] = true;
    }

    return result;
  }

  async importTopicData(topicData: string): Promise<Conversation> {
    const conversation = await XMTPModule.importConversationTopicData(
      this.client.address,
      topicData,
    );
    this.known[conversation.topic] = true;
    return conversation;
  }
/**
 * Creates a new conversation.
 * 
 * This method creates a new conversation with the specified peer address and context.
 * 
 * @param {string} peerAddress - The address of the peer to create a conversation with. 
 * @param {ConversationContext} context - Optional context to associate with the conversation. 
 * @returns {Promise<Conversation>} A Promise that resolves to a Conversation object.
 */
  async newConversation(
    peerAddress: string,
    context?: ConversationContext,
  ): Promise<Conversation> {
    return await XMTPModule.createConversation(
      this.client.address,
      peerAddress,
      context,
    );
  }

  /**
   * Sets up a real-time stream to listen for new conversations being started.
   * 
   * This method subscribes to conversations in real-time and listens for incoming conversation events.
   * When a new conversation is detected, the provided callback function is invoked with the details of the conversation.
   * @param {Function} callback - A callback function that will be invoked with the new Conversation when a conversation is started.
   * @returns {Promise<void>} A Promise that resolves when the stream is set up.
   * @warning This stream will continue infinitely. To end the stream, you can call {@linkcode Conversations.cancelStream | cancelStream()}.
   */
  async stream(callback: (conversation: Conversation) => Promise<void>): Promise<void> {
    XMTPModule.subscribeToConversations(this.client.address);
    XMTPModule.emitter.addListener(
      "conversation",
      async ({
        clientAddress,
        conversation,
      }: {
        clientAddress: string;
        conversation: Conversation;
      }) => {
        if (clientAddress !== this.client.address) {
          return;
        }
        if (this.known[conversation.topic]) {
          return;
        }

        this.known[conversation.topic] = true;
        await callback(new Conversation(conversation));
      },
    );
  }

/**
 * Listen for new messages in all conversations.
 * 
 * This method subscribes to all conversations in real-time and listens for incoming and outgoing messages.
 * @param {Function} callback - A callback function that will be invoked when a message is sent or received.
 * @returns {Promise<void>} A Promise that resolves when the stream is set up.
 */
  async streamAllMessages(
    callback: (message: DecodedMessage) => Promise<void>,
  ): Promise<void> {
    XMTPModule.subscribeToAllMessages(this.client.address);
    XMTPModule.emitter.addListener(
      "message",
      async ({
        clientAddress,
        message,
      }: {
        clientAddress: string;
        message: DecodedMessage;
      }) => {
        if (clientAddress !== this.client.address) {
          return;
        }
        if (this.known[message.id]) {
          return;
        }

        this.known[message.id] = true;
        await callback(message as DecodedMessage);
      },
    );
  }

  /**
   * Cancels the stream for new conversations.
   */
  cancelStream() {
    XMTPModule.unsubscribeFromConversations(this.client.address);
  }

  /**
   * Cancels the stream for new messages in all conversations.
   */
  cancelStreamAllMessages() {
    XMTPModule.unsubscribeFromAllMessages(this.client.address);
  }
}
