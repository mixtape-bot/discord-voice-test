import type { SessionContext } from "./srtp.js";
import {
    create_poly1305_encryption_strategy,
    create_poly1305_lite_nonce_strategy,
    create_poly1305_normal_nonce_strategy,
    create_poly1305_suffix_nonce_strategy,
} from "./poly1305.js";
import { create_aes256_encryption_strategy } from "./aes.js";
import type { RtpHeader } from "../packet/rtp.js";
import type { BufferCursor } from "../tools/mutable_cursor.js";
import type { ReadonlyBufferCursor } from "../tools/readonly_cursor.js";

export const strategies = {
    aead_aes256_gcm: (session_context: SessionContext) =>
        create_aes256_encryption_strategy(session_context),
    xsalsa20_poly1305: (secret_key: Uint8Array) =>
        create_poly1305_encryption_strategy(secret_key, create_poly1305_normal_nonce_strategy()),
    xsalsa20_poly1305_lite: (secret_key: Uint8Array) =>
        create_poly1305_encryption_strategy(secret_key, create_poly1305_lite_nonce_strategy()),
    xsalsa20_poly1305_suffix: (secret_key: Uint8Array) =>
        create_poly1305_encryption_strategy(secret_key, create_poly1305_suffix_nonce_strategy()),
}

type xsalsa20_poly1305 = "xsalsa20_poly1305"

export type EncryptionStrategyFactory<D> = (data: D) => EncryptionStrategy
export type EncryptionStrategyFactories = typeof strategies;

export type EncryptionStrategies = xsalsa20_poly1305 | `${xsalsa20_poly1305}_lite` | `${xsalsa20_poly1305}_suffix` | "aead_aes256_gcm";

export interface EncryptionStrategy {
    name: string;
    encrypt_rtp(cursor: BufferCursor, header: RtpHeader, roc: number, payload: Uint8Array): void;
    decrypt_rtp(header: RtpHeader, packet: Buffer, encrypted: ReadonlyBufferCursor): Uint8Array | null;
}
