import { IExpression } from "./IExpression";
import { hashCode } from "../../Helper/Util";

export class StringTemplateExpression implements IExpression<string> {
    public type = String;
    constructor(public readonly template: string) { }
    public toString(): string {
        return "`" + this.template + "`";
    }
    public clone() {
        return this;
    }
    public hashCode() {
        return hashCode(this.template, hashCode("`"));
    }
}