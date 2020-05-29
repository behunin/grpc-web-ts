import { BinaryEncoder } from './encoder';
import {
  FieldType,
  WireType,
  TWO_TO_31,
  TWO_TO_63,
  TWO_TO_32,
  TWO_TO_64,
  FLOAT32_MAX,
  FLOAT64_MAX,
  TWO_TO_52
} from './constants';
/**
 * BinaryWriter implements encoders for all the wire types specified in
 * https://developers.google.com/protocol-buffers/docs/encoding.
 */
export class BinaryWriter {
  private encoder = new BinaryEncoder();

  /**
   * Append a typed array of bytes onto the buffer.
   */
  appendUint8Array(arr: Uint8Array) {
    this.encoder.Buffer.push(...arr);
  }

  /**
   * Begins a new message by writing the field header and returning a bookmark
   * which we will use to patch in the message length to in endDelimited below.
   */
  beginDelimited(field: number): number {
    this.Tag(field, WireType.DELIMITED);
    return this.encoder.Length;
  }

  /**
   * Ends a message by splicing in the length of the message after the
   * message header.
   */
  endDelimited(bookmark: number) {
    let messageLength = this.encoder.Length - bookmark;
    if (messageLength >= 0) {
      if (messageLength > 127) {
        const tmp = [];
        while (messageLength > 127) {
          tmp.push((messageLength & 0x7f) | 0x80);
          messageLength = messageLength >>> 7;
        }
        this.encoder.Buffer.splice(bookmark, 0, ...tmp);
        return;
      }
      this.encoder.Buffer.splice(bookmark, 0, messageLength);
    }
  }

  get ResultBuffer() {
    return this.encoder.Buffer;
  }

  /**
   * Encodes a (field number, wire type) tuple into a wire-format field header
   * and stores it in the buffer as a varint.
   */
  Tag(field: number, wireType: number) {
    if (field >= 1 && field == Math.floor(field)) {
      const x = field * 8 + wireType;
      this.encoder.UnsignedVarint32(x);
      return;
    }
    throw `Field number is Invalid: ${field}`;
  }
  /**
   * Writes a number to the buffer.
   */
  Varint32(field: number, value: number) {
    this.Tag(field, WireType.VARINT);
    this.encoder.Varint32(value);
  }

  /**
   * Writes a bigint to the buffer.
   */
  Varint(field: number, value: bigint) {
    this.Tag(field, WireType.VARINT);
    this.encoder.Varint(value);
  }

  /**
   * Writes an int32 field to the buffer. Numbers outside the range [-2^31,2^31)
   * will be truncated.
   */
  Int32(field: number, value: number) {
    if (value >= -TWO_TO_31 && value < TWO_TO_31) {
      this.Tag(field, WireType.VARINT);
      this.encoder.Varint32(value);
    } else {
      throw 'Int32 out of range';
    }
  }

  /**
   * Writes an int64 field to the buffer. Numbers outside the range [-2^63,2^63)
   * will be truncated.
   */
  Int64(field: number, value: bigint) {
    if (value >= -TWO_TO_63 && value < TWO_TO_63) {
      this.Tag(field, WireType.VARINT);
      this.encoder.Varint(value);
    } else {
      throw 'Int64 out of range';
    }
  }

  /**
   * Writes a uint32 field to the buffer. Numbers outside the range [0,2^32)
   * will be truncated.
   */
  Uint32(field: number, value: number) {
    if (value >= 0 && value < TWO_TO_32) {
      this.Tag(field, WireType.VARINT);
      this.encoder.UnsignedVarint32(value);
    } else {
      throw 'Uint32 out of range';
    }
  }

  /**
   * Writes an Uint64 field to the buffer. Numbers outside the range [0,2^63)
   * will be truncated.
   */
  Uint64(field: number, value: bigint) {
    if (value >= 0 && value < TWO_TO_63) {
      this.Tag(field, WireType.VARINT);
      this.encoder.Varint(value);
    } else {
      throw 'Uint64 out of range';
    }
  }

  /**
   * Writes an sint32 field to the buffer. Numbers outside the range [-2^31,2^31)
   * will be truncated.
   */
  Sint32(field: number, value: number) {
    if (value >= -TWO_TO_31 && value < TWO_TO_31) {
      this.Tag(field, WireType.VARINT);
      this.encoder.Zigzag32(value);
    } else {
      throw 'Sint out of range';
    }
  }

  /**
   * Writes an sint64 field to the buffer. Numbers outside the range [-2^63,2^63)
   * will be truncated.
   */
  Sint64(field: number, value: bigint) {
    if (value >= -TWO_TO_63 && value < TWO_TO_63) {
      this.Tag(field, WireType.VARINT);
      this.encoder.Zigzag64(value);
    }
  }

