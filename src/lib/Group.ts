import { SendOptions } from './Conversation'
import { DecodedMessage } from './DecodedMessage'
import * as XMTP from '../index'

export class Group<ContentTypes> {
  client: XMTP.Client<ContentTypes>
  id: string
  createdAt: number
  peerAddresses: string[]

  constructor(
    client: XMTP.Client<ContentTypes>,
    params: {
      id: string
      createdAt: number
      peerAddresses: string[]
    }
  ) {
    this.client = client
    this.id = params.id
    this.createdAt = params.createdAt
    this.peerAddresses = params.peerAddresses
  }

  get clientAddress(): string {
    return this.client.address
  }

  async memberAddresses(): Promise<string[]> {
    return XMTP.listMemberAddresses(this.client, this.id)
  }

  /**
   * Sends a message to the current group.
   *
   * @param {string | MessageContent} content - The content of the message. It can be either a string or a structured MessageContent object.
   * @returns {Promise<string>} A Promise that resolves to a string identifier for the sent message.
   * @throws {Error} Throws an error if there is an issue with sending the message.
   *
   * @todo Support specifying a conversation ID in future implementations.
   */
  async send(content: any, opts?: SendOptions): Promise<string> {
    // TODO: Enable other content types
    // if (opts && opts.contentType) {
    // return await this._sendWithJSCodec(content, opts.contentType)
    // }

    try {
      if (typeof content === 'string') {
        content = { text: content }
      }

      return await XMTP.sendMessageToGroup(
        this.client.address,
        this.id,
        content
      )
    } catch (e) {
      console.info('ERROR in send()', e)
      throw e
    }
  }

  async messages(): Promise<DecodedMessage[]> {
    return await XMTP.groupMessages(this.client.address, this.id)
  }

  async sync() {
    await XMTP.syncGroup(this.client.address, this.id)
  }

  /**
   * Sets up a real-time message stream for the current group.
   *
   * This method subscribes to incoming messages in real-time and listens for new message events.
   * When a new message is detected, the provided callback function is invoked with the details of the message.
   * Additionally, this method returns a function that can be called to unsubscribe and end the message stream.
   *
   * @param {Function} callback - A callback function that will be invoked with the new DecodedMessage when a message is received.
   * @returns {Function} A function that, when called, unsubscribes from the message stream and ends real-time updates.
   */
  streamGroupMessages(
    callback: (message: DecodedMessage) => Promise<void>
  ): () => void {
    XMTP.subscribeToGroupMessages(this.client.address, this.id)
    const hasSeen = {}
    const messageSubscription = XMTP.emitter.addListener(
      'message',
      async ({
        clientAddress,
        message,
      }: {
        clientAddress: string
        message: DecodedMessage
      }) => {
        if (clientAddress !== this.client.address) {
          return
        }
        if (hasSeen[message.id]) {
          return
        }

        hasSeen[message.id] = true

        message.client = this.client
        await callback(DecodedMessage.fromObject(message, this.client))
      }
    )
    return () => {
      messageSubscription.remove()
      XMTP.unsubscribeFromGroupMessages(this.client.address, this.id)
    }
  }

}
