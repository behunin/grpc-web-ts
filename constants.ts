/**
 * Field type codes.
 * https://github.com/protocolbuffers/protobuf/blob/master/src/google/protobuf/wire_format_lite.h#L110
 */
export enum FieldType {
  INVALID,
  DOUBLE,
  FLOAT,
  INT64,
  UINT64,
  INT32,
  FIXED64,
  FIXED32,
  BOOL,
  STRING,
  GROUP,
  MESSAGE,
  BYTES,
  UINT32,
  ENUM,
  SFIXED32,
  SFIXED64,
  SINT32,
  SINT64
}

/**
 * Wire-format type codes.
 * https://github.com/protocolbuffers/protobuf/blob/master/src/google/protobuf/wire_format_lite.h#L101
 */
export enum WireType {
  VARINT,
  FIXED64,
  DELIMITED,
  START_GROUP,
  END_GROUP,
  FIXED32
}

/**
 * The largest finite float32 value.
 */
export const FLOAT32_MAX = 3.40282e38;

/**
 * The largest finite float64 value.
 */
export const FLOAT64_MAX = 1.79769e308;

/**
 * Convenience constant equal to 2^23.
 */
export const TWO_TO_23 = 8388608;

/**
 * Convenience constant equal to 2^31.
 */
export const TWO_TO_31 = 2147483648;

/**
 * Convenience constant equal to 2^32.
 */
export const TWO_TO_32 = 4294967296;

/**
 * Convenience constant equal to 2^52.
 */
export const TWO_TO_52 = 4503599627370496;

/**
 * Convenience constant equal to 2^63.
 */
export const TWO_TO_63 = 9223372036854775808n;

/**
 * Convenience constant equal to 2^64.
 */
export const TWO_TO_64 = 18446744073709551616n;
