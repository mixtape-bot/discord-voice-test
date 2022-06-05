export const LABEL_SRTP_ENCRYPTION = 0x00
export const LABEL_SRTP_AUTH_TAG = 0x01
export const LABEL_SRTP_SALT = 0x02

export interface MasterKey {
    secret: Buffer;
    salt: Buffer;
}

export interface SessionContext {
    key: Buffer;
    salt: Buffer;
}
