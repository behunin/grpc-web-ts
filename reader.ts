import { FieldType, WireType, TWO_TO_32, TWO_TO_52 } from './constants';
/**
 * BinaryReader implements the decoders for all the wire types specified in
 * https://developers.google.com/protocol-buffers/docs/encoding.
 */
export class BinaryReader {
  private bytes: Uint8Array;
  private end: number;
  private cursor = 0;
  private nextField?: FieldType;
  private nextWireType?: WireType;
  /**
   * In a streaming response, this is used to keep track of the end of each message.
   */
  length = 0;
  constructor(src: Uint8Array) {
    this.bytes = src;
    this.end = src.length;
  }

  get FieldNumber() {
    return this.nextField;
  }

  /**
   * Advances the cursor by the given number
   */
  advance(count: number) {
    this.cursor += count;
    if (this.cursor > this.end) {
      throw `Advancing cursor out of bounds: ${this.cursor} of ${this.end}`;
    }
  }

  /**
   * Reads the length of current message
   */
  Header() {
    // If we're at the end of the block, there are no more messages.
    if (this.cursor >= this.end) {
      return false;
    }
    let l = 0;
    for (let i = 0; i < 5; i++) {
      l = (l << 8) + this.bytes[this.cursor];
      this.advance(1);
    }
    if (l == 0) {
      return false;
    }
    this.length += l + 5;
    return true;
  }

  /**
   * Reads the next field tag in the stream if there is one, returns true if
   * we saw a valid field tag or false if we've read the whole stream.
   * Throws an error if we encountered a deprecated START_GROUP/END_GROUP field.
   */
  get NextField() {
    // If we're at the end of the block, there are no more fields.
    if (this.cursor >= this.end) {
      return false;
    }
    // If we're at the end of a msg in a stream, are there more messages?
    // return and find out
    if (this.cursor == this.length) {
      return false;
    }

    const tag = this.Varint32();
    const field = tag >> 3;
    const type = tag & 7;

    // If the wire type isn't one of the valid ones, something's broken.
    if (
      type != WireType.VARINT &&
      type != WireType.FIXED32 &&
      type != WireType.FIXED64 &&
      type != WireType.DELIMITED &&
      type == (WireType.START_GROUP || WireType.END_GROUP)
    ) {
      throw `Invalid wire type: ${type} at position ${this.cursor}`;
    }

    this.nextField = field;
    this.nextWireType = type;

    return true;
  }

  /**
   * Skips over the next field in the binary stream - this is useful if we're
   * decoding a message that contain unknown fields.
   */
  skipField() {
    switch (this.nextWireType) {
      case WireType.VARINT:
        while (this.bytes[this.cursor] & 0x80) {
          this.advance(1);
        }
        this.advance(1);
        break;
      case WireType.FIXED64:
        this.advance(8);
        break;
      case WireType.DELIMITED:
        var l = this.Varint32();
        this.advance(l);
        break;
      case WireType.FIXED32:
        this.advance(4);
        break;
      default:
        throw `Invalid wire encoding for field: ${this.nextField} wire: ${this.nextWireType}`;
    }
  }

  /**
   * Deserialize a proto into the provided message object
   */
  Message(message: any) {
    if (this.nextWireType == WireType.DELIMITED) {
      // Save the current endpoint of the decoder and move it to the end of the
      // embedded message.
      const oEnd = this.end;
      const l = this.Varint32();
      const nEnd = this.cursor + l;
      this.end = nEnd;

      // Deserialize the embedded message.
      message.deserializeBinaryFromReader(this);

      // Advance the decoder past the message and restore the endpoint.
      this.cursor = nEnd;
      this.end = oEnd;
      return;
    }
    throw 'Message type never';
  }

