import { BinaryReader } from './reader'
import { BinaryWriter } from './writer'
export { BinaryReader, BinaryWriter }
/**
 * Base class for all TsPb messages.
 */
export abstract class Message {
  /**
   * Serializes the message to binary data (in protobuf wire format).
   */
  serializeBinary(): number[] {
    const writer = new BinaryWriter()
    this.serializeBinaryToWriter(writer)
    return writer.ResultBuffer
  }
  /**
   * Deserializes binary data (in protobuf wire format).
   */
  deserializeBinary(bytes: Uint8Array): void {
    const reader = new BinaryReader(bytes)
    this.deserializeBinaryFromReader(reader)
  }
  /**
   * Serializes the given message to binary data (in protobuf wire
   * format), writing to the given BinaryWriter.
   */
  abstract serializeBinaryToWriter(writer: BinaryWriter): void
  /**
   * Deserializes binary data (in protobuf wire format) from the
   * given BinaryReader.
   */
  abstract deserializeBinaryFromReader(reader: BinaryReader): this
  /**
   * Unary request.
   * Unary response.
   * Deserializes binary data from protobuf wire format.
   */
  Unary(bytes: Uint8Array) {
    const reader = new BinaryReader(bytes)
    reader.Header()
    return this.deserializeBinaryFromReader(reader)
  }
  /**
   * Unary request.
   * Streaming response.
   * Deserializes binary data from protobuf wire format.
   */
  static Stream(bytes: Uint8Array, msg: any, arr: Array<Message>) {
    const reader = new BinaryReader(bytes)
    while (reader.Header()) {
      arr.push(new msg().deserializeBinaryFromReader(reader))
    }
  }
}
