import { Enumerable, keyComparer } from "./Enumerable";

export class ExceptEnumerable<T = any> extends Enumerable<T> {
    public *generator() {
        const result = [];
        for (const value of this.parent) {
            if (!this.parent2.any(o => keyComparer(o, value))) {
                result.push(value);
                yield value;
            }
        }
        this.result = result;
        this.isResultComplete = true;
    }
    constructor(protected readonly parent: Enumerable<T>, protected readonly parent2: Enumerable<T>) {
        super();
    }
}