  /**
   * Writes a fixed32 field to the buffer. Numbers outside the range [0,2^32)
   * will be truncated.
   */
  Fixed32(field: number, value: number) {
    if (value < TWO_TO_32) {
      this.Tag(field, WireType.FIXED32);
      this.encoder.Fixed32(value);
    } else {
      throw 'Fixed32 too large';
    }
  }

  /**
   * Writes a fixed64 field to the buffer. Numbers outside the range [0,2^64)
   * will be truncated.
   */
  Fixed64(field: number, value: bigint) {
    if (value < TWO_TO_64) {
      this.Tag(field, WireType.FIXED64);
      this.encoder.Fixed64(value);
    } else {
      throw 'Fixed64 too large';
    }
  }

  /**
   * Writes a sfixed32 field to the buffer. Numbers outside the range
   * [-2^31,2^31) will be truncated.
   */
  Sfixed32(field: number, value: number) {
    if (value >= -TWO_TO_31 && value < TWO_TO_31) {
      this.Tag(field, WireType.FIXED32);
      this.encoder.Fixed32(value);
    } else {
      throw 'Sfixed32 out of  range';
    }
  }

  /**
   * Writes a sfixed64 field to the buffer. Numbers outside the range
   * [-2^63,2^63) will be truncated.
   */
  Sfixed64(field: number, value: bigint) {
    if (value >= -TWO_TO_63 && value < TWO_TO_63) {
      this.Tag(field, WireType.FIXED64);
      this.encoder.Fixed64(value);
    } else {
      throw 'Sfixed64 out of range';
    }
  }

  /**
   * Writes a single-precision floating point field to the buffer. Numbers
   * requiring more than 32 bits of precision will be truncated.
   */
  Float(field: number, value: number) {
    if (value < FLOAT32_MAX && value > -FLOAT32_MAX) {
      this.Tag(field, WireType.FIXED32);
      this.encoder.Float(value);
    } else {
      throw 'Float out of range';
    }
  }

  /**
   * Writes a double-precision floating point field to the buffer. As this is the
   * native format used by JavaScript, no precision will be lost.
   */
  Double(field: number, value: number) {
    if (value < FLOAT64_MAX && value > -FLOAT64_MAX) {
      this.Tag(field, WireType.FIXED64);
      this.encoder.Double(value);
    } else {
      throw 'Double out of range';
    }
  }

  /**
   * Writes a boolean field to the buffer. We allow numbers as input
   * because the TSPB code generator uses 0/1 instead of true/false to save space
   * in the string representation of the proto.
   */
  Bool(field: number, value: boolean) {
    this.Tag(field, WireType.VARINT);
    this.encoder.Bool(value);
  }

  /**
   * Writes an enum field to the buffer.
   */
  Enum(field: number, value: number) {
    if (value == Math.floor(value)) {
      this.Tag(field, WireType.VARINT);
      this.encoder.Varint32(value);
    } else {
      throw 'Invalid Enum';
    }
  }

  /**
   * Writes a string field to the buffer.
   */
  String(field: number, value: string) {
    if (value.length < 0 || value.length > TWO_TO_52) {
      throw 'String length too long';
    } else {
      const bookmark = this.beginDelimited(field);
      this.encoder.String(value);
      this.endDelimited(bookmark);
    }
  }

  /**
   * Writes an arbitrary byte field to the buffer. Note - to match the behavior
   * of the C++ implementation, empty byte arrays _are_ serialized.
   */
  Bytes(field: number, value: Uint8Array) {
    this.Tag(field, WireType.DELIMITED);
    this.encoder.UnsignedVarint32(value.length);
    this.appendUint8Array(value);
  }

  /**
   * Writes a message to the buffer.
   */
  Message(field: number, value: any) {
    const bookmark = this.beginDelimited(field);
    value.serializeBinaryToWriter(this);
    this.endDelimited(bookmark);
  }

