import { BufferCursor } from "../tools/mutable_cursor.js";
import type { EncryptionStrategy } from "../secure/encryption.js";

export function create_packet_provider(
    ssrc: number,
    encryption_strategy: EncryptionStrategy
): PacketProvider {
    const cursor = new BufferCursor(Buffer.alloc(2048));

    let sequence = 0, timestamp = 0, roc = 0;

    function get_rtp_header(): RtpHeader {
        if (sequence > 65565) {
            roc++;
            sequence = 0;
        }

        const ts = timestamp;
        timestamp += 960;

        return {
            timestamp: ts,
            sequence: sequence++,
            ssrc,
        };
    }

    return {
        provide: frame => {
            cursor.reset();
            cursor.data.fill(0)
            cursor.resize(12 + frame.length + 16 + 24);

            /* write the rtp header to the  */
            const header = get_rtp_header();
            write_rtp_header(cursor, header);

            /* encrypt the packet. */
            encryption_strategy.encrypt_rtp(cursor, header, roc, frame)

            return cursor.view();
        },
    };
}

export function write_rtp_header(cursor: BufferCursor, header: RtpHeader) {
    cursor.write(0x80);                       // 0          RTP version
    cursor.write(0x78);                       // 1          Payload type
    cursor.write_uint16_be(header.sequence);  // 2 3        sequence
    cursor.write_uint32_be(header.timestamp); // 4 5 6 7    timestamp
    cursor.write_uint32_be(header.ssrc);      // 8 9 10 11  ssrc
}

export interface RtpHeader {
    sequence: number;
    timestamp: number;
    ssrc: number;
}

export interface PacketProvider {
    provide(data: Uint8Array): Buffer;
}
