export class ORMError extends Error {
    constructor(code: number, message: string);
    constructor(code: number, error: Error);
    constructor(code: number, messageOrError: string | Error) {
        let message = "";
        let error: Error = null;
        if (messageOrError instanceof Error) {
            error = messageOrError;
            message = error.message;
        }
        else {
            message = messageOrError;
        }
        super(message);
        this.name = code.toString();
        this.code = code;
        this.message = super.message;
        this.stack = super.stack;
        this.innerError = error;
    }
    public readonly code: number;
    public readonly message: string;
    public readonly innerError: Error;
}