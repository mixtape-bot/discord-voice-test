export class BufferCursor {
    position = 0;

    constructor(public data: Buffer) {
    }

    /**
     * Creates a new {@link BufferCursor} with an underlying buffer of the supplied {@link size}.
     * @param {number} size
     * @returns {BufferCursor} the new cursor.
     */
    static with_size(size: number) {
        return new BufferCursor(Buffer.alloc(size));
    }

    /**
     * Whether this byte array cursor is exhausted.
     */
    get is_exhausted(): boolean {
        return this.position === this.data.length + 1
    }

    /**
     * Sets the current position to the given {@link value offset}.
     * Warning: this may cause data to be overwritten.
     *
     * @param {number} value the value to set the position to.
     */
    use_position(value: number) {
        this.position = value;
    }

    /**
     */
    view(start = 0, end = this.position): Buffer {
        return this.data.subarray(start, end);
    }

    /**
     * Resets this byte array cursor.
     */
    reset() {
        this.position = 0;
    }

    /**
     * Grow the underlying byte array by the given number of bytes.
     *
     * @return `true` if the underlying byte array was grown, `false` otherwise.
     */
    grow(size: number): boolean {
        return this.resize(this.position + size)
    }

    /**
     * Resize the underlying byte array to the given size.
     *
     * @return `true` if the underlying byte array was resized, `false` otherwise.
     */
    resize(newLen: number, ifSmaller = false): boolean {
        if (this.data.length < newLen || ifSmaller) {
            const newData = Buffer.alloc(newLen);
            if (newLen < this.data.length) {
                this.data.copy(newData, 0, 0, newLen)
            }  else {
                this.data.copy(newData, 0, 0, this.data.length);
            }

            this.data = newData;
            return true;
        }

        return false;
    }

    /**
     * Writes the supplied byte to the underlying buffer at the current position.
     * @param {number} byte the byte to write.
     * @returns {this} this cursor, useful for chaining.
     */
    write(byte: number) {
        this.is_not_exhausted_or_throw();
        this.data[this.position] = byte;
        this.position++;
        return this;
    }

    /**
     * Copies the supplied byte array to the underlying buffer at the current position.
     * @param {Uint8Array} bytes the byte array to copy.
     * @param {number} offset the offset to start copying from.
     * @param {number} length the number of bytes to copy.
     * @param {boolean} offsetLength if `true`, the number of bytes copied are offset by {@link offset}.
     * @returns {this} this cursor, useful for chaining.
     */
    write_bytes(bytes: Uint8Array, offset = 0, length = bytes.length, offsetLength = true) {
        const len = offsetLength ? offset + length : length
        if (bytes instanceof Buffer) {
            bytes.copy(this.data, this.position, offset, len)
            this.inc_pos(len);
        } else {
            for (let i = 0; i < length; i++) {
                this.write(bytes[offset + i])
            }
        }

        return this;
    }

    /**
     * Writes the supplied value to the underlying buffer at the current position.
     * @param {number} value the 16-bit integer to write.
     * @returns {this} this cursor, useful for chaining.
     */
    write_uint16_be(value: number) {
        this.data.writeUintBE(value, this.position, 2);
        this.inc_pos(2);
        return this;
    }

    /**
     * Writes the supplied value to the underlying buffer at the current position.
     * @param {number} value the 32-bit integer to write.
     * @returns {this} this cursor, useful for chaining.
     */
    write_uint32_le(value: number) {
        this.data.writeUintLE(value, this.position, 4);
        this.inc_pos(4);
        return this;
    }

    /**
     * Writes the supplied value to the underlying buffer at the current position.
     * @param {number} value the 32-bit integer to write.
     * @returns {this} this cursor, useful for chaining.
     */
    write_uint32_be(value: number) {
        this.data.writeUintBE(value, this.position, 4);
        this.inc_pos(4);
        return this;
    }

    private inc_pos(by: number) {
        this.position += by;
    }

    private is_not_exhausted_or_throw() {
        if (this.is_exhausted) {
            throw new Error("Unable to write any more data.");
        }
    }
}
