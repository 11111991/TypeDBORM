import { IObjectType } from "../../Common/Type";
import { ProjectionEntityExpression } from "./ProjectionEntityExpression";
import { SelectExpression } from "./SelectExpression";
import { IExpression } from "../../ExpressionBuilder/Expression/IExpression";
import { resolveClone, hashCode, hashCodeAdd } from "../../Helper/Util";

export class UnionExpression<T> extends ProjectionEntityExpression {
    public readonly entityTypes: IObjectType[];
    constructor(public readonly subSelect: SelectExpression<T>, public readonly subSelect2: SelectExpression, public isUnionAll: IExpression<boolean>, public readonly type: IObjectType<T> = Object as any) {
        super(subSelect, type);
        this.subSelect2.isSubSelect = true;
        this.entityTypes = this.subSelect.entity.entityTypes.concat(this.subSelect2.entity.entityTypes).distinct().toArray();
    }
    public toString(): string {
        return `Union(${this.subSelect.toString()}, ${this.subSelect2.toString()})`;
    }
    public clone(replaceMap?: Map<IExpression, IExpression>) {
        if (!replaceMap) replaceMap = new Map();
        const select = resolveClone(this.subSelect, replaceMap);
        const select2 = resolveClone(this.subSelect2, replaceMap);
        const clone = new UnionExpression(select, select2, this.isUnionAll, this.type);
        replaceMap.set(this, clone);
        return clone;
    }
    public hashCode() {
        return hashCodeAdd(hashCode("UNION", this.subSelect.hashCode()), this.subSelect2.hashCode());
    }
}
