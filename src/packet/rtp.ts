import { BufferCursor } from "../tools/mutable_cursor.js";
import type { EncryptionStrategy } from "../secure/encryption.js";
import { ReadonlyBufferCursor } from "../tools/readonly_cursor.js";

export function create_packet_provider(
    ssrc: number,
    encryption_strategy: EncryptionStrategy,
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

        return create_rtp_header(sequence++, ts, ssrc);
    }

    return {
        provide: frame => {
            cursor.reset();
            cursor.data.fill(0);
            cursor.resize(12 + frame.length + 16 + 24);

            /* write the rtp header to the  */
            const header = get_rtp_header();
            write_rtp_header(cursor, header);

            /* encrypt the packet. */
            encryption_strategy.encrypt_rtp(cursor, header, roc, frame);

            return cursor.view();
        },
    };
}

export function write_rtp_header(cursor: BufferCursor, header: RtpHeader) {
    cursor.write(header.version << 6);   // 0          RTP version
    cursor.write(header.payload_type);        // 1          Payload type
    cursor.write_uint16_be(header.sequence);  // 2 3        sequence
    cursor.write_uint32_be(header.timestamp); // 4 5 6 7    timestamp
    cursor.write_uint32_be(header.ssrc);      // 8 9 10 11  ssrc
}

export function create_rtp_header(sequence: number, timestamp: number, ssrc: number): RtpHeader {
    return {
        version: 2,
        has_extension: false,
        has_padding: false,
        csrc_count: 0,
        marker: false,
        payload_type: 0x78,
        sequence,
        timestamp,
        ssrc,
        csrc_identifiers: [],
    };
}

export function read_rtp_header(cursor: ReadonlyBufferCursor): RtpHeader {
    const fb = cursor.read()
        , sb = cursor.read();

    /* read the header bytes. */
    const header: RtpHeader = {
        version: (fb & 0xC0) >> 6,
        has_padding: (fb & 0x20) === 0x20,
        has_extension: (fb & 0x10) === 0x10,
        csrc_count: fb & 0x0F,
        marker: (sb & 0x80) === 0x80,
        payload_type: sb & 0x7F,
        sequence: cursor.read_uint_be(2),
        timestamp: cursor.read_uint_be(4),
        ssrc: cursor.read_uint_be(4),
        csrc_identifiers: [],
    };

    for (let i = 0; i < header.csrc_count; i++) {
        const csrc_identifier = cursor.read_uint_be(4);
        header.csrc_identifiers.push(csrc_identifier);
    }

    return header;
}

export interface RtpHeader {
    version: number;
    has_padding: boolean;
    has_extension: boolean;
    csrc_count: number;
    csrc_identifiers: number[];
    marker: boolean;
    payload_type: number;
    sequence: number;
    timestamp: number;
    ssrc: number;
}

export interface PacketProvider {
    provide(data: Uint8Array): Buffer;
}

export interface RtpPacket {
    padding_bytes: number;
    payload: ReadonlyBufferCursor;
    header: RtpHeader;
}

export function read_rtp_packet(cursor: ReadonlyBufferCursor) {
    const header = read_rtp_header(cursor)
        , payload_bytes = cursor.read_bytes()
        , padding_bytes = header.has_padding ? payload_bytes[payload_bytes.length - 1] : 0;

    const payload = new ReadonlyBufferCursor(payload_bytes);
    payload.resize(0, payload_bytes.length - padding_bytes);

    return { payload, header, padding_bytes };
}
