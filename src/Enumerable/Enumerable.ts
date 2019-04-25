import { GenericType } from "../Common/Type";

export const keyComparer = <T = any>(a: T, b: T) => {
    let result = a === b;
    if (!result && a instanceof Object && b instanceof Object) {
        try {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            result = aKeys.length === bKeys.length;
            if (result) {
                result = aKeys.all(o => b.hasOwnProperty(o) && (b as any)[o] === (a as any)[o]);
            }
        }
        catch (e) {

        }
    }
    return result;
};
export class Enumerable<T = any> implements Iterable<T> {
    public static from<T>(source: Iterable<T>): Enumerable<T> {
        return source instanceof Enumerable ? source : new Enumerable(source);
    }
    public static range(start: number, end: number, step: number = 1) {
        return new Enumerable(function* () {
            while (start <= end) {
                yield start;
                start += step;
            }
        }());
    }
    protected parent: Iterable<any>;
    protected cache: IEnumerableCache<T>;
    public set enableCache(value) {
        if (this.parent) {
            this.cache.enabled = value;
            if (!value) this.cache.result = undefined;
        }
    }
    public get enableCache() {
        return !this.parent || this.cache.enabled;
    }
    constructor(source?: Iterable<T>) {
        this.cache = {};
        if (source) {
            if (Array.isArray(source)) {
                this.cache.result = source;
                this.cache.enabled = true;
                this.cache.isDone = true;
            }
            if ((source as IterableIterator<any>).next) {
                this.cache.iterator = source as IterableIterator<any>;
                this.enableCache = true;
            }
            else {
                this.parent = source as Iterable<any>;
            }
        }
    }
    public [Symbol.iterator](): IterableIterator<T> {
        if (this.enableCache) {
            return this.cachedGenerator();
        }
        return this.generator();
    }
    private *cachedGenerator() {
        if (!this.cache.iterator && this.parent) {
            this.cache.iterator = this.generator();
        }
        if (!this.cache.result) {
            this.cache.result = [];
        }

        let index = 0;
        for (; ;) {
            const isDone = this.cache.isDone;
            while (this.cache.result.length > index)
                yield this.cache.result[index++];
            if (isDone) break;

            const a = this.cache.iterator.next();
            if (!a.done) {
                this.cache.result.push(a.value);
            }
            else if (!this.cache.isDone) {
                this.cache.isDone = true;
                if (this.cache.iterator.return)
                    this.cache.iterator.return();
            }
        }
    }
    protected *generator() {
        for (const value of this.parent) {
            yield value;
        }
    }
    public toArray(): T[] {
        if (this.enableCache && this.cache.isDone) {
            return this.cache.result.slice(0);
        }

        const arr = [];
        for (const i of this) {
            arr.push(i);
        }
        return arr;
    }
    public toMap<K, V = T>(keySelector: (item: T) => K, valueSelector?: (item: T) => V): Map<K, V> {
        const rel = new Map<K, V>();
        for (const i of this) {
            rel.set(keySelector(i), valueSelector ? valueSelector(i) : i as any);
        }
        return rel;
    }
    public all(predicate: (item: T) => boolean): boolean {
        for (const item of this) {
            if (!predicate(item)) {
                return false;
            }
        }
        return true;
    }
    public any(predicate?: (item: T) => boolean): boolean {
        for (const item of this) {
            if (!predicate || predicate(item)) {
                return true;
            }
        }
        return false;
    }
    public first(predicate?: (item: T) => boolean): T | null {
        for (const item of this) {
            if (!predicate || predicate(item)) {
                return item;
            }
        }
        return null;
    }
    public count(predicate?: (item: T) => boolean): number {
        let count = 0;
        for (const item of this) {
            if (!predicate || predicate(item))
                count++;
        }
        return count;
    }
    public sum(selector?: (item: T) => number): number {
        let sum = 0;
        for (const item of this) {
            sum += selector ? selector(item) : item as any;
        }
        return sum;
    }
    public avg(selector?: (item: T) => number): number {
        let sum = 0;
        let count = 0;
        for (const item of this) {
            sum += selector ? selector(item) : item as any;
            count++;
        }
        return sum / count;
    }
    public max(selector?: (item: T) => number): number {
        let max = -Infinity;
        for (const item of this) {
            const num = selector ? selector(item) : item as any;
            if (max < num)
                max = num;
        }
        return max;
    }
    public min(selector?: (item: T) => number): number {
        let min = Infinity;
        for (const item of this) {
            const num = selector ? selector(item) : item as any;
            if (!min || min > num)
                min = num;
        }
        return min;
    }
    public contains(item: T): boolean {
        for (const it of this) {
            if (it === item)
                return true;
        }
        return false;
    }

    // Helper extension
    public each(executor: (item: T, index: number) => void): void {
        let index = 0;
        for (const item of this) {
            executor(item, index++);
        }
    }
    public ofType<T>(type: GenericType<T>): Enumerable<T> {
        return this.where(o => o instanceof (type as any)) as any;
    }
    public reduce<R>(func: (accumulated: R, item: T) => R): R;
    public reduce<R>(seed: R, func: (accumulated: R, item: T) => R): R;
    public reduce<R>(seedOrFunc: R | ((accumulated: R, item: T) => R), func?: (accumulated: R, item: T) => R): R {
        let accumulated: R;
        if (func) {
            accumulated = seedOrFunc as any;
        }
        else {
            func = seedOrFunc as any;
        }

        for (const a of this) {
            accumulated = func(accumulated, a);
        }
        return accumulated;
    }
}

import "./Enumerable.partial";
import "../Extensions/EnumerableExtension";
import "../Extensions/ArrayExtension";
import { IEnumerableCache } from "./IEnumerableCache";
