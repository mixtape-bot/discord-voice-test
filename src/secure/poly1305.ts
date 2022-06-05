import type { EncryptionStrategy } from "./encryption.js";
import { BufferCursor } from "../tools/mutable_cursor.js";
import { RtpHeader, write_rtp_header } from "../packet/rtp.js";
// @ts-ignore
import { crypto_secretbox_easy, randombytes_buf } from "@devtomio/sodium";

export const XSALSA20_POLY1305_NONCE_LENGTH = 24;

export function create_poly1305_encryption_strategy(
    secret_key: Uint8Array,
    nonce_strategy: Poly1305NonceStrategy = create_poly1305_lite_nonce_strategy()
): EncryptionStrategy {
    const nonce_cursor = BufferCursor.with_size(nonce_strategy.nonce_length);
    return {
        name: "xsalsa20_poly1305" + nonce_strategy.name === "normal" ? "" : `_$${nonce_strategy.name}`,
        encrypt_rtp(cursor: BufferCursor, header: RtpHeader, _roc: number, payload: Uint8Array) {
            nonce_cursor.reset();
            nonce_strategy.generate(nonce_cursor, header);
            cursor.write_bytes(crypto_secretbox_easy(payload, nonce_cursor.data, secret_key));
            nonce_strategy.write(cursor, nonce_cursor.data);
        }
    }
}

export function create_poly1305_normal_nonce_strategy(): Poly1305NonceStrategy {
    return {
        name: "normal",
        nonce_length: XSALSA20_POLY1305_NONCE_LENGTH,
        generate: (cursor, header) => write_rtp_header(cursor, header),
        write: () => void 0
    }
}

export function create_poly1305_suffix_nonce_strategy(): Poly1305NonceStrategy {
    return {
        name: "suffix",
        nonce_length: XSALSA20_POLY1305_NONCE_LENGTH,
        generate: cursor => cursor.write_bytes(randombytes_buf(24)),
        write: (cursor, nonce) => cursor.write_bytes(nonce)
    }
}

export function create_poly1305_lite_nonce_strategy(): Poly1305NonceStrategy {
    let seq = 0;
    return {
        name: "lite",
        nonce_length: XSALSA20_POLY1305_NONCE_LENGTH,
        generate: cursor => cursor.write_uint32_le(++seq),
        write: cursor => cursor.write_uint32_le(seq)
    }
}

export type Poly1305NonceStrategyName = "normal" | "suffix" | "lite";

export interface Poly1305NonceStrategy  {
    name: string;
    nonce_length: number;
    generate: (cursor: BufferCursor, header: RtpHeader) => void;
    write: (cursor: BufferCursor, nonce: Buffer) => void;
}