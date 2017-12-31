import { Enumerable } from "./Enumerable";

export class SelectEnumerable<T = any, K = any> extends Enumerable<K> {
    constructor(protected readonly parent: Enumerable<T>, protected readonly selector: (item: T) => K) {
        super();
    }
    public [Symbol.iterator]() {
        return this;
    }
    public next(): IteratorResult<K> {
        const result: IteratorResult<K> = {
            done: this.result.length < this.pointer,
            value: this.result[this.pointer]
        };
        if (result.done && !this.isResultComplete) {
            const presult = this.parent.next();
            if (presult.done) {
                this.isResultComplete = true;
                return presult as IteratorResult<any>;
            }
            result.value = this.result[this.pointer] = this.selector(presult.value);
            result.done = false;
        }
        this.pointer++;
        return result;
    }
    public resultAt(): IteratorResult<K> {
        const result: IteratorResult<K> = {
            done: true,
            value: this.result[-1]
        };
        const presult = this.parent.resultAt();
        if (presult.done)
            return presult as IteratorResult<any>;
        result.value = this.selector(presult.value);
        this.reversepointer++;
        return result;
    }
}
