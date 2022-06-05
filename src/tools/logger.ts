import dayjs from "dayjs";
import { EOL } from "node:os";
import { formatWithOptions, InspectOptions } from "node:util";

enum Color {
    Reset,
    Cyan = 36,
    Black = 90,
    Red,
    Green,
    Yellow,
    Blue,
    Magenta,
}

const STDOUT = ["info", "debug", "log"];
const STDERR = ["error", "warn"];
const TIMESTAMP_FORMAT = "HH-mm-ss DD-MM-YYYY";
const SCOPE_REGEX = /^\[([\w\s\d>\\/<_-]+)].+/m;

const inspect_options: InspectOptions = {
    colors: true,
    compact: true,
};

const level_padding = [...STDOUT, ...STDERR].reduce((p, c) => Math.max(p, c.length), 0);
const level_colors: Record<string, Color> = {
    debug: Color.Magenta,
    error: Color.Red,
    warn: Color.Yellow,
    info: Color.Blue,
    log: Color.Green,
    trace: Color.Cyan
};

function print(stream: NodeJS.WriteStream, level: string, message: string, args: any[]) {
    const parts = [
        colorize(dayjs().format(TIMESTAMP_FORMAT), Color.Black),
        colorize(level.padEnd(level_padding, " "), level_colors[level]),
        "•",
    ];

    if (SCOPE_REGEX.test(message)) {
        const [, scope] = SCOPE_REGEX.exec(message)!!;
        message = message.slice(scope.length + 3);
        parts.push(colorize(scope, Color.Cyan));
    }

    stream.write(`${parts.join(" ")} ${formatWithOptions(inspect_options, message, ...args)}` + EOL);
}

export function format_color(color: Color | string | number) {
    if (arguments.length === 3) {
        const [r, g, b] = arguments;
        /* rgb */
        return `\u001b[38;2;${r}:${g}:${b}m`;
    } else if (typeof color === "string") {
        /* parse hex later lol */
        return "no";
    }

    return `\u001b[${color}m`;
}

function colorize(string: string, color: Color) {
    return `${format_color(color)}${string}${format_color(Color.Reset)}`;
}

for (const level of STDOUT) {
    // @ts-expect-error
    console[level] = (message: any, ...args: any[]) => print(process.stdout, level, message, args);
}

for (const level of STDERR) {
    // @ts-expect-error
    console[level] = (message: any, ...args: any[]) => print(process.stderr, level, message, args);
}