  /**
   * Deserialize a map field into [key, value]
   */
  Map(kFT: FieldType, vFT: FieldType, msg?: any): Array<any> {
    if (this.nextWireType == WireType.DELIMITED) {
      // Save the current endpoint and then move it to the end of the map entry.
      const oEnd = this.end;
      const l = this.Varint32();
      const nEnd = this.cursor + l;
      this.end = nEnd;
      let arr = [];

      this.Varint32(); // just to keep correct cursor poition

      // key cannot be a floating point or bytes type
      switch (kFT) {
        case FieldType.INT64:
          arr[0] = this.Varint(true);
          break;
        case FieldType.UINT64:
          arr[0] = this.Varint(false);
          break;
        case FieldType.INT32:
        case FieldType.UINT32:
          arr[0] = this.Varint32();
          break;
        case FieldType.FIXED64:
        case FieldType.SFIXED64:
          this.nextWireType = WireType.FIXED64;
          arr[0] = this.Fixed64();
          break;
        case FieldType.STRING:
          arr[0] = this.String();
          break;
        case FieldType.FIXED32:
        case FieldType.SFIXED32:
          this.nextWireType = WireType.FIXED32;
          arr[0] = this.Fixed32();
          break;
        case FieldType.BOOL:
          this.nextWireType = WireType.VARINT;
          arr[0] = this.Bool();
          break;
        case FieldType.ENUM:
          this.nextWireType = WireType.VARINT;
          arr[0] = this.Enum();
          break;
        case FieldType.SINT32:
          this.nextWireType = WireType.VARINT;
          arr[0] = this.Sint32();
          break;
        case FieldType.SINT64:
          this.nextWireType = WireType.VARINT;
          arr[0] = this.Sint64();
          break;
        default:
          throw `Invalid FieldType: ${kFT} (map key)`;
      }

      this.Varint32(); // just to keep correct cursor poition

      // value can be any type except another map
      switch (vFT) {
        case FieldType.DOUBLE:
          this.nextWireType = WireType.FIXED64;
          arr[1] = this.Double();
          break;
        case FieldType.FLOAT:
          this.nextWireType = WireType.FIXED32;
          arr[1] = this.Float();
          break;
        case FieldType.INT64:
          arr[1] = this.Varint(true);
          break;
        case FieldType.UINT64:
          arr[1] = this.Varint(false);
          break;
        case FieldType.INT32:
        case FieldType.UINT32:
          arr[1] = this.Varint32();
          break;
        case FieldType.FIXED64:
        case FieldType.SFIXED64:
          this.nextWireType = WireType.FIXED64;
          arr[1] = this.Fixed64();
          break;
        case FieldType.BOOL:
          this.nextWireType = WireType.VARINT;
          arr[1] = this.Bool();
          break;
        case FieldType.MESSAGE:
          if (msg) {
            this.Varint32(); // just to keep correct cursor poition
            arr[1] = msg.deserializeBinaryFromReader(this);
          }
          break;
        case FieldType.BYTES:
          arr[1] = this.Bytes();
          break;
        case FieldType.STRING:
          arr[1] = this.String();
          break;
        case FieldType.ENUM:
          this.nextWireType = WireType.VARINT;
          arr[1] = this.Enum();
          break;
        case FieldType.FIXED32:
        case FieldType.SFIXED32:
          this.nextWireType = WireType.FIXED32;
          arr[1] = this.Fixed32();
          break;
        case FieldType.SINT32:
          this.nextWireType = WireType.VARINT;
          arr[1] = this.Sint32();
          break;
        case FieldType.SINT64:
          this.nextWireType = WireType.VARINT;
          arr[1] = this.Sint64();
          break;
        default:
          throw 'Invalid field type for map value';
      }
      // Advance the decoder past the map and restore the endpoint.
      this.end = oEnd;
      this.cursor = nEnd;

      return arr;
    }
    throw 'Map type never';
  }

