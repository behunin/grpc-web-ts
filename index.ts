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
  abstract deserializeBinaryFromReader(reader: BinaryReader): void
  /**
   * Unary request.
   * Unary response.
   * Deserializes binary data from protobuf wire format.
   */
  Unary(bytes: Uint8Array): void {
    const reader = new BinaryReader(bytes)
    reader.Header()
    this.deserializeBinaryFromReader(reader)
  }
  /**
   * Unary request.
   * Streaming response.
   * Deserializes binary data from protobuf wire format.
   */
  Stream(bytes: Uint8Array, arr: this[]) {
    const reader = new BinaryReader(bytes)
    while (reader.Header()) {
      // TODO: I would like to do a reset on the object,
      // either delete all the properties,
      // or set all properties to undefined.
      const tmp = Object.create(
        Object.getPrototypeOf(this),
        Object.getOwnPropertyDescriptors(this)
      )
      tmp.deserializeBinaryFromReader(reader)
      arr.push(tmp)
    }
  }
}
