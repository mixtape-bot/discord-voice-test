import type { EncryptionStrategy } from "./encryption.js";
import { BufferCursor } from "../tools/mutable_cursor.js";
import { RtpHeader, write_rtp_header } from "../packet/rtp.js";
// @ts-ignore
import { crypto_secretbox_easy, crypto_secretbox_open_easy, randombytes_buf } from "@devtomio/sodium";
import type { ReadonlyBufferCursor } from "../tools/readonly_cursor.js";

export const XSALSA20_POLY1305_NONCE_LENGTH = 24;

export function create_poly1305_encryption_strategy(
    secret_key: Uint8Array,
    nonce_strategy: Poly1305NonceStrategy = create_poly1305_lite_nonce_strategy()
): EncryptionStrategy {
    const encrypt_nonce_cursor = BufferCursor.with_size(24);
    return {
        name: "xsalsa20_poly1305" + nonce_strategy.name === "normal" ? "" : `_${nonce_strategy.name}`,
        encrypt_rtp(cursor: BufferCursor, header: RtpHeader, _roc: number, payload: Uint8Array) {
            encrypt_nonce_cursor.reset();
            nonce_strategy.generate(encrypt_nonce_cursor, header);
            cursor.resize(payload.length + nonce_strategy.nonce_length + 16);
            cursor.write_bytes(crypto_secretbox_easy(payload, encrypt_nonce_cursor.data, secret_key));
            nonce_strategy.write(cursor, encrypt_nonce_cursor.data);
        },
        decrypt_rtp(header: RtpHeader, packet: Buffer, encrypted: ReadonlyBufferCursor): Uint8Array | null {
            let nonce = nonce_strategy.name === "normal"
                ? Buffer.concat([ packet.subarray(0, 12), Buffer.alloc(12) ])
                : nonce_strategy.strip(encrypted, header);

            // const nonce = nonce_strategy.strip(encrypted, header)
            return crypto_secretbox_open_easy(encrypted.data, nonce, secret_key);
        }
    }
}

export function create_poly1305_normal_nonce_strategy(): Poly1305NonceStrategy {
    const nonce_cursor = BufferCursor.with_size(24);
    return {
        name: "normal",
        nonce_length: 0,
        generate: (cursor, header) => write_rtp_header(cursor, header),
        write: () => void 0,
        strip: (_, header) => {
            nonce_cursor.reset();
            write_rtp_header(nonce_cursor, header);
            return nonce_cursor.data;
        },
    }
}

export function create_poly1305_suffix_nonce_strategy(): Poly1305NonceStrategy {
    let cursor = BufferCursor.with_size(24);
    return {
        name: "suffix",
        nonce_length: XSALSA20_POLY1305_NONCE_LENGTH,
        generate: cursor => cursor.write_bytes(randombytes_buf(24)),
        write: (cursor, nonce) => cursor.write_bytes(nonce),
        strip: payload => {
            cursor.write_bytes(payload.data.subarray(cursor.data.length - 24))
            return cursor.data;
        }
    }
}

export function create_poly1305_lite_nonce_strategy(): Poly1305NonceStrategy {
    let seq = 0, cursor = BufferCursor.with_size(24);
    return {
        name: "lite",
        nonce_length: 4,
        generate: cursor => cursor.write_uint32_le(++seq),
        write: cursor => cursor.write_uint32_le(seq),
        strip:  payload => {
            cursor.write_bytes(payload.data.subarray(payload.data.length - 4))
            return cursor.data;
        }
    }
}

export interface Poly1305NonceStrategy  {
    name: string;
    nonce_length: number;
    strip: (packet: ReadonlyBufferCursor, header: RtpHeader) => Buffer;
    generate: (cursor: BufferCursor, header: RtpHeader) => void;
    write: (cursor: BufferCursor, nonce: Buffer) => void;
}