  /**
   * Reads a 32-bit varint from the binary stream. Due to a quirk of the encoding
   * format and Javascript's handling of bitwise math, this actually works
   * correctly for both signed and unsigned 32-bit varints.
   */
  Varint32() {
    let y: number;

    y = this.bytes[this.cursor];
    let x = y & 0x7f;
    if (y < 128) {
      this.advance(1);
      return x;
    }

    y = this.bytes[this.cursor + 1];
    x |= (y & 0x7f) << 7;
    if (y < 128) {
      this.advance(2);
      return x;
    }

    y = this.bytes[this.cursor + 2];
    x |= (y & 0x7f) << 14;
    if (y < 128) {
      this.advance(3);
      return x;
    }

    y = this.bytes[this.cursor + 3];
    x |= (y & 0x7f) << 21;
    if (y < 128) {
      this.advance(4);
      return x;
    }

    y = this.bytes[this.cursor + 4];
    x |= (y & 0x0f) << 28;
    if (y < 128) {
      // We're reading the high bits of an unsigned varint. The byte we just read
      // also contains bits 33 through 35, which we're going to discard.
      this.advance(5);
      return x >>> 0;
    }

    // If we get here, we need to truncate incoming bytes. However we need to make
    // sure cursor place is correct.
    this.advance(5);
    if (
      this.bytes[this.cursor++] >= 128 &&
      this.bytes[this.cursor++] >= 128 &&
      this.bytes[this.cursor++] >= 128 &&
      this.bytes[this.cursor++] >= 128 &&
      this.bytes[this.cursor++] >= 128
    ) {
      // If we get here, the varint is too long.
      throw 'Varint32 to long';
    }

    if (this.cursor > this.end) {
      throw `Decoder cursor out of bounds: ${this.cursor} of ${this.end}`;
    }
    return x;
  }

  /**
   *  BigInt.asIntN or BigInt.asUintN
   */
  sign(v: bigint, s: boolean) {
    if (s) {
      return BigInt.asIntN(64, v);
    } else {
      return BigInt.asUintN(64, v);
    }
  }

  /**
   * Reads a 64-bit integer and returns the signed or unsigned version
   */
  Varint(s: boolean) {
    let y: bigint;
    let v = BigInt(this.bytes[this.cursor]);
    if (v < 0x80n) {
      this.advance(1);
      return this.sign(v, s);
    }
    v -= 0x80n;

    y = BigInt(this.bytes[this.cursor + 1]);
    v |= y << 7n;
    if (y < 0x80n) {
      this.advance(2);
      return this.sign(v, s);
    }
    v -= 0x80n << 7n;

    y = BigInt(this.bytes[this.cursor + 2]);
    v |= y << 14n;
    if (y < 0x80n) {
      this.advance(3);
      return this.sign(v, s);
    }
    v -= 0x80n << 14n;

    y = BigInt(this.bytes[this.cursor + 3]);
    v |= y << 21n;
    if (y < 0x80n) {
      this.advance(4);
      return this.sign(v, s);
    }
    v -= 0x80n << 21n;

    y = BigInt(this.bytes[this.cursor + 4]);
    v |= y << 28n;
    if (y < 0x80n) {
      this.advance(5);
      return this.sign(v, s);
    }
    v -= 0x80n << 28n;

    y = BigInt(this.bytes[this.cursor + 5]);
    v |= y << 35n;
    if (y < 0x80n) {
      this.advance(6);
      return this.sign(v, s);
    }
    v -= 0x80n << 35n;

    y = BigInt(this.bytes[this.cursor + 6]);
    v |= y << 42n;
    if (y < 0x80n) {
      this.advance(7);
      return this.sign(v, s);
    }
    v -= 0x80n << 42n;

    y = BigInt(this.bytes[this.cursor + 7]);
    v |= y << 49n;
    if (y < 0x80n) {
      this.advance(8);
      return this.sign(v, s);
    }
    v -= 0x80n << 49n;

    y = BigInt(this.bytes[this.cursor + 8]);
    v |= y << 56n;
    if (y < 0x80n) {
      this.advance(9);
      return this.sign(v, s);
    }
    v -= 0x80n << 56n;

    y = BigInt(this.bytes[this.cursor + 9]);
    v |= y << 63n;
    if (y < 2n) {
      this.advance(10);
      return this.sign(v, s);
    }
    throw 'Overflow';
  }

  /**
   * Reads a signed 32-bit integer
   */
  Int32() {
    if (this.nextWireType == WireType.VARINT) {
      return this.Varint32();
    }
    throw 'Int32 type never';
  }

  /**
   * Reads a signed 64-bit integer
   */
  Int64() {
    if (this.nextWireType == WireType.VARINT) {
      return this.Varint(true);
    }
    throw 'Int64 type never';
  }

  /**
   * Reads an unsigned 32-bit integer
   */
  Uint32() {
    if (this.nextWireType == WireType.VARINT) {
      return this.Varint32();
    }
    throw 'Uint32 type never';
  }

