import { Queryable } from "./Queryable";
import { ExceptExpression, ProjectionEntityExpression, SelectExpression } from "./QueryExpression";

export class ExceptQueryable<T> extends Queryable<T> {
    constructor(public readonly parent: Queryable<T>, protected readonly parent2: Queryable<T>) {
        super(parent.type, parent.queryBuilder);
    }
    public execute(): SelectExpression<T> {
        if (!this.expression) {
            const exceptEntity = new ExceptExpression(
                new ProjectionEntityExpression(new SelectExpression(this.parent.execute() as any), this.queryBuilder.newAlias()),
                new ProjectionEntityExpression(new SelectExpression(this.parent2.execute() as any), this.queryBuilder.newAlias()));

            this.expression = exceptEntity;
        }
        return this.expression as any;
    }
}
