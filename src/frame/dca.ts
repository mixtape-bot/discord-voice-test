import type { FramePoller } from "./poller.js";
import { ReadonlyBufferCursor } from "../tools/readonly_cursor.js";
import * as fs from "node:fs";
import { Readable, Transform, TransformCallback } from "node:stream";
import prism from "prism-media";
import { create_streamed_frame_poller } from "./poller.js";

const MAGIC_BYTES = [ 68, 67, 65 ];

export function read_dca_packet(cursor: ReadonlyBufferCursor): DcaPacket {
    const length = cursor.read_uint16_le();
    const bytes = cursor.read_bytes(length);
    return { length, bytes }
}

export function read_dca_header(dca: ReadonlyBufferCursor): DcaHeader {
    let version_bytes = dca.read_bytes(4);
    for (let i = 0; i < MAGIC_BYTES.length; i++) {
        if (version_bytes[i] !== MAGIC_BYTES[i]) {
            return { dca: { version: 0 } };
        }
    }

    const version = +String.fromCharCode(version_bytes[3]);
    switch (version) {
        case 1: // DCA1
            const json_length = dca.read_uint32_le();
            const json_bytes = dca.read_bytes(json_length);
            return JSON.parse(json_bytes.toString());
        default:
            throw new Error(`Unknown DCA version: ${version}`);
    }
}

export function create_dca_file_frame_poller(file_path: string): FramePoller {
    const dca = fs.readFileSync(file_path);
    return create_dca_frame_poller(new ReadonlyBufferCursor(dca));
}

export function create_dca_frame_poller(dca: ReadonlyBufferCursor): DcaFramePoller {
    const header = read_dca_header(dca);

    const pipeline = Readable.from(dca.data.subarray(dca.position, dca.data.length))
        .pipe(new DcaTransform())
        .pipe(new prism.opus.Decoder({ frameSize: 1920, rate: 48000, channels: 2 }))
        .pipe(new prism.opus.Encoder({ frameSize: 960 , rate: 48000, channels: 2 }));

    return {
        header,
        ...create_streamed_frame_poller(pipeline)
    };
}

interface DcaFramePoller extends FramePoller {
    header: DcaHeader;
}

interface DcaPacket {
    length: number;
    bytes: Buffer;
}

interface DcaHeader {
    dca: {
        version: number;
        tool?: DcaTool;
    };
}

interface DcaTool {
    name: string;
    version: string;
    url: string;
    author: string;
}

class DcaTransform extends Transform {
    override _transform(chunk: any, _encoding: BufferEncoding, callback: TransformCallback): void {
        const chunkk = chunk instanceof Buffer
            ? chunk
            : Buffer.from(chunk);

        const { bytes } = read_dca_packet(new ReadonlyBufferCursor(chunkk))
        callback(null, bytes)
    }
}