  /**
   * Reads an unsigned 64-bit integer
   */
  Uint64() {
    if (this.nextWireType == WireType.VARINT) {
      return this.Varint(false);
    }
    throw 'Uint64 type never';
  }

  /**
   * Reads a unsigned zigzag-encoded 32-bit integer
   */
  Sint32() {
    if (this.nextWireType == WireType.VARINT) {
      const z = this.Varint32();
      return (z >>> 1) ^ -(z & 1);
    }
    throw 'Sint32 type never';
  }

  /**
   * Reads a unsigned zigzag-encoded 64-bit integer
   */
  Sint64() {
    if (this.nextWireType == WireType.VARINT) {
      const z = this.Varint(false);
      return (z >> 1n) ^ -(((z << 63n) >> 63n) & 1n);
    }
    throw 'Sint64 type never';
  }

  /**
   * Reads an unsigned 32-bit fixed-length integer
   */
  Fixed32() {
    if (this.nextWireType == WireType.FIXED32) {
      const v =
        (this.bytes[this.cursor] << 0) |
        (this.bytes[this.cursor + 1] << 8) |
        (this.bytes[this.cursor + 2] << 16) |
        (this.bytes[this.cursor + 3] << 24);
      this.advance(4);
      return v;
    }
    throw 'Fixed32 type never';
  }

  /**
   * Reads a signed 32-bit fixed-length integer
   */
  Sfixed32() {
    if (this.nextWireType == WireType.FIXED32) {
      return this.Fixed32();
    }
    throw 'Sfixed32 type never';
  }

  /**
   * Reads an unsigned 64-bit fixed-length integer
   */
  Fixed64() {
    if (this.nextWireType == WireType.FIXED64) {
      const low =
        (this.bytes[this.cursor] << 0) |
        (this.bytes[this.cursor + 1] << 8) |
        (this.bytes[this.cursor + 2] << 16) |
        (this.bytes[this.cursor + 3] << 24);
      this.advance(4);
      const high =
        (this.bytes[this.cursor] << 0) |
        (this.bytes[this.cursor + 1] << 8) |
        (this.bytes[this.cursor + 2] << 16) |
        (this.bytes[this.cursor + 3] << 24);
      this.advance(4);
      return BigInt(high * TWO_TO_32 + (low >>> 0));
    }
    throw 'Fixed64 type never';
  }

  /**
   * Reads a signed 64-bit fixed-length integer
   */
  Sfixed64() {
    if (this.nextWireType == WireType.FIXED64) {
      return this.Fixed64();
    }
    throw 'Sfixed64 type never';
  }

  /**
   * Reads a 32-bit floating-point
   */
  Float(): number {
    if (this.nextWireType == WireType.FIXED32) {
      const flt = this.Fixed32();
      const sign = (flt >> 31) * 2 + 1;
      const exp = (flt >>> 23) & 0xff;
      const mant = flt & 0x7fffff;

      if (exp == 0xff) {
        if (mant) {
          return NaN;
        } else {
          return sign * Infinity;
        }
      }

      // All javascript numbers are double precision(15.955 decimal digits),
      // this is single precision(7.225 decimal digits),
      // so we round to the 7th decimal to get rid of erronious data
      if (exp == 0) {
        // Denormal.
        return Math.round((sign * Math.pow(2, -149) * mant + Number.EPSILON) * 10000000) / 10000000;
      } else {
        return (
          Math.round(
            (sign * Math.pow(2, exp - 150) * (mant + Math.pow(2, 23)) + Number.EPSILON) * 10000000
          ) / 10000000
        );
      }
    }
    throw 'Float type never';
  }