  /**
   * Writes a map to the buffer.
   */
  Map(field: number, value: Map<any, any>, kFT: FieldType, vFT: FieldType) {
    const iter = value.entries();
    let ator = iter.next();
    while (!ator.done) {
      const bookmark = this.beginDelimited(field);
      switch (kFT) {
        case FieldType.INT64:
        case FieldType.UINT64:
          this.Varint(1, ator.value[0]);
          break;
        case FieldType.INT32:
          this.Varint32(1, ator.value[0]);
          break;
        case FieldType.FIXED64:
        case FieldType.SFIXED64:
          this.Fixed64(1, ator.value[0]);
          break;
        case FieldType.FIXED32:
        case FieldType.SFIXED32:
          this.Fixed32(1, ator.value[0]);
          break;
        case FieldType.BOOL:
          this.Bool(1, ator.value[0]);
          break;
        case FieldType.STRING:
          this.String(1, ator.value[0]);
          break;
        case FieldType.UINT32:
          this.Uint32(1, ator.value[0]);
          break;
        case FieldType.ENUM:
          this.Enum(1, ator.value[0]);
          break;
        case FieldType.SINT32:
          this.Sint32(1, ator.value[0]);
          break;
        case FieldType.SINT64:
          this.Sint64(1, ator.value[0]);
          break;
        default:
          throw `Invalid FieldType: ${kFT} (map key)`;
      }
      switch (vFT) {
        case FieldType.DOUBLE:
          this.Double(2, ator.value[1]);
          break;
        case FieldType.FLOAT:
          this.Float(2, ator.value[1]);
          break;
        case FieldType.INT64:
        case FieldType.UINT64:
          this.Varint(2, ator.value[1]);
          break;
        case FieldType.INT32:
          this.Varint32(2, ator.value[1]);
          break;
        case FieldType.FIXED64:
        case FieldType.SFIXED64:
          this.Fixed64(2, ator.value[1]);
          break;
        case FieldType.FIXED32:
        case FieldType.SFIXED32:
          this.Fixed32(2, ator.value[1]);
          break;
        case FieldType.BOOL:
          this.Bool(2, ator.value[1]);
          break;
        case FieldType.STRING:
          this.String(2, ator.value[1]);
          break;
        case FieldType.MESSAGE:
          this.Message(2, ator.value[1]);
          break;
        case FieldType.BYTES:
          this.Bytes(2, ator.value[1]);
          break;
        case FieldType.UINT32:
          this.Uint32(2, ator.value[1]);
          break;
        case FieldType.ENUM:
          this.Enum(2, ator.value[1]);
          break;
        case FieldType.SINT32:
          this.Sint32(2, ator.value[1]);
          break;
        case FieldType.SINT64:
          this.Sint64(2, ator.value[1]);
          break;
        default:
          throw `Invalid FieldType: ${vFT} (map value)`;
      }
      ator = iter.next();
      this.endDelimited(bookmark);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a repeated 32-bit int field.
   */
  RepeatedInt32(field: number, value: number[]) {
    for (let i = 0; i < value.length; i++) {
      this.Varint32(field, value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a repeated 64-bit int field.
   */
  RepeatedInt64(field: number, value: bigint[]) {
    for (let i = 0; i < value.length; i++) {
      this.Varint(field, value[i]);
    }
  }

  /**
   * Writes an array numbers to the buffer as a repeated unsigned 32-bit int field.
   */
  RepeatedUint32(field: number, value: number[]) {
    for (let i = 0; i < value.length; i++) {
      this.Varint32(field, value[i]);
    }
  }

  /**
   * Writes an array numbers to the buffer as a repeated unsigned 64-bit int field.
   */
  RepeatedUint64(field: number, value: bigint[]) {
    for (let i = 0; i < value.length; i++) {
      this.Varint(field, value[i]);
    }
  }

  /**
   * Writes an array numbers to the buffer as a repeated signed 32-bit int field.
   */
  RepeatedSint32(field: number, value: number[]) {
    for (let i = 0; i < value.length; i++) {
      this.Tag(field, WireType.VARINT);
      this.encoder.Zigzag32(value[i]);
    }
  }

  /**
   * Writes an array numbers to the buffer as a repeated signed 64-bit int field.
   */
  RepeatedSint64(field: number, value: bigint[]) {
    for (let i = 0; i < value.length; i++) {
      this.Tag(field, WireType.VARINT);
      this.encoder.Zigzag64(value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a repeated fixed32 field. This
   * works for both signed and unsigned fixed32s.
   */
  RepeatedFixed32(field: number, value: number[]) {
    for (let i = 0; i < value.length; i++) {
      this.Fixed32(field, value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a repeated fixed64 field. This
   * works for both signed and unsigned fixed64s.
   */
  RepeatedFixed64(field: number, value: bigint[]) {
    for (let i = 0; i < value.length; i++) {
      this.Fixed64(field, value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a repeated sfixed32 field.
   */
  RepeatedSfixed32(field: number, value: number[]) {
    for (let i = 0; i < value.length; i++) {
      this.Fixed32(field, value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a repeated sfixed64 field.
   */
  RepeatedSfixed64(field: number, value: bigint[]) {
    for (let i = 0; i < value.length; i++) {
      this.Fixed64(field, value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a repeated float field.
   */
  RepeatedFloat(field: number, value: number[]) {
    for (let i = 0; i < value.length; i++) {
      this.Float(field, value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a repeated double field.
   */
  RepeatedDouble(field: number, value: number[]) {
    for (let i = 0; i < value.length; i++) {
      this.Double(field, value[i]);
    }
  }

  /**
   * Writes an array of booleans to the buffer as a repeated bool field.
   */
  RepeatedBool(field: number, value: boolean[]) {
    for (let i = 0; i < value.length; i++) {
      this.Bool(field, value[i]);
    }
  }

  /**
   * Writes an array of enums to the buffer as a repeated enum field.
   */
  RepeatedEnum(field: number, value: number[]) {
    for (let i = 0; i < value.length; i++) {
      this.Enum(field, value[i]);
    }
  }

  /**
   * Writes an array of strings to the buffer as a repeated string field.
   */
  RepeatedString(field: number, value: string[]) {
    for (let i = 0; i < value.length; i++) {
      this.String(field, value[i]);
    }
  }

  /**
   * Writes an array of arbitrary byte fields to the buffer.
   */
  RepeatedBytes(field: number, value: Uint8Array[]) {
    for (let i = 0; i < value.length; i++) {
      this.Bytes(field, value[i]);
    }
  }

  /**
   * Writes an array of messages to the buffer.
   */
  RepeatedMessage(field: number, value: any[]) {
    for (let i = 0; i < value.length; i++) {
      const bookmark = this.beginDelimited(field);
      value[i].serializeBinaryToWriter(this);
      this.endDelimited(bookmark);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a packed 32-bit int field.
   */
  PackedInt32(field: number, value: number[]) {
    const bookmark = this.beginDelimited(field);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Varint32(value[i]);
    }
    this.endDelimited(bookmark);
  }

  /**
   * Writes an array of numbers to the buffer as a packed 64-bit int field.
   */
  PackedInt64(field: number, value: bigint[]) {
    const bookmark = this.beginDelimited(field);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Varint(value[i]);
    }
    this.endDelimited(bookmark);
  }

  /**
   * Writes an array numbers to the buffer as a packed unsigned 32-bit int field.
   */
  PackedUint32(field: number, value: number[]) {
    const bookmark = this.beginDelimited(field);
    for (let i = 0; i < value.length; i++) {
      this.encoder.UnsignedVarint32(value[i]);
    }
    this.endDelimited(bookmark);
  }

  /**
   * Writes an array numbers to the buffer as a packed unsigned 64-bit int field.
   */
  PackedUint64(field: number, value: bigint[]) {
    const bookmark = this.beginDelimited(field);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Varint(value[i]);
    }
    this.endDelimited(bookmark);
  }

  /**
   * Writes an array numbers to the buffer as a packed signed 32-bit int field.
   */
  PackedSint32(field: number, value: number[]) {
    const bookmark = this.beginDelimited(field);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Zigzag32(value[i]);
    }
    this.endDelimited(bookmark);
  }

  /**
   * Writes an array of numbers to the buffer as a packed signed 64-bit int field.
   */
  PackedSint64(field: number, value: bigint[]) {
    const bookmark = this.beginDelimited(field);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Zigzag64(value[i]);
    }
    this.endDelimited(bookmark);
  }

  /**
   * Writes an array of numbers to the buffer as a packed fixed32 field.
   */
  PackedFixed32(field: number, value: number[]) {
    this.Tag(field, WireType.DELIMITED);
    this.encoder.UnsignedVarint32(value.length * 4);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Fixed32(value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a packed fixed64 field.
   */
  PackedFixed64(field: number, value: bigint[]) {
    this.Tag(field, WireType.DELIMITED);
    this.encoder.UnsignedVarint32(value.length * 8);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Fixed64(value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a packed sfixed32 field.
   */
  PackedSfixed32(field: number, value: number[]) {
    this.Tag(field, WireType.DELIMITED);
    this.encoder.UnsignedVarint32(value.length * 4);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Fixed32(value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a packed sfixed64 field.
   */
  PackedSfixed64(field: number, value: bigint[]) {
    this.Tag(field, WireType.DELIMITED);
    this.encoder.UnsignedVarint32(value.length * 8);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Fixed64(value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a packed float field.
   */
  PackedFloat(field: number, value: number[]) {
    this.Tag(field, WireType.DELIMITED);
    this.encoder.UnsignedVarint32(value.length * 4);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Float(value[i]);
    }
  }

  /**
   * Writes an array of numbers to the buffer as a packed double field.
   */
  PackedDouble(field: number, value: number[]) {
    this.Tag(field, WireType.DELIMITED);
    this.encoder.UnsignedVarint32(value.length * 8);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Double(value[i]);
    }
  }

  /**
   * Writes an array of booleans to the buffer as a packed bool field.
   */
  PackedBool(field: number, value: boolean[]) {
    this.Tag(field, WireType.DELIMITED);
    this.encoder.UnsignedVarint32(value.length);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Bool(value[i]);
    }
  }

  /**
   * Writes an array of enums to the buffer as a packed enum field.
   */
  PackedEnum(field: number, value: number[]) {
    const bookmark = this.beginDelimited(field);
    for (let i = 0; i < value.length; i++) {
      this.encoder.Enum(value[i]);
    }
    this.endDelimited(bookmark);
  }
}
