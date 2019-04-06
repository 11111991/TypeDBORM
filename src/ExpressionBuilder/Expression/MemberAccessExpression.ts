import { columnMetaKey, relationMetaKey } from "../../Decorator/DecoratorKey";
import { IExpression } from "./IExpression";
import { RelationMetaData } from "../../MetaData/Relation/RelationMetaData";
import { IMemberOperatorExpression } from "./IMemberOperatorExpression";
import { ColumnMetaData } from "../../MetaData/ColumnMetaData";
import { resolveClone, hashCode } from "../../Helper/Util";
import { GenericType } from "../../Common/Type";
export class MemberAccessExpression<TE, K extends keyof TE, T = TE[K]> implements IMemberOperatorExpression<TE, T> {
    public itemType?: GenericType;
    constructor(public objectOperand: IExpression<TE>, public memberName: K) { }
    private _type: GenericType<T>;
    public get type() {
        if (!this._type) {
            if (this.objectOperand.type) {
                const columnMeta: ColumnMetaData = Reflect.getOwnMetadata(columnMetaKey, this.objectOperand.type, this.memberName);
                const relationMeta: RelationMetaData<TE, any> = Reflect.getOwnMetadata(relationMetaKey, this.objectOperand.type, this.memberName);
                if (columnMeta)
                    this._type = columnMeta.type;
                else if (relationMeta) {
                    if (relationMeta.relationType === "one")
                        this._type = relationMeta.target.type;
                    else {
                        this._type = Array as any;
                        this.itemType = relationMeta.target.type;
                    }
                }
                else {
                    const val = this.objectOperand.type.prototype[this.memberName];
                    if (val)
                        this._type = val.constructor;
                }
            }
        }
        return this._type;
    }
    public toString(): string {
        let result = this.objectOperand.toString();
        result += "." + this.memberName;
        return result;
    }
    public clone(replaceMap?: Map<IExpression, IExpression>) {
        if (!replaceMap) replaceMap = new Map();
        const objectOperand = resolveClone(this.objectOperand, replaceMap);
        const clone = new MemberAccessExpression<TE, K, T>(objectOperand, this.memberName);
        replaceMap.set(this, clone);
        return clone;
    }
    public hashCode() {
        return hashCode("." + this.memberName, this.objectOperand.hashCode());
    }
}