  /**
   * Reads a 64-bit floating-point
   */
  Double(): number {
    if (this.nextWireType == WireType.FIXED64) {
      const bitsLow =
        (this.bytes[this.cursor] << 0) |
        (this.bytes[this.cursor + 1] << 8) |
        (this.bytes[this.cursor + 2] << 16) |
        (this.bytes[this.cursor + 3] << 24);
      this.advance(4);
      const bitsHigh =
        (this.bytes[this.cursor] << 0) |
        (this.bytes[this.cursor + 1] << 8) |
        (this.bytes[this.cursor + 2] << 16) |
        (this.bytes[this.cursor + 3] << 24);
      this.advance(4);
      const sign = (bitsHigh >> 31) * 2 + 1;
      const exp = (bitsHigh >>> 20) & 0x7ff;
      const mant = TWO_TO_32 * (bitsHigh & 0xfffff) + (bitsLow >>> 0);

      if (exp == 0x7ff) {
        if (mant) {
          return NaN;
        } else {
          return sign * Infinity;
        }
      }

      if (exp == 0) {
        // Denormal.
        return sign * Math.pow(2, -1074) * mant;
      } else {
        return sign * Math.pow(2, exp - 1075) * (mant + TWO_TO_52);
      }
    }
    throw 'Double type never';
  }

  /**
   * Reads 0 or 1 as boolean
   */
  Bool(): boolean {
    if (this.nextWireType == WireType.VARINT) {
      return !!this.bytes[this.cursor++];
    }
    throw 'Bool type never';
  }

  /**
   * Reads a Enum value as varint
   */
  Enum(): number {
    if (this.nextWireType == WireType.VARINT) {
      return this.Varint32();
    }
    throw 'Enum type never';
  }

  /**
   * Decodes UTF-8 to Javascript UTF-16
   */
  String(): string {
    if (this.nextWireType == WireType.DELIMITED) {
      const l = this.Varint32();
      const end = this.cursor + l;
      if (l < 0 || l > TWO_TO_52) {
        throw 'String length too long';
      }
      let cursor = this.cursor;
      let codeUnits = [];
      while (cursor < end) {
        let c = this.bytes[cursor++];
        if (c < 128) {
          // Regular 7-bit ASCII.
          codeUnits.push(c);
        } else if (c < 192) {
          // UTF-8 continuation mark. We are out of sync. This
          // might happen if we attempted to read a character
          // with more than four bytes.
          continue;
        } else if (c < 224) {
          // UTF-8 with two bytes.
          codeUnits.push(((c & 31) << 6) | (this.bytes[cursor++] & 63));
        } else if (c < 240) {
          // UTF-8 with three bytes.
          codeUnits.push(
            ((c & 15) << 12) | ((this.bytes[cursor++] & 63) << 6) | (this.bytes[cursor++] & 63)
          );
        } else if (c < 248) {
          // UTF-8 with 4 bytes.
          // Characters written on 4 bytes have 21 bits for a codepoint.
          // We can't fit that on 16bit characters, so we use surrogates.
          let codepoint =
            ((c & 7) << 18) |
            ((this.bytes[cursor++] & 63) << 12) |
            ((this.bytes[cursor++] & 63) << 6) |
            (this.bytes[cursor++] & 63);
          // Surrogates formula from wikipedia.
          // 1. Subtract 0x10000 from codepoint
          codepoint -= 0x10000;
          // 2. Split this into the high 10-bit value and the low 10-bit value
          // 3. Add 0xD800 to the high value to form the high surrogate
          // 4. Add 0xDC00 to the low value to form the low surrogate:
          codeUnits.push(((codepoint >> 10) & 1023) + 0xd800, (codepoint & 1023) + 0xdc00);
        }
      }
      this.cursor = cursor;
      return String.fromCharCode(...codeUnits);
    }
    throw 'String type never';
  }

  /**
   * Reads a length-prefixed block of bytes from the binary stream, or returns
   * null if the next field in the stream has an invalid length value.
   */
  Bytes(): Uint8Array {
    if (this.nextWireType == WireType.DELIMITED) {
      const l = this.Varint32();
      if (l < 0 || l > TWO_TO_52) {
        throw `Invalid length: ${l}`;
      }

      let result = this.bytes.subarray(this.cursor, this.cursor + l);

      this.advance(l);
      return result;
    }
    throw 'Bytes type never';
  }

