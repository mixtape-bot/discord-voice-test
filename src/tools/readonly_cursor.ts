export class ReadonlyBufferCursor {
    position = 0;

    constructor(public data: Buffer) {
    }

    /**
     * The remaining number of bytes that can be read.
     */
    get remaining(): number {
        return this.data.length - this.position;
    }

    /**
     * Reads a single byte from the underlying buffer.
     * @returns {number}
     */
    read(): number {
        return this.data[this.position++];
    }

    /**
     * Reads {@link n} number of bytes from the underlying buffer.
     *
     * @param {number} n the number of bytes to read.
     * @returns {ReadonlyBufferCursor} a view containing the bytes that were read.
     */
    read_bytes(n: number): Buffer {
        const buffer = Buffer.alloc(n);
        this.data.copy(buffer, 0, this.position, this.position + n);
        this.position += n;

        return buffer;
    }

    /**
     * Reads an unsigned 16-bit integer from the underlying buffer. (lil-endian)
     * @returns {number}
     */
    read_uint16_le(): number {
        this.require_bytes(2);

        const int = this.data.readUint16LE(this.position);
        this.position += 2;

        return int;
    }

    /**
     * Reads an unsigned 32-bit integer from the underlying buffer. (lil-endian)
     * @returns {number}
     */
    read_uint32_le(): number {
        this.require_bytes(4);

        const int = this.data.readUint32LE(this.position);
        this.position += 4;

        return int;
    }


    private require_bytes(n: number) {
        if (this.data.length < this.position + n) {
            throw new RangeError("Not enough bytes to read.");
        }
    }
}
