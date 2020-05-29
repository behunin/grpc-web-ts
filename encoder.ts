/**
 * BinaryEncoder implements encoders for all the wire types specified in
 * https://developers.google.com/protocol-buffers/docs/encoding.
 */
export class BinaryEncoder {
  private buffer: number[] = [];

  get Length() {
    return this.buffer.length;
  }

  get Buffer() {
    return this.buffer;
  }

  /**
   * Encodes a 32-bit unsigned integer into its wire-format varint representation
   * and stores it in the buffer.
   */
  UnsignedVarint32(value: number) {
    while (value > 127) {
      this.buffer.push((value & 0x7f) | 0x80);
      value = value >>> 7;
    }
    this.buffer.push(value);
  }

  /**
   * Encodes a 32-bit signed integer into its wire-format varint representation
   * and stores it in the buffer.
   */
  Varint32(v: number) {
    // Use the unsigned version if the value is not negative.
    if (v >= 0) {
      this.UnsignedVarint32(v);
      return;
    }

    // Write nine bytes with a _signed_ right shift so we preserve the sign bit.
    for (var i = 0; i < 4; i++) {
      this.buffer.push((v & 0x7f) | 0x80);
      v = v >> 7;
    }

    // The above loop writes out 28 bits, so the last byte is always the sign bit
    // which is always set for negative numbers.
    this.buffer.push(v);
    this.buffer.push(1);
  }

  /**
   * Encodes a 64-bit unsigned integer into its wire-format varint representation
   * and stores it in the buffer. Integers that are not representable in 64 bits
   * will be truncated.
   */
  UnsignedVarint(v: bigint) {
    while (v > 127) {
      this.buffer.push(Number((v & 0x7fn) | 0x80n));
      v = v >> 7n;
    }
    this.buffer.push(Number(v));
  }

  /**
   * Encodes a 64-bit signed integer into its wire-format varint representation
   * and stores it in the buffer. Integers that are not representable in 64 bits
   * will be truncated.
   */
  Varint(v: bigint) {
    // Use the unsigned version if the value is not negative.
    if (v >= 0n) {
      this.UnsignedVarint(v);
      return;
    }
    // Write nine bytes with a _signed_ right shift so we preserve the sign bit.
    for (var i = 0; i < 9; i++) {
      this.buffer.push(Number((v & 0x7fn) | 0x80n));
      v = v >> 7n;
    }
    // The above loop writes out 28 bits, so the last byte is always the sign bit
    // which is always set for negative numbers.
    this.buffer.push(1);
  }

  /**
   * Encodes a JavaScript integer into its wire-format, zigzag-encoded varint
   * representation and stores it in the buffer.
   */
  Zigzag32(value: number) {
    this.UnsignedVarint32(((value << 1) ^ (value >> 31)) >>> 0);
  }

  /**
   * Encodes a JavaScript integer into its wire-format, zigzag-encoded varint
   * representation and stores it in the buffer. Integers not representable in 64
   * bits will be truncated.
   */
  Zigzag64(x: bigint) {
    this.Varint((x << 1n) ^ (x >> 63n));
  }

  /**
   * Writes a unsigned 32-bit integer to the buffer.
   */
  Fixed32(value: number) {
    this.buffer.push((value >>> 0) & 0xff);
    this.buffer.push((value >>> 8) & 0xff);
    this.buffer.push((value >>> 16) & 0xff);
    this.buffer.push((value >>> 24) & 0xff);
  }

  /**
   * Writes a unsigned 64-bit integer to the buffer.
   */
  Fixed64(value: bigint) {
    this.buffer.push(Number(value >> 0n));
    this.buffer.push(Number(value >> 8n));
    this.buffer.push(Number(value >> 16n));
    this.buffer.push(Number(value >> 24n));
    this.buffer.push(Number(value >> 32n));
    this.buffer.push(Number(value >> 40n));
    this.buffer.push(Number(value >> 48n));
    this.buffer.push(Number(value >> 56n));
  }

  /**
   * Writes a single-precision floating point value to the buffer. Numbers
   * requiring more than 32 bits of precision will be truncated.
   */
  Float(value: number) {
    const frame = new ArrayBuffer(4);
    new DataView(frame).setFloat32(0, value, true);
    this.buffer.push(...new Uint8Array(frame));
  }

  /**
   * Writes a double-precision floating point value to the buffer. As this is
   * the native format used by JavaScript, no precision will be lost.
   */
  Double(value: number) {
    const frame = new ArrayBuffer(8);
    new DataView(frame).setFloat64(0, value, true);
    this.buffer.push(...new Uint8Array(frame));
  }

  /**
   * Writes a boolean value to the buffer as a varint.
   */
  Bool(value: boolean) {
    this.buffer.push(value ? 1 : 0);
  }

  /**
   * Writes an enum value to the buffer as a varint.
   */
  Enum(value: number) {
    this.Varint32(value);
  }

  /**
   * Writes an arbitrary byte array to the buffer.
   */
  Bytes(bytes: Uint8Array) {
    this.buffer.push.apply(bytes);
  }

  /**
   * Writes a UTF16 Javascript string to the buffer encoded as UTF8.
   * Returns length of encoded string.
   */
  String(str: string): number {
    const oLength = this.buffer.length;
    // https://gist.github.com/joni/3760795#file-toutf8array-js
    for (var i = 0; i < str.length; i++) {
      let charcode = str.charCodeAt(i);
      if (charcode < 0x80) this.buffer.push(charcode);
      else if (charcode < 0x800) {
        this.buffer.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        this.buffer.push(
          0xe0 | (charcode >> 12),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        );
      }
      // surrogate pair
      else {
        i++;
        // UTF-16 encodes 0x10000-0x10FFFF by
        // subtracting 0x10000 and splitting the
        // 20 bits of 0x0-0xFFFFF into two halves
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        this.buffer.push(
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        );
      }
    }

    return this.buffer.length - oLength;
  }
}