  /**
   * Reads a packed int32 field, which consists of a length header and a list of
   * signed varints.
   */
  PackedInt32() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<number> = [];
      while (this.cursor < end) {
        result.push(this.Varint32());
      }
      return result;
    }
    throw 'PackedInt32 type never';
  }

  /**
   * Reads a packed int64 field, which consists of a length header and a list of
   * signed varints.
   */
  PackedInt64() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<bigint> = [];
      while (this.cursor < end) {
        result.push(this.Varint(true));
      }
      return result;
    }
    throw 'PackedInt64 type never';
  }

  /**
   * Reads a packed uint32 field, which consists of a length header and a list of
   * unsigned varints.
   */
  PackedUint32() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<number> = [];
      while (this.cursor < end) {
        result.push(this.Varint32());
      }
      return result;
    }
    throw 'PackedUint32 type never';
  }

  PackedUint64() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<bigint> = [];
      while (this.cursor < end) {
        result.push(this.Varint(false));
      }
      return result;
    }
    throw 'PackedUint64 type never';
  }

  /**
   * Reads a packed sint32 field, which consists of a length header and a list of
   * zigzag varints.
   */
  PackedSint32() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<number> = [];
      this.nextWireType = WireType.VARINT;
      while (this.cursor < end) {
        result.push(this.Sint32());
      }
      return result;
    }
    throw 'PackedSint32 type never';
  }

  /**
   * Reads a packed sint64 field, which consists of a length header and a list of
   * zigzag varints.
   */
  PackedSint64() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<bigint> = [];
      this.nextWireType = WireType.VARINT;
      while (this.cursor < end) {
        result.push(this.Sint64());
      }
      return result;
    }
    throw 'PackedSint64 type never';
  }

  /**
   * Reads a packed fixed32 field, which consists of a length header and a list
   * of unsigned 32-bit ints.
   */
  PackedFixed32() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<number> = [];
      this.nextWireType = WireType.FIXED32;
      while (this.cursor < end) {
        result.push(this.Fixed32());
      }
      return result;
    }
    throw 'PackedFixed32 type never';
  }

  /**
   * Reads a packed fixed64 field, which consists of a length header and a list
   * of unsigned 64-bit ints.
   */
  PackedFixed64() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<bigint> = [];
      this.nextWireType = WireType.FIXED64;
      while (this.cursor < end) {
        result.push(this.Fixed64());
      }
      return result;
    }
    throw 'PackedFixed64 type never';
  }

  /**
   * Reads a packed sfixed32 field, which consists of a length header and a list
   * of 32-bit ints.
   */
  PackedSfixed32() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<number> = [];
      this.nextWireType = WireType.FIXED32;
      while (this.cursor < end) {
        result.push(this.Fixed32());
      }
      return result;
    }
    throw 'PackedSfixed32 type never';
  }

  /**
   * Reads a packed sfixed64 field, which consists of a length header and a list
   * of 64-bit ints.
   */
  PackedSfixed64() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<bigint> = [];
      this.nextWireType = WireType.FIXED64;
      while (this.cursor < end) {
        result.push(this.Fixed64());
      }
      return result;
    }
    throw 'PackedSfixed64 type never';
  }

  /**
   * Reads a packed float field, which consists of a length header and a list of
   * floats.
   */
  PackedFloat() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<number> = [];
      this.nextWireType = WireType.FIXED32;
      while (this.cursor < end) {
        result.push(this.Float());
      }
      return result;
    }
    throw 'PackedFloat type never';
  }

  /**
   * Reads a packed double field, which consists of a length header and a list of
   * doubles.
   */
  PackedDouble() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<number> = [];
      this.nextWireType = WireType.FIXED64;
      while (this.cursor < end) {
        result.push(this.Double());
      }
      return result;
    }
    throw 'PackedDouble type never';
  }

  /**
   * Reads a packed bool field, which consists of a length header and a list of
   * unsigned varints.
   */
  PackedBool() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<boolean> = [];
      this.nextWireType = WireType.VARINT;
      while (this.cursor < end) {
        result.push(this.Bool());
      }
      return result;
    }
    throw 'PackedBool type never';
  }

  /**
   * Reads a packed enum field, which consists of a length header and a list of
   * unsigned varints.
   */
  PackedEnum() {
    if (this.nextWireType == WireType.DELIMITED) {
      const length = this.Varint32();
      const end = this.cursor + length;
      let result: Array<number> = [];
      this.nextWireType = WireType.VARINT;
      while (this.cursor < end) {
        result.push(this.Enum());
      }
      return result;
    }
    throw 'PackedEnum type never';
  }
}
