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
    read_bytes(n: number = this.data.length - this.position): Buffer {
        const buffer = Buffer.alloc(n);
        this.data.copy(buffer, 0, this.position, this.position + n);
        this.position += n;

        return buffer;
    }

    /**
     * Reads an unsigned {@link size n}-bit integer from the underlying buffer. (big-endian)
     *
     * @param size the number of bits to read.
     * @returns {number}
     */
    read_uint_be(size: number): number {
        this.require_bytes(size);
        const short = this.data.readUintBE(this.position, size);
        this.position += size;
        return short;
    }

    /**
     * Reads an unsigned {@link bytes n}-bit integer from the underlying buffer. (lil-endian)
     *
     * @param bytes the number of bits to read.
     * @returns {number}
     */
    read_uint_le(bytes: number): number {
        this.require_bytes(bytes);
        const short = this.data.readUintLE(this.position, bytes);
        this.position += bytes;
        return short;
    }

    resize(start = 0, end = this.data.length) {
        // check if the start and end is within bounds and are in the correct order
        if (start >= 0 && end <= this.data.length) {
            this.data = this.data.subarray(start, end);
            return true;
        }

        return false;
    }

    private require_bytes(n: number) {
        if (this.data.length < this.position + n) {
            throw new RangeError("Not enough bytes to read.");
        }
    }
}
