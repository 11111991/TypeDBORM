import { MethodCallExpression } from "../ExpressionBuilder/Expression/MethodCallExpression";
import { QueryBuilder } from "../QueryBuilder/QueryBuilder";
import { Queryable } from "./Queryable";
import { SelectExpression } from "./QueryExpression/SelectExpression";
import { IQueryVisitParameter } from "../QueryBuilder/QueryExpressionVisitor";
import { hashCode } from "../Helper/Util";
import { ICommandQueryExpression } from "./QueryExpression/ICommandQueryExpression";

export class IntersectQueryable<T> extends Queryable<T> {
    constructor(public readonly parent: Queryable<T>, protected readonly parent2: Queryable<T>) {
        super(parent.type, parent);
        this.setOption(this.parent2.options);
    }
    public buildQuery(queryBuilder: QueryBuilder): ICommandQueryExpression<T> {
        const objectOperand = this.parent.buildQuery(queryBuilder) as SelectExpression<T>;
        const childOperand = this.parent2.buildQuery(queryBuilder) as SelectExpression<T>;
        const methodExpression = new MethodCallExpression(objectOperand, "intersect", [childOperand]);
        const visitParam: IQueryVisitParameter = { commandExpression: objectOperand, scope: "queryable" };
        return queryBuilder.visit(methodExpression, visitParam) as any;
    }
    public hashCode() {
        return this.parent.hashCode() + hashCode("INTERSECT") + this.parent2.hashCode();
    }
}
